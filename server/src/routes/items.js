// Wardrobe items: upload photos (batch), edit, delete, laundry.
import express from 'express';
import multer from 'multer';
import fs from 'node:fs/promises';
import path from 'node:path';
import { CATEGORIES, STYLES, WASHABLE, defaultsFor } from '@outfitiq/shared/catalog.js';
import { nameOf } from '@outfitiq/shared/colors.js';
import { db, save, uid, UPLOAD_DIR } from '../db.js';

const router = express.Router();

const EXT = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp', 'image/gif': '.gif', 'image/avif': '.avif' };
const upload = multer({
  storage: multer.diskStorage({
    destination: UPLOAD_DIR,
    filename: (req, file, cb) => cb(null, uid() + (EXT[file.mimetype] || '.jpg')),
  }),
  limits: { fileSize: 10 * 1024 * 1024, files: 60 },
  fileFilter: (req, file, cb) => cb(null, file.mimetype in EXT),
});

const CATEGORY_IDS = new Set(CATEGORIES.map(c => c.id));
const STYLE_IDS = new Set(STYLES.map(s => s.id));
const HEX = /^#[0-9a-f]{6}$/i;

// Accept only known fields with valid values.
function clean(input, base = {}) {
  const out = { ...base };
  if (CATEGORY_IDS.has(input.category)) out.category = input.category;
  const cat = CATEGORIES.find(c => c.id === out.category);
  if (typeof input.subtype === 'string' && cat?.subtypes.includes(input.subtype)) out.subtype = input.subtype;
  if (cat && !cat.subtypes.includes(out.subtype)) out.subtype = cat.subtypes[0];
  if (HEX.test(input.color)) out.color = input.color.toLowerCase();
  if (typeof input.colorName === 'string' && input.colorName.trim()) out.colorName = input.colorName.trim().slice(0, 30);
  else if (out.color && (!base.colorName || input.color)) out.colorName = nameOf(out.color);
  if (STYLE_IDS.has(input.style)) out.style = input.style;
  if ([1, 2, 3].includes(Number(input.warmth))) out.warmth = Number(input.warmth);
  if (typeof input.name === 'string' && input.name.trim()) out.name = input.name.trim().slice(0, 60);
  if (typeof input.clean === 'boolean') {
    out.clean = input.clean;
    if (input.clean && base.clean === false) out.wearsSinceWash = 0; // just came back from the wash
  }
  return out;
}

async function removeImage(image) {
  if (!image?.startsWith('/uploads/')) return;
  await fs.unlink(path.join(UPLOAD_DIR, path.basename(image))).catch(() => {});
}

router.get('/', (req, res) => res.json(db().items));

// multipart: images[] + meta (JSON array, one entry per image, same order)
router.post('/', upload.array('images'), async (req, res) => {
  let meta = [];
  try { meta = JSON.parse(req.body.meta || '[]'); } catch { /* fall back to defaults */ }
  const created = (req.files || []).map((file, i) => {
    const m = meta[i] || {};
    const item = clean(m, { category: 'top', color: '#888888' });
    const defaults = defaultsFor(item.subtype);
    return {
      id: uid(),
      ...item,
      colorName: item.colorName || nameOf(item.color),
      style: item.style || defaults.style,
      warmth: item.warmth || defaults.warmth,
      name: item.name || `${item.colorName || nameOf(item.color)} ${item.subtype.toLowerCase()}`,
      image: `/uploads/${file.filename}`,
      clean: true,
      wearCount: 0,
      wearsSinceWash: 0,
      createdAt: Date.now() + i,
    };
  });
  if (!created.length) return res.status(400).json({ error: 'No valid images received (JPEG, PNG, WebP, GIF or AVIF, max 10 MB each).' });
  db().items.push(...created);
  await save();
  res.status(201).json(created);
});

router.patch('/:id', async (req, res) => {
  const items = db().items;
  const idx = items.findIndex(i => i.id === req.params.id);
  if (idx < 0) return res.status(404).json({ error: 'Item not found' });
  items[idx] = clean(req.body || {}, items[idx]);
  await save();
  res.json(items[idx]);
});

router.delete('/:id', async (req, res) => {
  const d = db();
  const item = d.items.find(i => i.id === req.params.id);
  if (!item) return res.status(404).json({ error: 'Item not found' });
  d.items = d.items.filter(i => i.id !== item.id);
  d.favorites = d.favorites.filter(f => !f.itemIds.includes(item.id));
  await removeImage(item.image);
  await save();
  res.json({ ok: true });
});

router.post('/wash-all', async (req, res) => {
  for (const item of db().items) {
    if (WASHABLE.has(item.category)) { item.clean = true; item.wearsSinceWash = 0; }
  }
  await save();
  res.json(db().items);
});

router.delete('/', async (req, res) => {
  const d = db();
  await Promise.all(d.items.map(i => removeImage(i.image)));
  d.items = [];
  d.history = [];
  d.favorites = [];
  await save();
  res.json({ ok: true });
});

export default router;
