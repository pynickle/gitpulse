<template>
  <a
    v-if="canNavigate"
    href="#"
    @click.prevent="handleClick"
    class="tags has-addons is-inline ml-1"
  >
    <span class="tag is-activity is-danger is-light">
      <span v-if="crossRepository && refSubject?.repository?.nameWithOwner" class="mr-1">
        {{ refSubject.repository.nameWithOwner }}
      </span>
      {{ formatReferenceType(resolvedResourceType) }}
      #{{ refSubject?.number ?? '?' }}
    </span>

    <span class="tag is-activity is-link is-light">
      {{ refSubject?.title || t('timeline.referenceUnavailable') }}
    </span>
  </a>

  <span v-else class="tags has-addons is-inline ml-1">
    <span class="tag is-activity is-danger is-light">
      {{ formatReferenceType(resolvedResourceType) }} #{{ refSubject?.number ?? '?' }}
    </span>
    <span class="tag is-activity is-link is-light">
      {{ refSubject?.title || t('timeline.referenceUnavailable') }}
    </span>
  </span>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n';

interface ReferenceSubject {
  number?: number;
  title?: string;
  resourceType?: string;
  repository?: {
    name?: string;
    nameWithOwner?: string;
    owner?: {
      login?: string;
    };
  };
}

const {
  refSubject,
  crossRepository = false,
  resourceType,
} = defineProps<{
  refSubject?: ReferenceSubject | null;
  crossRepository?: boolean;
  resourceType?: string;
}>();

const emit = defineEmits<{
  (e: 'switch-issue', owner: string, repo: string, issueNumber: number): void;
  (e: 'switch-pull-request', owner: string, repo: string, pullNumber: number): void;
}>();

const { t } = useI18n();

const resolvedResourceType = computed(() => resourceType ?? refSubject?.resourceType);
const canNavigate = computed(() => {
  const repository = refSubject?.repository;
  return Boolean(repository?.owner?.login && repository?.name && refSubject?.number);
});

const handleClick = () => {
  if (!canNavigate.value) return;

  const { repository, number } = refSubject ?? {};
  const owner = repository?.owner?.login;
  const repo = repository?.name;

  if (!owner || !repo || !number) return;

  if (resolvedResourceType.value === 'pull-request') {
    switchToPullRequest(owner, repo, number);
  } else {
    switchToIssue(owner, repo, number);
  }
};

const formatReferenceType = (resourceType?: string) => {
  return resourceType === 'pull-request' ? t('timeline.pullRequestType') : t('timeline.issueType');
};

const switchToIssue = (owner: string, repo: string, issueNumber: number) => {
  emit('switch-issue', owner, repo, issueNumber);
};

const switchToPullRequest = (owner: string, repo: string, pullNumber: number) => {
  emit('switch-pull-request', owner, repo, pullNumber);
};
</script>

<style scoped lang="scss">
.tag.is-activity {
  font-size: 0.62rem;
  font-weight: bold;
}
</style>
