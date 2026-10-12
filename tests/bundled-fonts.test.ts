import { describe, expect, mock, test } from 'bun:test';

import * as bundledFonts from '../shared/utils/bundled-fonts';
import { createDefaultUserSettings } from '../shared/utils/user-settings';

mock.module('#shared/utils/bundled-fonts', () => bundledFonts);

const { getAppFontStack, getCodeFontStack } =
  await import('../app/composables/user-settings/fonts');
const { bundledAppFonts, bundledCodeFonts, bundledFontFaces, bundledFontWeights } = bundledFonts;

const fonts = createDefaultUserSettings().fonts;

describe('bundled font stacks', () => {
  test('default stacks use the shipped faces and one shared fallback variable', () => {
    expect(getAppFontStack(fonts)).toBe('"HarmonyOS Sans", var(--gitpulse-app-font-fallback)');
    expect(getCodeFontStack(fonts)).toBe(
      '"Maple Mono", "Maple Mono NF CN", var(--gitpulse-code-font-fallback)'
    );
  });

  test('alternate and system faces keep the shipped code font as the next face', () => {
    expect(getAppFontStack({ ...fonts, appFont: 'misans-latin' })).toBe(
      '"MiSans Latin", var(--gitpulse-app-font-fallback)'
    );
    expect(getAppFontStack({ ...fonts, appFont: 'system', appSystemFont: 'Font "Quoted"' })).toBe(
      '"Font \\"Quoted\\"", var(--gitpulse-app-font-fallback)'
    );
    expect(getCodeFontStack({ ...fonts, codeFont: 'jetbrains-mono' })).toBe(
      '"JetBrains Mono", "Maple Mono", var(--gitpulse-code-font-fallback)'
    );
    expect(
      getCodeFontStack({ ...fonts, codeFont: 'system', codeSystemFont: 'Cascadia Mono' })
    ).toBe('"Cascadia Mono", "Maple Mono", var(--gitpulse-code-font-fallback)');
  });
});

describe('bundled font faces', () => {
  test('each shipped family has one normal face for every configured weight', () => {
    const families = [
      ...bundledAppFonts.map((font) => font.family),
      ...bundledCodeFonts.map((font) => font.family),
    ];

    for (const family of families) {
      const weights = bundledFontFaces
        .filter((face) => face.name === family)
        .map((face) => face.weight);

      expect(weights).toEqual(bundledFontWeights.map(String));
    }
  });

  test('HarmonyOS Sans weight 600 reuses the Medium file', () => {
    const faces = bundledFontFaces.filter((face) => face.name === 'HarmonyOS Sans');
    const medium = faces.find((face) => face.weight === '500');
    const semibold = faces.find((face) => face.weight === '600');

    expect(semibold?.src).toBe(medium?.src);
  });
});
