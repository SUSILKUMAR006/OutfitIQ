// Gemini vision: look at a garment photo and fill in type, color, style and warmth.
// Needs GEMINI_API_KEY in server/.env; GEMINI_MODEL optionally overrides the model.
import { CATEGORIES, STYLES, defaultsFor } from '@outfitiq/shared/catalog.js';
import { PALETTE, nameOf } from '@outfitiq/shared/colors.js';

const ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models';
const DEFAULT_MODEL = 'gemini-3.5-flash-lite'; // fast (~3 s/photo) and accurate enough for tagging

const SUBTYPES = CATEGORIES.flatMap(c => c.subtypes);
const COLOR_NAMES = PALETTE.map(([name]) => name);
const PALETTE_HEX = Object.fromEntries(PALETTE);
const HEX = /^#[0-9a-f]{6}$/i;

const PROMPT = `You are tagging a single clothing item or accessory for a digital wardrobe app.
Look only at the main garment in the photo and ignore the background, hangers, hands and other objects.
- subtype: the closest garment type from the allowed list.
- colorName: the closest color name from the allowed list for the garment's dominant color.
- colorHex: the garment's dominant color as #rrggbb (fabric color, not the background or lighting).
- style: sport (athletic wear), casual (everyday), smart (smart-casual, office-ready), formal (suits, dress shoes, evening).
- warmth: "1" light/summer, "2" medium, "3" warm/winter. Use "1" for shoes, watches and accessories.
- name: a short, natural item name of 2–4 words, e.g. "Navy oxford shirt", "White leather sneakers".
- isClothing: false if the photo does not show a clothing item, shoe, watch or accessory.`;

const SCHEMA = {
  type: 'OBJECT',
  properties: {
    isClothing: { type: 'BOOLEAN' },
    subtype: { type: 'STRING', enum: SUBTYPES },
    colorName: { type: 'STRING', enum: COLOR_NAMES },
    colorHex: { type: 'STRING', description: 'Dominant garment color as #rrggbb' },
    style: { type: 'STRING', enum: STYLES.map(s => s.id) },
    warmth: { type: 'STRING', enum: ['1', '2', '3'] },
    name: { type: 'STRING', description: 'Short item name, 2-4 words' },
  },
  required: ['isClothing', 'subtype', 'colorName', 'colorHex', 'style', 'warmth', 'name'],
  propertyOrdering: ['isClothing', 'subtype', 'colorName', 'colorHex', 'style', 'warmth', 'name'],
};

export const aiEnabled = () => Boolean(process.env.GEMINI_API_KEY);
export const aiModel = () => process.env.GEMINI_MODEL || DEFAULT_MODEL;

export class AiError extends Error {
  constructor(message, status = 502) { super(message); this.status = status; }
}

/** Ask Gemini to tag a garment photo. Returns validated fields ready for an item. */
export async function tagGarment(buffer, mimeType) {
  if (!aiEnabled()) throw new AiError('AI tagging is not configured (set GEMINI_API_KEY in server/.env).', 501);

  let res;
  try {
    res = await fetch(`${ENDPOINT}/${aiModel()}:generateContent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': process.env.GEMINI_API_KEY },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ inlineData: { mimeType, data: buffer.toString('base64') } }, { text: PROMPT }] }],
        generationConfig: { responseMimeType: 'application/json', responseSchema: SCHEMA, temperature: 0.1 },
      }),
      signal: AbortSignal.timeout(30000),
    });
  } catch (err) {
    throw new AiError(err.name === 'TimeoutError' ? 'AI tagging timed out.' : 'Could not reach Gemini.');
  }

  const body = await res.json().catch(() => null);
  if (!res.ok) {
    const msg = body?.error?.message || `Gemini returned ${res.status}`;
    console.warn('Gemini error:', res.status, msg);
    throw new AiError(res.status === 429 ? 'AI is busy (rate limit) — try again in a moment.' : 'AI tagging failed.', res.status === 429 ? 429 : 502);
  }

  const text = body?.candidates?.[0]?.content?.parts?.map(p => p.text || '').join('') || '';
  let raw;
  try { raw = JSON.parse(text); } catch { throw new AiError('AI returned an unreadable answer.'); }
  return normalize(raw);
}

// Never trust model output blindly: clamp everything to values the app understands.
function normalize(raw) {
  const subtype = SUBTYPES.includes(raw.subtype) ? raw.subtype : null;
  if (!subtype) throw new AiError('AI could not identify the item.');
  const category = CATEGORIES.find(c => c.subtypes.includes(subtype)).id;
  const defaults = defaultsFor(subtype);
  const colorName = COLOR_NAMES.includes(raw.colorName) ? raw.colorName : null;
  const color = HEX.test(raw.colorHex) ? raw.colorHex.toLowerCase() : PALETTE_HEX[colorName] || null;
  const warmth = Number(raw.warmth);
  return {
    isClothing: raw.isClothing !== false,
    category,
    subtype,
    color,
    colorName: colorName || (color ? nameOf(color) : null),
    style: STYLES.some(s => s.id === raw.style) ? raw.style : defaults.style,
    warmth: [1, 2, 3].includes(warmth) ? warmth : defaults.warmth,
    name: tidyName(raw.name),
  };
}

// "Blue Denim Jeans" → "Blue denim jeans", to match the app's naming style.
function tidyName(name) {
  if (typeof name !== 'string' || !name.trim()) return null;
  const n = name.trim().slice(0, 60);
  const words = n.split(/\s+/);
  const titleCase = words.length > 1 && words.every(w => /^[A-Z][a-z]/.test(w));
  return titleCase ? n[0] + n.slice(1).toLowerCase() : n;
}
