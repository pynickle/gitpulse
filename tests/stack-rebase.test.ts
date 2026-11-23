import { afterEach, expect, test } from 'bun:test';
import { mkdtemp, rm, stat, utimes, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { createError } from 'h3';

import type { GitReplayMode } from '../server/utils/git-availability';
import {
  cleanupStaleStackRebaseTempDirs,
  rebasePullRequestStack,
  type StackRebaseLayerInput,
} from '../server/utils/pr-stack-rebase-utils';

Object.assign(globalThis, { createError });

const tempDirs: string[] = [];
let lockSeq = 0;
const nextLockKey = () => `acme/repo#${++lockSeq}`;

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
  // Allow atomic pushes into the non-bare fixture repository when HEAD is detached or on main.
  await git(cwd, 'config', 'receive.denyCurrentBranch', 'ignore');

  const commit = async (file: string, content: string, title: string) => {
    await writeFile(join(cwd, file), content + '\n');
    await git(cwd, 'add', '--', file);
    await git(cwd, 'commit', '--quiet', '-m', title);
    return git(cwd, 'rev-parse', 'HEAD');
  };
  return { cwd, commit };
}

test('cascades a multi-layer stack bottom-up in one atomic rebase after trunk moves', async () => {
  const { cwd, commit } = await fixture();
  await commit('root.txt', 'v1', 'Initial trunk');

  await git(cwd, 'switch', '-c', 'layer-1');
  const l1Old = await commit('l1.txt', 'layer-1', 'L1 commit');

  await git(cwd, 'switch', '-c', 'layer-2');
  const l2Old = await commit('l2.txt', 'layer-2', 'L2 commit');

  await git(cwd, 'switch', '-c', 'layer-3');
  const l3Old = await commit('l3.txt', 'layer-3', 'L3 commit');

  await git(cwd, 'switch', 'main');
  const trunkNew = await commit('trunk-extra.txt', 'moved', 'Trunk advance');

  const layers: StackRebaseLayerInput[] = [
    {
      number: 1,
      state: 'open',
      baseRef: 'main',
      headRef: 'layer-1',
      expectedHeadOid: l1Old,
    },
    {
      number: 2,
      state: 'draft',
      baseRef: 'layer-1',
      headRef: 'layer-2',
      expectedHeadOid: l2Old,
    },
    {
      number: 3,
      state: 'open',
      baseRef: 'layer-2',
      headRef: 'layer-3',
      expectedHeadOid: l3Old,
    },
  ];

  const result = await rebasePullRequestStack({
    remote: cwd,
    trunk: 'main',
    layers,
    replayMode: 'replay-print',
    stackLockKey: nextLockKey(),
  });

  expect(result).toEqual({
    ok: true,
    results: [
      { number: 1, outcome: 'rebased' },
      { number: 2, outcome: 'rebased' },
      { number: 3, outcome: 'rebased' },
    ],
  });

  const l1New = await git(cwd, 'rev-parse', 'layer-1');
  const l2New = await git(cwd, 'rev-parse', 'layer-2');
  const l3New = await git(cwd, 'rev-parse', 'layer-3');

  expect(await git(cwd, 'rev-parse', 'layer-1^')).toBe(trunkNew);
  expect(await git(cwd, 'rev-parse', 'layer-2^')).toBe(l1New);
  expect(await git(cwd, 'rev-parse', 'layer-3^')).toBe(l2New);
  expect(await git(cwd, 'show', 'layer-3:trunk-extra.txt')).toBe('moved');
  expect(await git(cwd, 'show', 'layer-3:l1.txt')).toBe('layer-1');
  expect(await git(cwd, 'show', 'layer-3:l2.txt')).toBe('layer-2');
  expect(await git(cwd, 'show', 'layer-3:l3.txt')).toBe('layer-3');

  // Re-running with the updated heads reports every layer as current.
  const secondRun = await rebasePullRequestStack({
    remote: cwd,
    trunk: 'main',
    layers: [
      { ...layers[0]!, expectedHeadOid: l1New },
      { ...layers[1]!, expectedHeadOid: l2New },
      { ...layers[2]!, expectedHeadOid: l3New },
    ],
    replayMode: 'replay-print',
    stackLockKey: nextLockKey(),
  });
  expect(secondRun).toEqual({
    ok: true,
    results: [
      { number: 1, outcome: 'current' },
      { number: 2, outcome: 'current' },
      { number: 3, outcome: 'current' },
    ],
  });
}, 30_000);

