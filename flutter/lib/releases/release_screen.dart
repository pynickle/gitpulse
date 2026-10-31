import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../l10n/generated/app_localizations.dart';
import '../presentation/gitpulse_buttons.dart';
import '../presentation/gitpulse_state_views.dart';
import '../presentation/gitpulse_swipe.dart';
import '../presentation/gitpulse_tokens.dart';
import '../session/session_controller.dart';
import '../session/session_notice.dart';
import 'release_detail_service.dart';
import 'release_details_view.dart';
import 'release_link.dart';
import 'release_navigation.dart';

/// One release, as a screen of its own.
///
/// This is the surface the Release Drawer became (ADR 0039): the whole window
/// instead of a sheet the reader had to drag wider, and a page instead of a
/// modal the Timeline keeps underneath it. Its body is the web Release Drawer's
/// in the client's own vocabulary — the tag line with the prerelease pill beside
/// it, the release's name, the line that signs it with the way out to GitHub, a
/// rule, the notes, and the Release Assets folded into one row below them.
///
/// The release a reader entered through stays the one step back for everything
/// opened from it: a link in the notes and a row in the repository's list both
/// lead on to another release, and each of those offers the Entry Release rather
/// than the one before it. Closing — from the entry release — leaves releases
/// altogether and returns to the Timeline. The Release Assets are a screen of
/// their own, so the notes and the asset list are never two scrollers fighting
/// in one page.
class ReleaseScreen extends ConsumerStatefulWidget {
  const ReleaseScreen({
    super.key,
    required this.owner,
    required this.repository,
    this.id,
    this.tag,
  });

  final String owner;
  final String repository;

  /// The release's id, when the surface that opened this screen knew one.
  final int? id;

  /// The release's tag, when it is addressed by name instead — a link, a
  /// document, a notification.
  final String? tag;

  ReleaseTarget get target =>
      (owner: owner, repository: repository, id: id, tag: tag);

  @override
  ConsumerState<ReleaseScreen> createState() => _ReleaseScreenState();
}

class _ReleaseScreenState extends ConsumerState<ReleaseScreen> {
  ReleaseTarget get _target => widget.target;

