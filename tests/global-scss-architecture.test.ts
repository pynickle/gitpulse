import { afterAll, describe, expect, test } from 'bun:test';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

import { parse as parseSfc } from '@vue/compiler-sfc';
import postcss from 'postcss';
import type { AtRule, Declaration, Root, Rule } from 'postcss';
import { initCompiler } from 'sass-embedded';
import type { FileImporter } from 'sass-embedded';

import { HOVER_QUERY } from '../modules/hover-gate/plugin';

const APP_DIR = resolve(import.meta.dir, '../app');
const SCSS_DIR = resolve(APP_DIR, 'assets/scss');

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

function compileScssFile(filename: string) {
  return compiler.compile(resolve(SCSS_DIR, filename), {
    importers: [nuxtAliasImporter],
  }).css;
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
    importers: [nuxtAliasImporter],
  }).css;
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
    expect(lightRoot.get('--gitpulse-app-font-family')).toContain('HarmonyOS Sans');
    expect(lightRoot.get('--gitpulse-code-font-family')).toContain('Maple Mono');

    expect(darkRoot.get('color-scheme')).toBe('dark');
    expect(darkRoot.get('--gitpulse-primary-solid')).toBe('#5048e5');
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

  test('bulma-overrides.scss emits the temporary Bulma token bridge and component overrides', () => {
    const root = postcss.parse(compileScssFile('bulma-overrides.scss'));
    const lightRoot = collectTopLevelDecls(root, ':root');
    const darkRoot = collectTopLevelDecls(root, 'html.dark');

    expect(lightRoot.get('--bulma-scheme-main')).toBe('var(--gitpulse-surface)');
    expect(lightRoot.get('--bulma-primary')).toBe('var(--gitpulse-accent)');
    expect(darkRoot.get('--bulma-primary-l')).toBe('72%');
    expect(darkRoot.get('--bulma-scheme-main-ter')).toBe('var(--gitpulse-surface-raised)');

    expect(collectTopLevelDecls(root, '.navbar').get('background-color')).toBe(
      'var(--gitpulse-surface)'
    );
    expect(collectTopLevelDecls(root, '.button.is-primary').get('background-color')).toBe(
      'var(--gitpulse-primary-solid)'
    );
    expect(collectTopLevelDecls(root, '.tag.is-activity').get('font-weight')).toBe('bold');
    expect(collectTopLevelDecls(root, '.has-text-primary').get('color')).toBe(
      'var(--gitpulse-accent)'
    );
    expect(findUngatedHoverSelectors(root)).toEqual([]);
  });

  test('main.scss composes all partials in cascade order with no duplicate output', () => {
    const css = compileScssFile('main.scss');
    const root = postcss.parse(css);

    expect(findUngatedHoverSelectors(root)).toEqual([]);

    const keyframesNames: string[] = [];
    root.walkAtRules('keyframes', (atRule) => {
      keyframesNames.push(atRule.params);
    });
    expect(keyframesNames).toEqual(['spin']);

    let fabCount = 0;
    let lightPrimarySolidCount = 0;
    let darkPrimarySolidCount = 0;
    let baseLinkIndex = -1;
    let tabsLinkIndex = -1;
    let ruleIndex = 0;

    root.walkRules((rule) => {
      if (rule.parent === root && rule.selector === '.gitpulse-floating-fab') {
        fabCount += 1;
      }
      if (rule.selector === ':root') {
        rule.walkDecls('--gitpulse-primary-solid', () => {
          lightPrimarySolidCount += 1;
        });
      }
      if (rule.selector === 'html.dark') {
        rule.walkDecls('--gitpulse-primary-solid', () => {
          darkPrimarySolidCount += 1;
        });
      }
      if (rule.selector === 'a' && baseLinkIndex === -1) {
        baseLinkIndex = ruleIndex;
      }
      if (rule.selector === '.tabs a' && tabsLinkIndex === -1) {
        tabsLinkIndex = ruleIndex;
      }
      ruleIndex += 1;
    });

    expect(fabCount).toBe(1);
    expect(lightPrimarySolidCount).toBe(1);
    expect(darkPrimarySolidCount).toBe(1);
    expect(baseLinkIndex).toBeGreaterThanOrEqual(0);
    expect(tabsLinkIndex).toBeGreaterThan(baseLinkIndex);
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
