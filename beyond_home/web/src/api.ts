// Talking to the box: only its own routes (beyond_home/server/main.mjs), which talk to Home Assistant for us.
// Paths are relative, because Home Assistant serves the app under its own ingress address.
// ?preview swaps the box for the stand-in in mock.js, so the app can be looked at in a browser.

import type { Call, MusicLibrary, MusicWhere, PairedTv, Snapshot, Station } from "@/lib/types"

// A build for the box (vite build --mode hub) leaves the stand-in out altogether.
export const PREVIEW = import.meta.env.MODE !== "hub" && /[?&]preview/.test(location.search)

async function answer(res: Response) {
  const body = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(body.error || "Beyond Home didn’t answer.")
  return body
}

export const home = {
  async snapshot(): Promise<Snapshot> {
    if (PREVIEW) return (await import("./mock.js")).mockSnapshot()
    return answer(await fetch("./api/snapshot", { cache: "no-store" }))
  },
  async act(calls: Call | Call[]): Promise<void> {
    const list = ([] as Call[]).concat(calls)
    if (!list.length) return
    if (PREVIEW) return (await import("./mock.js")).mockAct(list)
    await answer(await fetch("./api/act", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(list) }))
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
    return answer(await fetch("./api/music/library", { cache: "no-store" }))
  },
  async radio(): Promise<Station[]> {
    if (PREVIEW) return (await import("./mock.js")).mockRadio()
    return (await answer(await fetch("./api/music/radio", { cache: "no-store" }))).stations
  },
  played(trackId: string) {
    if (PREVIEW) return
    const post = { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: trackId }) }
    fetch("./api/music/played", post).catch(() => {})
  },
  playUrl: (trackId: string) => (PREVIEW ? "" : "./api/music/play/" + trackId),
  coverUrl: (albumId: string) => "./api/music/cover/" + albumId,
}
