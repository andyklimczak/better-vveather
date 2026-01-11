import { defineConfig } from 'wxt';

// See https://wxt.dev/api/config.html
const firefoxBinary = process.env.FIREFOX_BINARY ?? 'firefox';

export default defineConfig({
  vite: () => ({
    build: {
      assetsInlineLimit: 0,
    },
  }),
  webExt: {
    binaries: {
      firefox: firefoxBinary,
    },
  },
  manifest: {
    name: 'Better VVeather',
    description: 'Multi-location weather with a glanceable toolbar icon.',
    action: {
      default_popup: 'popup.html',
    },
    options_ui: {
      page: 'options.html',
      open_in_tab: true,
    },
    permissions: ['storage', 'alarms'],
    host_permissions: ['https://api.open-meteo.com/*', 'https://geocoding-api.open-meteo.com/*'],
  },
});
