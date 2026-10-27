import { useMemo, useState } from 'react';
import { ImagePlus, Upload, WashingMachine } from 'lucide-react';
import { CATEGORIES, STYLES, WASHABLE } from '@outfitiq/shared/catalog.js';
import { countCombinations } from '@outfitiq/shared/engine.js';
import { useAppData } from '../AppData.jsx';
import { cx } from '../lib/format.js';
import { Chip, ColorDot, PageHeader, StatCard } from '../components/ui.jsx';

const STYLE_LABEL = Object.fromEntries(STYLES.map(s => [s.id, s.label]));

function ItemCard({ item }) {
  const { openItem, updateItem } = useAppData();
  const dirty = item.clean === false;
  return (
    <article className="card group overflow-hidden transition-shadow hover:shadow-lift">
      <div className="relative">
        <button type="button" onClick={() => openItem(item.id)} className="block w-full p-2" aria-label={`Edit ${item.name}`}>
          <div className={cx('aspect-square overflow-hidden rounded-lg bg-tile', dirty && 'opacity-50')}>
            <img src={item.image} alt={item.name} loading="lazy"
              className="size-full object-contain p-3 mix-blend-multiply transition-transform duration-300 group-hover:scale-[1.04]" />
          </div>
        </button>
        {dirty && <span className="absolute left-4 top-4 rounded-md bg-ink px-2 py-0.5 text-[11px] font-semibold text-white">In laundry</span>}
        {WASHABLE.has(item.category) && (
          <button className={cx('absolute right-4 top-4 grid size-8 place-items-center rounded-full bg-white shadow-sm ring-1 ring-black/5 transition-opacity',
            dirty ? 'text-accent' : 'text-muted opacity-0 hover:text-ink group-hover:opacity-100 focus:opacity-100')}
            title={dirty ? 'Mark as clean' : 'Send to laundry'} aria-label={dirty ? 'Mark as clean' : 'Send to laundry'}
            onClick={() => updateItem(item.id, { clean: dirty })}>
            <WashingMachine size={15} />
          </button>
        )}
      </div>
      <div className="border-t border-line px-3.5 py-3">
        <h3 className="truncate text-sm font-semibold">{item.name}</h3>
        <p className="mt-0.5 flex items-center gap-1.5 text-xs text-muted">
          <ColorDot color={item.color} className="size-2.5" />
          <span className="truncate">{item.subtype} · {STYLE_LABEL[item.style]}</span>
          <span className="ml-auto shrink-0 tabular-nums">{item.wearCount || 0}× worn</span>
        </p>
      </div>
    </article>
  );
}

export default function Wardrobe() {
  const { items, openUpload, washAll } = useAppData();
  const [tab, setTab] = useState('all');
  const [dragging, setDragging] = useState(false);

  const counts = useMemo(() => {
    const c = { all: items.length, laundry: items.filter(i => i.clean === false).length };
    CATEGORIES.forEach(cat => { c[cat.id] = items.filter(i => i.category === cat.id).length; });
    return c;
  }, [items]);

  const shown = useMemo(() => {
    const list = tab === 'all' ? items : tab === 'laundry' ? items.filter(i => i.clean === false) : items.filter(i => i.category === tab);
    const order = Object.fromEntries(CATEGORIES.map((c, i) => [c.id, i]));
    return [...list].sort((a, b) => order[a.category] - order[b.category] || b.createdAt - a.createdAt);
  }, [items, tab]);

  const combos = countCombinations(items);
  const uploadCategory = CATEGORIES.some(c => c.id === tab) ? tab : 'top';
  // Hide empty optional categories (e.g. Dresses) to keep the filter bar tidy.
  const tabs = CATEGORIES.filter(c => counts[c.id] > 0 || ['top', 'bottom', 'shoes'].includes(c.id) || tab === c.id);

  const dropProps = {
    onDragOver: e => { if (e.dataTransfer.types.includes('Files')) { e.preventDefault(); setDragging(true); } },
    onDragLeave: e => { if (!e.currentTarget.contains(e.relatedTarget)) setDragging(false); },
    onDrop: e => { e.preventDefault(); setDragging(false); if (e.dataTransfer.files.length) openUpload({ files: [...e.dataTransfer.files], category: uploadCategory }); },
  };

  return (
    <div {...dropProps} className="relative min-h-[60vh]">
      {dragging && (
        <div className="pointer-events-none absolute -inset-4 z-20 grid place-items-center rounded-2xl border-2 border-dashed border-accent bg-accent-soft/80">
          <div className="flex items-center gap-2 font-medium text-accent"><Upload size={20} /> Drop photos to add them</div>
        </div>
      )}

      <PageHeader
        eyebrow="Your digital closet"
        title="Wardrobe"
        subtitle="Everything you own, in one place. Drag photos anywhere on this page to add more."
        actions={<button className="btn btn-primary" onClick={() => openUpload({ category: uploadCategory })}><ImagePlus size={16} /> Add clothes</button>}
      />

      {items.length > 0 && (
        <dl className="mb-6 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
          <StatCard label="Items" value={items.length} />
          <StatCard label="Outfit combinations" value={combos.toLocaleString()} />
          <StatCard label="Ready to wear" value={items.length - counts.laundry} />
          <StatCard label="In laundry" value={counts.laundry} />
        </dl>
      )}

      <div className="no-scrollbar -mx-4 mb-6 flex min-w-0 gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0">
        <Chip active={tab === 'all'} onClick={() => setTab('all')}>All <span className="opacity-60">{counts.all}</span></Chip>
        {tabs.map(c => (
          <Chip key={c.id} active={tab === c.id} onClick={() => setTab(c.id)}>{c.label} <span className="opacity-60">{counts[c.id]}</span></Chip>
        ))}
        <Chip active={tab === 'laundry'} onClick={() => setTab('laundry')}><WashingMachine size={14} /> Laundry <span className="opacity-60">{counts.laundry}</span></Chip>
      </div>

      {tab === 'laundry' && counts.laundry > 0 && (
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line bg-white px-4 py-3 text-sm">
          <span className="text-ink-2">These items are skipped when picking outfits until they’re washed.</span>
          <button className="btn btn-primary h-9" onClick={washAll}>Mark all as washed</button>
        </div>
      )}

      {shown.length ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4 xl:grid-cols-5">
          {shown.map(item => <ItemCard key={item.id} item={item} />)}
        </div>
      ) : (
        <div className="card flex flex-col items-center px-6 py-16 text-center">
          <span className="grid size-12 place-items-center rounded-full bg-accent-soft text-accent">
            {tab === 'laundry' ? <WashingMachine size={22} /> : <ImagePlus size={22} />}
          </span>
          <h2 className="mt-4 font-display text-xl font-semibold">{tab === 'laundry' ? 'Laundry basket is empty' : 'Nothing here yet'}</h2>
          <p className="mt-1.5 max-w-sm text-sm text-muted">
            {tab === 'laundry' ? 'Clothes land here automatically after you wear them a few times.' : 'Drag photos onto this page, or use the button below. You can select many photos at once.'}
          </p>
          {tab !== 'laundry' && (
            <div className="mt-6 flex flex-wrap justify-center gap-2">
              <button className="btn btn-primary" onClick={() => openUpload({ category: uploadCategory })}><ImagePlus size={16} /> Add clothes</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
