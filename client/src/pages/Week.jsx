import { useEffect, useState } from 'react';
import { RefreshCw, Shuffle } from 'lucide-react';
import { OCCASIONS } from '@outfitiq/shared/catalog.js';
import { missingPieces } from '@outfitiq/shared/engine.js';
import { useAppData } from '../AppData.jsx';
import { api } from '../api.js';
import { dayLabel, fmtTemp, shortDate } from '../lib/format.js';
import OutfitCard from '../components/OutfitCard.jsx';
import EmptyWardrobe from '../components/EmptyWardrobe.jsx';
import { PageHeader, WeatherIcon } from '../components/ui.jsx';

export default function Week() {
  const { items, settings, version, saveSettings, openSettings } = useAppData();
  const [swaps, setSwaps] = useState(() => Array(7).fill(0));
  const [data, setData] = useState(null);

  useEffect(() => {
    let cancelled = false;
    api.week(swaps).then(d => !cancelled && setData(d)).catch(() => {});
    return () => { cancelled = true; };
  }, [swaps, version]);

  const missing = missingPieces(items);
  const header = (
    <PageHeader eyebrow="Plan ahead" title="Your week, planned"
      subtitle="Seven days of outfits that follow the forecast and spread your clothes out, so nothing repeats too soon."
      actions={!missing.length && <button className="btn btn-secondary" onClick={() => setSwaps(s => s.map(n => n + 1))}><RefreshCw size={16} /> New plan</button>} />
  );
  if (missing.length) return <>{header}<EmptyWardrobe missing={missing} /></>;
  if (!data) return <>{header}<div className="h-96 animate-pulse rounded-xl bg-surface-2" /></>;

  return (
    <div>
      {header}
      {!settings.location && (
        <button onClick={openSettings} className="mb-6 w-full rounded-xl bg-accent-soft px-4 py-3 text-left text-sm">
          <b>Add your city</b> so each day’s outfit matches the forecast →
        </button>
      )}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {data.days.map((day, i) => (
          <div key={day.date}>
            <div className="mb-2 flex items-center justify-between gap-2 px-1">
              <div>
                <div className="font-display text-lg font-semibold leading-tight">{dayLabel(day.date)}</div>
                <div className="text-xs text-muted">{shortDate(day.date)}</div>
              </div>
              {day.weather && (
                <div className="flex items-center gap-1.5 text-sm text-muted" title={day.weather.rain ? 'Rain likely' : undefined}>
                  <WeatherIcon code={day.weather.code} size={18} className="text-accent" />
                  {fmtTemp(day.weather.max, settings.unit)} <span className="opacity-60">{fmtTemp(day.weather.min, settings.unit)}</span>
                </div>
              )}
            </div>
            <select className="field mb-2 h-9" value={day.occasion} aria-label={`Occasion for ${dayLabel(day.date)}`}
              onChange={e => saveSettings({ weekOccasion: { date: day.date, occasion: e.target.value } })}>
              {OCCASIONS.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
            </select>
            {day.outfit ? (
              <OutfitCard outfit={day.outfit} occasion={day.occasion} showWear={i === 0}>
                <button className="btn btn-ghost h-8 px-2 text-xs" onClick={() => setSwaps(s => s.map((n, j) => (j === i ? n + 1 : n)))}>
                  <Shuffle size={14} /> Swap
                </button>
              </OutfitCard>
            ) : (
              <div className="card grid aspect-4/5 place-items-center text-sm text-muted">No outfit</div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
