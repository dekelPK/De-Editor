import { create } from 'zustand'
import { createProject } from '../model'
import type { Project } from '../model'

const HISTORY_LIMIT = 200

interface ProjectState {
  project: Project
  past: Project[]
  future: Project[]
  /** Apply a pure edit. No-op edits (same reference back) leave history untouched. */
  dispatch: (edit: (p: Project) => Project) => void
  undo: () => void
  redo: () => void
  reset: (p?: Project) => void
}

/**
 * History stores whole-project snapshots. Immer's structural sharing makes that cheap,
 * and it keeps undo/redo trivially correct.
 */
export const useProjectStore = create<ProjectState>((set) => ({
  project: createProject(),
  past: [],
  future: [],
  dispatch: (edit) =>
    set((s) => {
      const next = edit(s.project)
      if (next === s.project) return s
      return { project: next, past: [...s.past, s.project].slice(-HISTORY_LIMIT), future: [] }
    }),
  undo: () =>
    set((s) => {
      const prev = s.past[s.past.length - 1]
      if (!prev) return s
      return { project: prev, past: s.past.slice(0, -1), future: [s.project, ...s.future] }
    }),
  redo: () =>
    set((s) => {
      const next = s.future[0]
      if (!next) return s
      return { project: next, past: [...s.past, s.project], future: s.future.slice(1) }
    }),
  reset: (p) => set({ project: p ?? createProject(), past: [], future: [] }),
}))
