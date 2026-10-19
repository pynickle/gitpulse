import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../l10n/generated/app_localizations.dart';
import '../timeline/timeline_session.dart';

class TimelineCacheSettingsPanel extends ConsumerStatefulWidget {
  const TimelineCacheSettingsPanel({super.key});

  @override
  ConsumerState<TimelineCacheSettingsPanel> createState() =>
      _TimelineCacheSettingsPanelState();
}

class _TimelineCacheSettingsPanelState
    extends ConsumerState<TimelineCacheSettingsPanel> {
  final _form = GlobalKey<FormState>();
  final _days = TextEditingController(text: '30');
  int? _shownDays;

  @override
  void dispose() {
    _days.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final timeline = ref.watch(releaseTimelineSessionProvider);
    final settings = timeline.cacheSettings;
    final days = settings.retentionDays;
    if (days != _shownDays) {
      _shownDays = days;
      _days.text = '${days ?? 30}';
    }
    final busy = timeline.loading || settings.saving || settings.clearing;
    final facade = ref.read(releaseTimelineSessionProvider.notifier);
    return Form(
      key: _form,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            l10n.retentionTitle,
            style: Theme.of(context).textTheme.titleLarge,
          ),
          const SizedBox(height: 8),
          Text(l10n.retentionDescription),
          const SizedBox(height: 12),
          Text(
            days == null ? l10n.retentionUnknown : l10n.retentionCurrent(days),
          ),
          if (settings.syncFailed)
            Text(
              days == null
                  ? l10n.retentionSyncUnavailable
                  : l10n.retentionSyncFailed,
            ),
          if (timeline.cacheFailed)
            Text(
              timeline.cacheCorrupted
                  ? l10n.timelineCacheCorrupted
                  : l10n.timelineCacheFailed,
            ),
          if (timeline.cacheFailed)
            TextButton(
              onPressed: busy
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
          const SizedBox(height: 12),
          TextFormField(
            controller: _days,
            enabled: !busy,
            keyboardType: TextInputType.number,
            decoration: InputDecoration(labelText: l10n.retentionDays),
            validator: (value) {
              final parsed = int.tryParse(value?.trim() ?? '');
              return parsed != null && parsed >= 1 && parsed <= 90
                  ? null
                  : l10n.retentionInvalid;
            },
          ),
          const SizedBox(height: 12),
          FilledButton(
            onPressed: busy
                ? null
                : () {
                    if (_form.currentState!.validate()) {
                      facade.saveRetention(int.parse(_days.text.trim()));
                    }
                  },
            child: Text(
              settings.saving ? l10n.retentionSaving : l10n.retentionSave,
            ),
          ),
          if (settings.saveFailed) Text(l10n.retentionSaveFailed),
          const SizedBox(height: 24),
          Text(l10n.clearTimelineCacheDescription),
          const SizedBox(height: 12),
          OutlinedButton.icon(
            onPressed: settings.clearing || settings.saving
                ? null
                : facade.clearCache,
            icon: const Icon(Icons.delete_outline),
            label: Text(
              settings.clearing
                  ? l10n.clearingTimelineCache
                  : l10n.clearTimelineCache,
            ),
          ),
          if (settings.clearFailed) Text(l10n.clearTimelineCacheFailed),
          if (settings.cleared) Text(l10n.timelineCacheCleared),
        ],
      ),
    );
  }
}
