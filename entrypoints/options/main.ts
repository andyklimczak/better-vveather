import './style.css';
import { fetchOpenMeteoGeocode, type GeocodeResult } from '@/lib/open-meteo';
import { addLocation, getLocations, getSettings, saveLocations, saveSettings } from '@/lib/storage';
import type { Location, Settings } from '@/lib/types';

const app = document.querySelector<HTMLDivElement>('#app');
if (!app) {
  throw new Error('Missing app root');
}

app.innerHTML = `
  <main class="page">
    <header class="page-header">
      <div>
        <h1>Better VVeather</h1>
        <p>Manage your saved locations and unit preferences.</p>
      </div>
    </header>

    <section class="card">
      <div class="card-title">
        <h2>Locations</h2>
        <p>Search for a city to track multiple places.</p>
      </div>

      <form id="add-location-form" class="add-form" autocomplete="off">
        <div class="input-grid">
          <label class="search-field">
            City or place
            <input id="location-query" type="text" placeholder="Lisbon, Portugal" autocomplete="off" />
            <div id="location-suggestions" class="suggestions hidden" role="listbox"></div>
          </label>
          <label>
            Latitude
            <input id="new-lat" type="text" placeholder="Auto" readonly />
          </label>
          <label>
            Longitude
            <input id="new-lon" type="text" placeholder="Auto" readonly />
          </label>
        </div>
        <div class="form-actions">
          <button class="primary" type="submit">Add location</button>
          <div id="add-error" class="form-error" role="alert"></div>
        </div>
      </form>

      <div id="locations-empty" class="empty-note">No locations yet.</div>
      <div id="locations-list" class="locations-list"></div>
    </section>

    <section class="card">
      <div class="card-title">
        <h2>Units</h2>
        <p>Defaults are chosen by locale when the extension is first used.</p>
      </div>
      <div class="unit-grid">
        <label>
          Temperature
          <select id="temp-unit">
            <option value="c">Celsius (C)</option>
            <option value="f">Fahrenheit (F)</option>
          </select>
        </label>
        <label>
          Wind speed
          <select id="wind-unit">
            <option value="kph">Kilometers/hour (kph)</option>
            <option value="mph">Miles/hour (mph)</option>
            <option value="ms">Meters/second (m/s)</option>
          </select>
        </label>
        <label>
          Precipitation
          <select id="precip-unit">
            <option value="mm">Millimeters (mm)</option>
            <option value="in">Inches (in)</option>
          </select>
        </label>
      </div>
    </section>
  </main>
`;

function getRequiredElement<T extends Element>(selector: string) {
  const element = document.querySelector<T>(selector);
  if (!element) {
    throw new Error(`Missing element: ${selector}`);
  }
  return element;
}

const addForm = getRequiredElement<HTMLFormElement>('#add-location-form');
const addQueryInput = getRequiredElement<HTMLInputElement>('#location-query');
const addLatInput = getRequiredElement<HTMLInputElement>('#new-lat');
const addLonInput = getRequiredElement<HTMLInputElement>('#new-lon');
const suggestionsEl = getRequiredElement<HTMLDivElement>('#location-suggestions');
const addErrorEl = getRequiredElement<HTMLDivElement>('#add-error');
const locationsListEl = getRequiredElement<HTMLDivElement>('#locations-list');
const locationsEmptyEl = getRequiredElement<HTMLDivElement>('#locations-empty');
const tempUnitSelect = getRequiredElement<HTMLSelectElement>('#temp-unit');
const windUnitSelect = getRequiredElement<HTMLSelectElement>('#wind-unit');
const precipUnitSelect = getRequiredElement<HTMLSelectElement>('#precip-unit');

let locations: Location[] = [];
let settings: Settings | null = null;
let searchResults: GeocodeResult[] = [];
let selectedResult: GeocodeResult | null = null;
let searchTimeout: number | null = null;
let searchAbort: AbortController | null = null;
let latestQuery = '';

function showAddError(message: string | null) {
  addErrorEl.textContent = message ?? '';
}

