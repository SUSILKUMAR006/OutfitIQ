import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Check, CircleAlert, CircleCheck, Heart, MapPin, Shuffle, Undo2, WashingMachine } from 'lucide-react';
import { OCCASIONS, WEATHER_PRESETS, categoryById, weatherInfo } from '@outfitiq/shared/catalog.js';
import { useAppData } from '../AppData.jsx';
import { api } from '../api.js';
import { cx, fmtTemp, greeting, longDate } from '../lib/format.js';
import OutfitBoard from '../components/OutfitBoard.jsx';
import OutfitCard, { outfitTitle } from '../components/OutfitCard.jsx';
import EmptyWardrobe from '../components/EmptyWardrobe.jsx';
import { Chip, ColorDot, OccasionIcon, ScoreBadge, WeatherIcon } from '../components/ui.jsx';

function WeatherCard({ data, unit, onSetLocation }) {
  const w = data.weather;
  if (!w) {
    return (
      <button onClick={onSetLocation} className="card flex items-center gap-3 px-4 py-3 text-left transition-shadow hover:shadow-lift">
        <span className="grid size-10 place-items-center rounded-lg bg-accent-soft text-accent"><MapPin size={19} /></span>
        <span className="text-sm">
          <span className="block font-semibold">{data.weatherError || 'Add your city'}</span>
          <span className="text-muted">Get weather-aware outfits</span>
        </span>
      </button>
    );
  }
  const manual = w.source === 'manual';
  return (
    <div className="card flex items-center gap-4 px-4 py-3">
      <span className="grid size-11 place-items-center rounded-lg bg-accent-soft text-accent"><WeatherIcon code={w.code} size={22} /></span>
      <div>
        <div className="flex items-baseline gap-2">
          <span className="font-display text-2xl font-semibold tracking-tight">{fmtTemp(manual ? w.temp : w.max, unit)}</span>
          {!manual && <span className="text-sm text-muted">/ {fmtTemp(w.min, unit)}</span>}
          <span className="text-sm font-medium text-ink-2">{manual ? WEATHER_PRESETS.find(p => p.id === w.preset)?.label : weatherInfo(w.code).label}</span>
        </div>
        <div className="text-xs text-muted">
          {manual ? 'Set manually' : data.location?.name}
          {!manual && data.current && ` · Now ${fmtTemp(data.current.temp, unit)}`}
          {w.rain && ' · Rain likely'}
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div className="border-t border-line pt-5">
      <h3 className="mb-3 text-xs font-semibold uppercase tracking-[0.1em] text-muted">{title}</h3>
      {children}
    </div>
  );
}

