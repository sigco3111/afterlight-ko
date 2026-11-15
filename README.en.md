# Afterlight — Korean Edition (unofficial)

*The world ended on the day I came of age. This is what we built after.*

An unofficial Korean translation of **Afterlight**, a 2D-HD JRPG built with three.js. The original source is left
as it is: the translation is an **overlay** — a dictionary keyed by the English source string is applied on top.

- **Play (deployed)**: <https://sigco3111.github.io/afterlight-ko/>
- **Korean edition repository**: <https://github.com/sigco3111/afterlight-ko>
- **Original work**: FriendlyUser — <https://github.com/FriendlyUser/afterlight> · <https://friendlyuser.github.io/afterlight/>
- **Glossary**: [docs/glossary.md](docs/glossary.md) (Korean)

## About the game

Pixel-art characters staged in lit, depth-of-field dioramas; a coming-of-age story about a girl who brings the
world to an end at sixteen and grows up anyway. The original (as of this writing) has:

- **Story**: 14 chapters in three acts (~74k words of scenes), two endings, and a 30-floor post-game abyss. A
  75-second opening movie plays after New Game, or if the title screen is left idle.
- **Battle**: turn-order timeline, Poise & Break, the shared Afterglow gauge (Surge and link arts), telegraphed boss
  attacks you Guard or Break, party swaps mid-fight, auto-battle and Fast Mode.
- **Crests (classes)**: 28 Crests (8 callings, 10 braided, 6 legendary, 4 lost) × 10 ranks, a primary and a
  secondary Crest per character, 300+ Arts, a Legacy left behind by a mastered Crest, and five Ascension stars past mastery.
- **Exploration**: 145 hand-laid maps, a following party, a Quest Guide, minimap and world map with fast travel, the
  mount Kindle, fishing, per-town side quests, a Hunters’ Lodge board (10 marks + 2 hidden hunts), four optional
  dungeons, three arenas, and New Game+.
- **Presentation**: three.js 2D-HD rendering (bloom, tilt-shift depth of field, colour grading), procedural pixel art,
  a 30-song WebAudio soundtrack.
- **Saves**: 6 slots plus an autosave. On the Save / Load screen, press F on a slot to export it to a file or import one.

## What the Korean edition covers

The numbers below were counted from the 82 dictionary files in `i18n/parts/` (2026-11-15).

| Area | Entries | Part files |
|---|---:|---|
| Chapter 1–14 dialogue, objectives, journal, choices | 6,457 | `ch1a` … `ch14a`, `ch3_side1·2`, `ch4a_mountain1·2·3`, `ch4b_sky1·2·3`, `ch4b_verdance1·2·3`, `ch9side`, `0side-a` |
| Post-game dialogue and narration | 304 | `pg-a`, `pg-b` |
| Character and chapter names | 222 | `names`, `chars-a`, `ch89-names`, `ch1112-names`, `pg-names` |
| Maps and place names | 504 | `maps-names` |
| Skills and Crest arts | 370 | `skills-a` … `skills-h` |
| Equipment names and descriptions | 378 | `equip-names-a·b·c`, `eq-desc` |
| Enemy names and descriptions | 52 | `enemies-a·b·c` |
| Crest names and descriptions | 75 | `crests-a`, `crests-b` |
| Items, UI, battle tutorial | 245 | `items`, `ui`, `ui2`, `tutorial-battle` |
| **Total** | **8,607** | 82 files |

Side content is translated too: the arenas, the Hunters’ Lodge board, fishing, the mount and the town side quests.

## How the translation works

```
i18n/parts/*.json   (English source → Korean, a flat dictionary in 82 files)
        │  node tools/merge-ko.mjs
        ▼
src/i18n/ko.json    (merged dictionary: key = the English source string)
        │  npx vite build --base=./
        ▼
dist/               (the GitHub Pages build)
```

The dictionary is **flat**: the key is one line of English source, the value is Korean, so text is replaced without
touching the code that lays it out. Three hooks connect it to the game:

