import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../l10n/generated/app_localizations.dart';
import 'presentation_preferences.dart';
import 'presentation_preferences_controller.dart';

/// Language and appearance controls for this installation.
///
/// They work before a backend is reachable and before sign-in: the choice is
/// applied immediately and remembered in local device storage.
class PresentationSettingsPanel extends ConsumerWidget {
  const PresentationSettingsPanel({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = AppLocalizations.of(context);
    final state = ref.watch(presentationPreferencesStateProvider);
    final preferences = state.preferences;
    final controller = ref.read(presentationPreferencesProvider.notifier);
    final theme = Theme.of(context);

    Widget choices<T>({
      required List<(T, String)> options,
      required T selected,
      required ValueChanged<T> onSelected,
    }) => Wrap(
      spacing: 8,
      runSpacing: 8,
      children: [
        for (final (option, label) in options)
          ChoiceChip(
            label: Text(label),
            selected: option == selected,
            onSelected: (_) => onSelected(option),
          ),
      ],
    );

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(l10n.presentationLanguage, style: theme.textTheme.titleLarge),
        const SizedBox(height: 4),
        Text(l10n.presentationLanguageDescription),
        const SizedBox(height: 8),
        choices<AppLanguage>(
          options: [
            (AppLanguage.system, l10n.presentationLanguageSystem),
            (AppLanguage.english, l10n.presentationLanguageEnglish),
            (AppLanguage.simplifiedChinese, l10n.presentationLanguageChinese),
          ],
          selected: preferences.language,
          onSelected: controller.selectLanguage,
        ),
        const SizedBox(height: 20),
        Text(l10n.presentationAppearance, style: theme.textTheme.titleLarge),
        const SizedBox(height: 4),
        Text(l10n.presentationAppearanceDescription),
        const SizedBox(height: 8),
        choices<AppAppearance>(
          options: [
            (AppAppearance.system, l10n.presentationAppearanceSystem),
            (AppAppearance.light, l10n.presentationAppearanceLight),
            (AppAppearance.dark, l10n.presentationAppearanceDark),
          ],
          selected: preferences.appearance,
          onSelected: controller.selectAppearance,
        ),
        if (state.rememberFailed) ...[
          const SizedBox(height: 8),
          Semantics(
            liveRegion: true,
            child: Text(l10n.presentationRememberFailed),
          ),
        ],
      ],
    );
  }
}

/// Opens the language and appearance controls in a dialog, for surfaces that
/// are reached before the Settings destination is available.
Future<void> showPresentationSettingsDialog(BuildContext context) =>
    showDialog<void>(
      context: context,
      builder: (_) => const _PresentationSettingsDialog(),
    );

class _PresentationSettingsDialog extends StatelessWidget {
  const _PresentationSettingsDialog();

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    return AlertDialog(
      title: Text(l10n.presentationSettings),
      content: SizedBox(
        width: 420,
        child: SingleChildScrollView(child: const PresentationSettingsPanel()),
      ),
      actions: [
        TextButton(
          onPressed: () => Navigator.of(context).pop(),
          child: Text(MaterialLocalizations.of(context).closeButtonLabel),
        ),
      ],
    );
  }
}
