import 'package:flutter/material.dart';

import '../l10n/generated/app_localizations.dart';
import '../presentation/gitpulse_buttons.dart';
import '../presentation/gitpulse_formatting.dart';
import '../presentation/gitpulse_state_views.dart';
import '../presentation/gitpulse_status_badge.dart';
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
                  // A filter's label can also be a row's own state word —
                  // `Prerelease`, `Draft` — so the control is addressed by key
                  // and never told apart from a label by its characters.
                  key: ValueKey(filter.name),
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
          action: GitPulseButton(
            label: l10n.timelineRetry,
            variant: GitPulseButtonVariant.outlined,
            onPressed: () => onPage(state.page),
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
          GitPulseIconButton(
            tooltip: l10n.repositoryReleasesPrevious,
            onPressed: pagination.hasPrev ? () => onPage(page - 1) : null,
            icon: const Icon(Icons.chevron_left),
          ),
          Text(
            l10n.repositoryReleasesPage(page),
            style: gitPulseTypeMeta(context),
          ),
          GitPulseIconButton(
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
    super.key,
    required this.label,
    required this.selected,
    required this.onTap,
  });

  final String label;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final ink = selected ? toneAccent(context) : toneTextMuted(context);
    return MergeSemantics(
      child: Semantics(
        button: true,
        selected: selected,
        child: Material(
          // A chosen chip keeps the active step of the palette, and its label
          // reads back in the Accent — the same pairing the app states for a
          // selected row (ADR 0031).
          color: selected ? toneSurfaceActive(context) : GitPulsePaint.none,
          shape: const StadiumBorder(),
          clipBehavior: Clip.antiAlias,
          child: InkWell(
            // No ink radius: the Material above already clips to a StadiumBorder
            // and no press paints a tint, so a second radius decides nothing.
            onTap: onTap,
            child: Padding(
              // The label lost a step but the pill keeps its height: a filter
              // chip stays a 36dp target, and the room the smaller word gave
              // back goes into the padding rather than into the touch area.
              padding: const EdgeInsets.symmetric(
                horizontal: 12,
                vertical: GitPulseSpace.meta,
              ),
              child: Text(label, style: gitPulseTypeControlLabel(context, ink)),
            ),
          ),
        ),
      ),
    );
  }
}

/// One Repository Release List row: the release's name, one muted meta line, a
/// leading accent bar when the row is the Entry Release, and a Release State
/// badge beside the name when the release is a draft or a prerelease. The whole
/// row opens the release.
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
    final title = item.title;
    // The release's state is one badge beside the name, never a second line:
    // it is the one thing about a release that neither its title nor its facts
    // can say. A draft wins over a prerelease, because the list's own filter
    // never files a draft under prereleases.
    final state = item.draft
        ? (icon: Icons.visibility_off_outlined, label: l10n.releaseDraft)
        : item.prerelease
        ? (icon: Icons.science_outlined, label: l10n.timelinePrerelease)
        : null;
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
                      color: toneAccent(context),
                      borderRadius: BorderRadius.circular(GitPulseRadius.bar),
                    ),
                  ),
                ),
              ),
            Padding(
              // The leading inset is reserved on every row, so titles line up
              // whether or not the Entry Release marker is beside them. The
              // vertical inset follows the smaller type: the two lines are
              // shorter now, and a row that kept its old padding would read as
              // small text floating in empty space.
              padding: const EdgeInsets.fromLTRB(
                12,
                GitPulseSpace.inline,
                0,
                GitPulseSpace.inline,
              ),
              child: Row(
                children: [
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        // The badge shares the name's line rather than the
                        // row's, so it takes width from the name alone and
                        // never from the aligned meta columns below it.
                        Row(
                          children: [
                            Expanded(
                              child: Text(
                                title,
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                                style: gitPulseTypeRowLabel(context),
                              ),
                            ),
                            if (state case final state?) ...[
                              const SizedBox(width: GitPulseSpace.inline),
                              GitPulseStatusBadge(
                                icon: state.icon,
                                label: state.label,
                              ),
                            ],
                          ],
                        ),
                        const SizedBox(height: GitPulseSpace.nudge),
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
                  // One gap between the badge and the way into the release,
                  // when there is a badge to separate. The badge keeps its own
                  // width and the name yields to it, so a row at any text scale
                  // loses characters of the name rather than its state.
                  if (state != null)
                    const SizedBox(width: GitPulseSpace.inline),
                  Icon(
                    Icons.chevron_right,
                    size: GitPulseIconSize.action,
                    color: toneTextMuted(context),
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
    return Semantics(
      label: label ?? value,
      child: ExcludeSemantics(
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(
              icon,
              size: _metaFactIconExtent,
              color: toneTextMuted(context),
            ),
            const SizedBox(width: _metaFactIconGap),
            // A fact keeps its whole value: at a large text scale it takes the
            // width it is given and wraps inside the fact rather than painting
            // outside the row or losing the unit that makes it readable.
            Flexible(child: Text(value, style: _metaTextStyle(context))),
          ],
        ),
      ),
    );
  }
}

/// The glyph's size in a fact, and the space between it and the value. Both
/// belong to the column width a row reserves for the fact.
const _metaFactIconExtent = GitPulseIconSize.fact;
const _metaFactIconGap = 3.0;

/// The muted, tabular style the fact values share, so numbers compare down the
/// list.
TextStyle? _metaTextStyle(BuildContext context) =>
    gitPulseTypeMetaTight(context)
        ?.copyWith(fontFeatures: const [FontFeature.tabularFigures()]);

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
    final style = _metaTextStyle(context);
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
