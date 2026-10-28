import 'release_detail_service.dart';

/// Where a document was read from, and how one of its addresses resolves.
///
/// This is the only implementation of the app's repository-relative rule: the
/// document page asks for a resolution rather than performing one, so a link in
/// a README and a link in a release's notes reach the same place.
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
    // A fragment is an address inside the document itself, so it never names a
    // resource the page loads.
    if (uri.path.isEmpty && uri.hasFragment) return image ? null : uri;
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

/// The one gate an address from a document passes: an http(s) URL with a host,
/// a mailto with an address, and nothing else. No user info, no other scheme, no
/// address without a host.
Uri? safeContentUri(String value, {bool image = false}) {
  final uri = Uri.tryParse(value.trim());
  if (uri == null || uri.userInfo.isNotEmpty) return null;
  if (!image && uri.scheme == 'mailto' && uri.path.isNotEmpty) return uri;
  if ((uri.scheme != 'http' && uri.scheme != 'https') || uri.host.isEmpty) {
    return null;
  }
  return uri;
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
