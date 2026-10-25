import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../l10n/generated/app_localizations.dart';
import '../presentation/gitpulse_formatting.dart';
import '../presentation/gitpulse_tokens.dart';
import 'timeline_cache.dart';
import 'timeline_filters.dart';
import 'timeline_session.dart';
import 'timeline_state.dart';

class TimelineToolbar extends ConsumerStatefulWidget {
  const TimelineToolbar({
    super.key,
    required this.state,
    required this.onRefresh,
    this.onFiltersChanged,
    this.onOpenFilters,
    this.onRetryCache,
    this.onRebuildCache,
  });

  final TimelineViewState state;
  final Future<void> Function() onRefresh;
  final ValueChanged<TimelineFilterState>? onFiltersChanged;
  final VoidCallback? onOpenFilters;
  final Future<void> Function()? onRetryCache;
  final Future<void> Function()? onRebuildCache;

  @override
  ConsumerState<TimelineToolbar> createState() => _TimelineToolbarState();
}

class _TimelineToolbarState extends ConsumerState<TimelineToolbar> {
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
    final theme = Theme.of(context);
    final state = widget.state;
    final filters = state.filters;
    final now = ref.watch(timelineClockProvider)();
    final localDateKey = ref.watch(timelineEnvironmentProvider).localDateKey;
    final scheme = theme.colorScheme;
    final secondary = theme.textTheme.bodySmall?.copyWith(
      color: scheme.onSurfaceVariant,
    );
    final baseline = _baselineLabel(l10n, now, localDateKey);
    final border = OutlineInputBorder(
      borderRadius: BorderRadius.circular(GitPulseRadius.row),
      borderSide: BorderSide.none,
    );

    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 8, 16, 8),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            children: [
              Expanded(
                child: TextField(
                  controller: _query,
                  maxLines: 1,
                  textAlignVertical: TextAlignVertical.center,
                  style: theme.textTheme.bodyMedium,
                  decoration: InputDecoration(
                    isDense: true,
                    filled: true,
                    fillColor: scheme.surfaceContainerHigh,
                    hintText: l10n.timelineSearchPlaceholder,
                    hintMaxLines: 1,
                    prefixIcon: const Icon(Icons.search, size: 18),
                    prefixIconConstraints: const BoxConstraints(
                      minWidth: 36,
                      minHeight: 40,
                    ),
                    suffixIcon: _query.text.isEmpty
                        ? null
                        : IconButton(
                            tooltip: l10n.timelineSearchClear,
                            // A padded 48dp target is taller than this dense
                            // field and stretches it once the button appears.
                            style: IconButton.styleFrom(
                              tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                            ),
                            onPressed: () {
                              _query.clear();
                              setState(() {});
                              _change((filters) => filters.copyWith(query: ''));
                            },
                            icon: const Icon(Icons.close, size: 18),
                          ),
                    suffixIconConstraints: const BoxConstraints(
                      minWidth: 36,
                      minHeight: 40,
                    ),
                    contentPadding: const EdgeInsets.symmetric(
                      horizontal: 8,
                      vertical: 10,
                    ),
                    constraints: const BoxConstraints(minHeight: 40),
                    border: border,
                    enabledBorder: border,
                    focusedBorder: border.copyWith(
                      borderSide: BorderSide(color: scheme.primary),
                    ),
                  ),
                  textInputAction: TextInputAction.search,
                  onChanged: (value) {
                    setState(() {});
                    _change((filters) => filters.copyWith(query: value));
                  },
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
                child: baseline == null
                    ? const SizedBox(height: 40)
                    : Text(
                        baseline,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: secondary,
                      ),
              ),
              IconButton(
                tooltip: l10n.timelineFilters,
                isSelected: filters.hasActiveTimelineFilter,
                onPressed: widget.onOpenFilters,
                icon: const Icon(Icons.filter_list),
              ),
            ],
          ),
          if (state.offline) Text(l10n.timelineOffline),
          if (state.loadedNewCount > 0)
            Semantics(
              liveRegion: true,
              child: Text(
                l10n.timelineLoadedNew(state.loadedNewCount),
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: theme.textTheme.labelSmall,
              ),
            ),
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

  String? _baselineLabel(
    AppLocalizations l10n,
    DateTime now,
    String Function(DateTime instant) localDateKey,
  ) {
    final raw = widget.state.previousBaseline;
    if (raw == null) return null;
    final parsed = DateTime.tryParse(raw);
    if (parsed == null) return null;
    return gitPulseBaselineLabel(
      l10n,
      parsed,
      now: now,
      localDateKey: localDateKey,
      includeDate: localDateKey(parsed) != localDateKey(now),
    );
  }
}
