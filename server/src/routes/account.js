// Settings, weather lookup, wear log (history) and favorites.
import express from 'express';
import { dayKey } from '@outfitiq/shared/engine.js';
import { db, save, DEFAULT_SETTINGS } from '../db.js';
import { forecast, geocode } from '../weather.js';
import { DATE, OCCASION_IDS, addFavorite, logWear, undoWear } from '../services.js';

const router = express.Router();

// ---- settings ----
router.get('/settings', (req, res) => res.json(db().settings));

router.put('/settings', async (req, res) => {
  const s = db().settings;
  const b = req.body || {};
  if (b.location === null) s.location = null;
  else if (b.location && Number.isFinite(b.location.lat) && Number.isFinite(b.location.lon)) {
    s.location = { name: String(b.location.name || 'My location').slice(0, 120), lat: b.location.lat, lon: b.location.lon };
  }
  if (['C', 'F'].includes(b.unit)) s.unit = b.unit;
  if (Number.isInteger(b.repeatDays) && b.repeatDays >= 0 && b.repeatDays <= 14) s.repeatDays = b.repeatDays;
  if (Number.isInteger(b.washAfter) && b.washAfter >= 0 && b.washAfter <= 10) s.washAfter = b.washAfter;
  if (OCCASION_IDS.has(b.weekdayOccasion)) s.weekdayOccasion = b.weekdayOccasion;
  if (OCCASION_IDS.has(b.weekendOccasion)) s.weekendOccasion = b.weekendOccasion;
  if (b.weekOccasion && DATE.test(b.weekOccasion.date)) {
    // Keep only upcoming overrides so this map doesn't grow forever.
    const today = dayKey();
    s.weekOccasions = Object.fromEntries(Object.entries(s.weekOccasions || {}).filter(([d]) => d >= today));
    if (OCCASION_IDS.has(b.weekOccasion.occasion)) s.weekOccasions[b.weekOccasion.date] = b.weekOccasion.occasion;
    else delete s.weekOccasions[b.weekOccasion.date];
  }
  await save();
  res.json(s);
});

router.post('/settings/reset', async (req, res) => {
  db().settings = { ...DEFAULT_SETTINGS };
  await save();
  res.json(db().settings);
});

// ---- weather ----
router.get('/geocode', async (req, res) => {
  const q = String(req.query.q || '').trim();
  if (q.length < 2) return res.json([]);
  try {
    res.json(await geocode(q));
  } catch (err) {
    res.status(502).json({ error: 'Location search is unavailable right now.' });
  }
});

router.get('/weather', async (req, res) => {
  const loc = db().settings.location;
  if (!loc) return res.json(null);
  try {
    res.json(await forecast(loc));
  } catch {
    res.status(502).json({ error: 'Weather unavailable right now.' });
  }
});

// ---- wear log ----
router.get('/history', (req, res) => {
  res.json([...db().history].sort((a, b) => b.date.localeCompare(a.date)));
});

// Log an outfit as worn on a date (replaces anything already logged that day).
router.post('/wear', async (req, res) => {
  const { itemIds, occasion, score } = req.body || {};
  const date = DATE.test(req.body?.date) ? req.body.date : dayKey();
  const entry = await logWear({ itemIds, date, occasion, score });
  if (!entry) return res.status(400).json({ error: 'No valid items in this outfit.' });
  res.status(201).json({ entry, items: db().items });
});

router.delete('/wear/:date', async (req, res) => {
  if (!(await undoWear(req.params.date))) return res.status(404).json({ error: 'Nothing logged for that day.' });
  res.json({ ok: true, items: db().items });
});

// ---- favorites ----
router.get('/favorites', (req, res) => res.json(db().favorites));

router.post('/favorites', async (req, res) => {
  const fav = await addFavorite(req.body?.itemIds);
  if (!fav) return res.status(400).json({ error: 'No items given.' });
  res.status(201).json(fav);
});

router.delete('/favorites/:id', async (req, res) => {
  db().favorites = db().favorites.filter(f => f.id !== req.params.id);
  await save();
  res.json({ ok: true });
});

export default router;
