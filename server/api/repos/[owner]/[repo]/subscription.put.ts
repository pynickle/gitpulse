interface SubscriptionRequestBody {
  subscribed?: unknown;
  ignored?: unknown;
}

export default defineEventHandler(async (event) => {
  const { owner, repo } = event.context.params as {
    owner: string;
    repo: string;
  };

  if (!owner || !repo) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Missing required parameters',
    });
  }

  const body = await readBody(event);
  if (body !== undefined && body !== null && (typeof body !== 'object' || Array.isArray(body))) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Invalid subscription request body',
    });
  }

  const requestBody = body ? (body as SubscriptionRequestBody) : {};
  const subscribed = requestBody.subscribed ?? true;
  const ignored = requestBody.ignored ?? false;

  if (typeof subscribed !== 'boolean' || typeof ignored !== 'boolean') {
    throw createError({
      statusCode: 400,
      statusMessage: 'Invalid subscription request body',
    });
  }

  const octokit = await getGitHubClient(event);

  const { data } = await octokit.request('PUT /repos/{owner}/{repo}/subscription', {
    owner,
    repo,
    subscribed,
    ignored,
  });

  return {
    subscribed: data.subscribed,
    ignored: data.ignored,
  };
});
