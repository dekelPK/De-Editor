import { useEffect, useRef } from 'react'
import { player } from '../media/player'
import { useEditorStore } from '../state/editorStore'

// Preview runs at half resolution to keep phones smooth; export renders full 1080x1920.
const PREVIEW_W = 540
const PREVIEW_H = 960

/** Guidance for the areas covered by TikTok/Reels/Shorts UI, as fractions of 1080x1920. */
const SAFE = { top: 150 / 1920, bottom: 480 / 1920, left: 120 / 1080, right: 240 / 1080 }

export function Preview() {
  const ref = useRef<HTMLCanvasElement>(null)
  const showSafeZone = useEditorStore((s) => s.showSafeZone)
  const toggle = useEditorStore((s) => s.toggleSafeZone)

  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    player.attach(canvas)
    return () => player.detach()
  }, [])

  const pct = (v: number) => `${v * 100}%`
  return (
    <div className="relative aspect-[9/16] h-full max-h-full overflow-hidden rounded bg-black">
      <canvas
        ref={ref}
        width={PREVIEW_W}
        height={PREVIEW_H}
        className="h-full w-full"
        data-testid="preview-canvas"
      />
      {showSafeZone && (
        <div className="pointer-events-none absolute inset-0" data-testid="safe-zone">
          <div
            className="absolute border border-dashed border-emerald-400"
            style={{
              top: pct(SAFE.top),
              bottom: pct(SAFE.bottom),
              left: pct(SAFE.left),
              right: pct(SAFE.right),
            }}
          />
          <div className="absolute inset-x-0 top-0 bg-black/45" style={{ height: pct(SAFE.top) }} />
          <div
            className="absolute inset-x-0 bottom-0 bg-black/45"
            style={{ height: pct(SAFE.bottom) }}
          />
          <div
            className="absolute bg-black/45"
            style={{ top: pct(SAFE.top), bottom: pct(SAFE.bottom), left: 0, width: pct(SAFE.left) }}
          />
          <div
            className="absolute bg-black/45"
            style={{
              top: pct(SAFE.top),
              bottom: pct(SAFE.bottom),
              right: 0,
              width: pct(SAFE.right),
            }}
          />
        </div>
      )}
      <button
        type="button"
        onClick={toggle}
        className="absolute end-2 top-2 rounded bg-black/60 px-2 py-1 text-xs text-white"
      >
        {showSafeZone ? 'הסתר אזורים בטוחים' : 'אזורים בטוחים'}
      </button>
    </div>
  )
}
