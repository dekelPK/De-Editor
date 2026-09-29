import type { Clip, Project, Track, Us } from './types'

export const clipDurationUs = (c: Clip): Us => Math.round((c.outUs - c.inUs) / c.speed)
export const clipEndUs = (c: Clip): Us => c.startUs + clipDurationUs(c)

export function projectDurationUs(p: Project): Us {
  let end = 0
  for (const t of p.tracks) for (const c of t.clips) end = Math.max(end, clipEndUs(c))
  return end
}

export function findClip(p: Project, clipId: string): { track: Track; clip: Clip } | undefined {
  for (const track of p.tracks) {
    const clip = track.clips.find((c) => c.id === clipId)
    if (clip) return { track, clip }
  }
  return undefined
}

/** Clips visible/audible at time `t`, in draw order (bottom first). */
export function activeClipsAt(p: Project, t: Us): { track: Track; clip: Clip }[] {
  const out: { track: Track; clip: Clip }[] = []
  for (const track of p.tracks) {
    for (const clip of track.clips) {
      if (t >= clip.startUs && t < clipEndUs(clip)) out.push({ track, clip })
    }
  }
  return out
}

/** Timeline positions clips like to snap to. */
export function snapPoints(p: Project, excludeClipId: string | null, playheadUs: Us): Us[] {
  const pts = [0, playheadUs]
  for (const t of p.tracks) {
    for (const c of t.clips) {
      if (c.id === excludeClipId) continue
      pts.push(c.startUs, clipEndUs(c))
    }
  }
  return pts
}

export function snapValue(v: Us, points: Us[], thresholdUs: Us): Us {
  let best = v
  let bestDist = thresholdUs + 1
  for (const p of points) {
    const d = Math.abs(p - v)
    if (d < bestDist) {
      best = p
      bestDist = d
    }
  }
  return bestDist <= thresholdUs ? best : v
}

/** Snap either the start or the end of a range, whichever is closer to a point. */
export function snapRange(start: Us, duration: Us, points: Us[], thresholdUs: Us): Us {
  const dStart = snapValue(start, points, thresholdUs) - start
  const dEnd = snapValue(start + duration, points, thresholdUs) - (start + duration)
  if (dStart === 0 && dEnd === 0) return start
  if (dStart === 0) return start + dEnd
  if (dEnd === 0) return start + dStart
  return start + (Math.abs(dStart) <= Math.abs(dEnd) ? dStart : dEnd)
}