- `src/i18n/index.js` — `t()` / `fmt()` lookups and language resolution (`?lang=ko|en`, `localStorage.afterlight.lang`, Korean by default).
- `src/i18n/dom.js` — watches rendered text nodes with a `MutationObserver` and swaps dictionary values in, and adds the **EN / 한글** toggle button at the bottom right.
- `src/i18n/data.js` — replaces display strings (`name`/`desc`/`title`/`text`/`label`/`hint`/`summary`/`flavor`) of items, equipment, skills, enemies, Crests, statuses, passives and tutorials right after load. IDs are untouched, so game logic is unaffected.

Dialogue is translated in one place each for scripts and UI output (`fill()` in `src/script/ScriptContext.js`, the
dialogue renderer in `src/ui/UI.js`), so a sentence missing from the dictionary shows in **English** and the game does
not break.

### How much is translated

- Dictionary files: **82** (`i18n/parts/*.json`)
- Entries (keys) in total: **8,607**
- Distinct keys: **7,824** (the same English line in several files collapses into one)

### Switching language

- the **EN / 한글** button at the bottom right of the screen, or
- `?lang=ko` / `?lang=en` in the address, or
- `localStorage.setItem("afterlight.lang","en")` in the console, then reload.

The choice is kept in `localStorage`, separately from save files.

### Fonts

Korean uses system fonts first (Malgun Gothic, Apple SD Gothic Neo, Noto Sans KR, Nanum Gothic) via `css/ko.css`; no
extra web font is downloaded. In English the original Alegreya / Alegreya Sans SC / Cinzel are used unchanged.

## What is still in English

- **Strings the code assembles.** `t()` looks up a finished string, so sentences built from names and numbers do not
  match the dictionary and stay English. Scanning `src` (outside `i18n` and `data`) for template literals that bypass the
  dictionary gives **141 lines**, 10 of which are debug or warning only (e.g. `Unknown prop type: …`).
  Visible examples:
  - battle log — ``${user.name} hesitates.``, ``Recovered ${g} gold from ${target.name}.``, ``${coverer.name} covers ${target.name}!``
  - battle UI — `Support Points ${r.supportFrom} → ${sp}`, ` EXP ${summary.exp} Gold ${summary.gold} CP ${summary.cp} `
  - system — `Fast Mode ×${s.fastSpeed || 3}`, `Load last save — ${last.location || "saved game"}`
  - side-content goals and notices — `src/story/postgame.js` (13 lines), `src/story/colosseum.js` (11), `src/story/hunt.js` (7), `src/story/side.js` (7)
- **Lines missing from the dictionary.** Anything the original added after a pass, or that no pass has covered yet,
  appears in English.
- **Developer strings.** Console warnings and test-harness messages are out of scope.

## Controls

| Action | Keyboard | Gamepad |
|---|---|---|
| Move | arrow keys / W A S D | D-pad / left stick |
| Run (hold) | Shift | X |
| Confirm · talk · examine | Z Enter Space | A |
| Cancel · back | X Backspace Esc | B |
| Open the menu | C Tab Esc | Y / Start |
| Switch leader (field) · Surge (battle) | Q / E | LB / RB |
| Backlog (last 100 lines, in dialogue) | ↑ | D-pad up |
| Skip a scene (hold 1 second) | C Tab Esc | Y / Start |
| Auto-battle (battle) · Optimize (equipment) · Export / Import (saves) | F | Back |
| Fast Mode on / off (2–4×, rate in Settings) | T | Left-stick click |

These are the defaults; remap up to three keys per action in **Settings → Controls**. Esc always cancels and opens
the menu. Bindings are saved with the game and travel with exported saves.

New Game asks for a difficulty (Story / Normal / Hard), changeable later in Settings, along with text size and speed,
auto-advance, scene hints, encounter rate, battle speed, Fast Mode speed, the minimap, the Quest Guide, and reduced
flashes and screen shake.

## Run and build locally

```bash
node tools/merge-ko.mjs      # i18n/parts/*.json -> src/i18n/ko.json (required before any run or build)
python3 -m http.server 8765  # no build needed: http://localhost:8765/
```

