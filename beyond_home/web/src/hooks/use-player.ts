import { useSyncExternalStore } from "react"
import { home } from "@/api"
import type { Playable } from "@/lib/types"

// One player for the whole app, so the music keeps going from screen to screen. The phone's lock screen and
// headphone buttons drive it through Media Session.

type State = { queue: Playable[]; at: number; playing: boolean; time: number; length: number }

let state: State = { queue: [], at: 0, playing: false, time: 0, length: 0 }
const listeners = new Set<() => void>()
const set = (next: Partial<State>) => {
  state = { ...state, ...next }
  listeners.forEach((l) => l())
}

let audio: HTMLAudioElement | null = null
function element() {
  if (audio) return audio
  audio = new Audio()
  audio.preload = "auto"
  audio.addEventListener("play", () => set({ playing: true }))
  audio.addEventListener("pause", () => set({ playing: false }))
  audio.addEventListener("timeupdate", () => set({ time: audio!.currentTime, length: isFinite(audio!.duration) ? audio!.duration : 0 }))
  audio.addEventListener("ended", () => (state.at + 1 < state.queue.length ? load(state.at + 1) : set({ playing: false })))
  if ("mediaSession" in navigator) {
    navigator.mediaSession.setActionHandler("play", () => audio!.play())
    navigator.mediaSession.setActionHandler("pause", () => audio!.pause())
    navigator.mediaSession.setActionHandler("nexttrack", () => player.next())
    navigator.mediaSession.setActionHandler("previoustrack", () => player.previous())
  }
  return audio
}

function load(at: number) {
  const p = state.queue[at]
  if (!p) return
  const a = element()
  set({ at, time: 0, length: 0 })
  a.src = p.src
  a.play().catch(() => set({ playing: false }))
  if (p.trackId) home.played(p.trackId)
  if ("mediaSession" in navigator) {
    navigator.mediaSession.metadata = new MediaMetadata({ title: p.title, artist: p.by, artwork: p.cover ? [{ src: p.cover, sizes: "512x512" }] : [] })
  }
}

export const player = {
  play(queue: Playable[], at = 0) {
    set({ queue })
    load(at)
  },
  toggle() {
    const a = element()
    if (!state.queue.length) return
    if (a.paused) a.play().catch(() => {})
    else a.pause()
  },
  next() {
    if (state.at + 1 < state.queue.length) load(state.at + 1)
  },
  previous() {
    if (state.time > 3 || state.at === 0) element().currentTime = 0
    else load(state.at - 1)
  },
  seek(seconds: number) {
    element().currentTime = seconds
  },
}

const subscribe = (l: () => void) => (listeners.add(l), () => listeners.delete(l))
export function usePlayer() {
  const s = useSyncExternalStore(subscribe, () => state)
  return { ...s, now: s.queue[s.at] as Playable | undefined }
}
