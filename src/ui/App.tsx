import { useState } from 'react'
import { PROJECT_HEIGHT, PROJECT_WIDTH } from '../model'
import { importFiles } from '../media/import'
import { Inspector } from './Inspector'
import { Library } from './Library'
import { Preview } from './Preview'
import { Timeline } from './Timeline'
import { Toolbar } from './Toolbar'
import { useIsDesktop } from './useIsDesktop'
import { useShortcuts } from './useShortcuts'

type Panel = 'media' | 'inspector'

/**
 * Editor shell. Desktop (md+): library | preview | inspector, toolbar and timeline below.
 * Phone: preview on top, toolbar, then a bottom area that a tab bar switches between
 * timeline, media and inspector.
 */
export function App() {
  const [panel, setPanel] = useState<Panel | null>('media')
  useShortcuts()
  const desktop = useIsDesktop()

  const media = <Library onAdded={() => setPanel(null)} />
  const inspector = <Inspector />

  return (
    <div
      className="flex h-dvh flex-col pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)] md:grid md:grid-cols-[280px_1fr_300px] md:grid-rows-[48px_1fr_auto_260px]"
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault()
        const files = Array.from(e.dataTransfer.files)
        if (files.length) void importFiles(files)
      }}
    >
      <header className="flex h-11 shrink-0 items-center gap-4 border-b border-neutral-800 px-4 md:col-span-3 md:h-auto">
        <span className="font-semibold">De-Editor</span>
        <span className="text-sm text-neutral-500" dir="ltr">
          {PROJECT_WIDTH}×{PROJECT_HEIGHT}
        </span>
      </header>

      {desktop && <aside className="overflow-auto border-neutral-800 border-e">{media}</aside>}

      <main className="flex min-h-0 flex-1 items-center justify-center bg-neutral-900 py-2 md:py-2">
        <Preview />
      </main>

      {desktop && <aside className="overflow-auto border-neutral-800 border-s">{inspector}</aside>}

      <div className="md:col-span-3">
        <Toolbar />
      </div>

      {/* Lower area: on desktop the timeline is always here; on phone it swaps with the panels. */}
      <section
        className={`h-[40dvh] shrink-0 overflow-hidden border-t border-neutral-800 md:col-span-3 md:block md:h-auto ${!desktop && panel ? 'hidden' : ''}`}
      >
        <Timeline />
      </section>
      {!desktop && panel && (
        <div className="h-[40dvh] shrink-0 overflow-auto border-t border-neutral-800 md:hidden">
          {panel === 'media' ? media : inspector}
        </div>
      )}

      {!desktop && (
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
      )}
    </div>
  )
}
