import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Loader2, X } from 'lucide-react';
import { OCCASIONS } from '@outfitiq/shared/catalog.js';
import { useAppData } from '../AppData.jsx';
import { api } from '../api.js';
import OutfitCard from '../components/OutfitCard.jsx';
import EmptyWardrobe from '../components/EmptyWardrobe.jsx';
import { Chip, OccasionIcon, PageHeader, StatCard } from '../components/ui.jsx';
import { missingPieces } from '@outfitiq/shared/engine.js';

const PAGE = 24;
const MIN_SCORES = [{ v: 0, label: 'All' }, { v: 65, label: '65+' }, { v: 80, label: 'Great (80+)' }];

export default function Outfits() {
  const { items, itemsById, settings, version } = useAppData();
  const [params, setParams] = useSearchParams();
  const occasion = params.get('occasion') || '';
  const clean = params.get('clean') === '1';
  const useWeather = params.get('weather') === 'auto';
  const min = Number(params.get('min') || 0);
  const itemId = params.get('item') || '';

  const [data, setData] = useState(null);
  const [outfits, setOutfits] = useState([]);
  const [loading, setLoading] = useState(false);

  const setParam = (key, value) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value); else next.delete(key);
    setParams(next, { replace: true });
  };

  const query = offset => api.outfits({ occasion, clean: clean ? 1 : '', weather: useWeather ? 'auto' : '', min: min || '', item: itemId, offset, limit: PAGE });

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    query(0).then(d => {
      if (cancelled) return;
      setData(d);
      setOutfits(d.outfits);
      setLoading(false);
    }).catch(() => !cancelled && setLoading(false));
    return () => { cancelled = true; };
  }, [occasion, clean, useWeather, min, itemId, version]); // eslint-disable-line react-hooks/exhaustive-deps

  async function more() {
    setLoading(true);
    const d = await query(outfits.length).catch(() => null);
    if (d) setOutfits(prev => [...prev, ...d.outfits]);
    setLoading(false);
  }

  const missing = missingPieces(items);
  const header = (
    <PageHeader eyebrow="Mix & match" title="All outfit combinations"
      subtitle="Every top, bottom and shoe pairing from your wardrobe, ranked by how well it works." />
  );
  if (missing.length) return <>{header}<EmptyWardrobe missing={missing} /></>;

  const filterItem = itemsById.get(itemId);

  return (
    <div>
      {header}

      {data && (
        <dl className="mb-6 grid grid-cols-3 gap-3 sm:gap-4">
          <StatCard label="Possible outfits" value={data.possible.toLocaleString()} />
          <StatCard label="Great matches (80+)" value={data.great.toLocaleString()} />
          <StatCard label="Matching filters" value={data.matching.toLocaleString()} />
        </dl>
      )}

      <div className="card mb-6 divide-y divide-line">
        <div className="no-scrollbar flex min-w-0 gap-2 overflow-x-auto px-4 py-3 sm:px-5">
          <Chip active={!occasion} onClick={() => setParam('occasion', '')}>Any occasion</Chip>
          {OCCASIONS.map(o => <Chip key={o.id} active={occasion === o.id} onClick={() => setParam('occasion', o.id)}><OccasionIcon id={o.id} /> {o.label}</Chip>)}
        </div>
        <div className="no-scrollbar flex min-w-0 gap-2 overflow-x-auto px-4 py-3 sm:px-5">
          {MIN_SCORES.map(s => <Chip key={s.v} active={min === s.v} onClick={() => setParam('min', s.v || '')}>{s.label}</Chip>)}
          <span className="mx-1 w-px shrink-0 bg-line" />
          <Chip active={clean} onClick={() => setParam('clean', clean ? '' : '1')}>Clean clothes only</Chip>
          {settings.location && <Chip active={useWeather} onClick={() => setParam('weather', useWeather ? '' : 'auto')}>Today’s weather</Chip>}
          {filterItem && (
            <Chip active onClick={() => setParam('item', '')}>
              With: {filterItem.name} <X size={14} />
            </Chip>
          )}
        </div>
      </div>

      {data && outfits.length === 0 && !loading && (
        <div className="card p-10 text-center text-sm text-muted">No outfits match these filters. Try lowering the score filter.</div>
      )}

      <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 xl:grid-cols-4">
        {outfits.map(o => <OutfitCard key={o.key} outfit={o} occasion={occasion || null} />)}
      </div>

      <div className="mt-8 flex justify-center">
        {loading ? (
          <Loader2 className="animate-spin text-muted" />
        ) : data && outfits.length < data.matching ? (
          <button className="btn btn-secondary" onClick={more}>Show more ({(data.matching - outfits.length).toLocaleString()} left)</button>
        ) : null}
      </div>
    </div>
  );
}
