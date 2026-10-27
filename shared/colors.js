// Color utilities shared by client and server: name a color, and judge how well
// a set of garment colors works together.

export const PALETTE = [
  ['Black', '#1c1c1e'], ['Charcoal', '#3d3f44'], ['Grey', '#8a8d93'], ['Light grey', '#c9cbcf'],
  ['White', '#f6f6f3'], ['Cream', '#efe6d2'], ['Beige', '#d8c3a0'], ['Khaki', '#b5a27a'],
  ['Tan', '#c19a6b'], ['Brown', '#6f4a2f'], ['Navy', '#1f2a44'], ['Denim', '#4a6587'],
  ['Blue', '#2f5fa8'], ['Light blue', '#9cc3e6'], ['Teal', '#1f7a7a'], ['Green', '#3f7d4a'],
  ['Olive', '#6b6b3a'], ['Mint', '#a9dcc4'], ['Yellow', '#e8c547'], ['Mustard', '#c9a227'],
  ['Orange', '#e07b39'], ['Rust', '#a5502a'], ['Red', '#c0392b'], ['Maroon', '#6d1f2a'],
  ['Pink', '#e8a0b4'], ['Purple', '#6b4c9a'], ['Lavender', '#b9a7d8'], ['Silver', '#b8bcc2'], ['Gold', '#c8a248'],
];

// Colors that pair with almost anything.
const NEUTRALS = new Set(['Black', 'Charcoal', 'Grey', 'Light grey', 'White', 'Cream', 'Beige', 'Khaki',
  'Tan', 'Brown', 'Navy', 'Denim', 'Silver', 'Gold']);

// Well-known combinations worth calling out.
const CLASSICS = [
  ['Navy', 'White'], ['Black', 'White'], ['Light blue', 'Navy'], ['Light blue', 'Khaki'], ['White', 'Denim'],
  ['Light blue', 'Charcoal'], ['Olive', 'Khaki'], ['Olive', 'White'], ['Maroon', 'Beige'], ['Navy', 'Khaki'],
  ['Black', 'Grey'], ['White', 'Khaki'], ['Pink', 'Navy'], ['Rust', 'Denim'], ['Mustard', 'Navy'],
  ['Light blue', 'Denim'], ['Cream', 'Brown'], ['Green', 'Beige'], ['Grey', 'Navy'], ['White', 'Olive'],
  ['Black', 'Denim'], ['White', 'Charcoal'], ['Maroon', 'Denim'], ['Olive', 'Black'],
];

export const hexToRgb = hex => {
  const n = parseInt(hex.replace('#', ''), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};
export const rgbToHex = (r, g, b) => '#' + [r, g, b].map(v => Math.round(v).toString(16).padStart(2, '0')).join('');

export function rgbToHsl(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0;
  const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
  }
  return { h, s, l };
}

function rgbToLab(r, g, b) {
  const lin = c => { c /= 255; return c > 0.04045 ? ((c + 0.055) / 1.055) ** 2.4 : c / 12.92; };
  const [R, G, B] = [lin(r), lin(g), lin(b)];
  const f = t => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  const x = f((R * 0.4124 + G * 0.3576 + B * 0.1805) / 0.95047);
  const y = f(R * 0.2126 + G * 0.7152 + B * 0.0722);
  const z = f((R * 0.0193 + G * 0.1192 + B * 0.9505) / 1.08883);
  return [116 * y - 16, 500 * (x - y), 200 * (y - z)];
}

const PALETTE_LAB = PALETTE
  .filter(([name]) => name !== 'Silver' && name !== 'Gold') // metals are only chosen manually
  .map(([name, hex]) => ({ name, lab: rgbToLab(...hexToRgb(hex)) }));

// Nearest named color (perceptual distance in Lab space).
export function nameOf(hex) {
  const lab = rgbToLab(...hexToRgb(hex));
  let best = PALETTE_LAB[0], bestD = Infinity;
  for (const p of PALETTE_LAB) {
    const d = (lab[0] - p.lab[0]) ** 2 + (lab[1] - p.lab[1]) ** 2 + (lab[2] - p.lab[2]) ** 2;
    if (d < bestD) { bestD = d; best = p; }
  }
  return best.name;
}

export const isNeutral = name => NEUTRALS.has(name);
const hueOf = hex => rgbToHsl(...hexToRgb(hex)).h;

export function shade(hex, amount) {
  const [r, g, b] = hexToRgb(hex);
  const t = amount < 0 ? 0 : 255, p = Math.abs(amount);
  return rgbToHex(r + (t - r) * p, g + (t - g) * p, b + (t - b) * p);
}

const hueDiff = (a, b) => { const d = Math.abs(a - b) % 360; return d > 180 ? 360 - d : d; };
const isClassic = (a, b) => CLASSICS.some(([x, y]) => (x === a && y === b) || (x === b && y === a));

// Judge the color story of the main pieces (first two = top + bottom).
// Returns a 0..1 score and one short explanation.
export function harmony(pieces) {
  const named = pieces.filter(Boolean).map(p => ({ name: p.colorName, hex: p.color }));
  const accents = [];
  named.forEach(c => { if (!isNeutral(c.name) && !accents.some(a => a.name === c.name)) accents.push(c); });
  const [a, b] = named;
  const classic = a && b && a.name !== b.name && isClassic(a.name, b.name);

  if (accents.length === 0) {
    if (a && b && a.name === b.name) {
      return { score: 0.74, note: { good: true, text: `Tonal ${a.name.toLowerCase()} look — contrast comes from shoes and accessories` } };
    }
    return classic
      ? { score: 0.95, note: { good: true, text: `${a.name} + ${b.name} is a timeless pairing` } }
      : { score: 0.86, note: { good: true, text: 'All-neutral palette — clean and easy to wear' } };
  }
  if (accents.length === 1) {
    return classic
      ? { score: 0.97, note: { good: true, text: `${a.name} + ${b.name} is a classic combination` } }
      : { score: 0.93, note: { good: true, text: `${accents[0].name} stands out against neutral pieces` } };
  }
  if (accents.length === 2) {
    const d = hueDiff(hueOf(accents[0].hex), hueOf(accents[1].hex));
    const pair = `${accents[0].name} + ${accents[1].name}`;
    if (classic) return { score: 0.9, note: { good: true, text: `${pair} is a proven pairing` } };
    if (d < 25) return { score: 0.82, note: { good: true, text: `${pair}: tonal, harmonious colors` } };
    if (d <= 60) return { score: 0.78, note: { good: true, text: `${pair}: neighbouring colors blend well` } };
    if (d >= 150) return { score: 0.74, note: { good: true, text: `${pair}: bold complementary contrast` } };
    return { score: 0.45, note: { good: false, text: `${pair} may clash — try a neutral instead` } };
  }
  const spread = Math.max(...accents.map(x => Math.max(...accents.map(y => hueDiff(hueOf(x.hex), hueOf(y.hex))))));
  return spread < 60
    ? { score: 0.68, note: { good: true, text: 'Several related colors — keep accessories neutral' } }
    : { score: 0.3, note: { good: false, text: 'Too many colors competing' } };
}