  @override
  void initState() {
    super.initState();
    // The screen the reader is actually on is the opening's latest release: a
    // release reached by tag and one reached by id are the same address to the
    // reader, and the opening has to know the one it is showing.
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      ref.read(releaseOpeningProvider.notifier).viewing(_target);
    });
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final session = ref.watch(sessionControllerProvider);
    final result = ref.watch(releaseDetailProvider(_target));
    final opening = ref.watch(releaseOpeningProvider);
    // A release is readable only for the account that opened it. When that
    // account changes underneath, the screen has nothing it may show, so it
    // leaves rather than drawing one session's notes over another's.
    if (session.phase != SessionPhase.signedIn) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (context.mounted) closeReleases(context, ref);
      });
      return const SizedBox.shrink();
    }
    final release = result.value?.release;
    if (release != null && opening != null) {
      // The screen records itself and, when it is the entry release, the
      // identity that release resolved to. Both are provider writes, so they
      // happen after this build — and only when they would change something, or
      // the write would schedule the next build for ever.
      final recordsItself = !sameReleaseAddress(opening.current, _target);
      final resolvesEntry = opening.isEntry(_target) && opening.entryId == null;
      if (recordsItself || resolvesEntry) {
        WidgetsBinding.instance.addPostFrameCallback((_) {
          if (!mounted) return;
          final controller = ref.read(releaseOpeningProvider.notifier);
          if (recordsItself) controller.viewing(_target);
          if (resolvesEntry) controller.resolveEntry(_target, release.id);
        });
      }
    }
    // The Entry Release is identified by the release it resolved to, not only by
    // the address it was opened with: a link that names the tag and a row that
    // names the numeric id can be the same release, and that release has
    // nothing to step back to.
    final showingOtherRelease =
        opening != null &&
        release != null &&
        !opening.isEntry(_target) &&
        (opening.entryId == null || release.id != opening.entryId);
    return PopScope(
      // Every way out of a release leaves releases: there is no step back into
      // the stack this feature built, because the reader is finished with it.
      canPop: false,
      onPopInvokedWithResult: (didPop, _) {
        if (!didPop) {
          if (showingOtherRelease) {
            backToEntryRelease(context, ref, opening.entry);
          } else {
            closeReleases(context, ref);
          }
        }
      },
      child: Scaffold(
        appBar: AppBar(
          // The page's title names the repository the release belongs to, and
          // it is the way to that repository — the same pairing the web Release
          // Drawer's chrome line makes.
          title: Align(
            alignment: AlignmentDirectional.centerStart,
            child: InkWell(
              key: const Key('release-repository'),
              borderRadius: BorderRadius.circular(GitPulseRadius.row),
              onTap: () => openRepositoryFromRelease(context, _target),
              child: Padding(
                padding: const EdgeInsets.symmetric(
                  horizontal: GitPulseSpace.inline,
                  vertical: GitPulseSpace.tight,
                ),
                child: Text(
                  '${widget.owner}/${widget.repository}',
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
              ),
            ),
          ),
          automaticallyImplyLeading: false,
          // Three marks, not three cards. The bar is the platform's, and a bar
          // is a row of icons: a labelled, outlined control here reads as a
          // button rendered into the wrong surface. A swipe is a shortcut, never
          // the only way, so each mark carries the action's name to a screen
          // reader and to anyone who asks — the "Releases" action opens the
          // repository's release list, the arrow steps back to the Entry
          // Release, the house leaves releases altogether.
          actions: [
            GitPulseIconButton(
              key: const Key('release-open-list'),
              label: l10n.releaseListAction,
              icon: const Icon(Icons.list_alt),
              onPressed: () => openRepositoryReleases(
                context,
                owner: widget.owner,
                repository: widget.repository,
              ),
            ),
            if (showingOtherRelease)
              GitPulseIconButton(
                key: const Key('release-back-to-entry'),
                label: l10n.releaseEntryAction,
                icon: const Icon(Icons.arrow_back),
                onPressed: () =>
                    backToEntryRelease(context, ref, opening.entry),
              ),
            // One way out of releases, offered from the entry release and from
            // anything the reader swiped into from it.
            GitPulseIconButton(
              label: l10n.navigationHome,
              icon: const Icon(Icons.home_outlined),
              onPressed: () => closeReleases(context, ref),
            ),
            const SizedBox(width: GitPulseSpace.inline),
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
                  error: (error, stack) => _ReleaseFailure(
                    failure: ReleaseDetailFailure.server,
                    onRetry: () =>
                        ref.invalidate(releaseDetailProvider(_target)),
                  ),
                  data: (data) => data.release == null
                      ? _ReleaseFailure(
                          failure: data.failure!,
                          onRetry: () =>
                              ref.invalidate(releaseDetailProvider(_target)),
                        )
                      : ReleaseDetailsView(
                          key: ValueKey(data.release!.id),
                          release: data.release!,
                          onTapUrl: (url) => openReleaseLink(context, ref, url),
                          onOpenExternal: (url) => openReleaseLink(
                            context,
                            ref,
                            url,
                            external: true,
                          ),
                          // A flick across the notes is the way into the
                          // releases of the repository the release belongs to.
                          // The document reports it rather than being wrapped:
                          // a layer over a platform view would take the notes'
                          // own scrolling with it, and the reader would lose the
                          // changelog to gain a shortcut.
                          onSwipeNotes: (left) {
                            if (left) {
                              openRepositoryReleases(
                                context,
                                owner: widget.owner,
                                repository: widget.repository,
                              );
                            }
                          },
                          headerBuilder: (header) => GitPulseSwipe(
                            onSwipeLeft: () => openRepositoryReleases(
                              context,
                              owner: widget.owner,
                              repository: widget.repository,
                            ),
                            child: header,
                          ),
                          footerBuilder: (footer) => footer,
                          onViewAllAssets: () =>
                              openReleaseAssets(context, _target),
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

class _ReleaseFailure extends StatelessWidget {
  const _ReleaseFailure({required this.failure, required this.onRetry});

  final ReleaseDetailFailure failure;
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final network = failure == ReleaseDetailFailure.network;
    return GitPulseMessageView(
      icon: network ? Icons.cloud_off_outlined : Icons.error_outline,
      tone: network ? GitPulseMessageTone.neutral : GitPulseMessageTone.error,
      liveRegion: true,
      title: switch (failure) {
        ReleaseDetailFailure.unavailable => l10n.releaseUnavailable,
        ReleaseDetailFailure.network => l10n.timelineErrorNetwork,
        ReleaseDetailFailure.rateLimited => l10n.timelineErrorRateLimited,
        _ => l10n.releaseFailed,
      },
      action: GitPulseButton(
        label: l10n.timelineRetry,
        variant: GitPulseButtonVariant.tonal,
        onPressed: onRetry,
      ),
    );
  }
}
