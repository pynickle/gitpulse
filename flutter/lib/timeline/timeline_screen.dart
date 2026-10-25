import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../l10n/generated/app_localizations.dart';
import '../presentation/gitpulse_formatting.dart';
import '../presentation/gitpulse_state_views.dart';
import '../presentation/gitpulse_tokens.dart';
import 'release_timeline_card.dart';
import 'timeline_cache.dart';
import 'timeline_filter_panel.dart';
import 'timeline_layout.dart';
import 'timeline_models.dart';
import 'timeline_session.dart';
import 'timeline_state.dart';
import 'timeline_toolbar.dart';

/// The Release Timeline: published releases of the account's Followed
/// Repositories, grouped by display date, with the shared Timeline Refresh
/// Baseline and its loaded-new count.
class TimelineScreen extends ConsumerWidget {
  const TimelineScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final state = ref.watch(releaseTimelineSessionProvider);
    final now = ref.watch(timelineClockProvider)();
    final localDateKey = ref.watch(timelineEnvironmentProvider).localDateKey;
    Future<void> refresh() =>
        ref.read(releaseTimelineSessionProvider.notifier).refresh();
    Future<void> retry() =>
        ref.read(releaseTimelineSessionProvider.notifier).retryFailed();
    Future<void> loadOlder() =>
        ref.read(releaseTimelineSessionProvider.notifier).loadOlder();
    void openFilters() => showTimelineFilterPanel(context);

    return LayoutBuilder(
      builder: (context, constraints) => Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          TimelineToolbar(
            state: state,
            onRefresh: refresh,
            onFiltersChanged: (filters) => ref
                .read(releaseTimelineSessionProvider.notifier)
                .applyFilters(filters),
            onOpenFilters: openFilters,
            onRetryCache: ref
                .read(releaseTimelineSessionProvider.notifier)
                .retryCache,
            onRebuildCache: ref
                .read(releaseTimelineSessionProvider.notifier)
                .rebuildCache,
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
              now: now,
              localDateKey: localDateKey,
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
    required this.now,
    required this.localDateKey,
    required this.onRefresh,
    required this.onRetry,
    required this.onLoadOlder,
  });

