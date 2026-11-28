import { afterAll, describe, expect, test } from 'bun:test';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

import { parse as parseSfc } from '@vue/compiler-sfc';
import postcss from 'postcss';
import type { AtRule, Declaration, Node, Root, Rule } from 'postcss';
import { initCompiler } from 'sass-embedded';
import type { FileImporter } from 'sass-embedded';

import { installBulmaLayerClean } from '../modules/bulma-layer-clean/install';
import { stripBulmaLayerImportant } from '../modules/bulma-layer-clean/plugin';
import { hoverGate, HOVER_QUERY } from '../modules/hover-gate/plugin';

const REPO_ROOT = resolve(import.meta.dir, '..');
const APP_DIR = resolve(REPO_ROOT, 'app');
const SCSS_DIR = resolve(APP_DIR, 'assets/scss');
const NODE_MODULES_DIR = resolve(REPO_ROOT, 'node_modules');

const compiler = initCompiler();
afterAll(() => {
  compiler.dispose();
});

const nuxtAliasImporter: FileImporter<'sync'> = {
  findFileUrl(url) {
    if (!url.startsWith('~/')) {
      return null;
    }
    return pathToFileURL(resolve(APP_DIR, url.slice(2)));
  },
};

const SASS_OPTIONS = {
  importers: [nuxtAliasImporter],
  loadPaths: [NODE_MODULES_DIR],
  quietDeps: true,
  silenceDeprecations: ['if-function', 'global-builtin', 'import'] as const,
};

const compiledFileCache = new Map<string, string>();

function compileScssFile(filename: string) {
  const cached = compiledFileCache.get(filename);
  if (cached !== undefined) {
    return cached;
  }
  const css = compiler.compile(resolve(SCSS_DIR, filename), {
    ...SASS_OPTIONS,
    silenceDeprecations: [...SASS_OPTIONS.silenceDeprecations],
  }).css;
  compiledFileCache.set(filename, css);
  return css;
}

function compileScssAtPath(relativeToApp: string) {
  return compiler.compile(resolve(APP_DIR, relativeToApp), {
    importers: [nuxtAliasImporter],
  }).css;
}

function compileSfcStyles(relativeToApp: string): Root {
  const absolutePath = resolve(APP_DIR, relativeToApp);
  const { descriptor } = parseSfc(readFileSync(absolutePath, 'utf8'), { filename: absolutePath });
  const chunks: string[] = [];

  for (const style of descriptor.styles) {
    if (style.src) {
      const targetPath = style.src.startsWith('~/')
        ? resolve(APP_DIR, style.src.slice(2))
        : resolve(dirname(absolutePath), style.src);
      chunks.push(compiler.compile(targetPath, { importers: [nuxtAliasImporter] }).css);
      continue;
    }
    chunks.push(
      compiler.compileString(style.content, {
        url: pathToFileURL(absolutePath),
        importers: [nuxtAliasImporter],
      }).css
    );
  }

  return postcss.parse(chunks.join('\n'));
}

function collectSelectors(root: Root): string[] {
  const selectors: string[] = [];
  root.walkRules((rule: Rule) => {
    selectors.push(rule.selector);
  });
  return selectors;
}

function compileScssSnippet(source: string) {
  return compiler.compileString(source, {
    ...SASS_OPTIONS,
    silenceDeprecations: [...SASS_OPTIONS.silenceDeprecations],
  }).css;
}

let processedMainCssPromise: Promise<string> | undefined;

async function getProcessedMainRoot(): Promise<Root> {
  processedMainCssPromise ??= postcss([stripBulmaLayerImportant(), hoverGate()])
    .process(compileScssFile('main.scss'), { from: undefined })
    .then((result) => result.css);
  return postcss.parse(await processedMainCssPromise);
}

function compileVueSfcStyles(relativeAppPath: string): Root {
  const fullPath = resolve(REPO_ROOT, relativeAppPath);
  const { descriptor } = parseSfc(readFileSync(fullPath, 'utf8'), { filename: fullPath });
  const compiled = descriptor.styles.map((style) => compileScssSnippet(style.content)).join('\n');
  return postcss.parse(compiled);
}

function enclosingLayerNames(node: Node): string[] {
  const layers: string[] = [];
  let current = node.parent;
  while (current && current.type !== 'root') {
    if (current.type === 'atrule' && (current as AtRule).name === 'layer') {
      layers.unshift((current as AtRule).params.trim());
    }
    current = current.parent;
  }
  return layers;
}

function collectTopLevelDecls(root: Root, selector: string): Map<string, string> {
  const decls = new Map<string, string>();
  root.walkRules((rule: Rule) => {
    if (rule.parent === root && rule.selector === selector) {
      rule.walkDecls((decl: Declaration) => {
        decls.set(decl.prop, decl.value);
      });
    }
  });
  return decls;
}

function findUngatedHoverSelectors(root: Root): string[] {
  const ungated: string[] = [];
  root.walkRules((rule: Rule) => {
    if (!rule.selector.includes(':hover')) {
      return;
    }
    let parent = rule.parent;
    let isGated = false;
    while (parent) {
      if (
        parent.type === 'atrule' &&
        (parent as AtRule).name === 'media' &&
        String((parent as AtRule).params) === HOVER_QUERY
      ) {
        isGated = true;
        break;
      }
      parent = parent.parent;
    }
    if (!isGated) {
      ungated.push(rule.selector);
    }
  });
  return ungated;
}

