import xss from 'xss';

export function sanitizeHtml(dirty: string | null | undefined): string {
  if (!dirty) {
    return '';
  }

  return xss(dirty, {
    whiteList: {
      a: ['href', 'title'],
      b: [],
      code: [],
      em: [],
      i: [],
      s: [],
      strong: [],
      sub: [],
      sup: [],
      u: [],
    },
    stripIgnoreTag: true,
    stripIgnoreTagBody: ['script', 'style'],
  });
}
