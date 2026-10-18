import 'package:flutter/material.dart';
import 'package:flutter_widget_from_html_core/flutter_widget_from_html_core.dart';

import '../l10n/generated/app_localizations.dart';
import 'document_content.dart';

class ReleaseDocument extends StatelessWidget {
  const ReleaseDocument({
    super.key,
    required this.source,
    required this.document,
    required this.onTapUrl,
  });

  final String source;
  final RepositoryDocumentContext document;
  final Future<bool> Function(String) onTapUrl;

  @override
  Widget build(BuildContext context) {
    final baseUrl = Uri(
      scheme: 'https',
      host: 'github.com',
      pathSegments: [
        document.owner,
        document.repository,
        'blob',
        document.ref,
        ...document.documentPath.split('/').where((part) => part.isNotEmpty),
      ],
    );
    return SelectionArea(
      child: HtmlWidget(
        prepareDocument(
          source,
          document,
          detailsLabel: AppLocalizations.of(context).releaseDetails,
        ),
        baseUrl: baseUrl,
        onTapUrl: (url) {
          final uri = Uri.tryParse(url);
          if (uri != null &&
              uri.hasFragment &&
              uri.removeFragment() == baseUrl) {
            return Future.value(false);
          }
          return onTapUrl(url);
        },
        textStyle: Theme.of(context).textTheme.bodyMedium,
        // Core NetworkImage is deliberately independent of the authenticated Dio
        // client. No session cookies/CSRF headers reach document resources.
        onErrorBuilder: (context, element, error) => Text(
          element.attributes['alt'] ??
              AppLocalizations.of(context).releaseResourceUnavailable,
        ),
      ),
    );
  }
}
