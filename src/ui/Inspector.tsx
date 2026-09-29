import { clipDurationUs, findClip, formatTime } from '../model'
import { deleteSelected, splitAtPlayhead } from '../state/commands'
import { useEditorStore } from '../state/editorStore'
import { useProjectStore } from '../state/projectStore'

export function Inspector() {
  const selectedId = useEditorStore((s) => s.selectedClipId)
  const project = useProjectStore((s) => s.project)
  const found = selectedId ? findClip(project, selectedId) : undefined

  if (!found) {
    return (
      <p className="p-3 text-sm text-neutral-500">
        בחר קליפ בציר הזמן כדי לראות את הפרטים שלו. גרור קליפ להזזה, וגרור את הידיות הצהובות בקצוות
        כדי לקצר.
      </p>
    )
  }
  const { clip, track } = found
  const asset = project.assets[clip.assetId]
  return (
    <div className="flex flex-col gap-2 p-3 text-sm">
      <p className="truncate font-medium" title={asset?.name}>
        {asset?.name}
      </p>
      <dl className="grid grid-cols-2 gap-x-2 text-xs text-neutral-400" dir="ltr">
        <dt>Track</dt>
        <dd>{track.name}</dd>
        <dt>Start</dt>
        <dd>{formatTime(clip.startUs)}</dd>
        <dt>Length</dt>
        <dd>{formatTime(clipDurationUs(clip))}</dd>
      </dl>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={splitAtPlayhead}
          className="flex-1 rounded bg-neutral-800 py-2 active:bg-neutral-700"
        >
          ✂ פצל
        </button>
        <button
          type="button"
          onClick={() => deleteSelected()}
          className="flex-1 rounded bg-neutral-800 py-2 active:bg-neutral-700"
        >
          🗑 מחק
        </button>
        <button
          type="button"
          onClick={() => deleteSelected(true)}
          className="flex-1 rounded bg-neutral-800 py-2 active:bg-neutral-700"
        >
          מחק וסגור פער
        </button>
      </div>
    </div>
  )
}
