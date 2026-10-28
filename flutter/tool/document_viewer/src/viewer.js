/*
 * The document renderer. Runs inside the app's document WebView and is the only
 * code in this app that turns Markdown into a page: markdown-it parses, the
 * GitHub extensions this app shows (tables, strikethrough, autolinks, task
 * lists, alerts, heading anchors) are added as rules, DOMPurify sanitizes in
 * the very engine that will parse the result, and highlight.js colours the code
 * blocks.
 *
 * Three things deliberately stay on the Flutter side, reached through the
 * bridge at the bottom of this file:
 *   - resolving a repository-relative link or image (one implementation, in
 *     Dart, shared with every other caller),
 *   - deciding what a link tap does,
 *   - writing to the real clipboard.
 *
 * Sanitizing in the render engine is what makes embedded author HTML safe:
 * the markup is filtered by the same parser that will later build the DOM, so
 * no second parser can disagree about what a tag means.
 */
import DOMPurify from 'dompurify';
import hljs from 'highlight.js/lib/common';
import MarkdownIt from 'markdown-it';

const ALERT_KINDS = {
  NOTE: 'note',
  TIP: 'tip',
  IMPORTANT: 'important',
  WARNING: 'warning',
  CAUTION: 'caution',
};

const ALERT_TITLES = {
  note: 'Note',
  tip: 'Tip',
  important: 'Important',
  warning: 'Warning',
  caution: 'Caution',
};

const ALERT_MARKER = /^\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\][ \t]*/i;
const TASK_MARKER = /^\[([ xX])\][ \t]+/;

/** `- [ ] task` / `- [x] done`, and the list that contains them. */
function taskLists(md) {
  md.core.ruler.after('inline', 'gitpulse_task_lists', (state) => {
    const { tokens } = state;
    const lists = [];
    for (let index = 0; index < tokens.length; index += 1) {
      const token = tokens[index];
      if (token.type === 'bullet_list_open' || token.type === 'ordered_list_open') {
        lists.push(token);
        continue;
      }
      if (token.type === 'bullet_list_close' || token.type === 'ordered_list_close') {
        lists.pop();
        continue;
      }
      if (token.type !== 'list_item_open') continue;
      const inline = tokens.slice(index + 1, index + 4).find((t) => t.type === 'inline');
      const first = inline?.children?.[0];
      if (!first || first.type !== 'text') continue;
      const match = TASK_MARKER.exec(first.content);
      if (!match) continue;
      first.content = first.content.slice(match[0].length);
      const checked = match[1].toLowerCase() === 'x';
      const box = new state.Token('html_inline', '', 0);
      box.content =
        `<input class="task-list-item-checkbox" type="checkbox" disabled` +
        `${checked ? ' checked' : ''}> `;
      inline.children.unshift(box);
      token.attrJoin('class', 'task-list-item');
      const list = lists[lists.length - 1];
      if (list) list.attrJoin('class', 'contains-task-list');
    }
    return true;
  });
}

/** `> [!NOTE]` and its four siblings, as GitHub renders them. */
function alerts(md) {
  // After `inline`: the marker lives in the paragraph's inline children, which
  // do not exist until that rule has tokenized them.
  md.core.ruler.after('inline', 'gitpulse_alerts', (state) => {
    const { tokens } = state;
    for (let index = 0; index < tokens.length; index += 1) {
      if (tokens[index].type !== 'blockquote_open') continue;
      let cursor = index + 1;
      while (
        cursor < tokens.length &&
        tokens[cursor].type !== 'paragraph_open' &&
        tokens[cursor].type !== 'blockquote_close'
      ) {
        cursor += 1;
      }
      if (tokens[cursor]?.type !== 'paragraph_open') continue;
      const inline = tokens[cursor + 1];
      const first = inline?.type === 'inline' ? inline.children?.[0] : null;
      if (!first || first.type !== 'text') continue;
      const match = ALERT_MARKER.exec(first.content);
      if (!match) continue;
      const kind = ALERT_KINDS[match[1].toUpperCase()];
      if (!kind) continue;
      first.content = first.content.slice(match[0].length);
      tokens[index].attrJoin('class', `markdown-alert markdown-alert-${kind}`);
      const title = new state.Token('html_block', '', 0);
      title.content = `<p class="markdown-alert-title">${ALERT_TITLES[kind]}</p>`;
      tokens.splice(cursor, 0, title);
      if (!first.content.trim() && inline.children.length <= 1) {
        // A bare `> [!NOTE]` leaves nothing to say in the paragraph itself.
        tokens[cursor + 1].hidden = true;
        tokens[cursor + 3].hidden = true;
      }
      index = cursor + 1;
    }
    return true;
  });
}

function slugify(text) {
  return text
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, '')
    .replace(/\s+/g, '-');
}

