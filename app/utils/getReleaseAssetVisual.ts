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
import type { Component } from 'vue';

import type { ReleaseAsset } from '#shared/types/releases';

import { isReleaseAssetManifestName, RELEASE_ASSET_SIDECAR_SUFFIXES } from './groupReleaseAssets';

/** Colour family for a release asset, resolved to a theme token by the caller. */
export type ReleaseAssetTone =
  | 'installer'
  | 'archive'
  | 'document'
  | 'code'
  | 'media'
  | 'check'
  | 'unknown';

export interface ReleaseAssetVisual {
  icon: Component;
  tone: ReleaseAssetTone;
  /**
   * The extension the name was matched by, without its leading dot — the part a
   * reader scans for, so callers can pin it instead of letting it be truncated.
   * Absent when the extension table made no call.
   */
  suffix?: string;
}

interface ReleaseAssetFamily {
  icon: Component;
  tone: ReleaseAssetTone;
  extensions: readonly string[];
}

// A release asset names its own file type in the suffix, and that suffix is the
// signal worth trusting: GitHub reports `application/octet-stream` for most of
// them. The families answer the question the reader actually has — which build
// do I download — so each platform and each archive shape stays distinct.
//
// Tone is decoration on top of the shape, never a warning: nothing here reads as
// an error, and the muted fallback is the only deliberately quiet family.
const FAMILIES: readonly ReleaseAssetFamily[] = [
  { icon: MonitorDownIcon, tone: 'installer', extensions: ['exe', 'msi', 'msix', 'appx'] },
  { icon: DiscIcon, tone: 'installer', extensions: ['dmg', 'pkg'] },
  // Arch's `.pkg.tar.zst` is a package, not an archive; the longer suffix wins.
  {
    icon: PackageOpenIcon,
    tone: 'installer',
    extensions: ['pkg.tar.zst', 'pkg.tar.xz', 'deb', 'rpm', 'appimage', 'snap', 'flatpak', 'run'],
  },
  { icon: SmartphoneIcon, tone: 'installer', extensions: ['apk', 'aab'] },
  { icon: TabletIcon, tone: 'installer', extensions: ['ipa'] },
  {
    icon: FileBoxIcon,
    tone: 'archive',
    extensions: ['jar', 'whl', 'gem', 'nupkg', 'crate', 'vsix', 'pom'],
  },
  {
    icon: FileArchiveIcon,
    tone: 'archive',
    // The compound forms are listed so `.tar.gz` pins as one suffix instead of
    // leaving a bare `.gz` after a stem that still says `.tar`.
    extensions: [
      'tar.gz',
      'tar.xz',
      'tar.bz2',
      'tar.zst',
      'zip',
      'tar',
      'tgz',
      'tbz2',
      'gz',
      'xz',
      'txz',
      'bz2',
      'zst',
      '7z',
      'rar',
      'cab',
    ],
  },
  { icon: DatabaseIcon, tone: 'archive', extensions: ['sqlite', 'db', 'iso', 'img'] },
  { icon: FileSpreadsheetIcon, tone: 'document', extensions: ['csv', 'xlsx', 'xls', 'ods'] },
  {
    icon: FileBracesIcon,
    tone: 'document',
    extensions: ['json', 'yml', 'yaml', 'toml', 'xml', 'ini'],
  },
  {
    icon: FileTextIcon,
    tone: 'document',
    extensions: ['md', 'txt', 'pdf', 'doc', 'docx', 'rtf', 'html'],
  },
  {
    icon: FileCodeIcon,
    tone: 'code',
    extensions: ['sh', 'bash', 'ps1', 'bat', 'js', 'ts', 'py', 'go', 'rs', 'c', 'cpp', 'h', 'java'],
  },
  {
    icon: FileImageIcon,
    tone: 'media',
    extensions: ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'ico', 'bmp'],
  },
  { icon: FileVideoIcon, tone: 'media', extensions: ['mp4', 'webm', 'mov', 'mkv', 'avi'] },
  { icon: FileAudioIcon, tone: 'media', extensions: ['mp3', 'wav', 'flac', 'm4a', 'ogg'] },
  { icon: ShieldCheckIcon, tone: 'check', extensions: RELEASE_ASSET_SIDECAR_SUFFIXES },
];

