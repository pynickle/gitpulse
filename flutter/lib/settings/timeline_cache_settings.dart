import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../l10n/generated/app_localizations.dart';
import '../presentation/gitpulse_setting_rows.dart';
import '../presentation/gitpulse_theme.dart';
import '../presentation/gitpulse_tokens.dart';
import '../timeline/timeline_session.dart';

/// This account's saved history, as one settings row.
///
/// Clearing is the only thing the account itself needs from this band: how much
/// history a device keeps is a device choice, and is edited with the other
/// device choices. Clearing destroys nothing but saved history, so it carries
/// its own row.
class TimelineCacheSettings extends ConsumerWidget {
  const TimelineCacheSettings({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = AppLocalizations.of(context);
    final theme = Theme.of(context);
    final scheme = theme.colorScheme;
    final timeline = ref.watch(releaseTimelineSessionProvider);
    final actions = timeline.cacheActions;
    final facade = ref.read(releaseTimelineSessionProvider.notifier);
    final locked = actions.clearing;

    return GitPulseSettingRow(
      label: l10n.settingsTimelineCache,
      control: actions.clearing
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
              onPressed: locked ? null : facade.clearCache,
              style: OutlinedButton.styleFrom(
                minimumSize: const Size(0, 40),
                padding: const EdgeInsets.symmetric(horizontal: 12),
                visualDensity: VisualDensity.compact,
                foregroundColor: scheme.onSurface,
                side: BorderSide(color: scheme.outlineVariant),
                textStyle: theme.textTheme.bodyMedium,
              ).copyWith(overlayColor: gitPulseInkOverlay(scheme)),
              icon: const Icon(
                Icons.delete_outline,
                size: GitPulseIconSize.inControl,
              ),
              label: Text(l10n.settingsClear),
            ),
      notes: [
        if (actions.clearFailed)
          GitPulseSettingNote(
            l10n.clearTimelineCacheFailed,
            tone: GitPulseSettingNoteTone.error,
            liveRegion: true,
          ),
        if (actions.cleared)
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
              onPressed: locked
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
    );
  }
}
