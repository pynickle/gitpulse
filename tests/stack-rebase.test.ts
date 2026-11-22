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

const upperLayerOf = async () => {
  const { cwd, commit } = await fixture();
  await commit('root.txt', 'main', 'Trunk');
  await git(cwd, 'switch', '-c', 'lower');
  const oldLower = await commit('lower.txt', 'original', 'Old lower change');
  await git(cwd, 'switch', '-c', 'upper');
  const oldUpper = await commit('upper.txt', 'upper', 'Upper change');
  await git(cwd, 'switch', '-c', 'rewrite', 'main');
  const newLower = await commit('lower.txt', 'rewritten', 'New lower change');
  await git(cwd, 'branch', '-f', 'lower', newLower);
  return {
    cwd,
    layer: {
      remote: cwd,
      baseRef: 'lower',
      headRef: 'upper',
      expectedHeadOid: oldUpper,
      oldBaseOid: oldLower,
    },
    newLower,
  };
};

test('rebases only the upper layer patches after the lower layer was rewritten', async () => {
  const { cwd, layer, newLower } = await upperLayerOf();

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

test('rebases the layer the same way when Git has no replay subcommand', async () => {
  // The per-patch path is what an older Git gets. Forcing it here is the only way
  // to execute that branch: on Windows a PATH shim cannot hide a built-in
  // subcommand, so the choice is injected instead of staged.
  const { cwd, layer, newLower } = await upperLayerOf();

  expect(await rebasePullRequestStackLayer({ ...layer, replay: 'per-patch' })).toBe('rebased');
  expect(await git(cwd, 'rev-parse', 'upper^')).toBe(newLower);
  expect(await git(cwd, 'log', '--format=%s', 'lower..upper')).toBe('Upper change');
  expect(await git(cwd, 'show', 'upper:lower.txt')).toBe('rewritten');
  expect(await git(cwd, 'show', 'upper:upper.txt')).toBe('upper');
}, 30_000);

test('both replay paths produce the same history for the same layer', async () => {
  const commonTip = async (replay: 'git' | 'per-patch') => {
    const { cwd, layer } = await upperLayerOf();
    expect(await rebasePullRequestStackLayer({ ...layer, replay })).toBe('rebased');
    return {
      subjects: await git(cwd, 'log', '--reverse', '--format=%s', 'lower..upper'),
      tree: await git(cwd, 'rev-parse', 'upper^{tree}'),
      // Each fixture is its own repository, so the parent commits differ by hash.
      // What must match is that the layer sits directly on its new base.
      baseRefs: await git(cwd, 'log', '--format=%D', 'lower..upper'),
      depth: await git(cwd, 'rev-list', '--count', 'lower..upper'),
    };
  };

  const fastPath = await commonTip('git');
  const perPatch = await commonTip('per-patch');
  expect(perPatch).toEqual(fastPath);
}, 30_000);

test('the per-patch fallback keeps the remote head intact when replaying conflicts', async () => {
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
      replay: 'per-patch',
    })
  ).rejects.toThrow('could not be rebased cleanly');
  expect(await git(cwd, 'rev-parse', 'layer')).toBe(expectedHeadOid);
}, 30_000);

test('replays every patch in order and preserves each commit message and author', async () => {
  const { cwd, commit } = await fixture();
  await commit('root.txt', 'main', 'Trunk');
  await git(cwd, 'switch', '-c', 'lower');
  const oldLower = await commit('lower.txt', 'original', 'Old lower change');
  await git(cwd, 'switch', '-c', 'upper');
  await commit('one.txt', 'one', 'Add one');
  await writeFile(join(cwd, 'two.txt'), 'two\n');
  await git(cwd, 'add', '--', 'two.txt');
  await git(
    cwd,
    '-c',
    'user.name=Grace Hopper',
    '-c',
    'user.email=grace@example.test',
    'commit',
    '--quiet',
    '-m',
    'Add two\n\nExplain the second patch.'
  );
  const secondUpper = await git(cwd, 'rev-parse', 'HEAD');
  await git(cwd, 'switch', '-c', 'rewrite', 'main');
  const newLower = await commit('lower.txt', 'rewritten', 'New lower change');
  await git(cwd, 'branch', '-f', 'lower', newLower);

  expect(
    await rebasePullRequestStackLayer({
      remote: cwd,
      baseRef: 'lower',
      headRef: 'upper',
      expectedHeadOid: secondUpper,
      oldBaseOid: oldLower,
    })
  ).toBe('rebased');

  expect(await git(cwd, 'log', '--reverse', '--format=%s', 'lower..upper')).toBe(
    ['Add one', 'Add two'].join('\n')
  );
  expect(await git(cwd, 'log', '--format=%b', '-1', 'upper')).toContain(
    'Explain the second patch.'
  );
  expect(await git(cwd, 'log', '--format=%an <%ae>', '-1', 'upper')).toBe(
    'Grace Hopper <grace@example.test>'
  );
  expect(await git(cwd, 'rev-parse', 'upper^^')).toBe(newLower);
}, 30_000);

