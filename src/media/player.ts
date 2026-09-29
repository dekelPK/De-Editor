import { activeClipsAt, projectDurationUs, US_PER_SECOND } from '../model'
import type { Clip, Project } from '../model'
import { renderFrame } from '../render/compositor'
import type { FrameSource } from '../render/compositor'
import { useEditorStore } from '../state/editorStore'
import { useMediaStore } from '../state/mediaStore'
import { useProjectStore } from '../state/projectStore'

const MAX_MEDIA_ELEMENTS = 6
const PRELOAD_AHEAD_US = 1_500_000

/**
 * Preview engine: advances the playhead, keeps one <video>/<audio> element per clip in sync,
 * and draws each frame with the shared compositor.
 * Master clock is wall time for now; an audio-driven clock comes with the audio engine.
 */
class Player {
  private ctx: CanvasRenderingContext2D | null = null
  private media = new Map<string, { el: HTMLMediaElement; used: number }>()
  private images = new Map<string, HTMLImageElement>()
  private raf = 0
  private lastNow = 0
  private dirty = true
  private started = false

  attach(canvas: HTMLCanvasElement) {
    this.ctx = canvas.getContext('2d')
    this.dirty = true
    if (!this.started) this.start()
  }

  detach() {
    cancelAnimationFrame(this.raf)
    this.started = false
    this.ctx = null
  }

  requestRender() {
    this.dirty = true
  }

  private start() {
    this.started = true
    this.lastNow = performance.now()
    useProjectStore.subscribe(() => (this.dirty = true))
    useEditorStore.subscribe((s, prev) => {
      if (s.playheadUs !== prev.playheadUs || s.playing !== prev.playing) this.dirty = true
    })
    const loop = (now: number) => {
      this.tick(now)
      this.raf = requestAnimationFrame(loop)
    }
    this.raf = requestAnimationFrame(loop)
  }

  private tick(now: number) {
    const ed = useEditorStore.getState()
    const project = useProjectStore.getState().project
    const dtUs = (now - this.lastNow) * 1000
    this.lastNow = now

    let t = ed.playheadUs
    if (ed.playing) {
      const dur = projectDurationUs(project)
      t += dtUs
      if (t >= dur) {
        t = dur
        ed.setPlaying(false)
      }
      ed.setPlayhead(t)
    }
    this.sync(project, t, useEditorStore.getState().playing)
    if ((ed.playing || this.dirty) && this.ctx) {
      this.dirty = false
      renderFrame(this.ctx, project, t, (c) => this.source(project, c))
    }
  }

  private source(project: Project, clip: Clip): FrameSource | null {
    const asset = project.assets[clip.assetId]
    if (!asset) return null
    if (asset.kind === 'image') {
      const img = this.images.get(asset.id)
      return img && img.complete && img.naturalWidth
        ? { el: img, width: img.naturalWidth, height: img.naturalHeight }
        : null
    }
    const rec = this.media.get(clip.id)
    const v = rec?.el as HTMLVideoElement | undefined
    if (!v || v.readyState < 2 || !v.videoWidth) return null
    return { el: v, width: v.videoWidth, height: v.videoHeight }
  }

  private element(project: Project, clip: Clip): HTMLMediaElement | null {
    const asset = project.assets[clip.assetId]
    const entry = useMediaStore.getState().entries[clip.assetId]
    if (!asset || !entry || asset.kind === 'image') return null
    const existing = this.media.get(clip.id)
    if (existing) {
      existing.used = performance.now()
      return existing.el
    }
    this.evictIfNeeded()
    const el = document.createElement(asset.kind === 'video' ? 'video' : 'audio')
    el.preload = 'auto'
    if (el instanceof HTMLVideoElement) el.playsInline = true
    el.src = entry.url
    const redraw = () => this.requestRender()
    el.addEventListener('seeked', redraw)
    el.addEventListener('loadeddata', redraw)
    this.media.set(clip.id, { el, used: performance.now() })
    return el
  }

  private evictIfNeeded() {
    if (this.media.size < MAX_MEDIA_ELEMENTS) return
    let oldest: string | null = null
    let oldestUsed = Infinity
    for (const [id, rec] of this.media) {
      if (rec.el.paused && rec.used < oldestUsed) {
        oldest = id
        oldestUsed = rec.used
      }
    }
    if (oldest) {
      const rec = this.media.get(oldest)!
      rec.el.pause()
      rec.el.removeAttribute('src')
      rec.el.load()
      this.media.delete(oldest)
    }
  }

  private sync(project: Project, t: number, playing: boolean) {
    // Still images: make sure they are loaded.
    for (const track of project.tracks) {
      for (const clip of track.clips) {
        const asset = project.assets[clip.assetId]
        if (asset?.kind !== 'image' || this.images.has(asset.id)) continue
        const entry = useMediaStore.getState().entries[asset.id]
        if (!entry) continue
        const img = new Image()
        img.onload = () => this.requestRender()
        img.src = entry.url
        this.images.set(asset.id, img)
      }
    }

    const activeIds = new Set<string>()
    for (const { track, clip } of activeClipsAt(project, t)) {
      const el = this.element(project, clip)
      if (!el) continue
      activeIds.add(clip.id)
      const target = (clip.inUs + (t - clip.startUs) * clip.speed) / US_PER_SECOND
      el.muted = clip.muted || track.muted
      el.playbackRate = clip.speed
      if (playing) {
        if (el.paused) {
          if (Math.abs(el.currentTime - target) > 0.05) el.currentTime = target
          void el.play().catch(() => {
            // Autoplay policy (iOS): keep the picture running silently rather than stalling.
            el.muted = true
            void el.play().catch(() => {})
          })
        } else if (Math.abs(el.currentTime - target) > 0.3) {
          el.currentTime = target
        }
      } else {
        if (!el.paused) el.pause()
        if (Math.abs(el.currentTime - target) > 0.02) el.currentTime = target
      }
    }

    // Warm up the clips that are about to start so cuts don't stall.
    for (const track of project.tracks) {
      for (const clip of track.clips) {
        if (activeIds.has(clip.id)) continue
        const soon = clip.startUs > t && clip.startUs - t <= PRELOAD_AHEAD_US
        const rec = this.media.get(clip.id)
        if (soon) {
          const el = this.element(project, clip)
          const inSec = clip.inUs / US_PER_SECOND
          if (el && el.paused && Math.abs(el.currentTime - inSec) > 0.05) el.currentTime = inSec
        } else if (rec && !rec.el.paused) {
          rec.el.pause()
        }
      }
    }
  }
}

export const player = new Player()
