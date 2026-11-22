import { execFile } from 'node:child_process';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';

const exec = promisify(execFile);
const commitOid = /^[0-9a-f]{40}$/;

interface StackRebaseSnapshot {
  stackNumber: number;
  baseRef: string;
  baseSha: string;
  expectedHeadOid: string;
}

export function signStackRebaseSnapshot(
  secret: string,
  owner: string,
  repo: string,
  pullNumber: number,
  snapshot: StackRebaseSnapshot
) {
  return createHmac('sha256', secret)
    .update(
      JSON.stringify([
        'gitpulse:stack-rebase',
        owner.toLowerCase(),
        repo.toLowerCase(),
        pullNumber,
        snapshot.stackNumber,
        snapshot.baseRef,
        snapshot.baseSha,
        snapshot.expectedHeadOid,
      ])
    )
    .digest('hex');
}

export function verifyStackRebaseSnapshot(expected: string, received: string) {
  const left = Buffer.from(expected);
  const right = Buffer.from(received);
  return left.length === right.length && timingSafeEqual(left, right);
}

interface StackLayerRebase {
  remote: string;
  accessToken?: string;
  headRef: string;
  baseRef: string;
  expectedHeadOid: string;
  oldBaseOid: string | null;
  /**
   * Forces one replay strategy. Production always leaves this unset, where a Git
   * that documents `git replay` gets the fast path and everything else gets the
   * per-patch one. Tests set it to reach a branch a PATH shim cannot select.
   */
  replay?: 'git' | 'per-patch';
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

type LayerGit = (
  args: string[],
  message: string,
  network?: boolean,
  extraEnv?: Record<string, string>
) => Promise<string>;

/** Matches the fields requested from `git log` below, one commit at a time. */
const COMMIT_FIELDS = 7;
const COMMIT_FORMAT = '--format=%H%x00%P%x00%T%x00%an%x00%ae%x00%aI%x00%B';
const COMMITTER = [
  '-c',
  'user.name=GitPulse',
  '-c',
  'user.email=gitpulse@users.noreply.github.com',
];

/**
 * Reads the commits this Layer adds, oldest first, with the author each one keeps
 * across the rewrite. `%P` gives the parent to diff against, which is the very
 * parent `git rebase` would replay from.
 */
function parseLayerCommits(stdout: string, fallbackParent: string): StackLayerCommit[] {
  const fields = stdout.split('\0');
  const commits: StackLayerCommit[] = [];

  for (let index = 0; index + COMMIT_FIELDS <= fields.length; index += COMMIT_FIELDS) {
    const oid = fields[index] ?? '';
    const parents = (fields[index + 1] ?? '').trim();
    if (!commitOid.test(oid)) continue;
    commits.push({
      oid,
      parent: parents.split(' ')[0] || fallbackParent,
      tree: fields[index + 2] ?? '',
      authorName: fields[index + 3] ?? '',
      authorEmail: fields[index + 4] ?? '',
      authorDate: fields[index + 5] ?? '',
      message: fields[index + 6] ?? '',
    });
  }

  return commits;
}

/** Raised when a Layer's patches do not apply to the new base. */
const CONFLICT_MESSAGE = 'The stack layer could not be rebased cleanly';

const isConflict = (error: unknown) =>
  Boolean(
    error &&
    typeof error === 'object' &&
    'statusCode' in error &&
    error.statusCode === 409 &&
    'statusMessage' in error &&
    error.statusMessage === CONFLICT_MESSAGE
  );

/**
 * Replays the whole Layer in one `git replay` call. That command writes straight to the
 * object database, so the cost stops growing with the number of patches the Layer
 * carries.
 *
 * `git replay` is experimental and needs Git 2.38, so it is probed first and skipped on
 * any build without it. Returns null when the caller must fall back; a conflicting
 * replay performs the same three-way merge `git rebase` does, so it raises the same
 * error instead of falling back.
 */
async function replayLayerOntoBase({
  git,
  forkPoint,
  baseTip,
  fetchedHead,
  scratchRef,
}: {
  git: LayerGit;
  forkPoint: string;
  baseTip: string;
  fetchedHead: string;
  scratchRef: string;
}): Promise<string | null> {
  try {
    const help = await git(['replay', '-h'], 'Could not detect the Git replay ability');
    // Only a Git that documents the subcommand counts. An older one either fails the
    // call above or answers a different help text.
    if (!/\bgit replay\b/.test(help)) return null;
  } catch {
    return null;
  }

  try {
    await git(
      [
        ...COMMITTER,
        'replay',
        `--onto=${baseTip}`,
        `--ref=${scratchRef}`,
        '--ref-action=update',
        `${forkPoint}..${fetchedHead}`,
      ],
      CONFLICT_MESSAGE
    );
    const replayed = await git(
      ['rev-parse', '--verify', scratchRef],
      'Could not read the rebased stack layer'
    );
    return replayed || null;
  } catch (error: unknown) {
    // A conflict is a real answer about this Layer, not a reason to retry another way.
    if (isConflict(error)) throw error;
    return null;
  }
}

/**
 * Replays the Layer one patch at a time for a Git that has no `git replay`. Each patch is
 * a three-way merge written straight to the object database, so no work tree is checked
 * out either.
 */
async function replayLayerPatchByPatch(
  git: LayerGit,
  forkPoint: string,
  baseTip: string,
  fetchedHead: string,
  messageFile: string
): Promise<string> {
  const commits = parseLayerCommits(
    await git(
      [
        'log',
        '--reverse',
        '--topo-order',
        '-z',
        '--no-color',
        COMMIT_FORMAT,
        `${forkPoint}..${fetchedHead}`,
      ],
      'Could not read the stack layer commits'
    ),
    forkPoint
  );

  let parent = baseTip;
  let parentTree = await git(
    ['rev-parse', `${baseTip}^{tree}`],
    'Could not read the stack layer commits'
  );
  // One `rev-parse` answers every patch's parent tree, so telling a born-empty commit
  // from one that only becomes empty costs no extra process per patch.
  const parentTrees = commits.length
    ? await git(
        ['rev-parse', ...commits.map((commit) => `${commit.parent}^{tree}`)],
        'Could not read the stack layer commits'
      )
    : '';
  const parentTreeOf = (index: number) => parentTrees.split('\n')[index]?.trim() ?? '';
  for (const [index, commit] of commits.entries()) {
    const tree = await git(
      ['merge-tree', '--write-tree', `--merge-base=${commit.parent}`, parent, commit.oid],
      CONFLICT_MESSAGE
    );
    // A patch the new base already contains replays to the same tree, and `git rebase`
    // drops exactly that. A commit that was already empty before the replay keeps its
    // own tree, and a rebase keeps it, so compare the commit against its own parent.
    const wasBornEmpty = commit.tree === parentTreeOf(index);
    if (tree === parentTree && !wasBornEmpty) continue;
    await writeFile(messageFile, commit.message);
    parent = await git(
      [...COMMITTER, 'commit-tree', tree, '-p', parent, '-F', messageFile],
      'Could not write the rebased stack layer',
      false,
      {
        GIT_AUTHOR_NAME: commit.authorName,
        GIT_AUTHOR_EMAIL: commit.authorEmail,
        GIT_AUTHOR_DATE: commit.authorDate,
      }
    );
    parentTree = tree;
  }

  return parent;
}

export async function rebasePullRequestStackLayer({
  remote,
  accessToken,
  headRef,
  baseRef,
  expectedHeadOid,
  oldBaseOid,
  replay,
}: StackLayerRebase): Promise<'current' | 'rebased'> {
  const cwd = await mkdtemp(join(tmpdir(), 'gitpulse-stack-'));
  const globalConfig = join(cwd, 'gitpulse-global-config');
  const messageFile = join(cwd, 'gitpulse-message');
  const env = {
    ...Object.fromEntries(Object.entries(process.env).filter(([name]) => !/^git_/i.test(name))),
    GIT_CONFIG_NOSYSTEM: '1',
    GIT_CONFIG_GLOBAL: globalConfig,
    GIT_TERMINAL_PROMPT: '0',
  };
  const transportEnv = accessToken
    ? {
        ...env,
        GIT_CONFIG_COUNT: '1',
        GIT_CONFIG_KEY_0: 'http.https://github.com/.extraheader',
        GIT_CONFIG_VALUE_0: `Authorization: Basic ${Buffer.from(`x-access-token:${accessToken}`).toString('base64')}`,
      }
    : env;
  const git: LayerGit = async (args, message, network = false, extraEnv = {}) => {
    try {
      const { stdout, stderr } = await exec('git', args, {
        cwd,
        env: { ...(network ? transportEnv : env), ...extraEnv },
        timeout: 90_000,
        windowsHide: true,
      });
      // Some Git builds answer a usage request on stderr, and the replay probe reads
      // that answer, so both streams count for the same reply.
      return [stdout, stderr].filter(Boolean).join('\n').trim();
    } catch (error: unknown) {
      if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') {
        throw createError({
          statusCode: 503,
          statusMessage: 'Stack rebase requires Git on the server',
        });
      }
      throw createError({ statusCode: 409, statusMessage: message });
    }
  };