for (const replayMode of ['replay-print', 'per-patch'] as const) {
  test(`B1 regression (${replayMode}): computes upper layer forkPoint against initial lower base tip when lower layer gained a new commit A2`, async () => {
    const { cwd, commit } = await fixture();
    await commit('root.txt', 'root', 'Trunk M1');

    // L1 starts with A1
    await git(cwd, 'switch', '-c', 'layer-1');
    await commit('a1.txt', 'a1', 'Commit A1');

    // L2 branches from A1 and adds B1
    await git(cwd, 'switch', '-c', 'layer-2');
    const l2Initial = await commit('b1.txt', 'b1', 'Commit B1');

    // L1 then gets a new commit A2 before the stack rebase
    await git(cwd, 'switch', 'layer-1');
    const l1WithA2 = await commit('a2.txt', 'a2', 'Commit A2');

    // Trunk also advances to M2 so both L1 and L2 are rebased in one cascade
    await git(cwd, 'switch', 'main');
    const m2 = await commit('m2.txt', 'm2', 'Trunk M2');

    const result = await rebasePullRequestStack({
      remote: cwd,
      trunk: 'main',
      layers: [
        {
          number: 1,
          state: 'open',
          baseRef: 'main',
          headRef: 'layer-1',
          expectedHeadOid: l1WithA2,
        },
        {
          number: 2,
          state: 'open',
          baseRef: 'layer-1',
          headRef: 'layer-2',
          expectedHeadOid: l2Initial,
        },
      ],
      replayMode,
      stackLockKey: nextLockKey(),
    });

    expect(result).toEqual({
      ok: true,
      results: [
        { number: 1, outcome: 'rebased' },
        { number: 2, outcome: 'rebased' },
      ],
    });

    const l1Rebased = await git(cwd, 'rev-parse', 'layer-1');
    expect(await git(cwd, 'log', '--reverse', '--format=%s', 'main..layer-1')).toBe(
      ['Commit A1', 'Commit A2'].join('\n')
    );
    expect(await git(cwd, 'log', '--reverse', '--format=%s', 'layer-1..layer-2')).toBe('Commit B1');
    expect(await git(cwd, 'rev-parse', 'layer-2^')).toBe(l1Rebased);
    expect(await git(cwd, 'rev-parse', 'layer-1^^')).toBe(m2);
    expect(await git(cwd, 'show', 'layer-2:a2.txt')).toBe('a2');
    expect(await git(cwd, 'show', 'layer-2:b1.txt')).toBe('b1');
  }, 30_000);

  test(`B2 regression (${replayMode}): cascades cleanly when L1 and L2 edit the same file sequentially`, async () => {
    const { cwd, commit } = await fixture();
    await commit('shared.txt', 'line1\nline2\nline3', 'Initial shared file');

    await git(cwd, 'switch', '-c', 'layer-1');
    const l1Head = await commit('shared.txt', 'line1\nline2-from-L1\nline3', 'L1 edits line 2');

    await git(cwd, 'switch', '-c', 'layer-2');
    const l2Head = await commit(
      'shared.txt',
      'line1\nline2-from-L1\nline3-from-L2',
      'L2 edits line 3 on top of L1'
    );

    await git(cwd, 'switch', 'main');
    await commit('other.txt', 'trunk', 'Trunk moves');

    const result = await rebasePullRequestStack({
      remote: cwd,
      trunk: 'main',
      layers: [
        {
          number: 1,
          state: 'open',
          baseRef: 'main',
          headRef: 'layer-1',
          expectedHeadOid: l1Head,
        },
        {
          number: 2,
          state: 'open',
          baseRef: 'layer-1',
          headRef: 'layer-2',
          expectedHeadOid: l2Head,
        },
      ],
      replayMode,
      stackLockKey: nextLockKey(),
    });

    expect(result).toEqual({
      ok: true,
      results: [
        { number: 1, outcome: 'rebased' },
        { number: 2, outcome: 'rebased' },
      ],
    });
    expect(await git(cwd, 'show', 'layer-1:shared.txt')).toBe('line1\nline2-from-L1\nline3');
    expect(await git(cwd, 'show', 'layer-2:shared.txt')).toBe(
      'line1\nline2-from-L1\nline3-from-L2'
    );
  }, 30_000);

  test(`all-or-nothing atomicity (${replayMode}): when L2 conflicts, L1 remote branch is NOT pushed and L3 is skipped`, async () => {
    const { cwd, commit } = await fixture();
    await commit('conflict.txt', 'base', 'Initial');

    await git(cwd, 'switch', '-c', 'layer-1');
    await commit('l1.txt', 'l1-initial', 'L1 initial');

    await git(cwd, 'switch', '-c', 'layer-2');
    const l2Head = await commit('conflict.txt', 'from-l2', 'L2 edits conflict.txt');

    await git(cwd, 'switch', '-c', 'layer-3');
    const l3Head = await commit('l3.txt', 'l3', 'L3 commit');

    // L1 now also edits conflict.txt in a conflicting way
    await git(cwd, 'switch', 'layer-1');
    const l1Head = await commit('conflict.txt', 'from-l1', 'L1 conflicting edit');

    // Trunk advances so L1 would otherwise be rebased and pushed
    await git(cwd, 'switch', 'main');
    await commit('trunk.txt', 'moved', 'Trunk moves');

    const result = await rebasePullRequestStack({
      remote: cwd,
      trunk: 'main',
      layers: [
        {
          number: 1,
          state: 'open',
          baseRef: 'main',
          headRef: 'layer-1',
          expectedHeadOid: l1Head,
        },
        {
          number: 2,
          state: 'open',
          baseRef: 'layer-1',
          headRef: 'layer-2',
          expectedHeadOid: l2Head,
        },
        {
          number: 3,
          state: 'open',
          baseRef: 'layer-2',
          headRef: 'layer-3',
          expectedHeadOid: l3Head,
        },
      ],
      replayMode,
      stackLockKey: nextLockKey(),
    });

    expect(result).toEqual({
      ok: false,
      error: 'The stack layer could not be rebased cleanly',
      results: [
        { number: 1, outcome: 'rebased' },
        {
          number: 2,
          outcome: 'failed',
          message: 'The stack layer could not be rebased cleanly',
        },
        { number: 3, outcome: 'skipped' },
      ],
    });

    // Zero remote branches moved because L1 was only rewritten in the scratch bare repo.
    expect(await git(cwd, 'rev-parse', 'layer-1')).toBe(l1Head);
    expect(await git(cwd, 'rev-parse', 'layer-2')).toBe(l2Head);
    expect(await git(cwd, 'rev-parse', 'layer-3')).toBe(l3Head);
  }, 30_000);
}

