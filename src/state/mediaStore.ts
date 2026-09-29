import { create } from 'zustand'

/** Binary handles for assets. Kept out of the project JSON on purpose. */
export interface MediaEntry {
  file: File
  /** Object URL for playback. */
  url: string
  thumbUrl?: string
}

interface MediaState {
  entries: Record<string, MediaEntry>
  /** Files currently being probed. */
  importing: number
  errors: string[]
  add: (id: string, entry: MediaEntry) => void
  setImporting: (delta: number) => void
  pushError: (msg: string) => void
  clearErrors: () => void
}

export const useMediaStore = create<MediaState>((set) => ({
  entries: {},
  importing: 0,
  errors: [],
  add: (id, entry) => set((s) => ({ entries: { ...s.entries, [id]: entry } })),
  setImporting: (delta) => set((s) => ({ importing: Math.max(0, s.importing + delta) })),
  pushError: (msg) => set((s) => ({ errors: [...s.errors, msg] })),
  clearErrors: () => set({ errors: [] }),
}))
