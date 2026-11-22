import { afterEach, expect, test } from 'bun:test';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { createError } from 'h3';

import {
  rebasePullRequestStackLayer,
  signStackRebaseSnapshot,
  verifyStackRebaseSnapshot,
} from '../server/utils/pr-stack-rebase-utils';

Object.assign(globalThis, { createError });

const tempDirs: string[] = [];
afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

async function git(cwd: string, ...args: string[]) {
  const result = Bun.spawnSync(['git', ...args], { cwd, stderr: 'pipe' });
  if (result.exitCode !== 0) throw new Error(result.stderr.toString());
  return result.stdout.toString().trim();
}

async function fixture() {
  const cwd = await mkdtemp(join(tmpdir(), 'gitpulse-stack-test-'));
  tempDirs.push(cwd);
  await git(cwd, 'init', '--quiet', '-b', 'main');
  await git(cwd, 'config', 'user.name', 'Stack fixture');
  await git(cwd, 'config', 'user.email', 'fixture@example.test');
  await git(cwd, 'config', 'commit.gpgsign', 'false');

  const commit = async (file: string, content: string, title: string) => {
    await writeFile(join(cwd, file), content + '\n');
    await git(cwd, 'add', '--', file);
    await git(cwd, 'commit', '--quiet', '-m', title);
    return git(cwd, 'rev-parse', 'HEAD');
  };
  return { cwd, commit };
}

test('a rebase confirmation cannot substitute a different commit boundary', () => {
  const snapshot = {
    stackNumber: 7,
    baseRef: 'lower',
    baseSha: 'old-lower-tip',
    expectedHeadOid: 'upper-tip',
  };
  const sign = (value: typeof snapshot) =>
    signStackRebaseSnapshot('secret', 'acme', 'repo', 3, value);
  const proof = sign(snapshot);
  expect(verifyStackRebaseSnapshot(sign(snapshot), proof)).toBe(true);
  expect(verifyStackRebaseSnapshot(sign({ ...snapshot, baseSha: 'different-cutoff' }), proof)).toBe(
    false
  );
});

test('rebases only the upper layer patches after the lower layer was rewritten', async () => {
  const { cwd, commit } = await fixture();
  await commit('root.txt', 'main', 'Trunk');
  await git(cwd, 'switch', '-c', 'lower');
  const oldLower = await commit('lower.txt', 'original', 'Old lower change');
  await git(cwd, 'switch', '-c', 'upper');
  const oldUpper = await commit('upper.txt', 'upper', 'Upper change');
  await git(cwd, 'switch', '-c', 'rewrite', 'main');
  const newLower = await commit('lower.txt', 'rewritten', 'New lower change');
  await git(cwd, 'branch', '-f', 'lower', newLower);

  const layer = {
    remote: cwd,
    baseRef: 'lower',
    headRef: 'upper',
    expectedHeadOid: oldUpper,
    oldBaseOid: oldLower,
  };
  expect(await rebasePullRequestStackLayer(layer)).toBe('rebased');
  expect(await git(cwd, 'rev-parse', 'upper^')).toBe(newLower);
  expect(await git(cwd, 'log', '--format=%s', 'lower..upper')).toBe('Upper change');
  expect(await git(cwd, 'show', 'upper:lower.txt')).toBe('rewritten');
  expect(await git(cwd, 'show', 'upper:upper.txt')).toBe('upper');
  await expect(rebasePullRequestStackLayer(layer)).rejects.toThrow('This stack layer has changed');
  expect(
    await rebasePullRequestStackLayer({
      ...layer,
      expectedHeadOid: await git(cwd, 'rev-parse', 'upper'),
    })
  ).toBe('current');
}, 30_000);

test('keeps the remote head intact when replaying this layer conflicts', async () => {
  const { cwd, commit } = await fixture();
  await commit('file.txt', 'original', 'Trunk');
  await git(cwd, 'switch', '-c', 'layer');
  const expectedHeadOid = await commit('file.txt', 'layer', 'Layer change');
  await git(cwd, 'switch', 'main');
  await commit('file.txt', 'trunk', 'Trunk change');

  await expect(
    rebasePullRequestStackLayer({
      remote: cwd,
      baseRef: 'main',
      headRef: 'layer',
      expectedHeadOid,
      oldBaseOid: null,
    })
  ).rejects.toThrow('could not be rebased cleanly');
  expect(await git(cwd, 'rev-parse', 'layer')).toBe(expectedHeadOid);
}, 30_000);
