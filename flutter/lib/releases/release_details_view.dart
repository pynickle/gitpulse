import 'package:flutter/material.dart';

import '../l10n/generated/app_localizations.dart';
import '../presentation/gitpulse_buttons.dart';
import '../presentation/gitpulse_formatting.dart';
import '../presentation/gitpulse_release_artist.dart';
import '../presentation/gitpulse_status_badge.dart';
import '../presentation/gitpulse_tokens.dart';
import 'document_content.dart';
import 'release_detail_dto.dart';
import 'release_detail_service.dart';
import 'release_document.dart';

/// One Release, read as content: the header that says which release this is, the
/// notes, and the row that leads to the Release Assets.
///
/// The layout is the web Release Drawer's, in the client's own vocabulary: a tag
/// line with the prerelease pill beside it, the release's name beneath it, the
/// line that signs it — author, how long ago, and the way out to GitHub — and
/// then the notes after a rule. Author, publish time and state are parts of one
/// line rather than a meta sentence, because that is how the web app introduces a
/// release and how a reader of both clients learns it once.
///
/// This body owns no chrome and no scroller. The header is handed to
/// [headerBuilder] and the Release Assets row to [footerBuilder], so the host can
/// lay both inside its own scroll view above and below the notes: a platform view
/// inside a scrollable answers only its own gestures, so anything that must move
/// with the notes has to be part of the same scroll owner (ADR 0028, ADR 0039).
///
/// The notes keep every gesture that lands on them — a document is selected,
/// panned and scrolled by its own renderer — so a host's sideways shortcut is
/// offered around the header it builds here rather than over the reading area.
class ReleaseDetailsView extends StatefulWidget {
  const ReleaseDetailsView({
    super.key,
    required this.release,
    required this.onTapUrl,
    required this.onOpenExternal,
    required this.onSwipeNotes,
    required this.headerBuilder,
    required this.footerBuilder,
    required this.onViewAllAssets,
  });

  final ReleaseDetail release;
  final Future<bool> Function(String) onTapUrl;
  final Future<bool> Function(String) onOpenExternal;

  /// A sideways flick the notes read for themselves: the page owns its own
  /// scrolling, so the document reports what it saw rather than being wrapped.
  final void Function(bool left) onSwipeNotes;

  /// Places the release header in the host's scroll view.
  final Widget Function(Widget header) headerBuilder;

  /// Places the Release Assets row at the end of the host's scroll view.
  final Widget Function(Widget footer) footerBuilder;

  /// Opens the Release Assets as the screen they are on.
  final VoidCallback onViewAllAssets;

  @override
  State<ReleaseDetailsView> createState() => _ReleaseDetailsViewState();
}

class _ReleaseDetailsViewState extends State<ReleaseDetailsView> {
  @override
  Widget build(BuildContext context) {
    final release = widget.release;
    final l10n = AppLocalizations.of(context);
    final theme = Theme.of(context);
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
            onSwipe: widget.onSwipeNotes,
          );
    final header = Padding(
      padding: const EdgeInsets.fromLTRB(20, 16, 20, 0),
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
                  // A saved copy has no author line to say when the release
                  // landed, so the date is stated here instead — the same words
                  // the header's line uses.
                  if (release.publishedAt case final publishedAt?)
                    Text(
                      l10n.releasePublished(
                        gitPulseDateTime(context, publishedAt.toLocal()),
                      ),
                    ),
                  if (release.savedAt case final savedAt?)
                    Text(
                      l10n.timelineSavedAt(
                        gitPulseDateTime(context, savedAt.toLocal()),
                      ),
                    ),
                ],
              ),
            ),
          _ReleaseHeader(
            release: release,
            onOpenGitHub: () => widget.onOpenExternal(release.dto.htmlUrl),
          ),
          Padding(
            // The rule is the header's own last line: 16 of air above it, and
            // the notes' padding is what stands under it. Nothing on this side
            // of the rule, so the line divides the header from the notes rather
            // than opening a band of page.
            padding: const EdgeInsets.only(top: GitPulseSpace.gutter),
            child: Divider(
              height: GitPulseStroke.hairline,
              thickness: GitPulseStroke.hairline,
              color: toneRule(theme.colorScheme),
            ),
          ),
        ],
      ),
    );
    final assets = release.assets;
    final footer = assets.isEmpty
        ? const SizedBox.shrink()
        : Padding(
            padding: const EdgeInsets.fromLTRB(20, 0, 20, 20),
            child: _ReleaseAssetsRow(
              assets: assets,
              onTap: widget.onViewAllAssets,
            ),
          );
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        widget.headerBuilder(header),
        Expanded(
          child: Padding(
            // The notes' first line starts just under the rule. The document
            // itself carries no top inset (its stylesheet zeroes it), so the
            // distance between the boundary and the prose is stated here — a
            // hairline followed immediately by the changelog, rather than a
            // band of empty page between the two.
            padding: const EdgeInsets.fromLTRB(20, GitPulseSpace.inline, 20, 0),
            child: reading,
          ),
        ),
        widget.footerBuilder(footer),
      ],
    );
  }
}

/// The release's identity, as the web Release Drawer opens it.
///
/// The tag line first, because a release is a version before it is anything
/// else; then the release's own name, which stays even when it repeats the tag,
/// because it is the author's title rather than the version's; then the line
/// that signs it.
class _ReleaseHeader extends StatelessWidget {
  const _ReleaseHeader({required this.release, required this.onOpenGitHub});