  final TimelineViewState state;
  final int columns;
  final DateTime now;
  final String Function(DateTime instant) localDateKey;
  final Future<void> Function() onRefresh;
  final Future<void> Function() onRetry;
  final Future<void> Function() onLoadOlder;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);

    if (state.loading && !state.hasExposedReleases) {
      return GitPulseLoadingView(label: l10n.timelineLoading);
    }
    // A failure outranks the no-follows state: a Followed Repository read that
    // failed has not established that the account follows nothing.
    if (state.failure != null && !state.hasExposedReleases) {
      return _FailureState(state: state, onRetry: onRetry);
    }
    if (!state.hasFollows) {
      return GitPulseMessageView(
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
        now: now,
        localDateKey: localDateKey,
        onRefresh: onRefresh,
        onRetry: onRetry,
        onLoadOlder: onLoadOlder,
      );
    }
    // No visible releases, but the footer stays so an Active Timeline Filter
    // can never prevent explicitly loading more history.
    return Column(
      children: [
        Expanded(
          child: state.filteredEmpty
              ? GitPulseMessageView(
                  icon: Icons.filter_alt_off_outlined,
                  title: l10n.timelineFilteredEmptyTitle,
                  description: l10n.timelineFilteredEmptyDescription,
                )
              : GitPulseMessageView(
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

class _FailureState extends StatelessWidget {
  const _FailureState({required this.state, required this.onRetry});

  final TimelineViewState state;
  final Future<void> Function() onRetry;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final failure = state.failure;
    final message = switch (failure?.kind) {
      TimelineFailureKind.network => l10n.timelineErrorNetwork,
      TimelineFailureKind.rateLimited => l10n.timelineErrorRateLimited,
      TimelineFailureKind.session => l10n.sessionExpired,
      _ => l10n.timelineErrorServer,
    };

    return GitPulseMessageView(
      icon: Icons.error_outline,
      tone: GitPulseMessageTone.error,
      title: l10n.timelineError,
      description: message,
      liveRegion: true,
      action: failure == null || failure.retryable
          ? FilledButton.tonal(
              onPressed: state.loading ? null : () => onRetry(),
              child: Text(l10n.timelineRetry),
            )
          : null,
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
        borderRadius: BorderRadius.circular(GitPulseRadius.surface),
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
    required this.now,
    required this.localDateKey,
    required this.onRefresh,
    required this.onRetry,
    required this.onLoadOlder,
  });

  final TimelineViewState state;
  final int columns;
  final DateTime now;
  final String Function(DateTime instant) localDateKey;
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
    if (identical(oldWidget.state.visibleGroups, widget.state.visibleGroups)) {
      return;
    }
    final viewport = context.findRenderObject() as RenderBox?;
    if (viewport == null || !viewport.hasSize) return;
    final top = viewport.localToGlobal(Offset.zero).dy;
    final bottom = top + viewport.size.height;
    String? anchor;
    double? anchorTop;
    final remaining = {
      for (final group in widget.state.visibleGroups)
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
      TimelineBaselineRow(:final timestamp, :final includeDate) =>
        _PreviousRefreshMark(
          timestamp: timestamp,
          includeDate: includeDate,
          now: widget.now,
          localDateKey: widget.localDateKey,
        ),
    },
  );

  @override
  Widget build(BuildContext context) {
    final rows = buildTimelineRows(
      widget.state.visibleGroups,
      widget.columns,
      widget.state.baselineExposed ? widget.state.previousBaseline : null,
      localDateKey: widget.localDateKey,
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
          padding: const EdgeInsets.symmetric(
            horizontal: releaseTimelineHorizontalPadding,
          ),
          sliver: SliverList.builder(
            itemCount: before.length,
            findChildIndexCallback: (key) => beforeIndices[key],
            itemBuilder: (context, index) => _row(before[index]),
          ),
        ),
        SliverPadding(
          key: _centerKey,
          padding: const EdgeInsets.fromLTRB(
            releaseTimelineHorizontalPadding,
            0,
            releaseTimelineHorizontalPadding,
            24,
          ),
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
        gitPulseDate(context, date),
        style: Theme.of(context).textTheme.titleSmall,
      ),
    );
  }
}

/// The in-list Previous Refresh marker.
///
/// It must not read as a day group, so it deliberately shares nothing visual
/// with [_DateHeader]: the title is a small, letter-spaced, accent-coloured
/// label flush with the left edge of the cards, the instant is an unemphasized
/// caption, and the single hairline runs to the right of the text only. A day
/// header instead centers a larger on-surface label between two plain rules.
class _PreviousRefreshMark extends StatelessWidget {
  const _PreviousRefreshMark({
    required this.timestamp,
    required this.includeDate,
    required this.now,
    required this.localDateKey,
  });

  final DateTime timestamp;
  final bool includeDate;
  final DateTime now;
  final String Function(DateTime instant) localDateKey;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final theme = Theme.of(context);
    final scheme = theme.colorScheme;
    final title = l10n.timelinePreviousRefreshMark;
    final instant = gitPulseBaselineInstantLabel(
      context,
      timestamp,
      now: now,
      localDateKey: localDateKey,
      includeDate: includeDate,
    );
    return Semantics(
      container: true,
      label: '$title $instant',
      child: ExcludeSemantics(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(0, 14, 0, 12),
          child: Row(
            children: [
              Text(
                title,
                maxLines: 1,
                style: theme.textTheme.labelSmall?.copyWith(
                  color: scheme.primary,
                  fontWeight: FontWeight.w600,
                  letterSpacing: 0.6,
                ),
              ),
              const SizedBox(width: 8),
              Text(
                instant,
                maxLines: 1,
                style: theme.textTheme.labelSmall?.copyWith(
                  color: scheme.onSurfaceVariant,
                  fontWeight: FontWeight.w500,
                  fontFeatures: const [FontFeature.tabularFigures()],
                ),
              ),
              const SizedBox(width: 10),
              // A plain rule rather than a [Divider]: the day headers own that
              // widget, and the marker must not be mistakable for one.
              Expanded(
                child: Container(
                  height: GitPulseStroke.hairline,
                  color: toneRule(scheme),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// A day header: its label sits between two full-width rules. The Previous
/// Refresh marker does not use this, so the two rows do not look alike.
class _RuleRow extends StatelessWidget {
  const _RuleRow({required this.child, required this.padding});

  final Widget child;
  final EdgeInsetsGeometry padding;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final rule = Divider(
      height: GitPulseStroke.hairline,
      thickness: GitPulseStroke.hairline,
      color: toneRule(scheme),
    );
    return Padding(
      padding: padding,
      child: Row(
        children: [
          Expanded(child: rule),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 10),
            child: child,
          ),
          Expanded(child: rule),
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
              if (column > 0) const SizedBox(width: releaseTimelineColumnGap),
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
