// App-wide data: wardrobe, settings, history, favorites, plus shared modals and toasts.
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { api } from './api.js';

const Ctx = createContext(null);
export const useAppData = () => useContext(Ctx);

export function AppDataProvider({ children }) {
  const [items, setItems] = useState([]);
  const [settings, setSettings] = useState(null);
  const [history, setHistory] = useState([]);
  const [favorites, setFavorites] = useState([]);
  const [ready, setReady] = useState(false);
  const [loadError, setLoadError] = useState(null);
  const [version, setVersion] = useState(0); // bumps whenever outfits need recomputing
  const [toast, setToast] = useState(null);
  const [modal, setModal] = useState(null);  // { type: 'upload'|'item'|'settings', ...props }
  const toastTimer = useRef();

  const bump = () => setVersion(v => v + 1);

  const load = useCallback(async () => {
    try {
      const [i, s, h, f] = await Promise.all([api.items(), api.settings(), api.history(), api.favorites()]);
      setItems(i); setSettings(s); setHistory(h); setFavorites(f);
      setLoadError(null);
    } catch (err) {
      setLoadError(err.message);
    } finally {
      setReady(true);
    }
  }, []);
  useEffect(() => { load(); }, [load]);

  const notify = useCallback((text, kind = 'info') => {
    clearTimeout(toastTimer.current);
    setToast({ text, kind, id: Date.now() });
    toastTimer.current = setTimeout(() => setToast(null), 3200);
  }, []);

  // Wrap an action so failures show as a toast. Resolves to a truthy value on success, undefined on failure.
  const guard = fn => async (...args) => {
    try {
      const result = await fn(...args);
      return result === undefined ? true : result;
    } catch (err) {
      notify(err.message, 'error');
      return undefined;
    }
  };

  const itemsById = useMemo(() => new Map(items.map(i => [i.id, i])), [items]);
  const favoriteKeys = useMemo(() => new Map(favorites.map(f => [[...f.itemIds].sort().join('|'), f])), [favorites]);

  const actions = {
    addItems: created => { setItems(prev => [...prev, ...created]); bump(); },
    updateItem: guard(async (id, patch) => {
      const updated = await api.updateItem(id, patch);
      setItems(prev => prev.map(i => (i.id === id ? updated : i)));
      bump();
      return updated;
    }),
    deleteItem: guard(async id => {
      await api.deleteItem(id);
      setItems(prev => prev.filter(i => i.id !== id));
      setFavorites(prev => prev.filter(f => !f.itemIds.includes(id)));
      bump();
    }),
    washAll: guard(async () => {
      setItems(await api.washAll());
      bump();
      notify('Laundry done — everything is clean');
    }),
    resetAll: guard(async () => {
      await api.resetAll();
      setItems([]); setHistory([]); setFavorites([]);
      bump();
      notify('Wardrobe cleared');
    }),
    wear: guard(async ({ itemIds, occasion, score }) => {
      const res = await api.wear({ itemIds, occasion, score });
      setItems(res.items);
      setHistory(await api.history());
      bump();
      notify('Logged as today’s outfit');
    }),
    unwear: guard(async date => {
      const res = await api.unwear(date);
      setItems(res.items);
      setHistory(await api.history());
      bump();
      notify('Removed from your log');
    }),
    isFavorite: itemIds => favoriteKeys.has([...itemIds].sort().join('|')),
    toggleFavorite: guard(async itemIds => {
      const existing = favoriteKeys.get([...itemIds].sort().join('|'));
      if (existing) {
        await api.removeFavorite(existing.id);
        setFavorites(prev => prev.filter(f => f.id !== existing.id));
        notify('Removed from favorites');
      } else {
        const fav = await api.addFavorite(itemIds);
        setFavorites(prev => [fav, ...prev]);
        notify('Saved to favorites');
      }
    }),
    saveSettings: guard(async patch => {
      setSettings(await api.saveSettings(patch));
      bump();
    }),
    openUpload: (props = {}) => setModal({ type: 'upload', ...props }),
    openItem: id => setModal({ type: 'item', id }),
    openSettings: () => setModal({ type: 'settings' }),
    closeModal: () => setModal(null),
  };

  const value = { items, itemsById, settings, history, favorites, ready, loadError, reload: load, version, toast, notify, modal, ...actions };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