function formatGeocodeLabel(result: GeocodeResult) {
  const parts = [result.name, result.admin1, result.country].filter(Boolean);
  const seen = new Set<string>();
  const unique = parts.filter((part) => {
    const key = part.trim().toLowerCase();
    if (!key || seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
  return unique.join(', ');
}

function formatCoordinate(value: number) {
  return Number.isFinite(value) ? value.toFixed(4) : '';
}

function getLocationLabel(location: Location, index: number) {
  if (location.name && location.name.trim().length > 0) {
    return location.name.trim();
  }
  return `Location ${index + 1}`;
}

function getNewLocationId() {
  if (typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `loc_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

function setSelectedResult(result: GeocodeResult | null) {
  selectedResult = result;
  if (result) {
    addLatInput.value = formatCoordinate(result.latitude);
    addLonInput.value = formatCoordinate(result.longitude);
    return;
  }
  addLatInput.value = '';
  addLonInput.value = '';
}

function hideSuggestions() {
  suggestionsEl.innerHTML = '';
  suggestionsEl.classList.add('hidden');
  searchResults = [];
}

function showSuggestionsMessage(message: string) {
  suggestionsEl.innerHTML = `<div class="suggestion-message">${message}</div>`;
  suggestionsEl.classList.remove('hidden');
}

function renderSuggestions(results: GeocodeResult[]) {
  suggestionsEl.innerHTML = '';
  if (!results.length) {
    showSuggestionsMessage('No matches found.');
    return;
  }
  results.forEach((result, index) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'suggestion';
    button.dataset.index = String(index);
    button.textContent = formatGeocodeLabel(result);
    suggestionsEl.appendChild(button);
  });
  suggestionsEl.classList.remove('hidden');
}

function getSearchLanguage() {
  const language = navigator.language?.trim();
  if (!language) {
    return undefined;
  }
  return language.split('-')[0];
}

async function runSearch(query: string) {
  const trimmed = query.trim();
  if (trimmed.length < 2) {
    hideSuggestions();
    return;
  }
  latestQuery = trimmed;
  if (searchAbort) {
    searchAbort.abort();
  }
  const controller = new AbortController();
  searchAbort = controller;
  showSuggestionsMessage('Searching...');

  try {
    const results = await fetchOpenMeteoGeocode(trimmed, {
      language: getSearchLanguage(),
      limit: 6,
      signal: controller.signal,
    });
    if (controller.signal.aborted || latestQuery !== trimmed) {
      return;
    }
    searchResults = results;
    renderSuggestions(results);
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      return;
    }
    showSuggestionsMessage('Unable to load suggestions.');
  }
}

function scheduleSearch(query: string) {
  if (searchTimeout) {
    window.clearTimeout(searchTimeout);
  }
  const trimmed = query.trim();
  latestQuery = trimmed;
  if (searchAbort) {
    searchAbort.abort();
    searchAbort = null;
  }
  if (trimmed.length < 2) {
    hideSuggestions();
    return;
  }
  searchTimeout = window.setTimeout(() => {
    void runSearch(trimmed);
  }, 250);
}

async function moveLocation(locationId: string, delta: number) {
  const index = locations.findIndex((location) => location.id === locationId);
  if (index < 0) {
    return;
  }
  const targetIndex = index + delta;
  if (targetIndex < 0 || targetIndex >= locations.length) {
    return;
  }
  const next = [...locations];
  const [moved] = next.splice(index, 1);
  next.splice(targetIndex, 0, moved);
  locations = await saveLocations(next);
  renderLocations();
}

async function removeLocation(locationId: string) {
  const next = locations.filter((location) => location.id !== locationId);
  locations = await saveLocations(next);
  renderLocations();
}

function createLocationRow(location: Location, index: number) {
  const row = document.createElement('div');
  const locationId = location.id;
  row.className = 'location-row';
  row.dataset.id = locationId;
  row.innerHTML = `
    <div class="row-index">${index + 1}</div>
    <div class="row-fields">
      <label>
        Location
        <input data-field="label" type="text" readonly />
      </label>
      <label>
        Latitude
        <input data-field="lat" type="text" readonly />
      </label>
      <label>
        Longitude
        <input data-field="lon" type="text" readonly />
      </label>
    </div>
    <div class="row-actions">
      <button class="ghost" data-action="up" type="button">Up</button>
      <button class="ghost" data-action="down" type="button">Down</button>
      <button class="danger" data-action="delete" type="button">Delete</button>
    </div>
  `;

  const nameInput = row.querySelector<HTMLInputElement>('input[data-field="label"]');
  const latInput = row.querySelector<HTMLInputElement>('input[data-field="lat"]');
  const lonInput = row.querySelector<HTMLInputElement>('input[data-field="lon"]');
  const upBtn = row.querySelector<HTMLButtonElement>('button[data-action="up"]');
  const downBtn = row.querySelector<HTMLButtonElement>('button[data-action="down"]');
  const deleteBtn = row.querySelector<HTMLButtonElement>('button[data-action="delete"]');

  if (!nameInput || !latInput || !lonInput || !upBtn || !downBtn || !deleteBtn) {
    return row;
  }

  nameInput.value = getLocationLabel(location, index);
  latInput.value = formatCoordinate(location.lat);
  lonInput.value = formatCoordinate(location.lon);

  upBtn.disabled = index === 0;
  downBtn.disabled = index === locations.length - 1;

  upBtn.addEventListener('click', async () => {
    await moveLocation(locationId, -1);
  });

  downBtn.addEventListener('click', async () => {
    await moveLocation(locationId, 1);
  });

  deleteBtn.addEventListener('click', async () => {
    await removeLocation(locationId);
  });

  return row;
}

function renderLocations() {
  locationsListEl.innerHTML = '';
  if (!locations.length) {
    locationsEmptyEl.classList.remove('hidden');
    return;
  }

  locationsEmptyEl.classList.add('hidden');
  locations.forEach((location, index) => {
    const row = createLocationRow(location, index);
    locationsListEl.appendChild(row);
  });
}

function renderSettings() {
  if (!settings) {
    return;
  }
  tempUnitSelect.value = settings.tempUnit;
  windUnitSelect.value = settings.windUnit;
  precipUnitSelect.value = settings.precipUnit;
}

addQueryInput.addEventListener('input', () => {
  showAddError(null);
  setSelectedResult(null);
  scheduleSearch(addQueryInput.value);
});

suggestionsEl.addEventListener('click', (event) => {
  const target = event.target;
  if (!(target instanceof HTMLButtonElement)) {
    return;
  }
  const index = Number(target.dataset.index);
  const result = searchResults[index];
  if (!result) {
    return;
  }
  setSelectedResult(result);
  addQueryInput.value = formatGeocodeLabel(result);
  hideSuggestions();
});

addForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  showAddError(null);

  if (!selectedResult) {
    showAddError('Select a location from the suggestions.');
    return;
  }

  const newLocation: Location = {
    id: getNewLocationId(),
    name: formatGeocodeLabel(selectedResult),
    lat: selectedResult.latitude,
    lon: selectedResult.longitude,
    order: locations.length,
  };

  locations = await addLocation(newLocation);
  renderLocations();

  addQueryInput.value = '';
  setSelectedResult(null);
  hideSuggestions();
});

tempUnitSelect.addEventListener('change', async () => {
  if (!settings) {
    return;
  }
  settings = { ...settings, tempUnit: tempUnitSelect.value as Settings['tempUnit'], localeDefaulted: false };
  await saveSettings(settings);
});

windUnitSelect.addEventListener('change', async () => {
  if (!settings) {
    return;
  }
  settings = { ...settings, windUnit: windUnitSelect.value as Settings['windUnit'], localeDefaulted: false };
  await saveSettings(settings);
});

precipUnitSelect.addEventListener('change', async () => {
  if (!settings) {
    return;
  }
  settings = { ...settings, precipUnit: precipUnitSelect.value as Settings['precipUnit'], localeDefaulted: false };
  await saveSettings(settings);
});

async function init() {
  [locations, settings] = await Promise.all([getLocations(), getSettings()]);
  renderLocations();
  renderSettings();
}

void init();
