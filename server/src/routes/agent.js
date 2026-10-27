// AI stylist chat. Streams newline-delimited JSON so the UI can show each tool step live:
//   {"type":"tool","name":"get_weather","label":"Checked the weather"}
//   {"type":"done","text":"…","outfits":[…],"changed":true}
//   {"type":"error","error":"…"}
import express from 'express';
import { dayKey } from '@outfitiq/shared/engine.js';
import { AiError, aiEnabled } from '../ai.js';
import { runAgent } from '../agent/agent.js';
import { DATE } from '../services.js';

const router = express.Router();
const MAX_MESSAGES = 20;
const MAX_CHARS = 2000;

router.post('/chat', async (req, res) => {
  const raw = Array.isArray(req.body?.messages) ? req.body.messages : [];
  const messages = raw
    .filter(m => (m?.role === 'user' || m?.role === 'assistant') && typeof m.text === 'string' && m.text.trim())
    .slice(-MAX_MESSAGES)
    .map(m => ({ role: m.role, text: m.text.trim().slice(0, MAX_CHARS) }));
  if (!messages.length || messages[messages.length - 1].role !== 'user') {
    return res.status(400).json({ error: 'Send messages ending with a user message.' });
  }
  if (!aiEnabled()) return res.status(501).json({ error: 'The stylist needs a Gemini key (GEMINI_API_KEY in server/.env).' });

  const today = DATE.test(req.body?.date) ? req.body.date : dayKey();
  res.setHeader('Content-Type', 'application/x-ndjson; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache');
  const send = obj => res.write(JSON.stringify(obj) + '\n');

  try {
    const result = await runAgent({ messages, today, onEvent: send });
    send({ type: 'done', ...result });
  } catch (err) {
    if (!(err instanceof AiError)) console.error('Agent failed:', err);
    send({ type: 'error', error: err instanceof AiError ? err.message : 'The stylist ran into a problem.' });
  }
  res.end();
});

export default router;
