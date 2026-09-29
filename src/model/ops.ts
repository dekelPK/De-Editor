import { produce } from 'immer'
import { DEFAULT_FPS, PROJECT_HEIGHT, PROJECT_WIDTH } from './constants'
import { newId } from './ids'
import { clipDurationUs, clipEndUs, findClip } from './selectors'
import { DEFAULT_IMAGE_US, MAX_IMAGE_US, MIN_CLIP_US } from './time'
import type { AssetKind, AssetMeta, Clip, Project, Track, TrackKind, Us } from './types'

/**
 * Pure edit operations: (project, args) -> project. No UI, no globals.
 * Each returns the same object when nothing changed, so callers can detect no-ops.
 */

export function createProject(): Project {
  return {
    schemaVersion: 1,
    id: newId(),
    settings: { width: PROJECT_WIDTH, height: PROJECT_HEIGHT, fps: DEFAULT_FPS },
    assets: {},
    tracks: [
      { id: newId(), kind: 'video', name: 'וידאו', muted: false, locked: false, clips: [] },
      { id: newId(), kind: 'audio', name: 'מוזיקה', muted: false, locked: false, clips: [] },
    ],
  }
}

export const trackKindFor = (k: AssetKind): TrackKind => (k === 'audio' ? 'audio' : 'video')

export function addAsset(p: Project, asset: AssetMeta): Project {
  return produce(p, (d) => {
    d.assets[asset.id] = asset
  })
}

export function addTrack(p: Project, kind: TrackKind, name: string): Project {
  return produce(p, (d) => {
    d.tracks.push({ id: newId(), kind, name, muted: false, locked: false, clips: [] })
  })
}

/**
 * Nearest start >= 0 where `dur` fits between `others` without overlap.
 * Candidates: the requested spot, time 0, and both sides of every other clip.
 */
export function resolvePlacement(others: Clip[], desired: Us, dur: Us): Us {
  const fits = (s: Us) => s >= 0 && others.every((o) => s + dur <= o.startUs || s >= clipEndUs(o))
  const candidates = [Math.max(0, desired), 0]
  for (const o of others) candidates.push(clipEndUs(o), o.startUs - dur)
  let best = -1
  let bestDist = Infinity
  for (const c of candidates) {
    if (!fits(c)) continue
    const d = Math.abs(c - desired)
    if (d < bestDist) {
      best = c
      bestDist = d
    }
  }
  return best
}

export interface AddClipArgs {
  assetId: string
  trackId?: string
  /** Defaults to the end of the track (append). */
  startUs?: Us
  clipId?: string
}

export function addClip(p: Project, args: AddClipArgs): Project {
  const asset = p.assets[args.assetId]
  if (!asset) return p
  const kind = trackKindFor(asset.kind)
  const track = args.trackId
    ? p.tracks.find((t) => t.id === args.trackId && t.kind === kind)
    : p.tracks.find((t) => t.kind === kind && !t.locked)
  if (!track) return p
  const dur = asset.kind === 'image' ? DEFAULT_IMAGE_US : asset.durationUs
  if (dur < MIN_CLIP_US) return p
  const appendAt = track.clips.reduce((m, c) => Math.max(m, clipEndUs(c)), 0)
  const startUs = resolvePlacement(track.clips, args.startUs ?? appendAt, dur)
  const clip: Clip = {
    id: args.clipId ?? newId(),
    assetId: asset.id,
    startUs,
    inUs: 0,
    outUs: dur,
    speed: 1,
    volume: 1,
    muted: false,
    transform: { x: 0, y: 0, scale: 1, rotation: 0 },
    origin: { by: 'user' },
  }
  return produce(p, (d) => {
    d.tracks.find((t) => t.id === track.id)!.clips.push(clip)
  })
}

/** Move to a new start, optionally onto another track of the same kind. Overlaps are resolved. */
export function moveClip(p: Project, clipId: string, startUs: Us, toTrackId?: string): Project {
  const found = findClip(p, clipId)
  if (!found || found.track.locked) return p
  const asset = p.assets[found.clip.assetId]
  const target =
    toTrackId && toTrackId !== found.track.id
      ? p.tracks.find(
          (t) => t.id === toTrackId && !t.locked && asset && t.kind === trackKindFor(asset.kind),
        )
      : undefined
  const dest = target ?? found.track
  const others = dest.clips.filter((c) => c.id !== clipId)
  const newStart = resolvePlacement(others, startUs, clipDurationUs(found.clip))
  if (dest.id === found.track.id && newStart === found.clip.startUs) return p
  return produce(p, (d) => {
    const from = d.tracks.find((t) => t.id === found.track.id)!
    const idx = from.clips.findIndex((c) => c.id === clipId)
    const [clip] = from.clips.splice(idx, 1)
    clip!.startUs = newStart
    d.tracks.find((t) => t.id === dest.id)!.clips.push(clip!)
  })
}

