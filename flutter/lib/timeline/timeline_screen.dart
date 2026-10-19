import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../l10n/generated/app_localizations.dart';
import 'release_timeline_card.dart';
import 'timeline_date_labels.dart';
import 'timeline_layout.dart';
import 'timeline_models.dart';
import 'timeline_session.dart';
import 'timeline_state.dart';
import 'timeline_toolbar.dart';

/// The Release Timeline: published releases of the account's Followed
/// Repositories, grouped by display date, with the shared Timeline Refresh
/// Baseline and its loaded-new count.
class TimelineScreen extends ConsumerWidget {
  const TimelineScreen({super.key, this.showTitle = true});

  final bool showTitle;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final state = ref.watch(releaseTimelineSessionProvider);
    Future<void> refresh() =>
        ref.read(releaseTimelineSessionProvider.notifier).refresh();
    Future<void> retry() =>
        ref.read(releaseTimelineSessionProvider.notifier).retryFailed();
    Future<void> loadOlder() =>
        ref.read(releaseTimelineSessionProvider.notifier).loadOlder();

    return LayoutBuilder(
      builder: (context, constraints) => Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          TimelineToolbar(
            state: state,
            onRefresh: refresh,
            showTitle: showTitle,
          ),
          if (state.hasLookupFailures)
            ConstrainedBox(
              constraints: BoxConstraints(
                maxHeight: constraints.maxHeight * 0.35,
              ),
              child: SingleChildScrollView(
                child: _LookupFailureBanner(state: state, onRetry: retry),
              ),
            ),
          Expanded(
            child: _Body(
              state: state,
              columns: resolveTimelineColumnCount(constraints.maxWidth),
              onRetry: retry,
              onLoadOlder: loadOlder,
              onRefresh: refresh,
            ),
          ),
        ],
      ),
    );
  }
}

class _Body extends StatelessWidget {
  const _Body({
    required this.state,
    required this.columns,
    required this.onRefresh,
    required this.onRetry,
    required this.onLoadOlder,
  });

  final TimelineViewState state;
  final int columns;
  final Future<void> Function() onRefresh;
  final Future<void> Function() onRetry;
  final Future<void> Function() onLoadOlder;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);

    if (state.loading && !state.hasReleases) {
      return const _LoadingState();
    }
    // A failure outranks the no-follows state: a Followed Repository read that
    // failed has not established that the account follows nothing.
    if (state.failure != null && !state.hasReleases) {
      return _FailureState(state: state, onRetry: onRetry);
    }
    if (!state.hasFollows) {
      return _EmptyState(
        icon: Icons.rocket_launch_outlined,
        title: l10n.timelineEmptyTitle,
        description: l10n.timelineEmptyDescription,
        hint: l10n.timelineEmptyFollowsHint,
      );
    }
    if (state.hasReleases) {
      return _TimelineList(
        state: state,
        columns: columns,
        onRefresh: onRefresh,
        onRetry: onRetry,
        onLoadOlder: onLoadOlder,
      );
    }
    return Column(
      children: [
        Expanded(
          child: _EmptyState(
            icon: Icons.inbox_outlined,
            title: l10n.timelineEmptyReleasesTitle,
            description: l10n.timelineEmptyReleasesDescription,
          ),
        ),
        Padding(
          padding: const EdgeInsets.all(16),
          child: _StatusFooter(
            state: state,
            onRetry: onRetry,
            onLoadOlder: onLoadOlder,
            onRefresh: onRefresh,
          ),
        ),
      ],
    );
  }
}

class _LoadingState extends StatelessWidget {
  const _LoadingState();

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    return Center(
      child: Semantics(
        label: l10n.timelineLoading,
        liveRegion: true,
        child: const CircularProgressIndicator(),
      ),
    );
  }
}

class _EmptyState extends StatelessWidget {
  const _EmptyState({
    required this.icon,
    required this.title,
    required this.description,
    this.hint,
  });

