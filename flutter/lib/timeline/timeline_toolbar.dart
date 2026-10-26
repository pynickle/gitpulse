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
    this.pullRefreshing = false,
    this.onFiltersChanged,
    this.onOpenFilters,
    this.onRetryCache,
    this.onRebuildCache,
  });

  final TimelineViewState state;
  final Future<void> Function() onRefresh;

  /// Whether the round in flight was started by the pull gesture, which shows
  /// its own progress at the top of the list. The refresh button stays disabled
  /// and keeps its glyph, so only one indicator is ever shown.
  final bool pullRefreshing;
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
    final baseline = _baselineLabel(l10n, now, localDateKey);
    final refreshProgress = state.loading && !widget.pullRefreshing;
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
                    prefixIcon: const Icon(
                      Icons.search,
                      size: GitPulseIconSize.inControl,
                    ),
                    prefixIconConstraints: const BoxConstraints(
                      minWidth: 36,
                      minHeight: GitPulseHeight.compact,
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
                            iconSize: GitPulseIconSize.inControl,
                            icon: const Icon(Icons.close),
                          ),
                    suffixIconConstraints: const BoxConstraints(
                      minWidth: 36,
                      minHeight: GitPulseHeight.compact,
                    ),
                    contentPadding: const EdgeInsets.symmetric(
                      horizontal: 8,
                      vertical: 10,
                    ),
                    constraints: const BoxConstraints(
                      minHeight: GitPulseHeight.compact,
                    ),
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
                icon: refreshProgress
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
                child: _MetaLine(
                  offline: state.offline,
                  savedAt: state.savedAt,
                  baseline: baseline,
                  loadedNewCount: state.loadedNewCount,
                  now: now,
                  localDateKey: localDateKey,
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
                onPressed: state.loading || state.cacheActions.clearing
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

/// The toolbar's meta line, beside the filter entry: the refresh facts while
/// reading live, or the one statement of an offline window.
///
/// The Previous Refresh instants and the loaded-new count are both facts about a
/// refresh. Offline there was none, so the line states the saved window and the
/// instant it was saved instead, and neither the baseline nor a count appears:
/// two instants side by side would read as one fact told twice, and a count that
/// can only be zero is no news.
///
/// The count used to hold a row of its own. It belongs to the same sentence as
/// the refresh it follows, so it shares that row and its role: a [Wrap] keeps
/// the wording complete and lets it break only when large text or a narrow
/// screen leaves no room, instead of truncating the instant the reader needs.
class _MetaLine extends StatelessWidget {
  const _MetaLine({
    required this.offline,
    required this.savedAt,
    required this.baseline,
    required this.loadedNewCount,
    required this.now,
    required this.localDateKey,
  });

  final bool offline;
  final DateTime? savedAt;
  final String? baseline;
  final int loadedNewCount;
  final DateTime now;
  final String Function(DateTime instant) localDateKey;

  @override
  Widget build(BuildContext context) {
    final meta = gitPulseTypeMeta(context);
    if (offline) {
      final saved = savedAt;
      final instant = saved == null
          ? null
          : gitPulseBaselineInstantLabel(
              context,
              saved,
              now: now,
              localDateKey: localDateKey,
              includeDate: localDateKey(saved) != localDateKey(now),
            );
      return Wrap(
        alignment: WrapAlignment.start,
        crossAxisAlignment: WrapCrossAlignment.center,
        children: [
          Icon(
            Icons.cloud_off,
            size: GitPulseIconSize.inline,
            color: Theme.of(context).colorScheme.onSurfaceVariant,
          ),
          // The glyph and the word it stands for read as one unit, so this is
          // `glyphGap` rather than the gap between two facts (MASTER §5).
          const SizedBox(width: GitPulseSpace.glyphGap),
          Text(AppLocalizations.of(context).timelineOffline, style: meta),
          if (instant != null) ...[
            Padding(
              padding: const EdgeInsets.symmetric(
                horizontal: GitPulseSpace.inline,
              ),
              child: ExcludeSemantics(child: Text('·', style: meta)),
            ),
            Text(
              AppLocalizations.of(context).timelineSavedAt(instant),
              style: meta,
            ),
          ],
        ],
      );
    }
    final l10n = AppLocalizations.of(context);
    final baseline = this.baseline;
    if (baseline == null) {
      // Nothing to report: keep the row the filter entry sets, so the search
      // row above it never shifts.
      return const SizedBox(height: GitPulseHeight.compact);
    }
    // A zero count is no news, so it stays hidden. The visible copy is the
    // short form that keeps its place at a phone's width; a changed count is
    // announced with the full meaning it stands for.
    final count = loadedNewCount > 0
        ? Semantics(
            liveRegion: true,
            excludeSemantics: true,
            label: l10n.timelineLoadedNew(loadedNewCount),
            child: Text(l10n.timelineNewReleases(loadedNewCount), style: meta),
          )
        : null;
    return Wrap(
      alignment: WrapAlignment.start,
      crossAxisAlignment: WrapCrossAlignment.center,
      children: [
        Text(baseline, style: meta),
        if (count != null)
          Padding(
            // Two items of one row, so this is `inline`, not `tight`
            // (MASTER §5).
            padding: const EdgeInsets.symmetric(
              horizontal: GitPulseSpace.inline,
            ),
            child: ExcludeSemantics(child: Text('·', style: meta)),
          ),
        ?count,
      ],
    );
  }
}
