import 'package:flutter/material.dart';

import '../l10n/generated/app_localizations.dart';
import '../presentation/gitpulse_formatting.dart';
import '../presentation/gitpulse_state_views.dart';
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
        Expanded(child: _band(context, items)),
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
  Widget _band(BuildContext context, List<RepositoryReleaseDto> items) {
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
            borderRadius: BorderRadius.circular(16),
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
    required this.entry,
    required this.onTap,
  });

  final RepositoryReleaseDto item;
  final bool entry;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final theme = Theme.of(context);
    final scheme = theme.colorScheme;
    final title = item.title;
    // Counts and dates line up on the digits rather than on the glyph widths,
    // so two rows scrolled past each other compare their numbers directly.
    final metaStyle = theme.textTheme.bodySmall?.copyWith(
      color: scheme.onSurfaceVariant,
      fontFeatures: const [FontFeature.tabularFigures()],
    );
    // The tag is only worth printing when the title does not already say it.
    final meta = <InlineSpan>[];
    void addSegment(String text, {TextStyle? style}) {
      if (meta.isNotEmpty) {
        meta.add(TextSpan(text: ' · ', style: metaStyle));
      }
      meta.add(TextSpan(text: text, style: style));
    }

    if (item.tagName != title) {
      addSegment(
        item.tagName,
        style: metaStyle?.copyWith(fontFamily: 'monospace'),
      );
    }
    if (item.publishedAt case final published?) {
      addSegment(gitPulseMonthDay(context, published.toLocal()));
    }
    addSegment(l10n.timelineAssetCount(item.assetsCount));
    addSegment(
      l10n.repositoryReleasesDownloads(
        item.downloadCount,
        gitPulseCompactCount(context, item.downloadCount),
      ),
    );
    return MergeSemantics(
      child: InkWell(
        borderRadius: BorderRadius.circular(8),
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
                      borderRadius: BorderRadius.circular(2),
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
                        Text(
                          title,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: theme.textTheme.titleMedium,
                        ),
                        const SizedBox(height: 2),
                        Text.rich(
                          TextSpan(children: meta),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: metaStyle,
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
}
