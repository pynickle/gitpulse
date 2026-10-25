import 'package:flutter/material.dart';

import '../l10n/generated/app_localizations.dart';
import '../presentation/gitpulse_formatting.dart';
import '../presentation/gitpulse_state_views.dart';
import '../presentation/gitpulse_tokens.dart';
import 'repository_releases_controller.dart';
import 'repository_releases_dto.dart';
import 'repository_releases_service.dart';

class RepositoryReleasesView extends StatelessWidget {
  const RepositoryReleasesView({
    super.key,
    required this.state,
    required this.onPage,
    required this.onFilter,
    required this.onRelease,
    this.isEntry,
    this.scrollController,
  });

  final RepositoryReleasesState state;
  final ValueChanged<int> onPage;
  final ValueChanged<RepositoryReleaseFilter> onFilter;
  final ValueChanged<RepositoryReleaseDto> onRelease;
  final bool Function(RepositoryReleaseDto)? isEntry;

  /// The scrollable the list should use, when the host already has one to
  /// share — a Release Drawer's sheet hands its own controller down, so a drag
  /// on the rows moves the sheet exactly as a drag on the notes does.
  final ScrollController? scrollController;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final items = state.visibleItems;
    final pagination = state.data?.pagination;
    // One set of column widths for the whole page, measured before the rows are
    // built, so every row's glyphs land in the same column.
    final columns = _MetaColumns.measure(context, items);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        SingleChildScrollView(
          scrollDirection: Axis.horizontal,
          padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 8),
          child: Row(
            children: [
              for (final filter in RepositoryReleaseFilter.values) ...[
                if (filter != RepositoryReleaseFilter.values.first)
                  const SizedBox(width: 8),
                _FilterPill(
                  label: switch (filter) {
                    RepositoryReleaseFilter.all => l10n.repositoryReleasesAll,
                    RepositoryReleaseFilter.stable =>
                      l10n.repositoryReleasesStable,
                    RepositoryReleaseFilter.prerelease =>
                      l10n.timelinePrerelease,
                    RepositoryReleaseFilter.draft => l10n.releaseDraft,
                  },
                  selected: state.filter == filter,
                  onTap: () => onFilter(filter),
                ),
              ],
            ],
          ),
        ),
        Expanded(child: _band(context, items, columns)),
        // The pager belongs to the surface, not to the end of the list: one
        // page is no pager at all, and a loading or failed band hides it rather
        // than letting it shift around a state it cannot move. A page that a
        // filter emptied keeps its pager, because the filter only sees this
        // page and hiding the arrows would strand the reader here.
        if (pagination != null &&
            !state.loading &&
            state.failure == null &&
            (pagination.hasPrev || pagination.hasNext))
          _RepositoryReleasesPager(
            page: state.page,
            pagination: pagination,
            onPage: onPage,
          ),
      ],
    );
  }

  /// Loading, failure and empty states take the list band, never the whole
  /// surface: the filter bar above them never moves and the pager stays hidden.
  Widget _band(
    BuildContext context,
    List<RepositoryReleaseDto> items,
    _MetaColumns columns,
  ) {
    final l10n = AppLocalizations.of(context);
    if (state.loading) {
      return _scrollableBand(
        GitPulseLoadingView(label: l10n.repositoryReleasesLoading),
      );
    }
    if (state.failure case final failure?) {
      return _scrollableBand(
        GitPulseMessageView(
          icon: Icons.error_outline,
          tone: GitPulseMessageTone.error,
          liveRegion: true,
          inline: true,
          title: switch (failure) {
            RepositoryReleasesFailure.permission =>
              l10n.repositoryReleasesPermission,
            RepositoryReleasesFailure.unavailable =>
              l10n.repositoryReleasesUnavailable,
            RepositoryReleasesFailure.network => l10n.timelineErrorNetwork,
            RepositoryReleasesFailure.rateLimited =>
              l10n.timelineErrorRateLimited,
            _ => l10n.repositoryReleasesFailed,
          },
          action: OutlinedButton(
            onPressed: () => onPage(state.page),
            child: Text(l10n.timelineRetry),
          ),
        ),
      );
    }
    if (items.isEmpty) {
      return _scrollableBand(
        GitPulseMessageView(
          icon: Icons.inbox_outlined,
          inline: true,
          title: state.data?.items.isEmpty == true
              ? l10n.repositoryReleasesEmpty
              : l10n.repositoryReleasesFilteredEmpty,
        ),
      );
    }
    return ListView.builder(
      controller: scrollController,
      padding: const EdgeInsets.fromLTRB(20, 0, 20, 8),
      itemCount: items.length,
      itemBuilder: (context, index) {
        final item = items[index];
        return _ReleaseRow(
          key: ValueKey(item.id),
          item: item,
          columns: columns,
          entry: isEntry?.call(item) == true,
          onTap: () => onRelease(item),
        );
      },
    );
  }

  /// A state band still driven by the host's scroll controller when it has one:
  /// a state that replaced the rows must not take the phone sheet's body-drag
  /// away from the reader.
  Widget _scrollableBand(Widget child) => LayoutBuilder(
    builder: (context, constraints) => SingleChildScrollView(
      controller: scrollController,
      padding: const EdgeInsets.symmetric(horizontal: 20),
      child: ConstrainedBox(
        constraints: BoxConstraints(minHeight: constraints.maxHeight),
        child: Center(child: child),
      ),
    ),
  );
}

