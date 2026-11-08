# <PROJECT NAME> showcase prompt

Fill in every `<...>`. Delete hints in `( )` when done. Keep the section order;
it mirrors the Superyat framework (see FRAMEWORK.md).

---

Build a <hyper-realistic / stylized> , fully interactive <HERO SUBJECT> in <SETTING>,
as one runnable browser app using <Three.js and WebGL / Babylon.js / ...>. A player must be able to
<core verbs: walk, drive, fly, fight, build...>. This will be shown <publicly / to investors / as a portfolio piece>,
so <the 2-3 things that matter most visually> matter more than anything else.

Work autonomously from start to finish. Do not ask me questions. Make sensible decisions, keep going,
and do not stop until every item in the acceptance checklist at the end works and you have checked it with screenshots.

## 1. THE <HERO SUBJECT> (exterior / overall form)

<One-line style statement, e.g. "A 1970s Soviet lunar rover, utilitarian and dusty.">

Main dimensions (use real units, 1 unit = 1 m):
- <overall size, key proportions>
- <human-scale numbers: door height, step height, eye height, rail height...>

Form and construction:
- <how the main shape must be built, e.g. "lofted from cross-sections, not boxes">
- <surface finishes, colors, markings>

Details:
- <list of parts that sell the realism up close>

## 2. <PRIMARY INTERACTIVE STATION> (cockpit / workbench / control room / inventory)

- <physical controls>
- <live displays: which values, all read from real game state>
- <switches and what they toggle>
- Every instrument reflects the real state at all times.

## 3. <EXPLORABLE SPACES> (walkable, human scale, eye height 1.65 m)

- **<Room/area 1>:** <props, lighting, what you see outside>
- **<Room/area 2>:** <...>
- **Doors / interactables:** <what opens, which key>

CRITICAL: <the one bug that would destroy the illusion, and how to prevent it>.

## 4. <ENVIRONMENT> (world, weather, sky)

- **Setting:** <what surrounds the hero, what is deliberately absent>
- **<Main environmental system>:** <technique + shading features as a bullet list>
- **One source of truth:** <the shared function used by both physics and rendering>
- **Interaction with the hero:** <trails, dust, splashes, decals, deformation...>
- **Sky / lighting:** <default time of day>; <key> cycles <list of presets>.

## 5. <SIMULATION AND GAMEPLAY>

- **<Core physics>:** <method, sample points, forces>
- **<Control mode>:** <keys>, <feel targets: top speed, inertia, tilt, recovery>
- **Sound:** procedural with the Web Audio API: <what scales with what>. Audio starts on first click.
- **<Exiting / switching modes>:** <what happens to the world and the player>

## 6. CAMERAS AND CONTROLS

- **<Default mode>:** <first/third person, pointer lock, WASD, Shift to run, collision rules>
- **<Secondary views>:** <key> toggles <views>
- **Orbit / photo mode (O):** H hides UI, P saves a PNG.
- **Cinematic intro on load, <N> seconds:** <shot list>, any key skips it.
- **Help and settings:** F1 help panel with all controls and a quality setting (low/medium/high). Esc releases the mouse. Loading screen with progress.

## 7. REALISM / ART DIRECTION (this is the main goal)

- **Materials:** <list each material type and its required properties>
- **Assets:** generate every texture and model procedurally. Do not download textures, HDRIs or models. Only npm packages are allowed (<list>).
- **Lighting:** <env map approach, shadows, practical lights>
- **Post-processing:** <tone mapping, bloom, AO, AA> - tasteful, never overdone.
- **Detail:** <what must hold up close>; no floating parts, no gaps, no z-fighting, no stretched textures.
- **Performance:** stable <60> fps at <1080p> on <target hardware>; <instancing, LOD, shadow budget, pixel-ratio cap, culling>.

## 8. ORDER OF WORK (build the showcase shot first)

1. Project setup, then <environment + lighting + post>. Get a beautiful <hero lighting> before anything else.
2. <Hero subject exterior>. Check the hero shot.
3. <Physics + primary interaction>.
4. <Explorable spaces + the CRITICAL fix>.
5. <Player controller, cameras, intro, UI, audio>.
6. <Time of day / variants, quality settings, performance>.
7. Verification and polish (section 10).

If something has to be simplified, cut in this order: <least important>, <next>, <next>.
Never cut <the 2-3 pillars>.

## 9. TECHNICAL

- **Stack:** <Vite + Three.js / ...>, with clear modules: <list module groups>
- **Code:** clean, no placeholders, no fake buttons, no pre-rendered video. Every listed control must work.
- **README:** one-command setup (`npm install`, then `npm run dev`), all controls, the architecture.
- **Screenshot script:** `npm run shots` opens the app in Playwright, sets each named camera bookmark, and saves the screenshots below. Bookmarks live in code as named presets.

## 10. VERIFY, LOOK, IMPROVE (do not skip)

Run the app in a headless browser (Playwright, WebGL-capable flag):

- **Checks:** no meaningful console errors; intro plays and skips; <every room/area reachable>; <core interaction responds>; <all presets work>; frame time reasonable.
- **Screenshots** in `screenshots/`:
  1. <hero shot>
  2. <in-motion shot>
  3. <detail shot>
  4. <interactive station with live UI>
  5. <space 1>
  6. <space 2>
  7. <...>
  8. <alternate lighting / night shot>

Open each screenshot and judge it honestly, as a demanding art director. Look for anything fake, flat, blocky,
too dark, too bright, plastic, mis-scaled or unfinished. Fix it, re-shoot, repeat until <the pillars> look convincing.

## ACCEPTANCE CHECKLIST (all must be true before you finish)

- [ ] <one line per section above, each verifiable in a screenshot or scripted check>
- [ ] No console errors
- [ ] README and the `npm run shots` script
- [ ] All <N> screenshots saved and reviewed

When you finish, report: what you built, the controls, the file structure, the screenshot files, and any remaining limitation.
