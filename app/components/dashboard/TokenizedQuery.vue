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
  color: #7c3aed;
}
.tq-token--type .tq-seg--value {
  color: #8b5cf6;
}

// State: state:open, state:closed
.tq-token--state .tq-seg--qualifier {
  color: #b45309;
}
.tq-token--state .tq-seg--value {
  color: #d97706;
}

// Person: author:, assignee:, mentions:, involves:, commenter:
.tq-token--person .tq-seg--qualifier {
  color: #0891b2;
}
.tq-token--person .tq-seg--value {
  color: #06b6d4;
}

// Repo: repo:, org:, user:
.tq-token--repo .tq-seg--qualifier {
  color: #2563eb;
}
.tq-token--repo .tq-seg--value {
  color: #3b82f6;
}

// Label: label:
.tq-token--label .tq-seg--qualifier {
  color: #16a34a;
}
.tq-token--label .tq-seg--value {
  color: #22c55e;
}

// PR: draft:, review:, base:, head:
.tq-token--pr .tq-seg--qualifier {
  color: #be185d;
}
.tq-token--pr .tq-seg--value {
  color: #db2777;
}

// Archive: archived:
.tq-token--archive .tq-seg--qualifier {
  color: #6b7280;
}
.tq-token--archive .tq-seg--value {
  color: #9ca3af;
}

// Search in: in:title, in:body
.tq-token--search-in .tq-seg--qualifier {
  color: #4f46e5;
}
.tq-token--search-in .tq-seg--value {
  color: #6366f1;
}

// Sort: sort:, order:
.tq-token--sort .tq-seg--qualifier {
  color: #0d9488;
}
.tq-token--sort .tq-seg--value {
  color: #14b8a6;
}

// Other known qualifiers
.tq-token--other .tq-seg--qualifier {
  color: #78716c;
}
.tq-token--other .tq-seg--value {
  color: #a8a29e;
}

// Unknown qualifiers
.tq-token--unknown .tq-seg--qualifier {
  color: #dc2626;
  text-decoration: underline wavy rgba(220, 38, 38, 0.35);
}
.tq-token--unknown .tq-seg--value {
  color: #ef4444;
}

:global(html.dark) {
  .tq-token--keyword .tq-seg--bareword {
    color: #e2e8f0;
  }

  .tq-token--type .tq-seg--qualifier {
    color: #a78bfa;
  }
  .tq-token--type .tq-seg--value {
    color: #c4b5fd;
  }

  .tq-token--state .tq-seg--qualifier {
    color: #f59e0b;
  }
  .tq-token--state .tq-seg--value {
    color: #fbbf24;
  }

  .tq-token--person .tq-seg--qualifier {
    color: #22d3ee;
  }
  .tq-token--person .tq-seg--value {
    color: #67e8f9;
  }

  .tq-token--repo .tq-seg--qualifier {
    color: #60a5fa;
  }
  .tq-token--repo .tq-seg--value {
    color: #93c5fd;
  }

  .tq-token--label .tq-seg--qualifier {
    color: #4ade80;
  }
  .tq-token--label .tq-seg--value {
    color: #86efac;
  }

  .tq-token--pr .tq-seg--qualifier {
    color: #f472b6;
  }
  .tq-token--pr .tq-seg--value {
    color: #f9a8d4;
  }

  .tq-token--archive .tq-seg--qualifier {
    color: #9ca3af;
  }
  .tq-token--archive .tq-seg--value {
    color: #d1d5db;
  }

  .tq-token--search-in .tq-seg--qualifier {
    color: #818cf8;
  }
  .tq-token--search-in .tq-seg--value {
    color: #a5b4fc;
  }

  .tq-token--sort .tq-seg--qualifier {
    color: #2dd4bf;
  }
  .tq-token--sort .tq-seg--value {
    color: #5eead4;
  }

  .tq-token--other .tq-seg--qualifier {
    color: #a8a29e;
  }
  .tq-token--other .tq-seg--value {
    color: #d6d3d1;
  }

  .tq-token--unknown .tq-seg--qualifier {
    color: #fca5a5;
  }
  .tq-token--unknown .tq-seg--value {
    color: #fecaca;
  }
}
</style>