describe('global SCSS architecture (#196)', () => {
  test('tokens.scss emits light and dark Foundation Layer tokens without Bulma bridge variables', () => {
    const root = postcss.parse(compileScssFile('tokens.scss'));
    const lightRoot = collectTopLevelDecls(root, ':root');
    const darkRoot = collectTopLevelDecls(root, 'html.dark');

    expect(lightRoot.get('color-scheme')).toBe('light');
    expect(lightRoot.get('--gitpulse-frame-height')).toBe('100vh');
    expect(lightRoot.get('--gitpulse-topbar-height')).toBe('3.25rem');
    expect(lightRoot.get('--gitpulse-primary-solid')).toBe('#4f46e5');
    expect(lightRoot.get('--gitpulse-primary-solid-hover')).toBe('#4338ca');
    expect(lightRoot.get('--gitpulse-link-soft')).toBe('rgba(79, 70, 229, 0.08)');
    expect(lightRoot.get('--gitpulse-app-font-family')).toContain('HarmonyOS Sans');
    expect(lightRoot.get('--gitpulse-code-font-family')).toContain('Maple Mono');

    expect(darkRoot.get('color-scheme')).toBe('dark');
    expect(darkRoot.get('--gitpulse-primary-solid')).toBe('#5048e5');
    expect(darkRoot.get('--gitpulse-link-soft')).toBe('rgba(165, 180, 252, 0.14)');
    expect(darkRoot.get('--gitpulse-scrollbar-thumb')).toBe('#4b5563');

    const bulmaProps: string[] = [];
    root.walkDecls((decl) => {
      if (decl.prop.startsWith('--bulma-')) {
        bulmaProps.push(decl.prop);
      }
    });
    expect(bulmaProps).toEqual([]);

    let hasSvhSupports = false;
    root.walkAtRules('supports', (atRule) => {
      if (atRule.params.includes('100svh')) {
        hasSvhSupports = true;
      }
    });
    expect(hasSvhSupports).toBe(true);
  });

  test('scrollbars.scss emits document and scrollport scrollbar rules with ADR 0049 hover gating', () => {
    const root = postcss.parse(compileScssFile('scrollbars.scss'));
    const selectors: string[] = [];
    root.walkRules((rule) => {
      selectors.push(rule.selector);
    });

    expect(selectors.some((s) => s.includes('html') && s.includes('body'))).toBe(true);
    expect(selectors.some((s) => s.includes('textarea'))).toBe(true);
    expect(selectors.some((s) => s.includes('.markdown-body pre'))).toBe(true);
    expect(selectors.some((s) => s.includes('.wiki-page__html table'))).toBe(true);
    expect(findUngatedHoverSelectors(root)).toEqual([]);
  });

  test('base.scss emits document base, ADR 0049 pointer rules, FAB, markdown, and spin utilities', () => {
    const root = postcss.parse(compileScssFile('base.scss'));

    const bodyDecls = collectTopLevelDecls(root, 'body');
    expect(bodyDecls.get('font-family')).toBe('var(--gitpulse-app-font-family)');
    expect(bodyDecls.get('background-color')).toBe('var(--gitpulse-page-bg)');

    const htmlDecls = collectTopLevelDecls(root, 'html');
    expect(htmlDecls.get('touch-action')).toBe('manipulation');

    const fabDecls = collectTopLevelDecls(root, '.gitpulse-floating-fab');
    expect(fabDecls.get('border-radius')).toBe('50%');

    const spinDecls = collectTopLevelDecls(root, '.spin-animation');
    expect(spinDecls.get('animation')).toBe('spin 1s linear infinite');

    let hasTapHighlight = false;
    let hasUserSelectNone = false;
    root.walkDecls((decl) => {
      if (decl.prop === '-webkit-tap-highlight-color' && decl.value === 'transparent') {
        hasTapHighlight = true;
      }
      if (decl.prop === 'user-select' && decl.value === 'none') {
        hasUserSelectNone = true;
      }
    });
    expect(hasTapHighlight).toBe(true);
    expect(hasUserSelectNone).toBe(true);
    expect(findUngatedHoverSelectors(root)).toEqual([]);
  });

  test('bulma-overrides.scss emits component overrides using Foundation Layer tokens without a Bulma token bridge', () => {
    const root = postcss.parse(compileScssFile('bulma-overrides.scss'));
    const lightRoot = collectTopLevelDecls(root, ':root');
    const darkRoot = collectTopLevelDecls(root, 'html.dark');

    expect(lightRoot.size).toBe(0);
    expect(darkRoot.size).toBe(0);

    const bulmaTokens: string[] = [];
    root.walkDecls((decl) => {
      if (decl.prop.startsWith('--bulma-') || decl.value.includes('--bulma-')) {
        bulmaTokens.push(`${decl.prop}: ${decl.value}`);
      }
    });
    expect(bulmaTokens).toEqual([]);

    expect(collectTopLevelDecls(root, '.has-text-primary').get('color')).toBe(
      'var(--gitpulse-accent)'
    );
    expect(collectTopLevelDecls(root, '.has-text-info').get('color')).toBe('var(--gitpulse-info)');
    expect(collectTopLevelDecls(root, '.has-text-warning').get('color')).toBe(
      'var(--gitpulse-warning)'
    );
    expect(findUngatedHoverSelectors(root)).toEqual([]);
  });

  test('main.scss composes all partials in cascade order with no duplicate output', async () => {
    const root = await getProcessedMainRoot();

    expect(findUngatedHoverSelectors(root)).toEqual([]);

    const keyframesNames: string[] = [];
    root.walkAtRules('keyframes', (atRule) => {
      keyframesNames.push(atRule.params);
    });
    expect(keyframesNames.filter((name) => name === 'spin')).toEqual(['spin']);
    expect(keyframesNames.filter((name) => name === 'spinAround')).toEqual(['spinAround']);

    let fabCount = 0;
    let lightPrimarySolidCount = 0;
    let darkPrimarySolidCount = 0;
    let baseLinkIndex = -1;
    let controlsBtnIndex = -1;
    let overrideIndex = -1;
    let ruleIndex = 0;

    root.walkRules((rule) => {
      if (rule.parent === root && rule.selector === '.gitpulse-floating-fab') {
        fabCount += 1;
      }
      if (rule.parent === root && rule.selector === ':root') {
        rule.walkDecls('--gitpulse-primary-solid', () => {
          lightPrimarySolidCount += 1;
        });
      }
      if (rule.parent === root && rule.selector === 'html.dark') {
        rule.walkDecls('--gitpulse-primary-solid', () => {
          darkPrimarySolidCount += 1;
        });
      }
      if (rule.parent === root && rule.selector === 'a' && baseLinkIndex === -1) {
        baseLinkIndex = ruleIndex;
      }
      if (rule.parent === root && rule.selector === '.gp-btn' && controlsBtnIndex === -1) {
        controlsBtnIndex = ruleIndex;
      }
      if (rule.parent === root && rule.selector === '.has-text-primary' && overrideIndex === -1) {
        overrideIndex = ruleIndex;
      }
      ruleIndex += 1;
    });

    expect(fabCount).toBe(1);
    expect(lightPrimarySolidCount).toBe(1);
    expect(darkPrimarySolidCount).toBe(1);
    expect(baseLinkIndex).toBeGreaterThanOrEqual(0);
    expect(controlsBtnIndex).toBeGreaterThan(baseLinkIndex);
    expect(overrideIndex).toBeGreaterThan(controlsBtnIndex);
  });

  test('leading underscore strictly separates zero-output partials from CSS-emitting sheets', () => {
    const entries = readdirSync(SCSS_DIR).filter((name) => name.endsWith('.scss'));
    expect(entries.length).toBeGreaterThan(0);

    for (const filename of entries) {
      const css = compileScssFile(filename).trim();
      if (filename.startsWith('_')) {
        expect(css, `${filename} is underscored and must emit zero CSS`).toBe('');
      } else {
        expect(
          css.length,
          `${filename} has no leading underscore and must emit CSS`
        ).toBeGreaterThan(0);
      }
    }
  });

  test('$brand-primary is removed from _variables.scss while $theme-transition remains available', () => {
    const transitionCss = compileScssSnippet(
      `@use '~/assets/scss/variables' as *; .probe { transition: $theme-transition; }`
    );
    expect(transitionCss).toContain('background-color 0.16s ease');

    expect(() =>
      compileScssSnippet(`@use '~/assets/scss/variables' as *; .probe { color: $brand-primary; }`)
    ).toThrow(/Undefined variable/);
  });

  test('shared feature stylesheets resolve brand colors through Foundation Layer custom properties', () => {
    const editorRoot = postcss.parse(compileScssFile('detail-metadata-editor.scss'));
    expect(collectTopLevelDecls(editorRoot, '.sidebar-card__icon').get('color')).toBe(
      'var(--gitpulse-accent)'
    );
    expect(collectTopLevelDecls(editorRoot, '.label-btn-save').get('background')).toBe(
      'var(--gitpulse-primary-solid)'
    );

    const peoplePickerRoot = postcss.parse(
      compileScssAtPath('components/dashboard/detail/people-picker-modal.scss')
    );
    expect(
      collectTopLevelDecls(peoplePickerRoot, '.reviewer-modal-btn--submit').get('background')
    ).toBe('var(--gitpulse-primary-solid)');

    for (const root of [editorRoot, peoplePickerRoot]) {
      const hardcodedBrandDecls: string[] = [];
      root.walkDecls((decl) => {
        if (decl.value.toLowerCase().includes('#4f46e5')) {
          hardcodedBrandDecls.push(`${decl.prop}: ${decl.value}`);
        }
      });
      expect(hardcodedBrandDecls).toEqual([]);
    }
  });
});

