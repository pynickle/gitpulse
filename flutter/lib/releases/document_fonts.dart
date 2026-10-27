import 'dart:io';

/// Finds fonts this platform can legally use for document SVG text.
///
/// Document images carry text (`release`, version numbers, counts), and resvg
/// can only draw what it was given. The set is resolved at runtime from the
/// operating system's own font directories, never bundled into the app and
/// never read from a build machine's path. A face the platform does not ship
/// simply falls back to whichever face it does, which the renderer handles.
///
/// Families are listed in the order documents most often ask for, so the
/// bytes loaded first are the ones a badge's `font-family` stack names.
const _preferredFamilies = [
  // Badge stacks name Verdana first; DejaVu Sans and Liberation Sans are the
  // freely distributable faces that match its metrics closely.
  'verdana',
  'dejavusans',
  'liberationsans',
  'arial',
  'roboto',
  'segoeui',
  'helvetica',
  'notosans',
  'tahoma',
  // A fallback that covers script text without a bundled font.
  'notosanscjk',
  'notosanssc',
  'notosansjp',
  'droidsansfallback',
  'msyh',
  'pingfang',
];

/// A font file the renderer may load.
class DocumentFont {
  const DocumentFont(this.path);

  final String path;

  /// The file name without its extension, lower-cased and stripped of style
  /// suffixes, used only to rank the file against [_preferredFamilies].
  String get familyKey {
    final name = path
        .split(RegExp(r'[/\\]'))
        .last
        .split('.')
        .first
        .toLowerCase();
    return name
        .replaceAll(
          RegExp(
            r'(bold|italic|oblique|regular|light|thin|medium|'
            r'semibold|black|variable|vf|condensed)',
          ),
          '',
        )
        .replaceAll(RegExp(r'[^a-z0-9]'), '');
  }
}

/// Directories that hold the operating system's fonts, per platform.
List<String> documentFontDirectories() {
  if (Platform.isAndroid) {
    // Android keeps its system faces here and loads them from the APK's own
    // system partition; nothing is read from a development machine.
    return const ['/system/fonts', '/system_ext/fonts', '/product/fonts'];
  }
  if (Platform.isWindows) {
    return [
      if (Platform.environment['WINDIR'] case final windir?)
        '$windir\\Fonts'
      else
        r'C:\Windows\Fonts',
      if (Platform.environment['LOCALAPPDATA'] case final localAppData?)
        '$localAppData\\Microsoft\\Windows\\Fonts',
    ];
  }
  if (Platform.isMacOS) {
    return const ['/System/Library/Fonts', '/Library/Fonts'];
  }
  return [
    '/usr/share/fonts',
    '/usr/local/share/fonts',
    if (Platform.environment['HOME'] case final home?)
      '$home/.local/share/fonts',
  ];
}

const _fontExtensions = {'.ttf', '.otf'};

/// The font files to hand the native renderer, most preferred first.
///
/// The list is bounded so a host with hundreds of faces pays a bounded cost:
/// the first [maxFaces] files whose family is named by [_preferredFamilies],
/// then the platform's first sans-serif faces if nothing matched.
List<DocumentFont> discoverDocumentFonts({int maxFaces = 12}) {
  final found = <String, String>{}; // family key -> path
  for (final directory in documentFontDirectories()) {
    final entities = Directory(directory)
        .listSync(recursive: true, followLinks: true);
    for (final entity in entities) {
      if (entity is! File) continue;
      final name = entity.path.toLowerCase();
      final extension = name.contains('.') ? '.${name.split('.').last}' : '';
      if (!_fontExtensions.contains(extension)) continue;
      final font = DocumentFont(entity.path);
      final rank = _preferredFamilies.indexWhere(
        (family) => font.familyKey.startsWith(family),
      );
      if (rank < 0) continue;
      found.putIfAbsent(font.familyKey, () => entity.path);
    }
  }
  final ranked = found.entries.toList()
    ..sort((left, right) {
      int rank(String key) =>
          _preferredFamilies.indexWhere((family) => key.startsWith(family));
      return rank(left.key).compareTo(rank(right.key));
    });
  return ranked
      .take(maxFaces)
      .map((entry) => DocumentFont(entry.value))
      .toList();
}