/** Heading ids, so `[jump](#install)` and the document's own anchors work. */
function headingAnchors(md) {
  const used = new Map();
  md.core.ruler.push('gitpulse_heading_anchors', (state) => {
    used.clear();
    for (let index = 0; index < state.tokens.length; index += 1) {
      const token = state.tokens[index];
      if (token.type !== 'heading_open') continue;
      const inline = state.tokens[index + 1];
      if (inline?.type !== 'inline') continue;
      const base = slugify(inline.content.replace(/<[^>]*>/g, '')) || 'section';
      const seen = used.get(base) ?? 0;
      used.set(base, seen + 1);
      token.attrSet('id', seen === 0 ? base : `${base}-${seen}`);
    }
    return true;
  });
}

/**
 * What a document may contain. This is GitHub's own shape — the tags its
 * renderer emits plus the ones authors legitimately embed — with every active
 * element, every URL-carrying attribute that is not a link or a resource, and
 * every inline style left out.
 */
const ALLOWED_TAGS = [
  'a', 'abbr', 'audio', 'b', 'bdi', 'bdo', 'blockquote', 'br', 'caption',
  'center', 'cite', 'code', 'dd', 'del', 'details', 'dfn', 'div', 'dl', 'dt',
  'em', 'figcaption', 'figure', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'hr', 'i',
  'img', 'input', 'ins', 'kbd', 'li', 'mark', 'ol', 'p', 'picture', 'pre', 'q',
  'rp', 'rt', 'ruby', 's', 'samp', 'small', 'source', 'span', 'strong', 'sub',
  'summary', 'sup', 'table', 'tbody', 'td', 'tfoot', 'th', 'thead', 'time',
  'tr', 'track', 'u', 'ul', 'var', 'video', 'wbr',
];

const ALLOWED_ATTR = [
  'align', 'alt', 'checked', 'cite', 'class', 'colspan', 'controls',
  'datetime', 'dir', 'disabled', 'height', 'href', 'id', 'lang', 'loop',
  'media', 'muted', 'open', 'playsinline', 'poster', 'preload', 'reversed',
  'rowspan', 'sizes', 'span', 'src', 'srcset', 'start', 'title', 'type',
  'width',
];

const SANITIZE = {
  ALLOWED_TAGS,
  ALLOWED_ATTR,
  ALLOW_DATA_ATTR: false,
  KEEP_CONTENT: true,
  // Everything here is either active content or a way to reach the network, the
  // file system, or another document on the page's behalf.
  FORBID_TAGS: [
    'base', 'embed', 'form', 'frame', 'frameset', 'iframe', 'link', 'meta',
    'noscript', 'object', 'script', 'style', 'template',
  ],
  FORBID_ATTR: ['action', 'autofocus', 'contenteditable', 'formaction', 'srcdoc', 'style', 'target'],
};

// `input` is only ever a task list's checkbox: an author's form control is not
// part of a document.
DOMPurify.addHook('uponSanitizeElement', (node, data) => {
  if (data.tagName !== 'input') return;
  const type = (node.getAttribute('type') || '').toLowerCase();
  if (type !== 'checkbox') {
    node.parentNode?.removeChild(node);
    return;
  }
  node.setAttribute('disabled', '');
});

// A link that survives is a link the app opens, never one the page navigates to.
DOMPurify.addHook('afterSanitizeAttributes', (node) => {
  if (node.tagName === 'A') {
    node.removeAttribute('target');
    node.setAttribute('rel', 'noopener noreferrer');
  }
});

function createMarkdown() {
  return new MarkdownIt({ html: true, linkify: true, breaks: false, typographer: false })
    .use(taskLists)
    .use(alerts)
    .use(headingAnchors);
}

function callBridge(name, payload) {
  const host = window.flutter_inappwebview;
  if (!host || typeof host.callHandler !== 'function') return null;
  try {
    return host.callHandler(name, payload);
  } catch (error) {
    console.error(`bridge ${name} failed`, error);
    return null;
  }
}

function fallbackResolve(value, base) {
  try {
    const url = new URL(value, base || 'https://github.com/');
    return ['http:', 'https:', 'mailto:'].includes(url.protocol) ? url.toString() : null;
  } catch {
    return null;
  }
}

const fallbackResolveAll = (values, base) =>
  values.map((value) => fallbackResolve(value, base));

const bridge = {
  resolve(values, base) {
    const pending = callBridge('resolveDocumentUrls', values);
    if (pending && typeof pending.then === 'function') {
      // The host answers with one address per target, in order. Anything else —
      // a handler that was not ready yet, a failed call — falls back to this
      // page's own resolver rather than dropping the address: a document must
      // never lose its links and images because a bridge call went wrong.
      return pending
        .then((answer) =>
          Array.isArray(answer) && answer.length === values.length
            ? answer
            : fallbackResolveAll(values, base)
        )
        .catch(() => fallbackResolveAll(values, base));
    }
    return Promise.resolve(fallbackResolveAll(values, base));
  },
  open(href) {
    if (!callBridge('openDocumentUrl', href)) window.location.href = href;
  },
  copy(text) {
    if (!callBridge('copyDocumentCode', text) && navigator.clipboard) {
      navigator.clipboard.writeText(text).catch(() => {});
    }
  },
  rendered() {
    callBridge('documentRendered');
  },
  failed(message) {
    callBridge('documentFailed', String(message));
  },
};

