import { AtRule } from 'postcss';
import type { Node, Plugin, Root, Rule } from 'postcss';

/**
 * The hover gate (ADR 0049).
 *
 * A touch has no pointer to leave with, so a `:hover` rule that a tap applies is a
 * tint the reader cannot shake off — a Hold. This step moves every hover selector
 * inside the hover-capable query, so a stylesheet that forgets the `hover-only`
 * mixin still cannot ship one, and a component added tomorrow is covered without
 * its author knowing the rule exists.
 *
 * The query is the one `app/assets/scss/_pointer.scss` emits, and a rule already
 * inside it is left alone, so the explicit mixin and this gate compose instead of
 * nesting. `modules/hover-gate/index.ts` is what installs it.
 */
export const HOVER_QUERY = '(hover: hover) and (pointer: fine)';

const HOVER = ':hover';

/**
 * Splits a selector list on its top-level commas only, so a comma inside
 * `:is(a, b)` or `[data-x='a,b']` does not split an arm in half.
 */
function selectorArms(selector: string): string[] {
  const arms: string[] = [];
  let depth = 0;
  let start = 0;

  for (let index = 0; index < selector.length; index += 1) {
    const character = selector[index];
    if (character === '(' || character === '[') depth += 1;
    else if (character === ')' || character === ']') depth -= 1;
    else if (character === ',' && depth === 0) {
      arms.push(selector.slice(start, index));
      start = index + 1;
    }
  }
  arms.push(selector.slice(start));

  return arms.map((arm) => arm.trim()).filter(Boolean);
}

function collapse(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function ancestorAtRule(rule: Rule, matches: (atRule: AtRule) => boolean): boolean {
  // `Node.parent` is typed as a container or a document, and only the container
  // side can be an at-rule, so the walk is over plain nodes.
  let node = rule.parent as Node | undefined;
  while (node) {
    if (node.type === 'atrule' && matches(node as AtRule)) return true;
    node = node.parent as Node | undefined;
  }
  return false;
}

function isGated(rule: Rule): boolean {
  const wanted = collapse(HOVER_QUERY);
  return ancestorAtRule(
    rule,
    (atRule) => atRule.name === 'media' && collapse(atRule.params).includes(wanted)
  );
}

function wrap(rule: Rule, selector: string): AtRule {
  const media = new AtRule({ name: 'media', params: HOVER_QUERY });
  media.append(rule.clone({ selector }));
  return media;
}

export function hoverGate(): Plugin {
  return {
    postcssPlugin: 'gitpulse-hover-gate',

    Once(root: Root) {
      root.walkRules((rule) => {
        if (!rule.selector?.includes(HOVER)) return;
        // A keyframe step is a percentage or a keyword, never a hover target; a rule
        // already inside the gate is the mixin's own output.
        if (ancestorAtRule(rule, (atRule) => /keyframes$/i.test(atRule.name))) return;
        if (isGated(rule)) return;

        const arms = selectorArms(rule.selector);
        const hoverArms = arms.filter((arm) => arm.includes(HOVER));
        const restArms = arms.filter((arm) => !arm.includes(HOVER));

        // A list that mixes a hover arm with something else is split rather than
        // gated whole: gating `:focus-visible` alongside it would remove the only
        // evidence of focus for a keyboard reader on a hover-less device.
        if (restArms.length === 0) {
          rule.replaceWith(wrap(rule, rule.selector));
          return;
        }

        rule.replaceWith(
          wrap(rule, hoverArms.join(', ')),
          rule.clone({ selector: restArms.join(', ') })
        );
      });
    },
  };
}
