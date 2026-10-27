// Wardrobe operations shared by the REST routes and the AI stylist agent's tools.
import { OCCASIONS, WASHABLE } from '@outfitiq/shared/catalog.js';
import { lastWornMap } from '@outfitiq/shared/engine.js';
import { db, save, uid } from './db.js';

export const OCCASION_IDS = new Set(OCCASIONS.map(o => o.id));
export const DATE = /^\d{4}-\d{2}-\d{2}$/;

// Weekday/weekend default unless the user picked an occasion for that date.
export function defaultOccasion(settings, date) {
  if (settings.weekOccasions?.[date]) return settings.weekOccasions[date];
  const [y, m, d] = date.split('-').map(Number);
  const weekday = new Date(y, m - 1, d).getDay();
  return weekday === 0 || weekday === 6 ? settings.weekendOccasion : settings.weekdayOccasion;
}

// Engine context shared by every scoring call: what was worn before `today`, repeat window, unit.
export function baseContext(today) {
  const { history, settings } = db();
  return { today, lastWorn: lastWornMap(history.filter(h => h.date < today)), repeatDays: settings.repeatDays, unit: settings.unit };
}

// Strip heavy/duplicate fields; clients already have the full items list.
export const slim = o => o && {
  key: o.key,
  score: o.score,
  notes: o.notes,
  parts: o.parts,
  itemIds: ['top', 'bottom', 'onepiece', 'outerwear', 'shoes', 'watch', 'accessory'].map(k => o[k]?.id).filter(Boolean),
};

function undo(entry) {
  const byId = new Map(db().items.map(i => [i.id, i]));
  for (const id of entry.itemIds) {
    const item = byId.get(id);
    if (!item) continue;
    item.wearCount = Math.max(0, (item.wearCount || 0) - 1);
    if (WASHABLE.has(item.category)) item.wearsSinceWash = Math.max(0, (item.wearsSinceWash || 0) - 1);
  }
  for (const id of entry.dirtied || []) {
    const item = byId.get(id);
    if (item) item.clean = true;
  }
  db().history = db().history.filter(h => h.id !== entry.id);
}

/** Log an outfit as worn on `date`, replacing anything already logged that day. Returns the entry or null. */
export async function logWear({ itemIds, date, occasion, score }) {
  const d = db();
  const byId = new Map(d.items.map(i => [i.id, i]));
  const ids = Array.isArray(itemIds) ? itemIds.filter(id => byId.has(id)) : [];
  if (!ids.length) return null;

  const existing = d.history.find(h => h.date === date);
  if (existing) undo(existing);

  const entry = { id: uid(), date, itemIds: ids, occasion: OCCASION_IDS.has(occasion) ? occasion : null, score: Number(score) || null, dirtied: [] };
  for (const id of ids) {
    const item = byId.get(id);
    item.wearCount = (item.wearCount || 0) + 1;
    if (!WASHABLE.has(item.category)) continue;
    item.wearsSinceWash = (item.wearsSinceWash || 0) + 1;
    if (d.settings.washAfter > 0 && item.wearsSinceWash >= d.settings.washAfter && item.clean !== false) {
      item.clean = false;
      entry.dirtied.push(id);
    }
  }
  d.history.push(entry);
  await save();
  return entry;
}

/** Remove the log for `date`. Returns false if nothing was logged. */
export async function undoWear(date) {
  const entry = db().history.find(h => h.date === date);
  if (!entry) return false;
  undo(entry);
  await save();
  return true;
}

/** Save an outfit to favorites (no duplicates). */
export async function addFavorite(itemIds) {
  const ids = Array.isArray(itemIds) ? itemIds.filter(id => typeof id === 'string') : [];
  if (!ids.length) return null;
  const key = [...ids].sort().join('|');
  const d = db();
  let fav = d.favorites.find(f => [...f.itemIds].sort().join('|') === key);
  if (!fav) {
    fav = { id: uid(), itemIds: ids, createdAt: Date.now() };
    d.favorites.unshift(fav);
    await save();
  }
  return fav;
}
