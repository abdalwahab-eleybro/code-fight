# Code Fighter — Learning Lab

A gamified DSA (data-structures & algorithms) practice app: campaign fights,
interactive lessons, a step-through visualizer, spaced repetition, shop,
achievements, streaks, procedural chiptune audio, and an optional Gemini AI
tutor. **100% client-side, zero build step, zero dependencies.**

This project was restructured from a single 9,800-line HTML file into small,
single-responsibility modules. All features and functionality are unchanged.

## Run it

No install, no build. Serve the folder with any static server:

```bash
python3 -m http.server 8000     # then open http://localhost:8000
```

(Opening `index.html` directly via `file://` also works; the optional
`data/*.json` content files simply fall back to built-in defaults.)

## Project layout

```
index.html              Thin shell: <head>, screen markup, script tags ONLY
css/
  core.css              Campaign UI: screens, HUD, map, shop, buttons…
  learning-lab.css      Learning-lab add-ons: visualizer (vz-*) + lessons (lsn-*)
data/                   ✏️  EDITABLE CONTENT (plain JSON, no code)
  fighters.json         Fighter roster + unlock levels
  campaign.json         Patterns, tiers/rewards, volume names
js/                     Modules load in numeric order (dependency order)
  00-content.js         Loads/caches data/*.json (with safe fallbacks)
  01-state.js           CF.State  — profile, session, XP, streak, campaign table
  02-campaign.js        CF.CampaignLogic — stars, progression rules, tooltips
  03-questions.js       CF.Questions — Vol-1 question bank (85 questions)
  04-renderers.js       CF.Renderers — 11 question-type renderers
  05-achievements.js    CF.Achievements — badge definitions + checker
  06-modes.js           CF.Modes — enemy archetypes, boss mechanics, mode configs
  07-spaced.js          CF.Spaced — spaced repetition + weak-spot analyzer
  08-shop.js            CF.Shop — items, purchases, shop UI
  09-music.js           CF.Music — procedural chiptune engine (Web Audio)
  10-screens.js         CF.Screens — recap screen + achievement popups
  11-engine.js          CF.Engine — fight loop, combat visuals, sounds
  12-settings.js        CF.Settings — settings, profile export/import
  13-visualizer.js      CF.Narrator / CF.Sonify / CF.Visualizer
  14-aitutor.js         CF.AITutor — Gemini hints/explain-back grading
  15-lessons.js         CF.Lessons — interactive lesson flow
  16-shell.js           Screen router, map render, menu wiring, boot
```

Every module attaches itself to the global `CF` namespace as an IIFE
(`CF.X = (() => { ... })()`) and documents its dependencies in its header
comment. Load order in `index.html` is the dependency order.

## How to change common things

| I want to…                                | Do this |
|-------------------------------------------|---------|
| Rename the game / change tagline          | `index.html` → `screen-menu` markup |
| Add/recolor a fighter                     | `data/fighters.json` (keep `js/01-state.js` fallback in sync if you use `file://`) |
| Add a pattern, tier, reward or volume     | `data/campaign.json` — the level list rebuilds automatically |
| Add/edit questions                        | `js/03-questions.js` — one entry per question object |
| Change how a question type looks/works    | `js/04-renderers.js` — one renderer per type |
| Tune combat math, HP, damage, timers      | `js/11-engine.js` (+ `js/06-modes.js` for enemy behaviour) |
| Add an achievement                        | `js/05-achievements.js` — append to the definitions array |
| Add a shop item                           | `js/08-shop.js` — append to `ITEMS` |
| Adjust star thresholds / progression      | `js/02-campaign.js` |
| Tweak the spaced-repetition schedule      | `js/07-spaced.js` |
| Change colors/theme                       | CSS custom properties at the top of `css/core.css` (`:root`) |
| Restyle the visualizer / lessons          | `css/learning-lab.css` |
| Change music/SFX                          | `js/09-music.js` |
| Add a new screen                          | markup block in `index.html` + route it in `js/16-shell.js` |

## Adding a new question type (example recipe)

1. Give questions of that type a new `"type"` value in `js/03-questions.js`.
2. Register a renderer for it in `js/04-renderers.js` (`CF.Renderers`).
3. Style it in `css/core.css` (or `css/learning-lab.css` if lab-specific).
Nothing else needs to change — the fight engine renders whatever the
registry returns.

## Data & persistence notes

- Profile lives in `localStorage` under `codefighter_profile_v1`; schema
  migrations go in `migrate()` inside `js/01-state.js`.
- The AI tutor key is stored only in browser `localStorage`
  (`js/14-aitutor.js`); the app works fully without it.

## Verifying after edits

There is no test suite; the fastest sanity checks are:

```bash
for f in js/*.js; do node --check "$f" || echo "FAIL $f"; done   # syntax
python3 -m http.server && # click through: menu → map → fight → shop → learn
```
