import { describe, expect, it } from 'vitest'
import {
  addAsset,
  addClip,
  createProject,
  deleteClip,
  moveClip,
  projectDurationUs,
  snapRange,
  splitClip,
  trimClipEnd,
  trimClipStart,
  MIN_CLIP_US,
  secToUs,
} from './index'
import type { AssetMeta, Project } from './index'

const video = (id: string, sec: number): AssetMeta => ({
  id,
  kind: 'video',
  name: id,
  durationUs: secToUs(sec),
  width: 1920,
  height: 1080,
  hasAudio: true,
})

function setup() {
  let p = createProject()
  p = addAsset(p, video('a', 10))
  p = addAsset(p, video('b', 5))
  p = addAsset(p, { id: 'm', kind: 'audio', name: 'm', durationUs: secToUs(30), hasAudio: true })
  return p
}
const vt = (p: Project) => p.tracks[0]!.clips

describe('addClip', () => {
  it('appends to the end of the matching track', () => {
    let p = setup()
    p = addClip(p, { assetId: 'a', clipId: 'c1' })
    p = addClip(p, { assetId: 'b', clipId: 'c2' })
    expect(vt(p).map((c) => [c.id, c.startUs])).toEqual([
      ['c1', 0],
      ['c2', secToUs(10)],
    ])
    expect(projectDurationUs(p)).toBe(secToUs(15))
  })
  it('puts audio on the audio track', () => {
    const p = addClip(setup(), { assetId: 'm' })
    expect(p.tracks[1]!.clips).toHaveLength(1)
    expect(vt(p)).toHaveLength(0)
  })
  it('ignores unknown assets', () => {
    const p = setup()
    expect(addClip(p, { assetId: 'nope' })).toBe(p)
  })
})

describe('moveClip', () => {
  it('moves freely into a gap', () => {
    let p = addClip(setup(), { assetId: 'b', clipId: 'c1' })
    p = moveClip(p, 'c1', secToUs(3))
    expect(vt(p)[0]!.startUs).toBe(secToUs(3))
  })
  it('never overlaps: lands on the nearest free spot', () => {
    let p = addClip(setup(), { assetId: 'a', clipId: 'c1' }) // 0-10
    p = addClip(p, { assetId: 'b', clipId: 'c2' }) // 10-15
    p = moveClip(p, 'c2', secToUs(8)) // would overlap c1
    expect(vt(p).find((c) => c.id === 'c2')!.startUs).toBe(secToUs(10))
  })
  it('is a no-op (same reference) when nothing changes', () => {
    const p = addClip(setup(), { assetId: 'a', clipId: 'c1' })
    expect(moveClip(p, 'c1', 0)).toBe(p)
  })
  it('cannot move a video clip onto an audio track', () => {
    let p = addClip(setup(), { assetId: 'a', clipId: 'c1' })
    p = moveClip(p, 'c1', 0, p.tracks[1]!.id)
    expect(vt(p)).toHaveLength(1)
  })
})

describe('trim', () => {
  it('trims the start and advances the source in-point', () => {
    let p = addClip(setup(), { assetId: 'a', clipId: 'c1' })
    p = trimClipStart(p, 'c1', secToUs(2))
    const c = vt(p)[0]!
    expect([c.startUs, c.inUs, c.outUs]).toEqual([secToUs(2), secToUs(2), secToUs(10)])
  })
  it('cannot extend the start past the source beginning', () => {
    let p = addClip(setup(), { assetId: 'a', clipId: 'c1', startUs: secToUs(5) })
    p = trimClipStart(p, 'c1', 0)
    expect(vt(p)[0]!.startUs).toBe(secToUs(5))
  })
  it('trims the end and clamps to source length and the next clip', () => {
    let p = addClip(setup(), { assetId: 'a', clipId: 'c1' })
    p = trimClipEnd(p, 'c1', secToUs(4))
    expect(vt(p)[0]!.outUs).toBe(secToUs(4))
    p = trimClipEnd(p, 'c1', secToUs(99))
    expect(vt(p)[0]!.outUs).toBe(secToUs(10))
    p = trimClipEnd(p, 'c1', secToUs(4))
    p = addClip(p, { assetId: 'b', clipId: 'c2', startUs: secToUs(6) })
    p = trimClipEnd(p, 'c1', secToUs(9))
    expect(vt(p).find((c) => c.id === 'c1')!.outUs).toBe(secToUs(6))
  })
  it('keeps a minimum length', () => {
    let p = addClip(setup(), { assetId: 'a', clipId: 'c1' })
    p = trimClipEnd(p, 'c1', 0)
    expect(vt(p)[0]!.outUs).toBe(MIN_CLIP_US)
  })
})

describe('splitClip', () => {
  it('splits into two contiguous clips with continuous source', () => {
    let p = addClip(setup(), { assetId: 'a', clipId: 'c1' })
    p = splitClip(p, 'c1', secToUs(4), 'c2')
    const [l, r] = vt(p) as [ReturnType<typeof vt>[0], ReturnType<typeof vt>[0]]
    expect([l.startUs, l.inUs, l.outUs]).toEqual([0, 0, secToUs(4)])
    expect([r.id, r.startUs, r.inUs, r.outUs]).toEqual(['c2', secToUs(4), secToUs(4), secToUs(10)])
    expect(projectDurationUs(p)).toBe(secToUs(10))
  })
  it('refuses to create slivers', () => {
    const p = addClip(setup(), { assetId: 'a', clipId: 'c1' })
    expect(splitClip(p, 'c1', 10_000)).toBe(p)
    expect(splitClip(p, 'c1', secToUs(10))).toBe(p)
  })
})

describe('deleteClip', () => {
  it('removes a clip, leaving a gap', () => {
    let p = addClip(setup(), { assetId: 'a', clipId: 'c1' })
    p = addClip(p, { assetId: 'b', clipId: 'c2' })
    p = deleteClip(p, 'c1')
    expect(vt(p).map((c) => [c.id, c.startUs])).toEqual([['c2', secToUs(10)]])
  })
  it('ripple closes the gap', () => {
    let p = addClip(setup(), { assetId: 'a', clipId: 'c1' })
    p = addClip(p, { assetId: 'b', clipId: 'c2' })
    p = deleteClip(p, 'c1', true)
    expect(vt(p)[0]!.startUs).toBe(0)
  })
})

describe('snapRange', () => {
  it('snaps the start or the end to a nearby point', () => {
    expect(snapRange(1000, 500, [0, 990], 50)).toBe(990)
    expect(snapRange(1000, 500, [0, 1520], 50)).toBe(1020)
    expect(snapRange(1000, 500, [0, 5000], 50)).toBe(1000)
  })
})