  const head = `refs/heads/${headRef}`;
  const base = `refs/heads/${baseRef}`;
  const fetchedHead = 'refs/gitpulse/head';
  const fetchedBase = 'refs/gitpulse/base';
  try {
    if (!commitOid.test(expectedHeadOid) || (oldBaseOid !== null && !commitOid.test(oldBaseOid))) {
      throw createError({ statusCode: 409, statusMessage: 'Stack layer has an invalid commit ID' });
    }
    // A bare repository keeps the objects in place without checking a work tree out,
    // which is the step that used to dominate this call.
    await git(
      ['init', '--quiet', '--bare', '--template='],
      'Could not initialize the rebase workspace'
    );
    await writeFile(globalConfig, '');
    await git(['check-ref-format', head], 'Invalid stack head branch');
    await git(['check-ref-format', base], 'Invalid stack base branch');
    await git(
      [
        'fetch',
        '--quiet',
        '--no-tags',
        '--no-recurse-submodules',
        '--',
        remote,
        `${head}:${fetchedHead}`,
        `${base}:${fetchedBase}`,
      ],
      'Could not fetch the stack layer and its base branch',
      true
    );
    const actualHead = await git(['rev-parse', fetchedHead], 'Could not read the stack layer');
    if (actualHead !== expectedHeadOid) {
      throw createError({ statusCode: 409, statusMessage: 'This stack layer has changed' });
    }
    const baseTip = await git(['rev-parse', fetchedBase], 'Could not read the stack layer');

    const commonBase = await git(
      ['merge-base', fetchedBase, fetchedHead],
      'Stack layer has no common base'
    );
    if (baseTip === commonBase) return 'current';

    const forkPoint = oldBaseOid ?? commonBase;
    if (forkPoint === actualHead) {
      throw createError({
        statusCode: 409,
        statusMessage: 'Could not verify this stack layer’s commits',
      });
    }
    await git(
      ['merge-base', '--is-ancestor', forkPoint, fetchedHead],
      'Could not verify where this stack layer starts'
    );
    const merges = await git(
      ['rev-list', '--merges', '-n', '1', `${forkPoint}..${fetchedHead}`],
      'Could not read the stack layer commits'
    );
    if (merges) {
      throw createError({
        statusCode: 409,
        statusMessage: 'This stack layer contains a merge commit',
      });
    }

    // `git replay` does the whole Layer in one call, which is what keeps a long
    // Layer cheap. The per-patch path is the answer for a Git too old to have it,
    // and for an older Git that answers something other than a replay.
    const fastPath =
      replay === 'per-patch'
        ? null
        : await replayLayerOntoBase({
            git,
            forkPoint,
            baseTip,
            fetchedHead,
            scratchRef: 'refs/gitpulse/rebased',
          });
    const rebasedTip =
      fastPath ??
      (await replayLayerPatchByPatch(git, forkPoint, baseTip, fetchedHead, messageFile));

    await git(
      [
        'push',
        '--porcelain',
        `--force-with-lease=${head}:${expectedHeadOid}`,
        '--',
        remote,
        `${rebasedTip}:${head}`,
      ],
      'GitHub rejected the rebased branch. Check permissions, branch rules, and the current head.',
      true
    );
    return 'rebased';
  } finally {
    await rm(cwd, { recursive: true, force: true }).catch(() => {});
  }
}
