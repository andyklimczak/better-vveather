import { fetchOpenMeteoWeather } from '@/lib/open-meteo';
import { getLocations, getSettings, getWeatherCache, saveWeatherCache } from '@/lib/storage';
import { getIconPaths, pickWeatherIcon } from '@/lib/weather-icons';
import type { Location } from '@/lib/types';

type WeatherRefreshMessage = {
  type: 'weather:refresh';
  locationId?: string;
};

const REFRESH_ALARM = 'weather-refresh';
const REFRESH_INTERVAL_MINUTES = 15;
const actionApi = browser.action ?? browser.browserAction;

function isWeatherRefreshMessage(message: unknown): message is WeatherRefreshMessage {
  return (
    typeof message === 'object' &&
    message !== null &&
    'type' in message &&
    (message as WeatherRefreshMessage).type === 'weather:refresh'
  );
}

async function getPrimaryLocation() {
  const locations = await getLocations();
  return locations[0] ?? null;
}

async function refreshWeatherForLocation(location: Location) {
  const settings = await getSettings();
  const cacheItem = await fetchOpenMeteoWeather(location, settings);
  const cache = await getWeatherCache();
  await saveWeatherCache({ ...cache, [location.id]: cacheItem });
  return cacheItem;
}

function getBadgeColor(tempCelsius: number) {
  if (tempCelsius <= 0) {
    return '#2563eb';
  }
  if (tempCelsius <= 10) {
    return '#38bdf8';
  }
  if (tempCelsius <= 20) {
    return '#facc15';
  }
  if (tempCelsius <= 30) {
    return '#fb923c';
  }
  return '#ef4444';
}

function toCelsius(temp: number, unit: string) {
  return unit === 'f' ? ((temp - 32) * 5) / 9 : temp;
}

async function updateActionFromCache(location: Location) {
  const cache = await getWeatherCache();
  const cacheItem = cache[location.id];
  if (!cacheItem) {
    await actionApi.setBadgeText({ text: '' });
    return;
  }

  const iconName = pickWeatherIcon(cacheItem);
  const iconPaths = getIconPaths(iconName);
  if (Object.keys(iconPaths).length) {
    await actionApi.setIcon({ path: iconPaths });
  }

  const settings = await getSettings();
  const badgeText = Number.isFinite(cacheItem.current.temperature)
    ? Math.round(cacheItem.current.temperature).toString()
    : '';

  await actionApi.setBadgeText({ text: badgeText });
  if (badgeText) {
    const tempCelsius = toCelsius(cacheItem.current.temperature, settings.tempUnit);
    await actionApi.setBadgeBackgroundColor({ color: getBadgeColor(tempCelsius) });
  }
}

async function refreshWeatherById(locationId: string) {
  const locations = await getLocations();
  const location = locations.find((item) => item.id === locationId);
  if (!location) {
    throw new Error('Location not found');
  }
  const cacheItem = await refreshWeatherForLocation(location);

  const primary = locations[0];
  if (primary && primary.id === location.id) {
    await updateActionFromCache(primary);
  }
  return cacheItem;
}

async function refreshAllLocations() {
  const locations = await getLocations();
  const updatedCache = await Promise.all(
    locations.map(async (location) => ({
      locationId: location.id,
      data: await refreshWeatherForLocation(location),
    })),
  );

  const primary = locations[0];
  if (primary) {
    await updateActionFromCache(primary);
  }
  return updatedCache;
}

async function refreshPrimaryLocation() {
  const primary = await getPrimaryLocation();
  if (!primary) {
    await actionApi.setBadgeText({ text: '' });
    return;
  }
  await refreshWeatherForLocation(primary);
  await updateActionFromCache(primary);
}

export default defineBackground(() => {
  browser.alarms.create(REFRESH_ALARM, { periodInMinutes: REFRESH_INTERVAL_MINUTES });
  void refreshPrimaryLocation();

  browser.runtime.onMessage.addListener((message) => {
    if (!isWeatherRefreshMessage(message)) {
      return;
    }
    if (message.locationId) {
      return refreshWeatherById(message.locationId);
    }
    return refreshAllLocations();
  });

  browser.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name !== REFRESH_ALARM) {
      return;
    }
    void refreshPrimaryLocation();
  });

  browser.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== 'local') {
      return;
    }
    if (changes.locations || changes.settings) {
      void refreshPrimaryLocation();
    }
  });
});