Merge first even for the dev server: the `src/i18n/ko.json` committed to the repository is the output of the last build,
so without merging you see only a partially translated game.

```bash
npm install                  # dev tools only (Vite, TypeScript)
npm run dev                  # dev server on http://localhost:8766/
npx vite build --base=./     # bundle into dist/
npm run preview              # preview dist/ on http://localhost:8767/
npm run typecheck            # type-check the JavaScript
```

Built with `--base=./`, every path is relative, so `dist/` works on any static host (GitHub Pages, itch.io, Netlify…).
It is about 3 MB, under 1 MB gzipped.

### Deployment

`.github/workflows/ko-build.yml` runs on pushes that touch `i18n/parts/**`, `src/**`, `css/**`, `index.html` or
`tools/merge-ko.mjs` (or on manual dispatch): merge the dictionary → `npm install` → `vite build --base=./` → check for
root-absolute references → `.nojekyll` → deploy to Pages. **A commit that only changes this README matches none of
those paths and does not rebuild the game.**

Note that `.github/workflows/pages.yml`, inherited from the original, also fires on every push to `main` and does *not*
merge the dictionary first. After a documentation-only push the site can briefly serve a partially translated build;
run ko-build manually if that matters.

## Credits

- **Original work and all game content**: FriendlyUser — <https://github.com/FriendlyUser/afterlight> (published at <https://friendlyuser.github.io/afterlight/>)
- **Korean translation, overlay and deployment**: sigco3111
- **Engine**: three.js — MIT License, vendored as `vendor/three/three.module.js`; the full text is in `vendor/three/LICENSE`.
- **Fonts**: Alegreya, Alegreya Sans SC, Cinzel — SIL Open Font License 1.1; see `fonts/OFL-alegreya.txt`, `fonts/OFL-alegreyasanssc.txt`, `fonts/OFL-cinzel.txt`.
- **Development tools** (`package.json` devDependencies, not part of the build output): Vite 6 (MIT), TypeScript 5 (Apache-2.0), @types/three (MIT).

## License and attribution

- The original repository (<https://github.com/FriendlyUser/afterlight>) has **no license file**: there is no LICENSE at its
  root and GitHub reports no license.
- This repository does not add a license either. All rights in the original work remain with its author.
- License texts of the third-party components (three.js, the fonts) are kept where the original keeps them.
- This is an unofficial translation published without the author’s explicit permission. **If FriendlyUser asks for it to
  be taken down, this repository and the deployed page will be removed immediately.**

## Changes other than translation

- Added: `src/i18n/index.js`, `src/i18n/dom.js`, `src/i18n/data.js`, `css/ko.css`, `tools/merge-ko.mjs`, `tools/patch-i18n.mjs`, `.github/workflows/ko-build.yml`
- Modified: `src/main.js` (calls `installI18n()` and `localizeData()`), `src/ui/UI.js` and `src/script/ScriptContext.js` (strings go through `t()`), `index.html` (links `css/ko.css`)
- Generated and committed: `src/i18n/ko.json`, the merged dictionary written by `tools/merge-ko.mjs`
- Docs: `README.md`, `README.en.md`, `docs/glossary.md` (terminology)
- Game logic, data, assets and the save format are unchanged. Strings the dictionary does not know pass through in English.

## Verification (2026-11-15)

- Key counts were computed with a script over the 82 files in `i18n/parts/`: **8,607 entries, 7,824 distinct**.
- 783 of those entries are duplicate keys; in 454 of them the Korean differs. `merge-ko.mjs` keeps the value from the
  later file in name order and only warns about the overlap.
- The scan for template literals outside the dictionary in `src` found 141 lines (10 of them debug or warning only).
- The latest ko-build run succeeded (2026-11-15 05:56 KST) and the deployed game works.
- ko-build watches only `i18n/parts/**`, `src/**`, `css/**`, `index.html` and `tools/merge-ko.mjs`, so a commit that
  only edits this documentation does not rebuild.
- The workflow checks the built output for root-absolute `src="/…"` and `href="/…"` references and stops the deploy if any are found.
