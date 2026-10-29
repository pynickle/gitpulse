import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../l10n/generated/app_localizations.dart';
import '../presentation/gitpulse_buttons.dart';
import '../presentation/gitpulse_sheet.dart';
import '../presentation/gitpulse_state_views.dart';
import '../presentation/gitpulse_tokens.dart';
import '../repositories/repository_navigation.dart';
import '../session/session_controller.dart';
import 'document_content.dart';
import 'release_detail_service.dart';
import 'release_details_view.dart';
import 'release_drawer_geometry.dart';
import 'repository_releases_controller.dart';
import 'repository_releases_view.dart';

Future<void> showReleaseDrawer(BuildContext context, ReleaseTarget entry) =>
    showGitPulseSheet(
      context,
      barrierLabel: AppLocalizations.of(context).releaseClose,
      builder: (context) => ReleaseDrawer(entry: entry),
    );

/// One action in the chrome line's icon slots.
Widget _chromeAction({
  required String label,
  required IconData icon,
  required VoidCallback onPressed,
  bool autofocus = false,
}) => GitPulseIconButton(
  label: label,
  autofocus: autofocus,
  onPressed: onPressed,
  icon: Icon(icon),
);

/// How thick the phone sheet's grab handle is drawn.
///
/// Not a rule line and not a stroke width: it is the affordance that says the
/// sheet can be dragged, so its size answers to the finger rather than to the
/// ink hierarchy.
const _sheetGrabThickness = 4.0;

class ReleaseDrawer extends ConsumerStatefulWidget {
  const ReleaseDrawer({super.key, required this.entry});

  final ReleaseTarget entry;

  @override
  ConsumerState<ReleaseDrawer> createState() => _ReleaseDrawerState();
}

class _ReleaseDrawerState extends ConsumerState<ReleaseDrawer> {
  late ReleaseTarget _target = widget.entry;
  late final ReleaseTarget _entry = widget.entry;
  final _opening = Object();
  final _visitedReleases = <ReleaseTarget>{};
  final _visitedLists = <RepositoryReleasesScope>{};
  RepositoryReleasesScope? _listScope;
  bool _showList = false;
  bool _closing = false;
  ReleaseTarget? _entryIdentity;
  late final _identity = ref.read(sessionControllerProvider).identity;
  final _sheetController = DraggableScrollableController();

  @override
  void dispose() {
    _sheetController.dispose();
    super.dispose();
  }

  void _snapSheet(double extent) {
    if (_closing || !_sheetController.isAttached) return;
    _sheetController.animateTo(
      extent,
      duration: const Duration(milliseconds: 180),
      curve: Curves.easeOut,
    );
  }

  /// Closes the drawer, whichever gesture or scroll asked for it, once.
  void _close() {
    if (_closing) return;
    _closing = true;
    Navigator.of(context).pop();
  }

  /// The grab handle is a toggle rather than a drag: below the full height it
  /// opens the drawer, and above it settles back to the height it opens at.
  void _toggleSheet() => _snapSheet(
    _sheetController.size < releaseDrawerFullSnapExtent
        ? 1
        : releaseDrawerOpeningExtent,
  );

  /// The reading body: the drawer's own chrome around the notes' own scroller.
  ///
  /// The sheet resizes through its scroll controller, so this body keeps a
  /// scrollable attached to it — one that cannot move, because the document
  /// beneath it owns the reading gesture. Without that attachment the grab handle
  /// would have nothing to resize.
  Widget _documentBody({
    required ScrollController? controller,
    required Widget child,
  }) => LayoutBuilder(
    builder: (context, constraints) => ListView(
      key: ValueKey(_target),
      controller: controller,
      primary: false,
      physics: const NeverScrollableScrollPhysics(),
      padding: EdgeInsets.zero,
      children: [SizedBox(height: constraints.maxHeight, child: child)],
    ),
  );

  /// A body that is only a report — loading, or a read that failed. It keeps the
  /// sheet's own controller, so a drag on it still moves the sheet; a document
  /// replaces it with the notes' own scroll owner.
  Widget _scrollableBody({
    required ScrollController? controller,
    required Widget child,
  }) => SingleChildScrollView(
    key: ValueKey(_target),
    controller: controller,
    primary: false,
    padding: const EdgeInsets.all(20),
    child: child,
  );

