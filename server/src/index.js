import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { load, UPLOAD_DIR } from './db.js';
import itemsRouter from './routes/items.js';
import outfitsRouter from './routes/outfits.js';
import accountRouter from './routes/account.js';
import aiRouter from './routes/ai.js';
import agentRouter from './routes/agent.js';
import { aiEnabled, aiModel } from './ai.js';
import { agentModel } from './agent/agent.js';

const SERVER_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
// Secrets such as GEMINI_API_KEY live in server/.env (git-ignored). Real environment variables win.
if (fs.existsSync(path.join(SERVER_DIR, '.env'))) process.loadEnvFile(path.join(SERVER_DIR, '.env'));

// 4310 avoids clashing with other local dev servers on 3000/4000/5000. Keep in sync with client/vite.config.js.
const PORT = process.env.PORT || process.env.API_PORT || 4310;
const CLIENT_DIST = path.resolve(SERVER_DIR, '../client/dist');

await load();

const app = express();
app.use(express.json({ limit: '1mb' }));

app.use('/uploads', express.static(UPLOAD_DIR, { maxAge: '7d', immutable: true }));
app.use('/api/items', itemsRouter);
app.use('/api/ai', aiRouter);
app.use('/api/agent', agentRouter);
app.use('/api', outfitsRouter);
app.use('/api', accountRouter);
app.use('/api', (req, res) => res.status(404).json({ error: 'Not found' }));

// In production, serve the built React app from the same origin.
if (fs.existsSync(CLIENT_DIST)) {
  app.use(express.static(CLIENT_DIST));
  app.get('*', (req, res) => res.sendFile(path.join(CLIENT_DIST, 'index.html')));
}

app.use((err, req, res, next) => {
  console.error(err);
  const status = err.code === 'LIMIT_FILE_SIZE' ? 413 : err.status || 500;
  res.status(status).json({ error: status === 413 ? 'Photo is too large (max 10 MB).' : 'Something went wrong.' });
});

app.listen(PORT, () => {
  console.log(`OutfitIQ API running on http://localhost:${PORT}`);
  console.log(aiEnabled() ? `AI: photo tagging (${aiModel()}) + stylist agent (${agentModel()})` : 'AI: off (add GEMINI_API_KEY to server/.env)');
})
  .on('error', err => {
    if (err.code !== 'EADDRINUSE') throw err;
    console.error(`Port ${PORT} is already in use by another program. Start OutfitIQ on a different port, e.g.\n` +
      `  PowerShell:  $env:API_PORT=4320; npm run dev\n  bash:        API_PORT=4320 npm run dev`);
    process.exit(1);
  });