  final ReleaseDetail release;
  final VoidCallback onOpenGitHub;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Wrap(
          spacing: GitPulseSpace.inline,
          runSpacing: GitPulseSpace.tight,
          crossAxisAlignment: WrapCrossAlignment.center,
          children: [
            _ReleaseTagLine(tag: release.tag),
            if (release.dto.prerelease || release.dto.draft)
              GitPulseStatusBadge(
                icon: Icons.science_outlined,
                label: release.dto.draft
                    ? l10n.releaseDraft
                    : l10n.timelinePrerelease,
              ),
          ],
        ),
        const SizedBox(height: GitPulseSpace.inline),
        SelectableText(release.title, style: gitPulseTypePageTitle(context)),
        const SizedBox(height: GitPulseSpace.inline),
        _ReleaseSigningLine(release: release, onOpenGitHub: onOpenGitHub),
      ],
    );
  }
}

/// The tag a release is named by: GitHub's tag glyph and the tag itself, in the
/// tone a supporting line reads.
class _ReleaseTagLine extends StatelessWidget {
  const _ReleaseTagLine({required this.tag});

  final String tag;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    return Semantics(
      label: l10n.releaseTagged(tag),
      child: ExcludeSemantics(
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(
              Icons.sell_outlined,
              size: GitPulseIconSize.fact,
              color: toneTextMuted(context),
            ),
            const SizedBox(width: GitPulseSpace.glyphGap),
            Flexible(
              child: Text(
                tag,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: gitPulseTypeEyebrow(context),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// The line under the release's name: its author and how long ago it landed, and
/// the way out to GitHub at the end of it.
///
/// The GitHub action sits here rather than in a row of its own because that is
/// where a reader looks for the release they are reading: the line already names
/// it as somebody's, and the way to it on GitHub is the same sentence's last
/// word. It is drawn as a quiet mark rather than as a tinted control so the line
/// stays one line of authorship, and its own semantics name it — the mark is the
/// only ink it draws.
class _ReleaseSigningLine extends StatelessWidget {
  const _ReleaseSigningLine({
    required this.release,
    required this.onOpenGitHub,
  });

  final ReleaseDetail release;
  final VoidCallback onOpenGitHub;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final author = release.dto.author;
    final relative = release.publishedAt == null
        ? null
        : gitPulseRelativeTime(context, release.publishedAt!.toLocal());
    return Row(
      children: [
        if (author != null)
          Expanded(
            child: GitPulseReleaseArtist(
              login: author.login,
              avatarUrl: null,
              publishedAt: relative,
            ),
          )
        else ...[
          if (relative != null)
            Expanded(
              child: Row(
                children: [
                  Icon(
                    Icons.calendar_today_outlined,
                    size: GitPulseIconSize.fact,
                    color: toneTextMuted(context),
                  ),
                  const SizedBox(width: GitPulseSpace.dense),
                  Flexible(
                    child: Text(
                      l10n.releasePublished(relative),
                      style: gitPulseTypeMeta(context),
                    ),
                  ),
                ],
              ),
            ),
          if (relative == null) const Spacer(),
        ],
        GitPulseIconButton(
          label: l10n.releaseOpenOnGitHub,
          icon: const Icon(Icons.code),
          dimension: GitPulseHeight.compact,
          onPressed: onOpenGitHub,
        ),
      ],
    );
  }
}

/// The way into a release's Release Assets, under its notes: a ruled boundary
/// and one row in the section-label type language.
///
/// It is deliberately not wrapped in a tonal card: the release is already a
/// surface, and nesting a second container inside its padding fights both.
class _ReleaseAssetsRow extends StatelessWidget {
  const _ReleaseAssetsRow({required this.assets, required this.onTap});

  final List<ReleaseAssetDto> assets;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    // An unknown size is reported as zero and contributes nothing to the total,
    // and a total of nothing leaves the row its count alone.
    final totalSize = gitPulseByteSize(
      context,
      assets.fold<int>(0, (total, asset) => total + asset.size),
    );
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        // A boundary, not a container: 24 of room says the notes have ended, a
        // hairline draws the line, and 16 more keeps the row off it.
        Padding(
          padding: const EdgeInsets.only(top: 24, bottom: 16),
          child: Divider(
            height: GitPulseStroke.hairline,
            thickness: GitPulseStroke.hairline,
            color: toneRule(Theme.of(context).colorScheme),
          ),
        ),
        // The row's words are the count and the total; its name is what the
        // reader is being offered. The two are merged, so a screen reader reads
        // one control rather than a number floating beside a button.
        MergeSemantics(
          child: Semantics(
            button: true,
            label: l10n.releaseAssetsViewAll,
            child: InkWell(
              key: const Key('release-assets'),
              borderRadius: BorderRadius.circular(GitPulseRadius.row),
              onTap: onTap,
              child: Padding(
                padding: const EdgeInsets.symmetric(vertical: 8),
                child: Row(
                  children: [
                    ExcludeSemantics(
                      child: Icon(
                        Icons.attach_file,
                        size: GitPulseIconSize.inline,
                        color: toneTextMuted(context),
                      ),
                    ),
                    const SizedBox(width: GitPulseSpace.inline),
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
                    ExcludeSemantics(
                      child: Icon(
                        Icons.chevron_right,
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
