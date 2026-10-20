import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../l10n/generated/app_localizations.dart';
import '../presentation/gitpulse_state_views.dart';
import '../presentation/presentation_settings.dart';
import 'backend_service.dart';
import 'connection_controller.dart';

String connectionProblemLabel(
  AppLocalizations l10n,
  ConnectionProblem problem,
) => switch (problem) {
  ConnectionProblem.invalidAddress => l10n.invalidAddress,
  ConnectionProblem.unreachable => l10n.unreachable,
  ConnectionProblem.serverUpgrade => l10n.serverUpgrade,
  ConnectionProblem.clientUpgrade => l10n.clientUpgrade,
  ConnectionProblem.noProviders => l10n.noProviders,
  ConnectionProblem.storageRead => l10n.storageRead,
  ConnectionProblem.storageWrite => l10n.storageWrite,
};

class ConnectionScreen extends ConsumerWidget {
  const ConnectionScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = AppLocalizations.of(context);
    final connection = ref.watch(connectionControllerProvider);
    return Scaffold(
      appBar: AppBar(
        title: const Text('GitPulse'),
        actions: [
          IconButton(
            tooltip: l10n.presentationSettings,
            onPressed: () => showPresentationSettingsDialog(context),
            icon: const Icon(Icons.tune),
          ),
        ],
      ),
      body: connection.when(
        loading: () => GitPulseLoadingView(label: l10n.connecting),
        error: (error, stack) => GitPulseMessageView(
          icon: Icons.error_outline,
          tone: GitPulseMessageTone.error,
          title: l10n.unreachable,
          action: TextButton(
            onPressed: () => ref.invalidate(connectionControllerProvider),
            child: Text(l10n.connect),
          ),
        ),
        data: (state) => _ConnectionForm(
          key: ValueKey(state.attemptedAddress ?? state.rememberedAddress),
          state: state,
        ),
      ),
    );
  }
}

Future<String?> showBackendAddressEditor(
  BuildContext context,
  String address,
) => showDialog<String>(
  context: context,
  builder: (_) => _BackendAddressEditor(address: address),
);

class _BackendAddressEditor extends StatefulWidget {
  const _BackendAddressEditor({required this.address});

  final String address;

  @override
  State<_BackendAddressEditor> createState() => _BackendAddressEditorState();
}

class _BackendAddressEditorState extends State<_BackendAddressEditor> {
  late final _address = TextEditingController(text: widget.address);
  bool _invalid = false;

  void _submit() {
    try {
      final address = parseBackendAddress(_address.text);
      Navigator.of(context).pop(address.toString());
    } on ConnectionException {
      setState(() => _invalid = true);
    }
  }

  @override
  void dispose() {
    _address.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    return AlertDialog(
      title: Text(l10n.changeBackend),
      content: SizedBox(
        width: 400,
        child: TextField(
          controller: _address,
          autofocus: true,
          keyboardType: TextInputType.url,
          autocorrect: false,
          textInputAction: TextInputAction.go,
          decoration: InputDecoration(
            labelText: l10n.backendAddress,
            errorText: _invalid ? l10n.invalidAddress : null,
            errorMaxLines: 3,
          ),
          onSubmitted: (_) => _submit(),
        ),
      ),
      actions: [
        TextButton(
          onPressed: () => Navigator.of(context).pop(),
          child: Text(MaterialLocalizations.of(context).cancelButtonLabel),
        ),
        FilledButton(onPressed: _submit, child: Text(l10n.connect)),
      ],
    );
  }
}

class _ConnectionForm extends ConsumerStatefulWidget {
  const _ConnectionForm({super.key, required this.state});

  final BackendConnectionState state;

  @override
  ConsumerState<_ConnectionForm> createState() => _ConnectionFormState();
}

class _ConnectionFormState extends ConsumerState<_ConnectionForm> {
  late final _address = TextEditingController(
    text: widget.state.attemptedAddress ?? widget.state.rememberedAddress,
  );

  @override
  void dispose() {
    _address.dispose();
    super.dispose();
  }

  void _connect() =>
      ref.read(connectionControllerProvider.notifier).connect(_address.text);

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final state = widget.state;
    return Center(
      child: SingleChildScrollView(
        padding: const EdgeInsets.all(24),
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 480),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Text(
                l10n.connectTitle,
                style: Theme.of(context).textTheme.headlineMedium,
              ),
              const SizedBox(height: 12),
              Text(l10n.connectDescription),
              const SizedBox(height: 24),
              TextField(
                controller: _address,
                enabled: !state.connecting,
                keyboardType: TextInputType.url,
                autocorrect: false,
                textInputAction: TextInputAction.go,
                decoration: InputDecoration(
                  labelText: l10n.backendAddress,
                  hintText: 'https://your-gitpulse.example',
                  border: const OutlineInputBorder(),
                ),
                onSubmitted: (_) => _connect(),
              ),
              if (state.problem case final problem?) ...[
                const SizedBox(height: 16),
                Semantics(
                  liveRegion: true,
                  child: Text(connectionProblemLabel(l10n, problem)),
                ),
              ],
              const SizedBox(height: 24),
              FilledButton(
                onPressed: state.connecting ? null : _connect,
                child: Text(state.connecting ? l10n.connecting : l10n.connect),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
