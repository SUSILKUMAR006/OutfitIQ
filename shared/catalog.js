// Wardrobe vocabulary shared by client and server.

export const CATEGORIES = [
  { id: 'top', label: 'Tops', single: 'Top', subtypes: ['Shirt', 'T-shirt', 'Polo', 'Kurta', 'Blouse', 'Top', 'Sweater', 'Hoodie'] },
  { id: 'bottom', label: 'Bottoms', single: 'Bottom', subtypes: ['Jeans', 'Chinos', 'Trousers', 'Shorts', 'Joggers', 'Skirt'] },
  { id: 'onepiece', label: 'Dresses', single: 'Dress', subtypes: ['Dress', 'Jumpsuit', 'Saree'] },
  { id: 'outerwear', label: 'Layers', single: 'Layer', subtypes: ['Jacket', 'Blazer', 'Overshirt', 'Cardigan', 'Coat'] },
  { id: 'shoes', label: 'Shoes', single: 'Shoes', subtypes: ['Sneakers', 'Formal shoes', 'Loafers', 'Boots', 'Sandals', 'Sports shoes', 'Heels', 'Flats'] },
  { id: 'watch', label: 'Watches', single: 'Watch', subtypes: ['Analog watch', 'Dress watch', 'Smart watch', 'Sports watch'] },
  { id: 'accessory', label: 'Accessories', single: 'Accessory', subtypes: ['Belt', 'Sunglasses', 'Cap', 'Bag', 'Tie', 'Scarf', 'Bracelet', 'Necklace'] },
];

// Sensible defaults so users rarely need to fill in details by hand.
export const SUBTYPE_DEFAULTS = {
  Shirt: ['smart', 1], 'T-shirt': ['casual', 1], Polo: ['casual', 1], Kurta: ['smart', 1], Blouse: ['smart', 1],
  Top: ['casual', 1], Sweater: ['smart', 3], Hoodie: ['casual', 2],
  Jeans: ['casual', 2], Chinos: ['smart', 2], Trousers: ['formal', 2], Shorts: ['casual', 1], Joggers: ['sport', 2], Skirt: ['smart', 1],
  Dress: ['smart', 1], Jumpsuit: ['casual', 1], Saree: ['formal', 1],
  Jacket: ['casual', 2], Blazer: ['formal', 2], Overshirt: ['casual', 1], Cardigan: ['smart', 2], Coat: ['formal', 3],
  Sneakers: ['casual', 1], 'Formal shoes': ['formal', 1], Loafers: ['smart', 1], Boots: ['casual', 2], Sandals: ['casual', 1],
  'Sports shoes': ['sport', 1], Heels: ['formal', 1], Flats: ['smart', 1],
  'Analog watch': ['smart', 1], 'Dress watch': ['formal', 1], 'Smart watch': ['casual', 1], 'Sports watch': ['sport', 1],
  Belt: ['smart', 1], Sunglasses: ['casual', 1], Cap: ['casual', 1], Bag: ['smart', 1], Tie: ['formal', 1],
  Scarf: ['smart', 2], Bracelet: ['casual', 1], Necklace: ['smart', 1],
};

export const STYLES = [
  { id: 'sport', label: 'Sporty', level: 0 },
  { id: 'casual', label: 'Casual', level: 1 },
  { id: 'smart', label: 'Smart', level: 2 },
  { id: 'formal', label: 'Formal', level: 3 },
];

export const WARMTH = [
  { id: 1, label: 'Light' },
  { id: 2, label: 'Medium' },
  { id: 3, label: 'Warm' },
];

// `target` is the ideal average style level (see STYLES).
export const OCCASIONS = [
  { id: 'work', label: 'Work', emoji: '💼', target: 2.3 },
  { id: 'college', label: 'College', emoji: '🎒', target: 1.2 },
  { id: 'outing', label: 'Outing', emoji: '☕', target: 1.3 },
  { id: 'party', label: 'Party / Date', emoji: '✨', target: 2 },
  { id: 'formal', label: 'Formal event', emoji: '🎩', target: 3 },
  { id: 'gym', label: 'Gym / Sport', emoji: '🏃', target: 0 },
];

