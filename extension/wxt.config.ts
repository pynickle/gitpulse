import { defineConfig } from 'wxt';

export default defineConfig({
  manifest: ({ browser }) => ({
    name: 'GitPulse Jump',
    description: 'Open GitHub pages in GitPulse.',
    permissions: ['storage', 'activeTab'],
    host_permissions: ['https://github.com/*', 'https://www.github.com/*'],
    ...(browser === 'firefox'
      ? {
          browser_specific_settings: {
            gecko: {
              ...(process.env.FIREFOX_EXTENSION_ID ? { id: process.env.FIREFOX_EXTENSION_ID } : {}),
              data_collection_permissions: {
                required: ['none'],
              },
            },
          },
        }
      : {}),
  }),
});