describe('feature stylesheet ownership and modal shell extraction (#197)', () => {
  test('dashboard-list-card.scss replaces card.scss and compiles for all dashboard list card consumers', () => {
    expect(existsSync(resolve(SCSS_DIR, 'card.scss'))).toBe(false);
    expect(existsSync(resolve(SCSS_DIR, 'dashboard-list-card.scss'))).toBe(true);

    const cardRoot = postcss.parse(compileScssFile('dashboard-list-card.scss'));
    expect(collectTopLevelDecls(cardRoot, '.dashboard-list-card').get('position')).toBe('relative');
    expect(findUngatedHoverSelectors(cardRoot)).toEqual([]);

    const consumers = [
      'components/dashboard/RepoItem.vue',
      'components/dashboard/DashboardLoadingList.vue',
      'components/dashboard/GenericSearchItem.vue',
      'components/dashboard/IssuePrNotificationItem.vue',
      'components/dashboard/NotificationItem.vue',
    ];
    for (const component of consumers) {
      const selectors = collectSelectors(compileSfcStyles(component));
      expect(
        selectors.some((selector) => selector.includes('.dashboard-list-card')),
        `${component} should compile dashboard-list-card rules`
      ).toBe(true);
    }
  });

  test('notification-card.scss is co-located beside its two dashboard notification card components', () => {
    expect(existsSync(resolve(SCSS_DIR, 'notification-card.scss'))).toBe(false);
    expect(existsSync(resolve(APP_DIR, 'components/dashboard/notification-card.scss'))).toBe(true);

    const notificationRoot = postcss.parse(
      compileScssAtPath('components/dashboard/notification-card.scss')
    );
    expect(collectTopLevelDecls(notificationRoot, '.notification-type-badge').get('position')).toBe(
      'absolute'
    );
    expect(findUngatedHoverSelectors(notificationRoot)).toEqual([]);

    for (const component of [
      'components/dashboard/IssuePrNotificationItem.vue',
      'components/dashboard/NotificationItem.vue',
    ]) {
      const selectors = collectSelectors(compileSfcStyles(component));
      expect(selectors.some((selector) => selector.includes('.notification-type-badge'))).toBe(
        true
      );
      expect(selectors.some((selector) => selector.includes('.notification-card__todo-btn'))).toBe(
        true
      );
    }
  });

  test('people-picker-modal.scss is co-located beside DetailPeoplePickerModal and removed from DetailAssignees', () => {
    expect(existsSync(resolve(SCSS_DIR, 'reviewer-modal.scss'))).toBe(false);
    expect(
      existsSync(resolve(APP_DIR, 'components/dashboard/detail/people-picker-modal.scss'))
    ).toBe(true);

    const pickerRoot = postcss.parse(
      compileScssAtPath('components/dashboard/detail/people-picker-modal.scss')
    );
    expect(collectTopLevelDecls(pickerRoot, '.reviewer-modal-overlay').get('position')).toBe(
      'fixed'
    );
    expect(findUngatedHoverSelectors(pickerRoot)).toEqual([]);

    const pickerSfcSelectors = collectSelectors(
      compileSfcStyles('components/dashboard/detail/DetailPeoplePickerModal.vue')
    );
    expect(
      pickerSfcSelectors.some((selector) => selector.includes('.reviewer-modal-overlay'))
    ).toBe(true);
    expect(
      pickerSfcSelectors.some((selector) => selector.includes('.reviewer-modal-btn--submit'))
    ).toBe(true);

    const assigneesSfcSelectors = collectSelectors(
      compileSfcStyles('components/dashboard/detail/DetailAssignees.vue')
    );
    expect(
      assigneesSfcSelectors.filter((selector) => selector.includes('.reviewer-modal-'))
    ).toEqual([]);
  });

  test('modal-shell.scss owns generic modal chrome and transitions without metadata editor rules', () => {
    const shellRoot = postcss.parse(compileScssFile('modal-shell.scss'));
    const selectors = collectSelectors(shellRoot);

    expect(collectTopLevelDecls(shellRoot, '.label-editor-overlay').get('position')).toBe('fixed');
    expect(collectTopLevelDecls(shellRoot, '.label-editor-panel').get('display')).toBe('flex');
    expect(collectTopLevelDecls(shellRoot, '.label-editor-header').get('display')).toBe('flex');
    expect(collectTopLevelDecls(shellRoot, '.label-editor-footer').get('display')).toBe('flex');
    expect(collectTopLevelDecls(shellRoot, '.label-btn-save').get('background')).toBe(
      'var(--gitpulse-primary-solid)'
    );
    expect(selectors.some((selector) => selector.includes('.label-modal-enter-active'))).toBe(true);
    expect(selectors.some((selector) => selector.includes('.issue-option-row'))).toBe(true);

    expect(selectors.filter((selector) => selector.includes('.sidebar-card'))).toEqual([]);
    expect(selectors.filter((selector) => selector.includes('.label-tags'))).toEqual([]);
    expect(selectors.filter((selector) => selector.includes('.label-row'))).toEqual([]);
    expect(findUngatedHoverSelectors(shellRoot)).toEqual([]);
  });

  test('generic dialogs consume modal-shell.scss instead of detail-metadata-editor.scss', () => {
    const genericDialogs = [
      'components/dashboard/ConfirmModal.vue',
      'components/dashboard/issue/IssueCloseModal.vue',
      'components/dashboard/comments/CommentActions.vue',
    ];

    for (const dialog of genericDialogs) {
      const root = compileSfcStyles(dialog);
      const selectors = collectSelectors(root);

      expect(
        selectors.some((selector) => selector.includes('.label-editor-overlay')),
        `${dialog} should emit modal overlay styles`
      ).toBe(true);
      expect(
        selectors.some((selector) => selector.includes('.label-editor-panel')),
        `${dialog} should emit modal panel styles`
      ).toBe(true);
      expect(
        selectors.some((selector) => selector.includes('.label-editor-footer')),
        `${dialog} should emit modal footer styles`
      ).toBe(true);
      expect(
        selectors.some((selector) => selector.includes('.label-modal-enter-active')),
        `${dialog} should emit modal transition styles`
      ).toBe(true);
      expect(
        selectors.filter(
          (selector) =>
            selector.includes('.sidebar-card') ||
            selector.includes('.label-tags') ||
            selector.includes('.label-row')
        ),
        `${dialog} must not receive Metadata Editor Modal styles`
      ).toEqual([]);
      expect(findUngatedHoverSelectors(root)).toEqual([]);
    }
  });

  test('detail-metadata-editor.scss composes modal-shell and preserves labels and issue type editors', () => {
    const editorRoot = postcss.parse(compileScssFile('detail-metadata-editor.scss'));
    expect(findUngatedHoverSelectors(editorRoot)).toEqual([]);

    const labelsRoot = compileSfcStyles('components/dashboard/detail/DetailLabels.vue');
    const labelsSelectors = collectSelectors(labelsRoot);
    expect(labelsSelectors.some((selector) => selector.includes('.sidebar-card'))).toBe(true);
    expect(labelsSelectors.some((selector) => selector.includes('.label-tags'))).toBe(true);
    expect(labelsSelectors.some((selector) => selector.includes('.label-row'))).toBe(true);
    expect(labelsSelectors.some((selector) => selector.includes('.label-editor-overlay'))).toBe(
      true
    );
    expect(labelsSelectors.some((selector) => selector.includes('.label-modal-enter-active'))).toBe(
      true
    );
    expect(findUngatedHoverSelectors(labelsRoot)).toEqual([]);

    const issueTypeRoot = compileSfcStyles('components/dashboard/issue/IssueTypeCard.vue');
    const issueTypeSelectors = collectSelectors(issueTypeRoot);
    expect(issueTypeSelectors.some((selector) => selector.includes('.sidebar-card'))).toBe(true);
    expect(issueTypeSelectors.some((selector) => selector.includes('.label-tags'))).toBe(true);
    expect(findUngatedHoverSelectors(issueTypeRoot)).toEqual([]);
  });
});

