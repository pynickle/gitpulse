import { describe, expect, mock, test } from 'bun:test';

import type { Octokit } from '@octokit/core';

mock.module('#server/utils/github-auth-utils', () => import('../server/utils/github-auth-utils'));

const { mapStackMergeResult, readPullRequestStackMerge, requestPullRequestStackMerge } =
  await import('../server/utils/pr-stack-merge-utils');

const githubError = (status: number, data: unknown) =>
  Object.assign(new Error(`HTTP ${status}`), { status, response: { data } });

const octokitAnswering = (answer: () => unknown) =>
  ({
    request: async () => answer(),
  }) as unknown as Octokit;

const octokitFailing = (status: number, data: unknown) =>
  octokitAnswering(() => {
    throw githubError(status, data);
  });

const body = { method: 'squash' as const };

describe('mapStackMergeResult', () => {
  test('202 is in progress and keeps the request id', () => {
    expect(mapStackMergeResult(202, { status: 'pending', details: { uuid: 'u1' } })).toEqual({
      outcome: 'in-progress',
      id: 'u1',
    });
  });

  test('409 with a request id is a request already running', () => {
    expect(mapStackMergeResult(409, { details: { uuid: 'u2' } })).toEqual({
      outcome: 'in-progress',
      id: 'u2',
    });
  });

  test('409 with a pending status and no id is still running', () => {
    expect(mapStackMergeResult(409, { status: 'pending' })).toEqual({ outcome: 'in-progress' });
  });

  test('409 without an id fails and keeps the top-level message', () => {
    expect(mapStackMergeResult(409, { message: 'Head branch was modified' })).toEqual({
      outcome: 'failed',
      message: 'Head branch was modified',
    });
  });

  test('400 fails and keeps the top-level message', () => {
    expect(mapStackMergeResult(400, { message: 'Merge method not allowed' })).toEqual({
      outcome: 'failed',
      message: 'Merge method not allowed',
    });
  });

  test('a details message wins over the top-level one', () => {
    expect(mapStackMergeResult(400, { message: 'outer', details: { message: 'inner' } })).toEqual({
      outcome: 'failed',
      message: 'inner',
    });
  });

  test('200 maps each body status', () => {
    expect(mapStackMergeResult(200, { status: 'merged' })).toEqual({ outcome: 'landed' });
    expect(mapStackMergeResult(200, { status: 'enqueued' })).toEqual({ outcome: 'queued' });
    expect(mapStackMergeResult(200, { status: 'pending', details: { uuid: 'u3' } })).toEqual({
      outcome: 'in-progress',
      id: 'u3',
    });
    expect(mapStackMergeResult(200, { status: 'failed', details: { message: 'nope' } })).toEqual({
      outcome: 'failed',
      message: 'nope',
    });
  });

  test('an unreadable body fails', () => {
    expect(mapStackMergeResult(200, null)).toEqual({ outcome: 'failed' });
    expect(mapStackMergeResult(500, 'oops')).toEqual({ outcome: 'failed' });
  });
});

describe('requestPullRequestStackMerge', () => {
  test('maps a 202 answer', async () => {
    const octokit = octokitAnswering(() => ({
      status: 202,
      data: { status: 'pending', details: { uuid: 'u1' } },
    }));

    expect(await requestPullRequestStackMerge(octokit, 'octo', 'app', 4, body)).toEqual({
      outcome: 'in-progress',
      id: 'u1',
    });
  });

  test('forwards the merge method and omits an empty commit message', async () => {
    let params: Record<string, unknown> | undefined;
    const octokit = {
      request: async (_route: string, requestParams: Record<string, unknown>) => {
        params = requestParams;
        return { status: 200, data: { status: 'merged' } };
      },
    } as unknown as Octokit;

    await requestPullRequestStackMerge(octokit, 'octo', 'app', 4, {
      method: 'squash',
      commitTitle: 'Title',
    });

    expect(params).toMatchObject({ owner: 'octo', repo: 'app', pull_number: 4 });
    expect(params).toMatchObject({ merge_method: 'squash', commit_title: 'Title' });
    expect(params).not.toHaveProperty('commit_message');
  });

  test('a 409 rejection with an id is in progress', async () => {
    const octokit = octokitFailing(409, { details: { uuid: 'u2' } });

    expect(await requestPullRequestStackMerge(octokit, 'octo', 'app', 4, body)).toEqual({
      outcome: 'in-progress',
      id: 'u2',
    });
  });

  test('a 409 rejection without an id fails with the message', async () => {
    const octokit = octokitFailing(409, { message: 'Pull request is not mergeable' });

    expect(await requestPullRequestStackMerge(octokit, 'octo', 'app', 4, body)).toEqual({
      outcome: 'failed',
      message: 'Pull request is not mergeable',
    });
  });

  test('a 400 rejection fails with the message', async () => {
    const octokit = octokitFailing(400, { message: 'Merge method not allowed' });

    expect(await requestPullRequestStackMerge(octokit, 'octo', 'app', 4, body)).toEqual({
      outcome: 'failed',
      message: 'Merge method not allowed',
    });
  });

  test('any other rejection is rethrown', async () => {
    const octokit = octokitFailing(500, { message: 'boom' });

    await expect(requestPullRequestStackMerge(octokit, 'octo', 'app', 4, body)).rejects.toThrow(
      'HTTP 500'
    );
  });
});

describe('readPullRequestStackMerge', () => {
  test('maps each 200 body status', async () => {
    const read = (data: unknown) =>
      readPullRequestStackMerge(
        octokitAnswering(() => ({ status: 200, data })),
        'octo',
        'app',
        4,
        'u1'
      );

    expect(await read({ status: 'merged' })).toEqual({ outcome: 'landed' });
    expect(await read({ status: 'enqueued' })).toEqual({ outcome: 'queued' });
    expect(await read({ status: 'pending', details: { uuid: 'u1' } })).toEqual({
      outcome: 'in-progress',
      id: 'u1',
    });
    expect(await read({ status: 'failed', details: { message: 'conflict' } })).toEqual({
      outcome: 'failed',
      message: 'conflict',
    });
  });

  test('a 400 rejection fails with the message instead of throwing', async () => {
    const octokit = octokitFailing(400, { message: 'Unknown request' });

    expect(await readPullRequestStackMerge(octokit, 'octo', 'app', 4, 'u1')).toEqual({
      outcome: 'failed',
      message: 'Unknown request',
    });
  });

  test('a 409 rejection with an id stays in progress', async () => {
    const octokit = octokitFailing(409, { details: { uuid: 'u1' } });

    expect(await readPullRequestStackMerge(octokit, 'octo', 'app', 4, 'u1')).toEqual({
      outcome: 'in-progress',
      id: 'u1',
    });
  });

  test('a 409 rejection without an id fails with the message', async () => {
    const octokit = octokitFailing(409, { message: 'Already finished' });

    expect(await readPullRequestStackMerge(octokit, 'octo', 'app', 4, 'u1')).toEqual({
      outcome: 'failed',
      message: 'Already finished',
    });
  });

  test('any other rejection is rethrown', async () => {
    const octokit = octokitFailing(502, null);

    await expect(readPullRequestStackMerge(octokit, 'octo', 'app', 4, 'u1')).rejects.toThrow(
      'HTTP 502'
    );
  });
});
