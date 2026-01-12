import './style.css';
import { getActiveLocationId, getLocations, getSettings, getWeatherCache, setActiveLocationId } from '@/lib/storage';
import { describeWeatherCode } from '@/lib/weather-codes';
import { getIconPaths, pickWeatherIcon, pickWeatherIconNameByCode } from '@/lib/weather-icons';
import type { Location, Settings, WeatherCache, WeatherCacheItem } from '@/lib/types';

const app = document.querySelector<HTMLDivElement>('#app');
if (!app) {
  throw new Error('Missing app root');
}

app.innerHTML = `
  <div class="popup" id="popup">
    <header class="header">
      <div>
        <div class="title">Better VVeather</div>
        <div class="subtitle" id="location-label">No locations yet</div>
      </div>
      <div class="header-actions">
        <div class="nav" id="nav-controls">
          <button class="nav-btn" id="prev-btn" type="button" aria-label="Previous location">&lt;</button>
          <div class="nav-status" id="nav-status">0 / 0</div>
          <button class="nav-btn" id="next-btn" type="button" aria-label="Next location">&gt;</button>
        </div>
        <button class="icon-btn" id="refresh-btn" type="button" aria-label="Refresh" title="Refresh">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path
              d="M19.5 12a7.5 7.5 0 1 1-2.1-5.2l-1.9 1.9h6V2.5l-2.2 2.2A9.5 9.5 0 1 0 21.5 12z"
              fill="currentColor"
            />
          </svg>
        </button>
      </div>
    </header>

    <section class="card hero">
      <div class="temp-row">
        <div class="icon-wrap">
          <img class="weather-icon" id="weather-icon" alt="" />
        </div>
        <div class="temp-meta">
          <div class="temp" id="temp-value">--</div>
          <div class="condition" id="condition">No data yet</div>
        </div>
      </div>
      <div class="sub-metrics">
        <div>
          <div class="label">Feels like</div>
          <div class="value" id="feels-like">--</div>
        </div>
        <div>
          <div class="label">Precip</div>
          <div class="value" id="precip">--</div>
        </div>
        <div>
          <div class="label">Wind</div>
          <div class="value" id="wind">--</div>
        </div>
        <div>
          <div class="label">Humidity</div>
          <div class="value" id="humidity">--</div>
        </div>
      </div>
    </section>

    <section class="card details">
      <div class="detail-grid">
        <div>
          <div class="label">High</div>
          <div class="value" id="temp-max">--</div>
        </div>
        <div>
          <div class="label">Low</div>
          <div class="value" id="temp-min">--</div>
        </div>
        <div>
          <div class="label">Sunrise</div>
          <div class="value" id="sunrise">--</div>
        </div>
        <div>
          <div class="label">Sunset</div>
          <div class="value" id="sunset">--</div>
        </div>
      </div>
    </section>

    <section class="card forecast">
      <div class="forecast-header">
        <div class="forecast-title">7-day outlook</div>
      </div>
      <div class="forecast-row" id="forecast-row"></div>
    </section>

    <section class="card charts">
      <div class="chart-header">
        <div class="chart-title">Next 24 hours</div>
        <div class="chart-subtitle" id="chart-range">--</div>
      </div>
      <div class="chart-tabs" id="chart-tabs" role="tablist" aria-label="Chart metric">
        <button class="chart-tab is-active" data-metric="temp" type="button" role="tab" aria-selected="true">
          Temp
        </button>
        <button class="chart-tab" data-metric="wind" type="button" role="tab" aria-selected="false">
          Wind
        </button>
        <button class="chart-tab" data-metric="humidity" type="button" role="tab" aria-selected="false">
          Humidity
        </button>
        <button class="chart-tab" data-metric="precip" type="button" role="tab" aria-selected="false">
          Precip
        </button>
      </div>
      <div class="chart-solo">
        <div class="chart-y-axis">
          <div id="chart-y-max">--</div>
          <div id="chart-y-min">--</div>
        </div>
        <div class="chart-canvas">
          <div class="chart-plot" id="chart-plot">
            <svg class="sparkline" id="chart-main" viewBox="0 0 120 48" preserveAspectRatio="none"></svg>
            <div class="chart-marker" id="chart-marker"></div>
            <div class="chart-tooltip" id="chart-tooltip"></div>
          </div>
          <div class="chart-x-axis" id="chart-x-axis"></div>
        </div>
      </div>
    </section>

    <div class="status" id="status-line">Add locations in Options to get started.</div>
  </div>

  <div class="empty" id="empty-state">
    <div class="empty-card">
      <div class="empty-title">No locations yet</div>
      <div class="empty-subtitle">Add a location to see weather in the popup.</div>
      <button class="primary" id="open-options" type="button">Open Options</button>
    </div>
  </div>
`;

