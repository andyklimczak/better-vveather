import type { WeatherCacheItem } from '@/lib/types';

type DayNightIcon = {
  day: string;
  night: string;
};

type IconChoice = DayNightIcon | string;

const ICON_BASE_PATH = 'weather-icons/png';
const ICON_SIZES = [16, 32, 48, 96, 128] as const;

const ICON_MAP: Record<number, IconChoice> = {
  0: { day: 'clear-day', night: 'clear-night' },
  1: { day: 'cloudy-1-day', night: 'cloudy-1-night' },
  2: { day: 'cloudy-2-day', night: 'cloudy-2-night' },
  3: { day: 'cloudy-3-day', night: 'cloudy-3-night' },
  45: { day: 'fog-day', night: 'fog-night' },
  48: { day: 'fog-day', night: 'fog-night' },
  51: { day: 'rainy-1-day', night: 'rainy-1-night' },
  53: { day: 'rainy-2-day', night: 'rainy-2-night' },
  55: { day: 'rainy-3-day', night: 'rainy-3-night' },
  56: 'rain-and-sleet-mix',
  57: 'rain-and-sleet-mix',
  61: { day: 'rainy-1-day', night: 'rainy-1-night' },
  63: { day: 'rainy-2-day', night: 'rainy-2-night' },
  65: { day: 'rainy-3-day', night: 'rainy-3-night' },
  66: 'rain-and-sleet-mix',
  67: 'rain-and-sleet-mix',
  71: { day: 'snowy-1-day', night: 'snowy-1-night' },
  73: { day: 'snowy-2-day', night: 'snowy-2-night' },
  75: { day: 'snowy-3-day', night: 'snowy-3-night' },
  77: { day: 'snowy-1-day', night: 'snowy-1-night' },
  80: { day: 'rainy-2-day', night: 'rainy-2-night' },
  81: { day: 'rainy-3-day', night: 'rainy-3-night' },
  82: { day: 'rainy-3-day', night: 'rainy-3-night' },
  85: { day: 'snowy-2-day', night: 'snowy-2-night' },
  86: { day: 'snowy-3-day', night: 'snowy-3-night' },
  95: { day: 'isolated-thunderstorms-day', night: 'isolated-thunderstorms-night' },
  96: 'severe-thunderstorm',
  99: 'severe-thunderstorm',
};

const FALLBACK_ICON: DayNightIcon = {
  day: 'cloudy-2-day',
  night: 'cloudy-2-night',
};

function pickIconName(choice: IconChoice, isDay: boolean) {
  if (typeof choice === 'string') {
    return choice;
  }
  return isDay ? choice.day : choice.night;
}

export function pickWeatherIconNameByCode(weatherCode: number, isDay = true) {
  const choice = ICON_MAP[weatherCode] ?? FALLBACK_ICON;
  return pickIconName(choice, isDay);
}

export function getIconPaths(iconName: string) {
  const paths: Record<number, string> = {};

  ICON_SIZES.forEach((size) => {
    paths[size] = `${ICON_BASE_PATH}/${iconName}-${size}.png`;
  });

  return paths;
}

export function pickWeatherIcon(cacheItem: WeatherCacheItem) {
  return pickWeatherIconNameByCode(cacheItem.weatherCode, cacheItem.current.isDay);
}
