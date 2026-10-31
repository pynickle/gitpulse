import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../l10n/generated/app_localizations.dart';
import '../presentation/gitpulse_buttons.dart';
import '../presentation/gitpulse_swipe.dart';
import '../session/session_controller.dart';
import '../session/session_notice.dart';
import '../settings/account_gate.dart';
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

  void _leave() => closeReleases(context);

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
      // Every way out of the list leaves releases rather than stepping back
      // into the release the reader swiped from.
      canPop: false,
      onPopInvokedWithResult: (didPop, _) {
        if (!didPop) _leave();
      },
      child: Scaffold(
        appBar: AppBar(
          // The page names the repository it lists, as every list page does; the
          // list itself never repeats it (ADR 0020).
          title: Text('${widget.owner}/${widget.repository}'),
          automaticallyImplyLeading: false,
          actions: [
            // One way out, and it leaves releases altogether: the reader came
            // here to browse a repository's history, so Back into the release
            // they swiped from is not a place they are going.
            GitPulseIconButton(
              label: l10n.navigationHome,
              icon: const Icon(Icons.home_outlined),
              onPressed: _leave,
            ),
          ],
        ),
        body: SafeArea(
          child: session.phase == SessionPhase.signedIn
              ? Column(
                  children: [
                    const SessionNotice(),
                    Expanded(
                      // Swiping back on the rows is the same shortcut in
                      // reverse: the reader already knows where they came from,
                      // and the gesture is offered to the list first, so a drag
                      // a row or the pager claims never reaches it.
                      child: GitPulseSwipe(
                        onSwipeLeft: _leave,
                        child: RepositoryReleasesView(
                          state: state,
                          onPage: controller.loadPage,
                          onFilter: controller.setFilter,
                          onRelease: _open,
                        ),
                      ),
                    ),
                  ],
                )
              : const AccountGate(),
        ),
      ),
    );
  }

  void _open(RepositoryReleaseDto release) => showReleaseInPlace(context, (
    owner: widget.owner,
    repository: widget.repository,
    id: release.id,
    tag: null,
  ));
}