test('all-or-nothing atomicity: when L2 contains a merge commit, L1 remote branch stays untouched', async () => {
  const { cwd, commit } = await fixture();
  await commit('root.txt', 'main', 'Trunk');

  await git(cwd, 'switch', '-c', 'layer-1');
  const l1Head = await commit('l1.txt', 'l1', 'L1 work');

  await git(cwd, 'switch', '-c', 'layer-2');
  await commit('left.txt', 'left', 'Left work');
  await git(cwd, 'switch', '-c', 'side', 'layer-1');
  await commit('side.txt', 'side', 'Side work');
  await git(cwd, 'switch', 'layer-2');
  await git(cwd, 'merge', '--no-ff', '--quiet', '-m', 'Merge side into layer-2', 'side');
  const l2Head = await git(cwd, 'rev-parse', 'HEAD');

  await git(cwd, 'switch', 'main');
  await commit('root.txt', 'moved', 'Trunk moves');

  const result = await rebasePullRequestStack({
    remote: cwd,
    trunk: 'main',
    layers: [
      {
        number: 1,
        state: 'open',
        baseRef: 'main',
        headRef: 'layer-1',
        expectedHeadOid: l1Head,
      },
      {
        number: 2,
        state: 'open',
        baseRef: 'layer-1',
        headRef: 'layer-2',
        expectedHeadOid: l2Head,
      },
    ],
    replayMode: 'replay-print',
    stackLockKey: nextLockKey(),
  });

  expect(result).toEqual({
    ok: false,
    error: 'This stack layer contains a merge commit',
    results: [
      { number: 1, outcome: 'rebased' },
      { number: 2, outcome: 'failed', message: 'This stack layer contains a merge commit' },
    ],
  });
  expect(await git(cwd, 'rev-parse', 'layer-1')).toBe(l1Head);
  expect(await git(cwd, 'rev-parse', 'layer-2')).toBe(l2Head);
}, 30_000);

