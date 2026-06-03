import { Buffer } from 'node:buffer';

import { getGitHubClient, throwGitHubRouteError } from '#server/utils/github-auth-utils';
import { getContentPath } from '#server/utils/repo-contents-utils';
import { extractRepoParams } from '#server/utils/repo-route-utils';

type RawRepoContentResponse = {
  type?: string;
  content?: string;
  encoding?: string;
};

function getStringQueryParam(value: unknown) {
  const rawValue = Array.isArray(value) ? value[0] : value;
  return typeof rawValue === 'string' && rawValue ? rawValue : undefined;
}

function getContentType(path: string) {
  const extension = path.split('.').pop()?.toLowerCase();

  switch (extension) {
    case 'apng':
      return 'image/apng';
    case 'avif':
      return 'image/avif';
    case 'gif':
      return 'image/gif';
    case 'ico':
      return 'image/x-icon';
    case 'jpg':
    case 'jpeg':
      return 'image/jpeg';
    case 'png':
      return 'image/png';
    case 'svg':
      return 'image/svg+xml';
    case 'webp':
      return 'image/webp';
    case 'aac':
      return 'audio/aac';
    case 'flac':
      return 'audio/flac';
    case 'm4a':
      return 'audio/mp4';
    case 'mp3':
      return 'audio/mpeg';
    case 'oga':
      return 'audio/ogg';
    case 'wav':
      return 'audio/wav';
    case '3gp':
      return 'video/3gpp';
    case 'm4v':
    case 'mp4':
      return 'video/mp4';
    case 'ogv':
      return 'video/ogg';
    case 'mov':
      return 'video/quicktime';
    case 'webm':
      return 'video/webm';
    case 'vtt':
      return 'text/vtt; charset=utf-8';
    default:
      return 'application/octet-stream';
  }
}

export default defineEventHandler(async (event) => {
  const { owner, repo } = extractRepoParams(event);
  const contentPath = getContentPath(event);

  if (!contentPath) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Repository file path is required',
    });
  }

  try {
    const query = getQuery(event);
    const ref = getStringQueryParam(query.ref);
    const octokit = await getGitHubClient(event);
    const { data } = await octokit.request('GET /repos/{owner}/{repo}/contents/{path}', {
      owner,
      repo,
      path: contentPath,
      ref,
    });

    const fileContent = Array.isArray(data) ? null : (data as RawRepoContentResponse);

    if (!fileContent || fileContent.type !== 'file' || fileContent.encoding !== 'base64') {
      throw createError({
        statusCode: 404,
        statusMessage: 'Repository file path was not found',
      });
    }

    setHeader(event, 'content-type', getContentType(contentPath));
    setHeader(event, 'cache-control', 'private, max-age=300');
    setHeader(event, 'x-content-type-options', 'nosniff');

    return Buffer.from(fileContent.content || '', 'base64');
  } catch (error: unknown) {
    throwGitHubRouteError(error, 'Failed to fetch repository file');
  }
});
