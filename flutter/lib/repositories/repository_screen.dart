import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../follows/release_follows_session.dart';
import '../follows/release_follows_widgets.dart';
import '../l10n/generated/app_localizations.dart';
import '../presentation/gitpulse_avatar.dart';
import '../presentation/gitpulse_buttons.dart';
import '../presentation/gitpulse_formatting.dart';
import '../presentation/gitpulse_language_colors.dart';
import '../presentation/gitpulse_setting_rows.dart';
import '../presentation/gitpulse_state_views.dart';
import '../presentation/gitpulse_tokens.dart';
import '../releases/document_content.dart';
import '../releases/release_document.dart';
import '../session/session_controller.dart';
import '../session/session_notice.dart';
import '../settings/account_gate.dart';
import 'repository_models.dart';
import 'repository_dto.dart';
import 'repository_navigation.dart';
import 'repository_service.dart';
import 'repository_share.dart';

/// The page gutter: the 16 that a Timeline, Follows, and Settings row all start
/// at, so this page's bands line up with the rest of the app.
const _gutter = gitPulseSettingsGutter;

/// The width the page stops growing at.
///
/// A repository page is read, not scanned: its README is prose, and a measure
/// much longer than this one is a measure the eye loses its place in. Documents
/// that need width — tables, code — still fit inside it.
const _maximumContentWidth = GitPulseWidth.readingMeasure;

/// The space between two facts on the identity band's data line.
///
/// The mark and gap inside one fact — a fact glyph and a few pixels of air —
/// are the ones the Repository Release List rows already draw, so a fact looks
/// the same on both pages; the gap between facts is the one a Follows row's
/// metadata line uses.
const _factGap = GitPulseSpace.factGap;
const _factIconExtent = GitPulseIconSize.fact;

/// The air between a fact's glyph and its number: an optical nudge that only
/// this line needs, so it stays a named local rather than a shared role.
const _factIconGap = 3.0;

/// The Repository detail page: who the repository is, the one line of numbers
/// that describes it, the three things a reader does about it, and its README.
///
/// The page is a column of bands on the gutter the Timeline, Follows, and
/// Settings pages share, capped at a reading width instead of stretching across
/// the whole window. It leads with the repository's identity rather than with a
/// bar naming the page, and its data line carries a glyph per number, so the
/// page never says "Repository" or "Stars" out loud to a reader who can see
/// them. The words a screen reader needs live in the semantics of each fact.
class RepositoryScreen extends ConsumerStatefulWidget {
  const RepositoryScreen({
    super.key,
    required this.owner,
    required this.repository,
  });
  final String owner;
  final String repository;
  @override
  ConsumerState<RepositoryScreen> createState() => _RepositoryScreenState();
}

class _RepositoryScreenState extends ConsumerState<RepositoryScreen> {
  final _opening = Object();

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final session = ref.watch(sessionControllerProvider);
    final RepositoryScope scope = (
      owner: widget.owner,
      repository: widget.repository,
      opening: _opening,
    );
    final result = ref.watch(repositoryProvider(scope));
    void retry() => ref.invalidate(repositoryProvider(scope));
    return Scaffold(
      // The identity band opens with the repository's name, so the bar above it
      // carries navigation alone.
      appBar: const RepositoryPageAppBar(),
      body: SafeArea(
        child: Column(
          children: [
            // Signed out, the account panel below states the session's trouble;
            // drawing it here as well would print the same line twice.
            if (session.phase == SessionPhase.signedIn) const SessionNotice(),
            Expanded(
              child: session.phase != SessionPhase.signedIn
                  ? const AccountGate()
                  : result.when(
                      skipLoadingOnRefresh: false,
                      loading: () =>
                          GitPulseLoadingView(label: l10n.repositoryLoading),
                      error: (_, _) => RepositoryFailureView(
                        failure: RepositoryFailure.server,
                        onRetry: retry,
                      ),
                      data: (data) => data.value == null
                          ? RepositoryFailureView(
                              failure: data.failure!,
                              onRetry: retry,
                            )
                          : _RepositoryBands(
                              repository: data.value!,
                              opening: _opening,
                            ),
                    ),
            ),
          ],
        ),
      ),
    );
  }
}

/// The page's content: the identity band, the rule that closes it, and the
/// README beneath it.
class _RepositoryBands extends StatelessWidget {
  const _RepositoryBands({required this.repository, required this.opening});

  final RepositoryDto repository;
  final Object opening;