const parityTrees: string[] = [];

for (const replayMode of [
  'replay-print',
  'replay-legacy',
  'per-patch',
] as const satisfies readonly GitReplayMode[]) {
  test(`parity (${replayMode}): preserves authors, multiline messages, born-empty commits, drops becomes-empty commits, and collapses all-empty layers`, async () => {
    const { cwd, commit } = await fixture();
    await commit('root.txt', 'main', 'Trunk');

    await git(cwd, 'switch', '-c', 'layer-1');
    await commit('kept.txt', 'kept', 'First patch');
    await git(cwd, 'commit', '--allow-empty', '--quiet', '-m', 'Born empty patch');
    await commit('duplicate.txt', 'identical', 'Patch that trunk also lands');
    await writeFile(join(cwd, 'author.txt'), 'grace\n');
    await git(cwd, 'add', '--', 'author.txt');
    await git(
      cwd,
      '-c',
      'user.name=Grace Hopper',
      '-c',
      'user.email=grace@example.test',
      'commit',
      '--quiet',
      '-m',
      'Titled patch\n\nMultiline body paragraph 1.\n\nParagraph 2.'
    );
    const l1Head = await git(cwd, 'rev-parse', 'HEAD');

    // Layer 2 has only a patch that becomes empty on top of trunk
    await git(cwd, 'switch', '-c', 'layer-2', 'main');
    const l2Head = await commit('duplicate.txt', 'identical', 'All-empty duplicate patch');

    await git(cwd, 'switch', 'main');
    const trunkTip = await commit('duplicate.txt', 'identical', 'Trunk lands duplicate.txt');

    const result = await rebasePullRequestStack({
      remote: cwd,
      trunk: 'main',
      layers: [
        {
          number: 1,
          state: 'open',
          baseRef: 'main',
          headRef: 'layer-1',
          expectedHeadOid: l1Head,
        },
        {
          number: 2,
          state: 'open',
          baseRef: 'main',
          headRef: 'layer-2',
          expectedHeadOid: l2Head,
        },
      ],
      replayMode,
      stackLockKey: nextLockKey(),
    });

    expect(result.ok).toBe(true);
    // Layer 2's single commit becomes empty on the new trunk, so it collapses onto trunkTip.
    expect(await git(cwd, 'rev-parse', 'layer-2')).toBe(trunkTip);
    expect(await git(cwd, 'log', '--reverse', '--format=%s', 'main..layer-1')).toBe(
      ['First patch', 'Born empty patch', 'Titled patch'].join('\n')
    );
    expect(await git(cwd, 'log', '--format=%b', '-1', 'layer-1')).toContain(
      'Multiline body paragraph 1.\n\nParagraph 2.'
    );
    expect(await git(cwd, 'log', '--format=%an <%ae>', '-1', 'layer-1')).toBe(
      'Grace Hopper <grace@example.test>'
    );
    expect(await git(cwd, 'rev-list', '--count', 'main..layer-1')).toBe('3');
    expect(await git(cwd, 'show', 'layer-1:kept.txt')).toBe('kept');
    expect(await git(cwd, 'show', 'layer-1:duplicate.txt')).toBe('identical');
    expect(await git(cwd, 'show', 'layer-1:author.txt')).toBe('grace');

    const tree = await git(cwd, 'rev-parse', 'layer-1^{tree}');
    parityTrees.push(tree);
    expect(new Set(parityTrees).size).toBe(1);
  }, 30_000);
}

test('preserves terminal merged and closed layers without touching them', async () => {
  const { cwd, commit } = await fixture();
  await commit('root.txt', 'main', 'Trunk');
  await git(cwd, 'switch', '-c', 'layer-2');
  const l2Head = await commit('l2.txt', 'l2', 'L2 work');
  await git(cwd, 'switch', 'main');
  await commit('root.txt', 'moved', 'Trunk moves');

  const result = await rebasePullRequestStack({
    remote: cwd,
    trunk: 'main',
    layers: [
      {
        number: 1,
        state: 'merged',
        baseRef: 'main',
        headRef: 'merged-branch',
        expectedHeadOid: '',
      },
      {
        number: 2,
        state: 'open',
        baseRef: 'main',
        headRef: 'layer-2',
        expectedHeadOid: l2Head,
      },
      {
        number: 3,
        state: 'closed',
        baseRef: 'layer-2',
        headRef: 'closed-branch',
        expectedHeadOid: '',
      },
    ],
    replayMode: 'replay-print',
    stackLockKey: nextLockKey(),
  });

  expect(result).toEqual({
    ok: true,
    results: [
      { number: 1, outcome: 'merged' },
      { number: 2, outcome: 'rebased' },
      { number: 3, outcome: 'closed' },
    ],
  });
}, 30_000);

