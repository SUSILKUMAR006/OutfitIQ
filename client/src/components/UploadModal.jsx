// Batch upload: pick a category, drop many photos, review auto-detected details, save.
// When the server has a Gemini key, each photo is also tagged by AI (type, color, style, warmth, name).
import { useEffect, useRef, useState } from 'react';
import { CircleAlert, ImagePlus, Loader2, Sparkles, Trash2, Upload } from 'lucide-react';
import { CATEGORIES, defaultsFor, guessSubtype } from '@outfitiq/shared/catalog.js';
import { nameOf } from '@outfitiq/shared/colors.js';
import { useAppData } from '../AppData.jsx';
import { api } from '../api.js';
import { prepareImage } from '../lib/image.js';
import { cx } from '../lib/format.js';
import Modal from './Modal.jsx';
import { Chip } from './ui.jsx';
import { ColorField, StyleSelect, TypeSelect, WarmthSelect } from './ItemFields.jsx';

let draftSeq = 0;
const AI_CONCURRENCY = 3;

// Ask the server once whether AI tagging is available (retry next time if the check itself failed).
let aiStatusPromise = null;
const checkAi = () => (aiStatusPromise ||= api.aiStatus().then(s => s.enabled).catch(() => { aiStatusPromise = null; return false; }));

export default function UploadModal({ initialFiles, initialCategory = 'top' }) {
  const { closeModal, addItems, notify } = useAppData();
  const [category, setCategory] = useState(initialCategory);
  const [drafts, setDrafts] = useState([]);
  const [aiOn, setAiOn] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [saving, setSaving] = useState(false);
  const inputRef = useRef();
  const draftsRef = useRef(drafts);
  draftsRef.current = drafts;
  const aiQueue = useRef([]);
  const aiActive = useRef(0);

  useEffect(() => { checkAi().then(setAiOn); }, []);
  // Free preview blobs when the dialog closes.
  useEffect(() => () => draftsRef.current.forEach(d => d.previewUrl && URL.revokeObjectURL(d.previewUrl)), []);

  const update = (key, patch) => setDrafts(prev => prev.map(d => (d.key === key ? { ...d, ...patch } : d)));
  // User edits win: once touched, late AI results no longer overwrite the fields.
  const edit = (key, patch) => update(key, { ...patch, touched: true });

  function pumpAi() {
    while (aiActive.current < AI_CONCURRENCY && aiQueue.current.length) {
      const job = aiQueue.current.shift();
      aiActive.current++;
      tagWithAi(job).finally(() => { aiActive.current--; pumpAi(); });
    }
  }

  async function tagWithAi({ key, blob }) {
    try {
      const t = await api.tagImage(blob);
      setDrafts(prev => prev.map(d => {
        if (d.key !== key) return d;
        const status = t.isClothing ? 'done' : 'unsure';
        if (d.touched) return { ...d, ai: status };
        return {
          ...d,
          ai: status,
          category: t.category,
          subtype: t.subtype,
          style: t.style,
          warmth: t.warmth,
          name: t.name || d.name,
          ...(t.color ? { color: t.color, colorName: t.colorName || nameOf(t.color) } : {}),
        };
      }));
    } catch {
      update(key, { ai: 'failed' });
    }
  }

  async function addFiles(fileList, cat = category) {
    const files = [...fileList].filter(f => f.type.startsWith('image/'));
    if (!files.length) return notify('Please choose image files', 'error');
    const fresh = files.map(file => {
      const subtype = guessSubtype(file.name, cat);
      return { key: ++draftSeq, file, status: 'processing', category: cat, subtype, name: '', ...defaultsFor(subtype) };
    });
    setDrafts(prev => [...prev, ...fresh]);
    const useAi = await checkAi();
    for (const d of fresh) {
      try {
        const { blob, color, previewUrl } = await prepareImage(d.file);
        update(d.key, { blob, color, colorName: nameOf(color), previewUrl, status: 'ready', ai: useAi ? 'running' : null });
        if (useAi) { aiQueue.current.push({ key: d.key, blob }); pumpAi(); }
      } catch {
        update(d.key, { status: 'error' });
      }
    }
  }

  // Files dropped onto the page before the dialog opened (ref guards StrictMode's double effect run).
  const started = useRef(false);
  useEffect(() => {
    if (started.current || !initialFiles?.length) return;
    started.current = true;
    addFiles(initialFiles);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const remove = key => setDrafts(prev => {
    const d = prev.find(x => x.key === key);
    if (d?.previewUrl) URL.revokeObjectURL(d.previewUrl);
    return prev.filter(x => x.key !== key);
  });

  const ready = drafts.filter(d => d.status === 'ready');
  const processing = drafts.some(d => d.status === 'processing');
  const tagging = drafts.filter(d => d.ai === 'running').length;

  async function save() {
    setSaving(true);
    const form = new FormData();
    ready.forEach((d, i) => form.append('images', d.blob, `item-${i}.jpg`));
    form.append('meta', JSON.stringify(ready.map(d => ({
      category: d.category, subtype: d.subtype, color: d.color, colorName: d.colorName, style: d.style, warmth: d.warmth,
      name: d.name?.trim() || undefined,
    }))));
    try {
      const created = await api.uploadItems(form);
      addItems(created);
      notify(`Added ${created.length} item${created.length === 1 ? '' : 's'} to your wardrobe`);
      closeModal();
    } catch (err) {
      notify(err.message, 'error');
      setSaving(false);
    }
  }

  const onDrop = e => { e.preventDefault(); setDragging(false); addFiles(e.dataTransfer.files); };
  const dropProps = {
    onDragOver: e => { e.preventDefault(); setDragging(true); },
    onDragLeave: () => setDragging(false),
    onDrop,
  };

  const status = processing ? 'Reading photos…' : tagging ? `AI is tagging ${tagging} photo${tagging === 1 ? '' : 's'}…` : `${ready.length} ready to add`;

  return (
    <Modal title="Add clothes" onClose={closeModal} wide
      footer={drafts.length > 0 && (
        <>
          <span className="mr-auto flex items-center gap-1.5 text-sm text-muted">
            {tagging > 0 && <Sparkles size={15} className="text-accent" />}{status}
          </span>
          <button className="btn btn-secondary" onClick={() => inputRef.current.click()}><ImagePlus size={16} /> More photos</button>
          <button className="btn btn-primary" disabled={!ready.length || processing || tagging > 0 || saving} onClick={save}>
            {saving ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
            Add {ready.length || ''} item{ready.length === 1 ? '' : 's'}
          </button>
        </>
      )}>
      <input ref={inputRef} type="file" accept="image/*" multiple hidden
        onChange={e => { addFiles(e.target.files); e.target.value = ''; }} />

      <p className="label">{aiOn ? 'What are you adding? (AI will double-check)' : 'What are you adding?'}</p>
      <div className="no-scrollbar -mx-1 mb-4 flex min-w-0 gap-2 overflow-x-auto px-1 pb-1">
        {CATEGORIES.map(c => <Chip key={c.id} active={category === c.id} onClick={() => setCategory(c.id)}>{c.label}</Chip>)}
      </div>

      {drafts.length === 0 ? (
        <button type="button" {...dropProps} onClick={() => inputRef.current.click()}
          className={cx('flex w-full flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed px-6 py-14 text-center transition-colors',
            dragging ? 'border-accent bg-accent-soft' : 'border-line hover:bg-surface-2')}>
          <span className="grid size-14 place-items-center rounded-full bg-accent-soft text-accent"><ImagePlus size={26} /></span>
          <span className="font-medium">Drop photos here or click to choose</span>
          <span className="max-w-sm text-sm text-muted">
            {aiOn
              ? 'Select many at once. Gemini AI recognises each item and fills in its type, color, style and name for you.'
              : 'Select many at once. Lay each item flat on a plain background — colors and details are filled in for you.'}
          </span>
          {aiOn && <span className="inline-flex items-center gap-1.5 rounded-full bg-accent-soft px-3 py-1 text-xs font-medium text-accent"><Sparkles size={13} /> AI tagging on</span>}
        </button>
      ) : (
        <ul className="space-y-3" {...dropProps}>
          {drafts.map(d => (
            <li key={d.key} className="flex gap-3 rounded-xl border border-line p-3">
              <div className="relative grid size-24 shrink-0 place-items-center overflow-hidden rounded-xl bg-tile">
                {d.status === 'ready' && <img src={d.previewUrl} alt="" className="size-full object-contain mix-blend-multiply" />}
                {d.status === 'processing' && <Loader2 className="animate-spin text-muted" />}
                {d.status === 'error' && <span className="px-2 text-center text-xs text-warn">Can’t read this image</span>}
                {d.ai === 'running' && (
                  <span className="absolute inset-x-1 bottom-1 flex items-center justify-center gap-1 rounded-md bg-white/90 py-0.5 text-[10px] font-medium text-accent">
                    <Loader2 size={11} className="animate-spin" /> AI tagging
                  </span>
                )}
                {d.ai === 'done' && (
                  <span className="absolute left-1 top-1 grid size-5 place-items-center rounded-full bg-accent text-white" title="Tagged by AI"><Sparkles size={11} /></span>
                )}
              </div>
              <div className="grid min-w-0 flex-1 grid-cols-2 gap-2 sm:grid-cols-4">
                <div className="col-span-2 sm:col-span-4">
                  <label className="label" htmlFor={`n${d.key}`}>Name</label>
                  <input id={`n${d.key}`} className="field" maxLength={60} value={d.name} placeholder={`${d.colorName || ''} ${d.subtype.toLowerCase()}`.trim()}
                    onChange={e => edit(d.key, { name: e.target.value })} />
                </div>
                <div className="col-span-2 sm:col-span-1">
                  <label className="label" htmlFor={`t${d.key}`}>Type</label>
                  <TypeSelect id={`t${d.key}`} value={d.subtype} onChange={p => edit(d.key, p)} />
                </div>
                <div className="col-span-2 sm:col-span-1">
                  <label className="label" htmlFor={`c${d.key}`}>Color</label>
                  {d.color ? <ColorField id={`c${d.key}`} color={d.color} colorName={d.colorName} onChange={p => edit(d.key, p)} /> : <div className="field" />}
                </div>
                <div>
                  <label className="label" htmlFor={`s${d.key}`}>Style</label>
                  <StyleSelect id={`s${d.key}`} value={d.style} onChange={p => edit(d.key, p)} />
                </div>
                <div>
                  <label className="label" htmlFor={`w${d.key}`}>Warmth</label>
                  <WarmthSelect id={`w${d.key}`} value={d.warmth} category={d.category} onChange={p => edit(d.key, p)} />
                </div>
                {(d.ai === 'unsure' || d.ai === 'failed') && (
                  <p className="col-span-2 flex items-center gap-1.5 text-xs text-warn sm:col-span-4">
                    <CircleAlert size={13} />
                    {d.ai === 'unsure' ? 'AI isn’t sure this is clothing — please check the details.' : 'AI tagging unavailable for this photo — please check the details.'}
                  </p>
                )}
              </div>
              <button className="btn btn-ghost size-9 shrink-0 self-start px-0" onClick={() => remove(d.key)} aria-label="Remove photo">
                <Trash2 size={17} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </Modal>
  );
}