function getRequiredElement<T extends Element>(selector: string) {
  const element = document.querySelector<T>(selector);
  if (!element) {
    throw new Error(`Missing element: ${selector}`);
  }
  return element;
}

const popupEl = getRequiredElement<HTMLDivElement>('#popup');
const emptyEl = getRequiredElement<HTMLDivElement>('#empty-state');
const locationLabelEl = getRequiredElement<HTMLDivElement>('#location-label');
const navStatusEl = getRequiredElement<HTMLDivElement>('#nav-status');
const tempValueEl = getRequiredElement<HTMLDivElement>('#temp-value');
const conditionEl = getRequiredElement<HTMLDivElement>('#condition');
const iconImg = getRequiredElement<HTMLImageElement>('#weather-icon');
const feelsLikeEl = getRequiredElement<HTMLDivElement>('#feels-like');
const precipEl = getRequiredElement<HTMLDivElement>('#precip');
const windEl = getRequiredElement<HTMLDivElement>('#wind');
const humidityEl = getRequiredElement<HTMLDivElement>('#humidity');
const tempMaxEl = getRequiredElement<HTMLDivElement>('#temp-max');
const tempMinEl = getRequiredElement<HTMLDivElement>('#temp-min');
const sunriseEl = getRequiredElement<HTMLDivElement>('#sunrise');
const sunsetEl = getRequiredElement<HTMLDivElement>('#sunset');
const forecastRowEl = getRequiredElement<HTMLDivElement>('#forecast-row');
const chartRangeEl = getRequiredElement<HTMLDivElement>('#chart-range');
const chartTabsEl = getRequiredElement<HTMLDivElement>('#chart-tabs');
const chartMainSvg = getRequiredElement<SVGSVGElement>('#chart-main');
const chartYMaxEl = getRequiredElement<HTMLDivElement>('#chart-y-max');
const chartYMinEl = getRequiredElement<HTMLDivElement>('#chart-y-min');
const chartXAxisEl = getRequiredElement<HTMLDivElement>('#chart-x-axis');
const chartPlotEl = getRequiredElement<HTMLDivElement>('#chart-plot');
const chartMarkerEl = getRequiredElement<HTMLDivElement>('#chart-marker');
const chartTooltipEl = getRequiredElement<HTMLDivElement>('#chart-tooltip');
const statusLineEl = getRequiredElement<HTMLDivElement>('#status-line');
const prevBtn = getRequiredElement<HTMLButtonElement>('#prev-btn');
const nextBtn = getRequiredElement<HTMLButtonElement>('#next-btn');
const refreshBtn = getRequiredElement<HTMLButtonElement>('#refresh-btn');
const openOptionsBtn = getRequiredElement<HTMLButtonElement>('#open-options');

const TEMP_UNIT_LABEL: Record<Settings['tempUnit'], string> = {
  c: 'C',
  f: 'F',
};
const WIND_UNIT_LABEL: Record<Settings['windUnit'], string> = {
  kph: 'kph',
  mph: 'mph',
  ms: 'm/s',
};
const PRECIP_UNIT_LABEL: Record<Settings['precipUnit'], string> = {
  mm: 'mm',
  in: 'in',
};

let locations: Location[] = [];
let settings: Settings | null = null;
let weatherCache: WeatherCache = {};
let activeIndex = 0;
let activeDayIndex = 0;
let activeLocationId: string | null = null;
type ChartMetric = 'temp' | 'wind' | 'humidity' | 'precip';
let activeMetric: ChartMetric = 'temp';
type ChartHoverData = {
  times: string[];
  values: number[];
  formatValue: (value: number, localSettings: Settings) => string;
  settings: Settings;
};
let chartHoverData: ChartHoverData | null = null;

