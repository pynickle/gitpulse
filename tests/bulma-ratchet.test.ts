import { afterEach, describe, expect, test } from 'bun:test';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';

import {
  checkBulmaGuard,
  formatBulmaGuardViolations,
  isBulmaHelperClass,
} from '../scripts/check-bulma-ratchet';

const SCRIPT_PATH = resolve(import.meta.dir, '../scripts/check-bulma-ratchet.ts');
const tempDirs: string[] = [];

function createFixtureRepo(files: Record<string, string>): string {
  const root = mkdtempSync(join(tmpdir(), 'gitpulse-zero-bulma-guard-'));
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

describe('Permanent zero-Bulma guard (ADR 0057)', () => {
  test('passes on a clean fixture repository with zero Bulma dependencies, imports, variables, or classes', () => {
    const root = createFixtureRepo({
      'package.json': JSON.stringify({
        name: 'fixture',
        dependencies: { vue: '3.5.46', nuxt: '^4.7.0' },
        devDependencies: { postcss: '8.5.33', 'sass-embedded': '1.108.2' },
      }),
      'nuxt.config.ts': `export default defineNuxtConfig({ css: ['~/assets/scss/main.scss'] });\n`,
      'app/assets/scss/reset.scss': `@layer reset { html { box-sizing: border-box; } }\n`,
      'app/assets/scss/main.scss': `@use '~/assets/scss/reset';\n.gp-btn { color: var(--gitpulse-text-strong); }\n`,
      'app/components/CleanSemantic.vue': `
        <template>
          <section class="gp-panel" title="Dashboard section" aria-label="menu">
            <table data-kind="table">
              <tbody>
                <tr>
                  <td>
                    <button
                      type="button"
                      class="gp-btn gp-btn--primary sr-only"
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
        <style scoped lang="scss">
        /* Regular comment mentioning bulma prose does not count as an import. */
        .gp-panel { color: var(--gitpulse-text); }
        </style>
      `,
    });

    const result = checkBulmaGuard(root);
    expect(result.ok).toBe(true);
    expect(result.violations).toEqual([]);
  });

  test('fails when bulma is added to package.json dependencies, devDependencies, or overrides', () => {
    const root = createFixtureRepo({
      'package.json': JSON.stringify({
        name: 'fixture',
        dependencies: { bulma: '^1.0.4', vue: '3.5.46' },
        devDependencies: { bulma: '^1.0.4' },
        overrides: { bulma: '1.0.4' },
      }),
      'app/assets/scss/main.scss': `.gp-btn { color: var(--gitpulse-text); }\n`,
    });

    const result = checkBulmaGuard(root);
    expect(result.ok).toBe(false);
    expect(result.violations).toEqual([
      { kind: 'dependency', file: 'package.json', section: 'dependencies' },
      { kind: 'dependency', file: 'package.json', section: 'devDependencies' },
      { kind: 'dependency', file: 'package.json', section: 'overrides' },
    ]);
  });

  test('fails on bulma/ or bulma imports in SCSS, Vue styles, TypeScript, and nuxt.config.ts, or @layer bulma declarations', () => {
    const root = createFixtureRepo({
      'package.json': JSON.stringify({ name: 'fixture', dependencies: {} }),
      'nuxt.config.ts': `export default defineNuxtConfig({ css: ['bulma/css/bulma.min.css', '~/assets/scss/main.scss'] });\n`,
      'app/assets/scss/stopgap.scss': `
        @use 'sass:meta';
        @layer reset, bulma;
        @layer bulma {
          @include meta.load-css('bulma/sass/themes');
        }
      `,
      'app/assets/scss/legacy.scss': `@use 'bulma/sass/elements/button';\n`,
      'app/components/Leaky.vue': `
        <script setup lang="ts">
        import 'bulma/css/bulma.min.css';
        </script>
        <template><div class="gp-box">Hi</div></template>
        <style scoped lang="scss">
        @import 'bulma';
        </style>
      `,
    });

    const result = checkBulmaGuard(root);
    expect(result.ok).toBe(false);

    const importViolations = result.violations.filter((v) => v.kind === 'import');
    expect(importViolations.map((v) => v.specifier).sort()).toEqual([
      'bulma',
      'bulma/css/bulma.min.css',
      'bulma/css/bulma.min.css',
      'bulma/sass/elements/button',
      'bulma/sass/themes',
    ]);

    const layerViolations = result.violations.filter((v) => v.kind === 'layer');
    expect(layerViolations.length).toBeGreaterThanOrEqual(1);
  });

  test('fails on any --bulma-* custom property declaration or reference in app/', () => {
    const root = createFixtureRepo({
      'package.json': JSON.stringify({ name: 'fixture', dependencies: {} }),
      'app/components/RegressedVar.vue': `
        <template><div class="custom">Hi</div></template>
        <style scoped lang="scss">
        .a { color: var(--bulma-text-strong, var(--gitpulse-text-strong)); }
        </style>
      `,
      'app/assets/scss/tokens.scss': `:root { --bulma-scheme-main: #fff; }\n`,
    });

    const result = checkBulmaGuard(root);
    expect(result.ok).toBe(false);
    expect(result.violations).toEqual([
      {
        kind: 'custom-property',
        actual: 2,
        files: ['app/assets/scss/tokens.scss', 'app/components/RegressedVar.vue'],
      },
    ]);
  });

  test('fails when any legacy Bulma component or helper class is introduced in Vue templates', () => {
    const root = createFixtureRepo({
      'package.json': JSON.stringify({ name: 'fixture', dependencies: {} }),
      'app/components/Regressed.vue': `
        <template>
          <div class="columns card modal mb-4">
            <div class="column" content-class="p-6">
              <button class="button">One</button>
              <span :class="['tag', isMuted ? 'has-text-grey' : 'is-sr-only']">v1</span>
              <div :class="{ dropdown: isOpen, 'is-flex': true }">Menu</div>
              <div class="content notification title">Legacy</div>
            </div>
          </div>
        </template>
      `,
    });

    const result = checkBulmaGuard(root);
    expect(result.ok).toBe(false);
    const classViolations = result.violations
      .filter((v) => v.kind === 'disallowed-class')
      .map((v) => v.name)
      .sort();
    expect(classViolations).toEqual([
      'button',
      'card',
      'column',
      'columns',
      'content',
      'dropdown',
      'has-text-grey',
      'is-flex',
      'is-sr-only',
      'mb-4',
      'modal',
      'notification',
      'p-6',
      'tag',
      'title',
    ]);
  });

  test('classifies Bulma helper classes accurately without false positives on semantic classes', () => {
    expect(isBulmaHelperClass('mb-4')).toBe(true);
    expect(isBulmaHelperClass('p-0')).toBe(true);
    expect(isBulmaHelperClass('has-text-weight-semibold')).toBe(true);
    expect(isBulmaHelperClass('is-flex-direction-column')).toBe(true);
    expect(isBulmaHelperClass('is-sr-only')).toBe(true);

    expect(isBulmaHelperClass('sr-only')).toBe(false);
    expect(isBulmaHelperClass('gp-btn')).toBe(false);
    expect(isBulmaHelperClass('is-active')).toBe(false);
    expect(isBulmaHelperClass('is-draft')).toBe(false);
  });

  test('formats all violation kinds into readable diagnostics', () => {
    const formatted = formatBulmaGuardViolations([
      { kind: 'dependency', file: 'package.json', section: 'dependencies' },
      { kind: 'import', file: 'nuxt.config.ts', specifier: 'bulma/css/bulma.min.css' },
      { kind: 'layer', file: 'app/assets/scss/reset.scss', params: 'reset, bulma' },
      { kind: 'custom-property', actual: 2, files: ['app/assets/scss/tokens.scss'] },
      { kind: 'disallowed-class', name: 'button', actual: 1 },
    ]);

    expect(formatted).toContain('package.json');
    expect(formatted).toContain('dependencies');
    expect(formatted).toContain('bulma/css/bulma.min.css');
    expect(formatted).toContain('@layer reset, bulma');
    expect(formatted).toContain('--bulma-*');
    expect(formatted).toContain('.button');
  });

  test('CLI entrypoint exits 0 on a clean fixture and exits 1 with diagnostics on a violating fixture', () => {
    const cleanRoot = createFixtureRepo({
      'package.json': JSON.stringify({ name: 'clean', dependencies: { vue: '3.5.46' } }),
      'nuxt.config.ts': `export default defineNuxtConfig({ css: ['~/assets/scss/main.scss'] });\n`,
      'app/assets/scss/main.scss': `@layer reset;\n`,
    });

    const passRun = Bun.spawnSync(['bun', SCRIPT_PATH, cleanRoot], {
      stdout: 'pipe',
      stderr: 'pipe',
    });
    expect(passRun.exitCode).toBe(0);

    const dirtyRoot = createFixtureRepo({
      'package.json': JSON.stringify({ name: 'dirty', dependencies: { bulma: '^1.0.4' } }),
      'app/components/Bad.vue': `<template><button class="button is-flex">Bad</button></template>\n`,
    });

    const failRun = Bun.spawnSync(['bun', SCRIPT_PATH, dirtyRoot], {
      stdout: 'pipe',
      stderr: 'pipe',
    });
    expect(failRun.exitCode).toBe(1);
    const stderr = failRun.stderr.toString();
    expect(stderr).toContain('package.json');
    expect(stderr).toContain('.button');
    expect(stderr).toContain('.is-flex');
  });
});
