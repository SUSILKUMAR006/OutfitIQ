// Form controls shared by the upload and edit dialogs.
import { CATEGORIES, STYLES, WARMTH, WASHABLE, defaultsFor } from '@outfitiq/shared/catalog.js';
import { nameOf } from '@outfitiq/shared/colors.js';

// Changing the type also resets style/warmth to sensible defaults for that type.
export function typeChange(subtype) {
  const category = CATEGORIES.find(c => c.subtypes.includes(subtype)).id;
  return { category, subtype, ...defaultsFor(subtype) };
}

export function TypeSelect({ value, onChange, id }) {
  return (
    <select id={id} className="field" value={value} onChange={e => onChange(typeChange(e.target.value))}>
      {CATEGORIES.map(c => (
        <optgroup key={c.id} label={c.label}>
          {c.subtypes.map(s => <option key={s} value={s}>{s}</option>)}
        </optgroup>
      ))}
    </select>
  );
}

export function StyleSelect({ value, onChange, id }) {
  return (
    <select id={id} className="field" value={value} onChange={e => onChange({ style: e.target.value })}>
      {STYLES.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
    </select>
  );
}

export function WarmthSelect({ value, onChange, category, id }) {
  if (!WASHABLE.has(category)) return <div className="field flex items-center text-muted">—</div>;
  return (
    <select id={id} className="field" value={value} onChange={e => onChange({ warmth: Number(e.target.value) })}>
      {WARMTH.map(w => <option key={w.id} value={w.id}>{w.label}</option>)}
    </select>
  );
}

export function ColorField({ color, colorName, onChange, id }) {
  return (
    <label htmlFor={id} className="field flex cursor-pointer items-center gap-2">
      <input id={id} type="color" value={color} className="size-6 shrink-0 cursor-pointer rounded border-0 bg-transparent p-0"
        onChange={e => onChange({ color: e.target.value, colorName: nameOf(e.target.value) })} />
      <span className="truncate">{colorName}</span>
    </label>
  );
}
