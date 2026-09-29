import { addAsset, newId, secToUs } from '../model'
import type { AssetKind, AssetMeta } from '../model'
import { useMediaStore } from '../state/mediaStore'
import { useProjectStore } from '../state/projectStore'

const THUMB_W = 160

function kindOf(file: File): AssetKind | null {
  if (file.type.startsWith('video/')) return 'video'
  if (file.type.startsWith('audio/')) return 'audio'
  if (file.type.startsWith('image/')) return 'image'
  // iOS sometimes reports an empty type for .mov/.m4a
  const ext = file.name.split('.').pop()?.toLowerCase() ?? ''
  if (['mp4', 'mov', 'm4v', 'webm'].includes(ext)) return 'video'
  if (['mp3', 'm4a', 'aac', 'wav', 'ogg'].includes(ext)) return 'audio'
  if (['jpg', 'jpeg', 'png', 'webp', 'heic', 'gif'].includes(ext)) return 'image'
  return null
}

function once(el: EventTarget, ok: string, timeoutMs: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`timeout waiting for ${ok}`)), timeoutMs)
    el.addEventListener(
      ok,
      () => {
        clearTimeout(t)
        resolve()
      },
      { once: true },
    )
    el.addEventListener(
      'error',
      () => {
        clearTimeout(t)
        reject(new Error('media error'))
      },
      { once: true },
    )
  })
}

function thumbFrom(source: CanvasImageSource, w: number, h: number): Promise<string | undefined> {
  if (!w || !h) return Promise.resolve(undefined)
  const canvas = document.createElement('canvas')
  canvas.width = THUMB_W
  canvas.height = Math.max(1, Math.round((THUMB_W * h) / w))
  const ctx = canvas.getContext('2d')
  if (!ctx) return Promise.resolve(undefined)
  ctx.drawImage(source, 0, 0, canvas.width, canvas.height)
  return new Promise((resolve) =>
    canvas.toBlob((b) => resolve(b ? URL.createObjectURL(b) : undefined), 'image/jpeg', 0.7),
  )
}

type Probed = Pick<AssetMeta, 'durationUs' | 'width' | 'height' | 'hasAudio'> & {
  thumbUrl?: string
}

async function probeVideo(url: string): Promise<Probed> {
  const v = document.createElement('video')
  v.muted = true
  v.playsInline = true
  v.preload = 'auto'
  v.src = url
  await once(v, 'loadedmetadata', 15000)
  if (!Number.isFinite(v.duration) || v.duration <= 0) throw new Error('bad duration')
  let thumbUrl: string | undefined
  try {
    v.currentTime = Math.min(0.1, v.duration / 2)
    await once(v, 'seeked', 4000)
    thumbUrl = await thumbFrom(v, v.videoWidth, v.videoHeight)
  } catch {
    // Some browsers won't decode a frame without playback; the card just shows an icon.
  }
  const anyV = v as HTMLVideoElement & {
    mozHasAudio?: boolean
    audioTracks?: { length: number }
  }
  const hasAudio = anyV.mozHasAudio ?? (anyV.audioTracks ? anyV.audioTracks.length > 0 : true)
  const out = {
    durationUs: secToUs(v.duration),
    width: v.videoWidth,
    height: v.videoHeight,
    hasAudio,
    thumbUrl,
  }
  v.removeAttribute('src')
  v.load()
  return out
}

async function probeAudio(url: string): Promise<Probed> {
  const a = document.createElement('audio')
  a.preload = 'metadata'
  a.src = url
  await once(a, 'loadedmetadata', 15000)
  if (!Number.isFinite(a.duration) || a.duration <= 0) throw new Error('bad duration')
  return { durationUs: secToUs(a.duration), hasAudio: true }
}

async function probeImage(url: string): Promise<Probed> {
  const img = new Image()
  img.src = url
  await img.decode()
  const thumbUrl = await thumbFrom(img, img.naturalWidth, img.naturalHeight)
  return {
    durationUs: 0,
    width: img.naturalWidth,
    height: img.naturalHeight,
    hasAudio: false,
    thumbUrl,
  }
}

/** Probe files and register them as assets. Returns the new asset ids. */
export async function importFiles(files: File[]): Promise<string[]> {
  const media = useMediaStore.getState()
  const ids: string[] = []
  media.setImporting(files.length)
  for (const file of files) {
    const kind = kindOf(file)
    if (!kind) {
      media.pushError(`${file.name}: סוג קובץ לא נתמך`)
      media.setImporting(-1)
      continue
    }
    const url = URL.createObjectURL(file)
    try {
      const probed =
        kind === 'video'
          ? await probeVideo(url)
          : kind === 'audio'
            ? await probeAudio(url)
            : await probeImage(url)
      const id = newId()
      const { thumbUrl, ...meta } = probed
      useMediaStore.getState().add(id, { file, url, thumbUrl })
      useProjectStore
        .getState()
        .dispatch((p) => addAsset(p, { id, kind, name: file.name, ...meta }))
      ids.push(id)
    } catch {
      URL.revokeObjectURL(url)
      useMediaStore
        .getState()
        .pushError(`${file.name}: לא הצלחתי לקרוא את הקובץ (ייתכן שהפורמט לא נתמך בדפדפן)`)
    } finally {
      useMediaStore.getState().setImporting(-1)
    }
  }
  return ids
}
