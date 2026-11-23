import { execFile } from 'node:child_process';
import { mkdtemp, readdir, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';

import type {
  PullRequestStackLayerState,
  StackRebaseLayerResult,
  StackRebaseResult,
} from '#shared/types/pulls';

import type { GitReplayMode } from './git-availability';

const exec = promisify(execFile);
const commitOid = /^[0-9a-f]{40}$/;

const TEMP_DIR_PREFIX = 'gitpulse-stack-';
const MAX_CONCURRENT_GIT_REBASES = 3;
const REV_PARSE_BATCH = 200;

/** Stacks with a rebase in flight, so two clicks cannot race the same branches. */
const activeStacks = new Set<string>();
let activeRebases = 0;

export interface StackRebaseLayerInput {
  number: number;
  state: PullRequestStackLayerState;
  headRef: string;
  baseRef: string;
  /** The head the reader saw; every open Layer must still be here before anything moves. */
  expectedHeadOid: string;
}

export interface StackPullRequestRebaseOptions {
  remote: string;
  accessToken?: string;
  trunk: string;
  /** From the Layer closest to the Trunk to the top. */
  layers: StackRebaseLayerInput[];
  replayMode: GitReplayMode;
  stackLockKey: string;
}

interface StackLayerCommit {
  oid: string;
  parent: string;
  /** This commit's tree, which says whether the commit was already empty. */
  tree: string;
  authorName: string;
  authorEmail: string;
  authorDate: string;
  message: string;
}

interface GitOptions {
  network?: boolean;
  env?: Record<string, string>;
}

type LayerGit = (args: string[], options?: GitOptions) => Promise<string>;

interface LayerReplayContext {
  git: LayerGit;
  forkPoint: string;
  baseTip: string;
  layerRef: string;
}

class GitExecError extends Error {
  constructor(
    readonly command: string,
    readonly code: number | string | undefined,
    readonly killed: boolean,
    readonly signal: string | null,
    readonly stdout: string,
    readonly stderr: string
  ) {
    super(`git ${command} failed`);
  }
}

/** Raised when a Layer's patches do not apply to the new base. */
class StackLayerConflict extends Error {}

/** Matches the fields requested from `git log` below, one commit at a time. */
const COMMIT_FIELDS = 7;
const COMMIT_FORMAT = '--format=%H%x00%P%x00%T%x00%an%x00%ae%x00%aI%x00%B';
const COMMITTER = [
  '-c',
  'user.name=GitPulse',
  '-c',
  'user.email=gitpulse@users.noreply.github.com',
];

const CONFLICT_MESSAGE = 'The stack layer could not be rebased cleanly';
const STACK_CHANGED_MESSAGE = 'The stack has changed; reload before rebasing';
const ACTIVE_STATES = new Set<PullRequestStackLayerState>(['open', 'draft']);

const branchRef = (branch: string) => `refs/gitpulse/branches/${branch}`;
const isActive = (layer: StackRebaseLayerInput) => ACTIVE_STATES.has(layer.state);

function sanitizeGitOutput(text: string) {
  return text
    .replaceAll(/authorization:[^\r\n]*/gi, 'Authorization: [redacted]')
    .replaceAll(/x-access-token:[^@\s]*/gi, 'x-access-token:[redacted]');
}

function warnGitFailure(error: GitExecError) {
  console.warn(
    `Stack rebase: git ${sanitizeGitOutput(error.command)} failed (exit ${String(error.code)}):`,
    sanitizeGitOutput(error.stderr).trim()
  );
}

/** Removes rebase workspaces a crashed or killed process left behind. */
export async function cleanupStaleStackRebaseTempDirs(maxAgeMs = 3_600_000) {
  const root = tmpdir();
  let entries: string[];
  try {
    entries = await readdir(root);
  } catch {
    return;
  }
  const cutoff = Date.now() - maxAgeMs;
  await Promise.all(
    entries
      .filter((name) => name.startsWith(TEMP_DIR_PREFIX))
      .map(async (name) => {
        const path = join(root, name);
        try {
          const info = await stat(path);
          if (info.isDirectory() && info.mtimeMs < cutoff) {
            await rm(path, { recursive: true, force: true });
          }
        } catch {
          // Another process may have removed it first.
        }
      })
  );
}

/**
 * Reads the commits this Layer adds, oldest first, with the author each one keeps
 * across the rewrite. `%P` gives the parent to diff against, which is the very
 * parent `git rebase` would replay from.
 */
function parseLayerCommits(stdout: string, fallbackParent: string): StackLayerCommit[] {
  const fields = stdout.split('\0');
  // `-z` terminates each record, which leaves one empty element behind; a message
  // may itself end the output, so only that single terminator is dropped.
  if (fields.length % COMMIT_FIELDS === 1 && fields.at(-1) === '') fields.pop();
  const commits: StackLayerCommit[] = [];

  for (let index = 0; index + COMMIT_FIELDS <= fields.length; index += COMMIT_FIELDS) {
    const oid = (fields[index] ?? '').trim();
    const parents = (fields[index + 1] ?? '').trim();
    if (!commitOid.test(oid)) continue;
    commits.push({
      oid,
      parent: parents.split(' ')[0] || fallbackParent,
      tree: (fields[index + 2] ?? '').trim(),
      authorName: fields[index + 3] ?? '',
      authorEmail: fields[index + 4] ?? '',
      authorDate: fields[index + 5] ?? '',
      message: fields[index + 6] ?? '',
    });
  }

  return commits;
}

async function isAncestor(git: LayerGit, ancestor: string, descendant: string) {
  try {
    await git(['merge-base', '--is-ancestor', ancestor, descendant]);
    return true;
  } catch (error: unknown) {
    if (error instanceof GitExecError && error.code === 1) return false;
    throw error;
  }
}

/**
 * Replays the whole Layer in one `git replay` call, which writes straight to the object
 * database. Returns null when the caller must fall back to the per-patch path; a
 * conflicting replay is a real answer about the Layer and raises instead.
 */
async function replayLayerOntoBase(
  ctx: LayerReplayContext,
  mode: GitReplayMode
): Promise<string | null> {
  let stdout: string;
  try {
    stdout = await ctx.git([
      ...COMMITTER,
      'replay',
      `--onto=${ctx.baseTip}`,
      ...(mode === 'replay-print' ? ['--ref-action=print'] : []),
      `${ctx.forkPoint}..${ctx.layerRef}`,
    ]);
  } catch (error: unknown) {
    if (!(error instanceof GitExecError)) throw error;
    if (error.code === 1) throw new StackLayerConflict();
    return null;
  }
  return /^update\s+\S+\s+([0-9a-f]{40})\b/m.exec(stdout)?.[1] ?? null;
}

/**
 * Replays the Layer one patch at a time for a Git whose `git replay` cannot answer.
 * Each patch is a three-way merge written straight to the object database.
 */
async function replayLayerPatchByPatch(
  ctx: LayerReplayContext,
  messageFile: string
): Promise<string> {
  const { git, forkPoint, baseTip, layerRef } = ctx;
  const commits = parseLayerCommits(
    await git([
      'log',
      '--reverse',
      '--topo-order',
      '-z',
      '--no-color',
      COMMIT_FORMAT,
      `${forkPoint}..${layerRef}`,
    ]),
    forkPoint
  );

  let parent = baseTip;
  let parentTree = (await git(['rev-parse', `${baseTip}^{tree}`])).trim();
  // Batched so a long Layer stays under the Windows command-line limit.
  const parentTrees: string[] = [];
  for (let start = 0; start < commits.length; start += REV_PARSE_BATCH) {
    const batch = commits.slice(start, start + REV_PARSE_BATCH);
    const stdout = await git(['rev-parse', ...batch.map((commit) => `${commit.parent}^{tree}`)]);
    parentTrees.push(
      ...stdout
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean)
    );
  }

  for (const [index, commit] of commits.entries()) {
    let tree: string;
    try {
      tree = (
        await git([
          'merge-tree',
          '--write-tree',
          '--no-messages',
          `--merge-base=${commit.parent}`,
          parent,
          commit.oid,
        ])
      )
        .split('\n')[0]!
        .trim();
    } catch (error: unknown) {
      if (error instanceof GitExecError && error.code === 1) throw new StackLayerConflict();
      throw error;
    }
    if (!commitOid.test(tree)) {
      throw createError({ statusCode: 500, statusMessage: 'Could not rebase the stack' });
    }
    // A patch the new base already contains replays to the same tree, and `git rebase`
    // drops exactly that. A commit that was already empty keeps its place.
    const wasBornEmpty = commit.tree === parentTrees[index];
    if (tree === parentTree && !wasBornEmpty) continue;
    await writeFile(messageFile, commit.message);
    parent = (
      await git([...COMMITTER, 'commit-tree', tree, '-p', parent, '-F', messageFile], {
        env: {
          GIT_AUTHOR_NAME: commit.authorName,
          GIT_AUTHOR_EMAIL: commit.authorEmail,
          GIT_AUTHOR_DATE: commit.authorDate,
        },
      })
    ).trim();
    parentTree = tree;
  }

  return parent;
}

