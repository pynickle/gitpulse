import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../connection/connection_controller.dart';
import '../presentation/gitpulse_tokens.dart';
import 'backend_details.dart';
import 'sign_in_cards.dart';

/// What a destination in front of a signed-out reader shows: the ways into this
/// backend, and nothing else.
///
/// The page is about getting in, so the cards that do that are the whole of it.
/// The server they sign into is the Settings destination's to state, copy and
/// change — a signed-out reader reaches that page like any other — and a second
/// account of it above these cards was a line that belonged to another page
/// (ADR 0040).
///
/// The one thing drawn above them is what a session has to report about its own
/// trouble — a rejected password, a browser sign-in that expired, an identity
/// this device cannot account for — because that is the news this page exists to
/// carry, and it belongs where the reader is about to act.
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
              const BackendStateNotes(
                padding: EdgeInsets.only(bottom: GitPulseSpace.bandGap),
              ),
              SignInCards(capabilities: backend.capabilities),
            ],
          ),
        ),
      ),
    );
  }
}