function getLocationLabel(location: Location, index: number) {
  if (location.name && location.name.trim().length > 0) {
    return location.name.trim();
  }
  return `Location ${index + 1}`;
}

function formatTime(timestamp: number) {
  if (!Number.isFinite(timestamp)) {
    return '--';
  }
  return new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function formatIsoTime(value: string | undefined) {
  if (!value) {
    return '--';
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }
  return parsed.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function formatWeekdayLabel(value: string | undefined, index: number) {
  if (index === 0) {
    return 'Today';
  }
  if (!value) {
    return '--';
  }
  const parsed = value.length <= 10 ? new Date(`${value}T12:00:00`) : new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }
  return parsed.toLocaleDateString([], { weekday: 'short' });
}

function formatDailyTemp(value: number | undefined, unit: Settings['tempUnit']) {
  if (value === undefined || !Number.isFinite(value)) {
    return '--';
  }
  return `${Math.round(value)}${TEMP_UNIT_LABEL[unit]}`;
}

function getDateKey(value: string | undefined) {
  if (!value) {
    return '';
  }
  return value.slice(0, 10);
}

function sliceHourlyByDate(hourly: WeatherCacheItem['hourly'], dateKey: string) {
  if (!dateKey || !hourly.time.length) {
    return null;
  }
  const indices: number[] = [];
  hourly.time.forEach((time, index) => {
    if (time.startsWith(dateKey)) {
      indices.push(index);
    }
  });
  if (!indices.length) {
    return null;
  }
  return {
    time: indices.map((index) => hourly.time[index]),
    temperature: indices.map((index) => Number(hourly.temperature[index])),
    windSpeed: indices.map((index) => Number(hourly.windSpeed[index])),
    humidity: indices.map((index) => Number(hourly.humidity[index])),
    precipitation: indices.map((index) => Number(hourly.precipitation[index])),
  };
}

function getHourlyForActiveDay(cacheItem: WeatherCacheItem) {
  if (!cacheItem.dailyForecast?.time?.length) {
    return cacheItem.hourly;
  }
  const dayValue = cacheItem.dailyForecast.time[activeDayIndex];
  if (!dayValue) {
    return cacheItem.hourly;
  }
  const dayKey = getDateKey(dayValue);
  return (
    sliceHourlyByDate(cacheItem.hourly, dayKey) ?? {
      time: [],
      temperature: [],
      windSpeed: [],
      humidity: [],
      precipitation: [],
    }
  );
}

function formatChartRangeLabel(dayValue: string | undefined, times: string[], dayIndex: number) {
  if (!times.length) {
    return '--';
  }
  const dayLabel = dayValue
    ? formatWeekdayLabel(dayValue, dayIndex)
    : dayIndex === 0
      ? 'Today'
      : `Day ${dayIndex + 1}`;
  return `${dayLabel} | ${formatIsoTime(times[0])} - ${formatIsoTime(times[times.length - 1])}`;
}

function showEmptyState() {
  popupEl.classList.add('hidden');
  emptyEl.classList.remove('hidden');
}

function showPopup() {
  emptyEl.classList.add('hidden');
  popupEl.classList.remove('hidden');
}

function setStatusLine(text: string) {
  statusLineEl.textContent = text;
}

function formatValue(value: number | undefined, unit: string) {
  if (value === undefined || !Number.isFinite(value)) {
    return '--';
  }
  return `${Math.round(value)} ${unit}`;
}

function formatPrecip(value: number | undefined, unit: Settings['precipUnit']) {
  if (value === undefined || !Number.isFinite(value)) {
    return '--';
  }
  const decimals = unit === 'in' ? 2 : 1;
  return `${value.toFixed(decimals)} ${PRECIP_UNIT_LABEL[unit]}`;
}

function formatPercent(value: number | undefined) {
  if (value === undefined || !Number.isFinite(value)) {
    return '--';
  }
  return `${Math.round(value)}%`;
}

function clearSparkline(svg: SVGSVGElement) {
  svg.replaceChildren();
  svg.classList.add('is-empty');
}

function renderSparkline(
  svg: SVGSVGElement,
  values: number[],
  color: string,
  bounds?: { min: number; max: number },
) {
  svg.replaceChildren();
  if (!values.length) {
    svg.classList.add('is-empty');
    return;
  }
  svg.classList.remove('is-empty');

  const viewBox = svg.viewBox.baseVal;
  const width = viewBox.width || 120;
  const height = viewBox.height || 48;
  const min = bounds?.min ?? Math.min(...values);
  const max = bounds?.max ?? Math.max(...values);
  const span = max - min || 1;

  const points = values.map((value, index) => {
    const x = values.length === 1 ? width / 2 : (index / (values.length - 1)) * width;
    const y = height - ((value - min) / span) * height;
    return `${x},${y}`;
  });

  const polyline = document.createElementNS('http://www.w3.org/2000/svg', 'polyline');
  polyline.setAttribute('points', points.join(' '));
  polyline.setAttribute('fill', 'none');
  polyline.setAttribute('stroke', color);
  polyline.setAttribute('stroke-width', '2');
  polyline.setAttribute('stroke-linecap', 'round');
  polyline.setAttribute('stroke-linejoin', 'round');
  svg.appendChild(polyline);
}

function formatAxisTime(value: string | undefined) {
  if (!value) {
    return '--';
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }
  return parsed.toLocaleTimeString([], { hour: 'numeric' });
}

function findClosestTimeIndex(times: string[], currentTime: string | undefined) {
  if (!currentTime) {
    return 0;
  }
  const target = new Date(currentTime).getTime();
  if (Number.isNaN(target)) {
    return 0;
  }
  let closestIndex = 0;
  for (let i = 0; i < times.length; i += 1) {
    const timeValue = new Date(times[i]).getTime();
    if (Number.isNaN(timeValue)) {
      continue;
    }
    if (timeValue <= target) {
      closestIndex = i;
      continue;
    }
    break;
  }
  return closestIndex;
}

function formatHoverTime(value: string | undefined) {
  if (!value) {
    return '--';
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }
  return parsed.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

function renderXAxisTicks(times: string[], nowIndex?: number) {
  chartXAxisEl.replaceChildren();
  if (!times.length) {
    chartXAxisEl.textContent = '--';
    return;
  }
  const lastIndex = times.length - 1;
  const indices = [0, Math.round(lastIndex / 3), Math.round((2 * lastIndex) / 3), lastIndex];
  let tickIndices = Array.from(new Set(indices)).sort((a, b) => a - b);

  if (nowIndex !== undefined && nowIndex >= 0 && nowIndex <= lastIndex) {
    if (!tickIndices.includes(nowIndex)) {
      let nearestIndex = tickIndices[0];
      let nearestDistance = Math.abs(nearestIndex - nowIndex);
      tickIndices.forEach((tick) => {
        const distance = Math.abs(tick - nowIndex);
        if (distance < nearestDistance) {
          nearestDistance = distance;
          nearestIndex = tick;
        }
      });
      tickIndices = tickIndices.map((tick) => (tick === nearestIndex ? nowIndex : tick));
    }
  }

  tickIndices.forEach((index) => {
    const label = index === nowIndex ? 'Now' : formatAxisTime(times[index]);
    const span = document.createElement('span');
    span.textContent = label;
    chartXAxisEl.appendChild(span);
  });
}

function hideChartHover() {
  chartMarkerEl.classList.remove('is-visible');
  chartTooltipEl.classList.remove('is-visible');
}

function showChartHoverAt(clientX: number) {
  if (!chartHoverData) {
    return;
  }
  const { values, times, formatValue, settings: localSettings } = chartHoverData;
  if (!values.length || !times.length) {
    return;
  }

  const rect = chartPlotEl.getBoundingClientRect();
  const width = rect.width || 1;
  const clampedX = Math.min(Math.max(clientX - rect.left, 0), width);
  const ratio = values.length === 1 ? 0.5 : clampedX / width;
  const index = Math.round(ratio * (values.length - 1));
  const indexRatio = values.length === 1 ? 0.5 : index / (values.length - 1);
  const value = values[index];
  const time = times[index];
  const label = `${formatHoverTime(time)} • ${formatValue(value, localSettings)}`;

  chartMarkerEl.style.left = `${indexRatio * 100}%`;
  chartMarkerEl.classList.add('is-visible');

  const tooltipRatio = Math.min(0.95, Math.max(0.05, indexRatio));
  chartTooltipEl.style.left = `${tooltipRatio * 100}%`;
  chartTooltipEl.textContent = label;
  chartTooltipEl.classList.add('is-visible');
}

function formatRange(values: number[], formatter: (min: number, max: number) => string) {
  if (!values.length) {
    return '--';
  }
  const min = Math.min(...values);
  const max = Math.max(...values);
  return formatter(min, max);
}

const METRIC_CONFIG: Record<
  ChartMetric,
  {
    label: string;
    color: string;
    minFloor?: number;
    getValues: (hourly: WeatherCacheItem['hourly']) => number[];
    formatRange: (values: number[], localSettings: Settings) => string;
    formatValue: (value: number, localSettings: Settings) => string;
  }
> = {
  temp: {
    label: 'Temp',
    color: '#e76f51',
    getValues: (hourly) => hourly.temperature,
    formatRange: (values, localSettings) =>
      formatRange(values, (min, max) => {
        const unit = TEMP_UNIT_LABEL[localSettings.tempUnit];
        return `${Math.round(min)}–${Math.round(max)}${unit}`;
      }),
    formatValue: (value, localSettings) => `${Math.round(value)}${TEMP_UNIT_LABEL[localSettings.tempUnit]}`,
  },
  wind: {
    label: 'Wind',
    color: '#2a9d8f',
    minFloor: 0,
    getValues: (hourly) => hourly.windSpeed,
    formatRange: (values, localSettings) =>
      formatRange(values, (min, max) => {
        const unit = WIND_UNIT_LABEL[localSettings.windUnit];
        return `${Math.round(min)}–${Math.round(max)} ${unit}`;
      }),
    formatValue: (value, localSettings) => `${Math.round(value)} ${WIND_UNIT_LABEL[localSettings.windUnit]}`,
  },
  humidity: {
    label: 'Humidity',
    color: '#4c6ef5',
    minFloor: 0,
    getValues: (hourly) => hourly.humidity,
    formatRange: (values) => formatRange(values, (min, max) => `${Math.round(min)}–${Math.round(max)}%`),
    formatValue: (value) => `${Math.round(value)}%`,
  },
  precip: {
    label: 'Precip',
    color: '#3a86ff',
    minFloor: 0,
    getValues: (hourly) => hourly.precipitation,
    formatRange: (values, localSettings) =>
      formatRange(values, (min, max) => {
        const decimals = localSettings.precipUnit === 'in' ? 2 : 1;
        return `${min.toFixed(decimals)}–${max.toFixed(decimals)} ${PRECIP_UNIT_LABEL[localSettings.precipUnit]}`;
      }),
    formatValue: (value, localSettings) => {
      const decimals = localSettings.precipUnit === 'in' ? 2 : 1;
      return `${value.toFixed(decimals)} ${PRECIP_UNIT_LABEL[localSettings.precipUnit]}`;
    },
  },
};

function getScaleBounds(values: number[], metricConfig: (typeof METRIC_CONFIG)[ChartMetric]) {
  if (!values.length) {
    return null;
  }
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || Math.abs(max) || 1;
  const padding = span * 0.1;
  let scaleMin = min === 0 ? min : min - padding;
  let scaleMax = max + padding;

  if (metricConfig.minFloor !== undefined) {
    scaleMin = Math.max(metricConfig.minFloor, scaleMin);
  }

  if (scaleMax === scaleMin) {
    scaleMax = scaleMin + 1;
  }
  return { min, max, scaleMin, scaleMax };
}

function updateChartTabs() {
  const tabs = Array.from(chartTabsEl.querySelectorAll<HTMLButtonElement>('.chart-tab'));
  tabs.forEach((tab) => {
    const metric = tab.dataset.metric as ChartMetric | undefined;
    const isActive = metric === activeMetric;
    tab.classList.toggle('is-active', isActive);
    tab.setAttribute('aria-selected', isActive ? 'true' : 'false');
  });
}

function renderHourlyCharts(cacheItem: WeatherCacheItem | null) {
  const localSettings = settings;
  if (!localSettings || !cacheItem || !cacheItem.hourly || !cacheItem.hourly.time.length) {
    chartRangeEl.textContent = '--';
    chartYMaxEl.textContent = '--';
    chartYMinEl.textContent = '--';
    clearSparkline(chartMainSvg);
    renderXAxisTicks([]);
    chartHoverData = null;
    hideChartHover();
    return;
  }

  const hourly = getHourlyForActiveDay(cacheItem);
  const { time } = hourly;
  if (!time.length) {
    chartRangeEl.textContent = '--';
    chartYMaxEl.textContent = '--';
    chartYMinEl.textContent = '--';
    clearSparkline(chartMainSvg);
    renderXAxisTicks([]);
    chartHoverData = null;
    hideChartHover();
    return;
  }
  const metricConfig = METRIC_CONFIG[activeMetric];
  const values = metricConfig.getValues(hourly);
  const bounds = getScaleBounds(values, metricConfig);
  if (!bounds) {
    chartYMaxEl.textContent = '--';
    chartYMinEl.textContent = '--';
    clearSparkline(chartMainSvg);
    renderXAxisTicks(time);
    chartHoverData = null;
    hideChartHover();
    return;
  }
  const { max, scaleMin, scaleMax } = bounds;
  const nowIndex = activeDayIndex === 0 ? findClosestTimeIndex(time, cacheItem.current.time) : undefined;
  chartRangeEl.textContent = formatChartRangeLabel(
    cacheItem.dailyForecast?.time?.[activeDayIndex],
    time,
    activeDayIndex,
  );

  renderSparkline(chartMainSvg, values, metricConfig.color, { min: scaleMin, max: scaleMax });
  chartYMaxEl.textContent = metricConfig.formatValue(max, localSettings);
  chartYMinEl.textContent = metricConfig.formatValue(scaleMin, localSettings);
  renderXAxisTicks(time, nowIndex);
  chartHoverData = {
    times: time,
    values,
    formatValue: metricConfig.formatValue,
    settings: localSettings,
  };
}

function pickPopupIconPath(iconName: string) {
  const iconPaths = getIconPaths(iconName);
  return (
    iconPaths[96] ??
    iconPaths[128] ??
    iconPaths[48] ??
    iconPaths[32] ??
    iconPaths[16] ??
    null
  );
}

function pickForecastIconPath(iconName: string) {
  const iconPaths = getIconPaths(iconName);
  return iconPaths[48] ?? iconPaths[32] ?? iconPaths[96] ?? iconPaths[16] ?? null;
}

function renderDailyForecast(cacheItem: WeatherCacheItem | null) {
  forecastRowEl.replaceChildren();
  if (!settings || !cacheItem?.dailyForecast) {
    const empty = document.createElement('div');
    empty.className = 'forecast-empty';
    empty.textContent = 'No forecast data yet.';
    forecastRowEl.appendChild(empty);
    return;
  }

  const { time, tempMax, tempMin, weatherCode } = cacheItem.dailyForecast;
  const dayCount = Math.min(time.length, tempMax.length, tempMin.length, weatherCode.length, 7);
  if (dayCount === 0) {
    const empty = document.createElement('div');
    empty.className = 'forecast-empty';
    empty.textContent = 'No forecast data yet.';
    forecastRowEl.appendChild(empty);
    return;
  }

  if (activeDayIndex < 0 || activeDayIndex >= dayCount) {
    activeDayIndex = 0;
  }

  for (let i = 0; i < dayCount; i += 1) {
    const card = document.createElement('button');
    card.type = 'button';
    card.className = 'forecast-card';
    card.dataset.index = String(i);
    const isActive = i === activeDayIndex;
    card.classList.toggle('is-active', isActive);
    card.setAttribute('aria-pressed', isActive ? 'true' : 'false');

    const dayEl = document.createElement('div');
    dayEl.className = 'forecast-day';
    dayEl.textContent = formatWeekdayLabel(time[i], i);

    const icon = document.createElement('img');
    icon.className = 'forecast-icon';
    const iconName = pickWeatherIconNameByCode(Number(weatherCode[i]), true);
    const iconPath = pickForecastIconPath(iconName);
    if (iconPath) {
      const description = describeWeatherCode(Number(weatherCode[i]));
      icon.src = iconPath;
      icon.alt = description;
      icon.title = description;
    } else {
      icon.alt = '';
    }

    const temps = document.createElement('div');
    temps.className = 'forecast-temps';

    const highEl = document.createElement('div');
    highEl.className = 'forecast-high';
    highEl.textContent = formatDailyTemp(tempMax[i], settings.tempUnit);

    const lowEl = document.createElement('div');
    lowEl.className = 'forecast-low';
    lowEl.textContent = formatDailyTemp(tempMin[i], settings.tempUnit);

    temps.append(highEl, lowEl);
    card.append(dayEl, icon, temps);
    forecastRowEl.appendChild(card);
  }
}

function renderWeather(location: Location) {
  const cacheItem = weatherCache[location.id];
  if (!cacheItem || !settings) {
    tempValueEl.textContent = '--';
    conditionEl.textContent = cacheItem ? describeWeatherCode(cacheItem.weatherCode) : 'No data yet';
    iconImg.classList.add('hidden');
    iconImg.src = '';
    iconImg.alt = '';
    feelsLikeEl.textContent = '--';
    precipEl.textContent = '--';
    windEl.textContent = '--';
    humidityEl.textContent = '--';
    tempMaxEl.textContent = '--';
    tempMinEl.textContent = '--';
    sunriseEl.textContent = '--';
    sunsetEl.textContent = '--';
    renderDailyForecast(null);
    renderHourlyCharts(null);
    setStatusLine('Refresh to load weather data.');
    return;
  }

  tempValueEl.textContent = `${Math.round(cacheItem.current.temperature)}${TEMP_UNIT_LABEL[settings.tempUnit]}`;
  conditionEl.textContent = describeWeatherCode(cacheItem.weatherCode);
  const iconName = pickWeatherIcon(cacheItem);
  const iconPath = pickPopupIconPath(iconName);
  if (iconPath) {
    iconImg.src = iconPath;
    iconImg.alt = describeWeatherCode(cacheItem.weatherCode);
    iconImg.classList.remove('hidden');
  } else {
    iconImg.classList.add('hidden');
  }
  feelsLikeEl.textContent = formatValue(cacheItem.current.apparentTemperature, TEMP_UNIT_LABEL[settings.tempUnit]);
  precipEl.textContent = formatPrecip(cacheItem.current.precipitation, settings.precipUnit);
  windEl.textContent = formatValue(cacheItem.current.windSpeed, WIND_UNIT_LABEL[settings.windUnit]);
  humidityEl.textContent = formatPercent(cacheItem.current.humidity);
  tempMaxEl.textContent = formatValue(cacheItem.daily.tempMax, TEMP_UNIT_LABEL[settings.tempUnit]);
  tempMinEl.textContent = formatValue(cacheItem.daily.tempMin, TEMP_UNIT_LABEL[settings.tempUnit]);
  sunriseEl.textContent = formatIsoTime(cacheItem.daily.sunrise);
  sunsetEl.textContent = formatIsoTime(cacheItem.daily.sunset);
  renderDailyForecast(cacheItem);
  renderHourlyCharts(cacheItem);
  setStatusLine(`Updated at ${formatTime(cacheItem.fetchedAt)} (${cacheItem.timezone})`);
}

function renderActiveLocation() {
  if (!locations.length || !settings) {
    showEmptyState();
    return;
  }

  showPopup();
  const safeIndex = Math.min(Math.max(activeIndex, 0), locations.length - 1);
  activeIndex = safeIndex;

  const location = locations[activeIndex];
  if (location.id !== activeLocationId) {
    activeDayIndex = 0;
    activeLocationId = location.id;
  }
  locationLabelEl.textContent = getLocationLabel(location, activeIndex);
  navStatusEl.textContent = `${activeIndex + 1} / ${locations.length}`;

  prevBtn.disabled = locations.length < 2;
  nextBtn.disabled = locations.length < 2;

  renderWeather(location);
}

async function refreshActiveLocation() {
  if (!locations.length) {
    return;
  }
  const location = locations[activeIndex];
  setStatusLine('Refreshing weather...');
  try {
    await browser.runtime.sendMessage({
      type: 'weather:refresh',
      locationId: location.id,
    });
  } catch (error) {
    console.warn('Refresh failed', error);
  }
  await loadData();
}

async function refreshAllLocations() {
  if (!locations.length) {
    return;
  }
  setStatusLine('Refreshing all locations...');
  try {
    await browser.runtime.sendMessage({
      type: 'weather:refresh',
    });
  } catch (error) {
    console.warn('Refresh failed', error);
  }
  await loadData();
}

async function loadData() {
  const [storedLocations, storedSettings, storedCache, storedActiveId] = await Promise.all([
    getLocations(),
    getSettings(),
    getWeatherCache(),
    getActiveLocationId(),
  ]);

  locations = storedLocations;
  settings = storedSettings;
  weatherCache = storedCache;

  if (storedActiveId) {
    const storedIndex = locations.findIndex((location) => location.id === storedActiveId);
    if (storedIndex >= 0) {
      activeIndex = storedIndex;
    }
  }

  renderActiveLocation();
}

prevBtn.addEventListener('click', async () => {
  if (!locations.length) {
    return;
  }
  activeIndex = (activeIndex - 1 + locations.length) % locations.length;
  await setActiveLocationId(locations[activeIndex].id);
  renderActiveLocation();
  void refreshActiveLocation();
});

nextBtn.addEventListener('click', async () => {
  if (!locations.length) {
    return;
  }
  activeIndex = (activeIndex + 1) % locations.length;
  await setActiveLocationId(locations[activeIndex].id);
  renderActiveLocation();
  void refreshActiveLocation();
});

refreshBtn.addEventListener('click', refreshActiveLocation);

openOptionsBtn.addEventListener('click', () => {
  void browser.runtime.openOptionsPage();
});

forecastRowEl.addEventListener('click', (event) => {
  const target = event.target as HTMLElement | null;
  const button = target?.closest<HTMLButtonElement>('.forecast-card');
  if (!button) {
    return;
  }
  const index = Number(button.dataset.index);
  if (!Number.isFinite(index) || index === activeDayIndex) {
    return;
  }
  activeDayIndex = index;
  const location = locations[activeIndex];
  if (location) {
    renderWeather(location);
  }
});

chartTabsEl.addEventListener('click', (event) => {
  const target = event.target as HTMLElement | null;
  const button = target?.closest<HTMLButtonElement>('button[data-metric]');
  if (!button) {
    return;
  }
  const metric = button.dataset.metric as ChartMetric | undefined;
  if (!metric || metric === activeMetric) {
    return;
  }
  activeMetric = metric;
  updateChartTabs();
  renderActiveLocation();
});

chartPlotEl.addEventListener('mousemove', (event) => {
  showChartHoverAt(event.clientX);
});

chartPlotEl.addEventListener('mouseleave', () => {
  hideChartHover();
});

chartPlotEl.addEventListener(
  'touchstart',
  (event) => {
    const touch = event.touches[0];
    if (!touch) {
      return;
    }
    showChartHoverAt(touch.clientX);
  },
  { passive: true },
);

chartPlotEl.addEventListener(
  'touchmove',
  (event) => {
    const touch = event.touches[0];
    if (!touch) {
      return;
    }
    showChartHoverAt(touch.clientX);
  },
  { passive: true },
);

chartPlotEl.addEventListener('touchend', () => {
  hideChartHover();
});

browser.storage.onChanged.addListener((changes, areaName) => {
  if (areaName !== 'local') {
    return;
  }
  if (changes.locations || changes.settings || changes.weatherCache) {
    void loadData();
  }
});

updateChartTabs();

void loadData().then(() => {
  if (locations.length) {
    void refreshAllLocations();
  }
});
