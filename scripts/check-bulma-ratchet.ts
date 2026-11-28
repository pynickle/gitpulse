import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';

import { parse as parseSfc } from '@vue/compiler-sfc';
import ts from 'typescript';

export type BulmaGuardViolation =
  | {
      kind: 'dependency';
      file: string;
      section: string;
    }
  | {
      kind: 'import';
      file: string;
      specifier: string;
    }
  | {
      kind: 'layer';
      file: string;
      params: string;
    }
  | {
      kind: 'custom-property';
      actual: number;
      files: string[];
    }
  | {
      kind: 'disallowed-class';
      name: string;
      actual: number;
    };

export interface BulmaGuardResult {
  ok: boolean;
  violations: BulmaGuardViolation[];
}

/**
 * Legacy Bulma component, layout, form, and element classes permanently retired
 * under ADR 0057.
 */
export const DISALLOWED_BULMA_CLASSES: ReadonlySet<string> = new Set([
  // Modals & overlays
  'modal',
  'modal-background',
  'modal-content',
  'modal-close',
  'modal-card',
  'modal-card-head',
  'modal-card-body',
  'modal-card-foot',
  'modal-card-title',
  // Dropdowns, menus, panels, tables
  'dropdown',
  'dropdown-trigger',
  'dropdown-menu',
  'dropdown-content',
  'dropdown-item',
  'dropdown-divider',
  'table',
  'table-container',
  'panel',
  'panel-heading',
  'panel-block',
  'panel-tabs',
  'menu',
  'menu-label',
  'menu-list',
  // Layout & grid relics
  'section',
  'container',
  'content',
  'footer',
  'columns',
  'column',
  'grid',
  'fixed-grid',
  'cell',
  'navbar',
  'navbar-brand',
  'navbar-menu',
  'navbar-item',
  'hero',
  'hero-body',
  'tabs',
  'pagination',
  'pagination-previous',
  'pagination-next',
  'pagination-link',
  'pagination-ellipsis',
  'pagination-list',
  'media',
  'media-left',
  'media-content',
  'level',
  'level-item',
  'loader',
  'box',
  'block',
  // Messages, notifications, cards, skeletons
  'message',
  'message-header',
  'message-body',
  'notification',
  'delete',
  'card',
  'card-header',
  'card-header-title',
  'card-content',
  'card-footer',
  'breadcrumb',
  'progress',
  'skeleton-block',
  'skeleton-lines',
  'is-skeleton',
  // Forms
  'checkbox',
  'input',
  'textarea',
  'field',
  'control',
  'label',
  'help',
  'has-icons-left',
  'has-addons',
  'select',
  'file',
  'file-label',
  'file-input',
  'file-cta',
  'file-name',
  // Buttons, tags, typography, icons, images
  'button',
  'buttons',
  'tag',
  'tags',
  'title',
  'subtitle',
  'icon',
  'image',
]);

const BULMA_HELPER_PATTERNS: readonly RegExp[] = [
  /^has-text-/,
  /^has-background-/,
  /^is-size-[1-7](?:-[a-z]+)?$/,
  /^is-family-/,
  /^is-flex(?:-[a-z0-9-]+)?$/,
  /^is-align-(?:items|content|self)-/,
  /^is-justify-content-/,
  /^(?:m|p)[trblxy]?-(?:[0-6]|auto)$/,
  /^is-hidden(?:-[a-z]+)?$/,
  /^is-(?:sr-only|block|inline|inline-block|inline-flex|fullwidth|invisible|clipped|radiusless|shadowless|overlay|relative|clickable|unselectable|clearfix|uppercase|lowercase|capitalized|italic|underlined)$/,
  /^is-pulled-(?:left|right)$/,
];

export function isBulmaHelperClass(className: string): boolean {
  return BULMA_HELPER_PATTERNS.some((pattern) => pattern.test(className));
}

const PACKAGE_DEPENDENCY_SECTIONS = [
  'dependencies',
  'devDependencies',
  'peerDependencies',
  'optionalDependencies',
  'overrides',
] as const;