  @override
  Widget build(BuildContext context) {
    return Align(
      alignment: Alignment.topCenter,
      child: ConstrainedBox(
        constraints: const BoxConstraints(maxWidth: _maximumContentWidth),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            _Identity(repository: repository),
            // The same full-width rule that closes a Settings band: one line
            // from edge to edge is what says the identity is over.
            const GitPulseSettingsDivider(indent: 0),
            // The README is a document shown by a WebView: it keeps the gestures
            // that land on it and scrolls itself, so the identity above it stays
            // put instead of sharing one scroll owner with a platform view.
            Expanded(
              child: _Readme(repository: repository, opening: opening),
            ),
          ],
        ),
      ),
    );
  }
}

/// Who the repository is, and the three things a reader does about it.
///
/// The owner's picture and name say who, the repository's own name says which
/// one, and the description says what. Below them a data line puts a glyph where
/// a noun would go, and last come the page's actions, on one row at every width.
class _Identity extends StatelessWidget {
  const _Identity({required this.repository});

  final RepositoryDto repository;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final description = repository.description?.trim();
    return Padding(
      padding: const EdgeInsets.fromLTRB(_gutter, 16, _gutter, 16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            // The avatar stands beside both lines, not above the second one:
            // centred on the owner-and-name block, it reads as the identity the
            // two lines describe rather than as a picture attached to the owner.
            crossAxisAlignment: CrossAxisAlignment.center,
            children: [
              GitPulseAvatar(
                url: repository.owner.avatarUrl,
                size: GitPulseAvatarSize.owner,
              ),
              const SizedBox(width: GitPulseSpace.inline),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    // Two lines, not one name with a slash through it: the owner
                    // is the page's address and the repository is its title, and
                    // a title too long for the window takes another line rather
                    // than an ellipsis or a smaller size.
                    Text(
                      repository.owner.login,
                      key: const ValueKey('repository-owner'),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: gitPulseTypePageOwner(context),
                    ),
                    const SizedBox(height: GitPulseSpace.nudge),
                    SelectableText(
                      repository.name,
                      key: const ValueKey('repository-name'),
                      style: gitPulseTypePageTitle(context),
                    ),
                  ],
                ),
              ),
            ],
          ),
          if (description != null && description.isNotEmpty) ...[
            const SizedBox(height: GitPulseSpace.meta),
            Text(
              description,
              key: const ValueKey('repository-description'),
              style: gitPulseTypeDescription(context),
            ),
          ],
          const SizedBox(height: GitPulseSpace.rowInsetV),
          Wrap(
            spacing: _factGap,
            runSpacing: 8,
            crossAxisAlignment: WrapCrossAlignment.center,
            children: _facts(context, l10n),
          ),
          const SizedBox(height: GitPulseSpace.gutter),
          _Actions(repository: repository),
        ],
      ),
    );
  }

  List<Widget> _facts(BuildContext context, AppLocalizations l10n) {
    final muted = toneTextMuted(context);
    Widget glyph(IconData icon) =>
        Icon(icon, size: _factIconExtent, color: muted);
    // The language swatch is smaller than a glyph, so it takes the same slot:
    // every value on the line then starts at one offset from its own mark.
    Widget slot(Widget mark) => SizedBox(
      width: _factIconExtent,
      child: Center(child: mark),
    );
    _Fact counts(IconData icon, int count, String spoken) => _Fact(
      leading: glyph(icon),
      value: gitPulseCount(context, count),
      spoken: spoken,
    );
    final subscribers = repository.subscribersCount;
    return [
      if (repository.language case final language?)
        _Fact(
          leading: slot(LanguageSwatch(language: language)),
          value: language,
          spoken: language,
        ),
      counts(
        Icons.star_border,
        repository.stargazersCount,
        l10n.repositoryStars(repository.stargazersCount),
      ),
      counts(
        Icons.fork_right,
        repository.forksCount,
        l10n.repositoryForks(repository.forksCount),
      ),
      if (subscribers != null)
        counts(
          Icons.visibility_outlined,
          subscribers,
          l10n.repositoryWatchers(subscribers),
        ),
    ];
  }
}

/// The repository's three actions, held on one row at every width.
///
/// The list of releases is what the page is for, so it takes the row's spare
/// width; the Release Follow and the share sit beside it at compact targets. A
/// phone is where the row is tightest, and it is exactly where splitting the row
/// would cost the reader the comparison: the release list yields its own label
/// before the row is allowed to wrap.
class _Actions extends ConsumerWidget {
  const _Actions({required this.repository});

