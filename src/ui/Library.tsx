import { useRef } from 'react'
import { formatTime } from '../model'
import type { AssetMeta } from '../model'
import { importFiles } from '../media/import'
import { addAssetToTimeline } from '../state/commands'
import { useMediaStore } from '../state/mediaStore'
import { useProjectStore } from '../state/projectStore'

const KIND_ICON: Record<AssetMeta['kind'], string> = { video: '🎬', audio: '🎵', image: '🖼️' }

/** Media library: pick files, see them as cards, tap to put them on the timeline. */
export function Library({ onAdded }: { onAdded?: () => void }) {
  const assets = useProjectStore((s) => s.project.assets)
  const entries = useMediaStore((s) => s.entries)
  const importing = useMediaStore((s) => s.importing)
  const errors = useMediaStore((s) => s.errors)
  const inputRef = useRef<HTMLInputElement>(null)
  const list = Object.values(assets)

  return (
    <div className="flex flex-col gap-3 p-3 text-sm">
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className="rounded bg-indigo-600 px-3 py-2 font-medium text-white active:bg-indigo-700"
      >
        ➕ הוסף מדיה
      </button>
      <input
        ref={inputRef}
        type="file"
        multiple
        accept="video/*,audio/*,image/*"
        className="hidden"
        data-testid="file-input"
        onChange={(e) => {
          const files = Array.from(e.target.files ?? [])
          e.target.value = ''
          if (files.length) void importFiles(files)
        }}
      />

      {importing > 0 && <p className="text-neutral-400">מייבא {importing} קבצים…</p>}
      {errors.length > 0 && (
        <div className="rounded border border-red-900 bg-red-950/50 p-2 text-red-300">
          {errors.map((e, i) => (
            <p key={i}>{e}</p>
          ))}
          <button
            type="button"
            className="mt-1 underline"
            onClick={() => useMediaStore.getState().clearErrors()}
          >
            סגור
          </button>
        </div>
      )}

      {list.length === 0 && importing === 0 && (
        <p className="text-neutral-500">
          עוד אין מדיה. לחץ על "הוסף מדיה" ובחר סרטון, תמונה או שיר מהגלריה. אחר כך לחץ על "הוסף
          לציר" בכרטיס.
        </p>
      )}

      <ul className="grid grid-cols-2 gap-2">
        {list.map((a) => (
          <li
            key={a.id}
            className="overflow-hidden rounded border border-neutral-800 bg-neutral-900"
          >
            <div className="flex aspect-video items-center justify-center bg-neutral-800 text-2xl">
              {entries[a.id]?.thumbUrl ? (
                <img src={entries[a.id]!.thumbUrl} alt="" className="h-full w-full object-cover" />
              ) : (
                KIND_ICON[a.kind]
              )}
            </div>
            <div className="p-2">
              <p className="truncate text-xs text-neutral-300" title={a.name}>
                {a.name}
              </p>
              <p className="text-xs text-neutral-500" dir="ltr">
                {a.kind === 'image' ? 'תמונה' : formatTime(a.durationUs)}
                {a.width ? ` · ${a.width}×${a.height}` : ''}
              </p>
              <button
                type="button"
                onClick={() => {
                  addAssetToTimeline(a.id)
                  onAdded?.()
                }}
                className="mt-1 w-full rounded bg-neutral-700 py-1.5 text-xs active:bg-neutral-600"
              >
                הוסף לציר
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}
