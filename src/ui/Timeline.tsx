import { useEffect, useMemo, useRef, useState } from 'react'
import type { PointerEvent as ReactPointerEvent } from 'react'
import {
  US_PER_SECOND,
  clipDurationUs,
  moveClip,
  projectDurationUs,
  snapPoints,
  snapRange,
  snapValue,
  trimClipEnd,
  trimClipStart,
  clipEndUs,
} from '../model'
import type { Clip, Project, Track } from '../model'
import { useEditorStore } from '../state/editorStore'
import { useMediaStore } from '../state/mediaStore'
import { useProjectStore } from '../state/projectStore'

const ROW_H = 56
const RULER_H = 26
const SNAP_PX = 10

type DragMode = 'move' | 'trimStart' | 'trimEnd'
interface Drag {
  mode: DragMode
  clipId: string
  startX: number
  origStartUs: number
  origEndUs: number
  /** Target start (move / trimStart) or end (trimEnd) on the timeline. */
  valueUs: number
  trackId: string
}

function applyDrag(p: Project, d: Drag): Project {
  if (d.mode === 'move') return moveClip(p, d.clipId, d.valueUs, d.trackId)
  if (d.mode === 'trimStart') return trimClipStart(p, d.clipId, d.valueUs)
  return trimClipEnd(p, d.clipId, d.valueUs)
}

const KIND_COLOR = { video: 'bg-indigo-600', audio: 'bg-emerald-600' } as const

/** Multi-track timeline. Always left-to-right, even in an RTL page: time flows that way. */
export function Timeline() {
  const project = useProjectStore((s) => s.project)
  const dispatch = useProjectStore((s) => s.dispatch)
  const pxPerSec = useEditorStore((s) => s.pxPerSec)
  const selectedId = useEditorStore((s) => s.selectedClipId)
  const select = useEditorStore((s) => s.select)
  const setPlayhead = useEditorStore((s) => s.setPlayhead)
  const thumbs = useMediaStore((s) => s.entries)

  const [drag, setDrag] = useState<Drag | null>(null)
  const dragRef = useRef<Drag | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const tracksRef = useRef<HTMLDivElement>(null)

  const shown = useMemo(() => (drag ? applyDrag(project, drag) : project), [project, drag])
  const us2px = (us: number) => (us / US_PER_SECOND) * pxPerSec
  const px2us = (px: number) => (px / pxPerSec) * US_PER_SECOND

  const durationSec = projectDurationUs(shown) / US_PER_SECOND
  const widthPx = Math.max(durationSec + 8, 12) * pxPerSec

  // Keep the playhead in view while playing.
  useEffect(
    () =>
      useEditorStore.subscribe((s) => {
        const el = scrollRef.current
        if (!s.playing || !el) return
        const x = (s.playheadUs / US_PER_SECOND) * s.pxPerSec
        if (x < el.scrollLeft || x > el.scrollLeft + el.clientWidth - 40) {
          el.scrollLeft = Math.max(0, x - 40)
        }
      }),
    [],
  )

  function beginDrag(e: ReactPointerEvent, clip: Clip, track: Track, mode: DragMode) {
    e.stopPropagation()
    select(clip.id)
    if (track.locked) return
    const clipEl = (e.currentTarget as HTMLElement).closest('[data-clip]') as HTMLElement
    clipEl.setPointerCapture(e.pointerId)
    const d: Drag = {
      mode,
      clipId: clip.id,
      startX: e.clientX,
      origStartUs: clip.startUs,
      origEndUs: clipEndUs(clip),
      valueUs: mode === 'trimEnd' ? clipEndUs(clip) : clip.startUs,
      trackId: track.id,
    }
    dragRef.current = d
    setDrag(d)
  }

  function moveDrag(e: ReactPointerEvent) {
    const d = dragRef.current
    if (!d) return
    const dx = px2us(e.clientX - d.startX)
    const { snap: snapOn, playheadUs } = useEditorStore.getState()
    const points = snapOn ? snapPoints(project, d.clipId, playheadUs) : []
    const thr = px2us(SNAP_PX)
    let valueUs: number
    let trackId = d.trackId
    if (d.mode === 'move') {
      const raw = d.origStartUs + dx
      valueUs = snapRange(raw, d.origEndUs - d.origStartUs, points, thr)
      const rect = tracksRef.current?.getBoundingClientRect()
      if (rect) {
        const idx = Math.floor((e.clientY - rect.top) / ROW_H)
        const t = project.tracks[Math.min(project.tracks.length - 1, Math.max(0, idx))]
        if (t) trackId = t.id
      }
    } else if (d.mode === 'trimStart') {
      valueUs = snapValue(d.origStartUs + dx, points, thr)
    } else {
      valueUs = snapValue(d.origEndUs + dx, points, thr)
    }
    const next = { ...d, valueUs, trackId }
    dragRef.current = next
    setDrag(next)
  }

  function endDrag() {
    const d = dragRef.current
    dragRef.current = null
    setDrag(null)
    if (d) dispatch((p) => applyDrag(p, d))
  }

  function seekFromClientX(clientX: number, el: HTMLElement) {
    const x = clientX - el.getBoundingClientRect().left
    setPlayhead(Math.max(0, px2us(x)))
  }

  return (
    <div ref={scrollRef} dir="ltr" className="relative h-full overflow-auto" data-testid="timeline">
      <div style={{ width: widthPx, minHeight: RULER_H + ROW_H * shown.tracks.length }}>
        <Ruler widthPx={widthPx} pxPerSec={pxPerSec} onSeek={seekFromClientX} />

        <div ref={tracksRef} className="relative" onClick={() => select(null)}>
          {shown.tracks.map((track) => (
            <div
              key={track.id}
              className="relative border-b border-neutral-800 bg-neutral-950"
              style={{ height: ROW_H, touchAction: 'pan-x pan-y' }}
              onClick={(e) => {
                e.stopPropagation()
                select(null)
                seekFromClientX(e.clientX, e.currentTarget)
              }}
            >
              <span className="pointer-events-none absolute start-1 top-0.5 z-0 text-[10px] text-neutral-600">
                {track.name}
              </span>
              {track.clips.map((clip) => {
                const asset = shown.assets[clip.assetId]
                const selected = clip.id === selectedId
                const w = Math.max(6, us2px(clipDurationUs(clip)))
                return (
                  <div
                    key={clip.id}
                    data-clip={clip.id}
                    className={`absolute top-1 bottom-1 overflow-hidden rounded ${KIND_COLOR[track.kind]} ${
                      selected ? 'ring-2 ring-yellow-300' : ''
                    } ${drag?.clipId === clip.id ? 'opacity-80' : ''}`}
                    style={{ left: us2px(clip.startUs), width: w, touchAction: 'none' }}
                    onPointerDown={(e) => beginDrag(e, clip, track, 'move')}
                    onPointerMove={moveDrag}
                    onPointerUp={endDrag}
                    onPointerCancel={endDrag}
                    onClick={(e) => e.stopPropagation()}
                  >
                    {thumbs[clip.assetId]?.thumbUrl && (
                      <img
                        src={thumbs[clip.assetId]!.thumbUrl}
                        alt=""
                        draggable={false}
                        className="pointer-events-none absolute inset-y-0 start-0 h-full w-auto max-w-none opacity-60"
                      />
                    )}
                    <span className="pointer-events-none relative z-10 block truncate px-2 pt-0.5 text-[11px] font-medium text-white drop-shadow">
                      {asset?.name}
                    </span>
                    {selected && (
                      <>
                        <div
                          className="absolute inset-y-0 start-0 z-20 w-4 cursor-ew-resize rounded-s bg-yellow-300/90"
                          onPointerDown={(e) => beginDrag(e, clip, track, 'trimStart')}
                        />
                        <div
                          className="absolute inset-y-0 end-0 z-20 w-4 cursor-ew-resize rounded-e bg-yellow-300/90"
                          onPointerDown={(e) => beginDrag(e, clip, track, 'trimEnd')}
                        />
                      </>
                    )}
                  </div>
                )
              })}
            </div>
          ))}
          <Playhead pxPerSec={pxPerSec} />
        </div>
      </div>
    </div>
  )
}

