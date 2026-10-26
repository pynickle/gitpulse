import 'package:flutter/material.dart';

/// The language this installation presents GitPulse in.
enum AppLanguage {
  /// Follow the operating system's preferred language.
  system('system'),

  /// Always use English.
  english('en'),

  /// Always use Simplified Chinese.
  simplifiedChinese('zh');

  const AppLanguage(this.storedValue);

  /// The value persisted in the local preferences file.
  final String storedValue;

  static AppLanguage fromStoredValue(Object? value) =>
      _byStoredValue(values, value, (entry) => entry.storedValue, system);

  /// The app locale, or null to defer to the platform.
  Locale? get locale => switch (this) {
    AppLanguage.system => null,
    AppLanguage.english => const Locale('en'),
    AppLanguage.simplifiedChinese => const Locale('zh'),
  };
}

/// The appearance this installation presents GitPulse in.
enum AppAppearance {
  /// Follow the operating system's light or dark setting.
  system('system'),

  /// Always use the light GitPulse theme.
  light('light'),

  /// Always use the dark GitPulse theme.
  dark('dark');

  const AppAppearance(this.storedValue);

  /// The value persisted in the local preferences file.
  final String storedValue;

  static AppAppearance fromStoredValue(Object? value) =>
      _byStoredValue(values, value, (entry) => entry.storedValue, system);

  ThemeMode get themeMode => switch (this) {
    AppAppearance.system => ThemeMode.system,
    AppAppearance.light => ThemeMode.light,
    AppAppearance.dark => ThemeMode.dark,
  };
}

/// How this installation shows Followed Repositories.
///
/// Compact shows repository identity. Detailed adds repository metadata.
enum FollowedRepositoryView {
  compact,
  detailed;

  static FollowedRepositoryView fromStoredValue(Object? value) =>
      _byStoredValue(values, value, (entry) => entry.name, compact);
}

/// This installation's own choices: the language and appearance it presents,
/// how it shows Followed Repositories, and how much release history it keeps.
///
/// These belong to the installation rather than to an account: they survive the
/// disposable Timeline Cache, sign-out, and account changes, and they apply
/// before the backend can be reached.
class DevicePreferences {
  const DevicePreferences({
    this.language = AppLanguage.system,
    this.appearance = AppAppearance.system,
    this.followedRepositoryView = FollowedRepositoryView.compact,
    this.retentionDays,
  });

  factory DevicePreferences.fromJson(Object? json) {
    if (json is! Map) return const DevicePreferences();
    return DevicePreferences(
      language: AppLanguage.fromStoredValue(json['language']),
      appearance: AppAppearance.fromStoredValue(json['appearance']),
      followedRepositoryView: FollowedRepositoryView.fromStoredValue(
        json['followedRepositoryView'],
      ),
      retentionDays: validRetentionDays(json['retentionDays']),
    );
  }

  /// The window an installation keeps when it has never chosen one.
  static const defaultRetentionDays = 30;

  /// The smallest and largest window a reader may choose.
  static const minimumRetentionDays = 1;
  static const maximumRetentionDays = 90;

  final AppLanguage language;
  final AppAppearance appearance;
  final FollowedRepositoryView followedRepositoryView;

  /// Whole days of release history this installation keeps, or null until it
  /// has chosen one.
  ///
  /// A null is not "keep nothing": an installation with no choice yet is seeded
  /// once from the window its Timeline Cache last wrote, and otherwise keeps
  /// [defaultRetentionDays]. Nothing is pruned or saved until that value is
  /// known, because a guess would delete records the real window keeps.
  final int? retentionDays;

  /// The window in force on this installation right now.
  int get resolvedRetentionDays => retentionDays ?? defaultRetentionDays;

  Locale? get locale => language.locale;

  ThemeMode get themeMode => appearance.themeMode;

  DevicePreferences copyWith({
    AppLanguage? language,
    AppAppearance? appearance,
    FollowedRepositoryView? followedRepositoryView,
    int? retentionDays,
  }) => DevicePreferences(
    language: language ?? this.language,
    appearance: appearance ?? this.appearance,
    followedRepositoryView:
        followedRepositoryView ?? this.followedRepositoryView,
    retentionDays: retentionDays ?? this.retentionDays,
  );

  Map<String, Object?> toJson() => {
    'language': language.storedValue,
    'appearance': appearance.storedValue,
    'followedRepositoryView': followedRepositoryView.name,
    // An unchosen window has no value to write, so the next launch still sees
    // an installation that must be seeded.
    'retentionDays': ?retentionDays,
  };

  @override
  bool operator ==(Object other) =>
      other is DevicePreferences &&
      other.language == language &&
      other.appearance == appearance &&
      other.followedRepositoryView == followedRepositoryView &&
      other.retentionDays == retentionDays;

  @override
  int get hashCode =>
      Object.hash(language, appearance, followedRepositoryView, retentionDays);
}

/// A whole-day retention window, or null when [value] is not one.
int? validRetentionDays(Object? value) =>
    value is int &&
        value >= DevicePreferences.minimumRetentionDays &&
        value <= DevicePreferences.maximumRetentionDays
    ? value
    : null;

/// Reads a persisted enum value, falling back when a stored name is unknown.
T _byStoredValue<T extends Enum>(
  List<T> values,
  Object? stored,
  String Function(T) storedValue,
  T fallback,
) => values.firstWhere(
  (entry) => storedValue(entry) == stored,
  orElse: () => fallback,
);
