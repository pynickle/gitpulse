import 'package:flutter/material.dart';

import '../l10n/generated/app_localizations.dart';
import 'timeline_date_labels.dart';
import 'timeline_state.dart';

class TimelineToolbar extends StatelessWidget {
  const TimelineToolbar({
    super.key,
    required this.state,
    required this.onRefresh,
    required this.showTitle,
  });

  final TimelineViewState state;
  final Future<void> Function() onRefresh;
  final bool showTitle;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 8, 16, 8),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            children: [
              Expanded(
                child: showTitle
                    ? Text(
                        l10n.timeline,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: Theme.of(context).textTheme.titleLarge,
                      )
                    : _TimelineStatus(state: state),
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
          if (showTitle) _TimelineStatus(state: state),
        ],
      ),
    );
  }
}

class _TimelineStatus extends StatelessWidget {
  const _TimelineStatus({required this.state});

  final TimelineViewState state;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    return LayoutBuilder(
      builder: (context, constraints) => Wrap(
        spacing: 12,
        runSpacing: 4,
        crossAxisAlignment: WrapCrossAlignment.center,
        children: [
          if (state.previousBaseline case final baseline?)
            ConstrainedBox(
              constraints: BoxConstraints(maxWidth: constraints.maxWidth),
              child: _BaselineChip(baseline: baseline),
            ),
          if (state.loadedNewCount > 0)
            ConstrainedBox(
              constraints: BoxConstraints(maxWidth: constraints.maxWidth),
              child: Semantics(
                liveRegion: true,
                child: Text(
                  l10n.timelineLoadedNew(state.loadedNewCount),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: Theme.of(context).textTheme.labelSmall,
                ),
              ),
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
            Flexible(
              child: Text(
                label,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: theme.textTheme.labelSmall,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
