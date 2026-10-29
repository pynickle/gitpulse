import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../device/device_preferences.dart';
import '../device/device_preferences_controller.dart';
import '../l10n/generated/app_localizations.dart';
import '../presentation/gitpulse_buttons.dart';
import '../presentation/gitpulse_dialog.dart';
import '../presentation/gitpulse_setting_rows.dart';
import '../presentation/gitpulse_tokens.dart';
import '../timeline/timeline_session.dart';

/// This installation's own choices, as settings cards: language, appearance,
/// and how much release history it keeps.
///
/// They work before a backend is reachable, before sign-in, and offline: a
/// choice applies immediately and is remembered in local device storage. Each
/// card's control names its own choices, so no line has to explain what the
/// card is for.
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
        const SizedBox(height: GitPulseSpace.bandGap),
        const _AppearanceRow(),
        const SizedBox(height: GitPulseSpace.bandGap),
        const _RetentionRow(),
        if (rememberFailed) ...[
          const SizedBox(height: GitPulseSpace.tight),
          GitPulseSettingNote(
            l10n.presentationRememberFailed,
            liveRegion: true,
          ),
        ],
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
      icon: Icons.language,
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
      icon: Icons.palette_outlined,
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

/// The retention window's editor.
///
/// Stepping one day applies immediately. The number is always a field: leaving
/// it saves a whole day from 1 to 90, and anything else snaps back to the value
/// in force. A rejected entry names itself beside the title, then leaves.
class _RetentionRow extends ConsumerStatefulWidget {
  const _RetentionRow();

  @override
  ConsumerState<_RetentionRow> createState() => _RetentionRowState();
}

class _RetentionRowState extends ConsumerState<_RetentionRow> {
  static const _hintDuration = Duration(seconds: 3);

  final _days = TextEditingController();
  final _focus = FocusNode();
  int? _shownDays;
  bool _applyingStep = false;
  bool _pending = false;
  bool _rejected = false;
  Timer? _hintTimer;

  @override
  void initState() {
    super.initState();
    _focus.addListener(_onFocus);
  }

  @override
  void dispose() {
    _hintTimer?.cancel();
    _focus
      ..removeListener(_onFocus)
      ..dispose();
    _days.dispose();
    super.dispose();
  }

  int get _resolved => ref
      .read(devicePreferencesStateProvider)
      .preferences
      .resolvedRetentionDays;

  void _onFocus() {
    if (_focus.hasFocus || _applyingStep || !mounted) return;
    _commit();
  }

  /// Applies one step to the window in force. The ends of the range have no
  /// step, so those buttons stay disabled.
  void _step(int delta) {
    if (_pending) return;
    final next = validRetentionDays(_resolved + delta);
    if (next == null) return;
    _applyingStep = true;
    _days.text = '$next';
    _shownDays = next;
    _focus.unfocus();
    _applyingStep = false;
    _clearHint();
    unawaited(_choose(next));
  }

  /// Saves the field when the reader leaves it. An illegal entry never replaces
  /// the window: the field returns to the value in force.
  void _commit() {
    if (_pending) return;
    final resolved = _resolved;
    final parsed = int.tryParse(_days.text.trim());
    if (validRetentionDays(parsed) == null) {
      _days.text = '$resolved';
      _showHint();
      return;
    }
    _days.text = '$parsed';
    _clearHint();
    if (parsed == resolved) return;
    unawaited(_choose(parsed!));
  }

  Future<void> _choose(int days) async {
    setState(() => _pending = true);
    try {
      await ref
          .read(releaseTimelineSessionProvider.notifier)
          .chooseRetentionWindow(days);
    } finally {
      if (mounted) setState(() => _pending = false);
    }
  }

  void _showHint() {
    _hintTimer?.cancel();
    setState(() => _rejected = true);
    _hintTimer = Timer(_hintDuration, () {
      if (!mounted) return;
      setState(() => _rejected = false);
    });
  }

