import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../device/device_preferences.dart';
import '../device/device_preferences_controller.dart';
import '../l10n/generated/app_localizations.dart';
import '../presentation/gitpulse_setting_rows.dart';
import '../presentation/gitpulse_tokens.dart';
import '../timeline/timeline_session.dart';

/// This installation's own choices, as settings rows: language, appearance, and
/// how much release history it keeps.
///
/// They work before a backend is reachable, before sign-in, and offline: a
/// choice applies immediately and is remembered in local device storage. Each
/// row's control names its own choices, so no line has to explain what the row
/// is for.
class DeviceSettings extends ConsumerWidget {
  const DeviceSettings({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = AppLocalizations.of(context);
    final rememberFailed = ref.watch(
      devicePreferencesStateProvider.select((state) => state.rememberFailed),
    );

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        const _LanguageRow(),
        const GitPulseSettingsDivider(),
        const _AppearanceRow(),
        const GitPulseSettingsDivider(),
        const _RetentionRow(),
        if (rememberFailed)
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

class _LanguageRow extends ConsumerWidget {
  const _LanguageRow();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = AppLocalizations.of(context);
    final preferences = ref.watch(
      devicePreferencesStateProvider.select((state) => state.preferences),
    );
    return GitPulseSettingRow(
      label: l10n.presentationLanguage,
      control: _Choices<AppLanguage>(
        options: [
          (AppLanguage.system, l10n.presentationLanguageSystem),
          (AppLanguage.english, l10n.presentationLanguageEnglish),
          (AppLanguage.simplifiedChinese, l10n.presentationLanguageChinese),
        ],
        selected: preferences.language,
        onSelected: (language) => ref
            .read(devicePreferencesProvider.notifier)
            .selectLanguage(language),
      ),
    );
  }
}

class _AppearanceRow extends ConsumerWidget {
  const _AppearanceRow();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = AppLocalizations.of(context);
    final preferences = ref.watch(
      devicePreferencesStateProvider.select((state) => state.preferences),
    );
    return GitPulseSettingRow(
      label: l10n.presentationAppearance,
      control: _Choices<AppAppearance>(
        options: [
          (AppAppearance.system, l10n.presentationAppearanceSystem),
          (AppAppearance.light, l10n.presentationAppearanceLight),
          (AppAppearance.dark, l10n.presentationAppearanceDark),
        ],
        selected: preferences.appearance,
        onSelected: (appearance) => ref
            .read(devicePreferencesProvider.notifier)
            .selectAppearance(appearance),
      ),
    );
  }
}

/// The retention window's editor: whole days, applied when the reader confirms.
///
/// The window is this installation's own, so the editor never waits for a round
/// trip and never claims to be synchronizing: the field holds the window in
/// force, and the confirm action appears only once the reader has typed
/// something else. A window changed here is applied to saved history at once.
class _RetentionRow extends ConsumerStatefulWidget {
  const _RetentionRow();

  @override
  ConsumerState<_RetentionRow> createState() => _RetentionRowState();
}

class _RetentionRowState extends ConsumerState<_RetentionRow> {
  final _days = TextEditingController();
  int? _shownDays;
  bool _invalid = false;

  @override
  void dispose() {
    _days.dispose();
    super.dispose();
  }

