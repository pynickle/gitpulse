// GENERATED FILE: do not edit by hand.
//
// The `gitpulse` Theme Preset palette, generated from `../shared/data/theme-palette.json` by
// `dart run tool/generate_theme_palette.dart`. The web app injects the same data as
// CSS custom properties at startup, so the two clients cannot disagree about a tone.

import 'dart:ui' show Color;

/// One presentation of the `gitpulse` Theme Preset palette.
class GitPulsePaletteTones {
  const GitPulsePaletteTones({
    required this.shellBg,
    required this.surface,
    required this.surfaceMuted,
    required this.surfaceRaised,
    required this.surfaceHover,
    required this.surfaceActive,
    required this.border,
    required this.borderStrong,
    required this.text,
    required this.textStrong,
    required this.textMuted,
    required this.textSubtle,
    required this.accent,
    required this.accentSoft,
    required this.success,
    required this.successSolid,
    required this.danger,
    required this.dangerSolid,
  });

  final Color shellBg;
  final Color surface;
  final Color surfaceMuted;
  final Color surfaceRaised;
  final Color surfaceHover;
  final Color surfaceActive;
  final Color border;
  final Color borderStrong;
  final Color text;
  final Color textStrong;
  final Color textMuted;
  final Color textSubtle;
  final Color accent;
  final Color accentSoft;
  final Color success;
  final Color successSolid;
  final Color danger;
  final Color dangerSolid;

  /// Every tone by the name the shared data gives it.
  Map<String, Color> toToneMap() => <String, Color>{
    'shell-bg': shellBg,
    'surface': surface,
    'surface-muted': surfaceMuted,
    'surface-raised': surfaceRaised,
    'surface-hover': surfaceHover,
    'surface-active': surfaceActive,
    'border': border,
    'border-strong': borderStrong,
    'text': text,
    'text-strong': textStrong,
    'text-muted': textMuted,
    'text-subtle': textSubtle,
    'accent': accent,
    'accent-soft': accentSoft,
    'success': success,
    'success-solid': successSolid,
    'danger': danger,
    'danger-solid': dangerSolid,
  };
}

/// The `gitpulse` Theme Preset palette in both presentations.
abstract final class GitPulsePalette {
  /// The light presentation.
  static const light = GitPulsePaletteTones(
    shellBg: Color(0xFFF1F5F9),
    surface: Color(0xFFFFFFFF),
    surfaceMuted: Color(0xFFF8FAFC),
    surfaceRaised: Color(0xFFFFFFFF),
    surfaceHover: Color(0xFFFBFDFF),
    surfaceActive: Color(0xFFEEF2FF),
    border: Color.fromRGBO(15, 23, 42, 0.1),
    borderStrong: Color.fromRGBO(15, 23, 42, 0.16),
    text: Color(0xFF334155),
    textStrong: Color(0xFF0F172A),
    textMuted: Color(0xFF64748B),
    textSubtle: Color(0xFF94A3B8),
    accent: Color(0xFF4F46E5),
    accentSoft: Color.fromRGBO(79, 70, 229, 0.1),
    success: Color(0xFF1A7F37),
    successSolid: Color(0xFF1A7F37),
    danger: Color(0xFFCF222E),
    dangerSolid: Color(0xFFCF222E),
  );

  /// The dark presentation.
  static const dark = GitPulsePaletteTones(
    shellBg: Color(0xFF171A21),
    surface: Color(0xFF1B1F27),
    surfaceMuted: Color(0xFF20252F),
    surfaceRaised: Color(0xFF222832),
    surfaceHover: Color(0xFF252C37),
    surfaceActive: Color.fromRGBO(129, 140, 248, 0.16),
    border: Color.fromRGBO(230, 237, 243, 0.12),
    borderStrong: Color.fromRGBO(230, 237, 243, 0.2),
    text: Color(0xFFCBD5E1),
    textStrong: Color(0xFFF1F5F9),
    textMuted: Color(0xFF9AA4B2),
    textSubtle: Color(0xFF7F8A9A),
    accent: Color(0xFFA5B4FC),
    accentSoft: Color.fromRGBO(165, 180, 252, 0.16),
    success: Color(0xFF7EE787),
    successSolid: Color(0xFF238636),
    danger: Color(0xFFFF7B72),
    dangerSolid: Color(0xFFDA3633),
  );
}
