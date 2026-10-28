// Preview-only address simulation. Application policy belongs exclusively to Dart.
window.flutter_inappwebview = {
  async callHandler(name, payload) {
    if (name === 'resolveDocumentUrls') return payload.targets.map(({value, image}) => {
      if (value.startsWith('#')) return image ? null : value;
      try {
        const url = new URL(value, payload.base);
        if (!['http:', 'https:', 'mailto:'].includes(url.protocol)) return null;
        if (image && url.hostname === 'github.com') {
          url.hostname = 'raw.githubusercontent.com';
          url.pathname = url.pathname.replace('/blob/', '/');
        }
        return url.toString();
      } catch { return null; }
    });
    if (name === 'openDocumentUrl') window.open(payload, '_blank', 'noopener');
    if (name === 'copyDocumentCode') await navigator.clipboard.writeText(payload);
    return true;
  },
};
