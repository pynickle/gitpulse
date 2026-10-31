import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../l10n/generated/app_localizations.dart';
import '../presentation/gitpulse_buttons.dart';
import '../presentation/gitpulse_formatting.dart';
import '../presentation/gitpulse_state_views.dart';
import '../presentation/gitpulse_tokens.dart';
import '../session/session_controller.dart';
import '../session/session_notice.dart';
import 'document_content.dart';
import 'release_detail_dto.dart';
import 'release_detail_service.dart';
import 'release_link.dart';
import 'release_navigation.dart';

/// One release's Release Assets, as a screen of their own.
///
/// The row under a release's notes is the way in, and this is what it opens
/// (ADR 0039): every asset of the release, named and sized as GitHub names it,
/// with the whole row being the download. It is a page rather than a module
/// rising over the notes, because a list that has to be scrolled beside a
/// document that also scrolls is two gestures in one place; and it is reached
/// from the release it belongs to, so Back returns to those notes rather than
/// closing the release.
class ReleaseAssetsScreen extends ConsumerWidget {
  const ReleaseAssetsScreen({
    super.key,
    required this.owner,
    required this.repository,
    this.id,
    this.tag,
  });

  final String owner;
  final String repository;
  final int? id;
  final String? tag;

  ReleaseTarget get target =>
      (owner: owner, repository: repository, id: id, tag: tag);

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = AppLocalizations.of(context);
    final session = ref.watch(sessionControllerProvider);
    final result = ref.watch(releaseDetailProvider(target));
    if (session.phase != SessionPhase.signedIn) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (context.mounted) closeReleases(context, ref);
      });
      return const SizedBox.shrink();
    }
    final release = result.value?.release;
    return PopScope(
      // Back from the assets is back to the release, and the release's own
      // routes leave releases altogether: the two are separate on purpose, so a
      // reader who is done with a release's files is not sent home before
      // closing the release itself.
      canPop: true,
      child: Scaffold(
        appBar: AppBar(
          title: Text(
            release == null
                ? l10n.releaseAssetsTitle
                : l10n.releaseAssetsOf(release.title),
          ),
          automaticallyImplyLeading: false,
          actions: [
            GitPulseIconButton(
              label: l10n.navigationBack,
              icon: const Icon(Icons.arrow_back),
              onPressed: () => Navigator.of(context).maybePop(),
            ),
            GitPulseIconButton(
              label: l10n.navigationHome,
              icon: const Icon(Icons.home_outlined),
              onPressed: () => closeReleases(context, ref),
            ),
          ],
        ),
        body: SafeArea(
          child: Column(
            children: [
              const SessionNotice(),
              Expanded(
                child: result.when(
                  skipLoadingOnRefresh: false,
                  loading: () =>
                      GitPulseLoadingView(label: l10n.releaseLoading),
                  error: (error, stack) => _AssetsUnavailable(
                    onRetry: () =>
                        ref.invalidate(releaseDetailProvider(target)),
                  ),
                  data: (data) => data.release == null
                      ? _AssetsUnavailable(
                          onRetry: () =>
                              ref.invalidate(releaseDetailProvider(target)),
                        )
                      : _ReleaseAssetList(
                          assets: data.release!.assets,
                          onOpenExternal: (url) => openReleaseLink(
                            context,
                            ref,
                            url,
                            external: true,
                          ),
                        ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _AssetsUnavailable extends StatelessWidget {
  const _AssetsUnavailable({required this.onRetry});

  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    return GitPulseMessageView(
      icon: Icons.error_outline,
      tone: GitPulseMessageTone.error,
      liveRegion: true,
      title: l10n.releaseFailed,
      action: GitPulseButton(
        label: l10n.timelineRetry,
        variant: GitPulseButtonVariant.tonal,
        onPressed: onRetry,
      ),
    );
  }
}

/// One row per asset, in the reading area the notes left behind. Rows are
/// separated by breathing room, never by rules: 31 hairlines in a phone-width
/// page read as a spreadsheet.
class _ReleaseAssetList extends StatelessWidget {
  const _ReleaseAssetList({required this.assets, required this.onOpenExternal});

  final List<ReleaseAssetDto> assets;
  final Future<bool> Function(String) onOpenExternal;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    if (assets.isEmpty) {
      return GitPulseMessageView(
        icon: Icons.attach_file,
        title: l10n.releaseAssetsEmpty,
      );
    }
    return ListView(
      padding: const EdgeInsets.symmetric(
        horizontal: 20,
        vertical: GitPulseSpace.inline,
      ),
      children: [
        for (final asset in assets)
          _ReleaseAssetRow(asset: asset, onOpenExternal: onOpenExternal),
      ],
    );
  }
}

/// The glyph naming what kind of file a Release Asset is, read from its name.
///
/// A closed set plus one fallback: a reader only needs to tell an installer from
/// a checksum before tapping, and a glyph per extension would be noise.
IconData releaseAssetGlyph(String name) {
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

/// One Release Asset. The whole row is the download affordance, so nothing
/// occupies the trailing edge and the filename gets every pixel of its width.
class _ReleaseAssetRow extends StatelessWidget {
  const _ReleaseAssetRow({required this.asset, required this.onOpenExternal});

  final ReleaseAssetDto asset;
  final Future<bool> Function(String) onOpenExternal;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
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
                    releaseAssetGlyph(asset.name),
                    size: GitPulseIconSize.inline,
                    color: toneTextMuted(context),
                  ),
                ),
                const SizedBox(width: GitPulseSpace.inline),
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
                        style: gitPulseTypeMeta(context)?.copyWith(
                          color: toneText(context),
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                      const SizedBox(height: 2),
                      Text(
                        [
                          ?size,
                          l10n.releaseAssetDownloads(asset.downloadCount),
                        ].join(' · '),
                        style: gitPulseTypeMetaTight(context),
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
