import { expect, test } from 'bun:test';

import { releaseNoteSearchText } from '../shared/utils/release-note-search-text';

test.each([
  ['', ''],
  ['  ', ''],
  ['修复 **登录** 问题', '修复 登录 问题'],
  ['# First\n\nSecond\n\n- Third', 'first second third'],
  ['[the docs](https://example.com/HIDDENPATH "HIDDENTITLE")', 'the docs'],
  ['![badge](https://img.example/HIDDENSRC "HIDDENTITLE")', 'badge'],
  ['before![badge](https://img.example/HIDDENSRC)after', 'before badge after'],
  ['before<img src="HIDDENSRC" alt="badge">after', 'before badge after'],
  ['<img src="HIDDENSRC" alt="RawAlt" title="HIDDENTITLE">', 'rawalt'],
  [
    '<details open><summary>RawLabel</summary><p>Visible body</p></details>',
    'rawlabel visible body',
  ],
  ['<p>Before &amp; after</p><!-- HIDDENCOMMENT -->', 'before & after'],
  ['<script>HIDDENSCRIPT</script>\n<style>HIDDENSTYLE</style>\n\nVisible', 'visible'],
  ['`<img src="literal">`', '<img src="literal">'],
  ['```html\n<div>code sample</div>\n```', '<div>code sample</div>'],
  ['| One | Two |\n| --- | --- |\n| Three | Four |', 'one two three four'],
  ['- [x] Done\n- [ ] Pending', 'done pending'],
  ['1. [X] Done\n2. [ ] Pending', 'done pending'],
  ['- \\[x] Literal\n- `[ ]` Code', '[x] literal [ ] code'],
  ['[x] Plain paragraph', '[x] plain paragraph'],
  ['![*strong* **alt** `code`](https://example.com/HIDDENSRC)', 'strong alt code'],
])('extracts readable search text from %j', (source, expected) => {
  expect(releaseNoteSearchText(source!)).toBe(expected!);
});
