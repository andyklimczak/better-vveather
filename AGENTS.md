# better-vveather Agent Guide

## Project summary
- Browser extension (WXT) that shows weather for multiple user-defined locations.
- The toolbar icon reflects the current weather for the first location in the list.
- Users can click the icon to open a popup with detailed weather and switch locations.
- Users can reorder locations in an Options page to control which location is first.

## Product requirements (decisions)
- Locations are manual lat/long only (no geocoding).
- Popup uses Next/Prev controls to cycle locations.
- Show current temp, feels like, precipitation, wind, daily high/low, sunrise/sunset.
- Units are user-selectable at the extension level; default is locale-based if possible, else metric.
- Background refresh every 15 minutes; force refresh on popup open; manual refresh button in popup.
- Use Open-Meteo API for weather data.
- Use Makin-Things weather icons; store SVGs in `assets/`, generate PNGs for action icon.
- Support Chrome and Firefox (maximum compatibility); use `browser.*` APIs via WXT.
- Use `browser.storage.local` for settings and cached weather.
- Action badge shows rounded integer temperature (no units); badge color scales by temperature.

## UX and flows
- Popup:
  - Shows location name (user-specified or fallback label), current conditions, and daily summary.
  - Next/Prev buttons switch the active location view.
  - Refresh button triggers immediate fetch for the current location.
  - On open, trigger refresh for the current location (and update UI when done).
- Options page:
  - List of locations with lat, lon, and optional name.
  - Add/edit/delete location.
  - Up/Down controls to reorder locations.
  - Unit settings (temperature and wind speed; add precipitation units if needed).

## Data model (storage.local)
- `locations`: Array of objects:
  - `id`: string (uuid)
  - `name`: string | null (user-provided)
  - `lat`: number
  - `lon`: number
  - `order`: number (explicit ordering for up/down)
- `settings`:
  - `tempUnit`: "c" | "f"
  - `windUnit`: "kph" | "mph" | "ms"
  - `precipUnit`: "mm" | "in"
  - `localeDefaulted`: boolean (true if set via locale)
- `weatherCache`:
  - Map by `locationId`:
    - `fetchedAt`: number (epoch ms)
    - `current`: Open-Meteo current fields
    - `daily`: Open-Meteo daily fields for today
    - `timezone`: string
    - `weatherCode`: number

## Weather API (Open-Meteo)
- Endpoint: `https://api.open-meteo.com/v1/forecast`
- Parameters:
  - `latitude`, `longitude`
  - `current=temperature_2m,apparent_temperature,precipitation,wind_speed_10m,weather_code`
  - `daily=temperature_2m_max,temperature_2m_min,sunrise,sunset`
  - `temperature_unit`, `wind_speed_unit`, `precipitation_unit` based on settings
  - `timezone=auto`
- Fetch strategy:
  - Background refresh every 15 min for the first location (and optionally all locations if cheap).
  - Popup open triggers fetch for the active location.
  - Manual refresh button triggers fetch for active location.

## Icons and badge
- Store SVG icon set in `assets/weather-icons/svg/`.
- Generate PNGs in `assets/weather-icons/png/` for action icon sizes 16/32/48/128.
- Map Open-Meteo `weather_code` to icon names in a single mapping module.
- Badge:
  - Text: rounded integer temperature (no units, e.g. `72`).
  - Color scale: cold = blue, mild = yellow, hot = red (simple gradient or bucketed).
- Action icon uses weather icon for the first location only.

## Extension architecture
- `entrypoints/background.ts`
  - Set up `browser.alarms` for 15-min refresh.
  - Fetch weather, update `storage.local`, update action icon and badge.
  - Handle messages from popup for refresh and data access.
- `entrypoints/popup/`
  - Renders weather for active location.
  - Next/Prev navigation between locations.
  - Calls background refresh on open and on button click.
- `entrypoints/options/`
  - Manage locations list and settings.
  - Up/Down controls modify `order` and persist.

## Permissions and manifest notes
- `permissions`: `storage`, `alarms`, `action`
- `host_permissions`: `https://api.open-meteo.com/*`

## Locale defaults
- If `settings` not set, infer temp unit from `navigator.language`:
  - Use "f" for locales `en-US`, `en-LR`, `en-MM`; else "c".
  - Default wind to "mph" for the same locales, else "kph".
  - Precip default: "in" for the same locales, else "mm".
  - Store `localeDefaulted=true` once set.

## Mapping notes
- Open-Meteo weather code mapping should cover:
  - Clear, partly cloudy, overcast
  - Fog, drizzle, rain, freezing rain
  - Snow, snow showers
  - Thunderstorm (with/without hail)
- Implement mapping in a single file for reuse in popup and background.

## Testing checklist (manual)
- Add 2+ locations, reorder, verify first location drives toolbar icon/badge.
- Refresh from popup; verify data updates and badge changes.
- Restart browser; verify data loads from `storage.local`.
- Verify units switch updates API params and display.
- Confirm Chrome + Firefox build with WXT.
