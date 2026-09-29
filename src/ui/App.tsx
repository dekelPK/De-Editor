import { PROJECT_HEIGHT, PROJECT_WIDTH } from '../model/constants'

/** Three-pane editor shell: library | preview | inspector, with the timeline below. */
export function App() {
  return (
    <div className="grid h-full grid-cols-[280px_1fr_300px] grid-rows-[48px_1fr_280px]">
      <header className="col-span-3 flex items-center gap-4 border-b border-neutral-800 px-4">
        <span className="font-semibold">De-Editor</span>
        <span className="text-sm text-neutral-500">
          {PROJECT_WIDTH}×{PROJECT_HEIGHT}
        </span>
      </header>
      <aside className="border-e border-neutral-800 p-3 text-sm text-neutral-400">Media</aside>
      <main className="flex items-center justify-center bg-neutral-900">
        <div className="aspect-[9/16] h-[90%] rounded bg-black" data-testid="preview" />
      </main>
      <aside className="border-s border-neutral-800 p-3 text-sm text-neutral-400">Inspector</aside>
      <section className="col-span-3 border-t border-neutral-800 p-3 text-sm text-neutral-400">
        Timeline
      </section>
    </div>
  )
}
