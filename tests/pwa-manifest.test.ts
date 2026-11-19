import { expect, mock, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { createHead, renderSSRHead } from '@unhead/vue/server';

const authReturnRoute = await import('../shared/utils/auth-return-route');
mock.module('#shared/utils/auth-return-route', () => authReturnRoute);
const { pwaManifestHref } = await import('../app/utils/pwaManifestHref');

const manifest = JSON.parse(
  readFileSync(fileURLToPath(new URL('../public/manifest.webmanifest', import.meta.url)), 'utf8')
) as {
  name: string;
  short_name: string;
  start_url: string;
  display: string;
  icons: { src: string; sizes: string; type: string }[];
};

function renderManifestLink(baseURL: string): string {
  const head = createHead();
  head.push({ link: [{ rel: 'manifest', href: pwaManifestHref(baseURL) }] });
  return renderSSRHead(head).headTags;
}

test('the manifest link follows the configured application base', () => {
  expect(renderManifestLink('/')).toContain('<link rel="manifest" href="/manifest.webmanifest">');
  expect(renderManifestLink('/gitpulse/')).toContain(
    '<link rel="manifest" href="/gitpulse/manifest.webmanifest">'
  );
});

test('the install manifest provides GitPulse identity and base-relative install assets', () => {
  expect(manifest).not.toHaveProperty('id');
  expect(manifest).toMatchObject({
    name: 'GitPulse',
    short_name: 'GitPulse',
    start_url: './',
    display: 'standalone',
  });
  expect(manifest.icons.map((icon) => icon.sizes)).toEqual(['192x192', '512x512']);

  for (const icon of manifest.icons) {
    expect(icon.type).toBe('image/png');
    expect(icon.src.startsWith('./')).toBe(true);
    const image = readFileSync(fileURLToPath(new URL(`../public/${icon.src}`, import.meta.url)));
    expect(`${image.readUInt32BE(16)}x${image.readUInt32BE(20)}`).toBe(icon.sizes);
  }
});