  final IconData icon;
  final String title;
  final String description;
  final String? hint;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(icon, size: 32, color: theme.colorScheme.primary),
            const SizedBox(height: 12),
            Text(title, style: theme.textTheme.titleMedium),
            const SizedBox(height: 6),
            Text(
              description,
              textAlign: TextAlign.center,
              style: theme.textTheme.bodyMedium?.copyWith(
                color: theme.colorScheme.onSurfaceVariant,
              ),
            ),
            if (hint case final hint?) ...[
              const SizedBox(height: 6),
              Text(
                hint,
                textAlign: TextAlign.center,
                style: theme.textTheme.bodySmall?.copyWith(
                  color: theme.colorScheme.onSurfaceVariant,
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }
}

class _FailureState extends StatelessWidget {
  const _FailureState({required this.state, required this.onRetry});

  final TimelineViewState state;
  final Future<void> Function() onRetry;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final theme = Theme.of(context);
    final failure = state.failure;
    final message = switch (failure?.kind) {
      TimelineFailureKind.network => l10n.timelineErrorNetwork,
      TimelineFailureKind.rateLimited => l10n.timelineErrorRateLimited,
      TimelineFailureKind.session => l10n.sessionExpired,
      _ => l10n.timelineErrorServer,
    };

    return Center(
      child: SingleChildScrollView(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(Icons.error_outline, size: 32, color: theme.colorScheme.error),
            const SizedBox(height: 12),
            Text(l10n.timelineError, style: theme.textTheme.titleMedium),
            const SizedBox(height: 6),
            Semantics(
              liveRegion: true,
              child: Text(
                message,
                textAlign: TextAlign.center,
                style: theme.textTheme.bodyMedium?.copyWith(
                  color: theme.colorScheme.onSurfaceVariant,
                ),
              ),
            ),
            if (failure == null || failure.retryable) ...[
              const SizedBox(height: 12),
              FilledButton.tonal(
                onPressed: state.loading ? null : () => onRetry(),
                child: Text(l10n.timelineRetry),
              ),
            ],
          ],
        ),
      ),
    );
  }
}

class _LookupFailureBanner extends StatelessWidget {
  const _LookupFailureBanner({required this.state, required this.onRetry});

  final TimelineViewState state;
  final Future<void> Function() onRetry;

  static String _names(List<TimelineRepository> repositories) =>
      repositories.map((repository) => repository.fullName).join(', ');

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final theme = Theme.of(context);

    return Container(
      margin: const EdgeInsets.fromLTRB(16, 8, 16, 0),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        border: Border.all(color: theme.colorScheme.errorContainer),
        borderRadius: BorderRadius.circular(12),
        color: theme.colorScheme.errorContainer.withValues(alpha: 0.35),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (state.unavailableRepositories.isNotEmpty) ...[
            Text(
              l10n.timelineBannerUnavailableTitle,
              style: theme.textTheme.titleSmall,
            ),
            Text(
              l10n.timelineBannerUnavailableDescription(
                _names(state.unavailableRepositories),
              ),
              style: theme.textTheme.bodySmall,
            ),
          ],
          if (state.transientRepositories.isNotEmpty) ...[
            Text(
              l10n.timelineBannerTransientTitle,
              style: theme.textTheme.titleSmall,
            ),
            Text(
              l10n.timelineBannerTransientDescription(
                _names(state.transientRepositories),
              ),
              style: theme.textTheme.bodySmall,
            ),
          ],
          const SizedBox(height: 8),
          Align(
            alignment: Alignment.centerLeft,
            child: OutlinedButton(
              onPressed: state.loading ? null : () => onRetry(),
              child: Text(l10n.timelineRetry),
            ),
          ),
        ],
      ),
    );
  }
}

class _TimelineList extends StatefulWidget {
  const _TimelineList({
    required this.state,
    required this.columns,
    required this.onRefresh,
    required this.onRetry,
    required this.onLoadOlder,
  });

  final TimelineViewState state;
  final int columns;
  final Future<void> Function() onRefresh;
  final Future<void> Function() onRetry;
  final Future<void> Function() onLoadOlder;

  @override
  State<_TimelineList> createState() => _TimelineListState();
}