describe('layered Bulma stopgap, in-house reset, and non-important helpers (#198)', () => {
  test('main.scss declares @layer reset, bulma; first and keeps application rules unlayered', async () => {
    const root = await getProcessedMainRoot();

    const topLevelAtRules = root.nodes.filter(
      (node): node is AtRule => node.type === 'atrule' && node.name === 'layer'
    );
    expect(topLevelAtRules.length).toBeGreaterThanOrEqual(3);
    expect(topLevelAtRules[0]?.params.trim()).toBe('reset, bulma');
    expect(topLevelAtRules[0]?.nodes).toBeUndefined();

    // Application global rules must remain unlayered so they override @layer reset and @layer bulma.
    const unlayeredSelectors = new Set<string>();
    root.walkRules((rule) => {
      if (enclosingLayerNames(rule).length === 0) {
        unlayeredSelectors.add(rule.selector);
      }
    });

    expect(unlayeredSelectors.has('.gitpulse-floating-fab')).toBe(true);
    expect(unlayeredSelectors.has('.dashboard-shell')).toBe(true);
    expect(unlayeredSelectors.has('.gp-btn')).toBe(true);
    expect(unlayeredSelectors.has('.has-text-primary')).toBe(true);
    expect(unlayeredSelectors.has('body')).toBe(true);
  });

  test('zero !important declarations exist inside @layer bulma after the PostCSS pipeline', async () => {
    const root = await getProcessedMainRoot();

    const bulmaImportants: string[] = [];
    root.walkDecls((decl) => {
      if (!decl.important) {
        return;
      }
      if (enclosingLayerNames(decl)[0] === 'bulma') {
        const selector = decl.parent?.type === 'rule' ? (decl.parent as Rule).selector : '';
        bulmaImportants.push(`${selector} { ${decl.prop}: ${decl.value} !important }`);
      }
    });

    expect(bulmaImportants).toEqual([]);
  });

  test('installBulmaLayerClean registers the PostCSS plugin on Nuxt options', () => {
    const nuxt = { options: {} };
    installBulmaLayerClean(nuxt);

    const vite = nuxt.options as {
      vite: { css: { postcss: { plugins: { postcssPlugin?: string }[] } } };
    };
    expect(vite.vite.css.postcss.plugins.map((plugin) => plugin.postcssPlugin)).toEqual([
      'gitpulse-strip-bulma-layer-important',
    ]);
  });

  test('@layer reset emits minimal reset without stripping list-style from bare ul or ol', async () => {
    const root = await getProcessedMainRoot();

    let hasBorderBox = false;
    const bareListStrips: string[] = [];

    root.walkRules((rule) => {
      if (enclosingLayerNames(rule)[0] !== 'reset') {
        return;
      }
      rule.walkDecls((decl) => {
        if (decl.prop === 'box-sizing' && decl.value === 'border-box') {
          hasBorderBox = true;
        }
        if (decl.prop === 'list-style' && decl.value === 'none') {
          const selectors = rule.selector.split(',').map((s) => s.trim());
          for (const sel of selectors) {
            if (sel === 'ul' || sel === 'ol') {
              bareListStrips.push(sel);
            }
          }
        }
      });
    });

    expect(hasBorderBox).toBe(true);
    expect(bareListStrips).toEqual([]);
  });

  test('excluded unused Bulma modules emit zero rules in compiled CSS', async () => {
    const root = await getProcessedMainRoot();

    // Check module-defining root selectors (standalone selector arms) rather than
    // cross-references inside still-active modules such as `.navbar > .container`,
    // `.media .content:not(:last-child)`, or `.notification a:not(.dropdown-item)`.
    const excludedRootSelectors = [
      '.modal',
      '.modal-card',
      '.modal-card-head',
      '.dropdown',
      '.dropdown-content',
      '.dropdown-item',
      '.table',
      '.panel',
      '.section',
      '.container',
      '.content',
      '.content ul',
      '.content ol',
      '.footer',
      '.message',
      '.breadcrumb',
      '.progress',
      '.block',
      '.select select',
      '.file',
      '.menu',
      '.menu-list',
      '.is-skeleton',
      '.skeleton-block',
      '.fixed-grid',
    ];

    const emittedRootArms = new Set<string>();
    root.walkRules((rule) => {
      for (const arm of rule.selector.split(',')) {
        emittedRootArms.add(arm.replace(/\s+/g, ' ').trim());
      }
    });

    const unexpected = excludedRootSelectors.filter((sel) => emittedRootArms.has(sel));
    expect(unexpected).toEqual([]);
  });

  test('active Bulma modules and non-important helper compat rules are emitted inside @layer bulma', async () => {
    const root = await getProcessedMainRoot();

    const bulmaLayeredClasses = new Set<string>();
    root.walkRules((rule) => {
      if (enclosingLayerNames(rule)[0] !== 'bulma') {
        return;
      }
      for (const match of rule.selector.matchAll(/\.[a-z][a-z0-9-]*/g)) {
        bulmaLayeredClasses.add(match[0]);
      }
    });

    // Active non-!important compatibility helpers still consumed by #204 surfaces
    for (const helperClass of [
      '.mb-0',
      '.mb-4',
      '.mr-4',
      '.p-0',
      '.is-flex',
      '.is-align-items-center',
      '.is-justify-content-center',
      '.is-size-7',
      '.is-hidden',
      '.has-text-grey',
      '.has-text-primary',
    ]) {
      expect(bulmaLayeredClasses.has(helperClass), `expected ${helperClass} in @layer bulma`).toBe(
        true
      );
    }
  });

  test('bulma-overrides.scss removes dead module rules and uses zero !important declarations', () => {
    const root = postcss.parse(compileScssFile('bulma-overrides.scss'));

    const importantDecls: string[] = [];
    root.walkDecls((decl) => {
      if (decl.important) {
        const selector = decl.parent?.type === 'rule' ? (decl.parent as Rule).selector : '';
        importantDecls.push(`${selector} { ${decl.prop}: ${decl.value} !important }`);
      }
    });
    expect(importantDecls).toEqual([]);

    // Active semantic text overrides remain without !important
    expect(collectTopLevelDecls(root, '.has-text-primary').get('color')).toBe(
      'var(--gitpulse-accent)'
    );
    expect(collectTopLevelDecls(root, '.has-text-info').get('color')).toBe('var(--gitpulse-info)');
    expect(collectTopLevelDecls(root, '.has-text-warning').get('color')).toBe(
      'var(--gitpulse-warning)'
    );
  });

  test('audited UI list components explicitly opt into unstyled list markers', () => {
    const cases = [
      {
        file: 'app/components/dashboard/composer/MarkdownComposer.vue',
        selectorMatch: '.markdown-composer__tabs ul',
      },
      {
        file: 'app/components/dashboard/DashboardPagination.vue',
        selectorMatch: '.dashboard-pagination__list',
      },
      {
        file: 'app/pages/dashboard/package.vue',
        selectorMatch: '.package-page__version-list',
      },
    ];

    for (const { file, selectorMatch } of cases) {
      const root = compileVueSfcStyles(file);
      const decls = new Map<string, string>();
      root.walkRules((rule) => {
        if (rule.selector === selectorMatch) {
          rule.walkDecls((decl) => {
            decls.set(decl.prop, decl.value);
          });
        }
      });
      expect(decls.get('list-style'), `${file} ${selectorMatch} list-style`).toBe('none');
      expect(decls.get('margin'), `${file} ${selectorMatch} margin`).toBe('0');
      expect(decls.get('padding'), `${file} ${selectorMatch} padding`).toBe('0');
    }
  });

  test('dashboard.vue narrow scrollbar clearance works without !important and keeps pagination bottom-row margin clearance', () => {
    const root = compileVueSfcStyles('app/pages/dashboard.vue');

    const importantDecls: string[] = [];
    let hasNarrowRowMargin = false;
    let hasNarrowRowRightClearance = false;
    let hasPaginationLastChildReset = false;

    root.walkRules((rule) => {
      if (rule.selector.includes('.dashboard-list-row')) {
        rule.walkDecls((decl) => {
          if (decl.important) {
            importantDecls.push(`${rule.selector} { ${decl.prop}: ${decl.value} !important }`);
          }
          if (decl.prop === 'margin-block-end' && decl.value === '0.5rem') {
            hasNarrowRowMargin = true;
          }
          if (
            decl.prop === 'margin-right' &&
            decl.value === 'var(--gitpulse-scrollbar-track-size)'
          ) {
            hasNarrowRowRightClearance = true;
          }
        });
      }
      if (
        rule.selector.includes('.dashboard-pagination-footer') &&
        rule.selector.includes('.mb-4:last-child')
      ) {
        rule.walkDecls('margin-bottom', (decl) => {
          if (decl.value === '0') {
            hasPaginationLastChildReset = true;
          }
        });
      }
    });

    expect(importantDecls).toEqual([]);
    expect(hasNarrowRowMargin).toBe(true);
    expect(hasNarrowRowRightClearance).toBe(true);
    expect(hasPaginationLastChildReset).toBe(true);
  });
});