/** Drag the left edge to `newStartUs` on the timeline (source `inUs` follows). */
export function trimClipStart(p: Project, clipId: string, newStartUs: Us): Project {
  const found = findClip(p, clipId)
  if (!found || found.track.locked) return p
  const { clip, track } = found
  const end = clipEndUs(clip)
  const prevEnd = track.clips
    .filter((c) => c.id !== clipId && clipEndUs(c) <= clip.startUs)
    .reduce((m, c) => Math.max(m, clipEndUs(c)), 0)
  const minStart = Math.max(prevEnd, clip.startUs - Math.floor(clip.inUs / clip.speed))
  const start = Math.min(Math.max(newStartUs, minStart), end - MIN_CLIP_US)
  if (start === clip.startUs) return p
  const delta = start - clip.startUs
  return produce(p, (d) => {
    const c = findClip(d, clipId)!.clip
    c.inUs += Math.round(delta * c.speed)
    c.startUs = start
  })
}

/** Drag the right edge to `newEndUs` on the timeline (source `outUs` follows). */
export function trimClipEnd(p: Project, clipId: string, newEndUs: Us): Project {
  const found = findClip(p, clipId)
  if (!found || found.track.locked) return p
  const { clip, track } = found
  const asset = p.assets[clip.assetId]
  if (!asset) return p
  const end = clipEndUs(clip)
  const nextStart = track.clips
    .filter((c) => c.id !== clipId && c.startUs >= end)
    .reduce((m, c) => Math.min(m, c.startUs), Infinity)
  const sourceLimit =
    asset.kind === 'image'
      ? clip.startUs + MAX_IMAGE_US
      : clip.startUs + Math.floor((asset.durationUs - clip.inUs) / clip.speed)
  const maxEnd = Math.min(nextStart, sourceLimit)
  const newEnd = Math.max(Math.min(newEndUs, maxEnd), clip.startUs + MIN_CLIP_US)
  if (newEnd === end) return p
  return produce(p, (d) => {
    const c = findClip(d, clipId)!.clip
    c.outUs = c.inUs + Math.round((newEnd - c.startUs) * c.speed)
  })
}

/** Split at a timeline position. Both halves must be at least MIN_CLIP_US long. */
export function splitClip(p: Project, clipId: string, atUs: Us, newClipId?: string): Project {
  const found = findClip(p, clipId)
  if (!found || found.track.locked) return p
  const { clip } = found
  if (atUs < clip.startUs + MIN_CLIP_US || atUs > clipEndUs(clip) - MIN_CLIP_US) return p
  return produce(p, (d) => {
    const track = d.tracks.find((t) => t.id === found.track.id)!
    const idx = track.clips.findIndex((c) => c.id === clipId)
    const left = track.clips[idx]!
    const splitSource = left.inUs + Math.round((atUs - left.startUs) * left.speed)
    const right: Clip = {
      ...left,
      id: newClipId ?? newId(),
      startUs: atUs,
      inUs: splitSource,
      transform: { ...left.transform },
      origin: { ...left.origin },
    }
    left.outUs = splitSource
    track.clips.splice(idx + 1, 0, right)
  })
}

/** With `ripple`, later clips on the same track close the gap. */
export function deleteClip(p: Project, clipId: string, ripple = false): Project {
  const found = findClip(p, clipId)
  if (!found || found.track.locked) return p
  const { clip } = found
  const dur = clipDurationUs(clip)
  return produce(p, (d) => {
    const track = d.tracks.find((t) => t.id === found.track.id)!
    track.clips = track.clips.filter((c) => c.id !== clipId)
    if (ripple) for (const c of track.clips) if (c.startUs >= clip.startUs) c.startUs -= dur
  })
}

export type ClipPatch = Partial<Pick<Clip, 'volume' | 'muted' | 'transform' | 'speed'>>

export function updateClip(p: Project, clipId: string, patch: ClipPatch): Project {
  if (!findClip(p, clipId)) return p
  return produce(p, (d) => {
    Object.assign(findClip(d, clipId)!.clip, patch)
  })
}

export function setTrackFlags(
  p: Project,
  trackId: string,
  flags: Partial<Pick<Track, 'muted' | 'locked'>>,
): Project {
  return produce(p, (d) => {
    const t = d.tracks.find((x) => x.id === trackId)
    if (t) Object.assign(t, flags)
  })
}