class _TimelineListState extends State<_TimelineList> {
  final _centerKey = GlobalKey();
  final _cardKeys = <String, GlobalKey>{};
  ScrollController _controller = ScrollController(keepScrollOffset: false);
  String? _anchor;

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  void didUpdateWidget(_TimelineList oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (identical(oldWidget.state.groups, widget.state.groups)) return;
    final viewport = context.findRenderObject() as RenderBox?;
    if (viewport == null || !viewport.hasSize) return;
    final top = viewport.localToGlobal(Offset.zero).dy;
    final bottom = top + viewport.size.height;
    String? anchor;
    double? anchorTop;
    final remaining = {
      for (final group in widget.state.groups)
        for (final item in group.items) item.key,
    };
    for (final entry in _cardKeys.entries) {
      if (!remaining.contains(entry.key)) continue;
      final box = entry.value.currentContext?.findRenderObject() as RenderBox?;
      if (box == null || !box.attached || !box.hasSize) continue;
      final y = box.localToGlobal(Offset.zero).dy;
      if (y + box.size.height <= top || y >= bottom) continue;
      if (anchorTop == null || y < anchorTop) {
        anchor = entry.key;
        anchorTop = y;
      }
    }
    if (anchor == null || anchorTop == null) return;
    // Put the row containing the visible release at the scroll view's center.
    // Rows inserted above it then grow upwards, including unbuilt, variable
    // height rows. This needs no estimate of their combined height.
    _anchor = anchor;
    final previous = _controller;
    _controller = ScrollController(
      initialScrollOffset: top - anchorTop,
      keepScrollOffset: false,
    );
    final savedTop = anchorTop;
    WidgetsBinding.instance.addPostFrameCallback((_) {
      previous.dispose();
      if (!mounted || !_controller.hasClients) return;
      final box =
          _cardKeys[anchor]?.currentContext?.findRenderObject() as RenderBox?;
      if (box == null || !box.attached || !box.hasSize) return;
      // Header/banner height changes can move the viewport as well.
      final delta = box.localToGlobal(Offset.zero).dy - savedTop;
      if (delta.abs() > 0.1) {
        _controller.jumpTo(_controller.offset + delta);
      }
      _cardKeys.removeWhere((key, _) => !remaining.contains(key));
    });
  }

  Key _rowKey(TimelineRow row) => ValueKey(switch (row) {
    TimelineDateRow(:final date) => 'date/$date',
    TimelineCardsRow(:final items) => 'cards/${items.first.key}',
    TimelineBaselineRow(:final timestamp) => 'baseline/$timestamp',
  });

  Widget _row(TimelineRow row) => KeyedSubtree(
    key: _rowKey(row),
    child: switch (row) {
      TimelineDateRow(:final date) => _DateHeader(date: date),
      TimelineCardsRow(:final items) => _CardsRow(
        items: items,
        columns: widget.columns,
        cardKey: (key) => _cardKeys.putIfAbsent(key, () => GlobalKey()),
      ),
      TimelineBaselineRow(:final timestamp) => _BaselineDivider(
        timestamp: timestamp,
      ),
    },
  );

  @override
  Widget build(BuildContext context) {
    final rows = buildTimelineRows(
      widget.state.groups,
      widget.columns,
      widget.state.baselineExposed ? widget.state.previousBaseline : null,
    );
    final found = rows.indexWhere(
      (row) =>
          row is TimelineCardsRow &&
          row.items.any((item) => item.key == _anchor),
    );
    final pivot = found < 0 ? 0 : found;
    final before = rows.take(pivot).toList().reversed.toList();
    final after = rows.skip(pivot).toList();
    final beforeIndices = {
      for (var i = 0; i < before.length; i++) _rowKey(before[i]): i,
    };
    final afterIndices = {
      for (var i = 0; i < after.length; i++) _rowKey(after[i]): i,
    };

    return CustomScrollView(
      key: ObjectKey(_controller),
      controller: _controller,
      center: _centerKey,
      slivers: [
        SliverPadding(
          padding: const EdgeInsets.symmetric(horizontal: 16),
          sliver: SliverList.builder(
            itemCount: before.length,
            findChildIndexCallback: (key) => beforeIndices[key],
            itemBuilder: (context, index) => _row(before[index]),
          ),
        ),
        SliverPadding(
          key: _centerKey,
          padding: const EdgeInsets.fromLTRB(16, 0, 16, 24),
          sliver: SliverList.builder(
            itemCount: after.length + 1,
            findChildIndexCallback: (key) => afterIndices[key],
            itemBuilder: (context, index) => index < after.length
                ? _row(after[index])
                : _StatusFooter(
                    state: widget.state,
                    onRefresh: widget.onRefresh,
                    onRetry: widget.onRetry,
                    onLoadOlder: widget.onLoadOlder,
                  ),
          ),
        ),
      ],
    );
  }
}

class _DateHeader extends StatelessWidget {
  const _DateHeader({required this.date});

  final String date;

