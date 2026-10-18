import 'package:html/dom.dart';
import 'package:html/parser.dart' as html;
import 'package:markdown/markdown.dart' as markdown;

import 'release_detail_service.dart';

class RepositoryDocumentContext {
  const RepositoryDocumentContext({
    required this.owner,
    required this.repository,
    required this.ref,
    this.documentPath = '',
  });

  final String owner;
  final String repository;
  final String ref;
  final String documentPath;

  Uri? resolve(String value, {bool image = false}) {
    final uri = Uri.tryParse(value.trim());
    if (uri == null || value.trim().isEmpty) return null;
    if (uri.hasScheme || uri.hasAuthority) {
      final safe = safeContentUri(
        uri.hasScheme ? uri.toString() : 'https:$uri',
        image: image,
      );
      final parts = safe?.pathSegments ?? const <String>[];
      if (image &&
          safe?.host == 'github.com' &&
          parts.length >= 5 &&
          (parts[2] == 'blob' || parts[2] == 'raw')) {
        return Uri(
          scheme: 'https',
          host: 'raw.githubusercontent.com',
          pathSegments: [parts[0], parts[1], ...parts.skip(3)],
        );
      }
      return safe;
    }
    if (uri.path.isEmpty && uri.hasFragment && !image) return uri;
    // A leading slash starts at the repository root, independent of the
    // current document directory (GitHub's repository Markdown convention).
    final resolved = Uri(path: '/$documentPath').resolveUri(uri);
    return Uri(
      scheme: 'https',
      host: image ? 'raw.githubusercontent.com' : 'github.com',
      pathSegments: [
        owner,
        repository,
        if (!image) 'blob',
        ref,
        ...resolved.pathSegments.where((part) => part.isNotEmpty),
      ],
      query: resolved.hasQuery ? resolved.query : null,
      fragment: resolved.hasFragment ? resolved.fragment : null,
    );
  }
}

Uri? safeContentUri(String value, {bool image = false}) {
  final uri = Uri.tryParse(value.trim());
  if (uri == null || uri.userInfo.isNotEmpty) return null;
  if (!image && uri.scheme == 'mailto' && uri.path.isNotEmpty) return uri;
  if ((uri.scheme != 'http' && uri.scheme != 'https') || uri.host.isEmpty) {
    return null;
  }
  return uri;
}

// The native renderer never receives active content, CSS URLs, srcsets, forms,
// embedded browsing contexts, local-file URLs, or inline SVG from a document.
const _allowedElements = {
  'a',
  'abbr',
  'b',
  'blockquote',
  'br',
  'caption',
  'code',
  'dd',
  'del',
  'details',
  'div',
  'dl',
  'dt',
  'em',
  'figcaption',
  'figure',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'hr',
  'i',
  'img',
  'kbd',
  'li',
  'ol',
  'p',
  'pre',
  's',
  'samp',
  'small',
  'span',
  'strong',
  'sub',
  'summary',
  'sup',
  'table',
  'tbody',
  'td',
  'tfoot',
  'th',
  'thead',
  'tr',
  'ul',
};
const _discardElements = {
  'script',
  'style',
  'iframe',
  'object',
  'embed',
  'form',
  'input',
  'button',
  'textarea',
  'select',
  'video',
  'audio',
  'source',
  'svg',
  'math',
  'link',
  'meta',
  'base',
};

String prepareDocument(
  String source,
  RepositoryDocumentContext context, {
  String detailsLabel = 'Details',
}) {
  final fragment = html.parseFragment(
    markdown.markdownToHtml(
      source,
      extensionSet: markdown.ExtensionSet.gitHubWeb,
    ),
  );
  void clean(Node parent) {
    for (final element in parent.children.toList()) {
      final tag = element.localName;
      if (_discardElements.contains(tag)) {
        element.remove();
        continue;
      }
      clean(element);
      if (!_allowedElements.contains(tag)) {
        element.replaceWith(
          DocumentFragment()..nodes.addAll(element.nodes.toList()),
        );
        continue;
      }
      element.attributes.removeWhere(
        (name, _) => !{
          'id',
          'title',
          if (tag == 'a') 'href',
          if (tag == 'img') ...['src', 'alt', 'width', 'height'],
          if (tag == 'details') 'open',
          if (tag == 'td' || tag == 'th') ...['colspan', 'rowspan'],
          if (tag == 'ol') 'start',
        }.contains(name),
      );
      for (final attribute in ['href', 'src']) {
        final original = element.attributes[attribute];
        if (original == null) continue;
        final resolved = context.resolve(original, image: attribute == 'src');
        if (resolved == null) {
          element.attributes.remove(attribute);
        } else {
          element.attributes[attribute] = resolved.toString();
        }
      }
      if (tag == 'details' &&
          !element.children.any((child) => child.localName == 'summary')) {
        element.nodes.insert(0, Element.tag('summary')..text = detailsLabel);
      }
    }
  }

  clean(fragment);
  return fragment.outerHtml;
}

ReleaseTarget? releaseTargetFromUri(Uri uri) {
  if (safeContentUri(uri.toString()) == null || uri.host != 'github.com') {
    return null;
  }
  final parts = uri.pathSegments;
  if (parts.length < 4 || parts[2] != 'releases') return null;
  if (parts[3] == 'tag' && parts.length >= 5) {
    return (
      owner: parts[0],
      repository: parts[1],
      id: null,
      tag: parts.skip(4).join('/'),
    );
  }
  final id = int.tryParse(parts[3]);
  if (parts.length == 4 && id != null && id > 0) {
    return (owner: parts[0], repository: parts[1], id: id, tag: null);
  }
  return null;
}
