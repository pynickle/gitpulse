import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../l10n/generated/app_localizations.dart';
import 'gitpulse_setting_rows.dart';
import 'presentation_preferences.dart';
import 'presentation_preferences_controller.dart';

/// This installation's language and appearance, as two settings rows.
///
/// They work before a backend is reachable and before sign-in: a choice applies
/// immediately and is remembered in local device storage. Each row's control
/// names its own choices, so no line has to explain what the row is for.
class PresentationSettings extends ConsumerWidget {
  const PresentationSettings({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = AppLocalizations.of(context);
    final state = ref.watch(presentationPreferencesStateProvider);
    final preferences = state.preferences;
    final controller = ref.read(presentationPreferencesProvider.notifier);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        GitPulseSettingRow(
          label: l10n.presentationLanguage,
          control: _Choices<AppLanguage>(
            options: [
              (AppLanguage.system, l10n.presentationLanguageSystem),
              (AppLanguage.english, l10n.presentationLanguageEnglish),
              (AppLanguage.simplifiedChinese, l10n.presentationLanguageChinese),
            ],
            selected: preferences.language,
            onSelected: controller.selectLanguage,
          ),
        ),
        const GitPulseSettingsDivider(),
        GitPulseSettingRow(
          label: l10n.presentationAppearance,
          control: _Choices<AppAppearance>(
            options: [
              (AppAppearance.system, l10n.presentationAppearanceSystem),
              (AppAppearance.light, l10n.presentationAppearanceLight),
              (AppAppearance.dark, l10n.presentationAppearanceDark),
            ],
            selected: preferences.appearance,
            onSelected: controller.selectAppearance,
          ),
        ),
        if (state.rememberFailed)
          Padding(
            padding: const EdgeInsets.fromLTRB(
              gitPulseSettingsGutter,
              0,
              gitPulseSettingsGutter,
              10,
            ),
            child: GitPulseSettingNote(
              l10n.presentationRememberFailed,
              liveRegion: true,
            ),
          ),
      ],
    );
  }
}

/// One row's mutually exclusive choices.
///
/// The selected chip keeps its check mark as well as its fill: a reader who
/// cannot tell the two fills apart still sees which choice is in force.
class _Choices<T> extends StatelessWidget {
  const _Choices({
    required this.options,
    required this.selected,
    required this.onSelected,
  });

  final List<(T, String)> options;
  final T selected;
  final ValueChanged<T> onSelected;

  @override
  Widget build(BuildContext context) {
    return Wrap(
      spacing: 8,
      runSpacing: 8,
      children: [
        for (final (option, label) in options)
          ChoiceChip(
            label: Text(label),
            selected: option == selected,
            visualDensity: VisualDensity.compact,
            onSelected: (_) => onSelected(option),
          ),
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
      content: const SizedBox(
        width: 420,
        child: SingleChildScrollView(child: PresentationSettings()),
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