  @override
  Widget build(BuildContext context) {
    return _RuleRow(
      padding: const EdgeInsets.fromLTRB(0, 16, 0, 8),
      child: Text(
        timelineDateLabel(context, date),
        style: Theme.of(context).textTheme.titleSmall,
      ),
    );
  }
}

class _BaselineDivider extends StatelessWidget {
  const _BaselineDivider({required this.timestamp});

  final DateTime timestamp;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final theme = Theme.of(context);
    return _RuleRow(
      padding: const EdgeInsets.fromLTRB(0, 12, 0, 12),
      child: Text(
        '${l10n.timelinePreviousRefreshMark} · '
        '${timelineTimeLabel(context, timestamp.toLocal())}',
        style: theme.textTheme.labelSmall?.copyWith(
          color: theme.colorScheme.onSurfaceVariant,
        ),
      ),
    );
  }
}

/// A label between two full-width rules: a date header, or the Previous Refresh
/// marker at its publication-time position.
class _RuleRow extends StatelessWidget {
  const _RuleRow({required this.child, required this.padding});

  final Widget child;
  final EdgeInsetsGeometry padding;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Padding(
      padding: padding,
      child: Row(
        children: [
          Expanded(child: Divider(color: theme.dividerColor)),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 10),
            child: child,
          ),
          Expanded(child: Divider(color: theme.dividerColor)),
        ],
      ),
    );
  }
}

class _CardsRow extends StatelessWidget {
  const _CardsRow({
    required this.items,
    required this.columns,
    required this.cardKey,
  });

  final List<TimelineRelease> items;
  final int columns;
  final Key Function(String) cardKey;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: IntrinsicHeight(
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            for (var column = 0; column < columns; column++) ...[
              if (column > 0) const SizedBox(width: 12),
              Expanded(
                child: column < items.length
                    ? ReleaseTimelineCard(
                        key: cardKey(items[column].key),
                        item: items[column],
                      )
                    : const SizedBox.shrink(),
              ),
            ],
          ],
        ),
      ),
    );
  }
}

class _StatusFooter extends StatelessWidget {
  const _StatusFooter({
    required this.state,
    required this.onRefresh,
    required this.onRetry,
    required this.onLoadOlder,
  });

  final TimelineViewState state;
  final Future<void> Function() onRefresh;
  final Future<void> Function() onRetry;
  final Future<void> Function() onLoadOlder;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final theme = Theme.of(context);

    return Padding(
      padding: const EdgeInsets.only(top: 8),
      child: Wrap(
        alignment: WrapAlignment.center,
        crossAxisAlignment: WrapCrossAlignment.center,
        spacing: 12,
        runSpacing: 8,
        children: [
          if (state.cacheConnection != TimelineCacheConnection.none)
            Semantics(
              liveRegion: true,
              child: Text(
                state.cacheConnection == TimelineCacheConnection.waiting
                    ? l10n.timelineCacheWaiting(
                        state.waitingRepositories
                            .map((repository) => repository.fullName)
                            .join(', '),
                      )
                    : l10n.timelineCacheConnected,
                style: theme.textTheme.bodySmall,
              ),
            ),
          if (state.partial)
            Text(
              l10n.timelinePartialWindow,
              style: theme.textTheme.bodySmall?.copyWith(
                color: theme.colorScheme.onSurfaceVariant,
              ),
            ),
          if (state.persistenceFailed)
            Semantics(
              liveRegion: true,
              child: Text(
                l10n.timelinePersistenceError,
                style: theme.textTheme.bodySmall,
              ),
            ),
          if (state.canLoadOlder)
            FilledButton.tonal(
              onPressed: state.loading ? null : () => onLoadOlder(),
              child: Text(l10n.timelineLoadOlder),
            ),
          if (state.failure != null)
            Text(switch (state.failure!.kind) {
              TimelineFailureKind.network => l10n.timelineErrorNetwork,
              TimelineFailureKind.rateLimited => l10n.timelineErrorRateLimited,
              _ => l10n.timelineErrorServer,
            }),
          if (state.canRetry)
            OutlinedButton(
              onPressed: state.loading ? null : () => onRetry(),
              child: Text(l10n.timelineRetry),
            ),
          if (state.persistenceFailed)
            OutlinedButton(
              onPressed: state.loading ? null : () => onRefresh(),
              child: Text(l10n.timelineReload),
            ),
        ],
      ),
    );
  }
}
