const mirroredTextareaStyleProperties = [
  'borderBottomWidth',
  'borderLeftWidth',
  'borderRightWidth',
  'borderTopWidth',
  'boxSizing',
  'fontFamily',
  'fontFeatureSettings',
  'fontKerning',
  'fontSize',
  'fontStretch',
  'fontStyle',
  'fontVariant',
  'fontWeight',
  'letterSpacing',
  'lineHeight',
  'paddingBottom',
  'paddingLeft',
  'paddingRight',
  'paddingTop',
  'tabSize',
  'textAlign',
  'textIndent',
  'textTransform',
  'wordBreak',
] as const;

interface TextareaCaretAnchorRect {
  x: number;
  y: number;
  height: number;
}

export default function getTextareaCaretAnchorRect(
  textarea: HTMLTextAreaElement,
  caretIndex: number
): TextareaCaretAnchorRect | null {
  if (typeof document === 'undefined' || typeof window === 'undefined') {
    return null;
  }

  const computedStyle = window.getComputedStyle(textarea);
  const textareaRect = textarea.getBoundingClientRect();
  const mirror = document.createElement('div');
  const marker = document.createElement('span');
  const boundedIndex = Math.min(Math.max(caretIndex, 0), textarea.value.length);

  for (const property of mirroredTextareaStyleProperties) {
    mirror.style[property] = computedStyle[property];
  }

  mirror.style.position = 'absolute';
  mirror.style.left = `${textareaRect.left + window.scrollX}px`;
  mirror.style.top = `${textareaRect.top + window.scrollY}px`;
  mirror.style.width = `${textareaRect.width}px`;
  mirror.style.height = `${textareaRect.height}px`;
  mirror.style.overflow = 'hidden';
  mirror.style.pointerEvents = 'none';
  mirror.style.visibility = 'hidden';
  mirror.style.whiteSpace = 'pre-wrap';
  mirror.style.overflowWrap = 'break-word';
  mirror.style.wordWrap = 'break-word';

  mirror.textContent = textarea.value.slice(0, boundedIndex);
  marker.textContent = textarea.value[boundedIndex] ?? '\u200b';
  mirror.append(marker);

  document.body.append(mirror);

  try {
    const markerRect = marker.getBoundingClientRect();
    const lineHeight = parseFloat(computedStyle.lineHeight);
    const height = Number.isFinite(lineHeight) ? lineHeight : markerRect.height;

    return {
      x: markerRect.left - textarea.scrollLeft,
      y: markerRect.top - textarea.scrollTop,
      height,
    };
  } finally {
    mirror.remove();
  }
}
