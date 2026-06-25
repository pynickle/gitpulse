import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';

describe('repository file view GitHub link routing', () => {
  test('routes file browser click targets through the shared GitHub-link preference', () => {
    const source = readFileSync('app/components/dashboard/repo-files/RepoFileView.vue', 'utf8');

    expect(source).toContain(
      'const { opensGitHubLinks, openGitHubTarget } = useGitHubLinkRouting()'
    );
    expect(source).toContain('createDashboardRepositoryTarget');
    expect(source).toContain('createDashboardFileTarget');
    expect(source).toContain('const openRepoOnGitHub = () => {');
    expect(source).toContain(
      'const openFilePath = async (path: string, view: GitHubFileDashboardView)'
    );
    expect(source).toContain(`@click="openFilePath('', 'tree')"`);
    expect(source).toContain(`await openFilePath(row.node.path, 'tree')`);
    expect(source).toContain(`await openFilePath(row.node.path, 'blob')`);
    expect(source).toContain(
      `await openFilePath(item.path, item.type === 'dir' ? 'tree' : 'blob')`
    );
    expect(source).toContain(`await openFilePath(segments.join('/'), 'tree')`);
    expect(source).toContain('if (openRepoOnGitHub()) return;');
  });
});
