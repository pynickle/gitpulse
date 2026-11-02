import type { PullRequestDetailResponse, PullRequestDetailViewModel } from '#shared/types/pulls';

interface CreatePullRequestDetailViewModelOptions {
  owner?: string;
  repo?: string;
  fallback?: PullRequestDetailViewModel;
}

const createRepositoryApiUrl = (owner?: string, repo?: string) => {
  return owner && repo ? `https://api.github.com/repos/${owner}/${repo}` : undefined;
};

export function createPullRequestDetailViewModel(
  pullRequest: PullRequestDetailResponse,
  options: CreatePullRequestDetailViewModelOptions = {}
): PullRequestDetailViewModel {
  return {
    ...options.fallback,
    ...pullRequest,
    repository_url:
      pullRequest.repository_url ??
      options.fallback?.repository_url ??
      createRepositoryApiUrl(options.owner, options.repo),
  };
}
