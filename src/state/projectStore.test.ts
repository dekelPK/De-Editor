import { beforeEach, describe, expect, it } from 'vitest'
import { addAsset, addClip, secToUs, splitClip } from '../model'
import { useProjectStore } from './projectStore'

const clips = () => useProjectStore.getState().project.tracks[0]!.clips

describe('undo/redo', () => {
  beforeEach(() => {
    useProjectStore.getState().reset()
    const { dispatch } = useProjectStore.getState()
    dispatch((p) =>
      addAsset(p, { id: 'a', kind: 'video', name: 'a', durationUs: secToUs(10), hasAudio: true }),
    )
  })

  it('round-trips edits', () => {
    const s = useProjectStore.getState()
    s.dispatch((p) => addClip(p, { assetId: 'a', clipId: 'c1' }))
    s.dispatch((p) => splitClip(p, 'c1', secToUs(5)))
    expect(clips()).toHaveLength(2)
    useProjectStore.getState().undo()
    expect(clips()).toHaveLength(1)
    useProjectStore.getState().undo()
    expect(clips()).toHaveLength(0)
    useProjectStore.getState().redo()
    useProjectStore.getState().redo()
    expect(clips()).toHaveLength(2)
  })

  it('a new edit clears redo, and no-ops are not recorded', () => {
    const s = useProjectStore.getState()
    s.dispatch((p) => addClip(p, { assetId: 'a', clipId: 'c1' }))
    useProjectStore.getState().undo()
    useProjectStore.getState().dispatch((p) => p) // no-op
    expect(useProjectStore.getState().future).toHaveLength(1)
    useProjectStore.getState().dispatch((p) => addClip(p, { assetId: 'a' }))
    expect(useProjectStore.getState().future).toHaveLength(0)
  })
})
