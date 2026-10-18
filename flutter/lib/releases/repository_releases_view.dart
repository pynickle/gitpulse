import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../l10n/generated/app_localizations.dart';
import 'repository_releases_controller.dart';
import 'repository_releases_dto.dart';
import 'repository_releases_service.dart';

class RepositoryReleasesView extends StatelessWidget {
  const RepositoryReleasesView({
    super.key,
    required this.repository,
    required this.state,
    required this.onPage,
    required this.onFilter,
    required this.onRelease,
    this.isEntry,
  });

  final String repository;
  final RepositoryReleasesState state;
  final ValueChanged<int> onPage;
  final ValueChanged<RepositoryReleaseFilter> onFilter;
  final ValueChanged<RepositoryReleaseDto> onRelease;
  final bool Function(RepositoryReleaseDto)? isEntry;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final items = state.visibleItems;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Text(repository, style: Theme.of(context).textTheme.titleLarge),
        const SizedBox(height: 8),
        Wrap(
          spacing: 8,
          children: [
            for (final filter in RepositoryReleaseFilter.values)
              ChoiceChip(
                label: Text(switch (filter) {
                  RepositoryReleaseFilter.all => l10n.repositoryReleasesAll,
                  RepositoryReleaseFilter.stable =>
                    l10n.repositoryReleasesStable,
                  RepositoryReleaseFilter.prerelease => l10n.timelinePrerelease,
                  RepositoryReleaseFilter.draft => l10n.releaseDraft,
                }),
                selected: state.filter == filter,
                onSelected: (_) => onFilter(filter),
              ),
          ],
        ),
        Text(
          l10n.repositoryReleasesPageFilter,
          style: Theme.of(context).textTheme.bodySmall,
        ),
        const SizedBox(height: 16),
        if (state.loading)
          Semantics(
            label: l10n.repositoryReleasesLoading,
            child: const Center(child: CircularProgressIndicator()),
          )
        else if (state.failure case final failure?) ...[
          Text(switch (failure) {
            RepositoryReleasesFailure.permission =>
              l10n.repositoryReleasesPermission,
            RepositoryReleasesFailure.unavailable =>
              l10n.repositoryReleasesUnavailable,
            RepositoryReleasesFailure.network => l10n.timelineErrorNetwork,
            RepositoryReleasesFailure.rateLimited =>
              l10n.timelineErrorRateLimited,
            _ => l10n.repositoryReleasesFailed,
          }),
          Center(
            child: OutlinedButton(
              onPressed: () => onPage(state.page),
              child: Text(l10n.timelineRetry),
            ),
          ),
        ] else if (items.isEmpty)
          Text(
            state.data?.items.isEmpty == true
                ? l10n.repositoryReleasesEmpty
                : l10n.repositoryReleasesFilteredEmpty,
          )
        else
          for (final item in items)
            ListTile(
              key: ValueKey(item.id),
              contentPadding: EdgeInsets.zero,
              title: Text(
                item.name?.trim().isNotEmpty == true
                    ? item.name!.trim()
                    : item.tagName,
              ),
              subtitle: Wrap(
                spacing: 8,
                runSpacing: 4,
                children: [
                  if (item.name?.trim().isNotEmpty == true) Text(item.tagName),
                  if (item.draft)
                    Text(l10n.releaseDraft)
                  else if (item.prerelease)
                    Text(l10n.timelinePrerelease),
                  if (item.publishedAt case final published?)
                    Text(
                      DateFormat.yMMMd(
                        Localizations.localeOf(context).toLanguageTag(),
                      ).format(published.toLocal()),
                    ),
                  Text(l10n.timelineAssetCount(item.assetsCount)),
                  if (isEntry?.call(item) == true)
                    Text(l10n.repositoryReleasesEntry),
                ],
              ),
              trailing: const Icon(Icons.chevron_right),
              onTap: () => onRelease(item),
            ),
        const SizedBox(height: 16),
        Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            IconButton(
              tooltip: l10n.repositoryReleasesPrevious,
              onPressed:
                  !state.loading && state.data?.pagination.hasPrev == true
                  ? () => onPage(state.page - 1)
                  : null,
              icon: const Icon(Icons.chevron_left),
            ),
            Text(l10n.repositoryReleasesPage(state.page)),
            IconButton(
              tooltip: l10n.repositoryReleasesNext,
              onPressed:
                  !state.loading && state.data?.pagination.hasNext == true
                  ? () => onPage(state.page + 1)
                  : null,
              icon: const Icon(Icons.chevron_right),
            ),
          ],
        ),
      ],
    );
  }
}
