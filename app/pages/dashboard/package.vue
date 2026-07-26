<script setup lang="ts">
import {
  AlertTriangleIcon,
  CalendarIcon,
  HistoryIcon,
  LayoutGridIcon,
  Loader2Icon,
  TagIcon,
  TerminalIcon,
} from '@lucide/vue';
import { computed, type Component } from 'vue';
import { GitHubIcon } from 'vue3-simple-icons';

import type { PackageVersionFilter, PackageVersionSummary } from '#shared/types/packages';
import DashboardPagination from '~/components/dashboard/DashboardPagination.vue';
import DashboardOverlayFrame from '~/components/dashboard/overlay/DashboardOverlayFrame.vue';
import {
  packageTypeHasVersionTags,
  useUserPackageDetail,
  type PackageDetailTarget,
} from '~/composables/useUserPackages';

const { locale, t } = useI18n();
const localePath = useLocalePath();
const route = useRoute();
const router = useRouter();
const relativeTimeNow = useRelativeTimeNow();
const { openRepository } = useDashboardRepositoryNavigation();

/** Target package from `?user=&type=&name=` (+ optional `account=organization`). */
const packageTarget = computed<PackageDetailTarget | null>(() => {
  const username = getQueryParamValue(route.query.user)?.trim() || '';
  const packageType = parsePackageType(getQueryParamValue(route.query.type));
  const name = getQueryParamValue(route.query.name)?.trim() || '';

  if (!username || !packageType || !name) {
    return null;
  }

  return {
    username,
    packageType,
    name,
    isOrganization: getQueryParamValue(route.query.account) === 'organization',
  };
});

const {
  detail,
  loadingDetail,
  detailError,
  versions,
  loadingVersions,
  versionsError,
  versionsPagination,
  versionsShowPagination,
  versionsFilter,
  versionsTruncated,
  setVersionsFilter,
  goToVersionsPage,
  retryVersions,
  refresh,
} = useUserPackageDetail(() => packageTarget.value);

const pageTitle = computed(() =>
  packageTarget.value ? t('packageDetail.pageTitle', { name: packageTarget.value.name }) : ''
);

usePageMeta(pageTitle);

const initialLoading = computed(() => loadingDetail.value && !detail.value && !detailError.value);

const visibilityLabel = computed(() => {
  switch (detail.value?.visibility) {
    case 'private':
      return t('packages.visibility.private');
    case 'internal':
      return t('packages.visibility.internal');
    case 'public':
      return t('packages.visibility.public');
    default:
      return detail.value?.visibility ?? '';
  }
});

const installCommand = computed(() => {
  const pkg = detail.value;
  if (!pkg) return null;
  return getPackageInstallCommand(pkg.packageType, pkg.ownerLogin, pkg.name);
});

const createdLabel = computed(() => {
  const createdAt = detail.value?.createdAt;
  if (!createdAt) return '';
  const parsed = new Date(createdAt);
  if (Number.isNaN(parsed.getTime())) return '';
  const formatted = new Intl.DateTimeFormat(locale.value, { dateStyle: 'medium' }).format(parsed);
  return t('packageDetail.createdAt', { date: formatted });
});

const updatedLabel = computed(() => {
  const updatedAt = detail.value?.updatedAt;
  if (!updatedAt) return '';
  return t('packageDetail.updatedAt', {
    time: formatDurationFromNow(updatedAt, locale.value, relativeTimeNow.value),
  });
});

/** Only container/docker versions carry tags, so the toggle is hidden elsewhere. */
const showVersionsFilter = computed(() =>
  packageTypeHasVersionTags(packageTarget.value?.packageType)
);

interface VersionsFilterOption {
  value: PackageVersionFilter;
  label: string;
  icon: Component;
}

const versionsFilterOptions = computed<VersionsFilterOption[]>(() => [
  {
    value: 'tagged',
    label: t('packageDetail.versionsFilterTagged'),
    icon: TagIcon,
  },
  {
    value: 'all',
    label: t('dashboard.filters.options.all'),
    icon: LayoutGridIcon,
  },
]);

const versionPublishedLabel = (version: PackageVersionSummary) => {
  const publishedAt = version.createdAt || version.updatedAt || '';
  if (!publishedAt) return '';
  return t('packageDetail.publishedAt', {
    time: formatDurationFromNow(publishedAt, locale.value, relativeTimeNow.value),
  });
};

