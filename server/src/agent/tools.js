// Tools the AI stylist can call. Each has a Gemini function declaration and a `run` that works on real data.
// Results are compact JSON with item ids *and* names so the model can reason and reference items.
import { CATEGORIES, OCCASIONS, WEATHER_PRESETS, weatherInfo } from '@outfitiq/shared/catalog.js';
import {
  accessorize, addDays, daysBetween, diversify, generateOutfits, missingPieces, outfitFromIds, planDays, scoreOutfit,
} from '@outfitiq/shared/engine.js';
import { db, save } from '../db.js';
import { presetContext, weatherForDates } from '../weather.js';
import { DATE, OCCASION_IDS, addFavorite, baseContext, defaultOccasion, logWear, slim } from '../services.js';

const OCCASION_ENUM = OCCASIONS.map(o => o.id);
const CATEGORY_ENUM = CATEGORIES.map(c => c.id);
const PRESET_ENUM = WEATHER_PRESETS.map(p => p.id);
const ids = { type: 'ARRAY', items: { type: 'STRING' } };
const dateParam = { type: 'STRING', description: 'Date as YYYY-MM-DD. Defaults to today.' };

// Friendly date for progress labels: "today", "tomorrow", "Saturday" or the date itself.
function when(date, today) {
  if (!DATE.test(date || '') || date === today) return 'today';
  const diff = daysBetween(today, date);
  if (diff === 1) return 'tomorrow';
  if (diff > 1 && diff < 7) return new Date(`${date}T12:00:00`).toLocaleDateString('en-US', { weekday: 'long' });
  return date;
}

const itemName = id => db().items.find(i => i.id === id)?.name || 'unknown item';
const validDate = (date, today) => (DATE.test(date || '') ? date : today);

async function weatherFor(date) {
  const { days, error } = await weatherForDates(db().settings, [date]);
  return { weather: days[0], error };
}

function describeWeather(w) {
  if (!w) return null;
  return {
    condition: weatherInfo(w.code).label,
    highC: w.max ?? w.temp,
    lowC: w.min ?? w.temp,
    feelsLikeC: w.temp,
    rainLikely: !!w.rain,
    source: w.source,
  };
}

// Compact outfit description for the model.
function present(o) {
  const s = slim(o);
  return { itemIds: s.itemIds, items: s.itemIds.map(itemName), score: s.score, reasons: s.notes.map(n => (n.good ? '' : 'Warning: ') + n.text) };
}

async function contextFor({ date, occasion, weather }, today) {
  const day = validDate(date, today);
  const occ = OCCASION_IDS.has(occasion) ? occasion : defaultOccasion(db().settings, day);
  const w = PRESET_ENUM.includes(weather) ? presetContext(weather) : (await weatherFor(day)).weather;
  return { ...baseContext(day), today: day, occasion: occ, weather: w };
}

