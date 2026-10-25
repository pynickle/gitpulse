import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../l10n/generated/app_localizations.dart';
import '../presentation/gitpulse_setting_rows.dart';
import '../presentation/gitpulse_theme.dart';
import '../presentation/gitpulse_tokens.dart';
import '../timeline/timeline_session.dart';

/// This account's release-retention policy and this installation's copy of it,
/// as two settings rows.
///
/// Retention is account-wide and only an accepted server change moves it, so the
/// editor keeps the synchronized value in the field and offers the save action
/// only once the reader has typed something else. Clearing is local and
/// destructive of nothing but saved history, so it is a row of its own rather
/// than an action on the policy above it.
class TimelineCacheSettings extends ConsumerStatefulWidget {
  const TimelineCacheSettings({super.key});

  @override
  ConsumerState<TimelineCacheSettings> createState() =>
      _TimelineCacheSettingsState();
}

class _TimelineCacheSettingsState extends ConsumerState<TimelineCacheSettings> {
  final _days = TextEditingController();
  int? _shownDays;
  bool _invalid = false;

  @override
  void dispose() {
    _days.dispose();
    super.dispose();
  }

  /// Saves what the field holds, if it holds anything the account does not.
  ///
  /// Both the save action and the Enter key land here, so neither can put a
  /// policy the server already has back on the wire.
  void _save() {
    final parsed = int.tryParse(_days.text.trim());
    final synced = ref
        .read(releaseTimelineSessionProvider)
        .cacheSettings
        .retentionDays;
    if (parsed == synced) {
      setState(() => _invalid = false);
      return;
    }
    final invalid = parsed == null || parsed < 1 || parsed > 90;
    setState(() => _invalid = invalid);
    if (invalid) return;
    ref.read(releaseTimelineSessionProvider.notifier).saveRetention(parsed);
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final theme = Theme.of(context);
    final scheme = theme.colorScheme;
    final timeline = ref.watch(releaseTimelineSessionProvider);
    final settings = timeline.cacheSettings;
    final facade = ref.read(releaseTimelineSessionProvider.notifier);
    // A read in flight blocks a policy change, which the session would refuse
    // anyway, but never the local clear: clearing is what a reader reaches for
    // when a round is stuck, so it must outlive the round it interrupts.
    final policyLocked =
        timeline.loading || settings.saving || settings.clearing;
    final clearLocked = settings.saving || settings.clearing;

    final days = settings.retentionDays;
    if (days != _shownDays) {
      _shownDays = days;
      _days.text = days?.toString() ?? '';
      _invalid = false;
    }
    final typed = int.tryParse(_days.text.trim());
    // The server owns the policy: until the reader types something else, the
    // field is the synchronized value and there is nothing to send.
    final edited = typed != days;
    final unit = typed ?? days;

    final border = OutlineInputBorder(
      borderRadius: BorderRadius.circular(GitPulseRadius.row),
      borderSide: BorderSide.none,
    );

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        GitPulseSettingRow(
          label: l10n.settingsKeepReleases,
          control: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              SizedBox(
                width: 72,
                child: TextField(
                  key: const ValueKey('retention-days'),
                  controller: _days,
                  enabled: !policyLocked,
                  keyboardType: TextInputType.number,
                  textInputAction: TextInputAction.done,
                  textAlign: TextAlign.center,
                  style: theme.textTheme.bodyMedium?.copyWith(
                    fontFeatures: const [FontFeature.tabularFigures()],
                  ),
                  onChanged: (_) => setState(() => _invalid = false),
                  onSubmitted: (_) => _save(),
                  decoration: InputDecoration(
                    isDense: true,
                    filled: true,
                    fillColor: scheme.surfaceContainerHigh,
                    contentPadding: const EdgeInsets.symmetric(
                      horizontal: 8,
                      vertical: 9,
                    ),
                    constraints: const BoxConstraints(minHeight: 36),
                    border: border,
                    enabledBorder: border,
                    focusedBorder: border.copyWith(
                      borderSide: BorderSide(color: scheme.primary),
                    ),
                  ),
                ),
              ),
              if (unit != null) ...[
                const SizedBox(width: 8),
                // The unit restates the number the field already shows, so it
                // follows what the reader typed rather than the saved policy.
                // English and Chinese each have one singular form, so the ARB
                // carries the two words instead of a count-bearing plural that
                // would print the number twice.
                Text(
                  unit == 1 ? l10n.settingsUnitDay : l10n.settingsUnitDays,
                  style: theme.textTheme.bodySmall?.copyWith(
                    color: scheme.onSurfaceVariant,
                  ),
                ),
              ],
              // The save action appears where the reader's eye already is: at
              // the end of the value they just changed, and nowhere when the
              // field still holds the synchronized policy.
              if (settings.saving)
                Padding(
                  padding: const EdgeInsets.only(left: 10),
                  child: Semantics(
                    label: l10n.retentionSaving,
                    liveRegion: true,
                    child: const SizedBox(
                      width: 18,
                      height: 18,
                      child: CircularProgressIndicator(strokeWidth: 2),
                    ),
                  ),
                )
              else if (edited)
                Padding(
                  padding: const EdgeInsets.only(left: 6),
                  // Material's own padding around an 18dp glyph keeps the
                  // painted mark small and the touch target a thumb wide.
                  child: IconButton.filledTonal(
                    tooltip: l10n.retentionSave,
                    onPressed: policyLocked ? null : _save,
                    iconSize: 18,
                    // A coloured surface answers a press, so this one keeps
                    // Material's wash of its own tone instead of the theme's
                    // shared overlay — which cannot tell the four IconButton
                    // variants apart (MASTER §3.3 E9).
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
              )
            else if (settings.saveFailed)
              GitPulseSettingNote(
                l10n.retentionSaveFailed,
                tone: GitPulseSettingNoteTone.error,
                liveRegion: true,
              ),
            if (days == null) ...[
              GitPulseSettingNote(l10n.retentionUnknown),
              if (settings.syncFailed)
                GitPulseSettingNote(
                  l10n.retentionSyncUnavailable,
                  tone: GitPulseSettingNoteTone.error,
                  liveRegion: true,
                ),
            ] else if (settings.syncFailed)
              GitPulseSettingNote(
                l10n.retentionSyncFailed,
                tone: GitPulseSettingNoteTone.error,
                liveRegion: true,
              ),
            // Only while the field holds something the account does not: the
            // reader is looking at a policy that has not been accepted yet, so
            // the one that is still in force has to be somewhere on the page.
            if (days != null && edited)
              GitPulseSettingNote(l10n.retentionCurrent(days)),
          ],
        ),
        const GitPulseSettingsDivider(),
        GitPulseSettingRow(
          label: l10n.settingsTimelineCache,
          control: settings.clearing
              ? Padding(
                  padding: const EdgeInsets.only(top: 4),
                  child: Semantics(
                    label: l10n.clearingTimelineCache,
                    liveRegion: true,
                    child: const SizedBox(
                      width: 20,
                      height: 20,
                      child: CircularProgressIndicator(strokeWidth: 2),
                    ),
                  ),
                )
              : OutlinedButton.icon(
                  onPressed: clearLocked ? null : facade.clearCache,
                  style: OutlinedButton.styleFrom(
                    minimumSize: const Size(0, 40),
                    padding: const EdgeInsets.symmetric(horizontal: 12),
                    visualDensity: VisualDensity.compact,
                    foregroundColor: scheme.onSurface,
                    side: BorderSide(color: scheme.outlineVariant),
                    textStyle: theme.textTheme.bodyMedium,
                  ).copyWith(overlayColor: gitPulseInkOverlay(scheme)),
                  icon: const Icon(Icons.delete_outline, size: 18),
                  label: Text(l10n.settingsClear),
                ),
          notes: [
            if (settings.clearFailed)
              GitPulseSettingNote(
                l10n.clearTimelineCacheFailed,
                tone: GitPulseSettingNoteTone.error,
                liveRegion: true,
              ),
            if (settings.cleared)
              GitPulseSettingNote(l10n.timelineCacheCleared, liveRegion: true),
            if (timeline.cacheFailed) ...[
              GitPulseSettingNote(
                timeline.cacheCorrupted
                    ? l10n.timelineCacheCorrupted
                    : l10n.timelineCacheFailed,
                tone: GitPulseSettingNoteTone.error,
                liveRegion: true,
              ),
              Align(
                alignment: AlignmentDirectional.centerStart,
                child: TextButton(
                  onPressed: policyLocked
                      ? null
                      : timeline.cacheCorrupted
                      ? facade.rebuildCache
                      : facade.retryCache,
                  child: Text(
                    timeline.cacheCorrupted
                        ? l10n.timelineRebuildCache
                        : l10n.timelineRetrySaving,
                  ),
                ),
              ),
            ],
          ],
        ),
      ],
    );
  }
}
