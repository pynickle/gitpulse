import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../connection/connection_controller.dart';
import '../presentation/gitpulse_tokens.dart';
import 'backend_details.dart';
import 'sign_in_cards.dart';

/// What a destination in front of a signed-out reader shows: the backend this
/// installation talks to, and the ways into it.
///
/// The page stands on the page itself rather than on a card around everything:
/// the backend is the page's own subject, so it opens it as a centred header —
/// with whatever the connection and the session say about themselves under it —
/// and each way in is a card of its own below. The shell's Timeline and Follows
/// destinations and the two repository pages all put this in front of a
/// signed-out reader, so the app has one sign-in surface rather than one per
/// page.
class AccountGate extends ConsumerWidget {
  const AccountGate({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final backend = ref.watch(connectionControllerProvider).value?.backend;
    if (backend == null) return const SizedBox.shrink();
    return Center(
      child: SingleChildScrollView(
        padding: const EdgeInsets.fromLTRB(
          GitPulseSpace.gutter,
          GitPulseSpace.bandGap,
          GitPulseSpace.gutter,
          GitPulseSpace.bandGapLoose,
        ),
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: GitPulseWidth.dialog),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            mainAxisSize: MainAxisSize.min,
            children: [
              const BackendDetails(layout: BackendDetailsLayout.page),
              const SizedBox(height: GitPulseSpace.bandGap),
              SignInCards(capabilities: backend.capabilities),
            ],
          ),
        ),
      ),
    );
  }
}
