import type { UserFontSettings } from '#shared/types/user-settings';
import {
  APP_FONT_FALLBACK_STACK,
  bundledAppFonts,
  bundledCodeFonts,
  CODE_FONT_FALLBACK_STACK,
  SHIPPED_CODE_FONT_FAMILY,
} from '#shared/utils/bundled-fonts';

export interface BuiltinFontOption<T extends string> {
  id: T;
  label: string;
  family: string;
}

export const builtinAppFontOptions = bundledAppFonts.map((font) => ({
  id: font.id,
  label: font.label,
  family: font.family,
})) satisfies BuiltinFontOption<UserFontSettings['appFont']>[];

export const builtinCodeFontOptions = bundledCodeFonts.map((font) => ({
  id: font.id,
  label: font.label,
  family: font.family,
})) satisfies BuiltinFontOption<UserFontSettings['codeFont']>[];

const quoteFontFamily = (family: string) => {
  return `"${family.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
};

const fontStack = (families: readonly string[], fallback: string) => {
  return [...families.map(quoteFontFamily), fallback].join(', ');
};

export function getAppFontStack(fonts: UserFontSettings) {
  if (fonts.appFont === 'system' && fonts.appSystemFont) {
    return fontStack([fonts.appSystemFont], APP_FONT_FALLBACK_STACK);
  }

  const bundled = bundledAppFonts.find((font) => font.id === fonts.appFont);

  return fontStack([bundled?.family ?? bundledAppFonts[0].family], APP_FONT_FALLBACK_STACK);
}

export function getCodeFontStack(fonts: UserFontSettings) {
  if (fonts.codeFont === 'system' && fonts.codeSystemFont) {
    return fontStack([fonts.codeSystemFont, SHIPPED_CODE_FONT_FAMILY], CODE_FONT_FALLBACK_STACK);
  }

  const bundled = bundledCodeFonts.find((font) => font.id === fonts.codeFont);

  return fontStack(bundled?.stack ?? bundledCodeFonts[0].stack, CODE_FONT_FALLBACK_STACK);
}