/** Absolute timestamp as tooltip; the row itself shows relative time. */
const versionPublishedTitle = (version: PackageVersionSummary) => {
  const publishedAt = version.createdAt || version.updatedAt || '';
  if (!publishedAt) return '';
  const parsed = new Date(publishedAt);
  if (Number.isNaN(parsed.getTime())) return '';
  return new Intl.DateTimeFormat(locale.value, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(parsed);
};

/** Container digests are long; keep rows scannable while `title` shows all. */
const versionDisplayName = (version: PackageVersionSummary) => {
  const digestHex = version.name.match(/^sha256:([0-9a-f]+)$/i)?.[1];
  if (digestHex) return `sha256:${digestHex.slice(0, 12)}`;
  if (version.name.length <= 32) return version.name;
  return `${version.name.slice(0, 29)}…`;
};

/** Tagged rows read by tag, not digest; prefer a specific tag over `latest`. */
const versionPrimaryTag = (version: PackageVersionSummary) => {
  if (version.tags.length === 0) return '';
  return version.tags.find((tag) => tag !== 'latest') ?? version.tags[0]!;
};

const versionPrimaryLabel = (version: PackageVersionSummary) =>
  versionPrimaryTag(version) || versionDisplayName(version);

const versionSecondaryTags = (version: PackageVersionSummary) => {
  const primary = versionPrimaryTag(version);
  return version.tags.filter((tag) => tag !== primary);
};

/** Docker-style short digest shown next to tag titles. */
const versionDigestLabel = (version: PackageVersionSummary) => {
  if (version.tags.length === 0) return '';
  return versionDisplayName(version);
};

/**
 * The tagged view hides untagged versions, so always say it is a subset;
 * append the scan-cap caveat when the server stopped early.
 */
const taggedVersionsNotice = computed(() => {
  if (versionsFilter.value !== 'tagged' || loadingVersions.value || versionsError.value) return '';
  if (versions.value.length === 0) return '';

  const taggedCount = versionsPagination.value.totalCount;
  const totalCount = detail.value?.versionCount;
  const base =
    typeof taggedCount === 'number' && typeof totalCount === 'number'
      ? t('packageDetail.taggedOnlyCount', { count: taggedCount, total: totalCount })
      : t('packageDetail.taggedOnly');

  return versionsTruncated.value ? `${base} ${t('packageDetail.versionsTruncated')}` : base;
});

const handleRepoClick = async () => {
  const repoPath = parseGitHubRepoPath(detail.value?.repository?.fullName);
  if (!repoPath) return;
  await openRepository(repoPath.owner, repoPath.repo);
};

const handleOwnerClick = async () => {
  const target = packageTarget.value;
  if (!target) return;
  await router.push({
    path: localePath('/dashboard/profile'),
    query: { user: target.username, tab: 'packages' },
  });
};

const handleBack = async () => {
  await handleOwnerClick();
  if (!packageTarget.value) {
    await router.push(localePath('/dashboard'));
  }
};
</script>

<template>
  <DashboardOverlayFrame
    :loading="initialLoading"
    :loading-title="t('packageDetail.loadingTitle')"
    :loading-subtitle="t('packageDetail.loadingSubtitle')"
    :back-label="t('packageDetail.backToProfile')"
    home-label=""
    :show-home-button="false"
    @back="handleBack"
  >
    <div class="package-page">
      <div v-if="!packageTarget" class="package-page__empty">
        <p>{{ t('packageDetail.noPackage') }}</p>
      </div>

      <div v-else-if="detailError" class="package-page__status package-page__status--error">
        <AlertTriangleIcon :size="32" aria-hidden="true" />
        <p>{{ detailError }}</p>
        <button type="button" class="button is-small is-light" @click="refresh">
          {{ t('packageDetail.retry') }}
        </button>
      </div>

      <template v-else-if="detail">
        <header class="package-page__header">
          <div class="package-page__title-row">
            <component
              :is="getPackageTypeIcon(detail.packageType)"
              :size="22"
              class="package-page__type-icon"
              aria-hidden="true"
            />
            <h1 class="title is-4 mb-0 package-page__name">{{ detail.name }}</h1>
            <span class="tag is-light">{{ t(`packages.types.${detail.packageType}`) }}</span>
            <span
              v-if="visibilityLabel"
              class="tag is-light"
              :class="detail.visibility === 'public' ? 'is-success' : 'is-warning'"
            >
              {{ visibilityLabel }}
            </span>
          </div>

          <div class="package-page__meta">
            <button
              v-if="detail.ownerLogin"
              type="button"
              class="package-page__meta-link"
              @click="handleOwnerClick"
            >
              {{ detail.ownerLogin }}
            </button>

            <button
              v-if="detail.repository"
              type="button"
              class="package-page__meta-link"
              :title="t('packageDetail.repository')"
              @click="handleRepoClick"
            >
              <GitHubIcon :size="14" />
              <span>{{ detail.repository.fullName }}</span>
            </button>

            <span v-if="typeof detail.versionCount === 'number'" class="package-page__meta-entry">
              <TagIcon :size="14" aria-hidden="true" />
              {{ t('packages.versionCount', { count: detail.versionCount }, detail.versionCount) }}
            </span>

            <span v-if="createdLabel" class="package-page__meta-entry">
              <CalendarIcon :size="14" aria-hidden="true" />
              {{ createdLabel }}
            </span>

            <span v-if="updatedLabel" class="package-page__meta-entry">
              <HistoryIcon :size="14" aria-hidden="true" />
              {{ updatedLabel }}
            </span>

            <a
              v-if="detail.htmlUrl"
              :href="detail.htmlUrl"
              target="_blank"
              rel="noopener noreferrer"
              class="package-page__meta-link"
            >
              <GitHubIcon :size="14" />
              <span>{{ t('packageDetail.viewOnGitHub') }}</span>
            </a>
          </div>

          <p v-if="detail.repository?.description" class="package-page__description">
            {{ detail.repository.description }}
          </p>
        </header>

        <section v-if="installCommand" class="package-page__install">
          <h2 class="title is-6 mb-2 package-page__section-title">
            <TerminalIcon :size="15" aria-hidden="true" />
            {{ t('packageDetail.install') }}
          </h2>
          <pre class="package-page__install-command"><code>{{ installCommand }}</code></pre>
        </section>

        <section class="package-page__versions">
          <div class="package-page__versions-header">
            <h2 class="title is-6 mb-0 package-page__section-title">
              <TagIcon :size="15" aria-hidden="true" />
              {{ t('packageDetail.versions') }}
            </h2>

            <div
              v-if="showVersionsFilter"
              class="package-page__version-filters"
              role="tablist"
              :aria-label="t('packageDetail.versionsFilterLabel')"
            >
              <button
                v-for="option in versionsFilterOptions"
                :key="option.value"
                type="button"
                role="tab"
                class="package-page__version-filter"
                :class="{ 'is-active': versionsFilter === option.value }"
                :aria-selected="versionsFilter === option.value"
                :tabindex="versionsFilter === option.value ? 0 : -1"
                :disabled="loadingVersions"
                @click="setVersionsFilter(option.value)"
              >
                <component :is="option.icon" :size="13" aria-hidden="true" />
                <span>{{ option.label }}</span>
              </button>
            </div>
          </div>

          <p v-if="taggedVersionsNotice" class="package-page__versions-notice">
            {{ taggedVersionsNotice }}
          </p>

          <div v-if="loadingVersions" class="package-page__status">
            <Loader2Icon :size="22" class="spin-animation" aria-hidden="true" />
          </div>

          <div v-else-if="versionsError" class="package-page__status package-page__status--error">
            <p>{{ versionsError }}</p>
            <button type="button" class="button is-small is-light" @click="retryVersions">
              {{ t('packageDetail.retry') }}
            </button>
          </div>

          <div v-else-if="versions.length === 0" class="package-page__status">
            <p>
              {{
                versionsFilter === 'tagged'
                  ? t('packageDetail.emptyTaggedVersions')
                  : t('packageDetail.emptyVersions')
              }}
            </p>
          </div>

          <ul v-else class="package-page__version-list">
            <li v-for="version in versions" :key="version.id" class="package-page__version card">
              <div class="package-page__version-main">
                <a
                  v-if="version.htmlUrl"
                  :href="version.htmlUrl"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="package-page__version-name package-page__version-name--link"
                  :title="version.name"
                >
                  {{ versionPrimaryLabel(version) }}
                </a>
                <span v-else class="package-page__version-name" :title="version.name">
                  {{ versionPrimaryLabel(version) }}
                </span>
                <span
                  v-for="tag in versionSecondaryTags(version)"
                  :key="tag"
                  class="tag is-light"
                  :class="tag === 'latest' ? 'is-success' : 'is-info'"
                >
                  {{ tag }}
                </span>
                <span
                  v-if="versionDigestLabel(version)"
                  class="package-page__version-digest"
                  :title="version.name"
                >
                  {{ versionDigestLabel(version) }}
                </span>
              </div>
              <span
                v-if="versionPublishedLabel(version)"
                class="package-page__version-time"
                :title="versionPublishedTitle(version)"
              >
                <CalendarIcon :size="13" aria-hidden="true" />
                {{ versionPublishedLabel(version) }}
              </span>
            </li>
          </ul>

          <DashboardPagination
            v-if="versionsShowPagination"
            class="package-page__pagination"
            :pagination="versionsPagination"
            @change="goToVersionsPage"
          />
        </section>
      </template>
    </div>
  </DashboardOverlayFrame>
</template>

<style scoped lang="scss">
.package-page {
  display: flex;
  flex-direction: column;
  width: 100%;
  max-width: 56rem;
  margin: 0 auto;
  gap: 1.5rem;
}

.package-page__header {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.package-page__title-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.6rem;
  min-width: 0;
}

.package-page__type-icon {
  flex-shrink: 0;
  color: var(--gitpulse-accent);
}

.package-page__name {
  overflow-wrap: anywhere;
}

.package-page__meta {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.4rem 1rem;
  color: var(--gitpulse-text-muted);
  font-size: 0.85rem;
}

.package-page__meta-entry {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
}

.package-page__meta-link {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--gitpulse-text-muted);
  font-size: 0.85rem;
  cursor: pointer;
  transition: color 0.12s ease;

  &:hover {
    color: var(--gitpulse-accent);
  }

  &:focus-visible {
    outline: 2px solid var(--gitpulse-focus-ring);
    outline-offset: 2px;
  }
}

