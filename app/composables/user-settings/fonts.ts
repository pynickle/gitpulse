import type { UserFontSettings } from '#shared/types/user-settings';

export interface BuiltinFontOption<T extends string> {
  id: T;
  label: string;
  family: string;
}

export const builtinAppFontOptions: BuiltinFontOption<UserFontSettings['appFont']>[] = [
  {
    id: 'harmonyos-sans',
    label: 'HarmonyOS Sans',
    family: 'HarmonyOS Sans',
  },
  {
    id: 'misans-latin',
    label: 'MiSans Latin',
    family: 'MiSans Latin',
  },
];

export const builtinCodeFontOptions: BuiltinFontOption<UserFontSettings['codeFont']>[] = [
  {
    id: 'maple-mono',
    label: 'Maple Mono',
    family: 'Maple Mono',
  },
  {
    id: 'jetbrains-mono',
    label: 'JetBrains Mono',
    family: 'JetBrains Mono',
  },
];

const APP_FALLBACK =
  '"Mona Sans VF", -apple-system, BlinkMacSystemFont, "Segoe UI", "Noto Sans", Helvetica, Arial, sans-serif, "Apple Color Emoji", "Segoe UI Emoji"';
const CODE_FALLBACK =
  '"Maple Mono", ui-monospace, SFMono-Regular, SF Mono, Menlo, Consolas, Liberation Mono, monospace';

const quoteFontFamily = (family: string) => {
  return `"${family.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
};

export function getAppFontStack(fonts: UserFontSettings) {
  if (fonts.appFont === 'system' && fonts.appSystemFont) {
    return `${quoteFontFamily(fonts.appSystemFont)}, ${APP_FALLBACK}`;
  }

  if (fonts.appFont === 'misans-latin') {
    return `${quoteFontFamily('MiSans Latin')}, ${APP_FALLBACK}`;
  }

  return `${quoteFontFamily('HarmonyOS Sans')}, ${APP_FALLBACK}`;
}

export function getCodeFontStack(fonts: UserFontSettings) {
  if (fonts.codeFont === 'system' && fonts.codeSystemFont) {
    return `${quoteFontFamily(fonts.codeSystemFont)}, ${CODE_FALLBACK}`;
  }

  if (fonts.codeFont === 'jetbrains-mono') {
    return `${quoteFontFamily('JetBrains Mono')}, ${CODE_FALLBACK}`;
  }

  return `${quoteFontFamily('Maple Mono')}, ${quoteFontFamily('Maple Mono NF CN')}, ${CODE_FALLBACK}`;
}