const BULMA_CUSTOM_PROPERTY_RE = /--bulma-[a-z0-9-]+/g;
const STYLESHEET_BULMA_IMPORT_RE =
  /(?:@(?:use|import|forward)\s+['"](bulma(?:\/[^'"]*)?)['"]|load-css\(\s*['"](bulma(?:\/[^'"]*)?)['"]\s*\))/g;
const SCRIPT_BULMA_IMPORT_RE =
  /(?:(?:from|import)\s*\(?\s*['"](bulma(?:\/[^'"]*)?)['"]|['"](bulma\/[^'"]+)['"])/g;
const CSS_LAYER_RE = /@layer\s+([^{;]+)/g;
const STYLESHEET_STRING_RE = /'(?:\\.|[^'\\])*'|"(?:\\.|[^"\\])*"/g;
const STYLESHEET_ATTR_SELECTOR_RE = /\[[^\]]*\]/g;
const STYLESHEET_CLASS_TOKEN_RE = /\.([a-zA-Z_-][a-zA-Z0-9_-]*)/g;

function toPosixRelative(repoRoot: string, filePath: string): string {
  return relative(repoRoot, filePath).replaceAll('\\', '/');
}

function stripStylesheetComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[\s;{}])\/\/[^\n]*/gm, '$1');
}

function walkFiles(dir: string): string[] {
  if (!existsSync(dir)) {
    return [];
  }
  const results: string[] = [];
  for (const entry of readdirSync(dir)) {
    const fullPath = join(dir, entry);
    if (statSync(fullPath).isDirectory()) {
      results.push(...walkFiles(fullPath));
    } else {
      results.push(fullPath);
    }
  }
  return results;
}

function addClassTokens(raw: string, out: string[]): void {
  for (const token of raw.split(/\s+/)) {
    if (token) {
      out.push(token);
    }
  }
}

function extractClassesFromTsExpression(node: ts.Expression, out: string[]): void {
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
    addClassTokens(node.text, out);
    return;
  }
  if (ts.isTemplateExpression(node)) {
    addClassTokens(node.head.text, out);
    for (const span of node.templateSpans) {
      extractClassesFromTsExpression(span.expression, out);
      addClassTokens(span.literal.text, out);
    }
    return;
  }
  if (ts.isArrayLiteralExpression(node)) {
    for (const element of node.elements) {
      if (ts.isSpreadElement(element)) {
        extractClassesFromTsExpression(element.expression, out);
      } else {
        extractClassesFromTsExpression(element, out);
      }
    }
    return;
  }
  if (ts.isObjectLiteralExpression(node)) {
    for (const prop of node.properties) {
      if (ts.isPropertyAssignment(prop)) {
        if (
          ts.isStringLiteral(prop.name) ||
          ts.isIdentifier(prop.name) ||
          ts.isNoSubstitutionTemplateLiteral(prop.name)
        ) {
          addClassTokens(prop.name.text, out);
        } else if (ts.isComputedPropertyName(prop.name)) {
          extractClassesFromTsExpression(prop.name.expression, out);
        }
      } else if (ts.isShorthandPropertyAssignment(prop)) {
        addClassTokens(prop.name.text, out);
      }
    }
    return;
  }
  if (ts.isConditionalExpression(node)) {
    extractClassesFromTsExpression(node.whenTrue, out);
    extractClassesFromTsExpression(node.whenFalse, out);
    return;
  }
  if (ts.isParenthesizedExpression(node)) {
    extractClassesFromTsExpression(node.expression, out);
    return;
  }
  if (ts.isBinaryExpression(node)) {
    if (node.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken) {
      extractClassesFromTsExpression(node.right, out);
    } else if (
      node.operatorToken.kind === ts.SyntaxKind.BarBarToken ||
      node.operatorToken.kind === ts.SyntaxKind.QuestionQuestionToken
    ) {
      extractClassesFromTsExpression(node.left, out);
      extractClassesFromTsExpression(node.right, out);
    }
  }
}

function extractClassesFromBindingExpression(expression: string, out: string[]): void {
  const sourceFile = ts.createSourceFile(
    'class-expr.ts',
    `(${expression})`,
    ts.ScriptTarget.Latest
  );
  const firstStatement = sourceFile.statements[0];
  if (firstStatement && ts.isExpressionStatement(firstStatement)) {
    extractClassesFromTsExpression(firstStatement.expression, out);
  }
}

