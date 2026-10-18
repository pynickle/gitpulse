import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../l10n/generated/app_localizations.dart';
import 'release_timeline_card.dart';
import 'timeline_date_labels.dart';
import 'timeline_layout.dart';
import 'timeline_models.dart';
import 'timeline_session.dart';
import 'timeline_state.dart';

/// The Release Timeline: published releases of the account's Followed
/// Repositories, grouped by display date, with the shared Timeline Refresh
/// Baseline and its loaded-new count.
class TimelineScreen extends ConsumerWidget {
  const TimelineScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final state = ref.watch(releaseTimelineSessionProvider);
    Future<void> refresh() =>
        ref.read(releaseTimelineSessionProvider.notifier).refresh();

    return LayoutBuilder(
      builder: (context, constraints) => Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          _Header(state: state, onRefresh: refresh),
          if (state.hasLookupFailures)
            _LookupFailureBanner(state: state, onRefresh: refresh),
          Expanded(
            child: _Body(
              state: state,
              columns: resolveTimelineColumnCount(constraints.maxWidth),
              onRefresh: refresh,
            ),
          ),
        ],
      ),
    );
  }
}

class _Header extends StatelessWidget {
  const _Header({required this.state, required this.onRefresh});

  final TimelineViewState state;
  final Future<void> Function() onRefresh;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final theme = Theme.of(context);
    final baseline = state.previousBaseline;

    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 16, 16, 8),
      child: Wrap(
        crossAxisAlignment: WrapCrossAlignment.center,
        spacing: 12,
        runSpacing: 8,
        children: [
          Text(l10n.timelineTitle, style: theme.textTheme.titleLarge),
          if (baseline != null) _BaselineChip(baseline: baseline),
          if (state.loadedNewCount > 0)
            Semantics(
              liveRegion: true,
              child: Chip(
                label: Text(l10n.timelineLoadedNew(state.loadedNewCount)),
              ),
            ),
          IconButton(
            tooltip: l10n.timelineReload,
            onPressed: state.loading ? null : () => onRefresh(),
            icon: state.loading
                ? const SizedBox(
                    width: 18,
                    height: 18,
                    child: CircularProgressIndicator(strokeWidth: 2),
                  )
                : const Icon(Icons.refresh),
          ),
        ],
      ),
    );
  }
}

class _BaselineChip extends StatelessWidget {
  const _BaselineChip({required this.baseline});

  final String baseline;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final theme = Theme.of(context);
    final parsed = DateTime.tryParse(baseline);
    final label = parsed == null
        ? ''
        : timelineTimeLabel(context, parsed.toLocal());

    return Tooltip(
      message: l10n.timelinePreviousRefresh(
        parsed == null ? baseline : parsed.toLocal().toString(),
      ),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
        decoration: BoxDecoration(
          border: Border.all(color: theme.dividerColor),
          borderRadius: BorderRadius.circular(999),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(
              Icons.history,
              size: 14,
              color: theme.colorScheme.onSurfaceVariant,
            ),
            const SizedBox(width: 6),
            Text(label, style: theme.textTheme.labelSmall),
          ],
        ),
      ),
    );
  }
}

class _Body extends StatelessWidget {
  const _Body({
    required this.state,
    required this.columns,
    required this.onRefresh,
  });

  final TimelineViewState state;
  final int columns;
  final Future<void> Function() onRefresh;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);

    if (state.loading && !state.hasReleases) {
      return const _LoadingState();
    }
    // A failure outranks the no-follows state: a Followed Repository read that
    // failed has not established that the account follows nothing.
    if (state.failure != null && !state.hasReleases) {
      return _FailureState(state: state, onRefresh: onRefresh);
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
      );
    }
    return _EmptyState(
      icon: Icons.inbox_outlined,
      title: l10n.timelineEmptyReleasesTitle,
      description: l10n.timelineEmptyReleasesDescription,
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
  const _FailureState({required this.state, required this.onRefresh});

  final TimelineViewState state;
  final Future<void> Function() onRefresh;

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
      child: Padding(
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
                onPressed: () => onRefresh(),
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
  const _LookupFailureBanner({required this.state, required this.onRefresh});

  final TimelineViewState state;
  final Future<void> Function() onRefresh;

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
              onPressed: state.loading ? null : () => onRefresh(),
              child: Text(l10n.timelineRetry),
            ),
          ),
        ],
      ),
    );
  }
}

class _TimelineList extends StatelessWidget {
  const _TimelineList({
    required this.state,
    required this.columns,
    required this.onRefresh,
  });

  final TimelineViewState state;
  final int columns;
  final Future<void> Function() onRefresh;

  @override
  Widget build(BuildContext context) {
    final rows = buildTimelineRows(
      state.groups,
      columns,
      state.baselineExposed ? state.previousBaseline : null,
    );

    return ListView.builder(
      padding: const EdgeInsets.fromLTRB(16, 0, 16, 24),
      itemCount: rows.length + 1,
      itemBuilder: (context, index) {
        if (index == rows.length) {
          return _StatusFooter(state: state, onRefresh: onRefresh);
        }
        return switch (rows[index]) {
          TimelineDateRow(:final date) => _DateHeader(date: date),
          TimelineCardsRow(:final items) => _CardsRow(
            items: items,
            columns: columns,
          ),
          TimelineBaselineRow(:final timestamp) => _BaselineDivider(
            timestamp: timestamp,
          ),
        };
      },
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
  const _CardsRow({required this.items, required this.columns});

  final List<TimelineRelease> items;
  final int columns;

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
                    ? ReleaseTimelineCard(item: items[column])
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
  const _StatusFooter({required this.state, required this.onRefresh});

  final TimelineViewState state;
  final Future<void> Function() onRefresh;

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
          if (state.canRetry || state.persistenceFailed)
            OutlinedButton(
              onPressed: state.loading ? null : () => onRefresh(),
              child: Text(l10n.timelineRetry),
            ),
        ],
      ),
    );
  }
}
