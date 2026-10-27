import { dayKey } from '@outfitiq/shared/engine.js';

export const fmtTemp = (c, unit = 'C') =>
  c == null ? '–' : unit === 'F' ? `${Math.round((c * 9) / 5 + 32)}°` : `${Math.round(c)}°`;

export const parseDay = key => {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
};

export function dayLabel(key) {
  const today = dayKey();
  const tomorrow = dayKey(Date.now() + 86400000);
  const yesterday = dayKey(Date.now() - 86400000);
  if (key === today) return 'Today';
  if (key === tomorrow) return 'Tomorrow';
  if (key === yesterday) return 'Yesterday';
  return parseDay(key).toLocaleDateString(undefined, { weekday: 'long' });
}

export const longDate = key => parseDay(key).toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' });
export const shortDate = key => parseDay(key).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });

export function greeting() {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
}

export const cx = (...parts) => parts.filter(Boolean).join(' ');
