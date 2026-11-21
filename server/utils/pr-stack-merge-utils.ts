import type { Octokit } from '@octokit/core';

import { getGitHubErrorStatusCode } from '#server/utils/github-auth-utils';
import type { NormalizedMergePullRequestBody } from '#server/utils/pr-merge-status-utils';
import type { StackMergeOutcome } from '#shared/types/pulls';

type GitHubClient = Octokit;

export interface StackMergeResult {
  outcome: StackMergeOutcome;
  id?: string;
  message?: string;
}

interface AsyncMergeFields {
  status: string | null;
  uuid: string | null;
  message: string | null;
}

const readAsyncMerge = (data: unknown): AsyncMergeFields => {
  if (!data || typeof data !== 'object') {
    return { status: null, uuid: null, message: null };
  }

  const record = data as { status?: unknown; details?: unknown };
  const status = typeof record.status === 'string' ? record.status : null;
  const details =
    record.details && typeof record.details === 'object'
      ? (record.details as { uuid?: unknown; message?: unknown })
      : null;
  const uuid = typeof details?.uuid === 'string' && details.uuid ? details.uuid : null;
  const message = typeof details?.message === 'string' && details.message ? details.message : null;

  return { status, uuid, message };
};

const stackMergeResult = (
  outcome: StackMergeOutcome,
  fields: AsyncMergeFields
): StackMergeResult => ({
  outcome,
  ...(fields.uuid ? { id: fields.uuid } : {}),
  ...(fields.message ? { message: fields.message } : {}),
});

/**
 * `202` is accepted and still running. `409` is a request that is already pending.
 * `200` is already merged or already in the queue. The body status separates those,
 * and a later read can still be pending or failed.
 */
export function mapStackMergeResult(httpStatus: number, data: unknown): StackMergeResult {
  const fields = readAsyncMerge(data);

  if (httpStatus === 202 || httpStatus === 409) {
    return stackMergeResult('in-progress', fields);
  }

  if (httpStatus === 200) {
    if (fields.status === 'enqueued') return stackMergeResult('queued', fields);
    if (fields.status === 'failed') return stackMergeResult('failed', fields);
    if (fields.status === 'pending') return stackMergeResult('in-progress', fields);
    if (fields.status === 'merged') return stackMergeResult('landed', fields);
  }

  return stackMergeResult('failed', fields);
}

const githubErrorBody = (error: unknown) => {
  if (!error || typeof error !== 'object' || !('response' in error)) return null;
  const response = error.response;
  if (!response || typeof response !== 'object' || !('data' in response)) return null;
  return response.data;
};

/**
 * Forwards a Stack Merge. `merge_action` stays omitted so the repository,
 * not this request, chooses a direct merge or its queue.
 */
export async function requestPullRequestStackMerge(
  octokit: GitHubClient,
  owner: string,
  repo: string,
  pullNumber: number,
  body: NormalizedMergePullRequestBody
): Promise<StackMergeResult> {
  try {
    const response = await octokit.request(
      'PUT /repos/{owner}/{repo}/pulls/{pull_number}/merge-async',
      {
        owner,
        repo,
        pull_number: pullNumber,
        merge_method: body.method,
        ...(body.commitTitle ? { commit_title: body.commitTitle } : {}),
        ...(body.commitMessage ? { commit_message: body.commitMessage } : {}),
      }
    );

    return mapStackMergeResult(response.status, response.data);
  } catch (error: unknown) {
    const status = getGitHubErrorStatusCode(error);
    if (status === 400 || status === 409) {
      return mapStackMergeResult(status, githubErrorBody(error));
    }
    throw error;
  }
}

export async function readPullRequestStackMerge(
  octokit: GitHubClient,
  owner: string,
  repo: string,
  pullNumber: number,
  id: string
): Promise<StackMergeResult> {
  const response = await octokit.request(
    'GET /repos/{owner}/{repo}/pulls/{pull_number}/merge-async/{uuid}',
    {
      owner,
      repo,
      pull_number: pullNumber,
      uuid: id,
    }
  );

  return mapStackMergeResult(response.status, response.data);
}
