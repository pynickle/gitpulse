import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../l10n/generated/app_localizations.dart';
import '../session/native_login_handoff.dart';
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

  Future<bool> _openLink(String value, {bool external = false}) async {
    final uri = safeContentUri(value);
    if (uri == null) return true;
    final target = external ? null : releaseTargetFromUri(uri);
    if (target != null) {
      setState(() => _target = target);
      return true;
    }
    try {
      if (await ref.read(browserLauncherProvider)(uri)) return true;
    } catch (_) {
      // Report failed browser launches locally without falling back to a WebView.
    }
    if (mounted) {
      ScaffoldMessenger.maybeOf(context)?.showSnackBar(
        SnackBar(content: Text(AppLocalizations.of(context).releaseLinkFailed)),
      );
    }
    return true;
  }

  @override
  Widget build(BuildContext context) {
    final session = ref.watch(sessionControllerProvider);
    ref.listen(sessionControllerProvider, (previous, next) {
      if (next.phase != SessionPhase.signedIn ||
          previous?.identity?.backend != next.identity?.backend ||
          previous?.identity?.login != next.identity?.login) {
        WidgetsBinding.instance.addPostFrameCallback((_) {
          if (mounted && ModalRoute.of(context)?.isCurrent == true) {
            Navigator.of(context).pop();
          }
        });
      }
    });
    if (session.phase != SessionPhase.signedIn ||
        session.identity?.backend != _identity?.backend ||
        session.identity?.login != _identity?.login) {
      return const SizedBox.shrink();
    }
    final result = ref.watch(releaseDetailProvider(_target));
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
    // Keep every visited list alive for this opening, including while reading
    // another repository's release. Closing the drawer releases all of them.
    final listStates = {
      for (final scope in _visitedLists)
        scope: ref.watch(repositoryReleasesControllerProvider(scope)),
    };
    final listState = listStates[_listScope];
    final l10n = AppLocalizations.of(context);

    Widget panel({
      ScrollController? controller,
      bool sheet = false,
      double availableHeight = 1,
    }) => Material(
      key: const Key('release-drawer'),
      color: Theme.of(context).colorScheme.surface,
      borderRadius: sheet
          ? const BorderRadius.vertical(top: Radius.circular(20))
          : null,
      clipBehavior: Clip.antiAlias,
      child: SafeArea(
        child: Column(
          children: [
            if (sheet)
              Semantics(
                button: true,
                label: l10n.releaseResizeSheet,
                child: GestureDetector(
                  key: const Key('release-sheet-handle'),
                  behavior: HitTestBehavior.opaque,
                  onTap: () => _snapSheet(_sheetController.size < .85 ? 1 : .7),
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
                  child: const SizedBox(
                    height: 28,
                    width: double.infinity,
                    child: Center(
                      child: SizedBox(width: 40, child: Divider(thickness: 4)),
                    ),
                  ),
                ),
              ),
            Row(
              children: [
                if (_showList || _target != _entry)
                  IconButton(
                    tooltip: l10n.releaseEntry,
                    onPressed: () => setState(() {
                      _target = _entry;
                      _showList = false;
                    }),
                    icon: const Icon(Icons.arrow_back),
                  ),
                const SizedBox(width: 16),
                Expanded(
                  child: Text(
                    _showList
                        ? l10n.repositoryReleasesTitle
                        : l10n.releaseDetails,
                    style: Theme.of(context).textTheme.titleMedium,
                  ),
                ),
                IconButton(
                  autofocus: true,
                  tooltip: l10n.releaseClose,
                  onPressed: () => Navigator.of(context).pop(),
                  icon: const Icon(Icons.close),
                ),
              ],
            ),
            const Divider(height: 1),
            Expanded(
              child: SingleChildScrollView(
                key: ValueKey(_showList ? _listScope : _target),
                controller: controller,
                padding: const EdgeInsets.all(20),
                child: _showList && listState != null
                    ? RepositoryReleasesView(
                        repository:
                            '${_listScope!.owner}/${_listScope!.repository}',
                        state: listState,
                        onPage: (page) => ref
                            .read(
                              repositoryReleasesControllerProvider(_listScope!)
                                  .notifier,
                            )
                            .loadPage(page),
                        onFilter: (filter) => ref
                            .read(
                              repositoryReleasesControllerProvider(_listScope!)
                                  .notifier,
                            )
                            .setFilter(filter),
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
                    : result.when(
                        skipLoadingOnRefresh: false,
                        loading: () => Semantics(
                          label: l10n.releaseLoading,
                          child: const Center(
                            child: CircularProgressIndicator(),
                          ),
                        ),
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
                                onOpenReleases: () => setState(() {
                                  _listScope = (
                                    owner: data.release!.owner,
                                    repository: data.release!.repository,
                                    opening: _opening,
                                  );
                                  _visitedLists.add(_listScope!);
                                  _showList = true;
                                }),
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
                  width: math.min(680, constraints.maxWidth * .7),
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
