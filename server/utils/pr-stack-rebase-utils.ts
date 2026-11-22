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
}

export async function rebasePullRequestStackLayer({
  remote,
  accessToken,
  headRef,
  baseRef,
  expectedHeadOid,
  oldBaseOid,
}: StackLayerRebase): Promise<'current' | 'rebased'> {
  const cwd = await mkdtemp(join(tmpdir(), 'gitpulse-stack-'));
  const globalConfig = join(cwd, '.git', 'gitpulse-global-config');
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
  const git = async (args: string[], message: string, network = false) => {
    try {
      const { stdout } = await exec('git', args, {
        cwd,
        env: network ? transportEnv : env,
        timeout: 90_000,
        windowsHide: true,
      });
      return stdout.trim();
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
    await git(['init', '--quiet', '--template='], 'Could not initialize the rebase workspace');
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
    const actualHead = await git(['rev-parse', fetchedHead], 'Could not read the stack head');
    if (actualHead !== expectedHeadOid) {
      throw createError({ statusCode: 409, statusMessage: 'This stack layer has changed' });
    }

    const baseTip = await git(['rev-parse', fetchedBase], 'Could not read the stack base');
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
    await git(
      ['switch', '--quiet', '--detach', fetchedHead],
      'Could not check out the stack layer'
    );
    await git(
      [
        '-c',
        'user.name=GitPulse',
        '-c',
        'user.email=gitpulse@users.noreply.github.com',
        'rebase',
        '--quiet',
        '--onto',
        baseTip,
        forkPoint,
      ],
      'The stack layer could not be rebased cleanly'
    );
    await git(
      [
        'push',
        '--porcelain',
        `--force-with-lease=${head}:${expectedHeadOid}`,
        '--',
        remote,
        `HEAD:${head}`,
      ],
      'GitHub rejected the rebased branch. Check permissions, branch rules, and the current head.',
      true
    );
    return 'rebased';
  } finally {
    await rm(cwd, { recursive: true, force: true }).catch(() => {});
  }
}
