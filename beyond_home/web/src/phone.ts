// The Beyond Home phone app (vite build --mode phone, wrapped by app/ for the App Store). It isn't opened through
// Home Assistant, so it finds the box on the house network and pairs once by a code, the way Beyond TV does
// (server/tvs.mjs). The key is kept on the phone; the box keeps only its hash.

import { boxTries, phoneName } from "./lib.js"

export const PHONE = import.meta.env.MODE === "phone"

type Box = { base: string; key: string; code?: string }
const KEY = "bh.box"

export function box(): Box | null {
  try {
    const b = JSON.parse(localStorage.getItem(KEY) || "null")
    return b && typeof b.base === "string" && typeof b.key === "string" ? b : null
  } catch {
    return null
  }
}

const keep = (b: Box | null) => {
  try {
    if (b) localStorage.setItem(KEY, JSON.stringify(b))
    else localStorage.removeItem(KEY)
  } catch {}
}

// Where the box was last, kept even after forgetting it, so pairing again finds it first.
const LAST = "bh.box.last"
const lastBase = () => {
  try {
    return localStorage.getItem(LAST)
  } catch {
    return null
  }
}

async function isBox(base: string) {
  try {
    const res = await fetch(base + "/tv/hi", { cache: "no-store", signal: AbortSignal.timeout(2500) })
    return (await res.json()).beyond === "home"
  } catch {
    return false
  }
}

// Looks for the box at the usual names, or at the one address typed in. Answers its address, or null.
export async function findBox(typed?: string): Promise<string | null> {
  for (const base of typed ? [typed] : boxTries(lastBase())) if (await isBox(base)) return base
  return null
}

// Asks the box for a code to type in Beyond Home on the box. Answers the code.
export async function startPairing(base: string): Promise<string> {
  const res = await fetch(base + "/tv/hello", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: phoneName(navigator.userAgent), kind: "phone" }),
  })
  const p = await res.json()
  if (!res.ok) throw new Error(p.error || "The box didn’t answer.")
  keep({ base, key: p.id + "." + p.secret, code: p.code })
  try {
    localStorage.setItem(LAST, base)
  } catch {}
  return p.code
}

// 'paired' once the code has been typed on the box, 'waiting' until then, 'gone' when the box has said no.
export async function pairing(): Promise<"paired" | "waiting" | "gone"> {
  const b = box()
  if (!b) return "gone"
  const res = await fetch(b.base + "/phone/snapshot", { headers: { Authorization: "Bearer " + b.key }, cache: "no-store" })
  if (res.status === 200) {
    if (b.code) keep({ base: b.base, key: b.key })
    return "paired"
  }
  if (res.status === 202) return "waiting"
  if (res.status === 401) forget()
  return res.status === 401 ? "gone" : "waiting"
}

export const paired = () => {
  const b = box()
  return Boolean(b && !b.code)
}

// Lets go of the box on this phone, and tells the box when it can.
export function forget(tell = false) {
  const b = box()
  keep(null)
  if (tell && b) fetch(b.base + "/tv/bye", { method: "POST", headers: { Authorization: "Bearer " + b.key } }).catch(() => {})
}

// The box address and headers for one of the app's asks, e.g. "snapshot" or "music/library".
export function phoneAsk(path: string) {
  const b = box()
  return { url: (b?.base || "") + "/phone/" + path, headers: { Authorization: "Bearer " + (b?.key || "") } }
}

// Songs and covers: an <audio> or <img> can't send a header, so the key rides along as ?k=.
export const phoneMedia = (path: string) => {
  const b = box()
  return (b?.base || "") + "/phone/" + path + "?k=" + encodeURIComponent(b?.key || "")
}
