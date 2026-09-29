/** All times are integer microseconds. See time.ts. */
export type Us = number

export type AssetKind = 'video' | 'audio' | 'image'

/** Metadata only; the binary lives in the media store, never in the project JSON. */
export interface AssetMeta {
  id: string
  kind: AssetKind
  name: string
  durationUs: Us
  width?: number
  height?: number
  hasAudio: boolean
}

export interface Transform {
  /** Offset from centre, in project pixels (1080x1920 space). */
  x: number
  y: number
  /** Multiplier on top of the automatic cover-fit. */
  scale: number
  /** Degrees. */
  rotation: number
}

/** Who created a clip. The auto-edit engine tags its output so decisions stay explainable. */
export interface ClipOrigin {
  by: 'user' | 'auto'
  rule?: string
}

export interface Clip {
  id: string
  assetId: string
  /** Position on the timeline. */
  startUs: Us
  /** Source range. Timeline length = (outUs - inUs) / speed. */
  inUs: Us
  outUs: Us
  speed: number
  volume: number
  muted: boolean
  transform: Transform
  origin: ClipOrigin
}

export type TrackKind = 'video' | 'audio'

export interface Track {
  id: string
  kind: TrackKind
  name: string
  muted: boolean
  locked: boolean
  clips: Clip[]
}

export interface ProjectSettings {
  width: number
  height: number
  fps: number
}

export interface Project {
  schemaVersion: 1
  id: string
  settings: ProjectSettings
  assets: Record<string, AssetMeta>
  /** Video tracks are drawn in array order (later = on top). */
  tracks: Track[]
}