export default function Today() {
  const { items, itemsById, settings, version, wear, unwear, toggleFavorite, isFavorite, openSettings, washAll } = useAppData();
  const [occasion, setOccasion] = useState(null);       // null → server picks weekday/weekend default
  const [weatherMode, setWeatherMode] = useState('auto');
  const [shuffle, setShuffle] = useState(0);
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    api.today({ occasion, shuffle, weather: weatherMode === 'auto' ? undefined : weatherMode })
      .then(d => { if (!cancelled) { setData(d); setError(null); } })
      .catch(err => !cancelled && setError(err.message));
    return () => { cancelled = true; };
  }, [occasion, shuffle, weatherMode, version]);

  if (error) return <p className="text-warn">{error}</p>;
  if (!data) return <div className="h-[560px] animate-pulse rounded-xl bg-surface-2" />;

  const occ = OCCASIONS.find(o => o.id === data.occasion);
  const intro = (
    <div className="min-w-0">
      <p className="eyebrow mb-2">{longDate(data.date)}</p>
      <h1 className="font-display text-[28px] font-semibold leading-tight tracking-tight sm:text-[34px]">{greeting()}</h1>
      <p className="mt-2 text-[15px] text-muted">
        {data.missing.length ? 'Let’s set up your wardrobe.' : `Your ${occ?.label.toLowerCase()} outfit is ready — picked from ${data.total.toLocaleString()} combination${data.total === 1 ? '' : 's'}.`}
      </p>
    </div>
  );

  if (data.missing.length) return <><div className="mb-8">{intro}</div><EmptyWardrobe missing={data.missing} /></>;

  const main = data.main;
  const wornToday = data.worn && main && [...data.worn.itemIds].sort().join() === [...main.itemIds].sort().join();
  const inLaundry = items.filter(i => i.clean === false).length;
  const pieces = main ? main.itemIds.map(id => itemsById.get(id)).filter(Boolean) : [];
  const fav = main && isFavorite(main.itemIds);
  const pickOccasion = id => { setOccasion(id); setShuffle(0); };

  return (
    <div>
      <div className="mb-8 flex flex-wrap items-end justify-between gap-5">
        {intro}
        <WeatherCard data={data} unit={settings.unit} onSetLocation={openSettings} />
      </div>

      <div className="card mb-6 divide-y divide-line">
        <div className="flex items-center gap-4 px-4 py-3 sm:px-5">
          <span className="hidden w-20 shrink-0 text-xs font-semibold uppercase tracking-[0.1em] text-muted sm:block">Occasion</span>
          <div className="no-scrollbar flex min-w-0 gap-2 overflow-x-auto">
            {OCCASIONS.map(o => (
              <Chip key={o.id} active={data.occasion === o.id} onClick={() => pickOccasion(o.id)}>
                <OccasionIcon id={o.id} size={15} /> {o.label}
              </Chip>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-4 px-4 py-3 sm:px-5">
          <span className="hidden w-20 shrink-0 text-xs font-semibold uppercase tracking-[0.1em] text-muted sm:block">Weather</span>
          <div className="no-scrollbar flex min-w-0 gap-2 overflow-x-auto">
            <Chip active={weatherMode === 'auto'} onClick={() => { setWeatherMode('auto'); setShuffle(0); }}>
              {settings.location ? 'Live forecast' : 'Any weather'}
            </Chip>
            {WEATHER_PRESETS.map(p => (
              <Chip key={p.id} active={weatherMode === p.id} onClick={() => { setWeatherMode(p.id); setShuffle(0); }}>
                <WeatherIcon code={p.code} size={15} /> {p.label}
              </Chip>
            ))}
          </div>
        </div>
      </div>

      {!main ? (
        <div className="card p-10 text-center">
          <span className="mx-auto grid size-12 place-items-center rounded-full bg-accent-soft text-accent"><WashingMachine size={22} /></span>
          <h2 className="mt-4 font-display text-xl font-semibold">Everything’s in the laundry</h2>
          <p className="mt-1 text-sm text-muted">There aren’t enough clean clothes to build an outfit.</p>
          <button className="btn btn-primary mt-5" onClick={washAll}>Mark all as washed</button>
        </div>
      ) : (
        <section className="card grid grid-cols-1 overflow-hidden lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)]" aria-label="Today’s outfit">
          <div className="relative border-b border-line bg-white p-3 sm:p-5 lg:border-b-0 lg:border-r">
            <OutfitBoard itemIds={main.itemIds} large />
            <span className={cx('absolute left-7 top-7 inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-semibold shadow-sm sm:left-11 sm:top-11',
              wornToday ? 'bg-good text-white' : 'bg-white text-ink ring-1 ring-black/5')}>
              {wornToday ? <><Check size={13} /> Wearing today</> : 'Today’s pick'}
            </span>
          </div>

          <div className="flex flex-col gap-5 p-5 sm:p-8">
            <div>
              <ScoreBadge score={main.score} size="lg" />
              <h2 className="mt-5 font-display text-2xl font-semibold leading-tight tracking-tight sm:text-[28px]">{outfitTitle(main.itemIds, itemsById)}</h2>
              <p className="mt-1.5 flex items-center gap-1.5 text-sm text-muted"><OccasionIcon id={data.occasion} size={14} /> Styled for {occ?.label.toLowerCase()}</p>
            </div>

            <Section title="The pieces">
              <ul className="grid gap-2 sm:grid-cols-2">
                {pieces.map(p => (
                  <li key={p.id} className="flex items-center gap-3 rounded-lg border border-line p-2">
                    <span className="grid size-11 shrink-0 place-items-center overflow-hidden rounded-md bg-tile">
                      <img src={p.image} alt="" className="size-full object-contain p-1 mix-blend-multiply" />
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium">{p.name}</span>
                      <span className="flex items-center gap-1.5 text-xs text-muted"><ColorDot color={p.color} className="size-2.5" />{categoryById(p.category).single}</span>
                    </span>
                  </li>
                ))}
              </ul>
            </Section>

            <Section title="Why it works">
              <ul className="space-y-2">
                {main.notes.map(n => (
                  <li key={n.text} className="flex items-start gap-2.5 text-sm text-ink-2">
                    {n.good ? <CircleCheck size={17} className="mt-px shrink-0 text-good" /> : <CircleAlert size={17} className="mt-px shrink-0 text-warn" />}
                    <span>{n.text}</span>
                  </li>
                ))}
              </ul>
            </Section>

            <div className="mt-auto flex flex-wrap gap-2 border-t border-line pt-5">
              {wornToday ? (
                <button className="btn btn-secondary" onClick={() => unwear(data.date)}><Undo2 size={16} /> Undo</button>
              ) : (
                <button className="btn btn-primary" onClick={() => wear({ itemIds: main.itemIds, occasion: data.occasion, score: main.score })}>
                  <Check size={16} /> {data.worn ? 'Wear this instead' : 'Wear this today'}
                </button>
              )}
              <button className="btn btn-secondary" onClick={() => setShuffle(s => s + 1)}><Shuffle size={16} /> Show another</button>
              <button className={cx('btn btn-secondary', fav && 'text-rose-500')} onClick={() => toggleFavorite(main.itemIds)} aria-pressed={fav}>
                <Heart size={16} fill={fav ? 'currentColor' : 'none'} /> {fav ? 'Saved' : 'Save'}
              </button>
            </div>
          </div>
        </section>
      )}

      {inLaundry > 0 && (
        <div className="mt-4 flex flex-wrap items-center gap-3 rounded-xl border border-line bg-white px-4 py-3 text-sm">
          <WashingMachine size={18} className="text-muted" />
          <span className="flex-1 text-ink-2"><b className="text-ink">{inLaundry}</b> item{inLaundry === 1 ? ' is' : 's are'} in the laundry and skipped in today’s picks.</span>
          <button className="font-medium text-accent hover:underline" onClick={washAll}>Mark all washed</button>
        </div>
      )}

      {data.alternatives.length > 0 && (
        <section className="mt-14">
          <div className="mb-5 flex items-end justify-between gap-4">
            <div>
              <h2 className="font-display text-xl font-semibold tracking-tight sm:text-2xl">More options for today</h2>
              <p className="mt-1 text-sm text-muted">Different tops, same great fit for the day.</p>
            </div>
            <Link to="/outfits" className="hidden items-center gap-1 text-sm font-medium text-accent hover:underline sm:inline-flex">
              Browse all {data.total.toLocaleString()} <ArrowRight size={15} />
            </Link>
          </div>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
            {data.alternatives.map((o, i) => (
              <OutfitCard key={o.key} outfit={o} occasion={data.occasion} showWear={false}
                onOpen={() => { setShuffle(s => s + i + 1); window.scrollTo({ top: 0, behavior: 'smooth' }); }} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
