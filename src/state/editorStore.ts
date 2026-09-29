import { create } from 'zustand'

/** Ephemeral UI/playback state. Not part of the project and not undoable. */
interface EditorState {
  selectedClipId: string | null
  playheadUs: number
  playing: boolean
  pxPerSec: number
  snap: boolean
  showSafeZone: boolean
  select: (id: string | null) => void
  setPlayhead: (us: number) => void
  setPlaying: (v: boolean) => void
  setZoom: (pxPerSec: number) => void
  toggleSnap: () => void
  toggleSafeZone: () => void
}

export const MIN_ZOOM = 10
export const MAX_ZOOM = 400

export const useEditorStore = create<EditorState>((set) => ({
  selectedClipId: null,
  playheadUs: 0,
  playing: false,
  pxPerSec: 60,
  snap: true,
  showSafeZone: false,
  select: (id) => set({ selectedClipId: id }),
  setPlayhead: (us) => set({ playheadUs: Math.max(0, us) }),
  setPlaying: (v) => set({ playing: v }),
  setZoom: (z) => set({ pxPerSec: Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, z)) }),
  toggleSnap: () => set((s) => ({ snap: !s.snap })),
  toggleSafeZone: () => set((s) => ({ showSafeZone: !s.showSafeZone })),
}))
