# The showcase-prompt framework

A breakdown of the structure behind the Superyat prompt
([source](https://github.com/tetsuo-ai/agenc-core/blob/showcase/superyat-prompt/showcase/superyat/PROMPT.md)),
generalized so it can drive any autonomous "build a polished 3D/game showcase" run.

The prompt works like a building contract handed to a builder who will never
call you back: it describes the finished house in measurable terms, says which
rooms to build first, lists what may be cut if money runs short, and ends with
an inspection walkthrough the builder must pass before handing over the keys.

## The 12 parts of the prompt

| # | Part | What it does | Superyat example |
|---|------|--------------|------------------|
| 0 | **Mission line** | One paragraph: what, in which tech, who it's for, and what matters most. | "Three.js... shown publicly... the water, the materials and the light matter more than anything else." |
| 1 | **Autonomy contract** | Forbids questions, forbids stopping early, ties "done" to the checklist and screenshots. | "Do not ask me questions... do not stop until every item... works." |
| 2 | **Hero subject, in numbers** | Describes the main object with real units and concrete dimensions so nothing is mis-scaled. | 22.0 m LOA, 5.6 m beam, 18 deg deadrise, rail height 0.7 m. |
| 3 | **Construction method** | Says *how* the hard part must be built when the naive way looks bad. | "Lofted surface from stations, not from boxes." |
| 4 | **Interactive systems** | Every UI element must reflect real state; no fakes. | Live MFDs showing speed, RPM, heading, depth, chart. |
| 5 | **Explorable spaces** | Human-scale rooms with listed props and an explicit "must never happen" bug. | "The ocean surface must never appear inside the yacht." |
| 6 | **Environment** | World, lighting, time-of-day, with a single source of truth shared by CPU and GPU. | "Exactly the same wave function on the CPU and the GPU." |
| 7 | **Simulation / gameplay** | Physics and controls with feel targets (inertia, top speed, banking). | Buoyancy at ~12 sample points, planing, 35 kn. |
| 8 | **Cameras and controls** | Every key binding, every camera mode, intro sequence, photo mode. | Walk / helm / chase / orbit, F1 help, H hide UI, P screenshot. |
| 9 | **Realism rules** | Materials, lighting, post-FX, detail, and a hard performance budget. Also the asset rule: everything procedural. | PBR everywhere, PMREM env map, ACES, 60 fps at 1080p. |
| 10 | **Order of work + cut list** | Build the money shot first; name what to sacrifice and what is untouchable. | Ocean first; cut guest cabin, then particles, then night. |
| 11 | **Technical + verification loop** | Stack, module layout, README, a `npm run shots` script with named camera bookmarks, then a self-critique loop "as a demanding art director". | 10 named screenshots, Playwright, repeat until it looks real. |
| 12 | **Acceptance checklist + final report** | Binary checkboxes that mirror every section, then a fixed report format. | 15 checkboxes; report what/controls/files/shots/limitations. |

## Why it works

1. **Numbers beat adjectives.** "Sleek" is ambiguous; "beam 5.6 m, freeboard 1.6 m" is not.
2. **It names the failure modes in advance.** Water inside the hull, boxy hulls, z-fighting,
   floating parts. Agents tend to ship exactly the bugs nobody told them about.
3. **Priority is explicit.** The order of work and the cut list stop the agent from spending
   its budget on a guest cabin while the ocean still looks flat.
4. **"Done" is observable.** Screenshots from reproducible camera bookmarks let the agent
   look at its own output, and let you check it without running anything.
5. **No fakes clause.** "No placeholders, no fake buttons, no pre-rendered video" closes
   the most common shortcut.
6. **One source of truth.** Shared wave function, instruments that read real state: the
   visuals and the logic can't drift apart.

## How to adapt it

Use `PROMPT_TEMPLATE.md` in this folder. Rules of thumb:

- Keep the section order. Swap the content.
- Pick **one hero subject** and **one hero shot**. Everything else serves them.
- Every vague word you write ("realistic", "nice", "big") should be followed by a number,
  a material, or a reference behavior.
- Write at least one **CRITICAL: must never happen** line for the bug most likely to ruin
  the illusion in your project.
- Make the cut list honest: three items, in order, plus "never cut X".
- Every checklist item must map to something visible in a named screenshot or a scripted check.
