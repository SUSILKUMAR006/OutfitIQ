// Outfit endpoints: today's pick, every combination, and the week planner.
import express from 'express';
import {
  addDays, countCombinations, dayKey, generateOutfits, missingPieces,
  outfitFromIds, pickForDay, planDays, scoreOutfit, accessorize,
} from '@outfitiq/shared/engine.js';
import { db } from '../db.js';
import { DATE, OCCASION_IDS, baseContext, defaultOccasion, slim } from '../services.js';
import { presetContext, weatherForDates } from '../weather.js';

const router = express.Router();

// The client sends its own local date so "today" matches the user's time zone.
const requestDate = req => (DATE.test(req.query.date) ? req.query.date : dayKey());

router.get('/today', async (req, res) => {
  const { items, history, settings } = db();
  const today = requestDate(req);
  const occasion = OCCASION_IDS.has(req.query.occasion) ? req.query.occasion : defaultOccasion(settings, today);
  const shuffle = Math.max(0, parseInt(req.query.shuffle, 10) || 0);

  let weather = presetContext(req.query.weather);
  let forecastInfo = null, weatherError = null;
  if (!weather) {
    const w = await weatherForDates(settings, [today]);
    weather = w.days[0];
    forecastInfo = w.info;
    weatherError = w.error || null;
  }

  const ctx = { ...baseContext(today), occasion, weather };
  const missing = missingPieces(items);
  const worn = history.find(h => h.date === today) || null;
  const result = missing.length ? { main: null, alternatives: [], total: 0 } : pickForDay(items, ctx, shuffle);

  // Until the user shuffles, show what they already logged for today.
  let main = result.main;
  if (worn && shuffle === 0) {
    const o = outfitFromIds(worn.itemIds, items);
    if (o) main = { ...scoreOutfit(o, ctx), watch: o.watch, accessory: o.accessory };
  }

  res.json({
    date: today,
    occasion,
    weather,
    current: forecastInfo?.current || null,
    location: settings.location,
    weatherError,
    missing,
    total: result.total,
    main: slim(main),
    alternatives: result.alternatives.filter(a => a.key !== main?.key).map(slim),
    worn,
  });
});

router.get('/outfits', async (req, res) => {
  const { items, settings } = db();
  const today = requestDate(req);
  const occasion = OCCASION_IDS.has(req.query.occasion) ? req.query.occasion : null;
  const limit = Math.min(96, Math.max(1, parseInt(req.query.limit, 10) || 24));
  const offset = Math.max(0, parseInt(req.query.offset, 10) || 0);
  const minScore = Math.max(0, parseInt(req.query.min, 10) || 0);

  let weather = null;
  if (req.query.weather === 'auto') weather = (await weatherForDates(settings, [today])).days[0];
  else if (req.query.weather) weather = presetContext(req.query.weather);

  const ctx = { ...baseContext(today), occasion, weather };
  const all = generateOutfits(items, ctx, { onlyClean: req.query.clean === '1', includeId: req.query.item || undefined });
  const filtered = minScore ? all.filter(o => o.score >= minScore) : all;
  const by = cat => items.filter(i => i.category === cat && (req.query.clean !== '1' || i.clean !== false));
  const page = filtered.slice(offset, offset + limit).map(o => slim(accessorize(o, by('watch'), by('accessory'), ctx)));

  res.json({
    possible: countCombinations(items),
    total: all.length,
    great: all.filter(o => o.score >= 80).length,
    matching: filtered.length,
    weather,
    outfits: page,
  });
});

router.get('/week', async (req, res) => {
  const { items, settings } = db();
  const start = requestDate(req);
  const swaps = String(req.query.swaps || '').split(',').map(n => parseInt(n, 10) || 0);
  const dates = Array.from({ length: 7 }, (_, i) => addDays(start, i));
  const { days: weathers, error } = await weatherForDates(settings, dates);

  const days = dates.map((date, i) => ({
    date,
    occasion: defaultOccasion(settings, date),
    weather: weathers[i],
    swap: swaps[i] || 0,
  }));
  const plan = missingPieces(items).length ? days.map(d => ({ ...d, outfit: null })) : planDays(items, days, baseContext(start));
  res.json({ weatherError: error || null, location: settings.location, days: plan.map(d => ({ ...d, outfit: slim(d.outfit) })) });
});

export default router;
