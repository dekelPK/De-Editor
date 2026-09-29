import {
  addClip,
  clipEndUs,
  deleteClip,
  findClip,
  projectDurationUs,
  splitClip,
  newId,
} from '../model'
import { useEditorStore } from './editorStore'
import { useProjectStore } from './projectStore'

/** UI-level commands shared by buttons and keyboard shortcuts. */

export function togglePlay() {
  const ed = useEditorStore.getState()
  const dur = projectDurationUs(useProjectStore.getState().project)
  if (ed.playing) return ed.setPlaying(false)
  if (dur === 0) return
  if (ed.playheadUs >= dur) ed.setPlayhead(0)
  ed.setPlaying(true)
}

/** Split the selected clip at the playhead, or every clip under the playhead if none is selected. */
export function splitAtPlayhead() {
  const { playheadUs, selectedClipId } = useEditorStore.getState()
  const { project, dispatch } = useProjectStore.getState()
  const selected = selectedClipId ? findClip(project, selectedClipId) : undefined
  const under = (c: { startUs: number }, end: number) => playheadUs > c.startUs && playheadUs < end
  const ids =
    selected && under(selected.clip, clipEndUs(selected.clip))
      ? [selected.clip.id]
      : project.tracks.flatMap((t) =>
          t.clips.filter((c) => under(c, clipEndUs(c))).map((c) => c.id),
        )
  if (ids.length === 0) return
  dispatch((p) => ids.reduce((acc, id) => splitClip(acc, id, playheadUs, newId()), p))
}

export function deleteSelected(ripple = false) {
  const { selectedClipId, select } = useEditorStore.getState()
  if (!selectedClipId) return
  useProjectStore.getState().dispatch((p) => deleteClip(p, selectedClipId, ripple))
  select(null)
}

export function undo() {
  useProjectStore.getState().undo()
}
export function redo() {
  useProjectStore.getState().redo()
}

/** Append an asset to the end of its matching track and select the new clip. */
export function addAssetToTimeline(assetId: string) {
  const clipId = newId()
  useProjectStore.getState().dispatch((p) => addClip(p, { assetId, clipId }))
  if (findClip(useProjectStore.getState().project, clipId)) {
    useEditorStore.getState().select(clipId)
  }
}
