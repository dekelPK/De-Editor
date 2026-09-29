# Short-form video editor: architecture and milestone plan

## Context

The repo is empty (branch `claude/shortform-video-editor-plan-x8i2i0`, no commits). We're building a client-side 9:16 editor. Its differentiator is an auto-edit engine that turns raw footage plus a style preset into a normal, editable project.

Decisions from the Q&A:

- **Browsers:** Chromium-first. Export uses WebCodecs, with ffmpeg.wasm only as a lazy fallback.
- **Input size:** phone clips, up to 1080p and up to 10 minutes total.
- **Fillers:** the MVP removes silence only. Filler words ("um", "uh") wait for Whisper, which also powers subtitles later.
- **Assets:** a small bundled CC0 SFX pack. The user brings the music.

## Stack (changes from the proposal in bold)

- React 18 + TypeScript (strict) + Vite, Zustand + **Immer patches** for undo/redo, Tailwind.
- **Mediabunny** for demux, decode, encode and mux of MP4/MOV/WebM. It replaces mp4box.js and mp4-muxer and works inside workers.
  - ffmpeg.wasm (single-thread core, loaded lazily) is only for transcoding inputs that WebCodecs can't decode.
- **WebGL2 compositor, one module shared by preview and export.** The same code draws the preview canvas and the export OffscreenCanvas, so the export matches the preview.
- Web Audio: live AudioContext for preview, **OfflineAudioContext** for the export mix.
- **Comlink** for typed worker calls. **Zod** validates project and preset JSON.
- Vitest for unit tests (model, engine, DSP). Playwright for one e2e smoke test (the pre-installed Chromium).
- Font: Heebo (Latin and Hebrew), so RTL subtitles later need no font swap.

## Architecture

```
src/
  model/      types.ts, schema.ts (zod), time.ts, ops/*.ts (pure edits), selectors.ts (clipsAt(t), duration…)
  state/      projectStore (project + immer patch history), uiStore (selection, zoom), playbackStore, assetStore (File/blob handles, NOT in project JSON)
  media/      import.ts (probe via Mediabunny), thumbnails, frameSources/{videoElementSource, webcodecsSource}
  render/     compositor.ts (WebGL2), shaders/, textRaster.ts (OffscreenCanvas 2D → texture), grade.ts
  audio/      previewEngine.ts (scheduled AudioBufferSourceNodes, master clock), offlineMix.ts
  export/     export.worker.ts (compositor on OffscreenCanvas + VideoEncoder + Mediabunny muxer)
  analysis/   dsp/ (pure: rms, silence, onset, tempo/beat, motion), analysis.worker.ts
  engine/     autoEdit.ts + stages/*.ts (pure), presets/*.json, rng.ts (seeded)
  ui/         Library, Timeline, Preview, Inspector, Toolbar, ExportDialog, AutoEditDialog
public/sfx/   CC0 whoosh/pop/riser/hit (with LICENSE list)
```

### Project model (key points; full spec goes in the README)

- **Time is stored as integer microseconds.** WebCodecs uses the same unit, and integers avoid float drift. The UI snaps to the project fps.
- `Project { schemaVersion, id, settings{width:1080,height:1920,fps:30,background}, assets: Record<id, AssetMeta>, tracks: Track[] }`
- `AssetMeta { id, kind: video|audio|image, name, durationUs, width?, height?, hasAudio, fps?, analysisRef? }`. It holds no binary data; `assetStore` maps the id to the File.
- `Track { id, kind: video|audio|text, name, muted, locked, clips: Clip[], transitions: Transition[] }`. Order in the array is z-order.
- `Clip { id, assetId?, startUs, inUs, outUs, speed, volume, muted, transform{x,y,scale,rotation,crop}, text?, effects: Effect[], origin: {by:'auto'|'user', rule?} }`
  - Visual properties are typed `Animatable<number> = number | Keyframe[]`. The MVP only writes plain numbers, so keyframes can be added later without a migration. Punch-in _ramps_ can use them.
