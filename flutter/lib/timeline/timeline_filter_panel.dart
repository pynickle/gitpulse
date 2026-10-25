import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../l10n/generated/app_localizations.dart';
import '../presentation/gitpulse_theme.dart';
import '../presentation/gitpulse_tokens.dart';
import 'timeline_cache.dart';
import 'timeline_filters.dart';
import 'timeline_layout.dart';
import 'timeline_models.dart';
import 'timeline_session.dart';

/// Shows the Release Timeline Filter Panel: a right-side panel on a wide
/// window and a bottom sheet on a phone, following the Release Drawer.
Future<void> showTimelineFilterPanel(BuildContext context) {
  return showGeneralDialog<void>(
    context: context,
    barrierDismissible: true,
    barrierLabel: AppLocalizations.of(context).timelineFilters,
    requestFocus: true,
    transitionDuration: const Duration(milliseconds: 180),
    pageBuilder: (context, animation, secondaryAnimation) =>
        const _TimelineFilterOverlay(),
    transitionBuilder: (context, animation, secondaryAnimation, child) {
      final wide =
          MediaQuery.sizeOf(context).width > releaseTimelinePhoneMaxWidth;
      final curved = CurvedAnimation(
        parent: animation,
        curve: Curves.easeOutCubic,
      );
      return FadeTransition(
        opacity: curved,
        child: SlideTransition(
          position: Tween(
            begin: wide ? const Offset(.08, 0) : const Offset(0, .08),
            end: Offset.zero,
          ).animate(curved),
          child: child,
        ),
      );
    },
  );
}

class _TimelineFilterOverlay extends StatelessWidget {
  const _TimelineFilterOverlay();

  @override
  Widget build(BuildContext context) {
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
            final wide = constraints.maxWidth > releaseTimelinePhoneMaxWidth;
            if (wide) {
              return Align(
                alignment: Alignment.centerRight,
                child: SizedBox(
                  width: math.min(420, constraints.maxWidth * .9),
                  child: const Material(
                    elevation: 12,
                    child: TimelineFilterPanel(),
                  ),
                ),
              );
            }
            // The panel never reflows for the keyboard. Its search field is at
            // the top of the sheet, so the keyboard overlays the date and
            // prerelease controls rather than pushing them up the screen — the
            // controls a reader learned the position of stay where they were.
            return Align(
              alignment: Alignment.bottomCenter,
              child: ConstrainedBox(
                constraints: BoxConstraints(maxHeight: constraints.maxHeight),
                child: const Material(
                  borderRadius: BorderRadius.vertical(
                    top: Radius.circular(GitPulseRadius.surface),
                  ),
                  clipBehavior: Clip.antiAlias,
                  child: TimelineFilterPanel(),
                ),
              ),
            );
          },
        ),
      ),
    );
  }
}

/// The share of the window the panel occupies.
///
/// The panel takes that share whether or not its content needs it. Its height
/// is a place a reader learns — the search field, the list, and the conditions
/// under it stay put — and a surface that grows with an account's Followed
/// Repositories and shrinks again when the list is searched is a surface that
/// jumps under the hand.
const _panelHeightFactor = .85;

/// Below this many Followed Repositories the whole list is on screen anyway, so
/// a search field would name a list that needs no narrowing.
const _repositorySearchThreshold = 8;

/// The Release Timeline Filter Panel controls: repository, published-date,
/// and prerelease conditions for the current Shared Timeline Window.
///
/// It reads and writes the session's Active Timeline Filter directly, so a
/// change takes effect immediately without another timeline request.
///
/// The repository dimension follows the Follows page's shape rather than a
/// cloud of chips: the selected repositories are one non-wrapping line at the
/// top, and the rest of the list is a scrolling table under it. Selection is
/// therefore readable at a glance however long the list is, and adding one more
/// repository never costs the panel another row of controls.
class TimelineFilterPanel extends ConsumerStatefulWidget {
  const TimelineFilterPanel({super.key});

  @override
  ConsumerState<TimelineFilterPanel> createState() =>
      _TimelineFilterPanelState();
}

class _TimelineFilterPanelState extends ConsumerState<TimelineFilterPanel> {
  /// The panel's own narrowing of the repository list. It never leaves the
  /// panel: the Release Timeline Filter itself is [TimelineFilterState].
  final _query = TextEditingController();

