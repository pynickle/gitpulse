import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../l10n/generated/app_localizations.dart';
import '../presentation/gitpulse_tokens.dart';
import 'release_follows_dto.dart';

/// Page navigation over the last successful response, including unknown totals.
class RepositoryPagination extends StatefulWidget {
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
  State<RepositoryPagination> createState() => _RepositoryPaginationState();
}

class _RepositoryPaginationState extends State<RepositoryPagination> {
  late final TextEditingController _page;
  final _focus = FocusNode();

  @override
  void initState() {
    super.initState();
    _page = TextEditingController(text: '${widget.pagination.page}');
    _focus.addListener(_onFocus);
  }

  @override
  void didUpdateWidget(RepositoryPagination oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.pagination != widget.pagination ||
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

  void _restore() => _page.text = '${widget.pagination.page}';

  void _onFocus() {
    if (!_focus.hasFocus) _commit();
  }

  void _commit() {
    final target = int.tryParse(_page.text.trim());
    final meta = widget.pagination;
    // The field names the page being read until the backend confirms a jump.
    _restore();
    if (widget.loading ||
        target == null ||
        target < 1 ||
        meta.totalPages != null && target > meta.totalPages! ||
        target == meta.page) {
      return;
    }
    widget.onPage(target);
  }

  void _navigate(int page) {
    _restore();
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
    final theme = Theme.of(context);
    final scheme = theme.colorScheme;
    final total = meta.totalPages;
    final border = OutlineInputBorder(
      borderRadius: BorderRadius.circular(GitPulseRadius.row),
      borderSide: BorderSide.none,
    );
    final arrowStyle = IconButton.styleFrom(
      minimumSize: Size.zero,
      fixedSize: const Size(GitPulseHeight.compact, GitPulseHeight.rowMin),
      tapTargetSize: MaterialTapTargetSize.shrinkWrap,
      padding: EdgeInsets.zero,
    );
    return TextFieldTapRegion(
      child: Row(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          IconButton(
            tooltip: l10n.followsPreviousPage,
            style: arrowStyle,
            onPressed: !widget.loading && meta.hasPrev
                ? () => _navigate(meta.page - 1)
                : null,
            iconSize: GitPulseIconSize.action,
            icon: const Icon(Icons.chevron_left),
          ),
          SizedBox(
            width: GitPulseWidth.integerField,
            child: TextField(
              key: const ValueKey('repository-page'),
              controller: _page,
              focusNode: _focus,
              enabled: !widget.loading,
              keyboardType: TextInputType.number,
              textInputAction: TextInputAction.done,
              textAlign: TextAlign.center,
              style: theme.textTheme.bodyMedium?.copyWith(
                fontFeatures: const [FontFeature.tabularFigures()],
              ),
              onSubmitted: (_) {
                _commit();
                _focus.unfocus();
              },
              onTapOutside: (_) => _focus.unfocus(),
              decoration: InputDecoration(
                labelText: l10n.followsPage,
                floatingLabelBehavior: FloatingLabelBehavior.never,
                isDense: true,
                filled: true,
                fillColor: scheme.surfaceContainerHigh,
                contentPadding: const EdgeInsets.symmetric(
                  horizontal: GitPulseSpace.inline,
                  vertical: GitPulseSpace.meta,
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
            ),
          ),
          if (total != null)
            Flexible(
              child: Padding(
                padding: const EdgeInsets.only(left: GitPulseSpace.glyphGap),
                child: Text(
                  '/ ${NumberFormat.decimalPattern(l10n.localeName).format(total)}',
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: gitPulseTypeMeta(context),
                ),
              ),
            ),
          IconButton(
            tooltip: l10n.followsNextPage,
            style: arrowStyle,
            onPressed: !widget.loading && meta.hasNext
                ? () => _navigate(meta.page + 1)
                : null,
            iconSize: GitPulseIconSize.action,
            icon: const Icon(Icons.chevron_right),
          ),
        ],
      ),
    );
  }
}
