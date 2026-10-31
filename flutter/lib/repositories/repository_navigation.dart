import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../l10n/generated/app_localizations.dart';
import '../presentation/gitpulse_buttons.dart';
import '../releases/document_content.dart';
import '../releases/release_link.dart';
import '../releases/repository_releases_page.dart';
import 'repository_screen.dart';
import 'repository_service.dart';

typedef RepositoryLinkTarget = ({
  String owner,
  String repository,
  bool releases,
});

RepositoryLinkTarget? repositoryTargetFromUri(Uri uri) {
  if (safeContentUri(uri.toString()) == null || uri.host != 'github.com') {
    return null;
  }
  final parts = uri.pathSegments.toList();
  if (parts.isNotEmpty && parts.last.isEmpty) parts.removeLast();
  final target = switch (parts) {
    [final owner, final repository] => (
      owner: owner,
      repository: repository,
      releases: false,
    ),
    [final owner, final repository, 'releases'] => (
      owner: owner,
      repository: repository,
      releases: true,
    ),
    _ => null,
  };
  if (target == null ||
      !validRepositoryIdentity(target.owner, target.repository)) {
    return null;
  }
  return target;
}

Future<void> openRepositoryPage(
  BuildContext context,
  RepositoryLinkTarget target,
) {
  // A route sits above the page that opened it instead of replacing it, so
  // Back restores the same scroll, filter and list position.
  return Navigator.of(context).push<void>(
    MaterialPageRoute(
      builder: (_) => target.releases
          ? RepositoryReleasesPage(
              owner: target.owner,
              repository: target.repository,
            )
          : RepositoryScreen(
              owner: target.owner,
              repository: target.repository,
            ),
    ),
  );
}

Future<bool> openNativeContentLink(
  BuildContext context,
  WidgetRef ref,
  String value, {
  bool external = false,
}) => openReleaseLink(context, ref, value, external: external);

/// The navigation bar every Repository page shares: Back to whatever opened the
/// page, and Home to the Timeline.
///
/// [title] stays optional because a page whose own content already names itself
/// — the repository detail, which opens with the repository's identity — must
/// not print that name a second time a few pixels above it.
///
/// [onBack] is the page's own step back, when it has one: a repository opened
/// from a release returns to that release, and the repository screen passes the
/// navigation its route came from. Every other page pops, and the Timeline is
/// what a page with nothing left to pop to returns to.
class RepositoryPageAppBar extends StatelessWidget
    implements PreferredSizeWidget {
  const RepositoryPageAppBar({super.key, this.title, this.onBack});
  final String? title;
  final VoidCallback? onBack;
  @override
  Size get preferredSize => const Size.fromHeight(kToolbarHeight);

  @override
  Widget build(BuildContext context) => AppBar(
    title: title == null ? null : Text(title!),
    leading: BackButton(
      onPressed:
          onBack ??
          () {
            if (Navigator.of(context).canPop()) {
              Navigator.of(context).pop();
            } else {
              GoRouter.maybeOf(context)?.go('/timeline');
            }
          },
    ),
    actions: [
      // Home is the app's own action; Back above it stays the platform's own
      // affordance, which is a registered Platform Dialect Exception.
      GitPulseIconButton(
        label: AppLocalizations.of(context).navigationHome,
        icon: const Icon(Icons.home_outlined),
        onPressed: () {
          final router = GoRouter.maybeOf(context);
          Navigator.of(context).popUntil((route) => route.isFirst);
          router?.go('/timeline');
        },
      ),
    ],
  );
}