  @override
  void dispose() {
    _query.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final state = ref.watch(releaseTimelineSessionProvider);
    final facade = ref.read(releaseTimelineSessionProvider.notifier);
    final filters = state.filters;
    final height = MediaQuery.sizeOf(context).height;

    void update(TimelineFilterState next) => facade.applyFilters(next);
    final repositories = _sortedRepositories(facade.followedRepositories);
    final selected = _selectedRepositories(repositories, filters.repositoryIds);
    final query = normalizeTimelineSearchText(_query.text);
    final listed = query.isEmpty
        ? repositories
        : [
            for (final repository in repositories)
              if (normalizeTimelineSearchText(repository.fullName)
                  .contains(query))
                repository,
          ];
    // A field that is already narrowing something keeps its place; otherwise it
    // is only worth its line once the list is longer than the panel shows.
    final searching =
        _query.text.trim().isNotEmpty ||
        repositories.length > _repositorySearchThreshold;

    void toggle(TimelineRepository repository) {
      final wasSelected = filters.repositoryIds.contains(repository.id);
      update(
        filters.copyWith(
          repositoryIds: [
            for (final id in filters.repositoryIds)
              if (id != repository.id) id,
            if (!wasSelected) repository.id,
          ],
        ),
      );
    }

    void clearAll() {
      _query.clear();
      setState(() {});
      update(
        filters.copyWith(
          repositoryIds: const [],
          dateRange: const TimelineDateRange(),
          hidePrereleases: false,
        ),
      );
    }

    Future<void> pick({required bool from}) async {
      // Date conditions are independent of loaded cards; only the matching
      // candidates are restricted to the exposed window.
      final earliest = DateTime(1);
      final latest = DateUtils.dateOnly(
        ref.read(timelineClockProvider)().toLocal(),
      );
      final current = parseTimelineDateKey(
        (from ? filters.dateRange.from : filters.dateRange.to) ?? '',
      );
      var initial = current ?? latest;
      if (initial.isBefore(earliest)) initial = earliest;
      if (initial.isAfter(latest)) initial = latest;
      final picked = await showDatePicker(
        context: context,
        initialDate: initial,
        firstDate: earliest,
        lastDate: latest,
        helpText: from
            ? l10n.timelineFilterFromDate
            : l10n.timelineFilterToDate,
      );
      if (picked == null) return;
      final key = systemLocalDateKey(picked);
      update(
        filters.copyWith(
          dateRange: from
              ? filters.dateRange.withFrom(key)
              : filters.dateRange.withTo(key),
        ),
      );
    }

    String dateLabel(String? key) {
      final date = key == null ? null : parseTimelineDateKey(key);
      return date == null
          ? l10n.timelineFilterAnyDate
          : MaterialLocalizations.of(context).formatShortMonthDay(date);
    }

    // The panel's one text gutter. A row's rounded ink is inset by [panelInset]
    // from the panel edge, as the Release Drawer's repository line is, so a
    // press reads as a patch inside the row instead of a rectangle across the
    // panel; every band that has no ink of its own carries the difference, so
    // all of the panel's text lands on the same gutter.
    const gutter = 16.0;
    const panelInset = 4.0;
    Widget band(Widget child) => Padding(
      padding: const EdgeInsets.symmetric(horizontal: gutter - panelInset),
      child: child,
    );

    // The sheet's own bottom inset is the physical one, not `MediaQuery.padding`:
    // that padding drops to zero the moment the keyboard covers the navigation
    // bar, which would shorten the sheet and drop its top edge a notch on the
    // first keypress. `viewPadding` is what the platform reserves whether or not
    // a keyboard is up, so the sheet keeps its height and position while typing.
    final bottomInset = MediaQuery.viewPaddingOf(context).bottom;

    return SizedBox(
      height: height * _panelHeightFactor,
      child: Padding(
        padding: EdgeInsets.fromLTRB(
          panelInset,
          12,
          panelInset,
          16 + bottomInset,
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            band(
              Row(
                children: [
                  Expanded(
                    child: Text(
                      l10n.timelineFilterPanelTitle,
                      style: Theme.of(context).textTheme.titleMedium,
                    ),
                  ),
                  TextButton(
                    onPressed: filters.hasActiveTimelineFilter
                        ? clearAll
                        : null,
                    child: Text(l10n.timelineFilterClearAll),
                  ),
                ],
              ),
            ),
            if (selected.isNotEmpty) ...[
              band(
                _SelectedRepositories(repositories: selected, onRemove: toggle),
              ),
              const SizedBox(height: 8),
            ],
            if (searching) ...[
              band(
                _RepositorySearch(
                  controller: _query,
                  onChanged: () => setState(() {}),
                  onClear: () {
                    _query.clear();
                    setState(() {});
                  },
                ),
              ),
              const SizedBox(height: 4),
            ],
            // The one band that gives way. It keeps its place and its height
            // whether the list is long, short, searched, or empty, so nothing
            // under it moves as the reader narrows the repository list.
            Expanded(
              child: repositories.isEmpty
                  ? Align(
                      alignment: AlignmentDirectional.topStart,
                      child: band(
                        _Note(text: l10n.timelineFilterNoRepositories),
                      ),
                    )
                  : listed.isEmpty
                  ? Align(
                      alignment: AlignmentDirectional.topStart,
                      child: band(_Note(text: l10n.timelineFilterNoMatches)),
                    )
                  : ListView.separated(
                      padding: EdgeInsets.zero,
                      itemCount: listed.length,
                      separatorBuilder: (context, index) => Divider(
                        height: GitPulseStroke.hairline,
                        thickness: GitPulseStroke.hairline,
                        indent: gutter - panelInset,
                        endIndent: gutter - panelInset,
                        color: toneRule(Theme.of(context).colorScheme),
                      ),
                      itemBuilder: (context, index) {
                        final repository = listed[index];
                        return _RepositoryRow(
                          key: ValueKey('filter-repository-${repository.id}'),
                          repository: repository,
                          selected: filters.repositoryIds.contains(
                            repository.id,
                          ),
                          onTap: () => toggle(repository),
                        );
                      },
                    ),
            ),
            const SizedBox(height: 8),
            band(
              _DateRange(
                from: dateLabel(filters.dateRange.from),
                to: dateLabel(filters.dateRange.to),
                fromTooltip: l10n.timelineFilterFrom(
                  dateLabel(filters.dateRange.from),
                ),
                toTooltip: l10n.timelineFilterTo(
                  dateLabel(filters.dateRange.to),
                ),
                clearable: !filters.dateRange.isEmpty,
                onFrom: () => pick(from: true),
                onTo: () => pick(from: false),
                onClear: () => update(
                  filters.copyWith(dateRange: const TimelineDateRange()),
                ),
              ),
            ),
            _PrereleaseSwitch(
              label: l10n.timelineFilterHidePrereleases,
              value: filters.hidePrereleases,
              onChanged: (value) =>
                  update(filters.copyWith(hidePrereleases: value)),
            ),
            const SizedBox(height: 4),
            band(
              Align(
                alignment: AlignmentDirectional.centerEnd,
                child: FilledButton.tonal(
                  onPressed: () => Navigator.of(context).maybePop(),
                  child: Text(l10n.timelineFilterDone),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// The repositories the Active Timeline Filter selects, as one horizontal line
/// of removable chips.
///
/// The line never wraps and is the only place a selection stays visible while
/// the list below is scrolled elsewhere or narrowed by the search field, so a
/// hundred selected repositories cost the panel one line rather than a screen.
class _SelectedRepositories extends StatelessWidget {
  const _SelectedRepositories({
    required this.repositories,
    required this.onRemove,
  });

  final List<TimelineRepository> repositories;
  final ValueChanged<TimelineRepository> onRemove;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final scheme = theme.colorScheme;
    return SingleChildScrollView(
      scrollDirection: Axis.horizontal,
      child: Row(
        children: [
          for (var index = 0; index < repositories.length; index++) ...[
            if (index > 0) const SizedBox(width: 6),
            InputChip(
              key: ValueKey('filter-selected-${repositories[index].id}'),
              label: Text(repositories[index].fullName),
              // The whole chip removes the repository: a reader who came to
              // undo a selection should not have to find the small mark on it.
              onPressed: () => onRemove(repositories[index]),
              onDeleted: () => onRemove(repositories[index]),
              backgroundColor: scheme.secondaryContainer,
              side: BorderSide.none,
              labelStyle: theme.textTheme.bodySmall?.copyWith(
                color: scheme.onSecondaryContainer,
              ),
              deleteIconColor: scheme.onSecondaryContainer,
              materialTapTargetSize: MaterialTapTargetSize.shrinkWrap,
              visualDensity: VisualDensity.compact,
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
            ),
          ],
        ],
      ),
    );
  }
}

/// The Timeline toolbar's dense filled search field, narrowed to repository
/// names, so the panel's search reads as the same control as the page's.
class _RepositorySearch extends StatelessWidget {
  const _RepositorySearch({
    required this.controller,
    required this.onChanged,
    required this.onClear,
  });

  final TextEditingController controller;
  final VoidCallback onChanged;
  final VoidCallback onClear;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final theme = Theme.of(context);
    final scheme = theme.colorScheme;
    final border = OutlineInputBorder(
      borderRadius: BorderRadius.circular(GitPulseRadius.row),
      borderSide: BorderSide.none,
    );
    return TextField(
      key: const ValueKey('filter-search-repositories'),
      controller: controller,
      maxLines: 1,
      style: theme.textTheme.bodyMedium,
      textInputAction: TextInputAction.search,
      onChanged: (_) => onChanged(),
      decoration: InputDecoration(
        isDense: true,
        filled: true,
        fillColor: scheme.surfaceContainerHigh,
        hintText: l10n.timelineFilterSearchRepositories,
        hintMaxLines: 1,
        prefixIcon: const Icon(Icons.search, size: GitPulseIconSize.inControl),
        prefixIconConstraints: const BoxConstraints(
          minWidth: 32,
          minHeight: GitPulseHeight.compact,
        ),
        suffixIcon: controller.text.isEmpty
            ? null
            : IconButton(
                tooltip: l10n.timelineSearchClear,
                style: IconButton.styleFrom(
                  tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                ),
                onPressed: onClear,
                iconSize: GitPulseIconSize.inControl,
                icon: const Icon(Icons.close),
              ),
        suffixIconConstraints: const BoxConstraints(
          minWidth: 32,
          minHeight: GitPulseHeight.compact,
        ),
        contentPadding: const EdgeInsets.symmetric(horizontal: 8, vertical: 10),
        constraints: const BoxConstraints(minHeight: GitPulseHeight.compact),
        border: border,
        enabledBorder: border,
        focusedBorder: border.copyWith(
          borderSide: BorderSide(color: scheme.primary),
        ),
      ),
    );
  }
}

/// One Followed Repository in the panel's list: its name, and a check mark when
/// the Active Timeline Filter selects it. The whole row toggles the selection.
class _RepositoryRow extends StatelessWidget {
  const _RepositoryRow({
    super.key,
    required this.repository,
    required this.selected,
    required this.onTap,
  });

  final TimelineRepository repository;
  final bool selected;
  final VoidCallback onTap;

  /// The mark's own slot, kept whether or not the mark is showing, so a name
  /// never reflows sideways the moment it is selected.
  static const _markSlot = 26.0;
  static const _mark = Duration(milliseconds: 180);

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final scheme = theme.colorScheme;
    return MergeSemantics(
      child: Semantics(
        button: true,
        selected: selected,
        child: _TappableRow(
          onTap: onTap,
          child: Row(
            children: [
              Expanded(
                child: Text(
                  repository.fullName,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: theme.textTheme.bodyMedium,
                ),
              ),
              SizedBox(
                width: _markSlot,
                child: Center(
                  child: ExcludeSemantics(
                    // The mark grows into place and shrinks away rather than
                    // appearing: a selection is a small event, and a fade of
                    // one frame reads as a flicker.
                    child: AnimatedScale(
                      scale: selected ? 1 : 0.4,
                      duration: _mark,
                      curve: Curves.easeOutCubic,
                      child: AnimatedOpacity(
                        opacity: selected ? 1 : 0,
                        duration: _mark,
                        curve: Curves.easeOut,
                        child: Icon(
                          Icons.check_circle,
                          size: GitPulseIconSize.inControl,
                          color: scheme.primary,
                        ),
                      ),
                    ),
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// A row the whole width of which is tappable, answered with the app's one tint.
///
/// The ink is clipped to the row's own rounded shape, so it stays inside the
/// panel rather than spreading across whatever the row happens to measure. The
/// row paints no colour of its own: the tint it shows while hovered or focused
/// is the theme's (ADR 0023), and a press paints nothing at all — a per-surface
/// overlay would be a second answer to a question the theme already answers.
class _TappableRow extends StatelessWidget {
  const _TappableRow({
    required this.onTap,
    required this.child,
    this.padding = const EdgeInsets.fromLTRB(12, 9, 8, 9),
  });

  static const _radius = BorderRadius.all(Radius.circular(GitPulseRadius.row));

  final VoidCallback onTap;
  final Widget child;
  final EdgeInsetsGeometry padding;

  @override
  Widget build(BuildContext context) => Material(
    color: Colors.transparent,
    child: InkWell(
      borderRadius: _radius,
      onTap: onTap,
      child: Padding(padding: padding, child: child),
    ),
  );
}

/// The published-date condition as one line: the calendar glyph, the two
/// bounds either side of a dash, and the way to clear them.
///
/// The bounds read as one range instead of two labelled buttons, so the line
/// fits a phone's panel width and never wraps the clear action onto a second
/// row. Each bound keeps its spoken name — "Published from …" — in its tooltip,
/// where the words are available without being printed twice.
class _DateRange extends StatelessWidget {
  const _DateRange({
    required this.from,
    required this.to,
    required this.fromTooltip,
    required this.toTooltip,
    required this.clearable,
    required this.onFrom,
    required this.onTo,
    required this.onClear,
  });

  final String from;
  final String to;
  final String fromTooltip;
  final String toTooltip;
  final bool clearable;
  final VoidCallback onFrom;
  final VoidCallback onTo;
  final VoidCallback onClear;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final theme = Theme.of(context);
    final scheme = theme.colorScheme;
    return Row(
      children: [
        ExcludeSemantics(
          child: Icon(
            Icons.event_outlined,
            size: GitPulseIconSize.inline,
            color: scheme.onSurfaceVariant,
          ),
        ),
        const SizedBox(width: 6),
        Flexible(
          child: _DateBound(label: from, tooltip: fromTooltip, onTap: onFrom),
        ),
        ExcludeSemantics(
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 4),
            child: Text(
              '–',
              style: theme.textTheme.bodyMedium?.copyWith(
                color: scheme.onSurfaceVariant,
              ),
            ),
          ),
        ),
        Flexible(
          child: _DateBound(label: to, tooltip: toTooltip, onTap: onTo),
        ),
        if (clearable)
          IconButton(
            tooltip: l10n.timelineFilterClearDates,
            onPressed: onClear,
            iconSize: GitPulseIconSize.inControl,
            visualDensity: VisualDensity.compact,
            constraints: const BoxConstraints(
              minWidth: 40,
              minHeight: GitPulseHeight.compact,
            ),
            icon: const Icon(Icons.event_busy_outlined),
          )
        else
          const SizedBox(width: 4),
      ],
    );
  }
}

/// One bound of the published-date condition: a compact outlined pill whose
/// label is the date itself.
class _DateBound extends StatelessWidget {
  const _DateBound({
    required this.label,
    required this.tooltip,
    required this.onTap,
  });

  final String label;
  final String tooltip;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final scheme = theme.colorScheme;
    return Tooltip(
      message: tooltip,
      child: OutlinedButton(
        onPressed: onTap,
        style: OutlinedButton.styleFrom(
          minimumSize: const Size(0, 32),
          padding: const EdgeInsets.symmetric(horizontal: 10),
          visualDensity: VisualDensity.compact,
          tapTargetSize: MaterialTapTargetSize.shrinkWrap,
          foregroundColor: scheme.onSurface,
          side: BorderSide(color: scheme.outlineVariant),
          textStyle: theme.textTheme.bodyMedium,
        ).copyWith(overlayColor: gitPulseInkOverlay(scheme)),
        child: Text(label, maxLines: 1, overflow: TextOverflow.ellipsis),
      ),
    );
  }
}

/// The prerelease condition as a row that answers a press exactly as the
/// repository list above it does, so the panel reads as one list of conditions
/// rather than a list and a full-width switch tile.
class _PrereleaseSwitch extends StatelessWidget {
  const _PrereleaseSwitch({
    required this.label,
    required this.value,
    required this.onChanged,
  });

  final String label;
  final bool value;
  final ValueChanged<bool> onChanged;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return _TappableRow(
      onTap: () => onChanged(!value),
      padding: const EdgeInsets.fromLTRB(12, 2, 4, 2),
      child: Row(
        children: [
          Expanded(child: Text(label, style: theme.textTheme.bodyMedium)),
          Switch(value: value, onChanged: onChanged),
        ],
      ),
    );
  }
}

/// A short muted line in place of the repository list: nothing to filter by, or
/// nothing matching what the search field holds.
class _Note extends StatelessWidget {
  const _Note({required this.text});

  final String text;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 8),
      child: Text(
        text,
        style: theme.textTheme.bodySmall?.copyWith(
          color: theme.colorScheme.onSurfaceVariant,
        ),
      ),
    );
  }
}

List<TimelineRepository> _sortedRepositories(
  List<TimelineRepository> repositories,
) {
  final sorted = [...repositories];
  sorted.sort(
    (left, right) =>
        left.fullName.toLowerCase().compareTo(right.fullName.toLowerCase()),
  );
  return sorted;
}

/// The selected repositories in the order they were selected, which is the one
/// order a reader can predict: the chip line shows what the filter holds, not
/// what the list happens to sort to.
List<TimelineRepository> _selectedRepositories(
  List<TimelineRepository> repositories,
  List<String> ids,
) {
  final byId = {
    for (final repository in repositories) repository.id: repository,
  };
  return [
    // A repository that is no longer followed has no chip, even while the
    // filter still names its id.
    for (final id in ids) ?byId[id],
  ];
}
