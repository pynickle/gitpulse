import paletteData from '../data/theme-palette.json';

/**
 * The semantic palette of the `gitpulse` Theme Preset, light and dark both.
 *
 * The values live once, as data, in `shared/data/theme-palette.json`: the web app presents them
 * as CSS custom properties at startup, and the Flutter client reads the same file through the
 * generated `flutter/lib/presentation/gitpulse_palette.g.dart`. A tone changed here changes both
 * clients, which is the whole point of the file.
 *
 * The tone names are the design's own and neither client renames them. A presentation carries the
 * semantic ramp the Content Layer sits on — from `page-bg`, the canvas a page stands on, through
 * the shell and the surface steps — the Accent, and the two status families: `success` and `danger`
 * are the tones read as text, their `-solid` variants are the fills a status chip paints, and
 * `danger-soft` is the wash a failure is reported on. A wash a client paints is data for that
 * reason: a strength each client derived for itself is a wash that drifts between them.
 *
 * What stays in the stylesheet is what only the web app has a surface for — the `-hover` step of a
 * link or a solid fill, and the tones a web-only component names. Nothing there is a value the
 * other client would have to agree with.
 */
export const themePalettePresentations = ['light', 'dark'] as const;

export type ThemePalettePresentation = (typeof themePalettePresentations)[number];

/** Every tone name the shared data declares, in the order it declares them. */
export type ThemePaletteTone = keyof typeof paletteData.light;

/** One tone value per presentation, in the CSS colour notation the web app renders. */
export type ThemePaletteToneValues = Record<ThemePaletteTone, string>;

/** The palette in both presentations. */
export type ThemePalette = Record<ThemePalettePresentation, ThemePaletteToneValues>;

/** The tone names, in the order the shared data declares them. */
export const themePaletteTones = Object.keys(paletteData.light) as ThemePaletteTone[];

/** The shared palette. */
export const themePalette: ThemePalette = paletteData;

/** The CSS custom property that carries [tone]. */
export function themePaletteCustomProperty(tone: ThemePaletteTone): string {
  return `--gitpulse-${tone}`;
}

/** The custom properties one presentation declares, ready to sit inside a rule block. */
function paletteDeclarations(presentation: ThemePalettePresentation): string {
  return themePaletteTones
    .map((tone) => `${themePaletteCustomProperty(tone)}:${themePalette[presentation][tone]};`)
    .join('');
}

/**
 * The injected stylesheet: the light presentation under `:root` and the dark one under
 * `html.dark`, the two selectors the stylesheet has always scoped these tones to.
 *
 * Both presentations are declared up front rather than swapped when the reader changes appearance,
 * so the server-rendered page paints the palette it was rendered for and no reload or flash sits
 * between the two.
 */
export const themePaletteStyleSheet = `:root{${paletteDeclarations('light')}}html.dark{${paletteDeclarations('dark')}}`;
