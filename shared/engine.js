// Outfit engine: builds every top/bottom/shoes(/layer) combination from the wardrobe,
// scores each one (color, style, occasion, weather, freshness) and picks daily / weekly looks.
import { harmony } from './colors.js';
import { STYLES, OCCASIONS } from './catalog.js';

const LEVEL = Object.fromEntries(STYLES.map(s => [s.id, s.level]));
const STYLE_LABEL = Object.fromEntries(STYLES.map(s => [s.id, s.label]));
const MAX_COMBOS = 150000;

const clamp = (v, lo = 0, hi = 1) => Math.max(lo, Math.min(hi, v));

export function dayKey(date = new Date()) {
  const d = new Date(date);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
export function addDays(key, n) {
  const [y, m, d] = key.split('-').map(Number);
  return dayKey(new Date(y, m - 1, d + n));
}
export function daysBetween(fromKey, toKey) {
  const parse = k => { const [y, m, d] = k.split('-').map(Number); return Date.UTC(y, m - 1, d); };
  return Math.round((parse(toKey) - parse(fromKey)) / 86400000);
}
export function hash(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

// itemId → most recent date it was worn.
export function lastWornMap(history) {
  const map = {};
  for (const entry of history) {
    for (const id of entry.itemIds) if (!map[id] || map[id] < entry.date) map[id] = entry.date;
  }
  return map;
}

export const outfitKey = o => [o.top, o.bottom, o.onepiece, o.outerwear, o.shoes].filter(Boolean).map(i => i.id).join('|');
export const outfitItems = o => [o.top, o.bottom, o.onepiece, o.outerwear, o.shoes, o.watch, o.accessory].filter(Boolean);

// Ideal total warmth (top + bottom + layer, each 1–3) for a temperature in °C.
function warmthTarget(t) {
  if (t >= 30) return 2;
  if (t >= 25) return 2.5;
  if (t >= 20) return 3;
  if (t >= 15) return 4;
  if (t >= 10) return 5;
  return 6;
}

/**
 * Score one outfit.
 * ctx: { occasion: id|null, weather: {temp °C, rain, sunny}|null, lastWorn: {id: date}, today: 'YYYY-MM-DD', repeatDays, unit: 'C'|'F' }
 */
export function scoreOutfit(o, ctx) {
  const notes = [];
  const core = [o.top, o.bottom, o.onepiece, o.outerwear, o.shoes].filter(Boolean);

  // 1. Color harmony
  const color = harmony(o.onepiece ? [o.onepiece, o.outerwear, o.shoes] : [o.top, o.bottom, o.outerwear, o.shoes]);
  notes.push(color.note);

  // 2. Style coherence — pieces should sit at a similar level of formality
  const levels = core.map(i => LEVEL[i.style] ?? 1);
  const avgLevel = levels.reduce((a, b) => a + b, 0) / levels.length;
  const spread = Math.max(...levels) - Math.min(...levels);
  const style = [1, 0.86, 0.5, 0.2][spread];
  if (spread >= 2) {
    const lo = core.find(i => LEVEL[i.style] === Math.min(...levels));
    const hi = core.find(i => LEVEL[i.style] === Math.max(...levels));
    notes.push({ good: false, text: `${STYLE_LABEL[lo.style]} ${lo.subtype.toLowerCase()} with ${STYLE_LABEL[hi.style].toLowerCase()} ${hi.subtype.toLowerCase()} feels mismatched` });
  }

  // 3. Occasion fit
  let occasion = 0.85;
  const occ = OCCASIONS.find(x => x.id === ctx.occasion);
  if (occ) {
    const dev = avgLevel - occ.target;
    occasion = clamp(1 - Math.abs(dev) * 0.45);
    const bottomType = (o.bottom || {}).subtype;
    if (occ.id === 'work' && (bottomType === 'Shorts' || levels.includes(0))) {
      occasion *= 0.3;
      notes.push({ good: false, text: `${bottomType === 'Shorts' ? 'Shorts aren’t' : 'Sportswear isn’t'} office-friendly` });
    } else if (occ.id === 'gym' && o.shoes && o.shoes.style !== 'sport') {
      occasion *= 0.5;
      notes.push({ good: false, text: 'Swap in sports shoes for training' });
    } else if (occ.id === 'formal' && o.shoes && LEVEL[o.shoes.style] < 2) {
      occasion *= 0.5;
      notes.push({ good: false, text: 'Dress shoes would suit a formal event better' });
    } else if (occasion >= 0.8) {
      notes.push({ good: true, text: `Right level of polish for ${occ.label.toLowerCase()}` });
    } else if (occasion < 0.55) {
      notes.push({ good: false, text: `A bit ${dev < 0 ? 'casual' : 'dressy'} for ${occ.label.toLowerCase()}` });
    }
  }

  // 4. Weather fit
  let weather = 0.85;
  const w = ctx.weather;
  if (w && typeof w.temp === 'number') {
    const warmth = (o.top?.warmth || 0) + (o.bottom?.warmth || 0) + (o.onepiece ? o.onepiece.warmth * 2 : 0) + (o.outerwear?.warmth || 0);
    const diff = warmth - warmthTarget(w.temp);
    weather = clamp(1 - Math.abs(diff) * 0.22);
    const t = ctx.unit === 'F' ? `${Math.round(w.temp * 9 / 5 + 32)}°F` : `${Math.round(w.temp)}°C`;
    if (o.outerwear && w.temp >= 26) {
      weather -= 0.3;
      notes.push({ good: false, text: `Skip the ${o.outerwear.subtype.toLowerCase()} — it’s ${t} out` });
    } else if (o.bottom?.subtype === 'Shorts' && w.temp < 18) {
      weather -= 0.3;
      notes.push({ good: false, text: `Shorts will feel chilly at ${t}` });
    } else if (diff > 1) notes.push({ good: false, text: `Might feel warm at ${t}` });
    else if (diff < -1) notes.push({ good: false, text: `Might feel cold at ${t} — add a layer` });
    else notes.push({ good: true, text: `Comfortable for ${t}${w.rain ? ' and rain' : ''}` });

    if (w.rain && o.shoes?.subtype === 'Sandals') {
      weather -= 0.25;
      notes.push({ good: false, text: 'Rain likely — closed shoes are safer' });
    }
    weather = clamp(weather);
  }

  // 5. Freshness — avoid repeating the same pieces within `repeatDays`
  let fresh = 1;
  const repeatDays = ctx.repeatDays ?? 0;
  if (repeatDays > 0 && ctx.lastWorn && ctx.today) {
    const weights = { top: 0.55, bottom: 0.3, onepiece: 0.65, outerwear: 0.1, shoes: 0.1 };
    let penalty = 0, worst = null;
    for (const item of core) {
      const last = ctx.lastWorn[item.id];
      if (!last) continue;
      const days = daysBetween(last, ctx.today);
      if (days >= 0 && days < repeatDays) {
        const p = weights[item.category] * (1 - days / repeatDays);
        penalty += p;
        if (!worst || p > worst.p) worst = { p, item, days };
      }
    }
    fresh = clamp(1 - penalty);
    if (worst && worst.p >= 0.15) {
      const when = worst.days === 0 ? 'today' : worst.days === 1 ? 'yesterday' : `${worst.days} days ago`;
      notes.push({ good: false, text: `You wore the ${worst.item.name.toLowerCase()} ${when}` });
    }
  }

  const score = Math.round(100 * (color.score * 0.34 + style * 0.22 + occasion * 0.2 + weather * 0.14 + fresh * 0.1));
  // Show positives first, then at most two warnings.
  const good = notes.filter(n => n.good), bad = notes.filter(n => !n.good);
  return {
    ...o,
    key: outfitKey(o),
    score,
    styleLevel: avgLevel,
    parts: { color: color.score, style, occasion, weather, fresh },
    notes: [...bad.slice(0, 2), ...good.slice(0, 3)],
  };
}

// Choose the watch and one accessory that best finish an outfit.
export function accessorize(outfit, watches, accessories, ctx) {
  const avg = outfit.styleLevel ?? 1.5;
  const jitter = id => (hash(outfit.key + id + (ctx.today || '')) % 100) / 1000;

  let watch = null, bestW = -Infinity;
  for (const w of watches) {
    const s = 1 - Math.abs((LEVEL[w.style] ?? 1) - avg) * 0.4 + jitter(w.id);
    if (s > bestW) { bestW = s; watch = w; }
  }

  const occ = ctx.occasion, wx = ctx.weather || {};
  const bottomType = outfit.bottom?.subtype;
  let accessory = null, bestA = 0.55;
  for (const a of accessories) {
    let s = 1 - Math.abs((LEVEL[a.style] ?? 1) - avg) * 0.35 + jitter(a.id);
    switch (a.subtype) {
      case 'Sunglasses': s += wx.sunny && ['outing', 'college', 'party'].includes(occ) ? 0.3 : wx.rain || ['work', 'formal'].includes(occ) ? -0.6 : -0.1; break;
      case 'Belt': s += ['Jeans', 'Chinos', 'Trousers'].includes(bottomType) ? 0.25 : -1; break;
      case 'Cap': s -= avg >= 1.8 || occ === 'formal' || occ === 'work' ? 0.8 : 0; break;
      case 'Tie': s += occ === 'formal' || (occ === 'work' && avg >= 2.2) ? 0.4 : -1; break;
      case 'Scarf': s += typeof wx.temp === 'number' && wx.temp < 12 ? 0.4 : -0.8; break;
      default: break;
    }
    if (s > bestA) { bestA = s; accessory = a; }
  }
  return { ...outfit, watch, accessory };
}

function groupByCategory(items) {
  const by = { top: [], bottom: [], onepiece: [], outerwear: [], shoes: [], watch: [], accessory: [] };
  for (const item of items) (by[item.category] ||= []).push(item);
  return by;
}

// What's missing before outfits can be generated.
export function missingPieces(items) {
  const by = groupByCategory(items);
  const missing = [];
  if (!by.onepiece.length && !by.top.length) missing.push('top');
  if (!by.onepiece.length && !by.bottom.length) missing.push('bottom');
  if (!by.shoes.length) missing.push('shoes');
  return missing;
}

// Count combinations without scoring them.
export function countCombinations(items) {
  const by = groupByCategory(items);
  const bases = by.top.length * by.bottom.length + by.onepiece.length;
  return bases * by.shoes.length * (1 + by.outerwear.length);
}

/**
 * Every combination, scored and sorted best-first.
 * opts.onlyClean — skip items in the laundry; opts.includeId — only outfits containing this item.
 */
export function generateOutfits(items, ctx, opts = {}) {
  const pool = opts.onlyClean ? items.filter(i => i.clean !== false) : items;
  const by = groupByCategory(pool);
  const bases = [];
  for (const top of by.top) for (const bottom of by.bottom) bases.push({ top, bottom });
  for (const onepiece of by.onepiece) bases.push({ onepiece });

  // Layers are pointless in the heat; also cap the search space for huge wardrobes.
  let layers = [null];
  if (!(ctx.weather && ctx.weather.temp >= 27)) layers = [null, ...by.outerwear];
  if (bases.length * by.shoes.length * layers.length > MAX_COMBOS) layers = [null];

  const out = [];
  for (const base of bases) {
    for (const shoes of by.shoes) {
      for (const outerwear of layers) {
        const o = { ...base, shoes, outerwear };
        if (opts.includeId && !outfitKey(o).split('|').includes(opts.includeId)) continue;
        out.push(scoreOutfit(o, ctx));
      }
    }
  }
  out.sort((a, b) => b.score - a.score);
  return out;
}

// Re-order a ranked list so consecutive picks don't reuse the same top (or dress).
export function diversify(list, n) {
  const res = [], usedMain = new Set(), bottomUse = new Map();
  for (const o of list) {
    const main = (o.top || o.onepiece).id;
    const b = o.bottom?.id;
    if (usedMain.has(main) || (b && (bottomUse.get(b) || 0) >= 2)) continue;
    usedMain.add(main);
    if (b) bottomUse.set(b, (bottomUse.get(b) || 0) + 1);
    res.push(o);
    if (res.length >= n) return res;
  }
  for (const o of list) {
    if (res.length >= n) break;
    if (!res.includes(o)) res.push(o);
  }
  return res;
}

/** Today's main outfit and alternatives. Stable for the day; `shuffle` steps through options. */
export function pickForDay(items, ctx, shuffle = 0) {
  const all = generateOutfits(items, ctx, { onlyClean: true });
  const options = diversify(all, 12);
  if (!options.length) return { main: null, alternatives: [], total: 0 };
  const by = groupByCategory(items.filter(i => i.clean !== false));
  const start = hash(ctx.today || '') % Math.min(3, options.length);
  const idx = (start + shuffle) % options.length;
  const finish = o => accessorize(o, by.watch, by.accessory, ctx);
  const alternatives = [];
  for (let k = 1; k < options.length && alternatives.length < 3; k++) alternatives.push(finish(options[(idx + k) % options.length]));
  return { main: finish(options[idx]), alternatives, total: all.length };
}

/**
 * Plan several days ahead. days: [{ date, occasion, weather, swap }].
 * Spreads tops/bottoms across the week; assumes laundry is done by then.
 */
export function planDays(items, days, baseCtx) {
  const by = groupByCategory(items);
  const used = { main: new Map(), bottom: new Map(), shoes: new Map() };
  const bump = (m, id) => id && m.set(id, (m.get(id) || 0) + 1);
  return days.map(day => {
    const ctx = { ...baseCtx, occasion: day.occasion, weather: day.weather, today: day.date };
    const ranked = generateOutfits(items, ctx)
      .map(o => ({
        o,
        adj: o.score
          - (used.main.get((o.top || o.onepiece).id) || 0) * 28
          - (used.bottom.get(o.bottom?.id) || 0) * 9
          - (used.shoes.get(o.shoes.id) || 0) * 3,
      }))
      .sort((a, b) => b.adj - a.adj)
      .map(x => x.o);
    const options = diversify(ranked, 6);
    if (!options.length) return { ...day, outfit: null };
    const choice = options[(day.swap || 0) % options.length];
    bump(used.main, (choice.top || choice.onepiece).id);
    bump(used.bottom, choice.bottom?.id);
    bump(used.shoes, choice.shoes.id);
    return { ...day, outfit: accessorize(choice, by.watch, by.accessory, ctx) };
  });
}

// Rebuild an outfit from saved item ids (for history / favorites / worn-today).
export function outfitFromIds(ids, items) {
  const byId = new Map(items.map(i => [i.id, i]));
  const o = {};
  for (const id of ids) {
    const item = byId.get(id);
    if (item) o[item.category] = item;
  }
  if (!o.shoes || !(o.onepiece || (o.top && o.bottom))) return null;
  return o;
}