function classifyPushError(error: GitExecError) {
  const output = `${error.stdout}\n${error.stderr}`.toLowerCase();
  if (/stale info|cannot lock ref|failed to lock/.test(output)) {
    return { statusCode: 409, statusMessage: STACK_CHANGED_MESSAGE };
  }
  if (/protected branch|required status|signature|signed commits|gh006/.test(output)) {
    return { statusCode: 422, statusMessage: 'Branch rules rejected the rebased stack' };
  }
  if (/permission|403|not authorized/.test(output)) {
    return { statusCode: 403, statusMessage: 'You do not have permission to rebase this stack' };
  }
  return { statusCode: 502, statusMessage: 'GitHub rejected the rebased stack' };
}

function assertValidLayers(trunk: string, active: StackRebaseLayerInput[]) {
  const invalid = (value: unknown) => typeof value !== 'string' || !value.trim();
  if (
    invalid(trunk) ||
    active.some(
      (layer) =>
        invalid(layer.headRef) ||
        invalid(layer.baseRef) ||
        typeof layer.expectedHeadOid !== 'string' ||
        !commitOid.test(layer.expectedHeadOid)
    )
  ) {
    throw createError({ statusCode: 422, statusMessage: 'Invalid stack layer' });
  }
  const heads = new Set<string>();
  for (const layer of active) {
    if (heads.has(layer.headRef)) {
      throw createError({ statusCode: 409, statusMessage: 'Two stack layers share a branch' });
    }
    heads.add(layer.headRef);
  }
}