- `Transition { id, fromClipId, toClipId, type: crossfade|whip|zoom|flash|slide, durationUs }`. It sits centered on the cut and uses handle media from both clips; if a clip has no handle, the frame is held.
- `Effect { type: 'grade'|'lut'…, params }`. The MVP ships `grade` (exposure, contrast, saturation, temperature, vignette).
- All edits are pure `op(project, args) → project`. The store wraps them in `produceWithPatches`, and undo/redo replays the inverse or forward patches. The UI never mutates the model directly.

### Auto-edit engine

`autoEdit({ project, analyses, preset, options, seed }) → Project`. It is pure and deterministic. Each stage is a separate function with its own tests:

1. **segment**: speech/activity segments come from the silence map. Each cut gets padding (`preset.silence.padMs`).
2. **score**: loudness, onset density and motion per segment. The weights come from the preset.
3. **hook**: copy the top-scoring 1.5–3 s window to the start as a teaser. The story keeps its original order (a talking head must stay coherent), and the preset can switch this off or move the segment instead.
4. **pace**: split segments longer than `maxShotS` at the lowest-energy point, and merge any shorter than `minShotS`.
5. **beatSnap**: move each cut to the nearest beat within `snapToleranceMs`, but only inside silence gaps so no word is cut.
6. **reframe**: center-crop transform for landscape sources. The interface takes a `subjectTrack?` so tracking can plug in later.
7. **zoom**: punch-in pattern from the preset, for example `[1.0, 1.15, 1.0, 1.25]`, with a jitter limit.
8. **transitions + sfx**: presets define probabilities per cut type. The SFX clips go on a dedicated audio track.
9. **loop**: choose the end point whose frame best matches the first frame (from the motion thumbnails), then add a short audio fade.
10. **music**: put the music on its own track, apply ducking under speech (volume keyframes later, a constant level in the MVP), and grade every clip.

Every generated clip carries an `origin.rule` tag, so the UI can show which rule made each decision and you can override any of them.

### Preset format (JSON, zod-validated, documented in the README)

`{ id, name, pacing{minShotS,maxShotS,targetShotS}, silence{thresholdDb|auto, minSilenceMs, padMs}, hook{enabled, mode:'teaser'|'move', lenS}, beats{snap, snapToleranceMs}, zoom{pattern[], maxScale}, transitions{default, pool[{type,weight,durationMs}] }, sfx{onCut:[{file,prob}]}, music{targetLufs, duckDb}, grade{…}, loop{enabled} }`

The four presets: Fast Hype, Talking Head, Food/Lifestyle, Fashion/GRWM.

### Analysis (Web Workers only)

- Mediabunny decodes audio in the worker and downmixes it to mono 22.05 kHz. That is about 5 MB per 1 min, versus about 23 MB per minute for 48 kHz stereo.
- **RMS / loudness** uses 20 ms frames.
- **Silence** uses an adaptive threshold (noise floor from the 10th percentile plus an offset) with hysteresis and a minimum duration.
- **Beats** come from spectral-flux onsets, a tempo estimate by autocorrelation, and dynamic-programming beat tracking (Ellis). It's our own code; essentia.js is AGPL.
- **Motion and scene changes** use frames decoded at 5 fps and downscaled to 64×36, scored by frame difference. The same thumbnails feed the loop matcher.
- Results are cached per asset in memory for now; IndexedDB comes later. Progress events stream back to the UI.

### Playback

- The master clock is `AudioContext.currentTime`.
- Preview video uses a pool of `HTMLVideoElement`s with `requestVideoFrameCallback` and drift correction (seek when off by more than 1 frame). Frames upload as textures to the compositor.
- Export instead uses the frame-accurate `webcodecsSource`. Both implement one `FrameSource` interface.

## Milestones (each one is tested and committed)