.package-page__description {
  color: var(--gitpulse-text-muted);
  font-size: 0.9rem;
}

.package-page__section-title {
  display: flex;
  align-items: center;
  gap: 0.45rem;
}

.package-page__install-command {
  padding: 0.75rem 1rem;
  border: 1px solid var(--gitpulse-border);
  border-radius: var(--gitpulse-radius-lg, 10px);
  background: var(--gitpulse-surface-active);
  overflow-x: auto;
  font-size: 0.85rem;
}

.package-page__versions-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 0.5rem 1rem;
  margin-bottom: 0.75rem;
}

.package-page__version-filters {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.25rem;
}

.package-page__version-filter {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  border: 1px solid var(--gitpulse-border);
  border-radius: 999px;
  background: transparent;
  color: var(--gitpulse-text-muted);
  padding: 0.25rem 0.65rem;
  font-size: 0.75rem;
  cursor: pointer;

  &:hover:not([disabled]) {
    background: var(--gitpulse-surface-hover);
    color: var(--gitpulse-text-strong);
  }

  &[disabled] {
    opacity: 0.6;
    cursor: default;
  }

  &.is-active {
    border-color: var(--gitpulse-accent);
    color: var(--gitpulse-accent);
    background: color-mix(in srgb, var(--gitpulse-accent) 10%, transparent);
    font-weight: 600;
  }
}

