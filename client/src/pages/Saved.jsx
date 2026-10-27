import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Heart, Undo2 } from 'lucide-react';
import { OCCASIONS } from '@outfitiq/shared/catalog.js';
import { dayKey, daysBetween } from '@outfitiq/shared/engine.js';
import { useAppData } from '../AppData.jsx';
import { dayLabel, shortDate } from '../lib/format.js';
import OutfitBoard from '../components/OutfitBoard.jsx';
import OutfitCard, { outfitTitle } from '../components/OutfitCard.jsx';
import { Chip, ColorDot, OccasionIcon, PageHeader, ScoreBadge } from '../components/ui.jsx';

const OCC = Object.fromEntries(OCCASIONS.map(o => [o.id, o]));

function Empty({ title, text }) {
  return (
    <div className="card px-6 py-16 text-center">
      <h2 className="font-display text-xl font-semibold">{title}</h2>
      <p className="mx-auto mt-2 max-w-sm text-sm text-muted">{text}</p>
      <Link to="/" className="btn btn-primary mt-6">See today’s outfit</Link>
    </div>
  );
}

function Favorites() {
  const { favorites, itemsById } = useAppData();
  const list = favorites.filter(f => f.itemIds.every(id => itemsById.has(id)));
  if (!list.length) return <Empty title="No favorites yet" text="Tap the heart on any outfit you love to keep it here." />;
  return (
    <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 xl:grid-cols-4">
      {list.map(f => <OutfitCard key={f.id} outfit={{ key: f.id, itemIds: f.itemIds }} />)}
    </div>
  );
}

function History() {
  const { history, itemsById, unwear } = useAppData();
  const list = history.filter(h => h.itemIds.some(id => itemsById.has(id)));
  if (!list.length) return <Empty title="Nothing logged yet" text="When you tap “Wear this today”, the outfit is logged here. OutfitIQ uses it to avoid repeats." />;
  const today = dayKey();
  return (
    <ul className="space-y-3">
      {list.map(h => (
        <li key={h.id} className="card flex items-center gap-4 p-3">
          <OutfitBoard itemIds={h.itemIds} className="w-20 shrink-0 rounded-xl p-1 sm:w-24" />
          <div className="min-w-0 flex-1">
            <div className="text-xs text-muted">{dayLabel(h.date)} · {shortDate(h.date)}</div>
            <div className="mt-0.5 line-clamp-2 font-medium">{outfitTitle(h.itemIds, itemsById)}</div>
            <div className="mt-1.5 flex items-center gap-2 text-xs text-muted">
              {h.occasion && <span className="inline-flex items-center gap-1"><OccasionIcon id={h.occasion} size={13} /> {OCC[h.occasion]?.label}</span>}
              {h.score && <ScoreBadge score={h.score} />}
            </div>
          </div>
          {h.date === today && (
            <button className="btn btn-ghost h-9 px-3 text-xs" onClick={() => unwear(h.date)}><Undo2 size={15} /> Undo</button>
          )}
        </li>
      ))}
    </ul>
  );
}

function Insights() {
  const { items, history, openItem } = useAppData();
  const stats = useMemo(() => {
    const today = dayKey();
    const recent = history.filter(h => daysBetween(h.date, today) < 30);
    const wornRecently = new Set(recent.flatMap(h => h.itemIds));
    const clothing = items.filter(i => !['watch', 'accessory'].includes(i.category));
    const colors = {};
    clothing.forEach(i => { colors[i.colorName] = (colors[i.colorName] || 0) + 1; });
    const topColor = Object.entries(colors).sort((a, b) => b[1] - a[1])[0];
    return {
      usage: clothing.length ? Math.round((clothing.filter(i => wornRecently.has(i.id)).length / clothing.length) * 100) : 0,
      logged: recent.length,
      topColor: topColor?.[0],
      topColorHex: items.find(i => i.colorName === topColor?.[0])?.color,
      mostWorn: [...items].filter(i => i.wearCount > 0).sort((a, b) => b.wearCount - a.wearCount).slice(0, 5),
      forgotten: clothing.filter(i => !wornRecently.has(i.id)).slice(0, 10),
    };
  }, [items, history]);

  if (!items.length) return <Empty title="No insights yet" text="Add clothes and log a few outfits to see how you use your wardrobe." />;

  return (
    <div className="space-y-8">
      <dl className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {[
          ['Items in wardrobe', items.length],
          ['Outfits logged (30 days)', stats.logged],
          ['Clothes worn this month', `${stats.usage}%`],
          ['Most common color', stats.topColor || '–'],
        ].map(([label, value], i) => (
          <div key={label} className="card px-5 py-4">
            <dt className="text-xs font-medium text-muted">{label}</dt>
            <dd className="mt-1.5 flex items-center gap-2 font-display text-2xl font-semibold tracking-tight sm:text-[28px]">
              {i === 3 && stats.topColorHex && <ColorDot color={stats.topColorHex} className="size-4" />}
              {value}
            </dd>
          </div>
        ))}
      </dl>

      <div className="grid gap-6 md:grid-cols-2">
        <section>
          <h2 className="mb-3 font-display text-lg font-semibold tracking-tight">Most worn</h2>
          {stats.mostWorn.length ? (
            <ul className="card divide-y divide-line">
              {stats.mostWorn.map(i => (
                <li key={i.id}>
                  <button className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm hover:bg-surface-2" onClick={() => openItem(i.id)}>
                    <img src={i.image} alt="" className="size-10 rounded-md bg-tile object-contain p-1 mix-blend-multiply" />
                    <span className="flex-1 truncate">{i.name}</span>
                    <span className="text-muted tabular-nums">{i.wearCount}×</span>
                  </button>
                </li>
              ))}
            </ul>
          ) : <p className="text-sm text-muted">Log outfits to see your favorites.</p>}
        </section>
        <section>
          <h2 className="mb-1 font-display text-lg font-semibold tracking-tight">Forgotten pieces</h2>
          <p className="mb-3 text-sm text-muted">Not worn in the last 30 days — find them an outfit.</p>
          {stats.forgotten.length ? (
            <ul className="card divide-y divide-line">
              {stats.forgotten.map(i => (
                <li key={i.id} className="flex items-center gap-3 px-4 py-2.5 text-sm">
                  <img src={i.image} alt="" className="size-10 rounded-md bg-tile object-contain p-1 mix-blend-multiply" />
                  <span className="flex-1 truncate">{i.name}</span>
                  <Link to={`/outfits?item=${i.id}`} className="font-medium text-accent hover:underline">Style it</Link>
                </li>
              ))}
            </ul>
          ) : <p className="text-sm text-muted">You’ve worn everything recently. Nice!</p>}
        </section>
      </div>
    </div>
  );
}

export default function Saved() {
  const [tab, setTab] = useState('favorites');
  return (
    <div>
      <PageHeader eyebrow="Your style log" title="Saved" subtitle="Favorite outfits, what you wore, and how much of your wardrobe you actually use." />
      <div className="mb-6 flex gap-2">
        <Chip active={tab === 'favorites'} onClick={() => setTab('favorites')}><Heart size={15} /> Favorites</Chip>
        <Chip active={tab === 'history'} onClick={() => setTab('history')}>History</Chip>
        <Chip active={tab === 'insights'} onClick={() => setTab('insights')}>Insights</Chip>
      </div>
      {tab === 'favorites' && <Favorites />}
      {tab === 'history' && <History />}
      {tab === 'insights' && <Insights />}
    </div>
  );
}
