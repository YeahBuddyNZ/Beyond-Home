// Albums kept on the phone, so they play away from home. The songs and cover live in IndexedDB on this phone only,
// and are only ever copies of what the household's own box holds: when the box lets an album go (sold, given away,
// taken out), the phone's copy goes too (keptGone in lib.js). Nothing here leaves the phone.

import { useSyncExternalStore } from "react"
import { PREVIEW, home } from "@/api"
import { PHONE } from "@/phone"
import type { MusicAlbum, MusicTrack } from "@/lib/types"

// Only the phone app keeps albums (and the preview, to look at it): the box's own screens are always at home.
export const KEEPS = PHONE || PREVIEW

export type Kept = { album: MusicAlbum; tracks: MusicTrack[]; bytes: number; at: number }
type Saving = { albumId: string; done: number; total: number } | null

const DB = "beyond-kept"
let db: Promise<IDBDatabase> | null = null
function open() {
  db ??= new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1)
    req.onupgradeneeded = () => {
      req.result.createObjectStore("albums", { keyPath: "album.id" })
      req.result.createObjectStore("files")
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
  return db
}
const done = <T>(req: IDBRequest<T>) => new Promise<T>((resolve, reject) => ((req.onsuccess = () => resolve(req.result)), (req.onerror = () => reject(req.error))))
async function store(name: string, mode: IDBTransactionMode = "readonly") {
  return (await open()).transaction(name, mode).objectStore(name)
}

// What's kept, and a ready-made address for each kept song and cover, so the player can start straight away.
let kept: Kept[] = []
let saving = null as Saving
const urls = new Map<string, string>()
const listeners = new Set<() => void>()
let snapshot: { kept: Kept[]; saving: Saving } = { kept, saving }
const changed = () => {
  snapshot = { kept, saving }
  listeners.forEach((l) => l())
}

async function file(key: string) {
  return (await done((await store("files")).get(key))) as Blob | undefined
}

let loaded: Promise<void> | null = null
export function loadKept() {
  loaded ??= (async () => {
    try {
      kept = ((await done((await store("albums")).getAll())) as Kept[]).sort((a, b) => b.at - a.at)
      for (const k of kept) {
        for (const t of k.tracks) {
          const b = await file("song:" + t.id)
          if (b) urls.set("song:" + t.id, URL.createObjectURL(b))
        }
        const c = await file("cover:" + k.album.id)
        if (c) urls.set("cover:" + k.album.id, URL.createObjectURL(c))
      }
      // Ask the phone not to clear these when it runs short of room.
      navigator.storage?.persist?.().catch(() => {})
    } catch {
      kept = []
    }
    changed()
  })()
  return loaded
}

export const keptSong = (trackId: string) => urls.get("song:" + trackId)
export const keptCover = (albumId: string) => urls.get("cover:" + albumId)
export const keptIds = () => kept.map((k) => k.album.id)
export const isKept = (albumId: string) => kept.some((k) => k.album.id === albumId)

export async function keepAlbum(album: MusicAlbum, tracks: MusicTrack[]) {
  if (saving) throw new Error("Another album is still coming across. Wait for it to finish.")
  saving = { albumId: album.id, done: 0, total: tracks.length }
  changed()
  let bytes = 0
  const fresh: [string, Blob][] = []
  try {
    for (const t of tracks) {
      const blob = await home.songFile(t.id)
      bytes += blob.size
      fresh.push(["song:" + t.id, blob])
      saving = { albumId: album.id, done: saving.done + 1, total: tracks.length }
      changed()
    }
    const cover = album.hasCover ? await home.coverFile(album.id) : null
    if (cover) fresh.push(["cover:" + album.id, cover])
    const tx = (await open()).transaction(["albums", "files"], "readwrite")
    for (const [key, blob] of fresh) tx.objectStore("files").put(blob, key)
    const entry: Kept = { album, tracks, bytes, at: Date.now() }
    tx.objectStore("albums").put(entry)
    await new Promise<void>((resolve, reject) => ((tx.oncomplete = () => resolve()), (tx.onerror = () => reject(tx.error)), (tx.onabort = () => reject(tx.error))))
    for (const [key, blob] of fresh) urls.set(key, URL.createObjectURL(blob))
    kept = [entry, ...kept.filter((k) => k.album.id !== album.id)]
    navigator.storage?.persist?.().catch(() => {})
  } catch (e) {
    throw (e as Error)?.name === "QuotaExceededError" ? new Error("This phone is out of room. Let go of an album first.") : e
  } finally {
    saving = null
    changed()
  }
}

export async function letGo(albumId: string) {
  const k = kept.find((x) => x.album.id === albumId)
  if (!k) return
  const tx = (await open()).transaction(["albums", "files"], "readwrite")
  for (const t of k.tracks) tx.objectStore("files").delete("song:" + t.id)
  tx.objectStore("files").delete("cover:" + albumId)
  tx.objectStore("albums").delete(albumId)
  await new Promise<void>((resolve, reject) => ((tx.oncomplete = () => resolve()), (tx.onerror = () => reject(tx.error))))
  for (const key of ["cover:" + albumId, ...k.tracks.map((t) => "song:" + t.id)]) {
    const u = urls.get(key)
    if (u) URL.revokeObjectURL(u)
    urls.delete(key)
  }
  kept = kept.filter((x) => x.album.id !== albumId)
  changed()
}

const subscribe = (l: () => void) => (listeners.add(l), () => listeners.delete(l))
export function useKept() {
  return useSyncExternalStore(subscribe, () => snapshot)
}
