// Exercises the built document asset — the exact viewer.js the Flutter WebView
// loads — in a real DOM, and asserts what a reader gets: GitHub's Markdown
// blocks, embedded author HTML, resolved repository links, and nothing active
// from the author.
//
//   cd flutter/tool/document_viewer && bun run verify
//
// The Flutter-side bridge is mocked with the same policy Dart applies, so the
// resolution and blocking behaviour is asserted end to end rather than assumed.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { JSDOM } from 'jsdom';

const here = dirname(fileURLToPath(import.meta.url));
const asset = join(here, '..', '..', 'assets', 'document_viewer', 'viewer.js');

const dom = new JSDOM(
  '<!doctype html><html data-appearance="light"><body><article id="document" class="markdown-body" aria-busy="true"></article></body></html>',
  { url: 'about:blank' },
);

const { window } = dom;
for (const name of ['window', 'document', 'DOMParser', 'Node', 'Element', 'NodeFilter', 'getComputedStyle']) {
  globalThis[name] = window[name];
}

// The policy Dart owns, mirrored here so the bridge round trip is exercised:
// fragments stay, absolute links stay, anything script-like is dropped, and a
// repository-relative target is resolved against the document's own directory.
const BASE = 'https://github.com/owner/repo/blob/main/README.md';

