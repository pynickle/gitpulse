import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../l10n/generated/app_localizations.dart';
import '../presentation/gitpulse_state_views.dart';
import '../presentation/gitpulse_tokens.dart';
import '../repositories/repository_navigation.dart';
import '../session/session_controller.dart';
import '../timeline/timeline_layout.dart';
import 'document_content.dart';
import 'release_detail_service.dart';
import 'release_details_view.dart';
import 'repository_releases_controller.dart';
import 'repository_releases_view.dart';

Future<void> showReleaseDrawer(BuildContext context, ReleaseTarget entry) {
  return showGeneralDialog<void>(
    context: context,
    barrierDismissible: true,
    barrierLabel: AppLocalizations.of(context).releaseClose,
    requestFocus: true,
    pageBuilder: (context, animation, secondaryAnimation) =>
        ReleaseDrawer(entry: entry),
  );
}

/// One action in the chrome line's icon slots.
Widget _chromeAction({
  required String tooltip,
  required IconData icon,
  required VoidCallback onPressed,
  bool autofocus = false,
}) => IconButton(
  tooltip: tooltip,
  autofocus: autofocus,
  onPressed: onPressed,
  icon: Icon(icon),
);

/// How thick the phone sheet's grab handle is drawn.
///
/// Not a rule line and not a stroke width: it is the affordance that says the
/// sheet can be dragged, so its size answers to the finger rather than to the
/// ink hierarchy (MASTER §12 E4).
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
  ReleaseTarget? _entryIdentity;
  late final _identity = ref.read(sessionControllerProvider).identity;
  final _sheetController = DraggableScrollableController();

  @override
  void dispose() {
    _sheetController.dispose();
    super.dispose();
  }

  void _snapSheet(double extent) {
    if (!_sheetController.isAttached) return;
    _sheetController.animateTo(
      extent,
      duration: const Duration(milliseconds: 180),
      curve: Curves.easeOut,
    );
  }

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
      tooltip: l10n.releaseEntry,
      icon: Icons.arrow_back,
      onPressed: () => setState(() {
        _target = _entry;
        _showList = false;
      }),
    );

    Widget panel({
      ScrollController? controller,
      bool sheet = false,
      double availableHeight = 1,
    }) {
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

      return Material(
        key: const Key('release-drawer'),
        color: theme.colorScheme.surface,
        borderRadius: sheet
            ? const BorderRadius.vertical(top: Radius.circular(20))
            : null,
        clipBehavior: Clip.antiAlias,
        // The sheet's top edge sits in the middle of the screen, so the status
        // bar inset above it is screen the notes could be using. The wide
        // panel does run to the top edge, so it keeps that inset.
        child: SafeArea(
          top: !sheet,
          child: Column(
            children: [
              if (sheet)
                Semantics(
                  button: true,
                  label: l10n.releaseResizeSheet,
                  child: GestureDetector(
                    key: const Key('release-sheet-handle'),
                    behavior: HitTestBehavior.opaque,
                    onTap: () =>
                        _snapSheet(_sheetController.size < .85 ? 1 : .7),
                    onVerticalDragUpdate: (details) {
                      if (_sheetController.isAttached) {
                        _sheetController.jumpTo(
                          (_sheetController.size -
                                  details.delta.dy / availableHeight)
                              .clamp(.4, 1),
                        );
                      }
                    },
                    onVerticalDragEnd: (_) {
                      if (_sheetController.isAttached) {
                        _snapSheet(_sheetController.size > .85 ? 1 : .7);
                      }
                    },
                    child: SizedBox(
                      height: 28,
                      width: double.infinity,
                      child: Center(
                        child: SizedBox(
                          width: 40,
                          // The sheet's grab affordance rather than a rule: it
                          // is toned as a line inside the sheet so it is the
                          // app's one tone and not a theme default
                          // (MASTER §7, §12 E4).
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
                height: 48,
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
                            padding: const EdgeInsets.only(left: 12, right: 4),
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
                                        style: theme.textTheme.titleSmall,
                                      ),
                                    ),
                                    const SizedBox(width: 6),
                                  ],
                                  Expanded(
                                    child: Text(
                                      '$owner/$repository',
                                      maxLines: 1,
                                      overflow: TextOverflow.ellipsis,
                                      style: theme.textTheme.bodySmall
                                          ?.copyWith(
                                            color: theme
                                                .colorScheme
                                                .onSurfaceVariant,
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
                        tooltip: l10n.repositoryReleasesTitle,
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
                        tooltip: l10n.releaseOpenOnGitHub,
                        icon: Icons.open_in_new,
                        onPressed: () => _openLink(githubUrl, external: true),
                      ),
                    _chromeAction(
                      tooltip: l10n.releaseClose,
                      icon: Icons.close,
                      autofocus: true,
                      onPressed: () => Navigator.of(context).pop(),
                    ),
                  ],
                ),
              ),
              Divider(
                height: GitPulseStroke.hairline,
                thickness: GitPulseStroke.hairline,
                color: toneRule(theme.colorScheme),
              ),
              Expanded(
                // The Repository Release List owns its own bands and scrolls
                // inside itself, so the filter bar and pager stay put; the
                // sheet's controller still reaches it, so a drag on the rows
                // moves the sheet exactly as a drag on the notes does.
                child: _showList && listState != null
                    ? RepositoryReleasesView(
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
                      )
                    : SingleChildScrollView(
                        key: ValueKey(_target),
                        controller: controller,
                        padding: const EdgeInsets.all(20),
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
                                  onRetry: () => ref.invalidate(
                                    releaseDetailProvider(_target),
                                  ),
                                )
                              : ReleaseDetailsView(
                                  release: data.release!,
                                  onTapUrl: _openLink,
                                  onOpenExternal: (url) =>
                                      _openLink(url, external: true),
                                ),
                        ),
                      ),
              ),
            ],
          ),
        ),
      );
    }

    return Shortcuts(
      shortcuts: const {
        SingleActivator(LogicalKeyboardKey.escape): DismissIntent(),
      },
      child: Actions(
        actions: {
          DismissIntent: CallbackAction<DismissIntent>(
            onInvoke: (_) {
              Navigator.of(context).pop();
              return null;
            },
          ),
        },
        child: LayoutBuilder(
          builder: (context, constraints) {
            if (constraints.maxWidth > releaseTimelinePhoneMaxWidth) {
              return Align(
                alignment: Alignment.centerRight,
                child: SizedBox(
                  width: releaseDrawerPanelWidth(constraints.maxWidth),
                  height: constraints.maxHeight,
                  child: panel(),
                ),
              );
            }
            return Align(
              alignment: Alignment.bottomCenter,
              child: NotificationListener<DraggableScrollableNotification>(
                onNotification: (notification) {
                  if (notification.extent <= notification.minExtent &&
                      notification.shouldCloseOnMinExtent) {
                    Navigator.of(context).pop();
                  }
                  return false;
                },
                child: DraggableScrollableSheet(
                  controller: _sheetController,
                  initialChildSize: .7,
                  minChildSize: .4,
                  maxChildSize: 1,
                  expand: false,
                  snap: true,
                  snapSizes: const [.7],
                  builder: (context, controller) => panel(
                    controller: controller,
                    sheet: true,
                    availableHeight: constraints.maxHeight,
                  ),
                ),
              ),
            );
          },
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
        OutlinedButton(onPressed: onRetry, child: Text(l10n.timelineRetry)),
      ],
    );
  }
}