  /// Applies what the field holds, as long as it is a window this device can
  /// keep. Both the confirm action and the Enter key land here.
  void _apply() {
    final chosen = ref
        .read(devicePreferencesStateProvider)
        .preferences
        .retentionDays;
    final parsed = int.tryParse(_days.text.trim());
    // Validity comes first: an installation that has not chosen a window yet has
    // no value to compare against, and an invalid entry is still refused.
    final invalid = validRetentionDays(parsed) == null;
    setState(() => _invalid = invalid);
    if (invalid) return;
    if (parsed == chosen) return;
    ref.read(devicePreferencesProvider.notifier).selectRetentionDays(parsed!);
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final theme = Theme.of(context);
    final scheme = theme.colorScheme;
    final days = ref.watch(
      devicePreferencesStateProvider.select(
        (state) => state.preferences.resolvedRetentionDays,
      ),
    );
    // A round being read owns the window it is saving under, and a clear is
    // rewriting the same history: a new window waits for either to finish.
    final locked = ref.watch(
      releaseTimelineSessionProvider.select(
        (state) => state.loading || state.cacheActions.clearing,
      ),
    );

    if (days != _shownDays) {
      _shownDays = days;
      _days.text = days.toString();
      _invalid = false;
    }
    final typed = int.tryParse(_days.text.trim());
    final edited = typed != days;

    final border = OutlineInputBorder(
      borderRadius: BorderRadius.circular(GitPulseRadius.row),
      borderSide: BorderSide.none,
    );

    return GitPulseSettingRow(
      label: l10n.settingsKeepReleases,
      control: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          SizedBox(
            width: 72,
            child: TextField(
              key: const ValueKey('retention-days'),
              controller: _days,
              enabled: !locked,
              keyboardType: TextInputType.number,
              textInputAction: TextInputAction.done,
              textAlign: TextAlign.center,
              style: theme.textTheme.bodyMedium?.copyWith(
                fontFeatures: const [FontFeature.tabularFigures()],
              ),
              onChanged: (_) => setState(() => _invalid = false),
              onSubmitted: (_) => _apply(),
              decoration: InputDecoration(
                isDense: true,
                filled: true,
                fillColor: scheme.surfaceContainerHigh,
                contentPadding: const EdgeInsets.symmetric(
                  horizontal: 8,
                  vertical: 9,
                ),
                constraints: const BoxConstraints(
                  minHeight: GitPulseHeight.compact,
                ),
                border: border,
                enabledBorder: border,
                focusedBorder: border.copyWith(
                  borderSide: BorderSide(color: scheme.primary),
                ),
              ),
            ),
          ),
          const SizedBox(width: 8),
          // The unit restates the number the field already shows, so it follows
          // what the reader typed rather than the saved window. English and
          // Chinese each have one singular form, so the ARB carries the two
          // words instead of a count-bearing plural that would print the number
          // twice.
          Text(
            (typed ?? days) == 1 ? l10n.settingsUnitDay : l10n.settingsUnitDays,
            style: theme.textTheme.bodySmall?.copyWith(
              color: scheme.onSurfaceVariant,
            ),
          ),
          // The confirm action appears where the reader's eye already is: at
          // the end of the value they just changed, and nowhere while the field
          // still holds the window in force.
          if (edited)
            Padding(
              padding: const EdgeInsets.only(left: 6),
              // Material's own padding around an 18dp glyph keeps the painted
              // mark small and the touch target a thumb wide.
              child: IconButton.filledTonal(
                tooltip: l10n.retentionSave,
                onPressed: locked ? null : _apply,
                iconSize: GitPulseIconSize.inControl,
                // A coloured surface answers a press, so this one keeps
                // Material's wash of its own tone instead of the theme's shared
                // overlay — which cannot tell the four IconButton variants apart
                // (MASTER §3.3 E9).
                style: IconButton.styleFrom(
                  overlayColor: scheme.onSecondaryContainer,
                ),
                icon: const Icon(Icons.check),
              ),
            ),
        ],
      ),
      notes: [
        if (_invalid)
          GitPulseSettingNote(
            l10n.retentionInvalid,
            tone: GitPulseSettingNoteTone.error,
            liveRegion: true,
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
///
/// The retention window is not offered here: it prunes saved history, which the
/// connection screen has none of.
Future<void> showDeviceSettingsDialog(BuildContext context) => showDialog<void>(
  context: context,
  builder: (_) => const _DeviceSettingsDialog(),
);

class _DeviceSettingsDialog extends ConsumerWidget {
  const _DeviceSettingsDialog();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = AppLocalizations.of(context);
    final rememberFailed = ref.watch(
      devicePreferencesStateProvider.select((state) => state.rememberFailed),
    );
    return AlertDialog(
      title: Text(l10n.presentationSettings),
      content: SizedBox(
        width: 420,
        child: SingleChildScrollView(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              const _LanguageRow(),
              const GitPulseSettingsDivider(),
              const _AppearanceRow(),
              // A choice that could not be remembered is reported here too: the
              // reader made it in this dialog.
              if (rememberFailed)
                Padding(
                  padding: const EdgeInsets.only(top: 10),
                  child: GitPulseSettingNote(
                    l10n.presentationRememberFailed,
                    liveRegion: true,
                  ),
                ),
            ],
          ),
        ),
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