export const WEATHER_PRESETS = [
  { id: 'hot', label: 'Hot', temp: 33, sunny: true, rain: false, code: 0 },
  { id: 'warm', label: 'Warm', temp: 27, sunny: true, rain: false, code: 1 },
  { id: 'mild', label: 'Mild', temp: 21, sunny: false, rain: false, code: 2 },
  { id: 'cool', label: 'Cool', temp: 14, sunny: false, rain: false, code: 3 },
  { id: 'cold', label: 'Cold', temp: 5, sunny: false, rain: false, code: 3 },
  { id: 'rainy', label: 'Rainy', temp: 22, sunny: false, rain: true, code: 63 },
];

// Categories that go into the laundry basket after wearing.
export const WASHABLE = new Set(['top', 'bottom', 'onepiece', 'outerwear']);

export const categoryById = id => CATEGORIES.find(c => c.id === id);

export function defaultsFor(subtype) {
  const [style, warmth] = SUBTYPE_DEFAULTS[subtype] || ['casual', 1];
  return { style, warmth };
}

// Guess the garment type from a photo's file name ("blue-jeans.jpg" → Jeans).
const FILENAME_HINTS = [
  [/t-?shirt|tee\b/i, 'T-shirt'], [/polo/i, 'Polo'], [/kurta/i, 'Kurta'], [/blouse/i, 'Blouse'], [/sweater|jumper|pullover/i, 'Sweater'],
  [/hoodie|sweatshirt/i, 'Hoodie'], [/shirt/i, 'Shirt'], [/jean|denim/i, 'Jeans'], [/chino/i, 'Chinos'], [/trouser|pant|slack/i, 'Trousers'],
  [/short/i, 'Shorts'], [/jogger|track/i, 'Joggers'], [/skirt/i, 'Skirt'], [/dress/i, 'Dress'], [/jumpsuit/i, 'Jumpsuit'], [/saree|sari/i, 'Saree'],
  [/blazer|suit/i, 'Blazer'], [/coat/i, 'Coat'], [/cardigan/i, 'Cardigan'], [/jacket/i, 'Jacket'],
  [/sneaker|trainer/i, 'Sneakers'], [/oxford|derby|formal.?shoe/i, 'Formal shoes'], [/loafer/i, 'Loafers'], [/boot/i, 'Boots'],
  [/sandal|slipper|flip/i, 'Sandals'], [/running|sport.?shoe/i, 'Sports shoes'], [/heel/i, 'Heels'],
  [/smart.?watch|apple.?watch/i, 'Smart watch'], [/watch/i, 'Analog watch'], [/belt/i, 'Belt'], [/sunglass|shades/i, 'Sunglasses'],
  [/\b(cap|hat)\b/i, 'Cap'], [/bag|backpack/i, 'Bag'], [/\btie\b/i, 'Tie'], [/scarf/i, 'Scarf'], [/bracelet/i, 'Bracelet'], [/necklace|chain/i, 'Necklace'],
];

export function guessSubtype(filename, categoryId) {
  const cat = categoryById(categoryId);
  for (const [re, subtype] of FILENAME_HINTS) {
    if (re.test(filename) && (!cat || cat.subtypes.includes(subtype))) return subtype;
  }
  return cat ? cat.subtypes[0] : 'Shirt';
}

// Open-Meteo weather codes → label + icon name.
export function weatherInfo(code) {
  if (code === 0) return { label: 'Clear', icon: 'sun' };
  if (code <= 2) return { label: 'Partly cloudy', icon: 'partly' };
  if (code === 3) return { label: 'Overcast', icon: 'cloud' };
  if (code <= 48) return { label: 'Foggy', icon: 'fog' };
  if (code <= 67 || (code >= 80 && code <= 82)) return { label: 'Rain', icon: 'rain' };
  if (code <= 77 || code === 85 || code === 86) return { label: 'Snow', icon: 'snow' };
  return { label: 'Thunderstorm', icon: 'storm' };
}
