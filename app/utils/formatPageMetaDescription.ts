export default function formatPageMetaDescription(value?: string | null) {
  if (!value) return '';

  let truncated = value.slice(0, 160);

  // Check if we split a surrogate pair at the boundary
  const lastCharCode = truncated.charCodeAt(truncated.length - 1);
  if (lastCharCode >= 0xd800 && lastCharCode <= 0xdbff) {
    // High surrogate without its pair - remove it
    truncated = truncated.slice(0, -1);
  }

  return truncated.replace(/\n/g, ' ');
}
