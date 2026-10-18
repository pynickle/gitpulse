import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../l10n/generated/app_localizations.dart';
import 'document_content.dart';
import 'release_detail_service.dart';
import 'release_document.dart';

class ReleaseDetailsView extends StatelessWidget {
  const ReleaseDetailsView({
    super.key,
    required this.release,
    required this.onTapUrl,
    required this.onOpenExternal,
    this.onOpenReleases,
  });

  final ReleaseDetail release;
  final Future<bool> Function(String) onTapUrl;
  final Future<bool> Function(String) onOpenExternal;
  final VoidCallback? onOpenReleases;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final theme = Theme.of(context);
    final repositoryUrl = Uri.https(
      'github.com',
      '/${release.owner}/${release.repository}',
    );
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Align(
          alignment: Alignment.centerLeft,
          child: TextButton(
            onPressed: () => onTapUrl(repositoryUrl.toString()),
            child: Text('${release.owner}/${release.repository}'),
          ),
        ),
        if (onOpenReleases != null)
          Align(
            alignment: Alignment.centerLeft,
            child: TextButton.icon(
              onPressed: onOpenReleases,
              icon: const Icon(Icons.list_alt),
              label: Text(l10n.repositoryReleasesTitle),
            ),
          ),
        SelectableText(release.title, style: theme.textTheme.headlineSmall),
        const SizedBox(height: 8),
        Wrap(
          spacing: 8,
          runSpacing: 4,
          children: [
            Chip(label: Text(release.tag)),
            if (release.dto.prerelease)
              Chip(label: Text(l10n.timelinePrerelease)),
            if (release.dto.draft) Chip(label: Text(l10n.releaseDraft)),
            if (release.dto.author case final author?)
              Chip(label: Text(author.login)),
          ],
        ),
        if (release.publishedAt case final date?)
          Padding(
            padding: const EdgeInsets.symmetric(vertical: 8),
            child: Text(
              DateFormat.yMMMd(Localizations.localeOf(context).toLanguageTag())
                  .add_jm()
                  .format(date.toLocal()),
            ),
          ),
        const SizedBox(height: 12),
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
        const Divider(height: 32),
        Text(
          l10n.timelineAssetCount(release.assets.length),
          style: theme.textTheme.titleMedium,
        ),
        const SizedBox(height: 8),
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
                  DateFormat.yMMMd(
                    Localizations.localeOf(context).toLanguageTag(),
                  ).format(date.toLocal()),
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
        Align(
          alignment: Alignment.centerLeft,
          child: TextButton.icon(
            onPressed: () => onOpenExternal(release.dto.htmlUrl),
            icon: const Icon(Icons.open_in_new),
            label: Text(l10n.releaseOpenOnGitHub),
          ),
        ),
      ],
    );
  }
}
