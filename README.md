# De-Editor

Browser-based short-form video editor (Reels / TikTok / Shorts). It outputs vertical 1080×1920 video and has an auto-edit engine that turns raw footage plus a style preset into an editable first cut. Everything runs client-side.

The full architecture and milestone plan is in [`docs/PLAN.md`](docs/PLAN.md).

## Requirements

- Node 20 or newer
- A Chromium-based browser (Chrome or Edge). Export uses WebCodecs.

## Scripts

| Command             | What it does                                 |
| ------------------- | -------------------------------------------- |
| `npm run dev`       | Start the dev server (http://localhost:5173) |
| `npm test`          | Run unit tests (Vitest)                      |
| `npm run lint`      | Run ESLint                                   |
| `npm run typecheck` | Run the TypeScript check                     |
| `npm run build`     | Produce a production build in `dist/`        |

## Source layout

| Folder         | Purpose                                                              |
| -------------- | -------------------------------------------------------------------- |
| `src/model`    | Project data model, schema, pure edit operations (no UI)             |
| `src/state`    | Zustand stores (project + undo history, UI, playback, asset handles) |
| `src/media`    | Import, probing, frame sources                                       |
| `src/render`   | WebGL2 compositor, shared by preview and export                      |
| `src/audio`    | Preview audio engine, offline export mix                             |
| `src/export`   | Export worker (WebCodecs + MP4 muxing)                               |
| `src/analysis` | DSP (silence, beats, motion) running in Web Workers                  |
| `src/engine`   | Auto-edit engine (pure functions) and preset JSON                    |
| `src/ui`       | React components                                                     |

Folders appear as their milestone lands.

## Data model

_Documented in M1._

## Preset format

_Documented in M8–M10._

## Status

- [x] M0: Scaffold
- [ ] M1: Project model, pure edit operations, undo/redo
- [ ] M2: Media import and library
- [ ] M3: Timeline UI
- [ ] M4: Preview compositor and playback
- [ ] M5: Text, volume, music
- [ ] M6: Export
- [ ] M7: Analysis workers
- [ ] M8: Auto-edit engine v1
- [ ] M9: Auto-edit engine v2
- [ ] M10: Presets, color grade, docs
