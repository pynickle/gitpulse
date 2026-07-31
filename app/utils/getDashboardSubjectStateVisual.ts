import {
  CheckSquareIcon,
  CircleDotIcon,
  CircleMinusIcon,
  GitCommitIcon,
  GitPullRequestIcon,
  MailIcon,
  MessageSquareIcon,
  ShieldAlertIcon,
  TagIcon,
  WorkflowIcon,
} from '@lucide/vue';
import type { Component } from 'vue';

import type { NotificationSubjectState } from '#shared/types/notifications';

import getPullRequestStateVisual from './getPullRequestStateVisual';

interface DashboardSubjectStateVisualOptions {
  isPullRequest: boolean;
  state?: NotificationSubjectState;
  subjectType?: string;
  isAnswered?: boolean;
  /** Open draft PR — ignored when state is closed/merged. */
  draft?: boolean;
}

export interface DashboardSubjectStateVisual {
  icon?: Component;
  label: string;
  state?:
    | 'open'
    | 'closed'
    | 'merged'
    | 'draft'
    | 'discussion-answered'
    | 'discussion-unanswered'
    | 'release'
    | 'commit'
    | 'check-suite'
    | 'security-alert'
    | 'workflow-run'
    | 'invitation';
  color?: string;
}

export interface DashboardNotificationSubjectTypeOption {
  value: string;
  labelKey: string;
}

const subjectTypeVisuals: Record<string, DashboardSubjectStateVisual> = {
  Issue: {
    icon: CircleDotIcon,
    label: 'Issue',
    state: 'open',
  },
  PullRequest: {
    icon: GitPullRequestIcon,
    label: 'Pull request',
    state: 'open',
  },
  Discussion: {
    icon: MessageSquareIcon,
    label: 'Discussion',
    state: 'discussion-unanswered',
    color: 'var(--gitpulse-text-strong)',
  },
  Release: {
    icon: TagIcon,
    label: 'Release',
    state: 'release',
  },
  Commit: {
    icon: GitCommitIcon,
    label: 'Commit',
    state: 'commit',
  },
  CheckSuite: {
    icon: CheckSquareIcon,
    label: 'Check suite',
    state: 'check-suite',
  },
  RepositoryVulnerabilityAlert: {
    icon: ShieldAlertIcon,
    label: 'Security alert',
    state: 'security-alert',
  },
  WorkflowRun: {
    icon: WorkflowIcon,
    label: 'Workflow run',
    state: 'workflow-run',
  },
  RepositoryInvitation: {
    icon: MailIcon,
    label: 'Repository invitation',
    state: 'invitation',
  },
};

export const DASHBOARD_NOTIFICATION_SUBJECT_TYPES: DashboardNotificationSubjectTypeOption[] = [
  { value: 'Issue', labelKey: 'dashboard.filters.subjectTypes.issue' },
  { value: 'PullRequest', labelKey: 'dashboard.filters.subjectTypes.pullRequest' },
  { value: 'Discussion', labelKey: 'dashboard.filters.subjectTypes.discussion' },
  { value: 'Release', labelKey: 'dashboard.filters.subjectTypes.release' },
  { value: 'Commit', labelKey: 'dashboard.filters.subjectTypes.commit' },
  { value: 'CheckSuite', labelKey: 'dashboard.filters.subjectTypes.checkSuite' },
  {
    value: 'RepositoryVulnerabilityAlert',
    labelKey: 'dashboard.filters.subjectTypes.repositoryVulnerabilityAlert',
  },
  { value: 'WorkflowRun', labelKey: 'dashboard.filters.subjectTypes.workflowRun' },
  {
    value: 'RepositoryInvitation',
    labelKey: 'dashboard.filters.subjectTypes.repositoryInvitation',
  },
];

export const getDashboardSubjectTypeVisual = (
  subjectType?: string
): DashboardSubjectStateVisual => {
  return subjectType
    ? (subjectTypeVisuals[subjectType] ?? { label: subjectType })
    : { label: 'Subject' };
};

export const getDashboardDiscussionStateVisual = (
  isAnswered?: boolean
): DashboardSubjectStateVisual => ({
  icon: MessageSquareIcon,
  label:
    typeof isAnswered === 'boolean'
      ? isAnswered
        ? 'Answered discussion'
        : 'Unanswered discussion'
      : 'Discussion',
  state: isAnswered ? 'discussion-answered' : 'discussion-unanswered',
  color: isAnswered ? 'var(--gitpulse-success)' : 'var(--gitpulse-text-strong)',
});

const PULL_REQUEST_STATE_LABELS = {
  open: 'Open pull request',
  draft: 'Draft pull request',
  merged: 'Merged pull request',
  closed: 'Closed pull request',
} as const;

export default function getDashboardSubjectStateVisual({
  isPullRequest,
  state,
  subjectType,
  isAnswered,
  draft,
}: DashboardSubjectStateVisualOptions): DashboardSubjectStateVisual {
  if (subjectType === 'Discussion') {
    return getDashboardDiscussionStateVisual(isAnswered);
  }

  if (!state) {
    return getDashboardSubjectTypeVisual(subjectType);
  }

  if (isPullRequest) {
    const visual = getPullRequestStateVisual({
      state: state === 'merged' ? 'closed' : state,
      merged: state === 'merged',
      draft,
    });

    return {
      icon: visual.icon,
      label: PULL_REQUEST_STATE_LABELS[visual.state],
      state: visual.state,
      color: visual.color,
    };
  }

  if (state === 'open') {
    return {
      icon: CircleDotIcon,
      label: 'Open issue',
      state: 'open',
    };
  }

  return {
    icon: CircleMinusIcon,
    label: 'Closed issue',
    state: 'closed',
  };
}
