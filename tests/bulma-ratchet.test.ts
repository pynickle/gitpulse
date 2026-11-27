import { afterEach, describe, expect, test } from 'bun:test';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';

import {
  checkBulmaRatchet,
  evaluateBulmaRatchet,
  formatRatchetViolations,
  scanBulmaUsage,
} from '../scripts/check-bulma-ratchet';
import type { BulmaRatchetBaseline } from '../scripts/check-bulma-ratchet';

const tempDirs: string[] = [];

function createFixtureTree(files: Record<string, string>): string {
  const root = mkdtempSync(join(tmpdir(), 'gitpulse-bulma-ratchet-'));
  tempDirs.push(root);
  for (const [relPath, content] of Object.entries(files)) {
    const fullPath = join(root, relPath);
    mkdirSync(dirname(fullPath), { recursive: true });
    writeFileSync(fullPath, content, 'utf8');
  }
  return root;
}

afterEach(() => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (dir) {
      rmSync(dir, { recursive: true, force: true });
    }
  }
});

const SAMPLE_BASELINE: BulmaRatchetBaseline = {
  customProperties: 2,
  classes: {
    layoutRelics: {
      columns: 1,
      column: 1,
    },
    formsNoticesCards: {
      card: 1,
    },
    buttons: {
      button: 2,
    },
    tagsTitlesIconsImages: {
      tag: 1,
    },
    helpers: {
      'mb-4': 1,
      'p-0': 1,
      'has-text-grey': 1,
    },
  },
};

describe('Bulma monotonic ratchet checker', () => {
  test('passes when fixture usage matches the baseline exactly', () => {
    const root = createFixtureTree({
      'components/Sample.vue': `
        <template>
          <div class="columns card mb-4">
            <div class="column" content-class="p-0">
              <button class="button">One</button>
              <button :class="['button', isMuted ? 'has-text-grey' : '']">Two</button>
              <span class="tag">v1</span>
            </div>
          </div>
        </template>
        <style scoped lang="scss">
        .probe { color: var(--bulma-text-strong, var(--gitpulse-text-strong)); }
        </style>
      `,
      'assets/scss/bridge.scss': `:root { --bulma-text: var(--gitpulse-text); }\n`,
    });

    const result = checkBulmaRatchet(root, SAMPLE_BASELINE);
    expect(result.ok).toBe(true);
    expect(result.violations).toEqual([]);
    expect(result.usage.customProperties).toBe(2);
    expect(result.usage.classes.get('button')).toBe(2);
    expect(result.usage.classes.get('p-0')).toBe(1);
    expect(result.usage.classes.get('has-text-grey')).toBe(1);
  });

  test('passes when fixture usage is strictly below baseline (monotonic reduction)', () => {
    const root = createFixtureTree({
      'components/Migrated.vue': `
        <template>
          <div class="custom-layout">
            <button class="button">Only one left</button>
          </div>
        </template>
      `,
    });

    const result = checkBulmaRatchet(root, SAMPLE_BASELINE);
    expect(result.ok).toBe(true);
    expect(result.violations).toEqual([]);
    expect(result.usage.customProperties).toBe(0);
    expect(result.usage.classes.get('button')).toBe(1);
  });

  test('fails when a new --bulma-* custom property is introduced above baseline', () => {
    const root = createFixtureTree({
      'components/NewVar.vue': `
        <template><div class="custom">Hi</div></template>
        <style scoped lang="scss">
        .a { color: var(--bulma-text); }
        .b { background: var(--bulma-scheme-main); }
        .c { border-color: var(--bulma-border); }
        </style>
      `,
    });

    const result = checkBulmaRatchet(root, SAMPLE_BASELINE);
    expect(result.ok).toBe(false);
    expect(result.violations.some((v) => v.kind === 'custom-property')).toBe(true);
  });

  test('fails when a retired Bulma component class is reintroduced', () => {
    const root = createFixtureTree({
      'components/Regressed.vue': `
        <template>
          <div class="modal">
            <div class="content">Prose</div>
            <div :class="{ dropdown: isOpen }">Menu</div>
          </div>
        </template>
      `,
    });

    const result = checkBulmaRatchet(root, SAMPLE_BASELINE);
    expect(result.ok).toBe(false);
    const retiredViolations = result.violations
      .filter((v) => v.kind === 'retired-class')
      .map((v) => v.name)
      .sort();
    expect(retiredViolations).toEqual(['content', 'dropdown', 'modal']);
  });

  test('fails when an unlisted Bulma helper class is introduced', () => {
    const root = createFixtureTree({
      'components/HelperRegress.vue': `
        <template>
          <div class="p-6 has-text-weight-bold">Too much padding</div>
        </template>
      `,
    });

    const result = checkBulmaRatchet(root, SAMPLE_BASELINE);
    expect(result.ok).toBe(false);
    const helperViolations = result.violations
      .filter((v) => v.kind === 'retired-class')
      .map((v) => v.name)
      .sort();
    expect(helperViolations).toEqual(['has-text-weight-bold', 'p-6']);
  });

  test('fails when an active tracked Bulma class count increases above baseline', () => {
    const root = createFixtureTree({
      'components/ExtraButtons.vue': `
        <template>
          <button class="button">1</button>
          <button class="button">2</button>
          <button class="button">3</button>
        </template>
      `,
    });

    const result = checkBulmaRatchet(root, SAMPLE_BASELINE);
    expect(result.ok).toBe(false);
    expect(result.violations).toEqual([
      {
        kind: 'class-increase',
        category: 'buttons',
        name: 'button',
        actual: 3,
        baseline: 2,
      },
    ]);
  });

  test('ignores non-class bindings, condition strings in :class, HTML tags, and regular props', () => {
    const root = createFixtureTree({
      'components/CleanSemantic.vue': `
        <template>
          <section title="Dashboard section" aria-label="menu">
            <table data-kind="table">
              <tbody>
                <tr>
                  <td>
                    <button
                      type="button"
                      :class="{ 'app-overlay--menu': stage === 'menu', 'app-modal': mode === 'modal' }"
                    >
                      Open
                    </button>
                  </td>
                </tr>
              </tbody>
            </table>
            <footer>Footer text</footer>
          </section>
        </template>
      `,
    });

    const usage = scanBulmaUsage(root);
    const result = evaluateBulmaRatchet(usage, {
      customProperties: 0,
      classes: {
        layoutRelics: {},
        formsNoticesCards: {},
        buttons: {},
        tagsTitlesIconsImages: {},
        helpers: {},
      },
    });
    expect(result.ok).toBe(true);
    expect(result.violations).toEqual([]);
  });

  test('formats all violation kinds into readable diagnostics', () => {
    const formatted = formatRatchetViolations([
      { kind: 'custom-property', actual: 3, baseline: 2 },
      { kind: 'class-increase', category: 'buttons', name: 'button', actual: 5, baseline: 4 },
      { kind: 'retired-class', name: 'modal', actual: 1 },
    ]);

    expect(formatted).toContain('--bulma-* custom properties increased: 3 > baseline 2');
    expect(formatted).toContain('Bulma class .button (buttons) increased: 5 > baseline 4');
    expect(formatted).toContain('Retired/disallowed Bulma class .modal detected (1 occurrence)');
  });
});
