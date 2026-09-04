import type {
  GitHubReaction,
  GraphQLReactionGroup,
  ReactionContent,
  ReactionSummaryItem,
  ReactionTargetKind,
} from '#shared/types/reactions';

export const ISSUE_COMMENT_REACTION_CONTENTS: ReactionContent[] = [
  '+1',
  '-1',
  'laugh',
  'confused',
  'heart',
  'hooray',
  'rocket',
  'eyes',
];

export const ISSUE_REACTION_CONTENTS = ISSUE_COMMENT_REACTION_CONTENTS;

export const PULL_REVIEW_COMMENT_REACTION_CONTENTS = ISSUE_COMMENT_REACTION_CONTENTS;

export const RELEASE_REACTION_CONTENTS: ReactionContent[] = [
  '+1',
  'laugh',
  'heart',
  'hooray',
  'rocket',
  'eyes',
];

export const REACTION_EMOJI_MAP: Record<ReactionContent, string> = {
  '+1': '👍',
  '-1': '👎',
  laugh: '😄',
  confused: '😕',
  heart: '❤️',
  hooray: '🎉',
  rocket: '🚀',
  eyes: '👀',
};

export const REACTION_LABEL_MAP: Record<ReactionContent, string> = {
  '+1': 'Thumbs up',
  '-1': 'Thumbs down',
  laugh: 'Laugh',
  confused: 'Confused',
  heart: 'Heart',
  hooray: 'Hooray',
  rocket: 'Rocket',
  eyes: 'Eyes',
};

const REACTION_CONTENTS_BY_TARGET: Record<ReactionTargetKind, ReactionContent[]> = {
  issue: ISSUE_REACTION_CONTENTS,
  'issue-comment': ISSUE_COMMENT_REACTION_CONTENTS,
  'pull-review-comment': PULL_REVIEW_COMMENT_REACTION_CONTENTS,
  release: RELEASE_REACTION_CONTENTS,
};

const API_PATH_BY_TARGET: Record<ReactionTargetKind, string> = {
  issue: 'issues',
  'issue-comment': 'comments',
  'pull-review-comment': 'pull-review-comments',
  release: 'releases',
};

function normalizeLogin(login: string | undefined | null) {
  return login?.trim().toLowerCase() ?? '';
}

export function getReactionContentsForTarget(target: ReactionTargetKind): ReactionContent[] {
  return REACTION_CONTENTS_BY_TARGET[target];
}

export function getReactionApiPathForTarget(target: ReactionTargetKind): string {
  return API_PATH_BY_TARGET[target];
}

export function isAllowedReactionContent(
  content: string,
  target: ReactionTargetKind
): content is ReactionContent {
  return getReactionContentsForTarget(target).includes(content as ReactionContent);
}

export function normalizeReactionContent(
  content: unknown,
  target: ReactionTargetKind
): ReactionContent | null {
  if (typeof content !== 'string') {
    return null;
  }

  const trimmed = content.trim();
  return isAllowedReactionContent(trimmed, target) ? trimmed : null;
}

const GRAPHQL_REACTION_CONTENT_MAP: Record<string, ReactionContent> = {
  THUMBS_UP: '+1',
  THUMBS_DOWN: '-1',
  LAUGH: 'laugh',
  HOORAY: 'hooray',
  CONFUSED: 'confused',
  HEART: 'heart',
  ROCKET: 'rocket',
  EYES: 'eyes',
};

export function normalizeGraphQLReactionGroups(
  groups: Array<GraphQLReactionGroup | null | undefined> | null | undefined,
  target: ReactionTargetKind
): ReactionSummaryItem[] {
  if (!Array.isArray(groups)) {
    return [];
  }

  const allowedContents = getReactionContentsForTarget(target);
  const allowedContentSet = new Set(allowedContents);
  const counts = new Map<ReactionContent, { count: number; viewerHasReacted: boolean }>();

  for (const group of groups) {
    if (!group) {
      continue;
    }

    const content =
      typeof group.content === 'string' ? GRAPHQL_REACTION_CONTENT_MAP[group.content] : undefined;
    if (!content || !allowedContentSet.has(content)) {
      continue;
    }

    const count = group.reactors?.totalCount;
    if (typeof count !== 'number' || !Number.isSafeInteger(count) || count < 1) {
      continue;
    }

    counts.set(content, {
      count,
      viewerHasReacted: Boolean(group.viewerHasReacted),
    });
  }

  return allowedContents.flatMap((content) => {
    const item = counts.get(content);
    if (!item) {
      return [];
    }

    return [
      {
        content,
        count: item.count,
        viewerHasReacted: item.viewerHasReacted,
        viewerReactionId: null,
      },
    ];
  });
}

export function normalizeReactionSummary(
  reactions: GitHubReaction[],
  viewerLogin: string,
  target: ReactionTargetKind
): ReactionSummaryItem[] {
  const allowedContents = getReactionContentsForTarget(target);
  const allowedContentSet = new Set(allowedContents);
  const normalizedViewerLogin = normalizeLogin(viewerLogin);
  const counts = new Map<ReactionContent, number>();
  const viewerReactionIds = new Map<ReactionContent, number>();

  for (const reaction of reactions) {
    if (!allowedContentSet.has(reaction.content)) {
      continue;
    }

    counts.set(reaction.content, (counts.get(reaction.content) ?? 0) + 1);

    if (normalizeLogin(reaction.user?.login) === normalizedViewerLogin) {
      viewerReactionIds.set(reaction.content, reaction.id);
    }
  }

  return allowedContents.flatMap((content) => {
    const count = counts.get(content) ?? 0;
    if (!count) {
      return [];
    }

    return [
      {
        content,
        count,
        viewerHasReacted: viewerReactionIds.has(content),
        viewerReactionId: viewerReactionIds.get(content) ?? null,
      },
    ];
  });
}

export function extractCommentIdFromUrl(url: string | undefined | null): string {
  if (!url) {
    return '';
  }

  const trimmed = url.trim();
  if (!trimmed) {
    return '';
  }

  const fragmentPattern =
    /(?:issuecomment|pullrequestreviewcomment|discussioncomment|commitcomment)-(\d+)/i;
  const apiCommentPathPattern = /\/(?:issues\/comments|pulls\/comments|comments)\/(\d+)$/i;

  try {
    const parsedUrl = new URL(trimmed);
    const fragmentMatch = parsedUrl.hash.match(fragmentPattern);
    if (fragmentMatch) {
      return fragmentMatch[1] ?? '';
    }

    const apiPathMatch = parsedUrl.pathname.match(apiCommentPathPattern);
    if (apiPathMatch) {
      return apiPathMatch[1] ?? '';
    }
  } catch {
    const fragmentMatch = trimmed.match(fragmentPattern);
    if (fragmentMatch) {
      return fragmentMatch[1] ?? '';
    }

    const apiPathMatch = trimmed.match(apiCommentPathPattern);
    if (apiPathMatch) {
      return apiPathMatch[1] ?? '';
    }
  }

  return '';
}
