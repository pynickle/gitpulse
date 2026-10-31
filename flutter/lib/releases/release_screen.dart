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
/// Back, Escape and the system's back gesture all leave the release surfaces
/// together and return to the Timeline. There is no chrome of the app's own over
/// the notes: the repository the release belongs to is the page's title, and the
/// one action at the end of that title is the app's Home. The Release Assets are
/// a screen of their own ([releaseAssetsLocation]), so the notes and the asset
/// list are never two scrollers fighting in one page.
class ReleaseScreen extends ConsumerWidget {
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
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = AppLocalizations.of(context);
    final session = ref.watch(sessionControllerProvider);
    final result = ref.watch(releaseDetailProvider(target));
    // A release is readable only for the account that opened it. When that
    // account changes underneath, the screen has nothing it may show, so it
    // leaves rather than drawing one session's notes over another's.
    if (session.phase != SessionPhase.signedIn) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (context.mounted) closeReleases(context);
      });
      return const SizedBox.shrink();
    }
    return PopScope(
      // Every way out of a release leaves releases: there is no step back into
      // the stack this feature built, because the reader is finished with it.
      canPop: false,
      onPopInvokedWithResult: (didPop, _) {
        if (!didPop) closeReleases(context);
      },
      child: Scaffold(
        appBar: AppBar(
          // The page's title names the repository the release belongs to, and
          // it is the way to that repository — the same pairing the web Release
          // Drawer's chrome line makes. It is drawn as the app's own action so
          // the title keeps its type and still answers a press (ADR 0032).
          title: Align(
            alignment: AlignmentDirectional.centerStart,
            child: InkWell(
              key: const Key('release-repository'),
              borderRadius: BorderRadius.circular(GitPulseRadius.row),
              onTap: () => openRepositoryFromRelease(
                context,
                owner: owner,
                repository: repository,
                id: id,
                tag: tag,
              ),
              child: Padding(
                padding: const EdgeInsets.symmetric(
                  horizontal: GitPulseSpace.inline,
                  vertical: GitPulseSpace.tight,
                ),
                child: Text(
                  '$owner/$repository',
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
              ),
            ),
          ),
          automaticallyImplyLeading: false,
          actions: [
            // The only way out, and it leaves releases altogether.
            GitPulseIconButton(
              label: l10n.navigationHome,
              icon: const Icon(Icons.home_outlined),
              onPressed: () => closeReleases(context),
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
                  error: (error, stack) => _ReleaseFailure(
                    failure: ReleaseDetailFailure.server,
                    onRetry: () =>
                        ref.invalidate(releaseDetailProvider(target)),
                  ),
                  data: (data) => data.release == null
                      ? _ReleaseFailure(
                          failure: data.failure!,
                          onRetry: () =>
                              ref.invalidate(releaseDetailProvider(target)),
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
                          // A swipe across the header is the way into the
                          // releases of the repository the release belongs to —
                          // the same repository whose name titles this page — so
                          // browsing its history never needs a step back through
                          // the client's chrome. It is offered over the header
                          // rather than over the notes, because a document hands
                          // every gesture it receives to its own renderer, and
                          // in one direction only: leaving is what Home is for.
                          headerBuilder: (header) => GitPulseSwipe(
                            onSwipeLeft: () => openRepositoryReleases(
                              context,
                              owner: owner,
                              repository: repository,
                            ),
                            child: header,
                          ),
                          footerBuilder: (footer) => footer,
                          onViewAllAssets: () => openReleaseAssets(
                            context,
                            owner: owner,
                            repository: repository,
                            id: id,
                            tag: tag,
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