  void _clearHint() {
    _hintTimer?.cancel();
    if (!_rejected) return;
    setState(() => _rejected = false);
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final days = ref.watch(
      devicePreferencesStateProvider.select(
        (state) => state.preferences.resolvedRetentionDays,
      ),
    );
    // A round being read owns the window it is saving under, and a clear is
    // rewriting the same history: a new window waits for either to finish.
    final sessionLocked = ref.watch(
      releaseTimelineSessionProvider.select(
        (state) => state.loading || state.cacheActions.clearing,
      ),
    );
    final locked = _pending || sessionLocked;

    if (!_focus.hasFocus && days != _shownDays) {
      _shownDays = days;
      _days.text = '$days';
    }

    final border = OutlineInputBorder(
      borderRadius: BorderRadius.circular(GitPulseRadius.row),
      borderSide: BorderSide.none,
    );
    Widget stepButton({
      required String tooltip,
      required IconData icon,
      required bool enabled,
      required int delta,
    }) => GitPulseIconButton(
      tooltip: tooltip,
      onPressed: !locked && enabled ? () => _step(delta) : null,
      size: GitPulseIconSize.inControl,
      icon: Icon(icon),
    );

    return GitPulseSettingRow(
      icon: Icons.history,
      label: l10n.settingsKeepReleases,
      aside: _rejected
          ? Semantics(
              liveRegion: true,
              child: Text(
                l10n.retentionRejected,
                style: gitPulseTypeMeta(context)
                    ?.copyWith(color: toneDanger(context)),
              ),
            )
          : null,
      control: Wrap(
        spacing: GitPulseSpace.inline,
        runSpacing: GitPulseSpace.inline,
        crossAxisAlignment: WrapCrossAlignment.center,
        children: [
          stepButton(
            tooltip: l10n.decreaseRetention,
            icon: Icons.remove,
            enabled: days > DevicePreferences.minimumRetentionDays,
            delta: -1,
          ),
          SizedBox(
            width: GitPulseWidth.integerField,
            child: TextField(
              key: const ValueKey('retention-days'),
              controller: _days,
              focusNode: _focus,
              enabled: !locked,
              keyboardType: TextInputType.number,
              textInputAction: TextInputAction.done,
              textAlign: TextAlign.center,
              textAlignVertical: TextAlignVertical.center,
              style: gitPulseTypeFieldText(
                context,
              )?.copyWith(fontFeatures: const [FontFeature.tabularFigures()]),
              onSubmitted: (_) => _focus.unfocus(),
              onTapOutside: (_) => _focus.unfocus(),
              // The input itself stays the platform's own (ADR 0032): the app
              // supplies the decoration around it and nothing about typing.
              decoration: InputDecoration(
                isDense: true,
                filled: true,
                fillColor: toneShell(context),
                contentPadding: const EdgeInsets.symmetric(
                  horizontal: GitPulseSpace.inline,
                  vertical: GitPulseSpace.meta,
                ),
                constraints: const BoxConstraints(
                  minHeight: GitPulseHeight.compact,
                ),
                border: border,
                enabledBorder: border,
                focusedBorder: border.copyWith(
                  borderSide: BorderSide(color: toneAccent(context)),
                ),
              ),
            ),
          ),
          stepButton(
            tooltip: l10n.increaseRetention,
            icon: Icons.add,
            enabled: days < DevicePreferences.maximumRetentionDays,
            delta: 1,
          ),
          // English and Chinese each have one singular form, so the ARB carries
          // the two words instead of a plural that would print the number twice.
          Text(
            days == 1 ? l10n.settingsUnitDay : l10n.settingsUnitDays,
            style: gitPulseTypeMeta(context),
          ),
        ],
      ),
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
/// connection screen has none of. The dialog is the app's own overlay, opened
/// through the one function that opens them (ADR 0032).
Future<void> showDeviceSettingsDialog(BuildContext context) =>
    showGitPulseDialog<void>(
      context,
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
    return GitPulseDialog(
      title: Text(l10n.presentationSettings),
      content: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          const _LanguageRow(),
          const SizedBox(height: GitPulseSpace.bandGap),
          const _AppearanceRow(),
          // A choice that could not be remembered is reported here too: the
          // reader made it in this dialog.
          if (rememberFailed) ...[
            const SizedBox(height: GitPulseSpace.tight),
            GitPulseSettingNote(
              l10n.presentationRememberFailed,
              liveRegion: true,
            ),
          ],
        ],
      ),
      actions: [
        GitPulseButton(
          label: MaterialLocalizations.of(context).closeButtonLabel,
          variant: GitPulseButtonVariant.text,
          onPressed: () => Navigator.of(context).pop(),
        ),
      ],
    );
  }
}
