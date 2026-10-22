import { useEffect, useRef } from "react"

// Runs fn now and then every ms while the screen is open, and stops when it closes.
export function useEvery(ms: number, fn: () => void | Promise<void>) {
  const latest = useRef(fn)
  latest.current = fn
  useEffect(() => {
    let live = true
    const run = () => live && void latest.current()
    run()
    const t = setInterval(run, ms)
    return () => {
      live = false
      clearInterval(t)
    }
  }, [ms])
}
