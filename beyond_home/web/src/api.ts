// Talking to the box: only its own routes (beyond_home/server/main.mjs), which talk to Home Assistant for us.
// Paths are relative, because Home Assistant serves the app under its own ingress address. The phone app asks the
// box's house door instead (src/phone.ts), with its own key.
// ?preview swaps the box for the stand-in in mock.js, so the app can be looked at in a browser.

import type { Call, MusicLibrary, MusicWhere, PairedTv, Snapshot, Station } from "@/lib/types"
import { PHONE, forget, phoneAsk, phoneMedia } from "@/phone"

// A build for the box (vite build --mode hub) leaves the stand-in out altogether.
export const PREVIEW = import.meta.env.MODE !== "hub" && import.meta.env.MODE !== "phone" && /[?&]preview/.test(location.search)

async function answer(res: Response) {
  if (PHONE && res.status === 401) {
    // The box has let this phone go (taken off in Settings): back to pairing.
    forget()
    location.reload()
  }
  const body = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(body.error || "Beyond Home didn’t answer.")
  return body
}

// One of the app's own asks ("snapshot", "act", "music/..."): through ingress, or the house door on the phone.
function ask(path: string, init: RequestInit = {}) {
  if (!PHONE) return fetch("./api/" + path, init)
  const p = phoneAsk(path)
  return fetch(p.url, { ...init, headers: { ...(init.headers as Record<string, string>), ...p.headers } })
}

export const home = {
  async snapshot(): Promise<Snapshot> {
    if (PREVIEW) return (await import("./mock.js")).mockSnapshot()
    return answer(await ask("snapshot", { cache: "no-store" }))
  },
  async act(calls: Call | Call[]): Promise<void> {
    const list = ([] as Call[]).concat(calls)
    if (!list.length) return
    if (PREVIEW) return (await import("./mock.js")).mockAct(list)
    await answer(await ask("act", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(list) }))
  },
  // Beyond TVs paired with the box (server/tvs.mjs): the TV shows a code, it is typed here.
  async tvs(): Promise<PairedTv[]> {
    if (PREVIEW) return (await import("./mock.js")).mockTvs()
    return (await answer(await fetch("./api/tvs", { cache: "no-store" }))).tvs
  },
  async pairTv(code: string): Promise<PairedTv[]> {
    if (PREVIEW) return (await import("./mock.js")).mockPairTv(code)
    const post = { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code }) }
    return (await answer(await fetch("./api/tvs/pair", post))).tvs
  },
  async removeTv(id: string): Promise<PairedTv[]> {
    if (PREVIEW) return (await import("./mock.js")).mockRemoveTv(id)
    const post = { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) }
    return (await answer(await fetch("./api/tvs/remove", post))).tvs
  },
  // The family's music, through the box (server/music.mjs) so it works however Home Assistant is opened.
  async musicWhere(): Promise<MusicWhere> {
    if (PREVIEW) return (await import("./mock.js")).mockMusicWhere()
    return answer(await fetch("./api/music/where", { cache: "no-store" }))
  },
  async setMusicWhere(address: string): Promise<MusicWhere> {
    if (PREVIEW) return { address, found: true }
    const post = { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ address }) }
    return answer(await fetch("./api/music/where", post))
  },
  async music(): Promise<MusicLibrary> {
    if (PREVIEW) return (await import("./mock.js")).mockMusic()
    return answer(await ask("music/library", { cache: "no-store" }))
  },
  async radio(): Promise<Station[]> {
    if (PREVIEW) return (await import("./mock.js")).mockRadio()
    return (await answer(await ask("music/radio", { cache: "no-store" }))).stations
  },
  played(trackId: string) {
    if (PREVIEW) return
    const post = { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: trackId }) }
    ask("music/played", post).catch(() => {})
  },
  // A whole song or cover as a file, to keep on the phone (src/offline.ts).
  async songFile(trackId: string): Promise<Blob> {
    if (PREVIEW) return new Blob([new Uint8Array(400_000)], { type: "audio/mpeg" })
    const res = await fetch(home.playUrl(trackId))
    if (!res.ok) throw new Error("That song didn’t come across. Try again at home.")
    return res.blob()
  },
  async coverFile(albumId: string): Promise<Blob | null> {
    if (PREVIEW) return null
    const res = await fetch(home.coverUrl(albumId)).catch(() => null)
    return res?.ok ? res.blob() : null
  },
  playUrl: (trackId: string) => (PREVIEW ? "" : PHONE ? phoneMedia("music/play/" + trackId) : "./api/music/play/" + trackId),
  coverUrl: (albumId: string) => (PHONE ? phoneMedia("music/cover/" + albumId) : "./api/music/cover/" + albumId),
}
