import type { Octokit } from '@octokit/core';

import { fetchPaginatedArray } from '#server/utils/github-timeline-utils';

import type { RepositoryMergeSettings } from './pr-merge-settings-utils';
import { mapRepositoryMergeSettings } from './pr-merge-settings-utils';

type GitHubClient = Octokit;

export interface PRMergeCommitDefaults {
  merge: { title: string; message: string };
  squash: { title: string; message: string };
}

export interface ResolveMergeCommitDefaultsInput {
  settings: RepositoryMergeSettings;
  pullNumber: number;
  pullTitle: string;
  pullBody: string;
  /** `owner/branch` for a fork pull request, the branch name otherwise. */
  headBranch: string;
  commitCount: number | null;
  /**
   * Every commit message of the pull request, or null when they were not read.
   * A cell that needs a message we do not have stays empty rather than guessed:
   * an unchanged empty field is never sent, so GitHub still forms its own.
   */
  commitMessages: readonly string[] | null;
}

interface GitHubPullCommitDefaultsSource {
  title?: string | null;
  body?: string | null;
  commits?: number | null;
  head?: { label?: string | null; ref?: string | null } | null;
}

interface GitHubPullCommit {
  commit?: { message?: string | null } | null;
}

const firstLine = (message: string) => message.split('\n', 1)[0]?.trim() ?? '';

/**
 * The head branch as the automatic merge message names it: GitHub writes a fork
 * pull request's `head.label` (`owner:branch`) with a slash.
 */
export function toMergeHeadBranch(label: string | null | undefined): string {
  return typeof label === 'string' ? label.trim().replace(':', '/') : '';
}

/**
 * The commit title and message GitHub forms for each merge method, per the
 * repository's default commit message settings.
 *
 * Every first line carries the pull request number, except a single commit
 * squashed with `COMMIT_OR_PR_TITLE`: that keeps the commit's own title, and the
 * commit's own message becomes the body instead of a one item list.
 */
export function resolveMergeCommitDefaults(
  input: ResolveMergeCommitDefaultsInput
): PRMergeCommitDefaults {
  const { settings, pullNumber, pullTitle, pullBody, headBranch, commitCount } = input;
  const pullTitleWithNumber = `${pullTitle} (#${pullNumber})`;
  const singleCommit = commitCount === 1;
  const singleCommitMessage = singleCommit ? (input.commitMessages?.[0]?.trim() ?? '') : '';

  const mergeTitle =
    settings.mergeCommitTitle === 'PR_TITLE'
      ? pullTitleWithNumber
      : headBranch
        ? `Merge pull request #${pullNumber} from ${headBranch}`
        : `Merge pull request #${pullNumber}`;

  let mergeMessage = '';
  if (settings.mergeCommitMessage === 'PR_TITLE') mergeMessage = pullTitle;
  else if (settings.mergeCommitMessage === 'PR_BODY') mergeMessage = pullBody;

  let squashTitle = pullTitleWithNumber;
  if (settings.squashMergeCommitTitle === 'COMMIT_OR_PR_TITLE') {
    if (commitCount === null) {
      // One commit keeps its own title and several take the pull request title, so
      // without a commit count there is no title to state.
      squashTitle = '';
    } else if (singleCommit) {
      squashTitle = firstLine(singleCommitMessage);
    }
  }

  let squashMessage = '';
  if (settings.squashMergeCommitMessage === 'PR_BODY') {
    squashMessage = pullBody;
  } else if (settings.squashMergeCommitMessage === 'COMMIT_MESSAGES') {
    if (singleCommit) {
      squashMessage = singleCommitMessage;
    } else if (input.commitMessages) {
      squashMessage = input.commitMessages
        .map((message) => `* ${message.trim()}`)
        .filter((line) => line !== '*')
        .join('\n\n');
    }
  }

  return {
    merge: { title: mergeTitle, message: mergeMessage },
    squash: { title: squashTitle, message: squashMessage },
  };
}

async function fetchPullCommitMessages(
  octokit: GitHubClient,
  owner: string,
  repo: string,
  pullNumber: number
): Promise<string[] | null> {
  try {
    const commits = await fetchPaginatedArray<GitHubPullCommit>(
      octokit,
      'GET /repos/{owner}/{repo}/pulls/{pull_number}/commits',
      { owner, repo, pull_number: pullNumber }
    );

    return commits
      .map((commit) => (typeof commit.commit?.message === 'string' ? commit.commit.message : ''))
      .filter((message) => message.trim().length > 0);
  } catch (error) {
    console.warn('Failed to fetch pull request commit messages for the commit defaults:', error);
    return null;
  }
}

/**
 * Both merge methods' default commit text for one pull request, read from the
 * repository settings in hand and, only when a cell needs them, the pull
 * request's commit messages.
 */
export async function fetchPRCommitDefaults(
  octokit: GitHubClient,
  owner: string,
  repo: string,
  pullNumber: number
): Promise<PRMergeCommitDefaults> {
  const [{ data: repository }, { data: pullRequest }] = await Promise.all([
    octokit.request('GET /repos/{owner}/{repo}', { owner, repo }),
    octokit.request('GET /repos/{owner}/{repo}/pulls/{pull_number}', {
      owner,
      repo,
      pull_number: pullNumber,
    }),
  ]);

  const settings = mapRepositoryMergeSettings(repository);
  const pull = pullRequest as GitHubPullCommitDefaultsSource;
  const commitCount = typeof pull.commits === 'number' ? pull.commits : null;
  const needsCommitMessages =
    settings.squashMergeCommitMessage === 'COMMIT_MESSAGES' ||
    (settings.squashMergeCommitTitle === 'COMMIT_OR_PR_TITLE' && commitCount === 1);

  return resolveMergeCommitDefaults({
    settings,
    pullNumber,
    pullTitle: pull.title ?? '',
    pullBody: pull.body ?? '',
    headBranch: toMergeHeadBranch(pull.head?.label || pull.head?.ref),
    commitCount,
    commitMessages: needsCommitMessages
      ? await fetchPullCommitMessages(octokit, owner, repo, pullNumber)
      : null,
  });
}
