import 'package:flutter/material.dart';

import '../l10n/generated/app_localizations.dart';
import '../presentation/gitpulse_formatting.dart';
import 'document_content.dart';
import 'release_detail_service.dart';
import 'release_document.dart';

/// The reading body of the Release Drawer: offline notice, the release's name,
/// one quiet meta line, the notes, and the assets. The drawer's chrome line
/// owns the release identity and every action that leaves the notes — the
/// repository page, the Repository Release List, GitHub and close — so nothing
/// here competes with the notes for the top of the surface.
class ReleaseDetailsView extends StatelessWidget {
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
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final theme = Theme.of(context);
    final meta = [
      if (release.publishedAt case final date?)
        gitPulseDateTime(context, date.toLocal()),
      if (release.dto.author case final author?) author.login,
      if (release.dto.prerelease) l10n.timelinePrerelease,
      if (release.dto.draft) l10n.releaseDraft,
    ].join(' · ');
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
        const Padding(
          padding: EdgeInsets.symmetric(vertical: 16),
          child: Divider(height: 1),
        ),
        if (release.body.isEmpty)
          Text(l10n.releaseNoNotes)
        else
          ReleaseDocument(
            source: release.body,
            document: RepositoryDocumentContext(
              owner: release.owner,
              repository: release.repository,
              ref: release.tag,
            ),
            onTapUrl: onTapUrl,
          ),
        if (release.assets.isNotEmpty)
          _ReleaseAssets(release: release, onOpenExternal: onOpenExternal),
      ],
    );
  }
}

/// The release's assets collapsed into one row, so a release with dozens of
/// them does not bury the end of the notes. Expansion reveals the downloads and
/// the note that asset information is only current for this request.
class _ReleaseAssets extends StatelessWidget {
  const _ReleaseAssets({required this.release, required this.onOpenExternal});

  final ReleaseDetail release;
  final Future<bool> Function(String) onOpenExternal;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final theme = Theme.of(context);
    return ExpansionTile(
      key: const Key('release-assets'),
      tilePadding: EdgeInsets.zero,
      childrenPadding: EdgeInsets.zero,
      shape: const Border(),
      collapsedShape: const Border(),
      title: Text(
        l10n.timelineAssetCount(release.assets.length),
        style: theme.textTheme.titleSmall,
      ),
      children: [
        for (final asset in release.assets)
          ListTile(
            contentPadding: EdgeInsets.zero,
            title: Text(
              asset.label?.isNotEmpty == true
                  ? '${asset.label} (${asset.name})'
                  : asset.name,
            ),
            subtitle: Text(
              [
                l10n.releaseAssetMetadata(asset.size, asset.downloadCount),
                if (asset.contentType?.isNotEmpty == true) asset.contentType!,
                if (asset.updatedAt case final date?)
                  gitPulseDay(context, date.toLocal()),
              ].join(' · '),
            ),
            trailing:
                safeContentUri(asset.browserDownloadUrl, image: true) == null
                ? null
                : IconButton(
                    tooltip: l10n.releaseDownload,
                    onPressed: () => onOpenExternal(asset.browserDownloadUrl),
                    icon: const Icon(Icons.open_in_new),
                  ),
          ),
        Text(l10n.releaseAssetsOnline, style: theme.textTheme.bodySmall),
      ],
    );
  }
}
