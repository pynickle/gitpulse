import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../l10n/generated/app_localizations.dart';
import '../presentation/gitpulse_formatting.dart';
import '../presentation/gitpulse_language_colors.dart';
import '../presentation/gitpulse_setting_rows.dart';
import '../presentation/gitpulse_state_views.dart';
import '../releases/document_content.dart';
import '../releases/release_document.dart';
import '../session/session_controller.dart';
import '../session/session_notice.dart';
import '../settings/account_panel.dart';
import 'repository_dto.dart';
import 'repository_navigation.dart';
import 'repository_service.dart';

/// The page gutter: the 16 that a Timeline, Follows, and Settings row all start
/// at, so this page's bands line up with the rest of the app.
const _gutter = gitPulseSettingsGutter;

/// The width the page stops growing at.
///
/// A repository page is read, not scanned: its README is prose, and a measure
/// much longer than this one is a measure the eye loses its place in. Documents
/// that need width — tables, code — still fit inside it.
const _maximumContentWidth = 960.0;

/// The space between two facts on the identity band's data line.
///
/// The mark and gap inside one fact — a 14 px glyph and 3 px of air — are the
/// ones the Repository Release List rows already draw, so a fact looks the same
/// on both pages; the 20 px between facts is the gap a Follows row's metadata
/// line uses.
const _factGap = 20.0;
const _factIconExtent = 14.0;
const _factIconGap = 3.0;

/// The Repository detail page: who the repository is, the one line of numbers
/// that describes it, the way into its releases, and its README.
///
/// The page is a column of bands on the gutter the Timeline, Follows, and
/// Settings pages share, capped at a reading width instead of stretching across
/// a desktop window. It leads with the repository's identity rather than with a
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
        child: CustomScrollView(
          slivers: [
            SliverToBoxAdapter(child: _Identity(repository: repository)),
            // The same full-width rule that closes a Settings band: one line
            // from edge to edge is what says the identity is over.
            const SliverToBoxAdapter(child: GitPulseSettingsDivider(indent: 0)),
            SliverToBoxAdapter(
              child: _Readme(repository: repository, opening: opening),
            ),
            const SliverToBoxAdapter(child: SizedBox(height: 32)),
          ],
        ),
      ),
    );
  }
}

/// Who the repository is.
///
/// The owner is written in the muted tone and the repository's own name in the
/// foreground of the same size, so the identity reads as one name with the part
/// that distinguishes it carrying the weight. Below it a data line puts a glyph
/// where a noun would go: language, stars, forks, and watchers. Last comes the
/// one action the page has.
class _Identity extends StatelessWidget {
  const _Identity({required this.repository});

  final RepositoryDto repository;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final theme = Theme.of(context);
    final scheme = theme.colorScheme;
    final name = theme.textTheme.headlineSmall?.copyWith(
      fontWeight: FontWeight.w600,
    );
    final description = repository.description?.trim();
    return Padding(
      padding: const EdgeInsets.fromLTRB(_gutter, 16, _gutter, 16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SelectableText.rich(
            TextSpan(
              children: [
                TextSpan(
                  text: '${repository.owner.login}/',
                  style: name?.copyWith(
                    color: scheme.onSurfaceVariant,
                    fontWeight: FontWeight.w400,
                  ),
                ),
                TextSpan(text: repository.name, style: name),
              ],
            ),
          ),
          if (description != null && description.isNotEmpty) ...[
            const SizedBox(height: 8),
            SelectableText(
              description,
              style: theme.textTheme.bodyLarge?.copyWith(
                color: scheme.onSurfaceVariant,
              ),
            ),
          ],
          const SizedBox(height: 14),
          Wrap(
            spacing: _factGap,
            runSpacing: 8,
            crossAxisAlignment: WrapCrossAlignment.center,
            children: _facts(context, l10n),
          ),
          const SizedBox(height: 16),
          FilledButton.tonalIcon(
            onPressed: () => openRepositoryPage(context, (
              owner: repository.owner.login,
              repository: repository.name,
              releases: true,
            )),
            icon: const Icon(Icons.list_alt),
            label: Text(l10n.repositoryReleasesTitle),
          ),
        ],
      ),
    );
  }

  List<Widget> _facts(BuildContext context, AppLocalizations l10n) {
    final muted = Theme.of(context).colorScheme.onSurfaceVariant;
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
    final theme = Theme.of(context);
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
                style: theme.textTheme.labelMedium?.copyWith(
                  color: theme.colorScheme.onSurfaceVariant,
                  fontFeatures: const [FontFeature.tabularFigures()],
                ),
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
    final theme = Theme.of(context);
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
                style: theme.textTheme.labelSmall?.copyWith(
                  color: theme.colorScheme.onSurfaceVariant,
                  fontFamily: 'monospace',
                ),
              ),
            ),
          ),
        ),
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: _gutter),
          child: ReleaseDocument(
            source: content,
            document: RepositoryDocumentContext(
              owner: repository.owner.login,
              repository: repository.name,
              ref: branch,
              documentPath: path,
            ),
            onTapUrl: (url) => openNativeContentLink(context, ref, url),
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
      action: OutlinedButton(
        onPressed: onRetry,
        child: Text(l10n.timelineRetry),
      ),
    );
  }
}
