import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../l10n/generated/app_localizations.dart';
import '../presentation/gitpulse_tokens.dart';
import 'native_code_highlighter.dart';

class NativeCodeBlock extends ConsumerWidget {
  const NativeCodeBlock({super.key, required this.source, this.language = ''});

  final String source;
  final String language;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final view = _CodeView(
      source: source,
      language: language,
      brightness: Theme.of(context).brightness,
      highlighter: ref.watch(nativeCodeHighlighterProvider),
    );
    return SelectionContainer.maybeOf(context) == null
        ? SelectionArea(child: view)
        : view;
  }
}

class _CodeView extends StatefulWidget {
  const _CodeView({
    required this.source,
    required this.language,
    required this.brightness,
    required this.highlighter,
  });

  final String source;
  final String language;
  final Brightness brightness;
  final NativeCodeHighlighter highlighter;

  @override
  State<_CodeView> createState() => _CodeViewState();
}

class _CodeViewState extends State<_CodeView> {
  final _scroll = ScrollController();
  late Future<HighlightedCode?> _highlight = _load();

  Future<HighlightedCode?> _load() async {
    try {
      return await widget.highlighter.highlight(
        widget.source,
        widget.language,
        widget.brightness,
      );
    } catch (_) {
      return null;
    }
  }

  @override
  void didUpdateWidget(_CodeView oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (widget.source != oldWidget.source ||
        widget.language != oldWidget.language ||
        widget.brightness != oldWidget.brightness ||
        widget.highlighter != oldWidget.highlighter) {
      _highlight = _load();
    }
  }

  @override
  void dispose() {
    _scroll.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final strings = AppLocalizations.of(context);
    return FutureBuilder<HighlightedCode?>(
      future: _highlight,
      builder: (context, snapshot) {
        final highlighted = snapshot.connectionState == ConnectionState.done
            ? snapshot.data
            : null;
        return ColoredBox(
          color: highlighted?.background ?? theme.colorScheme.surfaceContainer,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              SelectionContainer.disabled(
                child: Padding(
                  padding: const EdgeInsets.only(left: 12, right: 4),
                  child: Row(
                    children: [
                      Expanded(
                        child: Text(
                          widget.language.isEmpty
                              ? strings.contentPlainText
                              : widget.language,
                          style: theme.textTheme.labelMedium,
                        ),
                      ),
                      IconButton(
                        tooltip: strings.contentCopyCode,
                        iconSize: GitPulseIconSize.inControl,
                        icon: const Icon(Icons.copy),
                        onPressed: () => Clipboard.setData(
                          ClipboardData(text: widget.source),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
              Scrollbar(
                controller: _scroll,
                child: SingleChildScrollView(
                  controller: _scroll,
                  scrollDirection: Axis.horizontal,
                  padding: const EdgeInsets.all(12),
                  child: Text.rich(
                    highlighted?.span ?? TextSpan(text: widget.source),
                    style: theme.textTheme.bodyMedium?.copyWith(
                      fontFamily: 'monospace',
                    ),
                    textDirection: TextDirection.ltr,
                    softWrap: false,
                  ),
                ),
              ),
            ],
          ),
        );
      },
    );
  }
}
