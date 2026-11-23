import * as z from 'zod';

import { assertGitAvailable, resolveGitReplayMode } from '#server/utils/git-availability';
import { getGitHubTransportContext, throwGitHubRouteError } from '#server/utils/github-auth-utils';
import {
  rebasePullRequestStack,
  type StackRebaseLayerInput,
} from '#server/utils/pr-stack-rebase-utils';
import { extractPullRouteParams } from '#server/utils/repo-route-utils';
import { parseZodRequestBody } from '#server/utils/zod-validation-utils';
import type { PullRequestStackLayerState } from '#shared/types/pulls';

const commitOid = z.string().regex(/^[0-9a-f]{40}$/);
const canonicalRepoName = /^[a-zA-Z0-9._-]+\/[a-zA-Z0-9._-]+$/;

const rebaseBody = z.strictObject({
  stackNumber: z.number().int().positive(),
  expectedHeads: z.record(z.string().regex(/^\d+$/), commitOid),
});

interface StackPullRequestItem {
  number?: number | null;
  state?: string | null;
  draft?: boolean | null;
  merged_at?: string | null;
  base?: { ref?: string | null } | null;
  head?: {
    ref?: string | null;
    sha?: string | null;
    repo?: { full_name?: string | null } | null;
  } | null;
}

interface StackResourcePayload {
  base?: { ref?: string | null } | null;
  pull_requests?: StackPullRequestItem[] | null;
}

interface RepoPermissions {
  admin?: boolean;
  maintain?: boolean;
  push?: boolean;
}

function resolveLayerState(item: StackPullRequestItem): PullRequestStackLayerState {
  if (item.merged_at) return 'merged';
  if (item.state === 'closed') return 'closed';
  if (item.draft) return 'draft';
  return 'open';
}

export default defineEventHandler(async (event) => {
  await assertGitAvailable(event);

  const { owner, repo, pullNumber } = extractPullRouteParams(event);
  const body = parseZodRequestBody(rebaseBody, await readBody(event), 'Invalid stack rebase');
  const { octokit, accessToken } = await getGitHubTransportContext(event);

  try {
    const { data: pull } = await octokit.request('GET /repos/{owner}/{repo}/pulls/{pull_number}', {
      owner,
      repo,
      pull_number: pullNumber,
    });
    const membership = pull.stack;
    if (membership?.number !== body.stackNumber || pull.state !== 'open') {
      throw createError({
        statusCode: 409,
        statusMessage: 'The stack has changed; reload before rebasing',
      });
    }

    let permissions = (pull.base?.repo as { permissions?: RepoPermissions } | null | undefined)
      ?.permissions;
    if (!permissions) {
      const { data: repoData } = await octokit.request('GET /repos/{owner}/{repo}', {
        owner,
        repo,
      });
      permissions = repoData.permissions;
    }
    const canPush = Boolean(permissions?.push || permissions?.maintain || permissions?.admin);
    if (!canPush) {
      throw createError({
        statusCode: 403,
        statusMessage: 'You do not have permission to rebase this stack',
      });
    }

    const canonicalFullName = pull.base?.repo?.full_name ?? `${owner}/${repo}`;
    if (!canonicalRepoName.test(canonicalFullName)) {
      throw createError({ statusCode: 422, statusMessage: 'Invalid repository name' });
    }

    const { data: stackData } = (await octokit.request(
      'GET /repos/{owner}/{repo}/stacks/{stack_number}',
      {
        owner,
        repo,
        stack_number: body.stackNumber,
      }
    )) as { data: StackResourcePayload };

    const trunk = (stackData.base?.ref ?? membership.base?.ref ?? '').trim();
    const pullRequests = stackData.pull_requests;
    if (!trunk || !Array.isArray(pullRequests) || !pullRequests.length) {
      throw createError({
        statusCode: 409,
        statusMessage: 'The stack has changed; reload before rebasing',
      });
    }

    const layers: StackRebaseLayerInput[] = [];
    for (const item of pullRequests) {
      const number = item.number;
      if (typeof number !== 'number' || !Number.isInteger(number) || number <= 0) {
        throw createError({
          statusCode: 409,
          statusMessage: 'The stack has changed; reload before rebasing',
        });
      }
      const state = resolveLayerState(item);
      if (state === 'open' || state === 'draft') {
        if (item.head?.repo?.full_name?.toLowerCase() !== canonicalFullName.toLowerCase()) {
          throw createError({
            statusCode: 409,
            statusMessage:
              'Stack rebase is only supported when every open layer lives in this repository',
          });
        }
        if (!item.head?.sha || body.expectedHeads[String(number)] !== item.head.sha) {
          throw createError({
            statusCode: 409,
            statusMessage: 'The stack has changed; reload before rebasing',
          });
        }
      }

      layers.push({
        number,
        state,
        headRef: item.head?.ref ?? '',
        baseRef: item.base?.ref ?? '',
        expectedHeadOid: item.head?.sha ?? '',
      });
    }

    return await rebasePullRequestStack({
      remote: `https://github.com/${canonicalFullName}.git`,
      accessToken,
      trunk,
      layers,
      replayMode: await resolveGitReplayMode(event),
      stackLockKey: `${canonicalFullName.toLowerCase()}#${body.stackNumber}`,
    });
  } catch (error: unknown) {
    throwGitHubRouteError(error, 'Failed to rebase stack');
  }
});