describe('Control Layer primitives and Bulma form/notice/delete/card retirement (#201)', () => {
  test('controls.scss compiles cleanly on Foundation Layer tokens with ADR 0049 pointer rules', () => {
    const root = postcss.parse(compileScssFile('controls.scss'));

    // Zero --bulma-* custom properties and zero !important declarations.
    const bulmaProps: string[] = [];
    const importantDecls: string[] = [];
    root.walkDecls((decl) => {
      if (decl.prop.startsWith('--bulma-') || decl.value.includes('--bulma-')) {
        bulmaProps.push(`${decl.prop}: ${decl.value}`);
      }
      if (decl.important) {
        importantDecls.push(`${decl.prop}: ${decl.value} !important`);
      }
    });
    expect(bulmaProps).toEqual([]);
    expect(importantDecls).toEqual([]);
    expect(findUngatedHoverSelectors(root)).toEqual([]);

    const selectors = collectSelectors(root);
    const hasSelector = (needle: string) => selectors.some((s) => s.includes(needle));

    // Core Control Layer primitives for #201, #202, #203
    for (const primitive of [
      '.gp-btn',
      '.gp-btn--primary',
      '.gp-btn--light',
      '.gp-btn--ghost',
      '.gp-btn--link',
      '.gp-btn--danger',
      '.gp-btn--danger-soft',
      '.gp-btn--outlined',
      '.gp-btn--small',
      '.gp-btn--large',
      '.gp-btn--block',
      '.gp-btn--loading',
      '.gp-btn-group',
      '.gp-field',
      '.gp-label',
      '.gp-control',
      '.gp-control--icon-left',
      '.gp-input',
      '.gp-textarea',
      '.gp-checkbox',
      '.gp-help',
      '.gp-notice',
      '.gp-notice--danger',
      '.gp-notice--warning',
      '.gp-dismiss',
      '.gp-tag',
      '.gp-tags',
      '.gp-tags--addons',
    ]) {
      expect(hasSelector(primitive), `expected ${primitive} in controls.scss`).toBe(true);
    }

    // ADR 0049: filled controls deepen on :active:not(:disabled, ...); non-filled controls paint nothing on :active.
    expect(
      selectors.some((s) => s.includes('.gp-btn--primary') && s.includes(':active:not(:disabled'))
    ).toBe(true);
    expect(
      selectors.some((s) => s.includes('.gp-btn--danger') && s.includes(':active:not(:disabled'))
    ).toBe(true);
    expect(selectors.filter((s) => s.includes('.gp-btn--light:active'))).toEqual([]);
    expect(selectors.filter((s) => s.includes('.gp-btn--ghost:active'))).toEqual([]);
    expect(selectors.filter((s) => s.includes('.gp-dismiss:active'))).toEqual([]);

    // ADR 0049: form fields keep bare :focus.
    expect(hasSelector('.gp-input:focus')).toBe(true);
    expect(hasSelector('.gp-textarea:focus')).toBe(true);
  });

  test('compiled global CSS emits zero rules for retired Bulma form, notification, delete, and card modules', async () => {
    const root = await getProcessedMainRoot();

    const retiredRootSelectors = [
      '.field',
      '.field-label',
      '.field-body',
      '.control',
      '.control.has-icons-left',
      '.input',
      '.textarea',
      '.checkbox',
      '.radio',
      '.label',
      '.help',
      '.notification',
      '.notification.is-danger.is-light',
      '.notification.is-warning.is-light',
      '.delete',
      '.card',
      '.card-header',
      '.card-header-title',
      '.card-content',
      '.card-footer',
    ];

    const emittedArms = new Set<string>();
    root.walkRules((rule) => {
      for (const arm of rule.selector.split(',')) {
        emittedArms.add(arm.replace(/\s+/g, ' ').trim());
      }
    });

    const unexpected = retiredRootSelectors.filter((sel) => emittedArms.has(sel));
    expect(unexpected).toEqual([]);
  });
});

describe('layout and single-file Bulma relics retirement (#200)', () => {
  test('compiled global CSS emits zero rules for retired Bulma layout and single-file component modules', async () => {
    const root = await getProcessedMainRoot();

    const retiredRootSelectors = [
      '.columns',
      '.column',
      '.navbar',
      '.navbar-brand',
      '.navbar-menu',
      '.navbar-item',
      '.hero',
      '.hero-body',
      '.tabs',
      '.tabs a',
      '.menu',
      '.menu-list',
      '.pagination',
      '.pagination-previous',
      '.pagination-next',
      '.pagination-link',
      '.pagination-ellipsis',
      '.pagination-list',
      '.media',
      '.media-left',
      '.media-content',
      '.level',
      '.level-item',
      '.loader',
      '.box',
    ];

    const emittedRootArms = new Set<string>();
    root.walkRules((rule) => {
      for (const arm of rule.selector.split(',')) {
        emittedRootArms.add(arm.replace(/\s+/g, ' ').trim());
      }
    });

    const unexpected = retiredRootSelectors.filter((sel) => emittedRootArms.has(sel));
    expect(unexpected).toEqual([]);
  });

  test('bulma-overrides.scss emits zero rules for retired hero, navbar, box, and tabs modules', () => {
    const root = postcss.parse(compileScssFile('bulma-overrides.scss'));
    const emittedArms = new Set<string>();
    root.walkRules((rule) => {
      for (const arm of rule.selector.split(',')) {
        emittedArms.add(arm.replace(/\s+/g, ' ').trim());
      }
    });

    for (const retired of ['.hero', '.hero-body', '.navbar', '.navbar .title', '.box', '.tabs a']) {
      expect(
        emittedArms.has(retired),
        `${retired} should be removed from bulma-overrides.scss`
      ).toBe(false);
    }
  });

  test('_detail-sidebar-columns.scss drives CSS Grid collapse and narrow stacking via .detail-columns without Bulma .columns', () => {
    const css = compileScssSnippet(`
      @use '~/assets/scss/detail-sidebar-columns' as *;
      @include detail-sidebar-columns('.detail-scroll');
      @include detail-sidebar-stacking('.detail-scroll');
    `);
    const root = postcss.parse(css);
    const selectors = collectSelectors(root);

    expect(selectors.some((selector) => selector.includes('.detail-columns'))).toBe(true);
    expect(selectors.some((selector) => selector.includes('.detail-columns--sidebar-hidden'))).toBe(
      true
    );
    expect(selectors.filter((selector) => /\.columns\b/.test(selector))).toEqual([]);

    let hasExpandedTrack = false;
    let hasCollapsedTrack = false;
    let hasNarrowBlock = false;
    root.walkRules((rule) => {
      rule.walkDecls((decl) => {
        if (decl.prop === '--detail-columns' && decl.value === 'minmax(0, 72%) minmax(0, 28%)') {
          hasExpandedTrack = true;
        }
        if (decl.prop === '--detail-columns' && decl.value === 'minmax(0, 100%) minmax(0, 0%)') {
          hasCollapsedTrack = true;
        }
        if (
          rule.selector.includes('.detail-columns') &&
          decl.prop === 'display' &&
          decl.value === 'block'
        ) {
          hasNarrowBlock = true;
        }
      });
    });

    expect(hasExpandedTrack).toBe(true);
    expect(hasCollapsedTrack).toBe(true);
    expect(hasNarrowBlock).toBe(true);
  });

  test('all five Detail Overlays compile .detail-columns styles without Bulma .columns or --bulma-column-gap', () => {
    const detailOverlays = [
      'components/dashboard/detail/DiscussionDetail.vue',
      'components/dashboard/detail/IssueDetail.vue',
      'components/dashboard/detail/PRDetail.vue',
      'components/dashboard/detail/ReleaseDetail.vue',
      'components/dashboard/detail/RepoDetail.vue',
    ];

    for (const component of detailOverlays) {
      const root = compileSfcStyles(component);
      const selectors = collectSelectors(root);

      expect(
        selectors.some((selector) => selector.includes('.detail-columns')),
        `${component} should emit .detail-columns rules`
      ).toBe(true);
      expect(
        selectors.filter((selector) => /\.columns\b/.test(selector)),
        `${component} must not emit Bulma .columns rules`
      ).toEqual([]);
      expect(findUngatedHoverSelectors(root), `${component} hover gating`).toEqual([]);

      const columnGapProps: string[] = [];
      root.walkDecls((decl) => {
        if (decl.value.includes('--bulma-column-gap')) {
          columnGapProps.push(`${decl.prop}: ${decl.value}`);
        }
      });
      expect(columnGapProps, `${component} must not reference --bulma-column-gap`).toEqual([]);
    }
  });

  test('migrated layout and single-file relic components compile cleanly with ADR 0049 hover gating', () => {
    const components = [
      'components/layouts/Navbar.vue',
      'layouts/dashboard.vue',
      'components/dashboard/DashboardLayout.vue',
      'components/dashboard/composer/MarkdownComposer.vue',
      'components/dashboard/DashboardPagination.vue',
      'components/dashboard/DashboardLoadingList.vue',
      'components/dashboard/widgets/TabStats.vue',
      'components/auth/AuthenticatedLandingCard.vue',
      'components/dashboard/detail/DetailOverlayHost.vue',
      'components/dashboard/overlay/DashboardOverlayFrame.vue',
    ];

    for (const component of components) {
      const root = compileSfcStyles(component);
      expect(findUngatedHoverSelectors(root), `${component} hover gating`).toEqual([]);
    }
  });
});

