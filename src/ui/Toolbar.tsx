import { formatTime, projectDurationUs } from '../model'
import { deleteSelected, redo, splitAtPlayhead, togglePlay, undo } from '../state/commands'
import { useEditorStore } from '../state/editorStore'
import { useProjectStore } from '../state/projectStore'

function Btn({
  label,
  onClick,
  disabled,
  active,
  children,
  testId,
}: {
  label: string
  onClick: () => void
  disabled?: boolean
  active?: boolean
  children: React.ReactNode
  testId?: string
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      data-testid={testId}
      disabled={disabled}
      onClick={onClick}
      className={`flex h-9 min-w-8 shrink-0 items-center justify-center rounded px-1.5 text-base disabled:opacity-30 ${
        active ? 'bg-indigo-600 text-white' : 'bg-neutral-800 active:bg-neutral-700'
      }`}
    >
      {children}
    </button>
  )
}

export function Toolbar() {
  const playing = useEditorStore((s) => s.playing)
  const playheadUs = useEditorStore((s) => s.playheadUs)
  const selected = useEditorStore((s) => s.selectedClipId)
  const snap = useEditorStore((s) => s.snap)
  const pxPerSec = useEditorStore((s) => s.pxPerSec)
  const setZoom = useEditorStore((s) => s.setZoom)
  const toggleSnap = useEditorStore((s) => s.toggleSnap)
  const canUndo = useProjectStore((s) => s.past.length > 0)
  const canRedo = useProjectStore((s) => s.future.length > 0)
  const durationUs = useProjectStore((s) => projectDurationUs(s.project))

  return (
    <div
      dir="ltr"
      className="flex items-center gap-1 overflow-x-auto border-t border-neutral-800 bg-neutral-900 px-2 py-1"
    >
      <Btn
        label="ניגון / עצירה (רווח)"
        onClick={togglePlay}
        disabled={durationUs === 0}
        testId="play"
      >
        {playing ? '⏸' : '▶'}
      </Btn>
      <span
        className="w-[84px] shrink-0 text-center text-[11px] text-neutral-300 tabular-nums"
        dir="ltr"
      >
        {formatTime(playheadUs)} / {formatTime(durationUs)}
      </span>
      <Btn label="פצל בנקודת ההשמעה (S)" onClick={splitAtPlayhead} testId="split">
        ✂
      </Btn>
      <Btn
        label="מחק (Delete)"
        onClick={() => deleteSelected()}
        disabled={!selected}
        testId="delete"
      >
        🗑
      </Btn>
      <Btn label="בטל (Ctrl+Z)" onClick={undo} disabled={!canUndo} testId="undo">
        ↶
      </Btn>
      <Btn label="בצע שוב (Ctrl+Shift+Z)" onClick={redo} disabled={!canRedo} testId="redo">
        ↷
      </Btn>
      <span className="mx-1 h-5 w-px shrink-0 bg-neutral-700" />
      <Btn label="הקטן" onClick={() => setZoom(pxPerSec / 1.5)}>
        −
      </Btn>
      <Btn label="הגדל" onClick={() => setZoom(pxPerSec * 1.5)}>
        +
      </Btn>
      <Btn label="הצמדה" onClick={toggleSnap} active={snap}>
        🧲
      </Btn>
    </div>
  )
}
