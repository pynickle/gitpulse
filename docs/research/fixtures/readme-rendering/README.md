# README rendering evidence

These are fixed document inputs for the accepted [Issue #136](https://github.com/pynickle/gitpulse/issues/136) rendering specification. They are evidence, not tests: implementation must execute the real renderer and assert visible behavior.

- `shield.svg`: complete Shields release badge captured on 2026-10-27, including scaled text and an embedded GitHub SVG logo. Source: <https://img.shields.io/github/v/release/QingYunA/answer-me-with-html?style=flat-square&logo=github&labelColor=16181d&color=2ea44f>. SHA-256: `6AD0E4EA1B38B56C82B9C0B6E94E2F15FA85B169D6FA25745018E166DF5A3F38`. Use these bytes rather than the live URL; versions and Star badges change over time.
- `text-transform.svg` and `text-unscaled.svg`: equivalent authored text sizes, used to expose the existing SVG transform fault independently of HTML and widget layout. Compare rendered glyph behavior with a fixed font, not SVG source characters.
- `layout.md`: a small author-layout input covering centered headings/paragraphs, explicit image dimensions, linked inline badges, table alignment, details, and code. A test resource server must map its example URLs to fixed bytes, including an extensionless SVG URL.
- `logo.svg`: a 64×64 fixed-size input with one currentColor half and one explicitly green half, for image geometry and theme behavior.

Load a deterministic, legally distributable test font. Windows-hosted experiments used Verdana or the Flutter test font and are not expected browser goldens. Test the embedded logo separately from text to avoid a false pass in which only the text is repaired. Keep any output pixel expectation scoped to the selected font and renderer version.