function collectBulmaCustomPropertyUsages(root: Root, options?: { skipBulmaLayer?: boolean }) {
  const hits: string[] = [];
  root.walkDecls((decl) => {
    if (options?.skipBulmaLayer && enclosingLayerNames(decl)[0] === 'bulma') {
      return;
    }
    if (decl.prop.startsWith('--bulma-') || decl.value.includes('--bulma-')) {
      const selector = decl.parent?.type === 'rule' ? (decl.parent as Rule).selector : '';
      hits.push(`${selector} { ${decl.prop}: ${decl.value} }`);
    }
  });
  return hits;
}

describe('Foundation Layer custom property migration and bridge removal (#199)', () => {
  test('compiled main.scss emits zero --bulma-* declarations or references outside @layer bulma', async () => {
    const root = await getProcessedMainRoot();
    expect(collectBulmaCustomPropertyUsages(root, { skipBulmaLayer: true })).toEqual([]);
  });

  test('compiled application stylesheets emit zero --bulma-* declarations or references', () => {
    const sharedSheets = [
      'assets/scss/tokens.scss',
      'assets/scss/reset.scss',
      'assets/scss/scrollbars.scss',
      'assets/scss/base.scss',
      'assets/scss/controls.scss',
      'assets/scss/bulma-overrides.scss',
      'assets/scss/dashboard-list-card.scss',
      'assets/scss/modal-shell.scss',
      'assets/scss/detail-metadata-editor.scss',
      'components/dashboard/notification-card.scss',
      'components/dashboard/detail/people-picker-modal.scss',
    ];

    for (const sheet of sharedSheets) {
      const root = postcss.parse(compileScssAtPath(sheet));
      expect(
        collectBulmaCustomPropertyUsages(root),
        `${sheet} must not emit --bulma-* custom properties`
      ).toEqual([]);
    }

    const cardRoot = postcss.parse(compileScssFile('dashboard-list-card.scss'));
    const cardDecls = collectTopLevelDecls(cardRoot, '.dashboard-list-card');
    expect(cardDecls.get('box-shadow')).toBe('var(--gitpulse-shadow-card)');
    expect(cardDecls.get('color')).toBe('var(--gitpulse-text)');
  });

  test('compiled migrated SFC stylesheets emit zero --bulma-* references and use Foundation Layer tokens', () => {
    const migratedSfcs = [
      'components/dashboard/activity-bar/ActivityBar.vue',
      'components/dashboard/tab-sidebar/TabSidebar.vue',
      'components/dashboard/widgets/QuickFilters.vue',
      'components/dashboard/widgets/TabStats.vue',
      'components/dashboard/NotificationTodoSwipeRow.vue',
      'components/dashboard/detail/RepoDetail.vue',
      'components/dashboard/timeline/TimelineUnavailableEvent.vue',
      'components/dashboard/DashboardPagination.vue',
      'components/dashboard/DashboardMenu.vue',
      'components/dashboard/TokenizedQuery.vue',
      'components/dashboard/release-timeline/ReleaseTimelineFilterPanel.vue',
      'components/dashboard/tabs-settings/TabsSettingsPage.vue',
    ];

    for (const sfc of migratedSfcs) {
      const root = compileSfcStyles(sfc);
      expect(
        collectBulmaCustomPropertyUsages(root),
        `${sfc} must not emit --bulma-* custom properties`
      ).toEqual([]);
    }

    const quickFiltersRoot = compileSfcStyles('components/dashboard/widgets/QuickFilters.vue');
    expect(
      collectTopLevelDecls(
        quickFiltersRoot,
        '.quick-filters__item.is-active .quick-filters__checkbox'
      ).get('background-color')
    ).toBe('var(--gitpulse-primary-solid)');

    const swipeRowRoot = compileSfcStyles('components/dashboard/NotificationTodoSwipeRow.vue');
    expect(
      collectTopLevelDecls(swipeRowRoot, '.notification-swipe-row__card-backing').get(
        'border-radius'
      )
    ).toBe('var(--gitpulse-radius-xl)');

    const unavailableRoot = compileSfcStyles(
      'components/dashboard/timeline/TimelineUnavailableEvent.vue'
    );
    expect(collectTopLevelDecls(unavailableRoot, '.timeline-unavailable__label').get('color')).toBe(
      'var(--gitpulse-text-muted)'
    );
    expect(collectTopLevelDecls(unavailableRoot, '.timeline-unavailable__icon').get('color')).toBe(
      'var(--gitpulse-text-subtle)'
    );
  });
});

