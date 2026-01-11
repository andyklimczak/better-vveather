import type { Location, Settings, WeatherCache } from '@/lib/types';

const STORAGE_KEYS = {
  locations: 'locations',
  settings: 'settings',
  weatherCache: 'weatherCache',
  activeLocationId: 'activeLocationId',
} as const;

const IMPERIAL_LOCALES = new Set(['en-US', 'en-LR', 'en-MM']);

function isImperialLocale(language: string | undefined) {
  if (!language) {
    return false;
  }
  return IMPERIAL_LOCALES.has(language);
}

function getLocaleDefaultSettings(): Settings {
  const language = navigator.language;
  const useImperial = isImperialLocale(language);

  return {
    tempUnit: useImperial ? 'f' : 'c',
    windUnit: useImperial ? 'mph' : 'kph',
    precipUnit: useImperial ? 'in' : 'mm',
    localeDefaulted: true,
  };
}

function normalizeLocationOrder(locations: Location[]): Location[] {
  const sorted = [...locations].sort((a, b) => a.order - b.order);
  return sorted.map((location, index) => ({ ...location, order: index }));
}

export async function getLocations(): Promise<Location[]> {
  const result = await browser.storage.local.get(STORAGE_KEYS.locations);
  const stored = result[STORAGE_KEYS.locations] as Location[] | undefined;
  if (!stored || !Array.isArray(stored)) {
    return [];
  }
  return normalizeLocationOrder(stored);
}

export async function saveLocations(locations: Location[]): Promise<Location[]> {
  const normalized = normalizeLocationOrder(locations);
  await browser.storage.local.set({ [STORAGE_KEYS.locations]: normalized });
  return normalized;
}

export async function addLocation(location: Location): Promise<Location[]> {
  const locations = await getLocations();
  const next = [...locations, location];
  return saveLocations(next);
}

export async function updateLocation(
  locationId: string,
  updates: Partial<Location>,
): Promise<Location[]> {
  const locations = await getLocations();
  const next = locations.map((location) =>
    location.id === locationId ? { ...location, ...updates } : location,
  );
  return saveLocations(next);
}

export async function deleteLocation(locationId: string): Promise<Location[]> {
  const locations = await getLocations();
  const next = locations.filter((location) => location.id !== locationId);
  return saveLocations(next);
}

export async function setActiveLocationId(locationId: string | null) {
  await browser.storage.local.set({
    [STORAGE_KEYS.activeLocationId]: locationId,
  });
}

export async function getActiveLocationId(): Promise<string | null> {
  const result = await browser.storage.local.get(STORAGE_KEYS.activeLocationId);
  return (result[STORAGE_KEYS.activeLocationId] as string | null) ?? null;
}

export async function getSettings(): Promise<Settings> {
  const result = await browser.storage.local.get(STORAGE_KEYS.settings);
  const stored = result[STORAGE_KEYS.settings] as Settings | undefined;
  if (!stored) {
    const defaults = getLocaleDefaultSettings();
    await browser.storage.local.set({ [STORAGE_KEYS.settings]: defaults });
    return defaults;
  }

  return {
    tempUnit: stored.tempUnit ?? 'c',
    windUnit: stored.windUnit ?? 'kph',
    precipUnit: stored.precipUnit ?? 'mm',
    localeDefaulted: stored.localeDefaulted ?? false,
  };
}

export async function saveSettings(settings: Settings): Promise<Settings> {
  await browser.storage.local.set({ [STORAGE_KEYS.settings]: settings });
  return settings;
}

export async function getWeatherCache(): Promise<WeatherCache> {
  const result = await browser.storage.local.get(STORAGE_KEYS.weatherCache);
  return (result[STORAGE_KEYS.weatherCache] as WeatherCache | undefined) ?? {};
}

export async function saveWeatherCache(cache: WeatherCache) {
  await browser.storage.local.set({ [STORAGE_KEYS.weatherCache]: cache });
}
