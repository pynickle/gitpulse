import { afterEach, beforeEach, describe, expect, test } from 'bun:test';

import { defineComponent, h, shallowRef } from 'vue';

import formatCompactNumber from '../app/utils/formatCompactNumber';
import formatReleaseAssetSize from '../app/utils/formatReleaseAssetSize';
import getReleaseAssetVisual from '../app/utils/getReleaseAssetVisual';
import groupReleaseAssets from '../app/utils/groupReleaseAssets';
import type { ReleaseAsset } from '../shared/types/releases';
import { compileVue } from './helpers/compile-vue';
import { createVueDom } from './helpers/vue-dom';

const empty = defineComponent({ setup: () => () => h('span') });
const Assets = await compileVue('app/components/dashboard/releases/ReleaseAssetsList.vue', {
  '@lucide/vue': { DownloadIcon: empty },
});

const asset = (name: string): ReleaseAsset => ({
  id: name,
  name,
  size: 40 * 1024 * 1024,
  download_count: 138,
  browser_download_url: `https://example.test/${name}`,
});

let dom: ReturnType<typeof createVueDom>;
beforeEach(() => {
  dom = createVueDom({
    useI18n: () => ({
      locale: shallowRef('en'),
      t: (key: string, params?: Record<string, unknown>) =>
        [key, ...Object.values(params ?? {})].join(' '),
    }),
    formatCompactNumber,
    formatReleaseAssetSize,
    getReleaseAssetVisual,
    groupReleaseAssets,
  });
});
afterEach(async () => {
  await dom.cleanup();
});

const mountList = (assets: ReleaseAsset[], namePrefix?: readonly string[]) =>
  dom.mount(
    defineComponent({
      setup: () => () => h(Assets, { assets, namePrefix }),
    })
  ).root;

const texts = (root: Element, selector: string) =>
  [...root.querySelectorAll(selector)].map((node) => node.textContent?.trim());

describe('ReleaseAssetsList', () => {
  test('pins the type suffix so a squeezed name keeps the part that tells builds apart', () => {
    const root = mountList([asset('openlogi-v0.8.17-linux-amd64.pkg.tar.zst')]);

    expect(texts(root, '.release-assets-list__stem')).toEqual(['openlogi-v0.8.17-linux-amd64']);
    expect(texts(root, '.release-assets-list__suffix')).toEqual(['.pkg.tar.zst']);
  });

  test('drops the release prefix every name repeats', () => {
    const root = mountList(
      [
        asset('OpenLogi-v0.8.17-linux-amd64.deb'),
        asset('OpenLogi-v0.8.17-darwin-arm64.tar.gz'),
        asset('install.sh'),
      ],
      ['OpenLogi-v0.8.17', 'v0.8.17']
    );

    expect(texts(root, '.release-assets-list__stem')).toEqual([
      'linux-amd64',
      'darwin-arm64',
      'install',
    ]);
    expect(texts(root, '.release-assets-list__suffix')).toEqual(['.deb', '.tar.gz', '.sh']);
  });

  test('keeps signatures in their own group below the downloads', () => {
    const root = mountList([
      asset('openlogi-v0.8.17-linux-amd64.deb'),
      asset('openlogi-v0.8.17-linux-amd64.deb.minisig'),
      asset('CHECKSUMS.sha256'),
    ]);

    const sections = [...root.querySelectorAll('.release-assets-list__section')];
    expect(sections).toHaveLength(2);
    expect(texts(sections[0]!, '.release-assets-list__stem')).toEqual([
      'openlogi-v0.8.17-linux-amd64',
    ]);
    expect(texts(sections[1]!, '.release-assets-list__stem')).toEqual([
      'openlogi-v0.8.17-linux-amd64.deb',
      'CHECKSUMS',
    ]);
    expect(sections[1]!.getAttribute('role')).toBe('group');
  });

  test('draws the group boundary only when a group sits above it', () => {
    const both = mountList([asset('build.zip'), asset('build.zip.sig')]);
    expect(both.querySelectorAll('.release-assets-list__section--separated')).toHaveLength(1);
    expect(
      [...both.querySelectorAll('.release-assets-list__section--separated')][0]!.getAttribute(
        'aria-label'
      )
    ).toBe('releaseDetail.assetSidecars');

    const onlySidecars = mountList([asset('build.zip.sig'), asset('SHA256SUMS')]);
    expect(onlySidecars.querySelectorAll('.release-assets-list__section--separated')).toHaveLength(
      0
    );
  });

  test('still links every signature, so nothing becomes unreachable', () => {
    const root = mountList([asset('build.zip'), asset('build.zip.sig')]);

    expect(texts(root, 'a.release-assets-list__item')).toHaveLength(2);
    expect([...root.querySelectorAll('a')].map((link) => link.getAttribute('href'))).toEqual([
      'https://example.test/build.zip',
      'https://example.test/build.zip.sig',
    ]);
  });

  test('says so when the release has no assets at all', () => {
    const root = mountList([]);

    expect(root.querySelector('.release-assets-list')).toBeNull();
    expect(root.textContent).toContain('releaseDetail.noAssets');
  });
});