/** Every element whose URL has to be resolved against the repository. */
function resourceTargets(root) {
  const targets = [];
  for (const element of root.querySelectorAll('[href]')) {
    targets.push({ element, name: 'href', value: element.getAttribute('href') });
  }
  for (const element of root.querySelectorAll('[src]')) {
    targets.push({ element, name: 'src', value: element.getAttribute('src') });
  }
  for (const element of root.querySelectorAll('[poster]')) {
    targets.push({ element, name: 'poster', value: element.getAttribute('poster') });
  }
  for (const element of root.querySelectorAll('[srcset]')) {
    const candidates = element
      .getAttribute('srcset')
      .split(',')
      .map((candidate) => candidate.trim())
      .filter(Boolean);
    targets.push({ element, name: 'srcset', value: candidates });
  }
  return targets;
}

async function resolveResources(root, base) {
  const targets = resourceTargets(root);
  if (!targets.length) return;
  const flat = targets.flatMap((target) => (Array.isArray(target.value) ? target.value : [target.value]));
  const answers = await bridge.resolve(flat, base);
  let cursor = 0;
  for (const target of targets) {
    const values = Array.isArray(target.value) ? target.value : [target.value];
    const resolved = values
      .map((original, index) => {
        const answer = answers[cursor + index];
        return answer ? [answer, original] : null;
      })
      .filter(Boolean);
    cursor += values.length;
    if (!resolved.length) {
      target.element.removeAttribute(target.name);
      continue;
    }
    target.element.setAttribute(
      target.name,
      Array.isArray(target.value)
        ? resolved.map(([answer, original]) => original.replace(original.split(/\s+/)[0], answer)).join(', ')
        : resolved[0][0]
    );
  }
}

function buildCodeBlock(code, language, strings) {
  const block = document.createElement('div');
  block.className = 'code-block';
  const header = document.createElement('div');
  header.className = 'code-block-header';
  const label = document.createElement('span');
  label.className = 'code-block-language';
  label.textContent = language || strings.plainText;
  const copy = document.createElement('button');
  copy.type = 'button';
  copy.className = 'code-block-copy';
  copy.textContent = strings.copyCode;
  copy.addEventListener('click', () => {
    bridge.copy(code.textContent);
    copy.textContent = strings.copied;
    window.setTimeout(() => {
      copy.textContent = strings.copyCode;
    }, 1500);
  });
  header.append(label, copy);
  const pre = code.parentElement;
  pre.replaceWith(block);
  block.append(header, pre);
  return block;
}

function highlightAndDecorate(root, strings) {
  for (const code of root.querySelectorAll('pre > code')) {
    const languageClass = Array.from(code.classList).find((name) => name.startsWith('language-'));
    const language = languageClass ? languageClass.slice('language-'.length) : '';
    const highlighted = language && hljs.getLanguage(language);
    if (highlighted) {
      try {
        code.innerHTML = hljs.highlight(code.textContent, {
          language,
          ignoreIllegals: true,
        }).value;
      } catch (error) {
        console.warn('highlight failed', language, error);
      }
    }
    // An author's fence name is only a label when the app can actually colour
    // it; `nohighlight` and friends say nothing a reader needs.
    buildCodeBlock(code, highlighted ? language : '', strings);
  }
}

function wireLinks(root) {
  root.addEventListener('click', (event) => {
    const anchor = event.target instanceof Element ? event.target.closest('a[href]') : null;
    if (!anchor) return;
    const href = anchor.getAttribute('href') || '';
    if (href.startsWith('#')) return;
    event.preventDefault();
    bridge.open(href);
  });
}

let markdown = null;
let container = null;

async function render(payload) {
  const strings = payload.strings || {};
  markdown = markdown || createMarkdown();
  container = container || document.getElementById('document');
  if (!container) return;
  try {
    const html = DOMPurify.sanitize(markdown.render(payload.source || ''), SANITIZE);
    const parsed = new DOMParser().parseFromString(`<body>${html}</body>`, 'text/html');
    await resolveResources(parsed.body, payload.base);
    const fragment = document.createDocumentFragment();
    for (const child of Array.from(parsed.body.childNodes)) {
      fragment.append(document.importNode(child, true));
    }
    container.replaceChildren(fragment);
    highlightAndDecorate(container, {
      copyCode: strings.copyCode || 'Copy',
      copied: strings.copied || 'Copied',
      plainText: strings.plainText || 'Text',
    });
    container.removeAttribute('aria-busy');
    bridge.rendered();
  } catch (error) {
    console.error('document render failed', error);
    container.removeAttribute('aria-busy');
    bridge.failed(error?.message || String(error));
  }
}

wireLinks(document);

window.gitpulseDocument = { render };
