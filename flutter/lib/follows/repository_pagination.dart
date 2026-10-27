import 'package:flutter/material.dart';

import '../l10n/generated/app_localizations.dart';
import '../presentation/gitpulse_pill.dart';
import '../presentation/gitpulse_tokens.dart';
import 'release_follows_dto.dart';

/// Page navigation over the last successful response, including unknown totals.
///
/// Back, the page being read and forward are one flat pill, and the number of
/// pages last on the response is stated beside it as a count. The number is
/// always a field: tapping it moves nothing, and the only mark focus makes is
/// the pill's edge turning to the accent.
class RepositoryPagination extends StatefulWidget {
  const RepositoryPagination({
    super.key,
    required this.pagination,
    required this.loading,
    required this.onPage,
    this.page,
  });

  final RepositorySearchPaginationDto pagination;
  final bool loading;
  final ValueChanged<int> onPage;

  /// The page to name, when it is not the one on the response: a page that has
  /// been asked for and is on its way is already the page the reader is going
  /// to, so the field says so while it loads.
  final int? page;

  @override
  State<RepositoryPagination> createState() => _RepositoryPaginationState();
}

class _RepositoryPaginationState extends State<RepositoryPagination> {
  late final TextEditingController _page;
  final _focus = FocusNode();

  int get _named => widget.page ?? widget.pagination.page;

  @override
  void initState() {
    super.initState();
    _page = TextEditingController(text: '$_named');
    _focus.addListener(_onFocus);
  }

  @override
  void didUpdateWidget(RepositoryPagination oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.pagination != widget.pagination ||
        oldWidget.page != widget.page ||
        oldWidget.loading != widget.loading) {
      _restore();
    }
  }

  @override
  void dispose() {
    _focus
      ..removeListener(_onFocus)
      ..dispose();
    _page.dispose();
    super.dispose();
  }

  void _restore() => _page.text = '$_named';

  void _onFocus() {
    if (!mounted) return;
    // The edge is the whole of the focus feedback, so the pill has to repaint;
    // nothing about its shape or its size changes with the focus.
    setState(() {});
    if (!_focus.hasFocus) _commit();
  }

  void _commit() {
    final target = int.tryParse(_page.text.trim());
    final meta = widget.pagination;
    // The field keeps naming the page this control stands for until the asked
    // page arrives, so a rejected or repeated entry changes nothing.
    _restore();
    if (widget.loading ||
        target == null ||
        target < 1 ||
        meta.totalPages != null && target > meta.totalPages! ||
        target == _named ||
        target == meta.page) {
      return;
    }
    widget.onPage(target);
  }

  void _navigate(int page) {
    _focus.unfocus();
    widget.onPage(page);
  }

  @override
  Widget build(BuildContext context) {
    final meta = widget.pagination;
    if (!meta.hasPrev && !meta.hasNext && (meta.totalPages ?? 1) <= 1) {
      return const SizedBox.shrink();
    }
    final l10n = AppLocalizations.of(context);
    final total = meta.totalPages;
    return TextFieldTapRegion(
      child: Row(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          // The pill keeps the width its cells need; the count beside it is what
          // gives way when the window is too narrow for both.
          GitPulsePill(
            focused: _focus.hasFocus,
            cells: [
              GitPulsePillStep(
                icon: Icons.chevron_left,
                tooltip: l10n.followsPreviousPage,
                onPressed: !widget.loading && meta.hasPrev
                    ? () => _navigate(meta.page - 1)
                    : null,
              ),
              GitPulsePillNumber(
                key: const ValueKey('repository-page'),
                controller: _page,
                focusNode: _focus,
                label: l10n.followsPage,
                enabled: !widget.loading,
                onCommit: _commit,
              ),
              GitPulsePillStep(
                icon: Icons.chevron_right,
                tooltip: l10n.followsNextPage,
                onPressed: !widget.loading && meta.hasNext
                    ? () => _navigate(meta.page + 1)
                    : null,
              ),
            ],
          ),
          if (total != null) ...[
            const SizedBox(width: GitPulseSpace.inline),
            Flexible(
              child: Text(
                l10n.followsTotalPages(total),
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: gitPulseTypeMeta(context),
              ),
            ),
          ],
        ],
      ),
    );
  }
}
