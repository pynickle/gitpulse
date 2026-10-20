import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../l10n/generated/app_localizations.dart';
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
            return Align(
              alignment: Alignment.bottomCenter,
              child: ConstrainedBox(
                constraints: BoxConstraints(maxHeight: constraints.maxHeight),
                child: const Material(
                  borderRadius: BorderRadius.vertical(top: Radius.circular(12)),
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

/// The Release Timeline Filter Panel controls: repository, published-date,
/// and prerelease conditions for the current Shared Timeline Window.
///
/// It reads and writes the session's Active Timeline Filter directly, so a
/// change takes effect immediately without another timeline request.
class TimelineFilterPanel extends ConsumerWidget {
  const TimelineFilterPanel({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = AppLocalizations.of(context);
    final state = ref.watch(releaseTimelineSessionProvider);
    final facade = ref.read(releaseTimelineSessionProvider.notifier);
    final filters = state.filters;
    final height = MediaQuery.sizeOf(context).height;

    void update(TimelineFilterState next) => facade.applyFilters(next);
    final repositories = _sortedRepositories(facade.followedRepositories);

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
          : MaterialLocalizations.of(context).formatMediumDate(date);
    }

    return ConstrainedBox(
      constraints: BoxConstraints(maxHeight: height * 0.85),
      child: SafeArea(
        top: false,
        child: Padding(
          padding: const EdgeInsets.fromLTRB(20, 12, 20, 16),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
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
                        ? () => update(
                            filters.copyWith(
                              repositoryIds: const [],
                              dateRange: const TimelineDateRange(),
                              hidePrereleases: false,
                            ),
                          )
                        : null,
                    child: Text(l10n.timelineFilterClearAll),
                  ),
                ],
              ),
              Flexible(
                child: SingleChildScrollView(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      const SizedBox(height: 8),
                      Text(
                        l10n.timelineFilterRepositories,
                        style: Theme.of(context).textTheme.titleSmall,
                      ),
                      const SizedBox(height: 8),
                      if (repositories.isEmpty)
                        Text(
                          l10n.timelineFilterNoRepositories,
                          style: Theme.of(context).textTheme.bodySmall,
                        )
                      else
                        Wrap(
                          spacing: 8,
                          runSpacing: 4,
                          children: [
                            for (final repository in repositories)
                              FilterChip(
                                label: Text(repository.fullName),
                                selected: filters.repositoryIds.contains(
                                  repository.id,
                                ),
                                onSelected: (selected) {
                                  update(
                                    filters.copyWith(
                                      repositoryIds: [
                                        for (final id in filters.repositoryIds)
                                          if (id != repository.id) id,
                                        if (selected) repository.id,
                                      ],
                                    ),
                                  );
                                },
                              ),
                          ],
                        ),
                      const SizedBox(height: 20),
                      Text(
                        l10n.timelineFilterDateRange,
                        style: Theme.of(context).textTheme.titleSmall,
                      ),
                      const SizedBox(height: 8),
                      Wrap(
                        spacing: 8,
                        runSpacing: 8,
                        crossAxisAlignment: WrapCrossAlignment.center,
                        children: [
                          OutlinedButton.icon(
                            onPressed: () => pick(from: true),
                            icon: const Icon(Icons.event, size: 18),
                            label: Text(
                              l10n.timelineFilterFrom(
                                dateLabel(filters.dateRange.from),
                              ),
                            ),
                          ),
                          OutlinedButton.icon(
                            onPressed: () => pick(from: false),
                            icon: const Icon(Icons.event, size: 18),
                            label: Text(
                              l10n.timelineFilterTo(
                                dateLabel(filters.dateRange.to),
                              ),
                            ),
                          ),
                          if (!filters.dateRange.isEmpty)
                            TextButton(
                              onPressed: () => update(
                                filters.copyWith(
                                  dateRange: const TimelineDateRange(),
                                ),
                              ),
                              child: Text(l10n.timelineFilterClearDates),
                            ),
                        ],
                      ),
                      const SizedBox(height: 8),
                      SwitchListTile(
                        contentPadding: EdgeInsets.zero,
                        title: Text(l10n.timelineFilterHidePrereleases),
                        value: filters.hidePrereleases,
                        onChanged: (value) =>
                            update(filters.copyWith(hidePrereleases: value)),
                      ),
                    ],
                  ),
                ),
              ),
              const SizedBox(height: 8),
              Align(
                alignment: AlignmentDirectional.centerEnd,
                child: FilledButton.tonal(
                  onPressed: () => Navigator.of(context).maybePop(),
                  child: Text(l10n.timelineFilterDone),
                ),
              ),
            ],
          ),
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
