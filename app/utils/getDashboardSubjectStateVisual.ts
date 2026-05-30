import {
  CircleDotIcon,
  CircleMinusIcon,
  GitMergeIcon,
  GitPullRequestClosedIcon,
  GitPullRequestIcon,
  MessagesSquareIcon,
  TagIcon,
} from 'lucide-vue-next';
import type { Component } from 'vue';

import type { NotificationSubjectState } from '#shared/types/notifications';

interface DashboardSubjectStateVisualOptions {
  isPullRequest: boolean;
  state?: NotificationSubjectState;
  subjectType?: string;
}

export interface DashboardSubjectStateVisual {
  icon?: Component;
  color?: string;
  label: string;
  state?: 'open' | 'closed' | 'merged' | 'discussion' | 'release';
}

const subjectTypeVisuals: Record<string, DashboardSubjectStateVisual> = {
  Issue: {
    icon: CircleDotIcon,
    color: '#1a7f37',
    label: 'Issue',
    state: 'open',
  },
  PullRequest: {
    icon: GitPullRequestIcon,
    color: '#8250df',
    label: 'Pull request',
    state: 'open',
  },
  Discussion: {
    icon: MessagesSquareIcon,
    color: '#0969da',
    label: 'Discussion',
    state: 'discussion',
  },
  Release: {
    icon: TagIcon,
    color: '#bf8700',
    label: 'Release',
    state: 'release',
  },
};

export const getDashboardSubjectTypeVisual = (
  subjectType?: string
): DashboardSubjectStateVisual => {
  return subjectType
    ? (subjectTypeVisuals[subjectType] ?? { label: subjectType })
    : { label: 'Subject' };
};

export default function getDashboardSubjectStateVisual({
  isPullRequest,
  state,
  subjectType,
}: DashboardSubjectStateVisualOptions): DashboardSubjectStateVisual {
  if (!state) {
    return getDashboardSubjectTypeVisual(subjectType);
  }

  if (isPullRequest) {
    if (state === 'open') {
      return {
        icon: GitPullRequestIcon,
        color: '#1a7f37',
        label: 'Open pull request',
        state: 'open',
      };
    }

    if (state === 'merged') {
      return {
        icon: GitMergeIcon,
        color: '#0969da',
        label: 'Merged pull request',
        state: 'merged',
      };
    }

    return {
      icon: GitPullRequestClosedIcon,
      color: '#000000',
      label: 'Closed pull request',
      state: 'closed',
    };
  }

  if (state === 'open') {
    return {
      icon: CircleDotIcon,
      color: '#1a7f37',
      label: 'Open issue',
      state: 'open',
    };
  }

  return {
    icon: CircleMinusIcon,
    color: '#000000',
    label: 'Closed issue',
    state: 'closed',
  };
}
