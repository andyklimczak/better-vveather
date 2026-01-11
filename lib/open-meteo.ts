import type { Location, Settings, WeatherCacheItem } from '@/lib/types';

type OpenMeteoCurrent = {
  time?: string;
  temperature_2m: number;
  apparent_temperature: number;
  precipitation: number;
  wind_speed_10m: number;
  relative_humidity_2m: number;
  is_day: number;
  weather_code: number;
};

type OpenMeteoHourly = {
  time: string[];
  temperature_2m: number[];
  wind_speed_10m: number[];
  relative_humidity_2m: number[];
  precipitation: number[];
};

type OpenMeteoDaily = {
  time: string[];
  temperature_2m_max: number[];
  temperature_2m_min: number[];
  sunrise: string[];
  sunset: string[];
  weather_code: number[];
};

type OpenMeteoResponse = {
  timezone: string;
  current: OpenMeteoCurrent;
  hourly?: OpenMeteoHourly;
  daily: OpenMeteoDaily;
};

export type GeocodeResult = {
  id: number;
  name: string;
  latitude: number;
  longitude: number;
  country: string;
  country_code?: string;
  admin1?: string;
  timezone?: string;
};

type GeocodeResponse = {
  results?: GeocodeResult[];
};

const TEMP_UNIT_MAP: Record<Settings['tempUnit'], string> = {
  c: 'celsius',
  f: 'fahrenheit',
};

const WIND_UNIT_MAP: Record<Settings['windUnit'], string> = {
  kph: 'kmh',
  mph: 'mph',
  ms: 'ms',
};

const PRECIP_UNIT_MAP: Record<Settings['precipUnit'], string> = {
  mm: 'mm',
  in: 'inch',
};

function pickFirst<T>(values: T[] | undefined): T | undefined {
  if (!Array.isArray(values)) {
    return undefined;
  }
  return values[0];
}

function sliceNumberArray(values: number[] | undefined, start: number, end: number) {
  if (!Array.isArray(values)) {
    return [];
  }
  return values.slice(start, end).map((value) => Number(value));
}

function sliceStringArray(values: string[] | undefined, start: number, end: number) {
  if (!Array.isArray(values)) {
    return [];
  }
  return values.slice(start, end);
}

function normalizeHourly(hourly: OpenMeteoHourly | undefined) {
  if (!hourly || !Array.isArray(hourly.time)) {
    return {
      time: [],
      temperature: [],
      windSpeed: [],
      humidity: [],
      precipitation: [],
    };
  }
  const count = hourly.time.length;

  return {
    time: sliceStringArray(hourly.time, 0, count),
    temperature: sliceNumberArray(hourly.temperature_2m, 0, count),
    windSpeed: sliceNumberArray(hourly.wind_speed_10m, 0, count),
    humidity: sliceNumberArray(hourly.relative_humidity_2m, 0, count),
    precipitation: sliceNumberArray(hourly.precipitation, 0, count),
  };
}

export function buildOpenMeteoUrl(location: Location, settings: Settings) {
  const params = new URLSearchParams({
    latitude: location.lat.toString(),
    longitude: location.lon.toString(),
    current:
      'temperature_2m,apparent_temperature,precipitation,wind_speed_10m,relative_humidity_2m,is_day,weather_code',
    hourly: 'temperature_2m,wind_speed_10m,relative_humidity_2m,precipitation',
    daily: 'temperature_2m_max,temperature_2m_min,sunrise,sunset,weather_code',
    timezone: 'auto',
    temperature_unit: TEMP_UNIT_MAP[settings.tempUnit],
    wind_speed_unit: WIND_UNIT_MAP[settings.windUnit],
    precipitation_unit: PRECIP_UNIT_MAP[settings.precipUnit],
    forecast_days: '7',
  });

  return `https://api.open-meteo.com/v1/forecast?${params.toString()}`;
}

export async function fetchOpenMeteoWeather(
  location: Location,
  settings: Settings,
): Promise<WeatherCacheItem> {
  const url = buildOpenMeteoUrl(location, settings);
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Open-Meteo error: ${response.status}`);
  }
  const data = (await response.json()) as OpenMeteoResponse;

  const current = data.current ?? ({} as OpenMeteoCurrent);
  const daily = data.daily ?? ({} as OpenMeteoDaily);
  const hourly = normalizeHourly(data.hourly);
  const dailyForecast = {
    time: sliceStringArray(daily.time, 0, 7),
    tempMax: sliceNumberArray(daily.temperature_2m_max, 0, 7),
    tempMin: sliceNumberArray(daily.temperature_2m_min, 0, 7),
    weatherCode: sliceNumberArray(daily.weather_code, 0, 7),
  };

  return {
    fetchedAt: Date.now(),
    timezone: data.timezone ?? 'UTC',
    weatherCode: Number(current.weather_code),
    current: {
      time: current.time ?? '',
      temperature: Number(current.temperature_2m),
      apparentTemperature: Number(current.apparent_temperature),
      precipitation: Number(current.precipitation),
      windSpeed: Number(current.wind_speed_10m),
      humidity: Number(current.relative_humidity_2m),
      isDay: Number(current.is_day) === 1,
    },
    daily: {
      tempMax: Number(pickFirst(daily.temperature_2m_max)),
      tempMin: Number(pickFirst(daily.temperature_2m_min)),
      sunrise: pickFirst(daily.sunrise) ?? '',
      sunset: pickFirst(daily.sunset) ?? '',
    },
    dailyForecast,
    hourly,
  };
}

export async function fetchOpenMeteoGeocode(
  query: string,
  options: { language?: string; limit?: number; signal?: AbortSignal } = {},
): Promise<GeocodeResult[]> {
  const trimmed = query.trim();
  if (!trimmed) {
    return [];
  }

  const params = new URLSearchParams({
    name: trimmed,
    count: String(options.limit ?? 6),
    format: 'json',
  });
  if (options.language) {
    params.set('language', options.language);
  }

  const response = await fetch(`https://geocoding-api.open-meteo.com/v1/search?${params.toString()}`, {
    signal: options.signal,
  });
  if (!response.ok) {
    throw new Error(`Open-Meteo geocoding error: ${response.status}`);
  }
  const data = (await response.json()) as GeocodeResponse;
  if (!data.results || !Array.isArray(data.results)) {
    return [];
  }
  return data.results;
}