  final RepositoryDto repository;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = AppLocalizations.of(context);
    final follows = ref.watch(releaseFollowsSessionProvider);
    final identity = RepositoryReference(
      id: repository.nodeId,
      owner: repository.owner.login,
      name: repository.name,
    );
    // The shared Release Follows session is the only source of follow state: the
    // page reads what the Follows surface confirmed, so the two never disagree.
    final followed = follows.repositories.any((repo) => repo.id == identity.id);
    // Whatever the shared session could not read or save is stated here rather
    // than left to the bookmark: an unread list is not an unfollowed one, and a
    // refused save leaves the confirmed list exactly as it was.
    final problem = follows.problem;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Expanded(child: _RepositoryReleasesButton(repository: repository)),
            const SizedBox(width: GitPulseSpace.inline),
            GitPulseIconButton(
              key: const ValueKey('repository-follow'),
              label: followed ? l10n.followsUnfollow : l10n.followsFollow,
              icon: Icon(
                followed ? Icons.bookmark : Icons.bookmark_add_outlined,
              ),
              emphasized: followed,
              onPressed: follows.editBlocked
                  ? null
                  : () {
                      final session = ref.read(
                        releaseFollowsSessionProvider.notifier,
                      );
                      unawaited(
                        followed
                            ? session.unfollow(identity.id)
                            : session.follow(identity),
                      );
                    },
            ),
            const SizedBox(width: GitPulseSpace.tight),
            GitPulseIconButton(
              key: const ValueKey('repository-share'),
              label: l10n.repositoryShare,
              icon: const Icon(Icons.ios_share),
              onPressed: () => unawaited(
                shareRepositoryLink(
                  context,
                  ref,
                  repositoryWebUrl(repository.owner.login, repository.name),
                ),
              ),
            ),
          ],
        ),
        if (problem != null) ...[
          const SizedBox(height: GitPulseSpace.tight),
          GitPulseSettingNote(
            followProblemLabel(l10n, problem, save: follows.saveFailed),
            // A lost network is ordinary weather, as it is on the Follows
            // surfaces; only a real fault is stated in the error tone.
            tone: followProblemTone(problem) == GitPulseMessageTone.error
                ? GitPulseSettingNoteTone.error
                : GitPulseSettingNoteTone.muted,
            liveRegion: true,
          ),
        ],
      ],
    );
  }
}

/// The way into the repository's own release list: the page's primary action,
/// and the only one of the three that carries its name beside its glyph.
class _RepositoryReleasesButton extends StatelessWidget {
  const _RepositoryReleasesButton({required this.repository});

  final RepositoryDto repository;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    // The row's spare width, whatever the text scale: the label is the short
    // name of the destination, and it still gives way a letter at a time before
    // the row would be allowed to wrap. The whole name is what a screen reader
    // is given, so the shortening stays a matter of ink.
    return GitPulseButton(
      key: const ValueKey('repository-releases'),
      label: l10n.repositoryReleasesAction,
      semanticsLabel: l10n.repositoryReleasesTitle,
      variant: GitPulseButtonVariant.tonal,
      icon: const Icon(Icons.list_alt),
      expand: true,
      onPressed: () => openRepositoryPage(context, (
        owner: repository.owner.login,
        repository: repository.name,
        releases: true,
      )),
    );
  }
}

/// One datum of the identity band: a glyph, and the value it belongs to.
///
/// The glyph stands in for the noun that would otherwise sit beside the value —
/// Stars, Forks, Watchers — so the line reads as four numbers instead of four
/// sentences. [spoken] is where each noun survives: a screen reader hears what
/// the number counts, and a reader who can see the glyph does not read the word.
class _Fact extends StatelessWidget {
  const _Fact({
    required this.leading,
    required this.value,
    required this.spoken,
  });

