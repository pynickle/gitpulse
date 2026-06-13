export default function formatPageMetaDescription(value?: string | null) {
  return value ? value.slice(0, 160).replace(/\n/g, ' ') : '';
}