class _RepositoryReleasesPager extends StatelessWidget {
  const _RepositoryReleasesPager({
    required this.page,
    required this.pagination,
    required this.onPage,
  });

  final int page;
  final RepositoryReleasesPaginationDto pagination;
  final ValueChanged<int> onPage;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          IconButton(
            tooltip: l10n.repositoryReleasesPrevious,
            onPressed: pagination.hasPrev ? () => onPage(page - 1) : null,
            icon: const Icon(Icons.chevron_left),
          ),
          Text(l10n.repositoryReleasesPage(page)),
          IconButton(
            tooltip: l10n.repositoryReleasesNext,
            onPressed: pagination.hasNext ? () => onPage(page + 1) : null,
            icon: const Icon(Icons.chevron_right),
          ),
        ],
      ),
    );
  }
}

/// One Repository Release Filter as a label-only pill. The selected filter is
/// the only pill carrying a tone; nothing here draws a border, a check mark or
/// a permanent explanation above the list.
class _FilterPill extends StatelessWidget {
  const _FilterPill({
    required this.label,
    required this.selected,
    required this.onTap,
  });

  final String label;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final scheme = theme.colorScheme;
    return MergeSemantics(
      child: Semantics(
        button: true,
        selected: selected,
        child: Material(
          color: selected ? scheme.secondaryContainer : Colors.transparent,
          shape: const StadiumBorder(),
          clipBehavior: Clip.antiAlias,
          child: InkWell(
            // No ink radius: the Material above already clips to a StadiumBorder
            // and no press paints a tint, so a second radius decides nothing.
            onTap: onTap,
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
              child: Text(
                label,
                style: theme.textTheme.labelLarge?.copyWith(
                  color: selected
                      ? scheme.onSecondaryContainer
                      : scheme.onSurfaceVariant,
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}

/// One Repository Release List row: the release's name, one muted meta line, and
/// a leading accent bar when the row is the Entry Release. The whole row opens
/// the release.
class _ReleaseRow extends StatelessWidget {
  const _ReleaseRow({
    super.key,
    required this.item,
    required this.columns,
    required this.entry,
    required this.onTap,
  });

  final RepositoryReleaseDto item;
  final _MetaColumns columns;
  final bool entry;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final theme = Theme.of(context);
    final scheme = theme.colorScheme;
    final title = item.title;
    // The tag is printed beside the title, not on the fact line: a tag of any
    // width would otherwise push the aligned facts out of their columns.
    final metaStyle = _metaTextStyle(theme);
    final downloads = gitPulseCompactCount(context, item.downloadCount);
    return MergeSemantics(
      child: InkWell(
        borderRadius: BorderRadius.circular(GitPulseRadius.row),
        onTap: onTap,
        child: Stack(
          children: [
            if (entry)
              Positioned(
                left: 0,
                top: 0,
                bottom: 0,
                child: Semantics(
                  label: l10n.repositoryReleasesEntry,
                  child: Container(
                    width: 4,
                    decoration: BoxDecoration(
                      color: scheme.primary,
                      borderRadius: BorderRadius.circular(GitPulseRadius.bar),
                    ),
                  ),
                ),
              ),
            Padding(
              // The leading inset is reserved on every row, so titles line up
              // whether or not the Entry Release marker is beside them.
              padding: const EdgeInsets.fromLTRB(12, 10, 0, 10),
              child: Row(
                children: [
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        LayoutBuilder(
                          builder: (context, constraints) => Row(
                            children: [
                              Expanded(
                                child: Text(
                                  title,
                                  maxLines: 1,
                                  overflow: TextOverflow.ellipsis,
                                  style: theme.textTheme.titleMedium,
                                ),
                              ),
                              if (item.tagName != title) ...[
                                const SizedBox(width: 8),
                                ConstrainedBox(
                                  // The tag keeps its own width, up to the half
                                  // of the line the name leaves it.
                                  constraints: BoxConstraints(
                                    maxWidth: constraints.maxWidth * .5,
                                  ),
                                  child: Text(
                                    item.tagName,
                                    maxLines: 1,
                                    overflow: TextOverflow.ellipsis,
                                    style: metaStyle?.copyWith(
                                      fontFamily: 'monospace',
                                    ),
                                  ),
                                ),
                              ],
                            ],
                          ),
                        ),
                        const SizedBox(height: 2),
                        LayoutBuilder(
                          builder: (context, constraints) => Row(
                            children: [
                              // A date-less release keeps the date column empty
                              // so its counts still line up with the rows above
                              // and below it.
                              if (columns.date > 0) ...[
                                SizedBox(
                                  width: _columnWidth(
                                    columns.date,
                                    constraints.maxWidth,
                                  ),
                                  child: switch (item.publishedAt) {
                                    final published? => _MetaFact(
                                      icon: Icons.calendar_today_outlined,
                                      value: gitPulseMonthDay(
                                        context,
                                        published.toLocal(),
                                      ),
                                    ),
                                    null => null,
                                  },
                                ),
                                const SizedBox(width: 12),
                              ],
                              SizedBox(
                                width: _columnWidth(
                                  columns.assets,
                                  constraints.maxWidth,
                                ),
                                child: _MetaFact(
                                  icon: Icons.attach_file,
                                  value: gitPulseCount(
                                    context,
                                    item.assetsCount,
                                  ),
                                  label: l10n.timelineAssetCount(
                                    item.assetsCount,
                                  ),
                                ),
                              ),
                              const SizedBox(width: 12),
                              SizedBox(
                                width: _columnWidth(
                                  columns.downloads,
                                  constraints.maxWidth,
                                ),
                                child: _MetaFact(
                                  icon: Icons.download_outlined,
                                  value: downloads,
                                  label: l10n.repositoryReleasesDownloads(
                                    item.downloadCount,
                                    downloads,
                                  ),
                                ),
                              ),
                            ],
                          ),
                        ),
                      ],
                    ),
                  ),
                  Icon(
                    Icons.chevron_right,
                    size: 20,
                    color: scheme.onSurfaceVariant,
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  /// One column never takes more than a third of the fact line, so a large text
  /// scale wraps the value inside its column instead of pushing a column off the
  /// row.
  static double _columnWidth(double measured, double available) {
    final third = (available - 24) / 3;
    return measured < third ? measured : third;
  }
}

/// One fact in a row's meta line: a glyph that says what the value is, and the
/// value itself.
///
/// The glyph replaces a repeated noun — "assets", "downloads" — on every row,
/// so the words a reader would otherwise read again and again move into the
/// fact's semantics label, where only a screen reader hears them.
class _MetaFact extends StatelessWidget {
  const _MetaFact({required this.icon, required this.value, this.label});

  final IconData icon;
  final String value;

  /// The spoken form of the fact, with its unit; defaults to [value] when the
  /// value already says what it is, as a date does.
  final String? label;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Semantics(
      label: label ?? value,
      child: ExcludeSemantics(
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(
              icon,
              size: _metaFactIconExtent,
              color: theme.colorScheme.onSurfaceVariant,
            ),
            const SizedBox(width: _metaFactIconGap),
            // A fact keeps its whole value: at a large text scale it takes the
            // width it is given and wraps inside the fact rather than painting
            // outside the row or losing the unit that makes it readable.
            Flexible(child: Text(value, style: _metaTextStyle(theme))),
          ],
        ),
      ),
    );
  }
}

/// The glyph's size in a fact, and the space between it and the value. Both
/// belong to the column width a row reserves for the fact.
const _metaFactIconExtent = 14.0;
const _metaFactIconGap = 3.0;

/// The muted, tabular style both the fact values and the title's tag share, so
/// numbers compare down the list and the tag reads as an identifier.
TextStyle? _metaTextStyle(ThemeData theme) =>
    theme.textTheme.bodySmall?.copyWith(
      color: theme.colorScheme.onSurfaceVariant,
      fontFeatures: const [FontFeature.tabularFigures()],
    );

/// The widths the three facts share across every row on the page.
///
/// They are measured from the values about to be drawn rather than fixed in
/// pixels, so the calendar, paper-clip and download glyphs line up down the
/// list in every language and at every text scale, and a page whose dates are
/// all short does not reserve room for a year it never shows.
class _MetaColumns {
  const _MetaColumns({
    required this.date,
    required this.assets,
    required this.downloads,
  });

  final double date;
  final double assets;
  final double downloads;

  static _MetaColumns measure(
    BuildContext context,
    Iterable<RepositoryReleaseDto> items,
  ) {
    final style = _metaTextStyle(Theme.of(context));
    final textScaler = MediaQuery.textScalerOf(context);
    final textDirection = Directionality.of(context);
    double widest(Iterable<String> values) {
      var width = 0.0;
      for (final value in values) {
        final painter = TextPainter(
          text: TextSpan(text: value, style: style),
          textDirection: textDirection,
          textScaler: textScaler,
          maxLines: 1,
        )..layout();
        if (painter.width > width) width = painter.width;
        painter.dispose();
      }
      return width;
    }

    final days = <String>[
      for (final item in items)
        if (item.publishedAt case final published?)
          gitPulseMonthDay(context, published.toLocal()),
    ];
    return _MetaColumns(
      date: days.isEmpty
          ? 0
          : widest(days) + _metaFactIconExtent + _metaFactIconGap,
      assets:
          widest([
            for (final item in items) gitPulseCount(context, item.assetsCount),
          ]) +
          _metaFactIconExtent +
          _metaFactIconGap,
      downloads:
          widest([
            for (final item in items)
              gitPulseCompactCount(context, item.downloadCount),
          ]) +
          _metaFactIconExtent +
          _metaFactIconGap,
    );
  }
}