  final Widget leading;
  final String value;
  final String spoken;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      label: spoken,
      child: ExcludeSemantics(
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            leading,
            const SizedBox(width: _factIconGap),
            Flexible(
              child: Text(
                value,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: gitPulseTypeFactValue(
                  context,
                )?.copyWith(fontFeatures: const [FontFeature.tabularFigures()]),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// The repository's README.
///
/// Loading, failure, and the empty README are all reported inside this band
/// rather than in place of the page: whatever the identity above it says about
/// the repository stays true even when the document cannot be read.
class _Readme extends ConsumerWidget {
  const _Readme({required this.repository, required this.opening});

  final RepositoryDto repository;
  final Object opening;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = AppLocalizations.of(context);
    final RepositoryScope repositoryScope = (
      owner: repository.owner.login,
      repository: repository.name,
      opening: opening,
    );
    final ReadmeScope scope = (
      repository: repositoryScope,
      branch: repository.defaultBranch,
    );
    final readme = ref.watch(repositoryReadmeProvider(scope));
    void retry() => ref.invalidate(repositoryReadmeProvider(scope));
    return readme.when(
      skipLoadingOnRefresh: false,
      loading: () => _ReadmeNotice(
        child: GitPulseLoadingView(label: l10n.repositoryReadmeLoading),
      ),
      error: (_, _) => _ReadmeNotice(
        child: RepositoryFailureView(
          failure: RepositoryFailure.server,
          onRetry: retry,
          inline: true,
        ),
      ),
      data: (data) {
        if (data.value == null) {
          return _ReadmeNotice(
            child: RepositoryFailureView(
              failure: data.failure!,
              onRetry: retry,
              inline: true,
            ),
          );
        }
        final dto = data.value!;
        final content = dto.content;
        if (content == null || content.trim().isEmpty) {
          return _ReadmeNotice(
            child: GitPulseMessageView(
              icon: Icons.description_outlined,
              title: l10n.repositoryNoReadme,
              inline: true,
            ),
          );
        }
        return _DocumentBand(
          path: dto.path!,
          repository: repository,
          content: content,
        );
      },
    );
  }
}

/// A band that holds only a message about the README, level with the page's
/// gutter and given room to breathe under the identity's rule.
class _ReadmeNotice extends StatelessWidget {
  const _ReadmeNotice({required this.child});

  final Widget child;

  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.symmetric(horizontal: _gutter, vertical: 40),
    child: Center(child: child),
  );
}

/// The README document, under the revision and path it was read from.
///
/// That heading is the one thing the document cannot say for itself: which file,
/// at which revision, this is. The word "README" would name nothing the markdown
/// below does not already show.
class _DocumentBand extends ConsumerWidget {
  const _DocumentBand({
    required this.path,
    required this.repository,
    required this.content,
  });

  final String path;
  final RepositoryDto repository;
  final String content;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = AppLocalizations.of(context);
    final branch = repository.defaultBranch;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(_gutter, 16, _gutter, 12),
          child: Semantics(
            // The line reads as a revision and a file to someone who knows a
            // repository; the spoken form names what the branch is.
            label: '${l10n.repositoryDefaultBranch(branch)} · $path',
            child: ExcludeSemantics(
              child: Text(
                '$branch · $path',
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: gitPulseTypeMetaTight(context)
                    ?.copyWith(fontFamily: 'monospace'),
              ),
            ),
          ),
        ),
        Expanded(
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: _gutter),
            child: ReleaseDocument(
              source: content,
              background: tonePage(context),
              document: RepositoryDocumentContext(
                owner: repository.owner.login,
                repository: repository.name,
                ref: branch,
                documentPath: path,
              ),
              onTapUrl: (url) => openNativeContentLink(context, ref, url),
              // The document scrolls itself, so the room under its last line
              // belongs inside that scroll rather than below the platform view.
              bottomInset: GitPulseSpace.bandGapLoose,
            ),
          ),
        ),
      ],
    );
  }
}

/// One reason the repository or its README could not be shown, with the one
/// action that tries again.
class RepositoryFailureView extends StatelessWidget {
  const RepositoryFailureView({
    super.key,
    required this.failure,
    required this.onRetry,
    this.inline = false,
  });
  final RepositoryFailure failure;
  final VoidCallback onRetry;

  /// Report only the message column, for a README band inside a page that
  /// already scrolls; the page's own failure centres itself in the body instead.
  final bool inline;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    return GitPulseMessageView(
      inline: inline,
      icon: Icons.error_outline,
      tone: GitPulseMessageTone.error,
      title: switch (failure) {
        RepositoryFailure.unavailable => l10n.repositoryUnavailable,
        RepositoryFailure.permission => l10n.repositoryPermission,
        RepositoryFailure.network => l10n.timelineErrorNetwork,
        RepositoryFailure.rateLimited => l10n.timelineErrorRateLimited,
        RepositoryFailure.session => l10n.sessionExpired,
        _ => l10n.repositoryFailed,
      },
      action: GitPulseButton(
        label: l10n.timelineRetry,
        variant: GitPulseButtonVariant.outlined,
        onPressed: onRetry,
      ),
    );
  }
}
