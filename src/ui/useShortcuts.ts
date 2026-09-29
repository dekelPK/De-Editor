import { useEffect } from 'react'
import { deleteSelected, redo, splitAtPlayhead, togglePlay, undo } from '../state/commands'

/** Space = play/pause, S = split, Delete/Backspace = delete, Ctrl/Cmd+Z = undo, +Shift or Y = redo. */
export function useShortcuts() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null
      if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable))
        return
      const mod = e.ctrlKey || e.metaKey
      const key = e.key.toLowerCase()
      if (mod && key === 'z') {
        e.preventDefault()
        if (e.shiftKey) redo()
        else undo()
      } else if (mod && key === 'y') {
        e.preventDefault()
        redo()
      } else if (mod || e.altKey) {
        return
      } else if (e.code === 'Space') {
        e.preventDefault()
        togglePlay()
      } else if (key === 's') {
        e.preventDefault()
        splitAtPlayhead()
      } else if (key === 'delete' || key === 'backspace') {
        e.preventDefault()
        deleteSelected(e.shiftKey)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])
}