interface TemplateAstNodeLike {
  props?: Array<{
    type: number;
    name: string;
    value?: { content?: string };
    arg?: { content?: string };
    exp?: { content?: string };
  }>;
  children?: TemplateAstNodeLike[];
  branches?: TemplateAstNodeLike[];
}

function isClassAttributeName(name: string): boolean {
  return name === 'class' || name.endsWith('-class');
}

function collectTemplateClasses(node: TemplateAstNodeLike | undefined, out: string[]): void {
  if (!node) {
    return;
  }
  if (Array.isArray(node.props)) {
    for (const prop of node.props) {
      // NodeTypes.ATTRIBUTE === 6, NodeTypes.DIRECTIVE === 7
      if (prop.type === 6 && isClassAttributeName(prop.name) && prop.value?.content) {
        addClassTokens(prop.value.content, out);
      } else if (
        prop.type === 7 &&
        prop.name === 'bind' &&
        prop.arg?.content &&
        isClassAttributeName(prop.arg.content) &&
        prop.exp?.content
      ) {
        extractClassesFromBindingExpression(prop.exp.content, out);
      }
    }
  }
  if (Array.isArray(node.children)) {
    for (const child of node.children) {
      collectTemplateClasses(child, out);
    }
  }
  if (Array.isArray(node.branches)) {
    for (const branch of node.branches) {
      collectTemplateClasses(branch, out);
    }
  }
}

function extractStylesheetSelectorClasses(stripped: string): string[] {
  const withoutStrings = stripped.replace(STYLESHEET_STRING_RE, '');
  const classes: string[] = [];
  let segmentStart = 0;

  for (let i = 0; i < withoutStrings.length; i += 1) {
    const ch = withoutStrings[i];
    if (ch === '{') {
      const header = withoutStrings.slice(segmentStart, i).trim();
      segmentStart = i + 1;
      if (!header || header.startsWith('@') || header.endsWith(':')) {
        continue;
      }
      const selectorText = header.replace(STYLESHEET_ATTR_SELECTOR_RE, '');
      for (const match of selectorText.matchAll(STYLESHEET_CLASS_TOKEN_RE)) {
        const className = match[1];
        if (className) {
          classes.push(className);
        }
      }
    } else if (ch === '}' || ch === ';') {
      segmentStart = i + 1;
    }
  }

  return classes;
}

function scanStylesheetSource(
  source: string,
  relFile: string,
  violations: BulmaGuardViolation[],
  disallowedClassCounts: Map<string, number>
): void {
  const stripped = stripStylesheetComments(source);

  for (const match of stripped.matchAll(STYLESHEET_BULMA_IMPORT_RE)) {
    const specifier = match[1] ?? match[2];
    if (specifier) {
      violations.push({ kind: 'import', file: relFile, specifier });
    }
  }

  for (const match of stripped.matchAll(CSS_LAYER_RE)) {
    const params = match[1]?.trim() ?? '';
    if (/\bbulma\b/i.test(params)) {
      violations.push({ kind: 'layer', file: relFile, params });
    }
  }

  for (const className of extractStylesheetSelectorClasses(stripped)) {
    if (isBulmaHelperClass(className)) {
      disallowedClassCounts.set(className, (disallowedClassCounts.get(className) ?? 0) + 1);
    }
  }
}

function scanScriptSource(
  source: string,
  relFile: string,
  violations: BulmaGuardViolation[]
): void {
  for (const match of source.matchAll(SCRIPT_BULMA_IMPORT_RE)) {
    const specifier = match[1] ?? match[2];
    if (specifier) {
      violations.push({ kind: 'import', file: relFile, specifier });
    }
  }
}

