export type TempUnit = 'c' | 'f';
export type WindUnit = 'kph' | 'mph' | 'ms';
export type PrecipUnit = 'mm' | 'in';

export type WeatherCode = number;

export type Location = {
  id: string;
  name: string | null;
  lat: number;
  lon: number;
  order: number;
};

export type Settings = {
  tempUnit: TempUnit;
  windUnit: WindUnit;
  precipUnit: PrecipUnit;
  localeDefaulted: boolean;
};

export type WeatherCacheItem = {
  fetchedAt: number;
  timezone: string;
  weatherCode: WeatherCode;
  current: {
    time: string;
    temperature: number;
    apparentTemperature: number;
    precipitation: number;
    windSpeed: number;
    humidity: number;
    isDay: boolean;
  };
  daily: {
    tempMax: number;
    tempMin: number;
    sunrise: string;
    sunset: string;
  };
  dailyForecast: {
    time: string[];
    tempMax: number[];
    tempMin: number[];
    weatherCode: number[];
  };
  hourly: {
    time: string[];
    temperature: number[];
    windSpeed: number[];
    humidity: number[];
    precipitation: number[];
  };
};

export type WeatherCache = Record<string, WeatherCacheItem>;
