// View / edit one wardrobe item.
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { LayoutGrid, Trash2, WashingMachine } from 'lucide-react';
import { WASHABLE } from '@outfitiq/shared/catalog.js';
import { useAppData } from '../AppData.jsx';
import { shortDate } from '../lib/format.js';
import Modal from './Modal.jsx';
import { ColorField, StyleSelect, TypeSelect, WarmthSelect } from './ItemFields.jsx';

export default function ItemModal({ id }) {
  const { itemsById, history, closeModal, updateItem, deleteItem } = useAppData();
  const navigate = useNavigate();
  const item = itemsById.get(id);
  const [form, setForm] = useState(() => item && {
    name: item.name, category: item.category, subtype: item.subtype, color: item.color,
    colorName: item.colorName, style: item.style, warmth: item.warmth, clean: item.clean !== false,
  });
  const [busy, setBusy] = useState(false);
  if (!item) return null;

  const set = patch => setForm(f => ({ ...f, ...patch }));
  const lastWorn = history.find(h => h.itemIds.includes(id))?.date;

  async function save() {
    setBusy(true);
    if (await updateItem(id, form)) closeModal();
    setBusy(false);
  }
  async function remove() {
    if (!confirm(`Delete “${item.name}” from your wardrobe?`)) return;
    setBusy(true);
    if (await deleteItem(id)) closeModal();
    setBusy(false);
  }

  return (
    <Modal title="Item details" onClose={closeModal}
      footer={<>
        <button className="btn btn-ghost mr-auto text-red-600" onClick={remove} disabled={busy}><Trash2 size={16} /> Delete</button>
        <button className="btn btn-secondary" onClick={() => { closeModal(); navigate(`/outfits?item=${id}`); }}><LayoutGrid size={16} /> Outfits with this</button>
        <button className="btn btn-primary" onClick={save} disabled={busy || !form.name.trim()}>Save</button>
      </>}>
      <div className="grid gap-5 sm:grid-cols-[180px_1fr]">
        <div>
          <div className="aspect-square overflow-hidden rounded-xl bg-tile">
            <img src={item.image} alt={item.name} className="size-full object-contain p-3 mix-blend-multiply" />
          </div>
          <dl className="mt-3 grid grid-cols-2 gap-2 text-center">
            <div className="rounded-xl bg-surface-2 p-2"><dt className="text-[11px] text-muted">Worn</dt><dd className="font-semibold">{item.wearCount || 0}×</dd></div>
            <div className="rounded-xl bg-surface-2 p-2"><dt className="text-[11px] text-muted">Last worn</dt><dd className="font-semibold">{lastWorn ? shortDate(lastWorn) : 'Never'}</dd></div>
          </dl>
        </div>
        <div className="space-y-3">
          <div>
            <label className="label" htmlFor="item-name">Name</label>
            <input id="item-name" className="field" value={form.name} maxLength={60} onChange={e => set({ name: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="label" htmlFor="item-type">Type</label><TypeSelect id="item-type" value={form.subtype} onChange={set} /></div>
            <div><label className="label" htmlFor="item-color">Color</label><ColorField id="item-color" color={form.color} colorName={form.colorName} onChange={set} /></div>
            <div><label className="label" htmlFor="item-style">Style</label><StyleSelect id="item-style" value={form.style} onChange={set} /></div>
            <div><label className="label" htmlFor="item-warmth">Warmth</label><WarmthSelect id="item-warmth" value={form.warmth} category={form.category} onChange={set} /></div>
          </div>
          {WASHABLE.has(form.category) && (
            <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-line p-3 text-sm">
              <WashingMachine size={18} className="text-muted" />
              <span className="flex-1">In the laundry <span className="block text-xs text-muted">Laundry items are left out of today’s picks</span></span>
              <input type="checkbox" className="size-5 accent-accent" checked={!form.clean} onChange={e => set({ clean: !e.target.checked })} />
            </label>
          )}
        </div>
      </div>
    </Modal>
  );
}
