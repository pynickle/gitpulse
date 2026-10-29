import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../l10n/generated/app_localizations.dart';
import '../presentation/gitpulse_buttons.dart';
import '../presentation/gitpulse_dialog.dart';
import '../presentation/gitpulse_progress.dart';
import '../presentation/gitpulse_setting_rows.dart';
import '../presentation/gitpulse_tokens.dart';
import '../timeline/timeline_session.dart';

/// This account's saved history, as one settings row.
///
/// Clearing is the only thing the account itself needs from this band: how much
/// history a device keeps is a device choice, and is edited with the other
/// device choices. Clearing destroys nothing but saved history, so it carries
/// its own row.
class TimelineCacheSettings extends ConsumerStatefulWidget {
  const TimelineCacheSettings({super.key});

  @override
  ConsumerState<TimelineCacheSettings> createState() =>
      _TimelineCacheSettingsState();
}

class _TimelineCacheSettingsState extends ConsumerState<TimelineCacheSettings> {
  bool _cleared = false;
  Timer? _clearedTimer;

  @override
  void dispose() {
    _clearedTimer?.cancel();
    super.dispose();
  }

  Future<void> _askToClear() async {
    final l10n = AppLocalizations.of(context);
    final confirmed = await showGitPulseDialog<bool>(
      context,
      barrierLabel: MaterialLocalizations.of(context).modalBarrierDismissLabel,
      builder: (context) => GitPulseDialog(
        title: Text(l10n.settingsClearCacheTitle),
        actions: [
          GitPulseButton(
            label: MaterialLocalizations.of(context).cancelButtonLabel,
            variant: GitPulseButtonVariant.text,
            onPressed: () => Navigator.of(context).pop(false),
          ),
          GitPulseButton(
            label: l10n.settingsClear,
            variant: GitPulseButtonVariant.text,
            onPressed: () => Navigator.of(context).pop(true),
          ),
        ],
      ),
    );
    if (confirmed != true || !mounted) return;
    final before = ref.read(releaseTimelineSessionProvider);
    await ref.read(releaseTimelineSessionProvider.notifier).clearCache();
    if (!mounted) return;
    final after = ref.read(releaseTimelineSessionProvider);
    if (identical(before, after) || !after.cacheActions.cleared) return;
    _clearedTimer?.cancel();
    setState(() => _cleared = true);
    _clearedTimer = Timer(const Duration(milliseconds: 900), () {
      if (!mounted) return;
      setState(() => _cleared = false);
    });
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final timeline = ref.watch(releaseTimelineSessionProvider);
    final actions = timeline.cacheActions;
    final facade = ref.read(releaseTimelineSessionProvider.notifier);
    final locked = actions.clearing;

    return GitPulseSettingRow(
      icon: Icons.storage_outlined,
      label: l10n.settingsTimelineCache,
      inlineControl: true,
      control: actions.clearing
          ? Padding(
              padding: const EdgeInsets.only(top: 4),
              child: GitPulseProgressInline(label: l10n.clearingTimelineCache),
            )
          : GitPulseButton(
              label: l10n.settingsClear,
              variant: GitPulseButtonVariant.outlined,
              expand: true,
              onPressed: locked ? null : _askToClear,
              icon: AnimatedSwitcher(
                duration: const Duration(milliseconds: 180),
                switchInCurve: Curves.easeOut,
                switchOutCurve: Curves.easeIn,
                transitionBuilder: (child, animation) =>
                    ScaleTransition(scale: animation, child: child),
                child: Icon(
                  _cleared ? Icons.check : Icons.delete_outline,
                  key: ValueKey(_cleared),
                  // A clear that landed is a success, and the success tone is
                  // the one tone that says so (ADR 0031): the Accent means the
                  // app is acting, never that something worked.
                  color: _cleared ? toneSuccess(context) : null,
                ),
              ),
            ),
      notes: [
        if (actions.clearFailed)
          GitPulseSettingNote(
            l10n.clearTimelineCacheFailed,
            tone: GitPulseSettingNoteTone.error,
            liveRegion: true,
          ),
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
            child: GitPulseButton(
              label: timeline.cacheCorrupted
                  ? l10n.timelineRebuildCache
                  : l10n.timelineRetrySaving,
              variant: GitPulseButtonVariant.text,
              onPressed: locked
                  ? null
                  : timeline.cacheCorrupted
                  ? facade.rebuildCache
                  : facade.retryCache,
            ),
          ),
        ],
      ],
    );
  }
}
