/**
 * Fill `{name}` placeholders the way the app's i18n runtime does.
 * Tests keep their own catalog lookup; only the interpolation is shared.
 */
export function interpolateTranslation(template: string, params?: Record<string, unknown>): string {
  return template.replace(/\{(\w+)\}/g, (_, name: string) => {
    const param = params?.[name];
    if (typeof param === 'string') return param;
    if (typeof param === 'number' || typeof param === 'boolean') return String(param);
    return '';
  });
}
