import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';

import { parse as parseSfc } from '@vue/compiler-sfc';
import ts from 'typescript';

export interface BulmaRatchetBaseline {
  customProperties: number;
  classes: Record<string, Record<string, number>>;
}

export interface BulmaUsageReport {
  customProperties: number;
  classes: Map<string, number>;
}

export type BulmaRatchetViolation =
  | {
      kind: 'custom-property';
      actual: number;
      baseline: number;
    }
  | {
      kind: 'class-increase';
      category: string;
      name: string;
      actual: number;
      baseline: number;
    }
  | {
      kind: 'retired-class';
      name: string;
      actual: number;
    };

export interface BulmaRatchetResult {
  ok: boolean;
  usage: BulmaUsageReport;
  violations: BulmaRatchetViolation[];
}

/**
 * Bulma classes retired in #198 (excluded modules) and future modules once their
 * baseline entries are lowered to 0 or removed.
 */
export const RETIRED_BULMA_CLASSES: ReadonlySet<string> = new Set([
  'modal',
  'modal-background',
  'modal-content',
  'modal-close',
  'modal-card',
  'modal-card-head',
  'modal-card-body',
  'modal-card-foot',
  'modal-card-title',
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
  'section',
  'container',
  'content',
  'footer',
  'message',
  'message-header',
  'message-body',
  'breadcrumb',
  'progress',
  'block',
  'select',
  'file',
  'file-label',
  'file-input',
  'file-cta',
  'file-name',
  'menu',
  'menu-label',
  'menu-list',
  'grid',
  'fixed-grid',
  'cell',
  'skeleton-block',
  'skeleton-lines',
  'is-skeleton',
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
  /^is-(?:sr-only|block|inline|inline-block|inline-flex|invisible|clipped|radiusless|shadowless|overlay|relative|clickable|unselectable|clearfix|uppercase|lowercase|capitalized|italic|underlined)$/,
  /^is-pulled-(?:left|right)$/,
];

export function isBulmaHelperClass(className: string): boolean {
  return BULMA_HELPER_PATTERNS.some((pattern) => pattern.test(className));
}

const BULMA_CUSTOM_PROPERTY_RE = /--bulma-[a-z0-9-]+/g;

function walkFiles(dir: string): string[] {
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
  if (
    ts.isBinaryExpression(node) &&
    (node.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken ||
      node.operatorToken.kind === ts.SyntaxKind.BarBarToken ||
      node.operatorToken.kind === ts.SyntaxKind.QuestionQuestionToken)
  ) {
    extractClassesFromTsExpression(node.right, out);
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

export function scanBulmaUsage(rootDir: string): BulmaUsageReport {
  let customProperties = 0;
  const classes = new Map<string, number>();

  for (const filePath of walkFiles(rootDir)) {
    if (!/\.(?:vue|scss|css|ts)$/.test(filePath)) {
      continue;
    }

    const source = readFileSync(filePath, 'utf8');
    const customPropMatches = source.match(BULMA_CUSTOM_PROPERTY_RE);
    if (customPropMatches) {
      customProperties += customPropMatches.length;
    }

    if (filePath.endsWith('.vue')) {
      const { descriptor } = parseSfc(source, { filename: filePath });
      if (descriptor.template?.ast) {
        const templateClasses: string[] = [];
        collectTemplateClasses(
          descriptor.template.ast as unknown as TemplateAstNodeLike,
          templateClasses
        );
        for (const className of templateClasses) {
          classes.set(className, (classes.get(className) ?? 0) + 1);
        }
      }
    }
  }

  return { customProperties, classes };
}

export function evaluateBulmaRatchet(
  usage: BulmaUsageReport,
  baseline: BulmaRatchetBaseline
): BulmaRatchetResult {
  const violations: BulmaRatchetViolation[] = [];

  if (usage.customProperties > baseline.customProperties) {
    violations.push({
      kind: 'custom-property',
      actual: usage.customProperties,
      baseline: baseline.customProperties,
    });
  }

  const trackedBaseline = new Map<string, { category: string; cap: number }>();
  for (const [category, entries] of Object.entries(baseline.classes)) {
    for (const [className, cap] of Object.entries(entries)) {
      trackedBaseline.set(className, { category, cap });
    }
  }

  for (const [className, { category, cap }] of trackedBaseline.entries()) {
    const actual = usage.classes.get(className) ?? 0;
    if (actual > cap) {
      violations.push(
        cap === 0
          ? { kind: 'retired-class', name: className, actual }
          : { kind: 'class-increase', category, name: className, actual, baseline: cap }
      );
    }
  }

  for (const [className, actual] of usage.classes.entries()) {
    if (actual <= 0 || trackedBaseline.has(className)) {
      continue;
    }
    if (RETIRED_BULMA_CLASSES.has(className) || isBulmaHelperClass(className)) {
      violations.push({
        kind: 'retired-class',
        name: className,
        actual,
      });
    }
  }

  return {
    ok: violations.length === 0,
    usage,
    violations,
  };
}

export function checkBulmaRatchet(
  rootDir: string,
  baseline: BulmaRatchetBaseline
): BulmaRatchetResult {
  return evaluateBulmaRatchet(scanBulmaUsage(rootDir), baseline);
}

export function formatRatchetViolations(violations: readonly BulmaRatchetViolation[]): string {
  return violations
    .map((violation) => {
      if (violation.kind === 'custom-property') {
        return `- --bulma-* custom properties increased: ${violation.actual} > baseline ${violation.baseline}`;
      }
      if (violation.kind === 'class-increase') {
        return `- Bulma class .${violation.name} (${violation.category}) increased: ${violation.actual} > baseline ${violation.baseline}`;
      }
      return `- Retired/disallowed Bulma class .${violation.name} detected (${violation.actual} occurrence${violation.actual === 1 ? '' : 's'})`;
    })
    .join('\n');
}

if (import.meta.main) {
  const baselinePath = resolve(import.meta.dir, 'bulma-ratchet-baseline.json');
  const appDir = resolve(import.meta.dir, '../app');
  const baseline = JSON.parse(readFileSync(baselinePath, 'utf8')) as BulmaRatchetBaseline;
  const result = checkBulmaRatchet(appDir, baseline);

  if (!result.ok) {
    console.error('Bulma ratchet check failed (ADR 0057):');
    console.error(formatRatchetViolations(result.violations));
    process.exit(1);
  }
}
