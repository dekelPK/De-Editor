import { US_PER_SECOND } from './constants'

export const secToUs = (s: number) => Math.round(s * US_PER_SECOND)
export const usToSec = (us: number) => us / US_PER_SECOND

/** Shortest clip the editing operations will leave behind. */
export const MIN_CLIP_US = 100_000
/** Timeline length of a freshly added still image. */
export const DEFAULT_IMAGE_US = 3_000_000
/** Upper bound for stretching a still image. */
export const MAX_IMAGE_US = 600_000_000

/** `m:ss.d` (tenths). */
export function formatTime(us: number): string {
  const total = Math.max(0, Math.round(us / 100_000)) // tenths
  const tenths = total % 10
  const secs = Math.floor(total / 10) % 60
  const mins = Math.floor(total / 600)
  return `${mins}:${String(secs).padStart(2, '0')}.${tenths}`
}
