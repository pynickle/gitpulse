import 'package:flutter/material.dart';

import '../l10n/generated/app_localizations.dart';
import '../presentation/gitpulse_formatting.dart';
import '../presentation/gitpulse_tokens.dart';
import 'document_content.dart';
import 'release_detail_dto.dart';
import 'release_detail_service.dart';
import 'release_document.dart';

/// How long the Release Assets module takes to rise over the notes.
///
/// The app's one speed for handing a whole reading area over to something else
/// — gitPulseDestinationTransition, which a destination switch travels by —
/// rather than the shorter turn a control inside a surface takes: this module
/// covers the notes, and the fold row's chevron turns on this same clock
/// instead of the 180ms it used to turn on alone, so the row cannot finish
/// saying "open" before the module has arrived (ADR 0035).
const gitPulseAssetsReveal = Duration(milliseconds: 220);

/// How long the module takes to fold back onto the row that opened it.
///
/// Shorter than the way in: an arrival has to be read, a departure only has to
/// get out of the way. The module's own movement runs the arrival's curve in
/// reverse, so it starts slowly and accelerates away instead of easing to a
/// stop on a list nobody is reading any more, and the chevron turns on this
/// shorter clock rather than outliving the module it points at.
const gitPulseAssetsFold = Duration(milliseconds: 140);

/// The one curve the module is made of: fast enough to answer the tap, slow
/// enough at the end to settle.
const gitPulseAssetsRevealCurve = Curves.easeOutCubic;

/// The reading body of the Release Drawer: offline notice, the release's name,
/// one quiet meta line, the notes, and the Release Assets. The drawer's chrome
/// line owns the release identity and every action that leaves the notes — the
/// repository page, the Repository Release List, GitHub and close — so nothing
/// here competes with the notes for the top of the surface.
///
/// The notes are the one scroller in this body: a document is shown by a
/// WebView, which keeps the gestures that land on it, so the chrome above it and
/// the Release Assets row below it stay put while the document scrolls. Opening
/// the assets lifts them over the reading area rather than stacking a second
/// scroller under the document, and the notes stay mounted beneath them, so the
/// reader comes back to the same rendered page at the same place (ADR 0035).
class ReleaseDetailsView extends StatefulWidget {
  const ReleaseDetailsView({
    super.key,
    required this.release,
    required this.onTapUrl,
    required this.onOpenExternal,
    this.headerBuilder,
  });

  final ReleaseDetail release;
  final Future<bool> Function(String) onTapUrl;
  final Future<bool> Function(String) onOpenExternal;
  final Widget Function(Widget child)? headerBuilder;

  @override
  State<ReleaseDetailsView> createState() => _ReleaseDetailsViewState();
}

