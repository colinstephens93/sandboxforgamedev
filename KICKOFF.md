# Kickoff prompt

Paste everything below the line into the AI coding tool, opened on this repository.

---

You are building the Duramax Dyno Shop: a photorealistic browser game of a stock 2005 Chevrolet Silverado 2500HD Duramax LLY on a chassis dyno in a diesel shop, with AI Live tuning. The full specification is already in this repository. Your job is to build it to that specification, in small, tested increments.

## 1. Read before you write any code

Read these completely, in this order:
1. `PROMPT.md`: the specification and the source of truth for what to build. Its acceptance checklist is the definition of done. Follow its accuracy rules above everything else.
2. `reference/INDEX.md`, then open every image in `reference/`. The index says what each photo may and may not be used for.
3. `reference/manuals/` (the Duramax diesel supplement and the engine bay diagram) and the owner's manual link in `reference/INDEX.md`.
4. `reference/tuning/README.md`.

Do not ask me questions. Where the specification is silent, follow its "do not invent" rule: choose the plainest correct option and log it in `ACCURACY.md`.

## 2. Plan in small increments

Before coding, write `PLAN.md`:
- Break the specification's order of work (section 9 of `PROMPT.md`) into milestones, and each milestone into increments small enough to build and verify in one sitting (one feature, one system, or one part of the truck).
- For every increment, write its validation criteria up front: which tests must pass, what the browser check must show, and which screenshot must be taken and compared with which reference photo.
- Mark which increments are independent and can run in parallel.

Keep `PROGRESS.md` as a running log: each increment's result, the checks run, the screenshots taken, and any problem left open.

## 3. The loop for every increment

1. **Build** only that increment.
2. **Test:** write or update unit tests for any logic (engine, dyno, drivetrain, tuning, failures, start sequence) and run the whole test suite. All tests must pass, including the earlier ones.
3. **Build check:** `npm run build` must succeed with no errors.
4. **Run it:** load the app in headless Chromium with Playwright, with WebGL enabled (for example the flags `--use-angle=swiftshader --enable-unsafe-swiftshader`). Confirm there are no console errors and that the increment works by driving it: press the keys, open the door, run the pull, write the tune.
5. **Look at it:** for anything visible, take a screenshot, open it, and compare it with the matching reference photos. Judge it twice: once as a demanding art director, and once as a GM technician who owns a 2005 Duramax. Fix what is wrong before moving on.
6. **Record:** update `ACCURACY.md` and `src/data/truckSpec.js` (every real-world number with its source and a `confirmed` or `estimated` tag), and add the increment to `PROGRESS.md`.
7. **Commit** with a clear message, only when steps 2 to 5 are green, then push.

Never start the next increment on a red build or failing tests. If a problem resists three honest attempts, log it in `PROGRESS.md` with what you tried, apply the specification's cut order if it applies, and move on. Never fake a result, hard-code a dyno number, or disable a test to get green.

At the end of each milestone, run the full check list from section 11 of `PROMPT.md` for everything built so far. Run `npm run shots` once it exists. Then write a short milestone summary in `PROGRESS.md` with the screenshots.

## 4. Use sub-agents where they help

Use sub-agents for well-bounded work, and keep integration and final judgment yourself:
- **Research agent:** verifies a real-world fact (a dimension, the turbo's exact model and vane range, typical stock LLY dyno numbers, the Allison's torque limits) from primary or reputable sources. It returns the value, the source and a confidence level for `truckSpec.js`.
- **Builder agents:** build independent modules in parallel once the core is in place: for example audio, shop equipment, the AI Live interface, or the cab interior. Give each one a precise brief: the files it owns, the interfaces it must use, and the increment's validation criteria. No two agents edit the same file at the same time. Use separate git worktrees or branches where your tool supports it, and merge one at a time.
- **Test agent:** writes unit tests for the engine, dyno and tuning math from the specification, independently of the code that implements it.
- **Review agent:** a fresh agent that has not seen the code reviews screenshots against `reference/` and the specification, and returns a list of inaccuracies and visual problems. Use it at least at the end of every milestone.

Do not accept a sub-agent's "done" at face value: rerun the tests, the build and the browser check yourself before merging its work.

## 5. Rules that always apply

- Do not download textures, HDRIs or 3D models. Generate everything in code. npm packages are allowed.
- Do not change anything in `reference/`. Never commit `.ctz` files or any file containing serial numbers, licenses or keys.
- `src/data/truckSpec.js` is the single source of real-world numbers. No magic numbers elsewhere.
- Keep the app runnable after every commit.
- Replace the root README with the project README the specification asks for.

## 6. When you are done

You are done when every item in the acceptance checklist of `PROMPT.md` is true and verified, all 12 screenshots are saved and reviewed, and the tests pass. Then give the final report the specification asks for, plus a link to `PROGRESS.md` and the full list of `ACCURACY.md` entries.
