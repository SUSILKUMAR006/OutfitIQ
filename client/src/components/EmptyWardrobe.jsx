import { Check, CloudSun, ImagePlus, Layers } from 'lucide-react';
import { useAppData } from '../AppData.jsx';
import { cx } from '../lib/format.js';

const NEEDS = [
  { id: 'top', label: 'At least one top', hint: 'Shirt, t-shirt, polo…', category: 'top' },
  { id: 'bottom', label: 'At least one bottom', hint: 'Pants, jeans, chinos…', category: 'bottom' },
  { id: 'shoes', label: 'At least one pair of shoes', hint: 'Sneakers, formal shoes…', category: 'shoes' },
];

const STEPS = [
  { icon: ImagePlus, title: 'Upload once', text: 'Add photos of shirts, pants, shoes, watches and accessories. Colors are detected automatically.' },
  { icon: Layers, title: 'Every combination', text: 'OutfitIQ pairs everything you own and scores each look for color, style and occasion.' },
  { icon: CloudSun, title: 'Dressed in seconds', text: 'Each morning get the best outfit for the weather and your plans — no repeats.' },
];

export default function EmptyWardrobe({ missing }) {
  const { openUpload } = useAppData();

  return (
    <div className="space-y-6">
      <div className="card grid overflow-hidden lg:grid-cols-[1.1fr_1fr]">
        <div className="p-6 sm:p-10">
          <p className="eyebrow mb-3">Get started</p>
          <h2 className="font-display text-2xl font-semibold leading-tight tracking-tight sm:text-3xl">
            Snap your clothes once.<br />Get dressed in seconds, every day.
          </h2>
          <p className="mt-3 max-w-md text-[15px] text-muted">Add a few pieces to unlock your first outfit recommendations.</p>
          <div className="mt-7 flex flex-wrap gap-2">
            <button className="btn btn-primary h-11 px-5" onClick={() => openUpload({ category: missing[0] || 'top' })}><ImagePlus size={17} /> Add clothes</button>
          </div>
        </div>
        <div className="border-t border-line bg-surface-2/50 p-6 sm:p-10 lg:border-l lg:border-t-0">
          <p className="mb-4 text-xs font-semibold uppercase tracking-[0.1em] text-muted">Checklist</p>
          <ul className="space-y-2.5">
            {NEEDS.map(n => {
              const ok = !missing.includes(n.id);
              return (
                <li key={n.id} className="flex items-center gap-3 rounded-lg border border-line bg-white px-4 py-3">
                  <span className={cx('grid size-6 shrink-0 place-items-center rounded-full', ok ? 'bg-good text-white' : 'border-2 border-line-strong')}>
                    {ok && <Check size={14} strokeWidth={3} />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className={cx('block text-sm font-medium', ok && 'text-muted line-through')}>{n.label}</span>
                    <span className="text-xs text-muted">{n.hint}</span>
                  </span>
                  {!ok && <button className="btn btn-secondary h-8 px-3 text-xs" onClick={() => openUpload({ category: n.category })}>Add</button>}
                </li>
              );
            })}
          </ul>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        {STEPS.map(({ icon: Icon, title, text }, i) => (
          <div key={title} className="card p-5">
            <div className="flex items-center gap-3">
              <span className="grid size-9 place-items-center rounded-lg bg-accent-soft text-accent"><Icon size={18} /></span>
              <span className="text-xs font-semibold text-muted">Step {i + 1}</span>
            </div>
            <h3 className="mt-4 font-semibold">{title}</h3>
            <p className="mt-1 text-sm text-muted">{text}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
