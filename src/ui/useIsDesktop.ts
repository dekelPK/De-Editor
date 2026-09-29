import { useSyncExternalStore } from 'react'

const QUERY = '(min-width: 768px)' // Tailwind `md`

/** True on desktop-width screens, so each panel is mounted once instead of hidden with CSS. */
export function useIsDesktop(): boolean {
  return useSyncExternalStore(
    (cb) => {
      const m = window.matchMedia(QUERY)
      m.addEventListener('change', cb)
      return () => m.removeEventListener('change', cb)
    },
    () => window.matchMedia(QUERY).matches,
  )
}
