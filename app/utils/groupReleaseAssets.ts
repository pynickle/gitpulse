import type { ReleaseAsset } from '#shared/types/releases';

/**
 * Suffixes that sign or hash another asset instead of being one. This list is the
 * single source for that idea: the glyph table builds its `check` family from it,
 * so a format can never be a signature to one caller and a download to the other.
 */
export const RELEASE_ASSET_SIDECAR_SUFFIXES = [
  'minisig',
  'sig',
  'gpg',
  'asc',
  'pem',
  'crt',
  'pub',
  'sha256',
  'sha512',
  'sha1',
  'md5',
  'sha256sum',
  'sha512sum',
] as const;

/**
 * Checksum manifests: a list that covers the whole release, so no suffix marks
 * it and there is no single build it could be attached to.
 */
const MANIFEST_NAME = /^(?:(?:sha1|sha256|sha512|md5|sha)sums?|checksums?|hashes)(?:\.txt)?$/i;

export interface GroupedReleaseAssets {
  /** What a reader picks from: installers, archives, documents. */
  primary: ReleaseAsset[];
  /**
   * Signatures and checksums. They keep their own section rather than mixing
   * into the list, because a release that ships five of them buries the build
   * the reader came for under files nobody scans for.
   */
  sidecars: ReleaseAsset[];
}

/**
 * Whether a name is a checksum manifest: one list covering the whole release, so
 * it is neither a build nor attached to a single one. Checked ahead of the
 * extension table, because GitHub serves it as plain text and a `.txt` suffix
 * would otherwise have it filed as a document.
 */
export const isReleaseAssetManifestName = (name: string): boolean =>
  MANIFEST_NAME.test(name.toLowerCase());

const isSidecarName = (name: string): boolean => {
  const lower = name.toLowerCase();

  if (isReleaseAssetManifestName(lower)) return true;

  return RELEASE_ASSET_SIDECAR_SUFFIXES.some(
    (suffix) => lower.endsWith(`.${suffix}`) && lower.length > suffix.length + 1
  );
};

export default function groupReleaseAssets(assets: readonly ReleaseAsset[]): GroupedReleaseAssets {
  const primary: ReleaseAsset[] = [];
  const sidecars: ReleaseAsset[] = [];

  for (const asset of assets) {
    (isSidecarName(asset.name) ? sidecars : primary).push(asset);
  }

  return { primary, sidecars };
}
