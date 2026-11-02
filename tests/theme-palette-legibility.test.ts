import { describe, expect, test } from 'bun:test';

import paletteData from '../shared/data/theme-palette.json';

/**
 * The tones a client renders text in, weakest last. A reader has to be able to tell them apart
 * from the surface behind them, so every one of them is held to the same floor.
 */
const textTones = ['text', 'text-strong', 'text-muted', 'text-subtle'] as const;

/**
 * The tones a client paints behind text, read off the data rather than listed here, so a surface
 * tone added later is covered without anyone remembering to add it.
 */
const isSurfaceTone = (tone: string) =>
  tone === 'page-bg' || tone === 'shell-bg' || tone.startsWith('surface');

/** WCAG 2.2 SC 1.4.3, the minimum for body text. */
const MINIMUM_CONTRAST = 4.5;

/** The sRGB channels of `#rrggbb`, each in 0..1. */
function channels(hex: string): [number, number, number] {
  const match = /^#([0-9a-f]{6})$/i.exec(hex);
  if (!match) throw new Error(`Not an opaque hex colour: ${hex}`);
  const value = match[1]!;
  return [0, 2, 4].map((offset) => parseInt(value.slice(offset, offset + 2), 16) / 255) as [
    number,
    number,
    number,
  ];
}

/** WCAG relative luminance of `hex`. */
function relativeLuminance(hex: string): number {
  const [r, g, b] = channels(hex).map((channel) =>
    channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4
  ) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG contrast ratio of `foreground` against `background`, from 1 to 21. */
function contrastRatio(foreground: string, background: string): number {
  const values = [relativeLuminance(foreground), relativeLuminance(background)].sort(
    (left, right) => right - left
  );
  return (values[0]! + 0.05) / (values[1]! + 0.05);
}

describe('light presentation legibility', () => {
  const light = paletteData.light as Record<string, string>;
  const surfaceTones = Object.keys(light).filter(isSurfaceTone);

  test('the palette declares the surfaces the floor is measured on', () => {
    expect(surfaceTones).toContain('surface');
    expect(surfaceTones.length).toBeGreaterThan(3);
  });

  for (const textTone of textTones) {
    test(`"${textTone}" reads at AA on every light surface`, () => {
      const unreadable = surfaceTones
        .map((surfaceTone) => ({
          surfaceTone,
          ratio: Math.round(contrastRatio(light[textTone]!, light[surfaceTone]!) * 100) / 100,
        }))
        .filter(({ ratio }) => ratio < MINIMUM_CONTRAST);

      expect(unreadable).toEqual([]);
    });
  }
});