describe('Bulma button retirement and semantic Button primitive migration (#202)', () => {
  test('compiled global CSS emits zero Bulma .button or .buttons rules', async () => {
    const root = await getProcessedMainRoot();

    const buttonRuleSelectors: string[] = [];
    root.walkRules((rule) => {
      for (const arm of rule.selector.split(',')) {
        const normalized = arm.replace(/\s+/g, ' ').trim();
        if (/\.(?:button|buttons)(?![a-zA-Z0-9_-])/.test(normalized)) {
          buttonRuleSelectors.push(normalized);
        }
      }
    });

    expect(buttonRuleSelectors).toEqual([]);
  });

  test('bulma-overrides.scss emits zero .button rules and base.scss excludes .button from unselectable chrome', () => {
    const overridesRoot = postcss.parse(compileScssFile('bulma-overrides.scss'));
    const overrideButtonSelectors = collectSelectors(overridesRoot).filter((selector) =>
      /\.(?:button|buttons)(?![a-zA-Z0-9_-])/.test(selector)
    );
    expect(overrideButtonSelectors).toEqual([]);

    const baseRoot = postcss.parse(compileScssFile('base.scss'));
    const baseSelectors = collectSelectors(baseRoot);
    expect(baseSelectors.some((selector) => selector.includes('.gp-btn'))).toBe(true);
    expect(
      baseSelectors.filter((selector) => /\.(?:button|buttons)(?![a-zA-Z0-9_-])/.test(selector))
    ).toEqual([]);
  });

  test('controls.scss keeps base .gp-btn hover/focus borders, transparent ghost borders, and filled loading text hiding', () => {
    const root = postcss.parse(compileScssFile('controls.scss'));
    expect(findUngatedHoverSelectors(root)).toEqual([]);

    let hasBaseHoverBorder = false;
    let hasGhostHoverTransparentBorder = false;
    let hasFilledLoadingExclusion = false;
    let hasLoadingRule = false;

    root.walkRules((rule) => {
      if (rule.selector.includes('.gp-btn:hover:not(:disabled')) {
        rule.walkDecls('border-color', (decl) => {
          if (decl.value === 'var(--gitpulse-border-strong)') {
            hasBaseHoverBorder = true;
          }
        });
      }
      if (rule.selector.includes('.gp-btn--ghost:hover:not(:disabled')) {
        rule.walkDecls('border-color', (decl) => {
          if (decl.value === 'transparent') {
            hasGhostHoverTransparentBorder = true;
          }
        });
      }
      if (
        rule.selector.includes('.gp-btn--primary:not(.gp-btn--outlined)') &&
        rule.selector.includes(':not(.gp-btn--loading)')
      ) {
        hasFilledLoadingExclusion = true;
      }
      if (rule.selector.includes('.gp-btn.gp-btn--loading')) {
        rule.walkDecls('color', (decl) => {
          if (decl.value === 'transparent') {
            hasLoadingRule = true;
          }
        });
      }
    });

    expect(hasBaseHoverBorder).toBe(true);
    expect(hasGhostHoverTransparentBorder).toBe(true);
    expect(hasFilledLoadingExclusion).toBe(true);
    expect(hasLoadingRule).toBe(true);
  });

  test('migrated component stylesheets emit zero .button selectors and preserve ADR 0049 hover gating', () => {
    const components = [
      'components/dashboard/overlay/DashboardTopHeader.vue',
      'components/dashboard/discussion/DiscussionCommentCard.vue',
      'components/dashboard/issue/SubIssueList.vue',
      'components/layouts/ChromeActions.vue',
      'components/dashboard/pr/PRReviewWorkspace.vue',
    ];

    for (const component of components) {
      const root = compileSfcStyles(component);
      const buttonSelectors = collectSelectors(root).filter((selector) =>
        /\.(?:button|buttons)(?![a-zA-Z0-9_-])/.test(selector)
      );
      expect(buttonSelectors, `${component} must not emit .button selectors`).toEqual([]);
      expect(findUngatedHoverSelectors(root), `${component} hover gating`).toEqual([]);
    }
  });
});

describe('Bulma tag, title, subtitle, icon, and image retirement (#203)', () => {
  test('compiled global CSS emits zero rules for retired Bulma tag, title, subtitle, icon, and image modules', async () => {
    const root = await getProcessedMainRoot();

    const retiredRootSelectors = [
      '.tag',
      '.tags',
      '.tag.is-activity',
      '.tag.is-info.is-light',
      '.tag.is-link.is-light',
      '.tag.is-primary.is-light',
      '.tag.is-black.is-light',
      '.tag.is-success.is-light',
      '.tag.is-danger.is-light',
      '.tag.is-warning.is-light',
      '.title',
      '.title.is-3',
      '.title.is-4',
      '.title.is-5',
      '.title.is-6',
      '.subtitle',
      '.subtitle.is-6',
      '.subtitle.is-7',
      '.icon',
      '.icon.is-small',
      '.icon-text',
      '.image',
      '.image.is-32x32',
    ];

    const emittedArms = new Set<string>();
    root.walkRules((rule) => {
      for (const arm of rule.selector.split(',')) {
        emittedArms.add(arm.replace(/\s+/g, ' ').trim());
      }
    });

    const unexpected = retiredRootSelectors.filter((sel) => emittedArms.has(sel));
    expect(unexpected).toEqual([]);
  });

  test('bulma-overrides.scss emits zero rules for retired title, subtitle, and tag modules', () => {
    const root = postcss.parse(compileScssFile('bulma-overrides.scss'));
    const emittedArms = new Set<string>();
    root.walkRules((rule) => {
      for (const arm of rule.selector.split(',')) {
        emittedArms.add(arm.replace(/\s+/g, ' ').trim());
      }
    });

    for (const retired of [
      '.title',
      '.subtitle',
      '.tag.is-light',
      ".tag:not([class*='is-'])",
      '.tag.is-activity',
      '.tag.is-info.is-light',
      '.tag.is-link.is-light',
      '.tag.is-primary.is-light',
      '.tag.is-black.is-light',
      '.tag.is-success.is-light',
      '.tag.is-danger.is-light',
      '.tag.is-warning.is-light',
    ]) {
      expect(
        emittedArms.has(retired),
        `${retired} should be removed from bulma-overrides.scss`
      ).toBe(false);
    }

    // #204/#205 helper overrides remain intact.
    expect(emittedArms.has('.has-text-primary')).toBe(true);
  });

  test('base.scss removes retired .tag from $unselectable-chrome while keeping .gp-tag', () => {
    const root = postcss.parse(compileScssFile('base.scss'));
    const unselectableArms = new Set<string>();
    root.walkRules((rule) => {
      let hasUserSelectNone = false;
      rule.walkDecls('user-select', (decl) => {
        if (decl.value === 'none') {
          hasUserSelectNone = true;
        }
      });
      if (hasUserSelectNone) {
        for (const arm of rule.selector.split(',')) {
          unselectableArms.add(arm.trim());
        }
      }
    });

    expect(unselectableArms.has('.tag')).toBe(false);
    expect(unselectableArms.has('.gp-tag')).toBe(true);
  });

  test('controls.scss styles interactive a.gp-tag links with ADR 0049 hover gating', () => {
    const root = postcss.parse(compileScssFile('controls.scss'));
    expect(findUngatedHoverSelectors(root)).toEqual([]);

    const selectors = collectSelectors(root);
    expect(selectors.some((selector) => selector.includes('a.gp-tag:hover'))).toBe(true);
    expect(selectors.some((selector) => selector.includes('a.gp-tag:focus-visible'))).toBe(true);
  });

  test('migrated tag, typography, icon, and image components compile cleanly with scoped semantic styles', () => {
    const migratedSfcs = [
      'components/layouts/NavbarBrand.vue',
      'components/auth/AuthGateway.vue',
      'components/auth/AuthenticatedLandingCard.vue',
      'components/auth/PersonalLockForm.vue',
      'components/dashboard/GenericSearchItem.vue',
      'components/dashboard/IssuePrNotificationItem.vue',
      'components/dashboard/NotificationItem.vue',
      'components/dashboard/RepoItem.vue',
      'components/dashboard/discussion/DiscussionComments.vue',
      'components/dashboard/discussion/DiscussionHeader.vue',
      'components/dashboard/issue/IssueHeader.vue',
      'components/dashboard/issue/IssueTimelineStateEvents.vue',
      'components/dashboard/pr/PRHeader.vue',
      'components/dashboard/pr/PRReviewDiffViewer.vue',
      'components/dashboard/pr/PRReviewFileSidebar.vue',
      'components/dashboard/pr/PRReviewSubmitBar.vue',
      'components/dashboard/detail/ReleaseDetail.vue',
      'components/dashboard/detail/RepoDetail.vue',
      'components/dashboard/repo-files/RepoFileTree.vue',
      'components/dashboard/tab-sidebar/TabSidebar.vue',
      'components/dashboard/widgets/TabStats.vue',
      'pages/open.vue',
      'pages/dashboard/branches.vue',
      'pages/dashboard/contributors.vue',
      'pages/dashboard/package.vue',
      'pages/dashboard/releases.vue',
      'pages/dashboard/starred.vue',
      'pages/dashboard/wiki.vue',
    ];

    for (const sfc of migratedSfcs) {
      const root = compileSfcStyles(sfc);
      expect(
        collectBulmaCustomPropertyUsages(root),
        `${sfc} must not emit --bulma-* custom properties`
      ).toEqual([]);
      expect(findUngatedHoverSelectors(root), `${sfc} hover gating`).toEqual([]);
    }

    const navbarBrandRoot = compileSfcStyles('components/layouts/NavbarBrand.vue');
    expect(collectTopLevelDecls(navbarBrandRoot, '.navbar-brand-title').get('color')).toBe(
      'var(--gitpulse-text-strong)'
    );

    const notificationCardRoot = postcss.parse(
      compileScssAtPath('components/dashboard/notification-card.scss')
    );
    const avatarDecls = collectTopLevelDecls(notificationCardRoot, '.notification-card__avatar');
    expect(avatarDecls.get('width')).toBe('32px');
    expect(avatarDecls.get('height')).toBe('32px');

    const issueHeaderSelectors = collectSelectors(
      compileSfcStyles('components/dashboard/issue/IssueHeader.vue')
    );
    expect(issueHeaderSelectors.some((selector) => selector.includes('.gp-tag--activity'))).toBe(
      true
    );
    expect(issueHeaderSelectors.some((selector) => selector.includes('.tag.is-activity'))).toBe(
      false
    );

    const issueStateSelectors = collectSelectors(
      compileSfcStyles('components/dashboard/issue/IssueTimelineStateEvents.vue')
    );
    expect(
      issueStateSelectors.some((selector) => selector.includes('.gp-tag.issue-type-tag'))
    ).toBe(true);
    expect(issueStateSelectors.some((selector) => selector.includes('.tag.issue-type-tag'))).toBe(
      false
    );
  });
});