/**
 * Rebases every open Layer of a Stack onto the Layer below it, bottom-up, and pushes the
 * rewritten branches in one atomic push. Nothing is pushed unless every Layer replays.
 */
export async function rebasePullRequestStack(
  options: StackPullRequestRebaseOptions
): Promise<StackRebaseResult> {
  const { stackLockKey } = options;
  if (activeStacks.has(stackLockKey)) {
    throw createError({
      statusCode: 409,
      statusMessage: 'A rebase is already running for this stack',
    });
  }
  if (activeRebases >= MAX_CONCURRENT_GIT_REBASES) {
    throw createError({
      statusCode: 503,
      statusMessage: 'Server is busy rebasing other stacks; try again shortly',
    });
  }
  activeStacks.add(stackLockKey);
  activeRebases += 1;
  try {
    return await runStackRebase(options);
  } finally {
    activeStacks.delete(stackLockKey);
    activeRebases -= 1;
  }
}

async function runStackRebase({
  remote,
  accessToken,
  trunk,
  layers,
  replayMode,
}: StackPullRequestRebaseOptions): Promise<StackRebaseResult> {
  const results: StackRebaseLayerResult[] = [];
  const active = layers.filter(isActive);
  assertValidLayers(trunk, active);
  if (!active.length) {
    for (const layer of layers)
      results.push({ number: layer.number, outcome: layer.state as never });
    return { ok: true, results };
  }

  const cwd = await mkdtemp(join(tmpdir(), TEMP_DIR_PREFIX));
  const globalConfig = join(cwd, 'gitpulse-global-config');
  const messageFile = join(cwd, 'gitpulse-message');
  const env: Record<string, string> = {
    ...Object.fromEntries(
      Object.entries(process.env).filter(
        (entry): entry is [string, string] => !/^git_/i.test(entry[0]) && entry[1] !== undefined
      )
    ),
    GIT_CONFIG_NOSYSTEM: '1',
    GIT_CONFIG_GLOBAL: globalConfig,
    GIT_TERMINAL_PROMPT: '0',
  };
  const transportEnv: Record<string, string> = accessToken
    ? {
        ...env,
        GIT_ALLOW_PROTOCOL: 'https',
        GIT_CONFIG_COUNT: '2',
        GIT_CONFIG_KEY_0: 'http.https://github.com/.extraheader',
        GIT_CONFIG_VALUE_0: `Authorization: Basic ${Buffer.from(`x-access-token:${accessToken}`).toString('base64')}`,
        GIT_CONFIG_KEY_1: 'protocol.ext.allow',
        GIT_CONFIG_VALUE_1: 'never',
      }
    : env;

  const git: LayerGit = async (args, { network = false, env: extraEnv = {} } = {}) => {
    try {
      const { stdout } = await exec('git', args, {
        cwd,
        env: { ...(network ? transportEnv : env), ...extraEnv },
        maxBuffer: 16 * 1024 * 1024,
        timeout: 90_000,
        windowsHide: true,
      });
      return stdout;
    } catch (error: unknown) {
      const failure = (error ?? {}) as {
        code?: number | string;
        killed?: boolean;
        signal?: string | null;
        stdout?: string;
        stderr?: string;
      };
      const execError = new GitExecError(
        args.filter((arg) => !arg.startsWith('user.')).join(' '),
        failure.code,
        Boolean(failure.killed),
        failure.signal ?? null,
        String(failure.stdout ?? ''),
        String(failure.stderr ?? '')
      );
      if (failure.code === 'ENOENT') {
        throw createError({
          statusCode: 503,
          statusMessage: 'Stack rebase requires Git on the server',
        });
      }
      if (failure.killed || failure.signal === 'SIGTERM') {
        warnGitFailure(execError);
        throw createError({ statusCode: 504, statusMessage: 'Git rebase timed out on the server' });
      }
      throw execError;
    }
  };

  try {
    await writeFile(globalConfig, '');
    // A bare repository keeps the objects without checking a work tree out.
    await git(['init', '--quiet', '--bare', '--template=']);

    const branches = [
      ...new Set([trunk, ...active.flatMap((layer) => [layer.baseRef, layer.headRef])]),
    ];
    for (const branch of branches) {
      try {
        await git(['check-ref-format', `refs/heads/${branch}`]);
      } catch (error: unknown) {
        if (error instanceof GitExecError) {
          throw createError({ statusCode: 422, statusMessage: 'Invalid stack branch name' });
        }
        throw error;
      }
    }

    try {
      await git(
        [
          'fetch',
          '--quiet',
          '--no-tags',
          '--no-recurse-submodules',
          '--',
          remote,
          ...branches.map((branch) => `refs/heads/${branch}:${branchRef(branch)}`),
        ],
        { network: true }
      );
    } catch (error: unknown) {
      if (error instanceof GitExecError) {
        warnGitFailure(error);
        throw createError({
          statusCode: 502,
          statusMessage: 'Could not fetch the stack from GitHub',
        });
      }
      throw error;
    }

    const tips = (await git(['rev-parse', ...branches.map(branchRef)]))
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean);
    const initialTipByBranch = new Map(
      branches.map((branch, index) => [branch, tips[index] ?? ''])
    );
    // Nothing moves unless every open Layer is still where the reader saw it.
    if (active.some((layer) => initialTipByBranch.get(layer.headRef) !== layer.expectedHeadOid)) {
      throw createError({ statusCode: 409, statusMessage: STACK_CHANGED_MESSAGE });
    }
    const currentTipByBranch = new Map(initialTipByBranch);

    const pendingPushes: Array<{ headRef: string; expectedHeadOid: string; rebasedTip: string }> =
      [];
    const fail = (index: number, message: string): StackRebaseResult => {
      results.push({ number: layers[index]!.number, outcome: 'failed', message });
      for (const layer of layers.slice(index + 1)) {
        results.push({
          number: layer.number,
          outcome: isActive(layer) ? 'skipped' : (layer.state as never),
        });
      }
      return { ok: false, results, error: message };
    };

    for (const [index, layer] of layers.entries()) {
      if (!isActive(layer)) {
        results.push({ number: layer.number, outcome: layer.state as 'merged' | 'closed' });
        continue;
      }
      const oldBaseTip = initialTipByBranch.get(layer.baseRef)!;
      const newBaseTip = currentTipByBranch.get(layer.baseRef)!;
      const headTip = layer.expectedHeadOid;

      if (await isAncestor(git, newBaseTip, headTip)) {
        results.push({ number: layer.number, outcome: 'current' });
        currentTipByBranch.set(layer.headRef, headTip);
        continue;
      }

      // The fork point comes from the base as it was fetched, before any lower Layer
      // was rewritten, so a lower Layer's newer commits are never replayed twice.
      let forkPoint: string;
      try {
        forkPoint = (await git(['merge-base', oldBaseTip, headTip])).trim();
      } catch (error: unknown) {
        if (error instanceof GitExecError && error.code === 1) {
          return fail(index, 'Could not verify this stack layer’s commits');
        }
        throw error;
      }
      if (forkPoint === headTip) {
        return fail(index, 'Could not verify this stack layer’s commits');
      }
      const merges = (
        await git(['rev-list', '--merges', '-n', '1', `${forkPoint}..${headTip}`])
      ).trim();
      if (merges) {
        return fail(index, 'This stack layer contains a merge commit');
      }

      const ctx: LayerReplayContext = {
        git,
        forkPoint,
        baseTip: newBaseTip,
        layerRef: branchRef(layer.headRef),
      };
      let rebasedTip: string;
      try {
        rebasedTip =
          (replayMode === 'per-patch' ? null : await replayLayerOntoBase(ctx, replayMode)) ??
          (await replayLayerPatchByPatch(ctx, messageFile));
      } catch (error: unknown) {
        if (error instanceof StackLayerConflict) return fail(index, CONFLICT_MESSAGE);
        throw error;
      }

      results.push({ number: layer.number, outcome: 'rebased' });
      pendingPushes.push({ headRef: layer.headRef, expectedHeadOid: headTip, rebasedTip });
      currentTipByBranch.set(layer.headRef, rebasedTip);
    }

    if (pendingPushes.length) {
      try {
        await git(
          [
            'push',
            '--atomic',
            '--porcelain',
            ...pendingPushes.map(
              (push) => `--force-with-lease=refs/heads/${push.headRef}:${push.expectedHeadOid}`
            ),
            '--',
            remote,
            ...pendingPushes.map((push) => `${push.rebasedTip}:refs/heads/${push.headRef}`),
          ],
          { network: true }
        );
      } catch (error: unknown) {
        if (error instanceof GitExecError) {
          warnGitFailure(error);
          throw createError(classifyPushError(error));
        }
        throw error;
      }
    }

    return { ok: true, results };
  } catch (error: unknown) {
    if (error instanceof GitExecError) {
      warnGitFailure(error);
      throw createError({ statusCode: 500, statusMessage: 'Could not rebase the stack' });
    }
    throw error;
  } finally {
    await rm(cwd, { recursive: true, force: true }).catch(() => {});
  }
}
