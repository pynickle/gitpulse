import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../l10n/generated/app_localizations.dart';
import '../repositories/repository_navigation.dart';
import '../session/session_controller.dart';
import '../session/sign_in_panel.dart';
import 'release_drawer.dart';
import 'repository_releases_controller.dart';
import 'repository_releases_view.dart';

class RepositoryReleasesScreen extends ConsumerStatefulWidget {
  const RepositoryReleasesScreen({
    super.key,
    required this.owner,
    required this.repository,
  });

  final String owner;
  final String repository;

  @override
  ConsumerState<RepositoryReleasesScreen> createState() =>
      _RepositoryReleasesScreenState();
}

class _RepositoryReleasesScreenState
    extends ConsumerState<RepositoryReleasesScreen> {
  final _opening = Object();

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
    return Scaffold(
      appBar: RepositoryPageAppBar(
        title: AppLocalizations.of(context).repositoryReleasesTitle,
      ),
      body: SafeArea(
        child: Column(
          children: [
            const SessionNotice(),
            Expanded(
              child: session.phase != SessionPhase.signedIn
                  ? const SingleChildScrollView(
                      padding: EdgeInsets.all(20),
                      child: SignInPanel(),
                    )
                  : SingleChildScrollView(
                      padding: const EdgeInsets.all(20),
                      child: RepositoryReleasesView(
                        repository: '${widget.owner}/${widget.repository}',
                        state: state,
                        onPage: controller.loadPage,
                        onFilter: controller.setFilter,
                        onRelease: (release) => showReleaseDrawer(context, (
                          owner: widget.owner,
                          repository: widget.repository,
                          id: release.id,
                          tag: null,
                        )),
                      ),
                    ),
            ),
          ],
        ),
      ),
    );
  }
}
