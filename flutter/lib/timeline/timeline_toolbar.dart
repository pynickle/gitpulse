import 'package:flutter/material.dart';

import '../l10n/generated/app_localizations.dart';
import 'timeline_date_labels.dart';
import 'timeline_filters.dart';
import 'timeline_state.dart';

class TimelineToolbar extends StatefulWidget {
  const TimelineToolbar({
    super.key,
    required this.state,
    required this.onRefresh,
    required this.showTitle,
    this.onFiltersChanged,
    this.onOpenFilters,
    this.onRetryCache,
    this.onRebuildCache,
  });

  final TimelineViewState state;
  final Future<void> Function() onRefresh;
  final bool showTitle;
  final ValueChanged<TimelineFilterState>? onFiltersChanged;
  final VoidCallback? onOpenFilters;
  final Future<void> Function()? onRetryCache;
  final Future<void> Function()? onRebuildCache;

  @override
  State<TimelineToolbar> createState() => _TimelineToolbarState();
}

class _TimelineToolbarState extends State<TimelineToolbar> {
  late final TextEditingController _query;

  @override
  void initState() {
    super.initState();
    _query = TextEditingController(text: widget.state.filters.query);
  }

  @override
  void didUpdateWidget(TimelineToolbar oldWidget) {
    super.didUpdateWidget(oldWidget);
    final query = widget.state.filters.query;
    if (query != _query.text) {
      _query.value = TextEditingValue(
        text: query,
        selection: TextSelection.collapsed(offset: query.length),
      );
    }
  }

  @override
  void dispose() {
    _query.dispose();
    super.dispose();
  }

  void _change(TimelineFilterState Function(TimelineFilterState) update) {
    widget.onFiltersChanged?.call(update(widget.state.filters));
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final state = widget.state;
    final filters = state.filters;
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 8, 16, 8),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            children: [
              Expanded(
                child: widget.showTitle
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
                onPressed: state.loading ? null : () => widget.onRefresh(),
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
          Row(
            children: [
              Expanded(
                child: TextField(
                  controller: _query,
                  decoration: InputDecoration(
                    isDense: true,
                    hintText: l10n.timelineSearchPlaceholder,
                    prefixIcon: const Icon(Icons.search, size: 20),
                    suffixIcon: _query.text.isEmpty
                        ? null
                        : IconButton(
                            tooltip: l10n.timelineSearchClear,
                            onPressed: () {
                              _query.clear();
                              _change((filters) => filters.copyWith(query: ''));
                            },
                            icon: const Icon(Icons.close, size: 18),
                          ),
                  ),
                  textInputAction: TextInputAction.search,
                  onChanged: (value) =>
                      _change((filters) => filters.copyWith(query: value)),
                ),
              ),
              IconButton(
                tooltip: l10n.timelineIncludeNotes,
                isSelected: filters.includeReleaseNotes,
                onPressed: () => _change(
                  (filters) => filters.copyWith(
                    includeReleaseNotes: !filters.includeReleaseNotes,
                  ),
                ),
                icon: const Icon(Icons.article_outlined),
                selectedIcon: const Icon(Icons.article),
              ),
              IconButton(
                tooltip: l10n.timelineFilters,
                isSelected: filters.hasActiveTimelineFilter,
                onPressed: widget.onOpenFilters,
                icon: const Icon(Icons.filter_list),
              ),
            ],
          ),
          if (widget.showTitle) _TimelineStatus(state: state),
          if (state.cacheFailed)
            Text(
              state.cacheCorrupted
                  ? l10n.timelineCacheCorrupted
                  : l10n.timelineCacheFailed,
            ),
          if (state.cacheFailed && widget.onRetryCache != null)
            Align(
              alignment: AlignmentDirectional.centerStart,
              child: TextButton(
                onPressed: state.loading || state.cacheSettings.clearing
                    ? null
                    : state.cacheCorrupted
                    ? widget.onRebuildCache
                    : widget.onRetryCache,
                child: Text(
                  state.cacheCorrupted
                      ? l10n.timelineRebuildCache
                      : l10n.timelineRetrySaving,
                ),
              ),
            ),
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
          if (state.offline) Text(l10n.timelineOffline),
          if (state.savedAt case final savedAt?)
            Text(
              l10n.timelineSavedAt(
                timelineTimeLabel(context, savedAt.toLocal()),
              ),
            ),
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