function Playhead({ pxPerSec }: { pxPerSec: number }) {
  const playheadUs = useEditorStore((s) => s.playheadUs)
  return (
    <div
      className="pointer-events-none absolute -top-[26px] bottom-0 z-30 w-px bg-red-500"
      style={{ left: (playheadUs / US_PER_SECOND) * pxPerSec }}
      data-testid="playhead"
    >
      <div className="absolute -top-0 -left-1.5 h-3 w-3 rounded-full bg-red-500" />
    </div>
  )
}

const STEPS = [0.5, 1, 2, 5, 10, 30, 60, 120]

function Ruler({
  widthPx,
  pxPerSec,
  onSeek,
}: {
  widthPx: number
  pxPerSec: number
  onSeek: (clientX: number, el: HTMLElement) => void
}) {
  const step = STEPS.find((s) => s * pxPerSec >= 64) ?? 120
  const ticks: number[] = []
  for (let s = 0; s * pxPerSec <= widthPx; s += step) ticks.push(s)
  const scrubbing = useRef(false)
  return (
    <div
      className="relative border-b border-neutral-800 bg-neutral-900 select-none"
      style={{ height: RULER_H, touchAction: 'none' }}
      data-testid="ruler"
      onPointerDown={(e) => {
        scrubbing.current = true
        e.currentTarget.setPointerCapture(e.pointerId)
        onSeek(e.clientX, e.currentTarget)
      }}
      onPointerMove={(e) => scrubbing.current && onSeek(e.clientX, e.currentTarget)}
      onPointerUp={() => (scrubbing.current = false)}
      onPointerCancel={() => (scrubbing.current = false)}
    >
      {ticks.map((s) => (
        <div key={s} className="absolute top-0 bottom-0" style={{ left: s * pxPerSec }}>
          <div className="h-2 w-px bg-neutral-600" />
          <span className="ps-1 text-[10px] text-neutral-500">
            {Math.floor(s / 60)}:{String(Math.floor(s % 60)).padStart(2, '0')}
          </span>
        </div>
      ))}
    </div>
  )
}
