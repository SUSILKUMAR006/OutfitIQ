// AI stylist chat: a Gemini agent that uses tools (wardrobe, weather, outfit search, planner, favorites, laundry).
import { Fragment, useEffect, useRef, useState } from 'react';
import { ArrowUp, Check, CircleAlert, Loader2, RotateCcw, Sparkles } from 'lucide-react';
import { useAppData } from '../AppData.jsx';
import { api } from '../api.js';
import { cx } from '../lib/format.js';
import OutfitCard from '../components/OutfitCard.jsx';
import { PageHeader } from '../components/ui.jsx';

const SUGGESTIONS = [
  'What should I wear to work today?',
  'Plan my outfits for this week',
  'I have a wedding on Saturday — what should I wear?',
  'What goes well with my navy polo?',
  'Which clothes haven’t I worn in a while?',
];

// Chat survives navigating between pages (cleared on reload or with "New chat").
let savedChat = [];

// Minimal formatting for model replies: paragraphs, bullet lists and **bold**.
function RichText({ text }) {
  const inline = line => line.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
    part.startsWith('**') && part.endsWith('**') ? <strong key={i} className="font-semibold">{part.slice(2, -2)}</strong> : <Fragment key={i}>{part}</Fragment>);
  return text.split(/\n{2,}/).map((block, i) => {
    const lines = block.split('\n').filter(l => l.trim());
    if (lines.length && lines.every(l => /^\s*([-*•]|\d+\.)\s+/.test(l))) {
      return (
        <ul key={i} className="list-disc space-y-1 pl-5">
          {lines.map((l, j) => <li key={j}>{inline(l.replace(/^\s*([-*•]|\d+\.)\s+/, ''))}</li>)}
        </ul>
      );
    }
    return <p key={i}>{lines.map((l, j) => <Fragment key={j}>{j > 0 && <br />}{inline(l)}</Fragment>)}</p>;
  });
}

function Steps({ steps, running }) {
  if (!steps?.length && !running) return null;
  return (
    <ul className="mb-3 flex flex-wrap gap-1.5">
      {steps.map((s, i) => {
        const active = running && i === steps.length - 1;
        return (
          <li key={i} className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface-2/60 px-2.5 py-1 text-xs text-ink-2">
            {active ? <Loader2 size={12} className="animate-spin text-accent" /> : <Check size={12} className="text-good" />}
            {s}
          </li>
        );
      })}
      {running && !steps.length && (
        <li className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface-2/60 px-2.5 py-1 text-xs text-ink-2">
          <Loader2 size={12} className="animate-spin text-accent" /> Thinking…
        </li>
      )}
    </ul>
  );
}