export const TOOLS = {
  list_wardrobe: {
    label: () => 'Looked through your wardrobe',
    declaration: {
      description: 'List the clothes, shoes, watches and accessories the user owns. Use this before recommending specific items.',
      parameters: {
        type: 'OBJECT',
        properties: {
          category: { type: 'STRING', enum: CATEGORY_ENUM, description: 'Only this category.' },
          cleanOnly: { type: 'BOOLEAN', description: 'Skip items that are in the laundry.' },
        },
      },
    },
    run({ category, cleanOnly }, { today }) {
      const history = db().history;
      const lastWorn = id => history.filter(h => h.itemIds.includes(id)).map(h => h.date).sort().pop() || null;
      const items = db().items
        .filter(i => (!category || i.category === category) && (!cleanOnly || i.clean !== false))
        .map(i => ({
          id: i.id, name: i.name, category: i.category, type: i.subtype, color: i.colorName, style: i.style,
          warmth: ['', 'light', 'medium', 'warm'][i.warmth] || 'n/a', inLaundry: i.clean === false,
          timesWorn: i.wearCount || 0, lastWorn: lastWorn(i.id), daysSinceWorn: lastWorn(i.id) ? daysBetween(lastWorn(i.id), today) : null,
        }));
      return { count: items.length, items, missingForOutfits: missingPieces(db().items) };
    },
  },

  get_weather: {
    label: (a, c) => `Checked the weather for ${when(a.date, c.today)}`,
    declaration: {
      description: 'Get the forecast for a date (up to 7 days ahead) at the user\'s saved location.',
      parameters: { type: 'OBJECT', properties: { date: dateParam } },
    },
    async run({ date }, { today }) {
      const day = validDate(date, today);
      if (!db().settings.location) return { available: false, reason: 'No city set. The user can add one in Settings.' };
      const { weather, error } = await weatherFor(day);
      if (!weather) return { available: false, reason: error || 'No forecast for that date (only the next 7 days are available).' };
      return { available: true, date: day, location: db().settings.location.name, ...describeWeather(weather) };
    },
  },

  find_outfits: {
    label: (a, c) => `Searched outfits${a.occasion ? ` for ${a.occasion}` : ''} · ${when(a.date, c.today)}`,
    declaration: {
      description: 'Generate every outfit combination from the wardrobe, score them for the occasion, weather and recent wear, and return the best distinct options.',
      parameters: {
        type: 'OBJECT',
        properties: {
          occasion: { type: 'STRING', enum: OCCASION_ENUM, description: 'Defaults to the user\'s usual occasion for that day.' },
          date: dateParam,
          weather: { type: 'STRING', enum: PRESET_ENUM, description: 'Override the forecast with a weather type, e.g. when the user describes the conditions.' },
          mustInclude: { ...ids, description: 'Item ids that every outfit must contain.' },
          exclude: { ...ids, description: 'Item ids to leave out.' },
          cleanOnly: { type: 'BOOLEAN', description: 'Skip laundry items. Defaults to true for today, false for future dates.' },
          limit: { type: 'INTEGER', description: 'How many outfits to return (1-6, default 3).' },
        },
      },
    },
    async run(args, { today }) {
      const ctx = await contextFor(args, today);
      const exclude = new Set(args.exclude || []);
      const cleanOnly = args.cleanOnly ?? ctx.today === today;
      const pool = db().items.filter(i => !exclude.has(i.id));
      const missing = missingPieces(cleanOnly ? pool.filter(i => i.clean !== false) : pool);
      if (missing.length) return { outfits: [], problem: `Not enough ${cleanOnly ? 'clean ' : ''}items: missing ${missing.join(', ')}.` };

      const must = (args.mustInclude || []).filter(id => pool.some(i => i.id === id));
      let all = generateOutfits(pool, ctx, { onlyClean: cleanOnly });
      if (must.length) all = all.filter(o => must.every(id => o.key.split('|').includes(id)));
      const limit = Math.min(6, Math.max(1, args.limit || 3));
      const by = c => pool.filter(i => i.category === c && (!cleanOnly || i.clean !== false));
      const best = diversify(all, limit).map(o => present(accessorize(o, by('watch'), by('accessory'), ctx)));
      return {
        date: ctx.today, occasion: ctx.occasion, weather: describeWeather(ctx.weather),
        combinationsConsidered: all.length, outfits: best,
      };
    },
  },

  score_outfit: {
    label: () => 'Scored an outfit',
    declaration: {
      description: 'Score a specific combination the user suggests (needs shoes plus a top and bottom, or a dress).',
      parameters: {
        type: 'OBJECT',
        properties: { itemIds: ids, occasion: { type: 'STRING', enum: OCCASION_ENUM }, date: dateParam },
        required: ['itemIds'],
      },
    },
    async run(args, { today }) {
      const o = outfitFromIds(args.itemIds || [], db().items);
      if (!o) return { error: 'Not a complete outfit: it needs shoes plus a top and bottom (or a dress). Check the item ids.' };
      const ctx = await contextFor(args, today);
      return { occasion: ctx.occasion, ...present({ ...scoreOutfit(o, ctx), watch: o.watch, accessory: o.accessory }) };
    },
  },

  plan_week: {
    label: () => 'Planned your week',
    declaration: {
      description: 'Plan outfits for several upcoming days using the forecast, so tops and bottoms are not repeated.',
      parameters: {
        type: 'OBJECT',
        properties: { startDate: dateParam, days: { type: 'INTEGER', description: 'Number of days, 1-7 (default 7).' } },
      },
    },
    async run({ startDate, days }, { today }) {
      const start = validDate(startDate, today);
      const n = Math.min(7, Math.max(1, days || 7));
      const items = db().items;
      if (missingPieces(items).length) return { error: `Wardrobe is missing: ${missingPieces(items).join(', ')}.` };
      const dates = Array.from({ length: n }, (_, i) => addDays(start, i));
      const { days: weathers } = await weatherForDates(db().settings, dates);
      const plan = planDays(items, dates.map((date, i) => ({ date, occasion: defaultOccasion(db().settings, date), weather: weathers[i] })), baseContext(start));
      return {
        days: plan.map(d => ({
          date: d.date,
          weekday: new Date(`${d.date}T12:00:00`).toLocaleDateString('en-US', { weekday: 'long' }),
          occasion: d.occasion,
          weather: describeWeather(d.weather),
          outfit: d.outfit ? present(d.outfit) : null,
        })),
      };
    },
  },

  get_wear_history: {
    label: () => 'Checked what you wore recently',
    declaration: {
      description: 'What the user logged as worn recently.',
      parameters: { type: 'OBJECT', properties: { days: { type: 'INTEGER', description: 'How many days back (default 14).' } } },
    },
    run({ days }, { today }) {
      const back = Math.min(90, Math.max(1, days || 14));
      const entries = db().history
        .filter(h => daysBetween(h.date, today) >= 0 && daysBetween(h.date, today) < back)
        .sort((a, b) => b.date.localeCompare(a.date))
        .map(h => ({ date: h.date, occasion: h.occasion, itemIds: h.itemIds, items: h.itemIds.map(itemName) }));
      return { entries };
    },
  },

  log_wear: {
    mutates: true,
    label: () => 'Logged the outfit as worn',
    declaration: {
      description: 'Record that the user wore these items on a date (replaces any outfit already logged that day). Only when the user says they are wearing or wore it.',
      parameters: {
        type: 'OBJECT',
        properties: { itemIds: ids, date: dateParam, occasion: { type: 'STRING', enum: OCCASION_ENUM } },
        required: ['itemIds'],
      },
    },
    async run(args, { today }) {
      const date = validDate(args.date, today);
      const entry = await logWear({ itemIds: args.itemIds, date, occasion: args.occasion });
      if (!entry) return { error: 'None of those item ids exist.' };
      return { logged: true, date, items: entry.itemIds.map(itemName), sentToLaundry: entry.dirtied.map(itemName) };
    },
  },

  save_favorite: {
    mutates: true,
    label: () => 'Saved to favorites',
    declaration: {
      description: 'Save an outfit to the user\'s favorites.',
      parameters: { type: 'OBJECT', properties: { itemIds: ids }, required: ['itemIds'] },
    },
    async run({ itemIds }) {
      const valid = (itemIds || []).filter(id => db().items.some(i => i.id === id));
      if (!valid.length) return { error: 'None of those item ids exist.' };
      await addFavorite(valid);
      return { saved: true, items: valid.map(itemName) };
    },
  },

  set_laundry: {
    mutates: true,
    label: a => (a.inLaundry ? 'Moved items to the laundry' : 'Marked items as clean'),
    declaration: {
      description: 'Put items in the laundry (inLaundry=true) or mark them clean (false). Laundry items are skipped for today\'s outfits.',
      parameters: {
        type: 'OBJECT',
        properties: { itemIds: ids, inLaundry: { type: 'BOOLEAN' } },
        required: ['itemIds', 'inLaundry'],
      },
    },
    async run({ itemIds, inLaundry }) {
      const changed = db().items.filter(i => (itemIds || []).includes(i.id));
      if (!changed.length) return { error: 'None of those item ids exist.' };
      for (const i of changed) {
        i.clean = !inLaundry;
        if (!inLaundry) i.wearsSinceWash = 0;
      }
      await save();
      return { updated: changed.map(i => i.name), inLaundry: !!inLaundry };
    },
  },

  set_occasion: {
    mutates: true,
    label: (a, c) => `Set ${when(a.date, c.today)} as ${a.occasion}`,
    declaration: {
      description: 'Remember the occasion for a specific upcoming date (used by the planner and daily picks).',
      parameters: {
        type: 'OBJECT',
        properties: { date: dateParam, occasion: { type: 'STRING', enum: OCCASION_ENUM } },
        required: ['date', 'occasion'],
      },
    },
    async run({ date, occasion }, { today }) {
      if (!DATE.test(date || '') || date < today) return { error: 'Use an upcoming date as YYYY-MM-DD.' };
      if (!OCCASION_IDS.has(occasion)) return { error: 'Unknown occasion.' };
      const s = db().settings;
      s.weekOccasions = { ...(s.weekOccasions || {}), [date]: occasion };
      await save();
      return { date, occasion };
    },
  },

  show_outfits: {
    label: () => null,
    declaration: {
      description: 'Display outfits to the user as picture cards. Call this whenever you recommend specific outfits (max 3), using item ids from other tools.',
      parameters: {
        type: 'OBJECT',
        properties: {
          outfits: {
            type: 'ARRAY',
            items: {
              type: 'OBJECT',
              properties: {
                itemIds: ids,
                title: { type: 'STRING', description: 'Short title, e.g. "Saturday wedding"' },
                note: { type: 'STRING', description: 'One sentence on why it works.' },
              },
              required: ['itemIds'],
            },
          },
        },
        required: ['outfits'],
      },
    },
    async run({ outfits }, { today, shown }) {
      const valid = [];
      for (const o of (outfits || []).slice(0, 3)) {
        const itemIds = (o.itemIds || []).filter(id => db().items.some(i => i.id === id));
        if (!itemIds.length) continue;
        const built = outfitFromIds(itemIds, db().items);
        const score = built ? scoreOutfit(built, await contextFor({}, today)).score : null;
        valid.push({ itemIds, title: String(o.title || '').slice(0, 80), note: String(o.note || '').slice(0, 240), score });
      }
      shown.push(...valid);
      return { shown: valid.length };
    },
  },
};

export const declarations = Object.entries(TOOLS).map(([name, t]) => ({ name, ...t.declaration }));