export function checkBulmaGuard(repoRoot: string): BulmaGuardResult {
  const violations: BulmaGuardViolation[] = [];

  const packageJsonPath = join(repoRoot, 'package.json');
  if (existsSync(packageJsonPath)) {
    const pkg = JSON.parse(readFileSync(packageJsonPath, 'utf8')) as Record<
      string,
      Record<string, unknown> | undefined
    >;
    for (const section of PACKAGE_DEPENDENCY_SECTIONS) {
      const entries = pkg[section];
      if (entries && typeof entries === 'object' && 'bulma' in entries) {
        violations.push({ kind: 'dependency', file: 'package.json', section });
      }
    }
  }

  const nuxtConfigPath = join(repoRoot, 'nuxt.config.ts');
  if (existsSync(nuxtConfigPath)) {
    scanScriptSource(readFileSync(nuxtConfigPath, 'utf8'), 'nuxt.config.ts', violations);
  }

  const appDir = join(repoRoot, 'app');
  let customPropertyCount = 0;
  const customPropertyFiles = new Set<string>();
  const disallowedClassCounts = new Map<string, number>();

  for (const filePath of walkFiles(appDir)) {
    if (!/\.(?:vue|scss|css|ts)$/.test(filePath)) {
      continue;
    }

    const relFile = toPosixRelative(repoRoot, filePath);
    const source = readFileSync(filePath, 'utf8');

    const customPropMatches = source.match(BULMA_CUSTOM_PROPERTY_RE);
    if (customPropMatches) {
      customPropertyCount += customPropMatches.length;
      customPropertyFiles.add(relFile);
    }

    if (filePath.endsWith('.scss') || filePath.endsWith('.css')) {
      scanStylesheetSource(source, relFile, violations, disallowedClassCounts);
      continue;
    }

    if (filePath.endsWith('.ts')) {
      scanScriptSource(source, relFile, violations);
      continue;
    }

    if (filePath.endsWith('.vue')) {
      const { descriptor } = parseSfc(source, { filename: filePath });

      if (descriptor.script?.content) {
        scanScriptSource(descriptor.script.content, relFile, violations);
      }
      if (descriptor.scriptSetup?.content) {
        scanScriptSource(descriptor.scriptSetup.content, relFile, violations);
      }
      for (const style of descriptor.styles) {
        scanStylesheetSource(style.content, relFile, violations, disallowedClassCounts);
      }

      if (descriptor.template?.ast) {
        const templateClasses: string[] = [];
        collectTemplateClasses(
          descriptor.template.ast as unknown as TemplateAstNodeLike,
          templateClasses
        );
        for (const className of templateClasses) {
          if (DISALLOWED_BULMA_CLASSES.has(className) || isBulmaHelperClass(className)) {
            disallowedClassCounts.set(className, (disallowedClassCounts.get(className) ?? 0) + 1);
          }
        }
      }
    }
  }

  if (customPropertyCount > 0) {
    violations.push({
      kind: 'custom-property',
      actual: customPropertyCount,
      files: [...customPropertyFiles].sort(),
    });
  }

  for (const [name, actual] of [...disallowedClassCounts.entries()].sort(([a], [b]) =>
    a.localeCompare(b)
  )) {
    violations.push({
      kind: 'disallowed-class',
      name,
      actual,
    });
  }

  return {
    ok: violations.length === 0,
    violations,
  };
}

export function formatBulmaGuardViolations(violations: readonly BulmaGuardViolation[]): string {
  return violations
    .map((violation) => {
      if (violation.kind === 'dependency') {
        return `- Disallowed "bulma" package found in ${violation.file} (${violation.section})`;
      }
      if (violation.kind === 'import') {
        return `- Disallowed Bulma import "${violation.specifier}" found in ${violation.file}`;
      }
      if (violation.kind === 'layer') {
        return `- Disallowed "@layer ${violation.params}" declaration found in ${violation.file}`;
      }
      if (violation.kind === 'custom-property') {
        return `- Disallowed --bulma-* custom propert${violation.actual === 1 ? 'y' : 'ies'} detected (${violation.actual} in ${violation.files.join(', ')})`;
      }
      return `- Disallowed legacy Bulma class .${violation.name} detected (${violation.actual} occurrence${violation.actual === 1 ? '' : 's'})`;
    })
    .join('\n');
}

if (import.meta.main) {
  const repoRoot = process.argv[2] ? resolve(process.argv[2]) : resolve(import.meta.dir, '..');
  const result = checkBulmaGuard(repoRoot);

  if (!result.ok) {
    console.error('Zero-Bulma guard failed (ADR 0057):');
    console.error(formatBulmaGuardViolations(result.violations));
    process.exit(1);
  }
}
