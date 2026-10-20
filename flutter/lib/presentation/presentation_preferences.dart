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

/// The language and appearance this installation remembers.
///
/// These are device-local presentation choices: they survive the disposable
/// Timeline Cache, sign-out, and account changes, and they apply before the
/// backend can be reached.
class PresentationPreferences {
  const PresentationPreferences({
    this.language = AppLanguage.system,
    this.appearance = AppAppearance.system,
  });

  factory PresentationPreferences.fromJson(Object? json) {
    if (json is! Map) return const PresentationPreferences();
    return PresentationPreferences(
      language: AppLanguage.fromStoredValue(json['language']),
      appearance: AppAppearance.fromStoredValue(json['appearance']),
    );
  }

  final AppLanguage language;
  final AppAppearance appearance;

  Locale? get locale => language.locale;

  ThemeMode get themeMode => appearance.themeMode;

  PresentationPreferences copyWith({
    AppLanguage? language,
    AppAppearance? appearance,
  }) => PresentationPreferences(
    language: language ?? this.language,
    appearance: appearance ?? this.appearance,
  );

  Map<String, Object?> toJson() => {
    'language': language.storedValue,
    'appearance': appearance.storedValue,
  };

  @override
  bool operator ==(Object other) =>
      other is PresentationPreferences &&
      other.language == language &&
      other.appearance == appearance;

  @override
  int get hashCode => Object.hash(language, appearance);
}

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
