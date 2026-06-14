import { describe, expect, mock, test } from 'bun:test';

import * as markdownMentions from '../shared/utils/markdown-mentions';
import {
  buildGitHubMentionUrl,
  findMarkdownMentionTrigger,
  isValidGitHubMentionLogin,
} from '../shared/utils/markdown-mentions';

mock.module('#shared/utils/markdown-mentions', () => markdownMentions);

const { default: useGitHubAutolinks } = await import('../app/composables/useGitHubAutolinks');

describe('markdown mentions', () => {
  test('detects textarea mention triggers at GitHub-style boundaries', () => {
    expect(findMarkdownMentionTrigger('Thanks @octo', 'Thanks @octo'.length)).toEqual({
      start: 7,
      end: 12,
      query: 'octo',
    });
    expect(findMarkdownMentionTrigger('(@hubot', '(@hubot'.length)).toEqual({
      start: 1,
      end: 7,
      query: 'hubot',
    });
    expect(findMarkdownMentionTrigger('email a@b', 'email a@b'.length)).toBeNull();
    expect(findMarkdownMentionTrigger('word@octo', 'word@octo'.length)).toBeNull();
  });

  test('validates GitHub profile login syntax', () => {
    expect(isValidGitHubMentionLogin('octocat')).toBe(true);
    expect(isValidGitHubMentionLogin('a-b')).toBe(true);
    expect(isValidGitHubMentionLogin('-octocat')).toBe(false);
    expect(isValidGitHubMentionLogin('octocat-')).toBe(false);
    expect(isValidGitHubMentionLogin('octo_cat')).toBe(false);
  });

  test('autolinks mentions in markdown text nodes', async () => {
    const { applyGitHubAutolinks } = useGitHubAutolinks();
    const tree = {
      nodes: [['p', {}, 'Hi @octocat, email a@b.com, and @hubot.']],
    } as any;

    await applyGitHubAutolinks(tree, {});

    expect(tree.nodes).toEqual([
      [
        'p',
        {},
        'Hi',
        ' ',
        ['a', { href: buildGitHubMentionUrl('octocat') }, '@octocat'],
        ', email a@b.com, and',
        ' ',
        ['a', { href: buildGitHubMentionUrl('hubot') }, '@hubot'],
        '.',
      ],
    ]);
  });

  test('does not autolink mentions inside existing links or code', async () => {
    const { applyGitHubAutolinks } = useGitHubAutolinks();
    const tree = {
      nodes: [
        [
          'p',
          {},
          ['a', { href: 'https://example.com' }, '@octocat'],
          ' ',
          ['code', {}, '@hubot'],
          ' @ghost',
        ],
      ],
    } as any;

    await applyGitHubAutolinks(tree, {});

    expect(tree.nodes).toEqual([
      [
        'p',
        {},
        ['a', { href: 'https://example.com' }, '@octocat'],
        ' ',
        ['code', {}, '@hubot'],
        ' ',
        ['a', { href: buildGitHubMentionUrl('ghost') }, '@ghost'],
      ],
    ]);
  });

  test('does not partially autolink invalid underscore logins', async () => {
    const { applyGitHubAutolinks } = useGitHubAutolinks();
    const tree = {
      nodes: [['p', {}, 'Hi @octo_cat and @valid-user']],
    } as any;

    await applyGitHubAutolinks(tree, {});

    expect(tree.nodes).toEqual([
      [
        'p',
        {},
        'Hi @octo_cat and',
        ' ',
        ['a', { href: buildGitHubMentionUrl('valid-user') }, '@valid-user'],
      ],
    ]);
  });
});
