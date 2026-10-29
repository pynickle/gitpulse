import { Parser } from 'htmlparser2';
import { createMarkdownExit } from 'markdown-exit';

const markdown = createMarkdownExit({ html: true });
const taskMarker = /^\[[ xX]\][ \t]+/;

// Checkbox markers describe list controls, not searchable note content.
markdown.core.ruler.before('inline', 'release_note_search_tasks', ({ tokens }) => {
  for (let index = 2; index < tokens.length; index++) {
    const inline = tokens[index]!;
    if (
      inline.type === 'inline' &&
      tokens[index - 1]!.type === 'paragraph_open' &&
      tokens[index - 2]!.type === 'list_item_open'
    ) {
      inline.content = inline.content.replace(taskMarker, '');
    }
  }
});

// The default image-alt renderer omits inline code. Keep that readable content.
const renderImageText = markdown.renderer.renderInlineAsText.bind(markdown.renderer);
markdown.renderer.renderInlineAsText = (tokens, options, env) => {
  for (const token of tokens) {
    if (token.type === 'code_inline') token.type = 'text';
  }
  return renderImageText(tokens, options, env);
};

const blockTags = new Set([
  'address',
  'article',
  'aside',
  'blockquote',
  'br',
  'caption',
  'dd',
  'div',
  'dl',
  'dt',
  'figcaption',
  'figure',
  'footer',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'header',
  'hr',
  'li',
  'main',
  'ol',
  'p',
  'pre',
  'section',
  'table',
  'td',
  'th',
  'tr',
  'ul',
]);

/** Readable release-note content, normalized for timeline search. */
export function releaseNoteSearchText(source: string): string {
  if (!source) return '';
  const text: string[] = [];
  let hiddenDepth = 0;
  // Parse off-DOM; escaping code first preserves literal HTML in code examples.
  const parser = new Parser({
    onopentag(name, attributes) {
      if (name === 'script' || name === 'style') hiddenDepth++;
      if (hiddenDepth) return;
      if (blockTags.has(name)) text.push(' ');
      if (name === 'img' && attributes.alt) text.push(' ', attributes.alt, ' ');
    },
    ontext(value) {
      if (!hiddenDepth) text.push(value);
    },
    onclosetag(name) {
      if (name === 'script' || name === 'style') hiddenDepth = Math.max(0, hiddenDepth - 1);
      if (!hiddenDepth && blockTags.has(name)) text.push(' ');
    },
  });
  parser.end(markdown.render(source));
  return text.join('').toLowerCase().replace(/\s+/g, ' ').trim();
}
