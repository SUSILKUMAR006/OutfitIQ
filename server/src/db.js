// Tiny JSON-file database. Single user, all data in server/data/db.json.
// Writes are serialized and atomic (write temp file, then rename).
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
// Override with OUTFITIQ_DATA / OUTFITIQ_UPLOADS (e.g. for a separate test instance).
export const DATA_DIR = process.env.OUTFITIQ_DATA || path.join(ROOT, 'data');
export const UPLOAD_DIR = process.env.OUTFITIQ_UPLOADS || path.join(ROOT, 'uploads');
const FILE = path.join(DATA_DIR, 'db.json');

export const DEFAULT_SETTINGS = {
  location: null,          // { name, lat, lon }
  unit: 'C',
  repeatDays: 4,           // avoid re-wearing the same top/bottom within N days
  washAfter: 2,            // send washable items to laundry after N wears (0 = never)
  weekdayOccasion: 'work',
  weekendOccasion: 'outing',
  weekOccasions: {},       // per-date overrides { 'YYYY-MM-DD': occasion }
};

let data = null;
let queue = Promise.resolve();

export async function load() {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.mkdir(UPLOAD_DIR, { recursive: true });
  try {
    const parsed = JSON.parse(await fs.readFile(FILE, 'utf8'));
    data = {
      items: parsed.items || [],
      history: parsed.history || [],
      favorites: parsed.favorites || [],
      settings: { ...DEFAULT_SETTINGS, ...(parsed.settings || {}) },
    };
  } catch (err) {
    if (err.code !== 'ENOENT') console.warn('Could not read db.json, starting fresh:', err.message);
    data = { items: [], history: [], favorites: [], settings: { ...DEFAULT_SETTINGS } };
  }
  return data;
}

export const db = () => data;

export function save() {
  const snapshot = JSON.stringify(data, null, 2);
  queue = queue.then(async () => {
    const tmp = FILE + '.tmp';
    await fs.writeFile(tmp, snapshot);
    await fs.rename(tmp, FILE);
  }).catch(err => console.error('Failed to save db:', err));
  return queue;
}

export const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
