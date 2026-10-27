import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:share_plus/share_plus.dart';

import '../l10n/generated/app_localizations.dart';

/// Hands [url] to the platform's own share sheet, and answers whether the
/// platform had one to offer.
///
/// A platform without a share sheet answers false rather than failing: the
/// caller then copies the link, which is the same courtesy a share sheet pays.
typedef RepositorySharer = Future<bool> Function(String url);

/// The one place the app asks the platform to share.
///
/// A provider rather than a call at the button, so a test can state what the
/// platform answered instead of opening a share sheet.
final repositorySharerProvider = Provider<RepositorySharer>(
  (ref) => shareThroughSystem,
);

Future<bool> shareThroughSystem(String url) async {
  try {
    final result = await SharePlus.instance.share(ShareParams(text: url));
    return result.status != ShareResultStatus.unavailable;
  } catch (_) {
    // No share sheet here, or the plugin is not registered on this platform.
    return false;
  }
}

/// The canonical GitHub page for a repository.
///
/// Built from the identity the page already validated rather than from a URL in
/// the payload, so what leaves the app is always github.com/owner/name and never
/// a link some other source chose.
String repositoryWebUrl(String owner, String name) =>
    Uri.https('github.com', '/$owner/$name').toString();

/// Shares [url] through the system, and copies it when the platform has no
/// share sheet.
Future<void> shareRepositoryLink(
  BuildContext context,
  WidgetRef ref,
  String url,
) async {
  if (await ref.read(repositorySharerProvider)(url)) return;
  await Clipboard.setData(ClipboardData(text: url));
  if (!context.mounted) return;
  ScaffoldMessenger.maybeOf(context)?.showSnackBar(
    SnackBar(content: Text(AppLocalizations.of(context).repositoryLinkCopied)),
  );
}
