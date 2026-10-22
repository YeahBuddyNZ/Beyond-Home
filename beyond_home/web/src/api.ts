// Talking to the box: only its own two routes (beyond_home/server/main.mjs), which talk to Home Assistant for us.
// Paths are relative, because Home Assistant serves the app under its own ingress address.
// ?preview swaps the box for the stand-in in mock.js, so the app can be looked at in a browser.

import type { Call, Snapshot } from "@/lib/types"

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
}
