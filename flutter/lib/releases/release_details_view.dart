import 'package:flutter/material.dart';

import '../l10n/generated/app_localizations.dart';
import '../presentation/gitpulse_formatting.dart';
import '../presentation/gitpulse_tokens.dart';
import 'document_content.dart';
import 'release_detail_dto.dart';
import 'release_detail_service.dart';
import 'release_document.dart';

/// The reading body of the Release Drawer: offline notice, the release's name,
/// one quiet meta line, the notes, and the Release Assets. The drawer's chrome
/// line owns the release identity and every action that leaves the notes — the
/// repository page, the Repository Release List, GitHub and close — so nothing
/// here competes with the notes for the top of the surface.
///
/// The notes are the one scroller in this body: a document is shown by a
/// WebView, which keeps the gestures that land on it, so the chrome above it and
/// the Release Assets row below it stay put while the document scrolls. Opening
/// the assets swaps them into the reading area rather than stacking a second
/// scroller under the document.
class ReleaseDetailsView extends StatefulWidget {
  const ReleaseDetailsView({
    super.key,
    required this.release,
    required this.onTapUrl,
    required this.onOpenExternal,
  });

  final ReleaseDetail release;
  final Future<bool> Function(String) onTapUrl;
  final Future<bool> Function(String) onOpenExternal;

  @override
  State<ReleaseDetailsView> createState() => _ReleaseDetailsViewState();
}

class _ReleaseDetailsViewState extends State<ReleaseDetailsView> {
  bool _showingAssets = false;

  @override
  Widget build(BuildContext context) {
    final release = widget.release;
    final l10n = AppLocalizations.of(context);
    final theme = Theme.of(context);
    final meta = [
      if (release.publishedAt case final date?)
        gitPulseDateTime(context, date.toLocal()),
      if (release.dto.author case final author?) author.login,
      if (release.dto.prerelease) l10n.timelinePrerelease,
      if (release.dto.draft) l10n.releaseDraft,
    ].join(' · ');
    final reading = release.body.isEmpty
        ? Align(alignment: Alignment.topLeft, child: Text(l10n.releaseNoNotes))
        : ReleaseDocument(
            source: release.body,
            document: RepositoryDocumentContext(
              owner: release.owner,
              repository: release.repository,
              ref: release.tag,
            ),
            onTapUrl: widget.onTapUrl,
          );
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        if (release.offline)
          Padding(
            padding: const EdgeInsets.only(bottom: 12),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(l10n.releaseOfflineBody),
                if (release.savedAt case final savedAt?)
                  Text(
                    l10n.timelineSavedAt(
                      gitPulseDateTime(context, savedAt.toLocal()),
                    ),
                  ),
              ],
            ),
          ),
        // The release's name and its meta line are one tightly grouped block:
        // they are the app's header, not part of the author's markdown. The
        // name stays even when it repeats the tag, because it is the release's
        // own title rather than the chrome line's identity.
        Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            SelectableText(release.title, style: theme.textTheme.titleMedium),
            if (meta.isNotEmpty) const SizedBox(height: 4),
            if (meta.isNotEmpty)
              Text(
                meta,
                style: theme.textTheme.bodySmall?.copyWith(
                  color: theme.colorScheme.onSurfaceVariant,
                ),
              ),
          ],
        ),
        // A rule separates that header from the notes, so a changelog's own
        // first heading cannot read as a continuation of the release name.
        Padding(
          padding: const EdgeInsets.symmetric(vertical: 16),
          child: Divider(
            height: GitPulseStroke.hairline,
            thickness: GitPulseStroke.hairline,
            color: toneRule(theme.colorScheme),
          ),
        ),
        Expanded(
          child: _showingAssets && release.assets.isNotEmpty
              ? _ReleaseAssetList(
                  assets: release.assets,
                  onOpenExternal: widget.onOpenExternal,
                )
              : reading,
        ),
        if (release.assets.isNotEmpty)
          _ReleaseAssetsToggle(
            assets: release.assets,
            expanded: _showingAssets,
            onTap: () => setState(() => _showingAssets = !_showingAssets),
          ),
      ],
    );
  }
}

/// The Release Assets as their own module below the notes: a ruled boundary and
/// one fold row in the section-label type language. It is the way in and the way
/// back, so it never leaves the surface.
///
/// It is deliberately not wrapped in a tonal card: the drawer is already a
/// surface, and nesting a second container inside its padding fights both.
class _ReleaseAssetsToggle extends StatelessWidget {
  const _ReleaseAssetsToggle({
    required this.assets,
    required this.expanded,
    required this.onTap,
  });

