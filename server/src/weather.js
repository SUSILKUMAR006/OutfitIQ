// Weather via Open-Meteo (free, no API key). Forecasts are cached for 30 minutes.
import { WEATHER_PRESETS } from '@outfitiq/shared/catalog.js';

const TTL = 30 * 60 * 1000;
const cache = new Map();
const RAIN_CODES = new Set([51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82, 95, 96, 99]);

// One retry: the first request after start-up occasionally stalls on DNS / connection setup.
async function fetchJson(url, attempts = 2) {
  for (let i = 1; ; i++) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(6000) });
      if (!res.ok) throw new Error(`Weather service returned ${res.status}`);
      return await res.json();
    } catch (err) {
      if (i >= attempts) throw err;
    }
  }
}

export async function forecast(loc) {
  const key = `${loc.lat.toFixed(2)},${loc.lon.toFixed(2)}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL) return hit.value;

  const url = new URL('https://api.open-meteo.com/v1/forecast');
  url.search = new URLSearchParams({
    latitude: loc.lat,
    longitude: loc.lon,
    current: 'temperature_2m,weather_code,is_day',
    daily: 'temperature_2m_max,temperature_2m_min,weather_code,precipitation_probability_max',
    timezone: 'auto',
    forecast_days: '8',
  });
  let j;
  try {
    j = await fetchJson(url);
  } catch (err) {
    if (hit) return hit.value; // stale forecast beats no forecast
    throw err;
  }
  const value = {
    location: loc.name,
    current: { temp: j.current.temperature_2m, code: j.current.weather_code, isDay: !!j.current.is_day },
    daily: j.daily.time.map((date, i) => ({
      date,
      max: j.daily.temperature_2m_max[i],
      min: j.daily.temperature_2m_min[i],
      code: j.daily.weather_code[i],
      rainProb: j.daily.precipitation_probability_max[i] ?? 0,
    })),
  };
  cache.set(key, { at: Date.now(), value });
  return value;
}

// Turn a forecast day into what the outfit engine needs (daytime "feels like" temperature).
export function dayContext(day) {
  return {
    temp: Math.round(day.max * 0.65 + day.min * 0.35),
    max: day.max,
    min: day.min,
    code: day.code,
    rain: day.rainProb >= 50 || RAIN_CODES.has(day.code),
    sunny: day.code <= 1,
    source: 'forecast',
  };
}

export function presetContext(id) {
  const p = WEATHER_PRESETS.find(x => x.id === id);
  return p ? { temp: p.temp, code: p.code, rain: p.rain, sunny: p.sunny, preset: p.id, source: 'manual' } : null;
}

// Weather for each requested date, or null where unavailable.
export async function weatherForDates(settings, dates) {
  if (!settings.location) return { info: null, days: dates.map(() => null) };
  try {
    const f = await forecast(settings.location);
    const days = dates.map(d => {
      const day = f.daily.find(x => x.date === d);
      return day ? dayContext(day) : null;
    });
    return { info: f, days };
  } catch (err) {
    console.warn('Weather unavailable:', err.message);
    return { info: null, days: dates.map(() => null), error: 'Weather unavailable right now' };
  }
}

export async function geocode(q) {
  const url = new URL('https://geocoding-api.open-meteo.com/v1/search');
  url.search = new URLSearchParams({ name: q, count: '6', language: 'en', format: 'json' });
  const j = await fetchJson(url);
  return (j.results || []).map(r => ({
    name: [r.name, r.admin1, r.country].filter(Boolean).join(', '),
    lat: r.latitude,
    lon: r.longitude,
  }));
}
