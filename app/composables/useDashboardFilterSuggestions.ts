import { computed, type MaybeRefOrGetter, toValue } from 'vue';

import type { DashboardNotification } from '#shared/types/notifications';

import { parseGitHubRepoPath } from '../utils/parseGitHubRepoPath';
import type { DashboardRouteFilters } from './useDashboardFilters';

export interface DashboardEntity {
  id: PropertyKey;
  repository_url?: string | null;
  number?: number | null;
  pull_request?: unknown;
  [key: string]: unknown;
}

interface DashboardFilterSuggestionOptions {
  notifications: MaybeRefOrGetter<DashboardNotification[]>;
  notificationTodos: MaybeRefOrGetter<{ notification: DashboardNotification }[]>;
  issues: MaybeRefOrGetter<DashboardEntity[]>;
  pulls: MaybeRefOrGetter<DashboardEntity[]>;
  repos: MaybeRefOrGetter<Record<string, unknown>[]>;
  visibleFilters: MaybeRefOrGetter<DashboardRouteFilters>;
}

const getEntityRepoName = (entity: DashboardEntity) => {
  const repositoryUrl = typeof entity.repository_url === 'string' ? entity.repository_url : '';
  return parseGitHubRepoPath(repositoryUrl)?.fullName ?? '';
};

const getEntityAuthor = (entity: DashboardEntity) => {
  const user = entity.user;
  if (!user || typeof user !== 'object' || !('login' in user)) {
    return '';
  }

  return typeof user.login === 'string' ? user.login : '';
};

const getEntityLabels = (entity: DashboardEntity) => {
  const labels = entity.labels;
  if (!Array.isArray(labels)) {
    return [];
  }

  return labels
    .map((label) => {
      if (typeof label === 'string') return label;
      if (label && typeof label === 'object' && 'name' in label && typeof label.name === 'string') {
        return label.name;
      }
      return '';
    })
    .filter(Boolean);
};

export const isPullRequestDashboardEntity = (item: DashboardEntity) => {
  return typeof item.pull_request === 'object' && item.pull_request !== null;
};

export function useDashboardFilterSuggestions(options: DashboardFilterSuggestionOptions) {
  const repoFilterSuggestions = computed(() => {
    const suggestions = new Set<string>();

    for (const repo of toValue(options.repos)) {
      if (typeof repo.full_name === 'string') suggestions.add(repo.full_name);
    }

    for (const notification of toValue(options.notifications)) {
      if (notification.repository?.full_name) suggestions.add(notification.repository.full_name);
    }

    for (const todo of toValue(options.notificationTodos)) {
      if (todo.notification.repository?.full_name) {
        suggestions.add(todo.notification.repository.full_name);
      }
    }

    for (const item of [...toValue(options.issues), ...toValue(options.pulls)]) {
      const repoName = getEntityRepoName(item);
      if (repoName) suggestions.add(repoName);
    }

    return Array.from(suggestions).sort((left, right) => left.localeCompare(right));
  });

  const authorFilterSuggestions = computed(() => {
    const suggestions = new Set<string>();

    for (const notification of toValue(options.notifications)) {
      if (notification.subject?.authorLogin) suggestions.add(notification.subject.authorLogin);
    }

    for (const todo of toValue(options.notificationTodos)) {
      if (todo.notification.subject?.authorLogin) {
        suggestions.add(todo.notification.subject.authorLogin);
      }
    }

    for (const item of [...toValue(options.issues), ...toValue(options.pulls)]) {
      const author = getEntityAuthor(item);
      if (author) suggestions.add(author);
    }

    return Array.from(suggestions).sort((left, right) => left.localeCompare(right));
  });

  const labelFilterSuggestions = computed(() => {
    const visibleFilters = toValue(options.visibleFilters);
    if (!visibleFilters.repo) {
      return [];
    }

    const suggestions = new Set<string>();

    for (const notification of toValue(options.notifications)) {
      if (notification.repository?.full_name !== visibleFilters.repo) continue;
      for (const label of notification.subject?.labels ?? []) {
        if (label.name) suggestions.add(label.name);
      }
    }

    for (const todo of toValue(options.notificationTodos)) {
      if (todo.notification.repository?.full_name !== visibleFilters.repo) continue;
      for (const label of todo.notification.subject?.labels ?? []) {
        if (label.name) suggestions.add(label.name);
      }
    }

    for (const item of [...toValue(options.issues), ...toValue(options.pulls)]) {
      if (getEntityRepoName(item) !== visibleFilters.repo) continue;
      for (const label of getEntityLabels(item)) {
        suggestions.add(label);
      }
    }

    return Array.from(suggestions).sort((left, right) => left.localeCompare(right));
  });

  return {
    repoFilterSuggestions,
    authorFilterSuggestions,
    labelFilterSuggestions,
  };
}
