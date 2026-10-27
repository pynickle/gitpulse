import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../l10n/generated/app_localizations.dart';
import '../presentation/gitpulse_tokens.dart';
import 'release_follows_dto.dart';

/// Page navigation over the last successful response, including unknown totals.
class RepositoryPagination extends StatelessWidget {
  const RepositoryPagination({
    super.key,
    required this.pagination,
    required this.loading,
    required this.onPage,
  });

  final RepositorySearchPaginationDto pagination;
  final bool loading;
  final ValueChanged<int> onPage;

  @override
  Widget build(BuildContext context) {
    final meta = pagination;
    if (!meta.hasPrev && !meta.hasNext && (meta.totalPages ?? 1) <= 1) {
      return const SizedBox.shrink();
    }
    final l10n = AppLocalizations.of(context);
    final format = NumberFormat.decimalPattern(l10n.localeName);
    final total = meta.totalPages;
    final pages = <int>{
      meta.page,
      if (total != null) ...[1, total],
      if (meta.hasPrev || total != null && meta.page > 1) meta.page - 1,
      if (meta.hasNext || total != null && meta.page < total) meta.page + 1,
    }.where((page) => page > 0).toList()..sort();
    final controls = <Widget>[
      IconButton(
        tooltip: l10n.followsPreviousPage,
        onPressed: !loading && meta.hasPrev
            ? () => onPage(meta.page - 1)
            : null,
        icon: const Icon(Icons.chevron_left),
      ),
    ];
    for (var i = 0; i < pages.length; i++) {
      if (i > 0 && pages[i] - pages[i - 1] > 1) {
        controls.add(const ExcludeSemantics(child: Text('…')));
      }
      final page = pages[i];
      controls.add(
        MergeSemantics(
          child: Semantics(
            key: ValueKey('repository-page-$page'),
            selected: page == meta.page,
            child: TextButton(
              onPressed: loading || page == meta.page
                  ? null
                  : () => onPage(page),
              style: TextButton.styleFrom(
                minimumSize: const Size(
                  GitPulseHeight.compact,
                  GitPulseHeight.compact,
                ),
                padding: const EdgeInsets.symmetric(
                  horizontal: GitPulseSpace.inline,
                ),
                foregroundColor: Theme.of(context).colorScheme.onSurface,
                disabledForegroundColor: Theme.of(context)
                    .colorScheme
                    .onSurface,
                backgroundColor: page == meta.page
                    ? Theme.of(context).colorScheme.secondaryContainer
                    : null,
              ),
              child: Text(format.format(page)),
            ),
          ),
        ),
      );
    }
    controls.add(
      IconButton(
        tooltip: l10n.followsNextPage,
        onPressed: !loading && meta.hasNext
            ? () => onPage(meta.page + 1)
            : null,
        icon: const Icon(Icons.chevron_right),
      ),
    );
    return Wrap(
      alignment: WrapAlignment.center,
      crossAxisAlignment: WrapCrossAlignment.center,
      children: controls,
    );
  }
}
