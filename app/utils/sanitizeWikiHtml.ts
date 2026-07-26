import xss from 'xss';

/**
 * Sanitizer for GitHub-rendered wiki bodies. A richer allowlist than
 * `sanitizeHtml` (which targets inline user snippets) because wiki bodies are
 * full documents: headings, tables, images, code blocks, task lists. Same xss
 * pipeline — script/style/iframe and event handlers never survive.
 */

const BLOCK_ATTRS = ['class'];
const CELL_ATTRS = ['class', 'align', 'colspan', 'rowspan'];

export function sanitizeWikiHtml(dirty: string | null | undefined): string {
  if (!dirty) {
    return '';
  }

  return xss(dirty, {
    whiteList: {
      a: ['href', 'title', 'name', 'id', 'class'],
      b: [],
      blockquote: BLOCK_ATTRS,
      br: [],
      caption: [],
      code: BLOCK_ATTRS,
      dd: [],
      del: [],
      details: ['open'],
      div: BLOCK_ATTRS,
      dl: [],
      dt: [],
      em: [],
      h1: ['id', 'class'],
      h2: ['id', 'class'],
      h3: ['id', 'class'],
      h4: ['id', 'class'],
      h5: ['id', 'class'],
      h6: ['id', 'class'],
      hr: [],
      i: [],
      img: ['src', 'alt', 'title', 'width', 'height', 'class'],
      input: ['type', 'checked', 'disabled', 'class'],
      ins: [],
      kbd: [],
      li: BLOCK_ATTRS,
      ol: ['start', 'class'],
      p: BLOCK_ATTRS,
      picture: [],
      pre: BLOCK_ATTRS,
      s: [],
      section: BLOCK_ATTRS,
      source: ['srcset', 'media', 'type'],
      span: BLOCK_ATTRS,
      strong: [],
      sub: [],
      summary: [],
      sup: [],
      table: BLOCK_ATTRS,
      tbody: [],
      td: CELL_ATTRS,
      tfoot: [],
      th: CELL_ATTRS,
      thead: [],
      tr: [],
      u: [],
      ul: BLOCK_ATTRS,
    },
    stripIgnoreTag: true,
    stripIgnoreTagBody: ['script', 'style', 'svg'],
  });
}

export default sanitizeWikiHtml;
