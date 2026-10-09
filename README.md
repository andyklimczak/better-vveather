# Better VVeather

Multi-location weather for Firefox and Chrome, powered by Open-Meteo. The popup and Options page automatically follow the system/browser light or dark appearance, including live changes while open.

## Development and verification

Use Node.js 22 and npm.

```sh
npm ci
npm run lint
npm run compile
npm run build
npm run build:firefox
npx playwright install --with-deps chromium firefox
npm test
```

The browser tests exercise the built pages in Chromium and Firefox with deterministic, explicitly mocked extension storage/weather data. They do not call the weather API or publish an extension.

## Firefox publishing

CI runs on pushes and pull requests. Only pushes to `master` (or a manual CI dispatch on `master`) publish to the existing Firefox listing, and only after the `lint` job passes lint, type checking, builds, and browser tests. Pull requests and other branches cannot publish.

In GitHub Settings → Secrets and variables → Actions, configure these **repository secrets**, not public variables:

- `JWT_ISSUER`: the API key/issuer from Mozilla's API credentials page.
- `JWT_SECRET`: the corresponding API secret.

The workflow maps these to WXT's `FIREFOX_JWT_ISSUER` and `FIREFOX_JWT_SECRET`. The add-on ID is taken from the existing listing: `{4402e563-bfc0-4d5e-b4db-51c65836e661}`. No new listing is created.

Each publish builds version `0.<GitHub run number>.<run attempt>`, so ordinary pushes and reruns have distinct AMO versions without automated commits. Keep the CI workflow's run counter intact; if replacing the workflow or moving to a higher manual version series, update this scheme before publishing. Avoid rerunning old runs after a newer version has shipped.

WXT uploads the Firefox package and its source archive to the `listed` channel. A final authenticated GET verifies the exact AMO version and attached sources. Successful submission does not bypass Mozilla review or mean that the update is already public. Missing credentials, rejected uploads, or failed verification fail the job.

## Mozilla source-code review / reproducible build

The `*-sources.zip` archive includes the release version in `package.json` and `package-lock.json`. Extract it into an empty directory, then run:

```sh
npm ci
npm run build:firefox
```

The extension is generated in `.output/firefox-mv2`. `npm run zip:firefox` additionally creates the installable ZIP and review-source ZIP. No credentials, `.env` file, private packages, or external code generation are needed to rebuild. Publishing credentials are provided only to the submission step, after packaging.

References: https://wxt.dev/guide/essentials/publishing.html and https://addons.mozilla.org/developers/addon/api/key/.
