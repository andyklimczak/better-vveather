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
    browser_specific_settings: {
      gecko: {
        id: '{4402e563-bfc0-4d5e-b4db-51c65836e661}',
        data_collection_permissions: {
          required: ['locationInfo'],
        },
      },
    },
    permissions: ['storage', 'alarms'],
    host_permissions: ['https://api.open-meteo.com/*', 'https://geocoding-api.open-meteo.com/*'],
  },
});
