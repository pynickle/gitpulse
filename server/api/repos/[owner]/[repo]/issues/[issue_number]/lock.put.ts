const validLockReasons = ['off-topic', 'too heated', 'resolved', 'spam'] as const;

type LockReason = (typeof validLockReasons)[number];

interface LockRequestBody {
  lock_reason?: unknown;
}

function normalizeLockReason(body: unknown): LockReason | undefined {
  if (body !== undefined && body !== null && (typeof body !== 'object' || Array.isArray(body))) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Invalid lock request body',
    });
  }

  const requestBody = body ? (body as LockRequestBody) : {};

  if (requestBody.lock_reason === undefined) {
    return undefined;
  }

  if (
    typeof requestBody.lock_reason !== 'string' ||
    !validLockReasons.includes(requestBody.lock_reason as LockReason)
  ) {
    throw createError({
      statusCode: 400,
      statusMessage: `Invalid lock reason. Must be one of: ${validLockReasons.join(', ')}`,
    });
  }

  return requestBody.lock_reason as LockReason;
}

export default defineEventHandler(async (event) => {
  const { owner, repo, issue_number } = event.context.params as {
    owner: string;
    repo: string;
    issue_number: string;
  };
  const issueNumber = parsePaginationNumber(issue_number, 0);

  if (!owner || !repo || issueNumber < 1) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Missing required parameters',
    });
  }

  const lockReason = normalizeLockReason(await readBody(event));

  const octokit = await getGitHubClient(event);

  const { data } = await octokit.request('PUT /repos/{owner}/{repo}/issues/{issue_number}/lock', {
    owner,
    repo,
    issue_number: issueNumber,
    lock_reason: lockReason,
    headers: {
      'X-GitHub-Api-Version': '2022-11-28',
    },
  });

  return data;
});
