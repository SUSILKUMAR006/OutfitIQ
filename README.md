# OutfitIQ — what should I wear today?

A digital wardrobe that builds outfits from clothes you already own. Upload photos of your shirts, pants,
shoes, watches and accessories once. OutfitIQ then builds every combination, scores each one and picks
today's outfit based on the weather, the occasion and what you wore recently.

**Stack:** React 18 + Tailwind CSS 4 (Vite) · Node.js + Express · shared outfit engine (plain ES modules)

## Run it

```bash
npm install        # installs root, server, client and shared workspaces
npm run dev        # API on http://localhost:4310, web app on http://localhost:5173
```

Open http://localhost:5173 and click **Add clothes** to upload photos of your wardrobe.

Production (one process serves the API and the built app):

```bash
npm run build
npm start          # http://localhost:4310  (set API_PORT to change)
```

Requires Node 20.12+. Data is stored in `server/data/db.json` and photos in `server/uploads/`.

### AI features (Gemini, optional)

Copy `server/.env.example` to `server/.env` and set `GEMINI_API_KEY` (from https://aistudio.google.com/apikey).
`server/.env` is git-ignored — never commit the key. Restart the server after changing it.

- **Photo tagging**: every uploaded photo is sent to Gemini (`gemini-3.5-flash-lite`, override with `GEMINI_MODEL`),
  which fills in the item's type, color, style, warmth and a short name. You can still edit everything before saving.
  Without a key the app falls back to on-device color detection and file-name guessing.
- **AI stylist agent**: see below (`gemini-3.5-flash`, override with `GEMINI_AGENT_MODEL`).

## Features

| Page | What it does |
|---|---|
| **Stylist** | Chat with an AI stylist agent that acts on your real wardrobe: "I have a wedding on Saturday — plan it and save it". Shows each step it takes and the outfits it recommends as cards. |
| **Today** | Best outfit for today's forecast and occasion (Work, College, Outing, Party, Formal, Gym). Explains why it works ("White + Khaki is a timeless pairing", "Comfortable for 29°C"). Wear it, show another, or save it. |
| **Wardrobe** | Drag in many photos at once. Gemini AI tags each photo (type, color, style, warmth, name); without AI, color is detected in the browser and the type is guessed from the file name. Includes a laundry basket. |
| **Outfits** | Every top × bottom × shoes (× layer) combination ranked by score, with filters for occasion, minimum score, clean-only, today's weather or a specific item ("outfits with this shirt"). Watch and accessory are matched to each outfit. |
| **Week** | 7-day plan that follows the daily forecast, uses weekday/weekend occasions and spreads tops and bottoms so nothing repeats. You can swap any day. |
| **Saved** | Favorites, wear history, and insights: % of wardrobe worn this month, most-worn pieces, and "forgotten" pieces with a link to style them. |

Settings: city (Open-Meteo, no API key) or GPS, °C/°F, how many days to avoid repeats, and after how many wears clothes go to the laundry.

## How outfits are scored (`shared/engine.js`)

Each combination gets 0–100 from five weighted checks:

- **Color harmony (34%)**: neutrals vs accent colors, known classic pairs, analogous and complementary hues, and too many competing colors (`shared/colors.js`)
- **Style coherence (22%)**: pieces at a similar formality level (sporty → casual → smart → formal)
- **Occasion fit (20%)**: average formality versus the occasion target, plus hard rules (no shorts at work, sports shoes for gym)
- **Weather fit (14%)**: total warmth of the layers versus the day's "feels like" temperature, no layer in the heat, no sandals in rain
- **Freshness (10%)**: penalty for a top or bottom worn within the repeat window

Today's pick stays the same all day (seeded by the date). It's chosen from a diversified top list, so "Show another" really shows a different look.

## AI stylist agent (`server/src/agent/`)

The Stylist page talks to a Gemini **function-calling agent**. Each user message runs a loop (max 8 steps): Gemini
decides which tools to call, the server runs them against the real wardrobe data, and the results go back to Gemini
until it writes the answer. Progress is streamed to the UI as NDJSON so you see each step live.

| Tool | What it does |
|---|---|
| `list_wardrobe` | Items with type, color, style, warmth, laundry state, times/last worn |
| `get_weather` | Forecast for a date at the saved city (Open-Meteo) |
| `find_outfits` | Runs the outfit engine for an occasion/date/weather, with must-include / exclude items |
| `score_outfit` | Scores a combination the user proposes |
| `plan_week` | Multi-day plan following the forecast without repeats |
| `get_wear_history` | What was worn recently |
| `log_wear` · `save_favorite` · `set_laundry` · `set_occasion` | Actions that change data — only when the user asks |
| `show_outfits` | Displays the chosen outfits as cards in the chat |

The agent never invents items: every recommendation comes from tool results, and scores come from the same engine as
the rest of the app. Data-changing tools make the UI reload the wardrobe afterwards.

## Project layout

```
shared/   catalog.js (categories, occasions), colors.js (naming + harmony), engine.js (combinations, scoring, planning)
server/   Express API — src/routes/{items,outfits,account,ai,agent}.js, services.js (shared operations), ai.js (photo tagging),
          agent/{agent,tools}.js (stylist agent), JSON-file DB, Open-Meteo weather
client/   React app — src/pages/{Today,Stylist,Wardrobe,Outfits,Week,Saved}.jsx, src/components/*, Tailwind theme in index.css
```

## API

`GET /api/items` · `POST /api/items` (multipart `images[]` + `meta` JSON) · `PATCH|DELETE /api/items/:id` · `POST /api/items/wash-all`
`GET /api/today?occasion&weather&shuffle&date` · `GET /api/outfits?occasion&weather&clean&min&item&offset&limit` · `GET /api/week?swaps&date`
`POST /api/wear` · `DELETE /api/wear/:date` · `GET /api/history` · `GET|POST /api/favorites` · `DELETE /api/favorites/:id`
`GET|PUT /api/settings` · `GET /api/geocode?q` · `GET /api/weather` · `GET /api/ai/status` · `POST /api/ai/tag` (multipart `image`)
`POST /api/agent/chat` (`{ messages: [{role, text}], date }` → NDJSON stream of `tool` / `done` / `error` events)

---

## Product analysis

**Problem.** People lose time every morning matching clothes to the weather, the occasion and what's actually clean.
They also tend to wear a small share of what they own.

**Market.** Established apps include Whering, Acloset, Indyx, Stylebook and Cladwell. Reviews and comparisons
(mostly written by competing vendors, so treat them with care) keep raising the same weak points:

1. **Cataloging friction** is the biggest barrier to retention. Photographing and tagging every item by hand is tedious.
2. **AI suggestions that feel random.** Users report nonsensical pairings or the same items restyled over and over.
3. **Inaccurate auto-tagging**, and some apps don't use the weather at all.

**How OutfitIQ responds**

- *Low-effort entry:* batch upload, automatic color detection, type guessed from the file name and defaults for style and warmth. Most items need no typing at all.
- *Explainable, rule-based suggestions:* every score comes with plain reasons, so users can trust or override it. Rules are deterministic and the "diversify" step avoids repeating the same top.
- *Daily-use hooks:* live weather, laundry state, repeat avoidance, a week plan and "forgotten pieces" insights give a reason to open the app every day, not just once.

**Risks / next steps**

- Retention still depends on getting the wardrobe in. Gemini now tags photos automatically; next: background removal and adding items from shopping receipts.
- Rule-based scoring doesn't learn personal taste. Next: learn from 👍/👎, "show another" skips and worn outfits to re-weight the scores.
- Single-user local storage. Next: accounts and auth, cloud image storage (S3/R2) and a real database (Postgres/SQLite).
- Patterns and prints aren't detected (only the main color), and there's no layering beyond one jacket.
