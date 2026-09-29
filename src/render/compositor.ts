import { PROJECT_WIDTH, activeClipsAt } from '../model'
import type { Clip, Project, Us } from '../model'

export type FrameSource = { el: CanvasImageSource; width: number; height: number }

/**
 * Draws one frame of the project. Shared by preview and (later) export so both look the same.
 * `getSource` returns the decoded video element / image for a clip, or null if not ready yet.
 * The canvas may be any size with a 9:16 ratio; coordinates scale from the 1080-wide project space.
 */
export function renderFrame(
  ctx: CanvasRenderingContext2D,
  project: Project,
  tUs: Us,
  getSource: (clip: Clip) => FrameSource | null,
) {
  const W = ctx.canvas.width
  const H = ctx.canvas.height
  const k = W / PROJECT_WIDTH
  ctx.fillStyle = '#000'
  ctx.fillRect(0, 0, W, H)

  for (const { track, clip } of activeClipsAt(project, tUs)) {
    if (track.kind !== 'video') continue
    const src = getSource(clip)
    if (!src || !src.width || !src.height) continue
    // Automatic reframe: cover-fit (centre crop), then the clip's own transform on top.
    const cover = Math.max(W / src.width, H / src.height)
    const t = clip.transform
    ctx.save()
    ctx.translate(W / 2 + t.x * k, H / 2 + t.y * k)
    ctx.rotate((t.rotation * Math.PI) / 180)
    const s = cover * t.scale
    ctx.scale(s, s)
    ctx.drawImage(src.el, -src.width / 2, -src.height / 2, src.width, src.height)
    ctx.restore()
  }
}
