import { describe, expect, test } from 'bun:test';

import { getAutocompletePanelStyle } from '../app/composables/useAutocompletePanel';

const anchorRect = {
  left: 100,
  top: 300,
  bottom: 380,
  width: 500,
};

describe('autocomplete panel positioning', () => {
  test('keeps existing anchor-left positioning when no cursor anchor is provided', () => {
    const style = getAutocompletePanelStyle({
      anchorRect,
      viewportWidth: 800,
      viewportHeight: 600,
      gap: 4,
      viewportMargin: 8,
      minWidth: 240,
      maxWidth: 360,
      maxHeight: 280,
      minHeight: 120,
    });

    expect(style.left).toBe('100px');
    expect(style.top).toBe('384px');
    expect(style.width).toBe('360px');
  });

  test('uses the inline anchor x coordinate when one is provided', () => {
    const style = getAutocompletePanelStyle({
      anchorRect,
      inlineAnchor: {
        x: 260,
        y: 320,
        height: 20,
      },
      viewportWidth: 800,
      viewportHeight: 600,
      gap: 4,
      viewportMargin: 8,
      minWidth: 240,
      maxWidth: 360,
      maxHeight: 280,
      minHeight: 120,
    });

    expect(style.left).toBe('260px');
    expect(style.top).toBe('344px');
    expect(style.width).toBe('360px');
  });

  test('pushes inline-anchored panels left when they would overflow the viewport', () => {
    const style = getAutocompletePanelStyle({
      anchorRect,
      inlineAnchor: {
        x: 700,
        y: 320,
        height: 20,
      },
      viewportWidth: 800,
      viewportHeight: 600,
      gap: 4,
      viewportMargin: 8,
      minWidth: 240,
      maxWidth: 360,
      maxHeight: 280,
      minHeight: 120,
    });

    expect(style.left).toBe('432px');
    expect(style.top).toBe('344px');
  });
});
