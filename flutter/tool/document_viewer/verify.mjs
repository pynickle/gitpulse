// Exercises the built document asset — the exact viewer.js the Flutter WebView
// loads — in a real DOM, and asserts what a reader gets: GitHub's Markdown
// blocks, embedded author HTML, resolved repository links, and nothing active
// from the author.
//
//   cd flutter/tool/document_viewer && bun run verify
//
// Shared protocol fixtures cover transport. Preview policy simulations below do
// not prove Dart policy; the real host tests exercise that policy separately.
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
window.scrollTo = window.scrollBy = () => {};
for (const name of ['window', 'document', 'DOMParser', 'Node', 'Element', 'NodeFilter', 'getComputedStyle']) {
  globalThis[name] = window[name];
}

// The policy Dart owns, mirrored here so the bridge round trip is exercised:
// fragments stay, absolute links stay, anything script-like is dropped, and a
// repository-relative target is resolved against the document's own directory.
const BASE = 'https://github.com/owner/repo/blob/main/README.md';

function resolveDocumentUrls(values) {
  return values.map(({value, image}) => {
    if (!value) return null;
    if (value.startsWith('#')) return value;
    if (/^mailto:|^tel:|^https?:\/\//i.test(value)) return value;
    if (/^[a-z][a-z0-9+.-]*:/i.test(value)) return null; // javascript:, data:, file:
    const resolved = new URL(value, BASE);
    const relative = resolved.pathname.replace('/owner/repo/blob/main/', '');
    return image
      ? `https://raw.githubusercontent.com/owner/repo/main/${relative}`
      : `https://github.com/owner/repo/blob/main/${relative}`;
  });
}

const calls = [];
window.flutter_inappwebview = {
  callHandler(name, payload) {
    calls.push({ name, payload });
    if (name === 'resolveDocumentUrls') return Promise.resolve(resolveDocumentUrls(payload.targets));
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

async function acheck(name, run) {
  try { await run(); checks.push(`ok   ${name}`); }
  catch (error) { checks.push(`FAIL ${name}: ${error.message}`); process.exitCode = 1; }
}
await acheck('temporarily unavailable addresses stay disabled without losing formatting', async () => {
  window.flutter_inappwebview.callHandler = () => Promise.resolve(undefined);
  await window.gitpulseDocument.render({source: '**Readable** [Link](guide.md) ![Author alt](chart)', base: BASE});
  assert.equal($('strong').textContent, 'Readable');
  assert.equal($('a').hasAttribute('href'), false);
  assert.equal($('img').hasAttribute('src'), false);
  assert.equal($('img').alt, 'Author alt');
});
await acheck('real renderer sends the shared protocol and preserves resource kinds', async () => {
  const fixture = JSON.parse(await readFile(join(here, 'protocol.json'), 'utf8'));
  let sent;
  window.flutter_inappwebview.callHandler = (name, payload) => {
    if (name !== 'resolveDocumentUrls') return Promise.resolve(true);
    sent = JSON.parse(JSON.stringify(payload));
    return Promise.resolve(payload.targets.map((target) => fixture.answers[fixture.targets.findIndex((item) => item.value === target.value && item.image === target.image)]));
  };
  await window.gitpulseDocument.render({base: fixture.base, source: '[Guide](../guide.md) ![Chart](images/chart) [Install](#install) [Absolute](https://example.com/a)'});
  assert.deepEqual(sent, {base: fixture.base, targets: [0, 2, 3, 1].map((i) => fixture.targets[i])});
  assert.equal($('img').getAttribute('src'), fixture.answers[1]);
});

await acheck('retries only transient candidates and keeps successful DOM and refused URLs', async () => {
  let attempts = 0;
  window.flutter_inappwebview.callHandler = (name, payload) => {
    if (name !== 'resolveDocumentUrls') return Promise.resolve(true);
    attempts++;
    if (attempts === 1) return Promise.resolve(['https://example.com/ok', null, {transient: true}]);
    assert.deepEqual(payload.targets, [{value: 'image', image: true}]);
    return Promise.resolve(['https://example.com/restored.png']);
  };
  await window.gitpulseDocument.render({identity: 'retry', base: BASE, source: '**Body** [Success](ok) [Refused](no) ![Alt](image)'});
  const link = $('a');
  assert.equal(link.getAttribute('href'), 'https://example.com/ok');
  assert.equal(all('a')[1].hasAttribute('href'), false);
  assert.equal($('img').alt, 'Alt');
  await new Promise((resolve) => setTimeout(resolve, 1100));
  assert.equal(attempts, 2);
  assert.equal($('a'), link);
  assert.equal($('img').getAttribute('src'), 'https://example.com/restored.png');
  assert.equal(all('a')[1].hasAttribute('href'), false);
});

await acheck('updates the mounted document presentation, content and context', async () => {
  window.flutter_inappwebview.callHandler = (name, payload) => Promise.resolve(name === 'resolveDocumentUrls' ? payload.targets.map(() => payload.base + '/resolved') : true);
  await window.gitpulseDocument.render({identity: 'same', source: '# Before', base: BASE});
  await window.gitpulseDocument.render({identity: 'same', source: '# After\n\n```\ncode\n```\n[New](target)', base: 'https://new.example', language: 'zh', dark: true,
    css: ':root{--gp-font-size:30px}', strings: {copyCode: '复制', plainText: '文本'}});
  assert.equal($('h1').textContent, 'After');
  assert.equal($('a').getAttribute('href'), 'https://new.example/resolved');
  assert.equal(document.documentElement.lang, 'zh');
  assert.equal(document.documentElement.dataset.appearance, 'dark');
  assert.equal(document.getElementById('document-presentation').textContent, ':root{--gp-font-size:30px}');
  assert.equal($('.code-block-copy').textContent, '复制');
});

await acheck('late address replies cannot overwrite a newer document', async () => {
  let release;
  window.flutter_inappwebview.callHandler = (name) => name === 'resolveDocumentUrls' ? new Promise((resolve) => { release = resolve; }) : Promise.resolve(true);
  const old = window.gitpulseDocument.render({identity: 'old', source: '[Old](old)', base: BASE});
  await window.gitpulseDocument.render({identity: 'new', source: '# New', base: BASE});
  release(['https://example.com/old']);
  await old;
  assert.equal($('h1').textContent, 'New');
  assert.equal($('a'), null);
});

await acheck('render failures report to Dart and subsequent valid updates render', async () => {
  const failed = [];
  window.flutter_inappwebview.callHandler = (name, payload) => { if (name === 'documentFailed') failed.push(payload); return Promise.resolve(true); };
  await window.gitpulseDocument.render({source: {invalid: true}, base: BASE});
  assert.equal(failed.length, 1);
  await window.gitpulseDocument.render({source: '# Recovered', base: BASE});
  assert.equal($('h1').textContent, 'Recovered');
});

// jsdom has no layout. Controlled rectangles verify anchor selection and scroll
// correction, not platform geometry; Android still needs acceptance.
await acheck('preserves paragraphs across reflow, chooses a neighbour after removal, resets new documents', async () => {
  let scroll = 0;
  let height = 100;
  const original = window.Element.prototype.getBoundingClientRect;
  window.Element.prototype.getBoundingClientRect = function () {
    const blocks = Array.from(root.querySelectorAll('p'));
    const top = blocks.indexOf(this) * height - scroll;
    return {top, bottom: top + height};
  };
  window.scrollTo = (_, y) => { scroll = y; };
  window.scrollBy = (_, y) => { scroll += y; };
  const render = (source, identity = 'reading') => window.gitpulseDocument.render({source, identity, base: BASE});
  try {
    await render('Alpha\n\nBravo\n\nCharlie');
    scroll = 110;
    await render('Inserted\n\nAlpha\n\nBravo\n\nCharlie');
    assert.equal(scroll, 210);
    // Style reflow occurs when the new DOM is installed, after old geometry is captured.
    const style = document.getElementById('document-presentation');
    const textContent = Object.getOwnPropertyDescriptor(window.Node.prototype, 'textContent');
    Object.defineProperty(style, 'textContent', {configurable: true, set(value) { height = 200; textContent.set.call(this, value); }});
    await render('Inserted\n\nAlpha\n\nBravo\n\nCharlie');
    assert.equal(scroll, 410);
    await render('Inserted\n\nAlpha\n\nCharlie');
    assert.equal(root.querySelectorAll('p')[Math.floor(scroll / height)].textContent, 'Alpha');
    await render('Other', 'another');
    assert.equal(scroll, 0);
    delete style.textContent;
  } finally { window.Element.prototype.getBoundingClientRect = original; }
});
await acheck('presentation updates retain successful URLs while the bridge is unavailable', async () => {
  window.flutter_inappwebview.callHandler = (name, payload) => Promise.resolve(name === 'resolveDocumentUrls' ? payload.targets.map(() => 'https://example.com/ok') : true);
  const payload = {source: '[Working](target)', identity: 'stable', base: BASE};
  await window.gitpulseDocument.render(payload);
  const link = $('a');
  window.flutter_inappwebview.callHandler = () => Promise.reject(new Error('offline'));
  await window.gitpulseDocument.render({...payload, dark: true});
  assert.equal($('a'), link);
  assert.equal(link.getAttribute('href'), 'https://example.com/ok');
  window.flutter_inappwebview.callHandler = () => Promise.resolve(true);
});

await acheck('nested and repeated paragraphs keep the visible occurrence, including a delayed update', async () => {
  let scroll = 0;
  const original = window.Element.prototype.getBoundingClientRect;
  window.Element.prototype.getBoundingClientRect = function () {
    const leaves = Array.from(root.querySelectorAll('p'));
    const top = leaves.indexOf(this) * 100 - scroll;
    return this.tagName === 'BLOCKQUOTE' ? {top: -scroll, bottom: 1000-scroll} : {top, bottom: top+100};
  };
  window.scrollTo = (_, y) => {scroll = y;};
  window.scrollBy = (_, y) => {scroll += y;};
  const source = '> Repeat\n>\n> Middle\n>\n> Repeat\n>\n> Tail';
  try {
    await window.gitpulseDocument.render({source, identity: 'nested', base: BASE});
    scroll = 210;
    await window.gitpulseDocument.render({source, identity: 'nested', base: BASE, dark: true});
    assert.equal(scroll, 210);
    let finish;
    window.flutter_inappwebview.callHandler = (name) => name === 'resolveDocumentUrls' ? new Promise((resolve) => { finish = resolve; }) : Promise.resolve(true);
    const pending = window.gitpulseDocument.render({source: source + '\n\n[Link](target)', identity: 'nested', base: BASE});
    scroll = 310;
    finish(['https://example.com/target']);
    await pending;
    assert.equal(scroll, 310, 'the reader can move while the address bridge is pending');
  } finally { window.Element.prototype.getBoundingClientRect = original; }
});
await acheck('rejected address calls recover automatically and image recovery preserves the reading paragraph', async () => {
  let scroll = 0;
  let attempts = 0;
  const original = window.Element.prototype.getBoundingClientRect;
  window.Element.prototype.getBoundingClientRect = function () {
    const index = Array.from(root.querySelectorAll('p')).indexOf(this);
    const extra = root.querySelector('img')?.hasAttribute('src') && index > 0 ? 200 : 0;
    const top = index * 100 + extra - scroll;
    return {top, bottom: top + 100};
  };
  window.scrollTo = (_, y) => {scroll = y;};
  window.scrollBy = (_, y) => {scroll += y;};
  window.flutter_inappwebview.callHandler = (name) => {
    if (name !== 'resolveDocumentUrls') return Promise.resolve(true);
    attempts++;
    return attempts === 1 ? Promise.reject(new Error('temporary')) : Promise.resolve(['https://example.com/image.png']);
  };
  try {
    await window.gitpulseDocument.render({source: '![Alt](image)\n\nReading\n\nNext', identity: 'image-recovery', base: BASE});
    scroll = 110;
    window.dispatchEvent(new window.Event('scroll'));
    await new Promise((resolve) => setTimeout(resolve, 1100));
    assert.equal($('img').getAttribute('src'), 'https://example.com/image.png');
    assert.equal(scroll, 310);
    $('img').dispatchEvent(new window.Event('load'));
    assert.equal(scroll, 310);
    assert.equal(attempts, 2);
  } finally {window.Element.prototype.getBoundingClientRect = original;}
});
console.log(checks.join('\n'));
window.close();
