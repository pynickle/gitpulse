import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../l10n/generated/app_localizations.dart';
import '../presentation/gitpulse_buttons.dart';
import '../session/session_controller.dart';
import '../session/session_notice.dart';
import '../settings/account_gate.dart';
import 'release_detail_service.dart';
import 'release_navigation.dart';
import 'repository_releases_controller.dart';
import 'repository_releases_dto.dart';
import 'repository_releases_view.dart';

/// One repository's releases, as a screen of its own.
///
/// The same list the Repository page has always hosted (ADR 0012), laid out as a
/// full-screen page rather than as a band inside another surface: the same
/// filters, the same rows, the same pager, and the same shared presentation. It
/// is reached from a repository's Releases action and by swiping left on a
/// release (ADR 0039).
///
/// Its one way out is Home. The reader came here to browse a repository's
/// history, and when they are done with it they are done with releases, so
/// nothing leads back into the stack of screens this feature opened. A row opens
/// that release at the same address, so the list does not stack up behind it.
class RepositoryReleasesPage extends ConsumerStatefulWidget {
  const RepositoryReleasesPage({
    super.key,
    required this.owner,
    required this.repository,
  });

  final String owner;
  final String repository;

  @override
  ConsumerState<RepositoryReleasesPage> createState() =>
      _RepositoryReleasesPageState();
}

class _RepositoryReleasesPageState
    extends ConsumerState<RepositoryReleasesPage> {
  final _opening = Object();

  /// The release the reader entered through, when the list was opened from one.
  ///
  /// The list is a step out of the release it was swiped from, not out of the
  /// release surfaces altogether: leaving it returns to that Entry Release. It
  /// only goes home when there is no release to return to — the list opened from
  /// a repository page, which belongs to no release opening.
  ReleaseTarget? get _entryRelease => ref.read(releaseOpeningProvider)?.entry;

  bool get _returnsToEntryRelease => _entryRelease != null;

  void _leave() {
    final entry = _entryRelease;
    if (entry == null) {
      closeReleases(context, ref);
      return;
    }
    backToEntryRelease(context, ref, entry);
  }

  @override
  Widget build(BuildContext context) {
    final session = ref.watch(sessionControllerProvider);
    final scope = (
      owner: widget.owner,
      repository: widget.repository,
      opening: _opening,
    );
    final state = ref.watch(repositoryReleasesControllerProvider(scope));
    final controller = ref.read(
      repositoryReleasesControllerProvider(scope).notifier,
    );
    final l10n = AppLocalizations.of(context);
    return PopScope(
      // Leaving the list steps back to the release the reader swiped from, and
      // only goes home when the list was opened from a repository page — which
      // belongs to no release opening.
      canPop: false,
      onPopInvokedWithResult: (didPop, _) {
        if (!didPop) _leave();
      },
      child: Scaffold(
        appBar: AppBar(
          // The page names the repository it lists, as every list page does; the
          // list itself never repeats it (ADR 0020).
          title: Text('${widget.owner}/${widget.repository}'),
          automaticallyImplyLeading: _returnsToEntryRelease,
          leading: _returnsToEntryRelease
              ? BackButton(onPressed: _leave)
              : null,
          actions: [
            // One way out, and it leaves releases altogether. The step back to
            // the Entry Release is the platform's own affordance on the left,
            // because that is the step the reader already knows.
            GitPulseIconButton(
              label: l10n.navigationHome,
              icon: const Icon(Icons.home_outlined),
              onPressed: () => closeReleases(context, ref),
            ),
          ],
        ),
        body: SafeArea(
          child: session.phase == SessionPhase.signedIn
              ? Column(
                  children: [
                    const SessionNotice(),
                    Expanded(
                      // The list answers no swipe. Its rows scroll, its filter
                      // bar scrolls and its pager is tapped; a sideways gesture
                      // over a list of rows the reader is choosing between is
                      // more likely to be aimed at a row than at leaving, so the
                      // way out is the bar's Back and Home.
                      child: RepositoryReleasesView(
                        state: state,
                        onPage: controller.loadPage,
                        onFilter: controller.setFilter,
                        onRelease: _open,
                      ),
                    ),
                  ],
                )
              : const AccountGate(),
        ),
      ),
    );
  }

  void _open(RepositoryReleaseDto release) => showReleaseInPlace(context, ref, (
    owner: widget.owner,
    repository: widget.repository,
    id: release.id,
    tag: null,
  ));
}
