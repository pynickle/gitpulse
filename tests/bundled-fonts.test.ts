import { describe, expect, mock, test } from 'bun:test';

import { APP_FONT_IDS, CODE_FONT_IDS } from '../shared/types/user-settings';
import * as bundledFonts from '../shared/utils/bundled-fonts';
import {
  createDefaultUserSettings,
  normalizeUserFontSettings,
} from '../shared/utils/user-settings';

mock.module('#shared/utils/bundled-fonts', () => bundledFonts);

const { builtinAppFontOptions, builtinCodeFontOptions, getAppFontStack, getCodeFontStack } =
  await import('../app/composables/user-settings/fonts');
const {
  bundledAppFonts,
  bundledCodeFonts,
  bundledFontFaces,
  bundledFontWeights,
  APP_FONT_FALLBACK_STACK,
  CODE_FONT_FALLBACK_STACK,
} = bundledFonts;

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
    expect(getAppFontStack({ ...fonts, appFont: 'geist-sans' })).toBe(
      '"Geist Sans", var(--gitpulse-app-font-fallback)'
    );
    expect(getAppFontStack({ ...fonts, appFont: 'system', appSystemFont: 'Font "Quoted"' })).toBe(
      '"Font \\"Quoted\\"", var(--gitpulse-app-font-fallback)'
    );
    expect(getCodeFontStack({ ...fonts, codeFont: 'jetbrains-mono' })).toBe(
      '"JetBrains Mono", "Maple Mono", var(--gitpulse-code-font-fallback)'
    );
    expect(getCodeFontStack({ ...fonts, codeFont: 'geist-mono' })).toBe(
      '"Geist Mono", "Maple Mono", var(--gitpulse-code-font-fallback)'
    );
    expect(
      getCodeFontStack({ ...fonts, codeFont: 'system', codeSystemFont: 'Cascadia Mono' })
    ).toBe('"Cascadia Mono", "Maple Mono", var(--gitpulse-code-font-fallback)');
  });
});

describe('selectable app fonts', () => {
  const selectableIds = builtinAppFontOptions.map((option) => option.id);

  test('the picker offers the bundled app fonts in order with the system face last', () => {
    expect(fonts.appFont).toBe('harmonyos-sans');
    expect(selectableIds).toEqual(['harmonyos-sans', 'misans-latin', 'geist-sans']);
    expect(APP_FONT_IDS).toEqual([...selectableIds, 'system']);
  });

  test('every selectable id leads its own stack instead of falling back to the default face', () => {
    for (const id of selectableIds) {
      const bundled = bundledAppFonts.find((font) => font.id === id);
      const stack = getAppFontStack({ ...fonts, appFont: id });

      expect(bundled?.family).toBeTruthy();
      expect(stack.split(', ')[0]).toBe(`"${bundled?.family}"`);
      expect(stack.endsWith(APP_FONT_FALLBACK_STACK)).toBe(true);
      expect(stack.includes('HarmonyOS Sans')).toBe(id === 'harmonyos-sans');
    }
  });

  test('a stored Geist Sans choice stays Geist Sans', () => {
    expect(normalizeUserFontSettings({ appFont: 'geist-sans' }).appFont).toBe('geist-sans');
  });
});

describe('selectable code fonts', () => {
  const selectableIds = builtinCodeFontOptions.map((option) => option.id);

  test('the picker offers the bundled code fonts in order with the system face last', () => {
    expect(selectableIds).toEqual(['maple-mono', 'jetbrains-mono', 'geist-mono']);
    expect(CODE_FONT_IDS).toEqual([...selectableIds, 'system']);
  });

  test('every selectable id leads its own stack instead of falling back to the default face', () => {
    for (const id of selectableIds) {
      const bundled = bundledCodeFonts.find((font) => font.id === id);
      const stack = getCodeFontStack({ ...fonts, codeFont: id });

      expect(bundled?.family).toBeTruthy();
      expect(stack.split(', ')[0]).toBe(`"${bundled?.family}"`);
      expect(stack.endsWith(CODE_FONT_FALLBACK_STACK)).toBe(true);
    }
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

  test('Geist Sans uses the fontsource latin files for every configured weight', () => {
    const faces = bundledFontFaces.filter((face) => face.name === 'Geist Sans');

    expect(faces.map((face) => face.src)).toEqual(
      bundledFontWeights.map(
        (weight) =>
          `https://cdn.jsdelivr.net/npm/@fontsource/geist-sans@5.3.0/files/geist-sans-latin-${weight}-normal.woff2`
      )
    );
  });

  test('HarmonyOS Sans weight 600 reuses the Medium file', () => {
    const faces = bundledFontFaces.filter((face) => face.name === 'HarmonyOS Sans');
    const medium = faces.find((face) => face.weight === '500');
    const semibold = faces.find((face) => face.weight === '600');

    expect(semibold?.src).toBe(medium?.src);
  });
});