  /// The controller behind the Repository Release List currently on screen, so
  /// its pager and filters share one lookup just as the fullscreen host does.
  RepositoryReleasesController _listController(RepositoryReleasesScope scope) =>
      ref.read(repositoryReleasesControllerProvider(scope).notifier);

  Future<bool> _openLink(String value, {bool external = false}) async {
    final uri = safeContentUri(value);
    if (uri == null) return true;
    final target = external ? null : releaseTargetFromUri(uri);
    if (target != null) {
      setState(() => _target = target);
      return true;
    }
    return openNativeContentLink(context, ref, value, external: external);
  }

  @override
  Widget build(BuildContext context) {
    final session = ref.watch(sessionControllerProvider);
    ref.listen(sessionControllerProvider, (previous, next) {
      if (next.phase != SessionPhase.signedIn ||
          previous?.identity?.backend != next.identity?.backend ||
          previous?.identity?.login != next.identity?.login) {
        WidgetsBinding.instance.addPostFrameCallback((_) {
          if (!mounted) return;
          final route = ModalRoute.of(context);
          if (route?.isCurrent == true) {
            Navigator.of(context).pop();
          } else if (route?.isActive == true) {
            // A repository page may cover this drawer. Remove its old-account
            // route too, so Back cannot return to an invisible modal barrier.
            Navigator.of(context).removeRoute(route!);
          }
        });
      }
    });
    if (session.phase != SessionPhase.signedIn ||
        session.identity?.backend != _identity?.backend ||
        session.identity?.login != _identity?.login) {
      return const SizedBox.shrink();
    }
    // Retain visited details for this opening, just like the repository lists.
    // Closing the drawer releases these subscriptions and their cached results.
    _visitedReleases.add(_target);
    final details = {
      for (final target in _visitedReleases)
        target: ref.watch(releaseDetailProvider(target)),
    };
    final result = details[_target]!;
    if (_target == _entry) {
      if (result.value?.release case final release?) {
        _entryIdentity = (
          owner: release.owner,
          repository: release.repository,
          id: release.id,
          tag: null,
        );
      }
    }
    final loadedRelease = result.value?.release;
    // Keep every visited list alive for this opening, including while reading
    // another repository's release. Closing the drawer releases all of them.
    final listStates = {
      for (final scope in _visitedLists)
        scope: ref.watch(repositoryReleasesControllerProvider(scope)),
    };
    final listState = listStates[_listScope];
    final l10n = AppLocalizations.of(context);
    final theme = Theme.of(context);
    // The sheet's gestures convert pixels into a share of the window they stand
    // in — the sheet fills the window it stands in, so one number serves as both
    // the room the drag divides by and the height the closing line is a
    // distance in.
    final windowHeight = MediaQuery.sizeOf(context).height;
    final dismissExtent = releaseDrawerDismissExtent(windowHeight);

    // The Entry Release is identified by the release it resolved to, not by the
    // address it was opened with: a link that names the tag and a list row that
    // names the numeric id can both be the same release, and that release has
    // nothing to step back to.
    bool showingOtherRelease() {
      if (_target == _entry) return false;
      final entry = _entryIdentity;
      if (entry == null || loadedRelease == null) return true;
      return loadedRelease.id != entry.id ||
          loadedRelease.owner.toLowerCase() != entry.owner.toLowerCase() ||
          loadedRelease.repository.toLowerCase() !=
              entry.repository.toLowerCase();
    }

    Widget entryButton() => _chromeAction(
      label: l10n.releaseEntry,
      icon: Icons.arrow_back,
      onPressed: () => setState(() {
        _target = _entry;
        _showList = false;
      }),
    );

    Widget panel({required ScrollController controller}) {
      // The chrome line names what is being read and targets that repository.
      // Another repository's release replaces it while it is open, and the
      // Repository Release List names the repository it lists.
      final release = _showList ? null : loadedRelease;
      final listScope = _showList ? _listScope : null;
      final owner = listScope?.owner ?? release?.owner ?? _target.owner;
      final repository =
          listScope?.repository ?? release?.repository ?? _target.repository;
      final tag = listScope == null ? release?.tag ?? _target.tag : null;
      // The repository's release list has its own GitHub page, so the chrome
      // action never has to disappear when the list takes the body.
      final githubUrl = listScope == null
          ? release?.dto.htmlUrl
          : Uri.https('github.com', '/$owner/$repository/releases').toString();

      Widget dragRegion(Widget child) => GestureDetector(
        behavior: HitTestBehavior.opaque,
        onVerticalDragUpdate: (details) {
          if (!_closing && _sheetController.isAttached) {
            // The closing line is the sheet's own floor, so a pull that reaches
            // it closes the drawer through the same report every other drag
            // makes — the pull is a short distance, not a share of the screen.
            _sheetController.jumpTo(
              (_sheetController.size - details.delta.dy / windowHeight).clamp(
                dismissExtent,
                1,
              ),
            );
          }
        },
        onVerticalDragEnd: (details) {
          if (!_sheetController.isAttached) return;
          switch (resolveReleaseDrawerRelease(
            extent: _sheetController.size,
            velocity: details.velocity.pixelsPerSecond.dy,
          )) {
            case ReleaseDrawerRelease.dismiss:
              _close();
            case ReleaseDrawerRelease.full:
              _snapSheet(1);
            case ReleaseDrawerRelease.opening:
              _snapSheet(releaseDrawerOpeningExtent);
          }
        },
        child: child,
      );

      // The sheet's top edge sits in the middle of the screen, so the status bar
      // inset above it is screen the notes could be using.
      return SafeArea(
        top: false,
        child: Column(
          children: [
            dragRegion(
              Column(
                children: [
                  Semantics(
                    button: true,
                    label: l10n.releaseResizeSheet,
                    child: GestureDetector(
                      key: const Key('release-sheet-handle'),
                      behavior: HitTestBehavior.opaque,
                      onTap: _toggleSheet,
                      child: SizedBox(
                        height: 28,
                        width: double.infinity,
                        child: Center(
                          child: SizedBox(
                            width: 40,
                            // The sheet's grab affordance rather than a rule: it
                            // is toned as a line inside the sheet so it is the
                            // app's one tone and not a theme default.
                            child: Divider(
                              thickness: _sheetGrabThickness,
                              color: toneRule(theme.colorScheme),
                            ),
                          ),
                        ),
                      ),
                    ),
                  ),
                  SizedBox(
                    height: GitPulseHeight.standard,
                    child: Row(
                      children: [
                        Expanded(
                          // The row targets the repository page, and the permanent
                          // underline on the repository name is what says so without
                          // relying on colour. Its ink is clipped to a rounded shape
                          // and inset a little, so a press is a tonal shift inside
                          // the row rather than a rectangle across the panel.
                          child: Padding(
                            padding: const EdgeInsets.symmetric(horizontal: 4),
                            child: InkWell(
                              borderRadius: BorderRadius.circular(
                                GitPulseRadius.row,
                              ),
                              onTap: () => _openLink(
                                Uri.https(
                                  'github.com',
                                  '/$owner/$repository',
                                ).toString(),
                              ),
                              child: Padding(
                                padding: const EdgeInsets.only(
                                  left: 12,
                                  right: 4,
                                ),
                                child: LayoutBuilder(
                                  builder: (context, constraints) => Row(
                                    children: [
                                      if (tag != null) ...[
                                        ConstrainedBox(
                                          // The repository name keeps most of the
                                          // line; a long tag ellipsizes instead.
                                          constraints: BoxConstraints(
                                            maxWidth: constraints.maxWidth * .4,
                                          ),
                                          child: Text(
                                            tag,
                                            maxLines: 1,
                                            overflow: TextOverflow.ellipsis,
                                            style: gitPulseTypeRowLabel(
                                              context,
                                            ),
                                          ),
                                        ),
                                        const SizedBox(width: 6),
                                      ],
                                      Expanded(
                                        child: Text(
                                          '$owner/$repository',
                                          maxLines: 1,
                                          overflow: TextOverflow.ellipsis,
                                          style: gitPulseTypeMeta(context)
                                              ?.copyWith(
                                                decoration:
                                                    TextDecoration.underline,
                                              ),
                                        ),
                                      ),
                                    ],
                                  ),
                                ),
                              ),
                            ),
                          ),
                        ),
                        if (!_showList && showingOtherRelease()) entryButton(),
                        if (_showList)
                          entryButton()
                        else if (release != null)
                          _chromeAction(
                            label: l10n.repositoryReleasesTitle,
                            icon: Icons.list_alt,
                            onPressed: () => setState(() {
                              _listScope = (
                                owner: release.owner,
                                repository: release.repository,
                                opening: _opening,
                              );
                              _visitedLists.add(_listScope!);
                              _showList = true;
                            }),
                          ),
                        // Leaving for GitHub keeps one slot whether a release or
                        // that repository's release list is open, so it is never
                        // reached by scrolling past the notes.
                        if (githubUrl != null)
                          _chromeAction(
                            label: l10n.releaseOpenOnGitHub,
                            icon: Icons.open_in_new,
                            onPressed: () =>
                                _openLink(githubUrl, external: true),
                          ),
                        _chromeAction(
                          label: l10n.releaseClose,
                          icon: Icons.close,
                          autofocus: true,
                          onPressed: _close,
                        ),
                      ],
                    ),
                  ),
                  Divider(
                    height: GitPulseStroke.hairline,
                    thickness: GitPulseStroke.hairline,
                    color: toneRule(theme.colorScheme),
                  ),
                ],
              ),
            ),
            Expanded(
              // Keep the current document mounted behind the list so returning
              // does not restart its WebView or lose its reading position. Only
              // the visible body attaches to the sheet's scroll controller.
              child: Stack(
                fit: StackFit.expand,
                children: [
                  Offstage(
                    offstage: _showList,
                    child: result.when(
                      skipLoadingOnRefresh: false,
                      loading: () => _scrollableBody(
                        controller: _showList ? null : controller,
                        child: GitPulseLoadingView(label: l10n.releaseLoading),
                      ),
                      error: (error, stack) => _scrollableBody(
                        controller: _showList ? null : controller,
                        child: _ReleaseFailure(
                          failure: ReleaseDetailFailure.server,
                          onRetry: () =>
                              ref.invalidate(releaseDetailProvider(_target)),
                        ),
                      ),
                      data: (data) => data.release == null
                          ? _scrollableBody(
                              controller: _showList ? null : controller,
                              child: _ReleaseFailure(
                                failure: data.failure!,
                                onRetry: () => ref.invalidate(
                                  releaseDetailProvider(_target),
                                ),
                              ),
                            )
                          : _documentBody(
                              controller: _showList ? null : controller,
                              child: ReleaseDetailsView(
                                key: ValueKey(_target),
                                release: data.release!,
                                headerBuilder: dragRegion,
                                onTapUrl: _openLink,
                                onOpenExternal: (url) =>
                                    _openLink(url, external: true),
                              ),
                            ),
                    ),
                  ),
                  if (_showList && listState != null)
                    RepositoryReleasesView(
                      key: ValueKey(_listScope),
                      state: listState,
                      scrollController: controller,
                      onPage: (page) =>
                          _listController(_listScope!).loadPage(page),
                      onFilter: (filter) =>
                          _listController(_listScope!).setFilter(filter),
                      isEntry: (item) =>
                          _entryIdentity?.owner.toLowerCase() ==
                              _listScope!.owner.toLowerCase() &&
                          _entryIdentity?.repository.toLowerCase() ==
                              _listScope!.repository.toLowerCase() &&
                          _entryIdentity?.id == item.id,
                      onRelease: (item) => setState(() {
                        _target = (
                          owner: _listScope!.owner,
                          repository: _listScope!.repository,
                          id: item.id,
                          tag: null,
                        );
                        _showList = false;
                      }),
                    ),
                ],
              ),
            ),
          ],
        ),
      );
    }

    return KeyedSubtree(
      key: const Key('release-drawer'),
      child: NotificationListener<DraggableScrollableNotification>(
        onNotification: (notification) {
          if (notification.extent <= notification.minExtent &&
              notification.shouldCloseOnMinExtent) {
            _close();
          }
          return false;
        },
        child: DraggableScrollableSheet(
          controller: _sheetController,
          initialChildSize: releaseDrawerOpeningExtent,
          minChildSize: dismissExtent,
          maxChildSize: 1,
          expand: false,
          snap: true,
          snapSizes: const [releaseDrawerOpeningExtent],
          builder: (context, controller) => panel(controller: controller),
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
    return Column(
      children: [
        Text(switch (failure) {
          ReleaseDetailFailure.unavailable => l10n.releaseUnavailable,
          ReleaseDetailFailure.network => l10n.timelineErrorNetwork,
          ReleaseDetailFailure.rateLimited => l10n.timelineErrorRateLimited,
          _ => l10n.releaseFailed,
        }),
        const SizedBox(height: 12),
        GitPulseButton(
          label: l10n.timelineRetry,
          variant: GitPulseButtonVariant.outlined,
          onPressed: onRetry,
        ),
      ],
    );
  }
}