test('rejects a concurrent rebase on the same stackLockKey with 409', async () => {
  const { cwd, commit } = await fixture();
  await commit('root.txt', 'main', 'Trunk');
  await git(cwd, 'switch', '-c', 'layer-1');
  const l1Head = await commit('l1.txt', 'l1', 'L1 work');
  await git(cwd, 'switch', 'main');
  await commit('root.txt', 'moved', 'Trunk moves');

  const stackLockKey = nextLockKey();
  const options = {
    remote: cwd,
    trunk: 'main',
    layers: [
      {
        number: 1,
        state: 'open' as const,
        baseRef: 'main',
        headRef: 'layer-1',
        expectedHeadOid: l1Head,
      },
    ],
    replayMode: 'replay-print' as const,
    stackLockKey,
  };

  const first = rebasePullRequestStack(options);
  await expect(rebasePullRequestStack(options)).rejects.toMatchObject({
    statusCode: 409,
    statusMessage: 'A rebase is already running for this stack',
  });
  expect((await first).ok).toBe(true);
}, 30_000);

test('rejects when expectedHeadOid does not match the remote branch before rewriting', async () => {
  const { cwd, commit } = await fixture();
  const initial = await commit('root.txt', 'main', 'Trunk');
  await git(cwd, 'switch', '-c', 'layer-1');
  const actualHead = await commit('l1.txt', 'l1', 'L1 work');

  await expect(
    rebasePullRequestStack({
      remote: cwd,
      trunk: 'main',
      layers: [
        {
          number: 1,
          state: 'open',
          baseRef: 'main',
          headRef: 'layer-1',
          expectedHeadOid: initial,
        },
      ],
      replayMode: 'replay-print',
      stackLockKey: nextLockKey(),
    })
  ).rejects.toMatchObject({
    statusCode: 409,
    statusMessage: 'The stack has changed; reload before rebasing',
  });
  expect(await git(cwd, 'rev-parse', 'layer-1')).toBe(actualHead);
}, 30_000);

test('answers 503 when Git is missing on the server', async () => {
  const { cwd, commit } = await fixture();
  await commit('root.txt', 'main', 'Trunk');
  await git(cwd, 'switch', '-c', 'layer-1');
  const l1Head = await commit('l1.txt', 'l1', 'L1 work');

  const savedPath = process.env.PATH;
  const savedPathWin = process.env.Path;
  const emptyPath = join(tmpdir(), 'gitpulse-no-git-on-this-host');
  process.env.PATH = emptyPath;
  process.env.Path = emptyPath;
  try {
    await expect(
      rebasePullRequestStack({
        remote: cwd,
        trunk: 'main',
        layers: [
          {
            number: 1,
            state: 'open',
            baseRef: 'main',
            headRef: 'layer-1',
            expectedHeadOid: l1Head,
          },
        ],
        replayMode: 'replay-print',
        stackLockKey: nextLockKey(),
      })
    ).rejects.toMatchObject({
      statusCode: 503,
      statusMessage: 'Stack rebase requires Git on the server',
    });
  } finally {
    process.env.PATH = savedPath;
    if (savedPathWin !== undefined) process.env.Path = savedPathWin;
  }
  expect(await git(cwd, 'rev-parse', 'layer-1')).toBe(l1Head);
}, 30_000);

test('cleanupStaleStackRebaseTempDirs removes only stale gitpulse-stack-* directories', async () => {
  const staleDir = await mkdtemp(join(tmpdir(), 'gitpulse-stack-stale-'));
  const freshDir = await mkdtemp(join(tmpdir(), 'gitpulse-stack-fresh-'));
  tempDirs.push(staleDir, freshDir);

  const twoHoursAgo = new Date(Date.now() - 2 * 3_600_000);
  await utimes(staleDir, twoHoursAgo, twoHoursAgo);

  await cleanupStaleStackRebaseTempDirs(3_600_000);

  await expect(stat(staleDir)).rejects.toThrow();
  expect((await stat(freshDir)).isDirectory()).toBe(true);
});
