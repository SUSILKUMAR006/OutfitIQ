import { dayKey } from '@outfitiq/shared/engine.js';

async function request(method, url, body) {
  const isForm = body instanceof FormData;
  const res = await fetch(url, {
    method,
    headers: body && !isForm ? { 'Content-Type': 'application/json' } : undefined,
    body: isForm ? body : body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(data?.error || `Request failed (${res.status})`);
  return data;
}

const qs = params => {
  const p = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => { if (v !== undefined && v !== null && v !== '') p.set(k, v); });
  return p.toString();
};

export const api = {
  items: () => request('GET', '/api/items'),
  uploadItems: form => request('POST', '/api/items', form),
  updateItem: (id, patch) => request('PATCH', `/api/items/${id}`, patch),
  deleteItem: id => request('DELETE', `/api/items/${id}`),
  washAll: () => request('POST', '/api/items/wash-all'),
  resetAll: () => request('DELETE', '/api/items'),

  aiStatus: () => request('GET', '/api/ai/status'),
  // AI stylist: streams NDJSON events ({type:'tool'|'done'|'error', ...}) to onEvent as they arrive.
  agentChat: async (messages, onEvent) => {
    const res = await fetch('/api/agent/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages, date: dayKey() }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => null);
      throw new Error(data?.error || `Request failed (${res.status})`);
    }
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let nl;
      while ((nl = buffer.indexOf('\n')) >= 0) {
        const line = buffer.slice(0, nl).trim();
        buffer = buffer.slice(nl + 1);
        if (line) onEvent(JSON.parse(line));
      }
    }
  },
  tagImage: blob => {
    const form = new FormData();
    form.append('image', blob, 'photo.jpg');
    return request('POST', '/api/ai/tag', form);
  },

  settings: () => request('GET', '/api/settings'),
  saveSettings: patch => request('PUT', '/api/settings', patch),
  geocode: q => request('GET', `/api/geocode?${qs({ q })}`),

  today: ({ occasion, shuffle, weather }) => request('GET', `/api/today?${qs({ occasion, shuffle, weather, date: dayKey() })}`),
  outfits: params => request('GET', `/api/outfits?${qs({ ...params, date: dayKey() })}`),
  week: swaps => request('GET', `/api/week?${qs({ swaps: swaps.join(','), date: dayKey() })}`),

  history: () => request('GET', '/api/history'),
  wear: ({ itemIds, occasion, score, date = dayKey() }) => request('POST', '/api/wear', { itemIds, occasion, score, date }),
  unwear: date => request('DELETE', `/api/wear/${date}`),
  favorites: () => request('GET', '/api/favorites'),
  addFavorite: itemIds => request('POST', '/api/favorites', { itemIds }),
  removeFavorite: id => request('DELETE', `/api/favorites/${id}`),
};