| #   | Milestone                                                                                                                                                         | How to verify                                                                                      |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| M0  | Scaffold: Vite/React/TS/Tailwind/Zustand, ESLint+Prettier, Vitest, folder skeleton, README stub                                                                   | `npm run dev` shows the empty 3-pane layout; `npm test` and `npm run lint` pass                    |
| M1  | Model + zod schema + pure ops (add, move, trim, split, delete, snap helpers) + undo/redo store                                                                    | `npm test`: op unit tests and undo/redo round-trips. No UI yet.                                    |
| M2  | Import: drag & drop, probe, media library with thumbnails, ffmpeg.wasm fallback stub                                                                              | Drop an MP4, MOV, MP3 and PNG: the cards show duration and dimensions                              |
| M3  | Timeline UI: tracks, drag, trim, split, delete, snapping, playhead, zoom, shortcuts (Space/S/Del/Ctrl+Z/Ctrl+Shift+Z)                                             | Manual checklist in the README; Playwright smoke test for split and undo                           |
| M4  | Preview: WebGL2 compositor at 1080×1920, scaled to fit; playback clock; audio engine; scrubbing; safe-zone overlay (TikTok/Reels/Shorts toggle)                   | Play two clips back to back: no gap and A/V in sync. The safe-zone toggle works.                   |
| M5  | Text overlays (Heebo, stroke/shadow), per-clip volume and mute, music track, Inspector panel                                                                      | Add a caption, move and scale it, check that muted clips are silent                                |
| M6  | Export: worker with OffscreenCanvas compositor, VideoEncoder H.264, OfflineAudioContext mix → AAC, Mediabunny MP4. Resolution 720p or 1080p, progress bar, cancel | Export a 30 s project and open it in VLC/QuickTime: correct length, A/V sync, matches the preview  |
| M7  | Analysis worker: silence, loudness, beats, motion, drawn as timeline overlays                                                                                     | Unit tests on synthetic signals (tone+silence, 120 BPM click track). Visual check on real footage. |
| M8  | Engine v1: segment, pace, reframe and zoom stages; "Make it viral" dialog with preset picker                                                                      | Unit tests per stage plus golden-file tests; a real clip gives an editable, tight cut              |
| M9  | Engine v2: hook, beat snap, transitions (shaders), SFX pack, loop ending, music ducking                                                                           | Golden tests; manual review against each preset                                                    |
| M10 | Four polished presets, color grade shader, README data-model and preset docs                                                                                      | Run each preset on the same footage; the results differ visibly                                    |

## Performance risks (flagged early)

- **Memory:** we never hold full-resolution decoded frames. VideoFrames must be `close()`d immediately (the most common WebCodecs leak), and analysis works on downmixed, downscaled data only. Preview audio buffers take about 23 MB per minute of source.
- **Export speed:** encoding is expected to run at 2–5× realtime for 1080p30. Rendering text as textures once, instead of every frame, matters here.
- **HEVC/iPhone HDR footage** may fail to decode, or show washed-out colors, on some Chromium builds. We detect this with `VideoDecoder.isConfigSupported` and fall back to an ffmpeg.wasm transcode. That fallback is slow (about 0.3–1× realtime) and capped at about 2 GB of wasm memory, so the UI warns first.
- **Sync of multiple video elements** during preview can jitter on cheap laptops. If it does, the preview switches to the WebCodecs source as well.
- **Main thread:** the timeline renders in the DOM. Clips and waveform peaks are drawn to a canvas once a track has more than about 200 clips (the auto-edit output can be dense).
- **Cross-origin isolation** (COOP/COEP) is not needed with the single-thread ffmpeg core. If we add it later, it can break cross-origin assets.

## Later (the model already supports these)

- Keyframes use `Animatable`.
- Effects allow a `lut` type.
- Subtitles fit as text clips generated from a transcript.
- Project save/load: the project is plain JSON, and asset files move to OPFS.
- RTL: the font is already in place, and the UI can use logical CSS properties from the start.
- Subject tracking fits the `reframe` interface.
- AI highlights would add a new `score` input.

## Workflow

After each milestone: run `npm test && npm run lint && npm run build`, do the manual check from the table, commit with a clear message, then push to `claude/shortform-video-editor-plan-x8i2i0`.