function AssistantMessage({ msg }) {
  return (
    <div className="flex gap-3">
      <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-full bg-ink text-white"><Sparkles size={15} /></span>
      <div className="min-w-0 flex-1">
        <Steps steps={msg.steps} running={msg.status === 'running'} />
        {msg.status === 'error' && (
          <p className="flex items-center gap-2 text-sm text-warn"><CircleAlert size={16} /> {msg.text}</p>
        )}
        {msg.status === 'done' && <div className="space-y-3 text-[15px] leading-relaxed text-ink-2"><RichText text={msg.text} /></div>}
        {msg.outfits?.length > 0 && (
          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {msg.outfits.map((o, i) => (
              <div key={i} className="flex flex-col">
                {(o.title || o.note) && (
                  <div className="mb-2 px-1">
                    {o.title && <p className="text-sm font-semibold">{o.title}</p>}
                    {o.note && <p className="text-xs text-muted">{o.note}</p>}
                  </div>
                )}
                <OutfitCard outfit={{ key: o.itemIds.join('|'), itemIds: o.itemIds, score: o.score }} />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default function Stylist() {
  const { reload, openSettings } = useAppData();
  const [messages, setMessages] = useState(savedChat);
  const [input, setInput] = useState('');
  const [aiOn, setAiOn] = useState(null);
  const busy = messages.some(m => m.status === 'running');
  const endRef = useRef();
  const inputRef = useRef();

  useEffect(() => { savedChat = messages; }, [messages]);
  useEffect(() => { api.aiStatus().then(s => setAiOn(s.enabled)).catch(() => setAiOn(false)); }, []);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }); }, [messages]);

  const patchLast = patch => setMessages(prev => prev.map((m, i) => (i === prev.length - 1 ? { ...m, ...(typeof patch === 'function' ? patch(m) : patch) } : m)));

  async function send(text) {
    const question = text.trim();
    if (!question || busy) return;
    setInput('');
    // Only finished turns are sent as context. Shown outfits are appended (with item ids) so follow-ups
    // like "log the first one" work; the user never sees this note.
    const withOutfits = m => (m.outfits?.length
      ? `${m.text}\n\n[Outfits shown to the user, by item ids: ${m.outfits.map((o, i) => `${i + 1}) ${o.itemIds.join(', ')}`).join('; ')}]`
      : m.text);
    const history = [...messages.filter(m => m.status !== 'error' && m.text), { role: 'user', text: question }]
      .map(m => ({ role: m.role, text: withOutfits(m) }));
    setMessages(prev => [...prev, { role: 'user', text: question }, { role: 'assistant', status: 'running', steps: [], text: '' }]);
    try {
      await api.agentChat(history, ev => {
        if (ev.type === 'tool') patchLast(m => ({ steps: [...m.steps, ev.label] }));
        else if (ev.type === 'done') {
          patchLast({ status: 'done', text: ev.text, outfits: ev.outfits });
          if (ev.changed) reload(); // the agent saved favorites, logged wear, etc.
        } else if (ev.type === 'error') patchLast({ status: 'error', text: ev.error });
      });
    } catch (err) {
      patchLast({ status: 'error', text: err.message });
    }
    setMessages(prev => prev.map((m, i) => (i === prev.length - 1 && m.status === 'running' ? { ...m, status: 'error', text: 'The connection was interrupted.' } : m)));
    inputRef.current?.focus();
  }

  const header = (
    <PageHeader eyebrow="AI stylist" title="Ask your stylist"
      subtitle="Powered by Gemini. It can check the weather, search every outfit, plan your week, save favorites and update your laundry."
      actions={messages.length > 0 && <button className="btn btn-secondary" onClick={() => setMessages([])} disabled={busy}><RotateCcw size={16} /> New chat</button>} />
  );

  if (aiOn === false) {
    return (
      <>
        {header}
        <div className="card mx-auto max-w-xl p-8 text-center">
          <span className="mx-auto grid size-12 place-items-center rounded-full bg-accent-soft text-accent"><Sparkles size={22} /></span>
          <h2 className="mt-4 font-display text-xl font-semibold">The stylist isn’t switched on</h2>
          <p className="mt-2 text-sm text-muted">Add <code className="rounded bg-surface-2 px-1">GEMINI_API_KEY</code> to <code className="rounded bg-surface-2 px-1">server/.env</code> and restart the server.</p>
        </div>
      </>
    );
  }

  return (
    <div>
      {header}
      <div className="card flex min-h-[60vh] flex-col">
        <div className="flex-1 space-y-8 p-4 sm:p-6">
          {messages.length === 0 ? (
            <div className="mx-auto flex max-w-xl flex-col items-center py-10 text-center">
              <span className="grid size-12 place-items-center rounded-full bg-accent-soft text-accent"><Sparkles size={22} /></span>
              <h2 className="mt-4 font-display text-xl font-semibold">What can I help you wear?</h2>
              <p className="mt-1.5 text-sm text-muted">I only suggest clothes you actually own, and I check the forecast for you.</p>
              <div className="mt-6 flex flex-wrap justify-center gap-2">
                {SUGGESTIONS.map(s => (
                  <button key={s} className="chip" onClick={() => send(s)}>{s}</button>
                ))}
              </div>
              <button className="mt-6 text-xs text-muted hover:text-ink" onClick={openSettings}>Tip: set your city in Settings for weather-aware advice</button>
            </div>
          ) : (
            messages.map((m, i) => (m.role === 'user' ? (
              <div key={i} className="flex justify-end">
                <p className="max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-br-md bg-ink px-4 py-2.5 text-[15px] text-white">{m.text}</p>
              </div>
            ) : <AssistantMessage key={i} msg={m} />))
          )}
          <div ref={endRef} />
        </div>

        <form className="sticky bottom-20 border-t border-line bg-white p-3 sm:p-4 md:bottom-0" onSubmit={e => { e.preventDefault(); send(input); }}>
          <div className="flex items-end gap-2 rounded-xl border border-line bg-white p-1.5 pl-3 focus-within:border-accent focus-within:ring-3 focus-within:ring-accent/15">
            <textarea ref={inputRef} rows={1} value={input} maxLength={2000} disabled={aiOn === null}
              placeholder="Ask about outfits, plans, weather or your wardrobe…"
              className="max-h-40 min-h-9 flex-1 resize-none bg-transparent py-1.5 text-[15px] outline-none placeholder:text-muted"
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(input); } }} />
            <button className={cx('btn btn-primary size-9 shrink-0 px-0', (!input.trim() || busy) && 'opacity-40')} disabled={!input.trim() || busy} aria-label="Send">
              {busy ? <Loader2 size={17} className="animate-spin" /> : <ArrowUp size={17} />}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