function resolveDocumentUrls(values) {
  return values.map((value) => {
    if (!value) return null;
    if (value.startsWith('#')) return value;
    if (/^mailto:|^tel:|^https?:\/\//i.test(value)) return value;
    if (/^[a-z][a-z0-9+.-]*:/i.test(value)) return null; // javascript:, data:, file:
    const resolved = new URL(value, BASE);
    const relative = resolved.pathname.replace('/owner/repo/blob/main/', '');
    return /\.(png|jpe?g|gif|svg|webp)$/i.test(resolved.pathname)
      ? `https://raw.githubusercontent.com/owner/repo/main/${relative}`
      : `https://github.com/owner/repo/blob/main/${relative}`;
  });
}

const calls = [];
window.flutter_inappwebview = {
  callHandler(name, payload) {
    calls.push({ name, payload });
    if (name === 'resolveDocumentUrls') return Promise.resolve(resolveDocumentUrls(payload));
    return Promise.resolve(true);
  },
};

await import(asset);

const source = await readFile(join(here, 'sample.md'), 'utf8');
await window.gitpulseDocument.render({
  source,
  base: 'https://github.com/owner/repo/blob/main/README.md',
  strings: { copyCode: 'Copy', copied: 'Copied', plainText: 'Text' },
});

const root = window.document.getElementById('document');
const $ = (selector) => root.querySelector(selector);
const all = (selector) => Array.from(root.querySelectorAll(selector));

const checks = [];
function check(name, run) {
  try {
    run();
    checks.push(`ok   ${name}`);
  } catch (error) {
    checks.push(`FAIL ${name}: ${error.message}`);
    process.exitCode = 1;
  }
}

check('renders GitHub Markdown blocks', () => {
  assert.equal(all('h1').length, 1);
  assert.equal(all('h2').length, 2);
  assert.equal(all('h3').length, 1);
  assert.equal(all('table').length, 1);
  assert.equal(all('table th').length, 3);
  assert.equal(all('del').length + all('s').length, 1);
  assert.equal(all('strong').length >= 2, true);
  assert.equal(all('ol > li').length, 2);
  assert.equal(all('center').length, 1);
});

check('keeps embedded author HTML, including its layout', () => {
  assert.equal(all('details > summary').length, 1);
  assert.equal(all('kbd').length, 2);
  assert.equal($('div[align="center"]')?.getAttribute('align'), 'center');
  assert.equal($('div[align="center"] h3')?.textContent, 'Centred heading');
  assert.equal($('p[align="right"]')?.getAttribute('align'), 'right');
  assert.equal($('img[width="120"]')?.getAttribute('height'), '40');
});

check('renders task lists with disabled checkboxes', () => {
  const boxes = all('input[type="checkbox"]');
  assert.equal(boxes.length, 2);
  assert.equal(boxes.filter((box) => box.hasAttribute('checked')).length, 1);
  assert.equal(boxes.every((box) => box.hasAttribute('disabled')), true);
  assert.equal(all('ul.contains-task-list').length, 1);
});

check('renders GitHub alerts as their own blocks', () => {
  assert.deepEqual(
    all('.markdown-alert').map((node) => node.className),
    ['markdown-alert markdown-alert-note', 'markdown-alert markdown-alert-caution'],
  );
  assert.deepEqual(all('.markdown-alert-title').map((node) => node.textContent), [
    'Note',
    'Caution',
  ]);
  assert.equal(all('.markdown-alert')[0].textContent.includes('[!NOTE]'), false);
});

check('resolves repository-relative links and images', () => {
  assert.equal(
    $('a[href$="docs/guide.md"]')?.getAttribute('href'),
    'https://github.com/owner/repo/blob/main/docs/guide.md',
  );
  assert.equal(
    $('img[width="120"]')?.getAttribute('src'),
    'https://raw.githubusercontent.com/owner/repo/main/docs/hero.png',
  );
  assert.equal($('a[href="#a-table"]')?.getAttribute('href'), '#a-table');
  assert.equal(
    all('a').find((node) => node.textContent === 'absolute link')?.getAttribute('href'),
    'https://example.com/target',
  );
  assert.equal(
    $('img[src*="img.shields.io"]')?.getAttribute('src'),
    'https://img.shields.io/github/v/release/QingYunA/answer-me-with-html',
  );
});

check('adds heading ids so a document can link inside itself', () => {
  assert.deepEqual(
    all('h1, h2').map((node) => node.id),
    ['release-120', 'a-table', 'tasks'],
  );
});

check('highlights code blocks and gives each a copy action', () => {
  assert.equal(all('.code-block').length, 2);
  assert.equal(
    all('.code-block-language')
      .map((node) => node.textContent)
      .join(','),
    'js,Text',
  );
  assert.equal(all('.code-block-copy').every((node) => node.textContent === 'Copy'), true);
  assert.equal(all('.hljs-keyword').length + all('.hljs-number').length > 0, true);
  assert.equal($('.code-block code')?.textContent.includes('const answer = 42;'), true);
});

check('leaves nothing active from the author', () => {
  for (const selector of ['script', 'iframe', 'style', 'object', 'embed', 'form', 'base']) {
    assert.equal(all(selector).length, 0, `${selector} survived sanitizing`);
  }
  assert.equal(all('[onerror]').length, 0);
  assert.equal(all('[onclick]').length, 0);
  assert.equal(all('[style]').length, 0);
  assert.equal(
    all('a').filter((node) => (node.getAttribute('href') || '').startsWith('javascript:')).length,
    0,
  );
  assert.equal(all('img[src^="data:"]').length, 0);
  assert.equal(all('input[type="text"]').length, 0);
  assert.equal(window.__pwned, undefined);
});

check('reports the render to the host bridge', () => {
  assert.equal(calls.some((call) => call.name === 'documentRendered'), true);
  assert.equal(calls.some((call) => call.name === 'resolveDocumentUrls'), true);
});

check('copies a code block through the host bridge', () => {
  all('.code-block-copy')[0].dispatchEvent(new window.Event('click', { bubbles: true }));
  const copy = calls.find((call) => call.name === 'copyDocumentCode');
  assert.equal(copy?.payload, 'const answer = 42;\nconsole.log(answer);\n');
});

check('routes a link tap through the host bridge instead of navigating', () => {
  const link = all('a').find((node) => node.textContent === 'absolute link');
  const event = new window.MouseEvent('click', { bubbles: true, cancelable: true });
  link.dispatchEvent(event);
  assert.equal(event.defaultPrevented, true);
  assert.equal(
    calls.find((call) => call.name === 'openDocumentUrl')?.payload,
    'https://example.com/target',
  );
});

console.log(checks.join('\n'));
if (process.exitCode) {
  console.error(`\n${checks.filter((line) => line.startsWith('FAIL')).length} check(s) failed`);
}
