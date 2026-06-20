<template>
  <section v-if="hasFeedback" class="syntax-feedback">
    <div v-if="operatorWarningMessage" class="syntax-warning">
      {{ operatorWarningMessage }}
    </div>

    <div v-if="visibleDiagnostics.length > 0" class="syntax-diagnostics">
      <div
        v-for="diagnostic in visibleDiagnostics"
        :key="`${diagnostic.code}-${diagnostic.start}`"
        class="syntax-diagnostic"
      >
        {{ getDiagnosticMessage(diagnostic.code) }}
      </div>
    </div>

    <div v-if="ast.qualifiers.length > 0" class="syntax-section">
      <p class="syntax-section__title">{{ t('dashboard.tabsSettings.syntaxQualifiers') }}</p>
      <div class="syntax-chip-grid">
        <span
          v-for="qualifier in ast.qualifiers"
          :key="`${qualifier.start}-${qualifier.raw}`"
          class="syntax-chip"
        >
          <strong>{{ qualifier.name }}</strong>
          <span>{{ qualifier.value || t('dashboard.tabsSettings.syntaxEmptyValue') }}</span>
        </span>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed } from 'vue';

import type {
  GitHubSearchSyntaxAst,
  GitHubSearchSyntaxDiagnostic,
} from '#shared/utils/github-search-syntax';

const props = defineProps<{
  ast: GitHubSearchSyntaxAst;
  operatorWarningMessage: string;
  t: (key: string, params?: Record<string, string>) => string;
}>();

const visibleDiagnostics = computed(() => {
  if (props.operatorWarningMessage) {
    return [];
  }

  return props.ast.diagnostics.filter((diagnostic) => diagnostic.code !== 'unsupported-operator');
});

const hasFeedback = computed(() => {
  return (
    props.operatorWarningMessage.length > 0 ||
    visibleDiagnostics.value.length > 0 ||
    props.ast.qualifiers.length > 0
  );
});

const getDiagnosticMessage = (code: GitHubSearchSyntaxDiagnostic['code']) => {
  return props.t(`dashboard.tabsSettings.syntaxDiagnostic.${code}`);
};
</script>

<style scoped lang="scss">
.syntax-feedback {
  display: grid;
  gap: 0.75rem;
  min-width: 0;
  padding: 0.85rem;
  border: 1px solid var(--gitpulse-border);
  border-radius: 8px;
  background: color-mix(in srgb, var(--gitpulse-surface) 92%, var(--gitpulse-accent) 8%);
}

.syntax-diagnostics {
  display: grid;
  gap: 0.45rem;
}

.syntax-warning,
.syntax-diagnostic {
  padding: 0.55rem 0.65rem;
  border-radius: 6px;
  font-size: 0.76rem;
}

.syntax-warning {
  border: 1px solid color-mix(in srgb, var(--gitpulse-warning) 40%, transparent);
  color: var(--gitpulse-warning);
  background: color-mix(in srgb, var(--gitpulse-warning) 10%, transparent);
}

.syntax-diagnostic {
  border: 1px solid color-mix(in srgb, var(--gitpulse-danger) 35%, transparent);
  color: var(--gitpulse-danger);
  background: color-mix(in srgb, var(--gitpulse-danger) 8%, transparent);
}

.syntax-section {
  display: grid;
  gap: 0.45rem;
  min-width: 0;
}

.syntax-section__title {
  margin: 0;
  font-size: 0.72rem;
  font-weight: 750;
  color: var(--gitpulse-text-muted);
}

.syntax-chip-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
  min-width: 0;
}

.syntax-chip {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  max-width: 100%;
  padding: 0.32rem 0.5rem;
  border: 1px solid var(--gitpulse-border);
  border-radius: 6px;
  background: var(--gitpulse-surface);
  font-size: 0.74rem;
}

.syntax-chip strong {
  color: var(--gitpulse-accent);
  font-weight: 750;
}

.syntax-chip span {
  min-width: 0;
  overflow-wrap: anywhere;
  color: var(--gitpulse-text);
  font-weight: 650;
}
</style>