.package-page__version-list {
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
}

.package-page__version {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem 1rem;
  padding: 0.7rem 1rem;
  border: 1px solid var(--gitpulse-border);
}

.package-page__version-main {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.45rem;
  min-width: 0;
}

.package-page__version-name {
  color: var(--gitpulse-text-strong);
  font-family: var(--gitpulse-code-font-family, monospace);
  font-size: 0.85rem;
  font-weight: 600;
  overflow-wrap: anywhere;
}

.package-page__version-digest {
  color: var(--gitpulse-text-muted);
  font-family: var(--gitpulse-code-font-family, monospace);
  font-size: 0.75rem;
}

.package-page__version-name--link {
  text-decoration: none;
  transition: color 0.12s ease;

  &:hover {
    color: var(--gitpulse-accent);
  }

  &:focus-visible {
    outline: 2px solid var(--gitpulse-focus-ring);
    outline-offset: 2px;
  }
}

.package-page__version-time {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  color: var(--gitpulse-text-muted);
  font-size: 0.8rem;
  white-space: nowrap;
}

/* Sits between the section header and the list as a caption. */
.package-page__versions-notice {
  margin: -0.25rem 0 0.75rem;
  color: var(--gitpulse-text-muted);
  font-size: 0.78rem;
}

.package-page__pagination {
  margin-top: 0.75rem;
}

.package-page__empty,
.package-page__status {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.75rem;
  min-height: 10rem;
  padding: 2rem;
  color: var(--gitpulse-text-muted);
  font-size: 0.9rem;
  text-align: center;
}

.package-page__status--error {
  color: var(--gitpulse-danger);
}

.spin-animation {
  animation: spin 1s linear infinite;
  color: var(--gitpulse-accent);
}

@keyframes spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}
</style>
