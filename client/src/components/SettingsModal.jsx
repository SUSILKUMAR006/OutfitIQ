import { useState } from 'react';
import { LocateFixed, MapPin, Search, Trash2 } from 'lucide-react';
import { OCCASIONS } from '@outfitiq/shared/catalog.js';
import { useAppData } from '../AppData.jsx';
import { api } from '../api.js';
import Modal from './Modal.jsx';
import { Chip } from './ui.jsx';

function Section({ title, children }) {
  return (
    <section className="border-b border-line py-5 first:pt-0 last:border-0 last:pb-0">
      <h3 className="mb-3 text-sm font-semibold">{title}</h3>
      {children}
    </section>
  );
}

export default function SettingsModal() {
  const { settings, saveSettings, closeModal, notify, resetAll, items } = useAppData();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState(null);
  const [searching, setSearching] = useState(false);
  // The slider saves when released, not on every step.
  const [repeatDays, setRepeatDays] = useState(settings.repeatDays);
  const commitRepeat = () => { if (repeatDays !== settings.repeatDays) saveSettings({ repeatDays }); };

  async function search(e) {
    e.preventDefault();
    if (query.trim().length < 2) return;
    setSearching(true);
    try { setResults(await api.geocode(query)); } catch (err) { notify(err.message, 'error'); }
    setSearching(false);
  }

  async function chooseLocation(location) {
    if (await saveSettings({ location })) {
      notify(`Weather set to ${location.name}`);
      setResults(null);
      setQuery('');
    }
  }

  function useMyLocation() {
    if (!navigator.geolocation) return notify('Location isn’t available in this browser', 'error');
    navigator.geolocation.getCurrentPosition(
      pos => chooseLocation({ name: 'My location', lat: +pos.coords.latitude.toFixed(3), lon: +pos.coords.longitude.toFixed(3) }),
      () => notify('Couldn’t get your location — search for your city instead', 'error'),
      { timeout: 10000 },
    );
  }

  return (
    <Modal title="Settings" onClose={closeModal}>
      <Section title="Weather location">
        {settings.location && (
          <div className="mb-3 flex items-center gap-2 rounded-xl bg-surface-2 px-3 py-2.5 text-sm">
            <MapPin size={16} className="text-accent" />
            <span className="flex-1 truncate">{settings.location.name}</span>
            <button className="text-xs font-medium text-muted hover:text-ink" onClick={() => saveSettings({ location: null })}>Remove</button>
          </div>
        )}
        <form onSubmit={search} className="flex gap-2">
          <input className="field" placeholder="Search your city…" value={query} onChange={e => setQuery(e.target.value)} aria-label="City" />
          <button className="btn btn-secondary shrink-0" disabled={searching}><Search size={16} /> Search</button>
        </form>
        {results && (
          <ul className="mt-2 overflow-hidden rounded-xl border border-line">
            {results.length === 0 && <li className="px-3 py-2.5 text-sm text-muted">No places found</li>}
            {results.map(r => (
              <li key={`${r.lat},${r.lon}`}>
                <button className="w-full px-3 py-2.5 text-left text-sm hover:bg-surface-2" onClick={() => chooseLocation(r)}>{r.name}</button>
              </li>
            ))}
          </ul>
        )}
        <button className="mt-2 inline-flex items-center gap-1.5 text-sm font-medium text-accent hover:underline" onClick={useMyLocation}>
          <LocateFixed size={15} /> Use my current location
        </button>
        <div className="mt-4 flex items-center gap-2">
          <span className="text-sm text-muted">Temperature</span>
          <Chip active={settings.unit === 'C'} onClick={() => saveSettings({ unit: 'C' })}>°C</Chip>
          <Chip active={settings.unit === 'F'} onClick={() => saveSettings({ unit: 'F' })}>°F</Chip>
        </div>
      </Section>

      <Section title="Outfit rules">
        <label className="label" htmlFor="repeat">Avoid repeating a top or bottom for <b className="text-ink">{repeatDays} day{repeatDays === 1 ? '' : 's'}</b></label>
        <input id="repeat" type="range" min="0" max="14" value={repeatDays} className="w-full accent-accent"
          onChange={e => setRepeatDays(Number(e.target.value))}
          onPointerUp={commitRepeat} onKeyUp={commitRepeat} onBlur={commitRepeat} />
        <label className="label mt-4" htmlFor="wash">Send clothes to the laundry after</label>
        <select id="wash" className="field" value={settings.washAfter} onChange={e => saveSettings({ washAfter: Number(e.target.value) })}>
          <option value={0}>Never (I’ll mark them myself)</option>
          {[1, 2, 3, 4, 5].map(n => <option key={n} value={n}>{n} wear{n === 1 ? '' : 's'}</option>)}
        </select>
        <div className="mt-4 grid grid-cols-2 gap-3">
          <div>
            <label className="label" htmlFor="wd">Weekdays I usually dress for</label>
            <select id="wd" className="field" value={settings.weekdayOccasion} onChange={e => saveSettings({ weekdayOccasion: e.target.value })}>
              {OCCASIONS.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="we">Weekends</label>
            <select id="we" className="field" value={settings.weekendOccasion} onChange={e => saveSettings({ weekendOccasion: e.target.value })}>
              {OCCASIONS.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
            </select>
          </div>
        </div>
      </Section>

      <Section title="Wardrobe data">
        <p className="mb-3 text-sm text-muted">{items.length} items stored on your OutfitIQ server.</p>
        <div className="flex flex-wrap gap-2">
          <button className="btn btn-ghost text-red-600" onClick={() => confirm('Delete every item, outfit log and favorite? This can’t be undone.') && resetAll()}>
            <Trash2 size={16} /> Clear wardrobe
          </button>
        </div>
      </Section>
    </Modal>
  );
}
