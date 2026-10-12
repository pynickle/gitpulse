const HARMONY_OS_SANS = 'HarmonyOS Sans';
const MISANS_LATIN = 'MiSans Latin';
const MAPLE_MONO = 'Maple Mono';
/** Installed locally by some users. Not part of the files we ship. */
const MAPLE_MONO_NF_CN = 'Maple Mono NF CN';
const JETBRAINS_MONO = 'JetBrains Mono';

/** Shipped monospace used when the selected code face does not load. */
export const SHIPPED_CODE_FONT_FAMILY = MAPLE_MONO;

export const APP_FONT_FALLBACK_STACK = 'var(--gitpulse-app-font-fallback)';
export const CODE_FONT_FALLBACK_STACK = 'var(--gitpulse-code-font-fallback)';

export const bundledFontWeights = [400, 500, 600, 700, 800] as const;

type BundledFontWeight = (typeof bundledFontWeights)[number];

export type BundledFontFace = {
  name: string;
  src: string;
  weight: string;
  style: 'normal';
  preload: false;
  global: true;
  /** Skip metric-override families. The live stack is chosen at runtime. */
  fallbacks: [];
};

export const bundledAppFonts = [
  { id: 'harmonyos-sans', label: HARMONY_OS_SANS, family: HARMONY_OS_SANS },
  { id: 'misans-latin', label: MISANS_LATIN, family: MISANS_LATIN },
] as const;

export const bundledCodeFonts = [
  {
    id: 'maple-mono',
    label: MAPLE_MONO,
    family: MAPLE_MONO,
    stack: [MAPLE_MONO, MAPLE_MONO_NF_CN],
  },
  {
    id: 'jetbrains-mono',
    label: JETBRAINS_MONO,
    family: JETBRAINS_MONO,
    stack: [JETBRAINS_MONO, MAPLE_MONO],
  },
] as const;

const HARMONY_SANS_PACKAGE = '@lobehub/webfont-harmony-sans@1.0.0';
const MISANS_PACKAGE = 'misans@4.1.0';
const MAPLE_MONO_PACKAGE = '@fontsource/maple-mono@5.2.6';
const JETBRAINS_MONO_PACKAGE = '@fontsource/jetbrains-mono@5.2.8';

const jsDelivr = (specifier: string) => `https://cdn.jsdelivr.net/npm/${specifier}`;

const face = (name: string, src: string, weight: BundledFontWeight): BundledFontFace => ({
  name,
  src,
  weight: String(weight),
  style: 'normal',
  preload: false,
  global: true,
  fallbacks: [],
});

const facesFor = (name: string, files: Record<BundledFontWeight, string>) => {
  return bundledFontWeights.map((weight) => face(name, files[weight], weight));
};

const fontsourceLatin = (packageName: string, slug: string) => {
  const files = {} as Record<BundledFontWeight, string>;

  for (const weight of bundledFontWeights) {
    files[weight] = jsDelivr(`${packageName}/files/${slug}-latin-${weight}-normal.woff2`);
  }

  return files;
};

// HarmonyOS Sans has no Semibold file. Weight 600 reuses Medium.
const harmonySansFiles: Record<BundledFontWeight, string> = {
  400: jsDelivr(`${HARMONY_SANS_PACKAGE}/fonts/HarmonyOS_Sans_Regular.woff2`),
  500: jsDelivr(`${HARMONY_SANS_PACKAGE}/fonts/HarmonyOS_Sans_Medium.woff2`),
  600: jsDelivr(`${HARMONY_SANS_PACKAGE}/fonts/HarmonyOS_Sans_Medium.woff2`),
  700: jsDelivr(`${HARMONY_SANS_PACKAGE}/fonts/HarmonyOS_Sans_Bold.woff2`),
  800: jsDelivr(`${HARMONY_SANS_PACKAGE}/fonts/HarmonyOS_Sans_Black.woff2`),
};

const misansLatinFiles: Record<BundledFontWeight, string> = {
  400: jsDelivr(`${MISANS_PACKAGE}/lib/Latin/MiSansLatin-Regular.woff2`),
  500: jsDelivr(`${MISANS_PACKAGE}/lib/Latin/MiSansLatin-Medium.woff2`),
  600: jsDelivr(`${MISANS_PACKAGE}/lib/Latin/MiSansLatin-Semibold.woff2`),
  700: jsDelivr(`${MISANS_PACKAGE}/lib/Latin/MiSansLatin-Bold.woff2`),
  800: jsDelivr(`${MISANS_PACKAGE}/lib/Latin/MiSansLatin-Heavy.woff2`),
};

export const bundledFontFaces: BundledFontFace[] = [
  ...facesFor(HARMONY_OS_SANS, harmonySansFiles),
  ...facesFor(MISANS_LATIN, misansLatinFiles),
  ...facesFor(MAPLE_MONO, fontsourceLatin(MAPLE_MONO_PACKAGE, 'maple-mono')),
  ...facesFor(JETBRAINS_MONO, fontsourceLatin(JETBRAINS_MONO_PACKAGE, 'jetbrains-mono')),
];