describe('Bulma utility helper retirement — Detail Overlays, PR Review, Timeline, Releases (#205)', () => {
  test('base.scss emits global .sr-only accessibility utility', () => {
    const root = postcss.parse(compileScssFile('base.scss'));
    const srOnlyDecls = collectTopLevelDecls(root, '.sr-only');

    expect(srOnlyDecls.get('position')).toBe('absolute');
    expect(srOnlyDecls.get('width')).toBe('1px');
    expect(srOnlyDecls.get('height')).toBe('1px');
    expect(srOnlyDecls.get('overflow')).toBe('hidden');
    expect(srOnlyDecls.get('white-space')).toBe('nowrap');
    expect(srOnlyDecls.get('clip-path')).toBe('inset(50%)');
  });

  test('compiled global CSS emits zero rules for zero-caller Bulma helpers retired in #205', async () => {
    const root = await getProcessedMainRoot();

    const retiredHelpers = [
      '.has-background-grey-lighter',
      '.has-text-danger',
      '.has-text-grey-light',
      '.has-text-link',
      '.has-text-success',
      '.has-text-weight-medium',
      '.has-text-weight-semibold',
      '.is-clipped',
      '.is-family-monospace',
      '.is-flex-wrap-wrap',
      '.is-inline',
      '.is-overlay',
      '.is-radiusless',
      '.is-size-5',
      '.is-size-6',
      '.is-sr-only',
      '.ml-1',
      '.ml-auto',
      '.mt-4',
      '.mx-2',
      '.pb-1',
      '.pb-3',
      '.pt-2',
      '.pt-3',
      '.px-3',
      '.px-4',
      '.px-6',
      '.py-2',
      '.py-5',
    ];

    const emittedArms = new Set<string>();
    root.walkRules((rule) => {
      for (const arm of rule.selector.split(',')) {
        emittedArms.add(arm.replace(/\s+/g, ' ').trim());
      }
    });

    const unexpected = retiredHelpers.filter((sel) => emittedArms.has(sel));
    expect(unexpected).toEqual([]);
  });

  test('all 48 migrated #205 SFCs compile cleanly with ADR 0049 hover gating and zero --bulma-* references', () => {
    const migratedSfcs = [
      'components/dashboard/overlay/DashboardOverlayFrame.vue',
      'components/dashboard/overlay/DashboardTopHeader.vue',
      'components/dashboard/detail/DetailAssignees.vue',
      'components/dashboard/detail/DetailLabels.vue',
      'components/dashboard/detail/DetailOverlayHost.vue',
      'components/dashboard/detail/IssueDetail.vue',
      'components/dashboard/detail/PRDetail.vue',
      'components/dashboard/detail/ReleaseDetail.vue',
      'components/dashboard/detail/RepoContributorsCard.vue',
      'components/dashboard/detail/RepoDetail.vue',
      'components/dashboard/detail/RepoLatestCommitBar.vue',
      'components/dashboard/composer/MarkdownComposer.vue',
      'components/dashboard/repo-files/RepoFileView.vue',
      'components/dashboard/discussion/DiscussionAnswerCard.vue',
      'components/dashboard/discussion/DiscussionCommentCard.vue',
      'components/dashboard/discussion/DiscussionComments.vue',
      'components/dashboard/discussion/DiscussionHeader.vue',
      'components/dashboard/discussion/DiscussionReplyList.vue',
      'components/dashboard/issue/IssueHeader.vue',
      'components/dashboard/issue/IssueTimelineEventBody.vue',
      'components/dashboard/issue/IssueTimelineEvents.vue',
      'components/dashboard/issue/IssueTimelineReferencedEventCard.vue',
      'components/dashboard/issue/IssueTimelineStateEvents.vue',
      'components/dashboard/issue/IssueTypeCard.vue',
      'components/dashboard/issue/LinkedPullRequestList.vue',
      'components/dashboard/issue/SubIssuePickerModal.vue',
      'components/dashboard/pr/PRHeader.vue',
      'components/dashboard/pr/PRMergeBox.vue',
      'components/dashboard/pr/PRReviewDiffReviewThreads.vue',
      'components/dashboard/pr/PRReviewDiffViewer.vue',
      'components/dashboard/pr/PRReviewFileSidebar.vue',
      'components/dashboard/pr/PRReviewSubmitBar.vue',
      'components/dashboard/pr/PRReviewWorkspace.vue',
      'components/dashboard/pr/PRStackRebaseDialog.vue',
      'components/dashboard/pr/PRTimelineEventBody.vue',
      'components/dashboard/pr/PRTimelineEvents.vue',
      'components/dashboard/pr/PRTimelineMergeCard.vue',
      'components/dashboard/pr/PRTimelineReferenceEvents.vue',
      'components/dashboard/pr/PRTimelineReviewCard.vue',
      'components/dashboard/pr/PRTimelineStateEvents.vue',
      'components/dashboard/timeline/DeferredFloatingMarkdownEditor.vue',
      'components/dashboard/timeline/FloatingMarkdownEditor.vue',
      'components/dashboard/timeline/ProjectTag.vue',
      'components/dashboard/timeline/ReferenceSubject.vue',
      'components/dashboard/timeline/TimelineCardHeader.vue',
      'components/dashboard/timeline/TimelineCommentCard.vue',
      'components/dashboard/timeline/TimelineEventActorRow.vue',
      'components/dashboard/timeline/TimelineRenamedTitleEvent.vue',
    ];

    for (const sfc of migratedSfcs) {
      const root = compileSfcStyles(sfc);
      expect(
        collectBulmaCustomPropertyUsages(root),
        `${sfc} must not emit --bulma-* custom properties`
      ).toEqual([]);
      expect(findUngatedHoverSelectors(root), `${sfc} hover gating`).toEqual([]);
    }
  });
});