test('drops a patch that the new base already contains, like a rebase does', async () => {
  const { cwd, commit } = await fixture();
  await commit('root.txt', 'main', 'Trunk');
  await git(cwd, 'switch', '-c', 'layer');
  await commit('kept.txt', 'kept', 'Keep me');
  await git(cwd, 'switch', 'main');
  const trunkAddsSame = await commit('same.txt', 'identical', 'Trunk adds the same file');
  await git(cwd, 'switch', 'layer');
  const becomesEmpty = await commit('same.txt', 'identical', 'Adds the same file');
  const keptUpper = await commit('tail.txt', 'tail', 'Keep this too');
  await git(cwd, 'switch', '--quiet', 'main');

  expect(
    await rebasePullRequestStackLayer({
      remote: cwd,
      baseRef: 'main',
      headRef: 'layer',
      expectedHeadOid: keptUpper,
      oldBaseOid: null,
    })
  ).toBe('rebased');

  expect(await git(cwd, 'log', '--reverse', '--format=%s', 'main..layer')).toBe(
    ['Keep me', 'Keep this too'].join('\n')
  );
  expect(await git(cwd, 'rev-parse', 'layer^^')).toBe(trunkAddsSame);
  expect(becomesEmpty).not.toBe(await git(cwd, 'rev-parse', 'layer'));
}, 30_000);

test('keeps a commit that was already empty before the replay', async () => {
  // `git rebase` keeps a commit that was born empty and only drops one that becomes
  // empty, so both replay paths must tell the two apart.
  for (const replay of ['git', 'per-patch'] as const) {
    const { cwd, commit } = await fixture();
    await commit('root.txt', 'main', 'Trunk');
    await git(cwd, 'switch', '-c', 'layer');
    await commit('one.txt', 'one', 'First patch');
    await git(cwd, 'commit', '--allow-empty', '--quiet', '-m', 'Born empty patch');
    const head = await commit('three.txt', 'three', 'Real patch');
    await git(cwd, 'switch', 'main');
    const newBase = await commit('root.txt', 'moved', 'Trunk moves');
    await git(cwd, 'switch', '--quiet', 'main');

    expect(
      await rebasePullRequestStackLayer({
        remote: cwd,
        baseRef: 'main',
        headRef: 'layer',
        expectedHeadOid: head,
        oldBaseOid: null,
        replay,
      })
    ).toBe('rebased');

    expect(await git(cwd, 'log', '--reverse', '--format=%s', 'main..layer')).toBe(
      ['First patch', 'Born empty patch', 'Real patch'].join('\n')
    );
    expect(await git(cwd, 'rev-parse', 'layer~~~')).toBe(newBase);
  }
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

test('refuses a layer that contains a merge commit', async () => {
  const { cwd, commit } = await fixture();
  await commit('root.txt', 'main', 'Trunk');
  await git(cwd, 'switch', '-c', 'layer');
  await commit('left.txt', 'left', 'Left work');
  await git(cwd, 'switch', '-c', 'side', 'main');
  await commit('side.txt', 'side', 'Side work');
  await git(cwd, 'switch', 'layer');
  await git(cwd, 'merge', '--no-ff', '--quiet', '-m', 'Merge side', 'side');
  const expectedHeadOid = await git(cwd, 'rev-parse', 'HEAD');
  await git(cwd, 'switch', 'main');
  await commit('root.txt', 'moved', 'Trunk moves');
  await git(cwd, 'switch', '--quiet', 'main');

  await expect(
    rebasePullRequestStackLayer({
      remote: cwd,
      baseRef: 'main',
      headRef: 'layer',
      expectedHeadOid,
      oldBaseOid: null,
    })
  ).rejects.toThrow('contains a merge commit');
  expect(await git(cwd, 'rev-parse', 'layer')).toBe(expectedHeadOid);
}, 30_000);

test('rebases a layer whose every patch is already on the new base', async () => {
  const { cwd, commit } = await fixture();
  await commit('root.txt', 'main', 'Trunk');
  await git(cwd, 'switch', '-c', 'layer');
  const expectedHeadOid = await commit('same.txt', 'same', 'Layer adds the file');
  await git(cwd, 'switch', 'main');
  const newBase = await commit('same.txt', 'same', 'Trunk adds the file too');
  await git(cwd, 'switch', '--quiet', 'main');

  expect(
    await rebasePullRequestStackLayer({
      remote: cwd,
      baseRef: 'main',
      headRef: 'layer',
      expectedHeadOid,
      oldBaseOid: null,
    })
  ).toBe('rebased');
  // The Layer carries nothing the new base does not already have, so it lands on
  // the base itself, which is what `git rebase` leaves behind.
  expect(await git(cwd, 'rev-parse', 'layer')).toBe(newBase);
}, 30_000);
test('answers that Git is required when the server has none', async () => {
  // `execFile` reports a missing binary as ENOENT, which must surface as the
  // documented 503 instead of looking like a rejected layer.
  const { cwd, layer } = await upperLayerOf();
  const savedPath = process.env.PATH;
  process.env.PATH = join(tmpdir(), 'gitpulse-no-git-on-this-host');
  try {
    await expect(rebasePullRequestStackLayer(layer)).rejects.toThrow('requires Git on the server');
  } finally {
    process.env.PATH = savedPath;
  }
  expect(await git(cwd, 'rev-parse', 'upper')).toBe(layer.expectedHeadOid);
}, 30_000);
