<script setup lang="ts">
import { BookOpenIcon } from '@lucide/vue';
import { computed } from 'vue';

import type { UserReadmeResponse } from '#shared/types/users';
import MarkdownRenderer from '~/components/ui/MarkdownRenderer.vue';

const props = defineProps<{
  login: string;
  readme: UserReadmeResponse | null;
}>();

const { t } = useI18n();

const hasContent = computed(() => Boolean(props.readme?.content?.trim()));
</script>

<template>
  <section v-if="hasContent && readme" class="profile-readme">
    <header class="profile-readme__header">
      <BookOpenIcon :size="16" aria-hidden="true" />
      <h2 class="profile-readme__title">{{ t('profile.readme.title', { login }) }}</h2>
    </header>
    <div class="profile-readme__body content">
      <MarkdownRenderer
        :value="readme.content ?? ''"
        :repo-owner="login"
        :repo-name="login"
        :branch="readme.branch ?? undefined"
      />
    </div>
  </section>
</template>

<style scoped lang="scss">
.profile-readme {
  border: 1px solid var(--gitpulse-border);
  border-radius: var(--gitpulse-radius-lg, 10px);
  background: var(--gitpulse-surface);
  overflow: hidden;
}

.profile-readme__header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.6rem 1rem;
  border-bottom: 1px solid var(--gitpulse-border);
  background: var(--gitpulse-surface-muted);
  color: var(--gitpulse-text-muted);
}

.profile-readme__title {
  margin: 0;
  font-size: 0.82rem;
  font-weight: 600;
}

.profile-readme__body {
  padding: 1.5rem;
}
</style>
