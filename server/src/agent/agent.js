// The AI stylist agent: a Gemini function-calling loop over the wardrobe tools.
// Gemini decides which tools to call; we run them against real data and feed results back
// until it answers in plain text (or the step limit is reached).
import { OCCASIONS } from '@outfitiq/shared/catalog.js';
import { addDays } from '@outfitiq/shared/engine.js';
import { db } from '../db.js';
import { AiError, aiEnabled } from '../ai.js';
import { TOOLS, declarations } from './tools.js';

const ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models';
const DEFAULT_MODEL = 'gemini-3.5-flash'; // ~15 s per multi-step request; the lite model was ~3x slower here
const MAX_STEPS = 8;
// Tools that only display things: if the model calls just these and already wrote its reply, we can stop early.
const TERMINAL_TOOLS = new Set(['show_outfits']);

export const agentModel = () => process.env.GEMINI_AGENT_MODEL || DEFAULT_MODEL;

function systemPrompt(today) {
  const s = db().settings;
  const weekday = d => new Date(`${d}T12:00:00`).toLocaleDateString('en-US', { weekday: 'long' });
  const calendar = Array.from({ length: 8 }, (_, i) => addDays(today, i)).map(d => `${weekday(d)} ${d}`).join(', ');
  const occ = id => OCCASIONS.find(o => o.id === id)?.label || id;
  return `You are OutfitIQ's personal stylist. You help the user decide what to wear using ONLY clothes they own.

Today is ${weekday(today)} ${today}. Upcoming dates: ${calendar}.
User's city: ${s.location?.name || 'not set (weather unavailable unless the user describes it)'}. Temperature unit they prefer: °${s.unit}.
Usual occasion: ${occ(s.weekdayOccasion)} on weekdays, ${occ(s.weekendOccasion)} on weekends. Wardrobe size: ${db().items.length} items.

How to work:
- Always use tools to look at the wardrobe, weather and scores. Never invent items, ids or scores.
- To recommend outfits use find_outfits (or score_outfit for a combination the user proposes). find_outfits already includes the forecast, so don't call get_weather separately for outfit requests.
- When you recommend outfits, finish in ONE response: call show_outfits with 1-3 outfits AND write your reply text in that same response.
- Call independent tools in parallel in the same response when you can (e.g. find_outfits for two different dates).
- Resolve relative dates ("tomorrow", "Saturday") to YYYY-MM-DD using the dates above. Forecasts exist only for the next 7 days; otherwise ask about the weather or use a weather override.
- Only change data (log_wear, save_favorite, set_laundry, set_occasion) when the user asks for it or clearly agrees. Say what you changed.
- If the wardrobe is missing pieces, say what to add (via the Add clothes button).
- Reply in a warm, concise, practical tone: 2-5 short sentences, refer to items by name, mention weather when relevant. Convert temperatures to °${s.unit}. No item ids in the reply text.`;
}

async function callGemini(body) {
  let res;
  try {
    res = await fetch(`${ENDPOINT}/${agentModel()}:generateContent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': process.env.GEMINI_API_KEY },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(45000),
    });
  } catch (err) {
    throw new AiError(err.name === 'TimeoutError' ? 'The stylist took too long to answer.' : 'Could not reach Gemini.');
  }
  const json = await res.json().catch(() => null);
  if (!res.ok) {
    console.warn('Gemini agent error:', res.status, json?.error?.message);
    throw new AiError(res.status === 429 ? 'The stylist is busy (rate limit) — try again in a moment.' : 'The stylist ran into a problem.', res.status === 429 ? 429 : 502);
  }
  return json;
}

/**
 * Run one user turn. `messages` is the chat so far ([{ role: 'user'|'assistant', text }]), ending with the user.
 * `onEvent` receives progress: { type: 'tool', name, label } as tools run.
 * Resolves to { text, outfits, changed }.
 */
export async function runAgent({ messages, today, onEvent = () => {} }) {
  if (!aiEnabled()) throw new AiError('The stylist needs a Gemini key (GEMINI_API_KEY in server/.env).', 501);

  const contents = messages.map(m => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.text }] }));
  const ctx = { today, shown: [] };
  let changed = false;

  for (let step = 0; step < MAX_STEPS; step++) {
    const json = await callGemini({
      systemInstruction: { parts: [{ text: systemPrompt(today) }] },
      contents,
      tools: [{ functionDeclarations: declarations }],
      toolConfig: { functionCallingConfig: { mode: 'AUTO' } },
      generationConfig: { temperature: 0.4 },
    });
    const content = json?.candidates?.[0]?.content;
    if (!content?.parts?.length) throw new AiError('The stylist returned an empty answer.');
    contents.push(content); // keep the model turn as-is (incl. thought signatures) for the next round

    const calls = content.parts.filter(p => p.functionCall);
    const text = content.parts.filter(p => p.text && !p.thought).map(p => p.text).join('').trim();
    if (!calls.length) return { text: text || 'Done.', outfits: ctx.shown, changed };

    const responses = [];
    for (const { functionCall: call } of calls) {
      const tool = TOOLS[call.name];
      const args = call.args || {};
      let result;
      if (!tool) {
        result = { error: `Unknown tool ${call.name}` };
      } else {
        const label = tool.label(args, ctx);
        if (label) onEvent({ type: 'tool', name: call.name, label });
        try {
          result = await tool.run(args, ctx);
          if (tool.mutates && !result.error) changed = true;
        } catch (err) {
          console.error(`Tool ${call.name} failed:`, err);
          result = { error: 'This tool failed. Try a different approach.' };
        }
      }
      responses.push({ functionResponse: { name: call.name, response: result, ...(call.id ? { id: call.id } : {}) } });
    }
    // Reply already written and only display tools were called: no need for another round trip.
    if (text && calls.every(c => TERMINAL_TOOLS.has(c.functionCall.name))) return { text, outfits: ctx.shown, changed };
    contents.push({ role: 'user', parts: responses });
  }

  return {
    text: ctx.shown.length ? 'Here’s what I found.' : 'Sorry, that took too many steps — could you rephrase or narrow it down?',
    outfits: ctx.shown,
    changed,
  };
}
