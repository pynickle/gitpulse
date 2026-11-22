import * as z from 'zod';

import {
  createGitHubClient,
  getAccessToken,
  throwGitHubRouteError,
} from '#server/utils/github-auth-utils';
import {
  rebasePullRequestStackLayer,
  signStackRebaseSnapshot,
  verifyStackRebaseSnapshot,
} from '#server/utils/pr-stack-rebase-utils';
import { extractPullRouteParams } from '#server/utils/repo-route-utils';
import { parseZodRequestBody } from '#server/utils/zod-validation-utils';

const commitOid = z.string().regex(/^[0-9a-f]{40}$/);
const rebaseBody = z.strictObject({
  stackNumber: z.number().int().positive(),
  baseRef: z.string().min(1),
  baseSha: commitOid,
  expectedHeadOid: commitOid,
  proof: z.string().regex(/^[0-9a-f]{64}$/),
});

export default defineEventHandler(async (event) => {
  const { owner, repo, pullNumber } = extractPullRouteParams(event);
  const body = parseZodRequestBody(rebaseBody, await readBody(event), 'Invalid stack rebase');
  const accessToken = await getAccessToken(event);
  const expectedProof = signStackRebaseSnapshot(
    useRuntimeConfig(event).appSecret,
    owner,
    repo,
    pullNumber,
    body
  );
  if (!verifyStackRebaseSnapshot(expectedProof, body.proof)) {
    throw createError({ statusCode: 409, statusMessage: 'Reload the stack before rebasing' });
  }
  const octokit = createGitHubClient(accessToken);

  try {
    const { data: pull } = await octokit.request('GET /repos/{owner}/{repo}/pulls/{pull_number}', {
      owner,
      repo,
      pull_number: pullNumber,
    });
    const membership = pull.stack;
    if (
      membership?.number !== body.stackNumber ||
      pull.state !== 'open' ||
      pull.head.repo?.full_name.toLowerCase() !== `${owner}/${repo}`.toLowerCase() ||
      pull.base.ref !== body.baseRef ||
      pull.head.sha !== body.expectedHeadOid
    ) {
      throw createError({ statusCode: 409, statusMessage: 'This stack layer has changed' });
    }
    if (pull.mergeable === false || pull.mergeable_state === 'dirty') {
      throw createError({ statusCode: 409, statusMessage: 'This stack layer has conflicts' });
    }

    const outcome = await rebasePullRequestStackLayer({
      remote: `https://github.com/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}.git`,
      accessToken,
      headRef: pull.head.ref,
      baseRef: pull.base.ref,
      expectedHeadOid: body.expectedHeadOid,
      // A lower branch may already have been rewritten by an earlier step.
      oldBaseOid: pull.base.ref === membership.base?.ref ? null : body.baseSha,
    });
    return { outcome };
  } catch (error: unknown) {
    throwGitHubRouteError(error, 'Failed to rebase stack layer');
  }
});
