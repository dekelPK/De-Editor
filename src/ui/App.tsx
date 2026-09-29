import { useState } from 'react'
import { PROJECT_HEIGHT, PROJECT_WIDTH } from '../model/constants'

type Panel = 'media' | 'inspector'

/**
 * Editor shell. Desktop (md+): library | preview | inspector, timeline below. RTL page; the timeline itself will be forced LTR in M3.
 * Phone: preview on top, timeline in the middle, and a bottom tab bar that
 * switches the lower area between timeline, media and inspector.
 */
export function App() {
  const [panel, setPanel] = useState<Panel | null>(null)

  const media = (
    <aside className="border-neutral-800 p-3 text-sm text-neutral-400 md:border-e">מדיה</aside>
  )
  const inspector = (
    <aside className="border-neutral-800 p-3 text-sm text-neutral-400 md:border-s">מאפיינים</aside>
  )

  return (
    <div className="flex h-dvh flex-col pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)] md:grid md:grid-cols-[280px_1fr_300px] md:grid-rows-[48px_1fr_280px]">
      <header className="flex h-11 shrink-0 items-center gap-4 border-b border-neutral-800 px-4 md:col-span-3 md:h-auto">
        <span className="font-semibold">De-Editor</span>
        <span className="text-sm text-neutral-500">
          {PROJECT_WIDTH}×{PROJECT_HEIGHT}
        </span>
      </header>

      <div className="hidden md:block">{media}</div>

      <main className="flex min-h-0 flex-1 items-center justify-center bg-neutral-900 py-2 md:py-0">
        <div className="aspect-[9/16] h-full max-h-[90%] rounded bg-black" data-testid="preview" />
      </main>

      <div className="hidden md:block">{inspector}</div>

      {/* Lower area: timeline always on desktop; on phone it swaps with the panels. */}
      <section
        className={`h-52 shrink-0 overflow-auto border-t border-neutral-800 p-3 text-sm text-neutral-400 md:col-span-3 md:h-auto ${panel ? 'hidden md:block' : ''}`}
      >
        ציר זמן
      </section>
      {panel && (
        <div className="h-52 shrink-0 overflow-auto border-t border-neutral-800 md:hidden">
          {panel === 'media' ? media : inspector}
        </div>
      )}

      <nav className="flex h-12 shrink-0 border-t border-neutral-800 md:hidden">
        {(
          [
            [null, 'ציר זמן'],
            ['media', 'מדיה'],
            ['inspector', 'מאפיינים'],
          ] as const
        ).map(([id, label]) => (
          <button
            key={label}
            type="button"
            onClick={() => setPanel(id)}
            className={`flex-1 text-sm ${panel === id ? 'bg-neutral-800 text-white' : 'text-neutral-400'}`}
          >
            {label}
          </button>
        ))}
      </nav>
    </div>
  )
}