const EXTENSION_FAMILIES = new Map<string, ReleaseAssetFamily>(
  FAMILIES.flatMap((family) => family.extensions.map((extension) => [extension, family] as const))
);

// A content type can say what kind of file this is, but never which suffix to
// pin, so none of these answer with one.
const CONTENT_TYPE_VISUALS: Readonly<Record<string, ReleaseAssetVisual>> = {
  'application/zip': { icon: FileArchiveIcon, tone: 'archive' },
  'application/gzip': { icon: FileArchiveIcon, tone: 'archive' },
  'application/x-gzip': { icon: FileArchiveIcon, tone: 'archive' },
  'application/x-tar': { icon: FileArchiveIcon, tone: 'archive' },
  'application/x-7z-compressed': { icon: FileArchiveIcon, tone: 'archive' },
  'application/vnd.rar': { icon: FileArchiveIcon, tone: 'archive' },
  'application/json': { icon: FileBracesIcon, tone: 'document' },
  'application/pdf': { icon: FileTextIcon, tone: 'document' },
  'application/vnd.android.package-archive': { icon: SmartphoneIcon, tone: 'installer' },
};

const CONTENT_TYPE_PREFIXES: ReadonlyArray<readonly [string, ReleaseAssetVisual]> = [
  ['image/', { icon: FileImageIcon, tone: 'media' }],
  ['video/', { icon: FileVideoIcon, tone: 'media' }],
  ['audio/', { icon: FileAudioIcon, tone: 'media' }],
  ['text/', { icon: FileTextIcon, tone: 'document' }],
];

const FALLBACK_VISUAL: ReleaseAssetVisual = { icon: FileIcon, tone: 'unknown' };

/**
 * A checksum manifest carries no giving suffix, but it still verifies the
 * release, so it reads as a signature rather than as an unnamed file.
 */
const SIDECAR_VISUAL: ReleaseAssetVisual = { icon: ShieldCheckIcon, tone: 'check' };

/**
 * Every suffix the name could be matched by, longest first, so `app.pkg.tar.zst`
 * is tried as a package before its `.zst` tail is tried as an archive.
 */
const suffixesOf = (name: string): string[] => {
  const segments = name.trim().toLowerCase().split('.');
  return segments.slice(1).map((_, index) => segments.slice(index + 1).join('.'));
};

const visualForContentType = (contentType: string | undefined): ReleaseAssetVisual | null => {
  const normalized = contentType?.split(';', 1)[0]?.trim().toLowerCase();
  if (!normalized) return null;

  const exact = CONTENT_TYPE_VISUALS[normalized];
  if (exact) return exact;

  const prefixed = CONTENT_TYPE_PREFIXES.find(([prefix]) => normalized.startsWith(prefix));
  return prefixed ? prefixed[1] : null;
};

/**
 * Picks the glyph and colour family for a GitHub release asset from its name,
 * falling back to its content type and then to a plain file.
 */
export default function getReleaseAssetVisual(
  asset: Pick<ReleaseAsset, 'name' | 'content_type'>
): ReleaseAssetVisual {
  // Ahead of the extension table, which would file `SHA256SUMS.txt` as a document.
  if (isReleaseAssetManifestName(asset.name)) return SIDECAR_VISUAL;

  for (const suffix of suffixesOf(asset.name)) {
    const family = EXTENSION_FAMILIES.get(suffix);
    if (family) return { icon: family.icon, tone: family.tone, suffix };
  }

  return visualForContentType(asset.content_type) ?? FALLBACK_VISUAL;
}
