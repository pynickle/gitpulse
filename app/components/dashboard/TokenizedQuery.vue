<template>
  <div class="tokenized-query">
    <span
      v-for="(token, i) in tokens"
      :key="i"
      class="tq-token"
      :class="`tq-token--${token.kind}`"
      :title="token.title"
    >
      <span
        v-for="(seg, j) in token.segments"
        :key="j"
        class="tq-seg"
        :class="`tq-seg--${seg.role}`"
        >{{ seg.text }}</span
      >
      <span v-if="i < tokens.length - 1" class="tq-sep"> </span>
    </span>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';

type TokenKind =
  | 'keyword'
  | 'type'
  | 'state'
  | 'person'
  | 'repo'
  | 'label'
  | 'pr'
  | 'archive'
  | 'search-in'
  | 'sort'
  | 'other'
  | 'unknown';

interface TokenSegment {
  text: string;
  role: 'qualifier' | 'operator' | 'value' | 'bareword';
}

interface Token {
  kind: TokenKind;
  segments: TokenSegment[];
  title: string;
}

const KNOWN_QUALIFIERS = new Set([
  'is',
  'state',
  'repo',
  'org',
  'user',
  'author',
  'assignee',
  'mentions',
  'commenter',
  'involves',
  'milestone',
  'label',
  'in',
  'sort',
  'order',
  'draft',
  'review',
  'base',
  'head',
  'archived',
  'team',
  'language',
  'created',
  'updated',
  'comments',
  'reactions',
  'interactions',
  'merged',
  'status',
  'type',
]);

const QUALIFIER_KIND: Record<string, TokenKind> = {
  is: 'type',
  state: 'state',
  repo: 'repo',
  org: 'repo',
  user: 'person',
  author: 'person',
  assignee: 'person',
  mentions: 'person',
  commenter: 'person',
  involves: 'person',
  label: 'label',
  labels: 'label',
  in: 'search-in',
  sort: 'sort',
  order: 'sort',
  draft: 'pr',
  review: 'pr',
  base: 'pr',
  head: 'pr',
  archived: 'archive',
};

const props = defineProps<{
  parts: string[];
}>();

const tokens = computed<Token[]>(() => {
  return props.parts.map((part) => {
    const colonIndex = part.indexOf(':');
    if (colonIndex > 0) {
      const qualifier = part.slice(0, colonIndex);
      const normalizedQualifier = qualifier.toLowerCase();
      const value = part.slice(colonIndex + 1);
      const isKnown = KNOWN_QUALIFIERS.has(normalizedQualifier);
      const kind = isKnown ? (QUALIFIER_KIND[normalizedQualifier] ?? 'other') : 'unknown';

      return {
        kind,
        title: isKnown ? `Filter by ${qualifier}` : 'Custom qualifier',
        segments: [
          { text: qualifier, role: 'qualifier' as const },
          { text: ':', role: 'operator' as const },
          { text: value, role: 'value' as const },
        ],
      };
    }

    return {
      kind: 'keyword' as TokenKind,
      title: 'Search keyword',
      segments: [{ text: part, role: 'bareword' as const }],
    };
  });
});
</script>

<style scoped lang="scss">
.tokenized-query {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 0.15rem 0;
  line-height: 1.7;
}

.tq-token {
  display: inline-flex;
  align-items: baseline;
  white-space: nowrap;
}

.tq-sep {
  display: inline-block;
  width: 0.35rem;
}

.tq-seg--qualifier {
  font-weight: 700;
}

.tq-seg--operator {
  opacity: 0.55;
  font-weight: 400;
}

.tq-seg--value {
  font-weight: 600;
}

.tq-seg--bareword {
  font-weight: 500;
  opacity: 0.85;
}

// Keyword (bare words)
.tq-token--keyword .tq-seg--bareword {
  color: var(--bulma-text, #334155);
}

// Type qualifiers: is:issue, is:pr, is:public, etc
.tq-token--type .tq-seg--qualifier {
  color: var(--gitpulse-purple);
}
.tq-token--type .tq-seg--value {
  color: var(--gitpulse-purple);
}

// State: state:open, state:closed
.tq-token--state .tq-seg--qualifier {
  color: var(--gitpulse-warning);
}
.tq-token--state .tq-seg--value {
  color: var(--gitpulse-warning);
}

// Person: author:, assignee:, mentions:, involves:, commenter:
.tq-token--person .tq-seg--qualifier {
  color: var(--gitpulse-info);
}
.tq-token--person .tq-seg--value {
  color: var(--gitpulse-info);
}

// Repo: repo:, org:, user:
.tq-token--repo .tq-seg--qualifier {
  color: var(--gitpulse-link);
}
.tq-token--repo .tq-seg--value {
  color: var(--gitpulse-link);
}

// Label: label:
.tq-token--label .tq-seg--qualifier {
  color: var(--gitpulse-success);
}
.tq-token--label .tq-seg--value {
  color: var(--gitpulse-success);
}

// PR: draft:, review:, base:, head:
.tq-token--pr .tq-seg--qualifier {
  color: var(--gitpulse-danger);
}
.tq-token--pr .tq-seg--value {
  color: var(--gitpulse-danger);
}

// Archive: archived:
.tq-token--archive .tq-seg--qualifier {
  color: var(--gitpulse-text-muted);
}
.tq-token--archive .tq-seg--value {
  color: var(--gitpulse-text-muted);
}

// Search in: in:title, in:body
.tq-token--search-in .tq-seg--qualifier {
  color: var(--gitpulse-accent);
}
.tq-token--search-in .tq-seg--value {
  color: var(--gitpulse-accent);
}

// Sort: sort:, order:
.tq-token--sort .tq-seg--qualifier {
  color: var(--gitpulse-info);
}
.tq-token--sort .tq-seg--value {
  color: var(--gitpulse-info);
}

// Other known qualifiers
.tq-token--other .tq-seg--qualifier {
  color: var(--gitpulse-text-muted);
}
.tq-token--other .tq-seg--value {
  color: var(--gitpulse-text-muted);
}

// Unknown qualifiers
.tq-token--unknown .tq-seg--qualifier {
  color: var(--gitpulse-danger);
  text-decoration: underline wavy color-mix(in srgb, var(--gitpulse-danger) 35%, transparent);
}
.tq-token--unknown .tq-seg--value {
  color: var(--gitpulse-danger);
}
</style>
