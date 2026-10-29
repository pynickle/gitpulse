import 'dart:math' as math;

import 'package:flutter/material.dart';

import '../l10n/generated/app_localizations.dart';
import '../presentation/gitpulse_buttons.dart';
import '../presentation/gitpulse_theme.dart';
import '../presentation/gitpulse_tokens.dart';
import 'release_follows_dto.dart';

/// Fixed page navigation with a discoverable, inline page-number editor.
/// The complete page indicator becomes a field while editing; the label
/// returns after submission without moving the neighbouring controls.
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
  bool _editing = false;

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
    if (oldWidget.page != widget.page || oldWidget.loading != widget.loading) {
      _editing = false;
      _restore();
      _focus.unfocus();
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
    if (mounted && !_focus.hasFocus && _editing) _commit();
  }

  void _beginEdit() {
    if (widget.loading) return;
    _restore();
    setState(() => _editing = true);
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted || !_editing) return;
      _focus.requestFocus();
      _page.selection = TextSelection(
        baseOffset: 0,
        extentOffset: _page.text.length,
      );
    });
  }

  void _commit() {
    if (!_editing) return;
    final target = int.tryParse(_page.text.trim());
    setState(() => _editing = false);
    _restore();
    _focus.unfocus();
    if (widget.loading ||
        target == null ||
        target < 1 ||
        widget.pagination.totalPages != null &&
            target > widget.pagination.totalPages!) {
      return;
    }
    widget.onPage(target);
  }

  void _navigate(int page) {
    setState(() => _editing = false);
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
    final numbers = MaterialLocalizations.of(context);
    final total = meta.totalPages;
    final label = total == null
        ? l10n.followsCurrentPage(_named)
        : '${numbers.formatDecimal(_named)} / ${numbers.formatDecimal(total)}';
    final ink = widget.loading ? toneTextSubtle(context) : toneText(context);
    final style = gitPulseTypeControlLabel(
      context,
      ink,
    )?.copyWith(fontFeatures: const [FontFeature.tabularFigures()]);
    final measure = TextPainter(
      text: TextSpan(text: label, style: style),
      textDirection: Directionality.of(context),
      textScaler: MediaQuery.textScalerOf(context),
    )..layout();
    final width = math.max(
      GitPulseWidth.integerField,
      measure.width + GitPulseSpace.inline * 2,
    );
    final height = math.max(
      GitPulseHeight.compact,
      measure.height + GitPulseSpace.inline * 2,
    );
    measure.dispose();
    return TextFieldTapRegion(
      child: Row(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          GitPulseIconButton(
            label: l10n.followsFirstPage,
            dimension: GitPulseHeight.compact,
            onPressed: widget.loading ? null : () => _navigate(1),
            icon: const Icon(Icons.first_page),
          ),
          GitPulseIconButton(
            label: l10n.followsPreviousPage,
            dimension: GitPulseHeight.compact,
            onPressed: !widget.loading && meta.hasPrev
                ? () => _navigate(meta.page - 1)
                : null,
            icon: const Icon(Icons.chevron_left),
          ),
          Flexible(
            child: SizedBox(
              key: const ValueKey('repository-page'),
              width: width,
              height: height,
              child: Material(
                color: widget.loading
                    ? toneSurfaceMuted(context)
                    : toneShell(context),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(GitPulseRadius.row),
                  side: _editing
                      ? BorderSide(
                          color: toneAccent(context),
                          width: GitPulseStroke.hairline,
                        )
                      : BorderSide.none,
                ),
                clipBehavior: Clip.antiAlias,
                child: _editing
                    ? Center(
                        child: TextField(
                          key: const ValueKey('repository-page-editor'),
                          controller: _page,
                          focusNode: _focus,
                          keyboardType: TextInputType.number,
                          textInputAction: TextInputAction.done,
                          textAlign: TextAlign.center,
                          textAlignVertical: TextAlignVertical.center,
                          style: gitPulseTypeFieldText(context),
                          onSubmitted: (_) => _commit(),
                          onTapOutside: (_) => _focus.unfocus(),
                          decoration: InputDecoration(
                            isDense: true,
                            border: InputBorder.none,
                            enabledBorder: InputBorder.none,
                            focusedBorder: InputBorder.none,
                            contentPadding: const EdgeInsets.symmetric(
                              horizontal: GitPulseSpace.inline,
                            ),
                            hintText: l10n.followsPage,
                          ),
                        ),
                      )
                    : Semantics(
                        button: true,
                        enabled: !widget.loading,
                        label: '${l10n.followsEditPage}, $label',
                        child: InkWell(
                          onTap: widget.loading ? null : _beginEdit,
                          overlayColor: gitPulseFilledInkOverlay(
                            Theme.of(context).colorScheme,
                            ink,
                          ),
                          child: Padding(
                            padding: const EdgeInsets.symmetric(
                              horizontal: GitPulseSpace.inline,
                            ),
                            child: Center(
                              child: ExcludeSemantics(
                                child: Text(
                                  label,
                                  maxLines: 1,
                                  overflow: TextOverflow.ellipsis,
                                  style: style,
                                ),
                              ),
                            ),
                          ),
                        ),
                      ),
              ),
            ),
          ),
          GitPulseIconButton(
            label: l10n.followsNextPage,
            dimension: GitPulseHeight.compact,
            onPressed: !widget.loading && meta.hasNext
                ? () => _navigate(meta.page + 1)
                : null,
            icon: const Icon(Icons.chevron_right),
          ),
        ],
      ),
    );
  }
}