class _ReleaseDetailsViewState extends State<ReleaseDetailsView>
    with SingleTickerProviderStateMixin {
  /// Whether the reader has the Release Assets module open.
  bool _assetsOpen = false;

  /// Whether the module is on screen at all. It stays mounted from the tap that
  /// opens it until it has settled back onto its fold row, so the notes are
  /// never seen through a list on its way out.
  bool _assetsOnScreen = false;

  late final AnimationController _assets;

  /// The module's own progress: the controller, curved once, so the way in and
  /// the way out are one movement rather than two.
  late final CurvedAnimation _assetsProgress;

  @override
  void initState() {
    super.initState();
    _assets = AnimationController(vsync: this, duration: gitPulseAssetsReveal)
      ..addStatusListener(_settleAssets);
    _assetsProgress = CurvedAnimation(
      parent: _assets,
      curve: gitPulseAssetsRevealCurve,
    );
  }

  @override
  void dispose() {
    _assetsProgress.dispose();
    _assets.dispose();
    super.dispose();
  }

  /// How long the module takes to answer a tap for this reader, on the way in
  /// or on the way out.
  Duration _assetsTurn({required bool open}) =>
      MediaQuery.disableAnimationsOf(context)
      ? Duration.zero
      : open
      ? gitPulseAssetsReveal
      : gitPulseAssetsFold;

  /// Drops the module once it has finished leaving, so the reading area holds
  /// one of the two at rest exactly as it did before either could move.
  void _settleAssets(AnimationStatus status) {
    if (status != AnimationStatus.dismissed ||
        _assetsOpen ||
        !_assetsOnScreen) {
      return;
    }
    setState(() => _assetsOnScreen = false);
  }

  /// The curve the fold row's chevron turns by: the module's own curve, and the
  /// same curve mirrored on the way out, so the chevron closes at the speed the
  /// module leaves instead of easing shut while the module is still on screen.
  Curve _assetsTurnCurve({required bool open}) =>
      open ? gitPulseAssetsRevealCurve : gitPulseAssetsRevealCurve.flipped;

  /// Opens or folds the module. A reader who asked for reduced motion gets the
  /// module, not the crossing.
  void _toggleAssets() {
    final open = !_assetsOpen;
    _assets.duration = _assetsTurn(open: open);
    setState(() {
      _assetsOpen = open;
      if (open) _assetsOnScreen = true;
    });
    if (open) {
      _assets.forward();
    } else {
      _assets.reverse();
    }
  }

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
            documentIdentity:
                'release:${release.owner}/${release.repository}/${release.dto.id}',
            document: RepositoryDocumentContext(
              owner: release.owner,
              repository: release.repository,
              ref: release.tag,
            ),
            onTapUrl: widget.onTapUrl,
          );
    final header = Padding(
      padding: const EdgeInsets.fromLTRB(20, 20, 20, 0),
      child: Column(
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
              SelectableText(
                release.title,
                style: gitPulseTypeSurfaceTitle(context),
              ),
              if (meta.isNotEmpty) const SizedBox(height: 4),
              if (meta.isNotEmpty) Text(meta, style: gitPulseTypeMeta(context)),
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
        ],
      ),
    );
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        widget.headerBuilder?.call(header) ?? header,
        Expanded(
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 20),
            // The notes keep their element under the module — the reason the
            // drawer keeps a document behind its Repository Release List — so a
            // folded module returns to the page the reader left instead of
            // rendering the document again, and the module has a lit surface to
            // settle back onto while it leaves.
            child: Stack(
              fit: StackFit.expand,
              children: [
                ExcludeSemantics(excluding: _assetsOnScreen, child: reading),
                if (_assetsOnScreen && release.assets.isNotEmpty)
                  _ReleaseAssetsReveal(
                    progress: _assetsProgress,
                    child: Material(
                      // The module stands on the sheet's own surface, so its
                      // fill is invisible and it is the module's ink — not a
                      // colour above it — that answers a press (ADR 0019).
                      color: toneSurface(context),
                      child: _ReleaseAssetList(
                        assets: release.assets,
                        onOpenExternal: widget.onOpenExternal,
                      ),
                    ),
                  ),
              ],
            ),
          ),
        ),
        Padding(
          padding: const EdgeInsets.fromLTRB(20, 0, 20, 20),
          child: release.assets.isNotEmpty
              ? _ReleaseAssetsToggle(
                  assets: release.assets,
                  expanded: _assetsOpen,
                  turn: _assetsTurn(open: _assetsOpen),
                  turnCurve: _assetsTurnCurve(open: _assetsOpen),
                  onTap: _toggleAssets,
                )
              : const SizedBox.shrink(),
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
    required this.turn,
    required this.turnCurve,
    required this.onTap,
  });

  final List<ReleaseAssetDto> assets;
  final bool expanded;

  /// How long the module takes to answer the tap, decided by the body that owns
  /// both halves: the chevron turns for exactly as long as the module travels,
  /// by the same curve.
  final Duration turn;
  final Curve turnCurve;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
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
            color: toneRule(Theme.of(context).colorScheme),
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
                      color: toneTextMuted(context),
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
                        style: gitPulseTypeSectionLabel(context),
                      ),
                    ),
                    AnimatedRotation(
                      turns: expanded ? .5 : 0,
                      duration: turn,
                      curve: turnCurve,
                      child: Icon(
                        Icons.expand_more,
                        size: GitPulseIconSize.inControl,
                        color: toneTextMuted(context),
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

/// The module as it arrives over the notes and as it folds away again.
///
/// It rises [GitPulseMotion.assetsRevealShift] and fades in, both of them paint
/// only, so the reading area neither re-lays out nor scrolls beneath it. The
/// notes are only ever drawn over — never faded or moved — because an opacity
/// layer over a platform view is the path ADR 0029 keeps closed: what fades here
/// holds no platform view at all.
class _ReleaseAssetsReveal extends StatelessWidget {
  const _ReleaseAssetsReveal({required this.progress, required this.child});

  /// How far into standing on the reading area the module is: 0 one registered
  /// rise below its own resting place, 1 in place.
  final Animation<double> progress;

  final Widget child;

  @override
  Widget build(BuildContext context) => AnimatedBuilder(
    animation: progress,
    child: child,
    builder: (context, child) => AbsorbPointer(
      // Only a module that has come to rest answers a tap. On the way in it is
      // still see-through and on the way out it is already going away, and a
      // row that can be hit either time starts a download nobody asked for. The
      // notes beneath are given nothing either, so a moving module cannot pass
      // its gestures through to them.
      absorbing: progress.value < 1,
      child: Opacity(
        opacity: progress.value,
        child: Transform.translate(
          offset: Offset(
            0,
            GitPulseMotion.assetsRevealShift * (1 - progress.value),
          ),
          child: child,
        ),
      ),
    ),
  );
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
                    color: toneTextMuted(context),
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
