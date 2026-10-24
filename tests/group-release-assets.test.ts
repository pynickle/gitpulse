import { describe, expect, test } from 'bun:test';

import groupReleaseAssets from '../app/utils/groupReleaseAssets';
import type { ReleaseAsset } from '../shared/types/releases';

const asset = (name: string): ReleaseAsset => ({
  id: name,
  name,
  size: 1,
  download_count: 0,
  browser_download_url: `https://example.test/${name}`,
});

const names = (assets: readonly ReleaseAsset[]) => assets.map((item) => item.name);

// The shape of a real release: four Linux builds, each with its own signature.
const release = [
  'install.sh',
  'install.sh.minisig',
  'openlogi-v0.8.17-linux-amd64.deb',
  'openlogi-v0.8.17-linux-amd64.deb.minisig',
  'openlogi-v0.8.17-linux-amd64.flatpak',
  'openlogi-v0.8.17-linux-amd64.pkg.tar.zst',
  'openlogi-v0.8.17-linux-amd64.pkg.tar.zst.minisig',
  'openlogi-v0.8.17-linux-amd64.rpm',
  'CHECKSUMS.sha256',
].map(asset);

describe('groupReleaseAssets', () => {
  test('lifts signatures and checksums out of the downloads', () => {
    const { primary, sidecars } = groupReleaseAssets(release);

    expect(names(primary)).toEqual([
      'install.sh',
      'openlogi-v0.8.17-linux-amd64.deb',
      'openlogi-v0.8.17-linux-amd64.flatpak',
      'openlogi-v0.8.17-linux-amd64.pkg.tar.zst',
      'openlogi-v0.8.17-linux-amd64.rpm',
    ]);
    expect(names(sidecars)).toEqual([
      'install.sh.minisig',
      'openlogi-v0.8.17-linux-amd64.deb.minisig',
      'openlogi-v0.8.17-linux-amd64.pkg.tar.zst.minisig',
      'CHECKSUMS.sha256',
    ]);
  });

  test('recognises every sidecar suffix GitHub releases ship', () => {
    const { sidecars } = groupReleaseAssets(
      [
        'build.zip.asc',
        'build.zip.sig',
        'build.zip.gpg',
        'build.zip.minisig',
        'build.zip.sha256sum',
        'build.zip.sha512sum',
        'build.zip.md5',
        'release.pem',
        'release.crt',
        'release.pub',
      ].map(asset)
    );

    expect(sidecars).toHaveLength(10);
  });

  test('treats a bare checksum manifest as a sidecar too', () => {
    const { primary, sidecars } = groupReleaseAssets(
      ['build.zip', 'SHA256SUMS', 'SHA256SUMS.txt', 'checksums.txt', 'hashes'].map(asset)
    );

    expect(names(primary)).toEqual(['build.zip']);
    expect(names(sidecars)).toEqual(['SHA256SUMS', 'SHA256SUMS.txt', 'checksums.txt', 'hashes']);
  });

  test('keeps a file whose name merely ends in a sidecar word', () => {
    const { primary, sidecars } = groupReleaseAssets(
      ['minisig', 'sig', 'checksums-notes', 'openlogi-v0.8.17-linux-amd64.pkg.tar.zst'].map(asset)
    );

    expect(names(primary)).toEqual([
      'minisig',
      'sig',
      'checksums-notes',
      'openlogi-v0.8.17-linux-amd64.pkg.tar.zst',
    ]);
    expect(sidecars).toEqual([]);
  });

  test('leaves a release without sidecars untouched', () => {
    const { primary, sidecars } = groupReleaseAssets(['a.zip', 'b.dmg'].map(asset));

    expect(names(primary)).toEqual(['a.zip', 'b.dmg']);
    expect(sidecars).toEqual([]);
  });

  test('survives an empty release', () => {
    expect(groupReleaseAssets([])).toEqual({ primary: [], sidecars: [] });
  });
});