  final List<ReleaseAssetDto> assets;
  final bool expanded;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final theme = Theme.of(context);
    final scheme = theme.colorScheme;
    // An unknown size is reported as zero and contributes nothing to the total,
    // and a total of nothing leaves the fold row its count alone.
    final totalSize = gitPulseByteSize(
      context,
      assets.fold<int>(0, (total, asset) => total + asset.size),
    );
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        // A boundary, not a container: 24 of room says the notes have ended, a
        // hairline draws the line, and 16 more keeps the fold row off it.
        Padding(
          padding: const EdgeInsets.only(top: 24, bottom: 16),
          child: Divider(
            height: GitPulseStroke.hairline,
            thickness: GitPulseStroke.hairline,
            color: toneRule(scheme),
          ),
        ),
        MergeSemantics(
          child: Semantics(
            button: true,
            expanded: expanded,
            child: InkWell(
              key: const Key('release-assets'),
              borderRadius: BorderRadius.circular(GitPulseRadius.row),
              onTap: onTap,
              child: Padding(
                padding: const EdgeInsets.symmetric(vertical: 8),
                child: Row(
                  children: [
                    Icon(
                      Icons.attach_file,
                      size: GitPulseIconSize.inline,
                      color: scheme.onSurfaceVariant,
                    ),
                    const SizedBox(width: 8),
                    Expanded(
                      child: Text(
                        totalSize == null
                            ? l10n.releaseAssetCount(assets.length)
                            : l10n.releaseAssetSummary(
                                assets.length,
                                totalSize,
                              ),
                        style: theme.textTheme.labelSmall?.copyWith(
                          color: scheme.onSurfaceVariant,
                          fontWeight: FontWeight.w500,
                          letterSpacing: 0.6,
                        ),
                      ),
                    ),
                    AnimatedRotation(
                      turns: expanded ? .5 : 0,
                      duration: const Duration(milliseconds: 180),
                      child: Icon(
                        Icons.expand_more,
                        size: GitPulseIconSize.inControl,
                        color: scheme.onSurfaceVariant,
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
        ),
      ],
    );
  }
}

/// One row per asset, in the reading area the notes left behind. Rows are
/// separated by breathing room, never by rules: 31 hairlines in a phone-width
/// sheet read as a spreadsheet.
class _ReleaseAssetList extends StatelessWidget {
  const _ReleaseAssetList({required this.assets, required this.onOpenExternal});

  final List<ReleaseAssetDto> assets;
  final Future<bool> Function(String) onOpenExternal;

  @override
  Widget build(BuildContext context) {
    return ListView(
      padding: EdgeInsets.zero,
      children: [
        for (final asset in assets)
          _ReleaseAssetRow(asset: asset, onOpenExternal: onOpenExternal),
      ],
    );
  }
}

/// One Release Asset. The whole row is the download affordance, so nothing
/// occupies the trailing edge and the filename gets every pixel of its width.
class _ReleaseAssetRow extends StatelessWidget {
  const _ReleaseAssetRow({required this.asset, required this.onOpenExternal});

  final ReleaseAssetDto asset;
  final Future<bool> Function(String) onOpenExternal;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final theme = Theme.of(context);
    final scheme = theme.colorScheme;
    final size = gitPulseByteSize(context, asset.size);
    // A row whose download address is not safe keeps its text but offers no
    // action, so it never announces a download it cannot start.
    final downloadUrl =
        safeContentUri(asset.browserDownloadUrl, image: true) == null
        ? null
        : asset.browserDownloadUrl;
    return MergeSemantics(
      child: Semantics(
        button: downloadUrl != null,
        hint: downloadUrl == null ? null : l10n.releaseDownload,
        child: InkWell(
          borderRadius: BorderRadius.circular(GitPulseRadius.row),
          onTap: downloadUrl == null ? null : () => onOpenExternal(downloadUrl),
          child: Padding(
            padding: const EdgeInsets.symmetric(vertical: 8),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Padding(
                  padding: const EdgeInsets.only(top: 1),
                  child: Icon(
                    _releaseAssetGlyph(asset.name),
                    size: GitPulseIconSize.inline,
                    color: scheme.onSurfaceVariant,
                  ),
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      // The filename is the only name shown and it is never
                      // ellipsised: `x86_64` against `arm64`, `.zip` against
                      // `.zip.minisig`, is exactly what the reader is looking
                      // for. Do not add a line limit or an overflow here.
                      Text(
                        asset.name,
                        style: theme.textTheme.bodySmall?.copyWith(
                          color: scheme.onSurface,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                      const SizedBox(height: 2),
                      Text(
                        [
                          ?size,
                          l10n.releaseAssetDownloads(asset.downloadCount),
                        ].join(' · '),
                        style: theme.textTheme.labelSmall?.copyWith(
                          color: scheme.onSurfaceVariant,
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

/// The glyph naming what kind of file a Release Asset is, read from its name.
///
/// A closed set plus one fallback: a reader only needs to tell an installer from
/// a checksum before tapping, and a glyph per extension would be noise.
IconData _releaseAssetGlyph(String name) {
  final parts = name.split('.');
  final extension = parts.length > 1 ? parts.last.toLowerCase() : '';
  return switch (extension) {
    'zip' ||
    'tar' ||
    'gz' ||
    'tgz' ||
    'bz2' ||
    'xz' ||
    '7z' ||
    'rar' => Icons.folder_zip_outlined,
    'exe' ||
    'msi' ||
    'dmg' ||
    'pkg' ||
    'deb' ||
    'rpm' ||
    'apk' ||
    'appimage' => Icons.install_desktop_outlined,
    'sig' ||
    'minisig' ||
    'asc' ||
    'md5' ||
    'sha1' ||
    'sha256' ||
    'sha512' => Icons.verified_user_outlined,
    _ => Icons.description_outlined,
  };
}
