import { describe, expect, test } from 'bun:test';

import {
  DatabaseIcon,
  DiscIcon,
  FileArchiveIcon,
  FileAudioIcon,
  FileBoxIcon,
  FileBracesIcon,
  FileCodeIcon,
  FileIcon,
  FileImageIcon,
  FileSpreadsheetIcon,
  FileTextIcon,
  FileVideoIcon,
  MonitorDownIcon,
  PackageOpenIcon,
  ShieldCheckIcon,
  SmartphoneIcon,
  TabletIcon,
} from '@lucide/vue';

import getReleaseAssetVisual from '../app/utils/getReleaseAssetVisual';

const asset = (name: string, content_type?: string) => ({ name, content_type });

// The glyph and its colour family; the matched suffix has its own test below.
const shape = (name: string, content_type?: string) => {
  const { icon, tone } = getReleaseAssetVisual(asset(name, content_type));
  return { icon, tone };
};

describe('getReleaseAssetVisual', () => {
  test('separates installers by the platform they target', () => {
    expect(shape('GitPulse-1.0.0-setup.exe')).toEqual({ icon: MonitorDownIcon, tone: 'installer' });
    expect(shape('GitPulse-1.0.0-arm64.dmg')).toEqual({ icon: DiscIcon, tone: 'installer' });
    expect(shape('gitpulse_1.0.0_amd64.deb')).toEqual({
      icon: PackageOpenIcon,
      tone: 'installer',
    });
    expect(shape('gitpulse-1.0.0.apk')).toEqual({ icon: SmartphoneIcon, tone: 'installer' });
    expect(shape('gitpulse-1.0.0.ipa')).toEqual({ icon: TabletIcon, tone: 'installer' });
  });

  test('matches the suffix without caring about case', () => {
    expect(shape('GitPulse-Setup.EXE').icon).toBe(MonitorDownIcon);
    expect(shape('GitPulse-raspberry.AppImage').icon).toBe(PackageOpenIcon);
  });

  test('tries the longest suffix before the last segment alone', () => {
    expect(shape('gitpulse-x86_64.pkg.tar.zst')).toEqual({
      icon: PackageOpenIcon,
      tone: 'installer',
    });
    expect(shape('gitpulse-linux.tar.zst')).toEqual({ icon: FileArchiveIcon, tone: 'archive' });
    expect(shape('CHECKSUMS.txt.sha256')).toEqual({ icon: ShieldCheckIcon, tone: 'check' });
  });

  test('keeps archives, ecosystem packages and reports apart', () => {
    expect(shape('gitpulse-1.0.0.zip')).toEqual({ icon: FileArchiveIcon, tone: 'archive' });
    expect(shape('gitpulse-1.0.0.tar.gz').icon).toBe(FileArchiveIcon);
    expect(shape('library.jar')).toEqual({ icon: FileBoxIcon, tone: 'archive' });
    expect(shape('gitpulse.vsix').icon).toBe(FileBoxIcon);
    expect(shape('benchmarks.csv')).toEqual({ icon: FileSpreadsheetIcon, tone: 'document' });
  });

  test('covers documentation, data, source, media and disk images', () => {
    expect(shape('CHANGELOG.md')).toEqual({ icon: FileTextIcon, tone: 'document' });
    expect(shape('release.json')).toEqual({ icon: FileBracesIcon, tone: 'document' });
    expect(shape('install.sh')).toEqual({ icon: FileCodeIcon, tone: 'code' });
    expect(shape('screenshot.png')).toEqual({ icon: FileImageIcon, tone: 'media' });
    expect(shape('demo.mp4')).toEqual({ icon: FileVideoIcon, tone: 'media' });
    expect(shape('chime.mp3')).toEqual({ icon: FileAudioIcon, tone: 'media' });
    expect(shape('gitpulse.sqlite')).toEqual({ icon: DatabaseIcon, tone: 'archive' });
  });

  test('gives every family its own tone so colour never merges two shapes', () => {
    const tones = new Set(
      [
        'setup.exe',
        'bundle.zip',
        'CHANGELOG.md',
        'install.sh',
        'screenshot.png',
        'CHECKSUMS.sha256',
      ].map((name) => shape(name).tone)
    );

    expect(tones).toEqual(new Set(['installer', 'archive', 'document', 'code', 'media', 'check']));
  });

  test('gives every signature and checksum form the same verified glyph', () => {
    for (const name of [
      'build.zip.minisig',
      'build.zip.sig',
      'build.zip.asc',
      'build.zip.sha256',
      'build.zip.sha256sum',
      'build.zip.sha512sum',
    ]) {
      expect(shape(name)).toEqual({ icon: ShieldCheckIcon, tone: 'check' });
    }
  });

  test('reads a bare checksum manifest as a signature, not an unnamed file', () => {
    for (const name of ['SHA256SUMS', 'checksums.txt', 'SHA512SUMS.txt']) {
      expect(shape(name, 'text/plain')).toEqual({ icon: ShieldCheckIcon, tone: 'check' });
    }
  });

  test('lets the name beat a disagreeing content type', () => {
    expect(shape('gitpulse-1.0.0.zip', 'application/pdf')).toEqual({
      icon: FileArchiveIcon,
      tone: 'archive',
    });
    expect(getReleaseAssetVisual(asset('gitpulse-1.0.0.zip', 'application/pdf')).suffix).toBe(
      'zip'
    );
  });

  test('reports the suffix it matched so the caller can pin it on screen', () => {
    expect(getReleaseAssetVisual(asset('gitpulse-x86_64.pkg.tar.zst')).suffix).toBe('pkg.tar.zst');
    expect(getReleaseAssetVisual(asset('gitpulse-linux.tar.zst')).suffix).toBe('tar.zst');
    expect(getReleaseAssetVisual(asset('GitPulse-Setup.EXE')).suffix).toBe('exe');
  });

  test('reports no suffix when the content type made the call', () => {
    expect(getReleaseAssetVisual(asset('latest', 'application/zip')).suffix).toBeUndefined();
    expect(getReleaseAssetVisual(asset('LICENSE')).suffix).toBeUndefined();
  });

  test('falls back to the content type when the name has no usable suffix', () => {
    expect(shape('latest', 'application/zip')).toEqual({
      icon: FileArchiveIcon,
      tone: 'archive',
    });
    expect(shape('preview', 'image/png; charset=binary')).toEqual({
      icon: FileImageIcon,
      tone: 'media',
    });
  });

  test('falls back to a plain file when nothing identifies the type', () => {
    expect(shape('gitpulse-1.0.0.unknownext')).toEqual({ icon: FileIcon, tone: 'unknown' });
    expect(shape('LICENSE').icon).toBe(FileIcon);
    expect(shape('LICENSE', 'application/octet-stream').icon).toBe(FileIcon);
  });
});
