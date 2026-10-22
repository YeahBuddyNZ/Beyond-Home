import { useCallback, useState } from "react"
import { toast } from "sonner"
import { home } from "@/api"
import type { Call, Snapshot } from "@/lib/types"
import { useEvery } from "./use-every"

// The whole house, asked again every few seconds while a screen is open, and a way to change it.
export function useHome() {
  const [snap, setSnap] = useState<Snapshot | null>(null)
  const [error, setError] = useState(false)

  const refresh = useCallback(async () => {
    try {
      setSnap(await home.snapshot())
      setError(false)
    } catch {
      setError(true)
    }
  }, [])
  useEvery(3000, refresh)

  const act = useCallback(
    async (calls: Call | Call[]) => {
      try {
        await home.act(calls)
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "That didn’t work. Try again.")
      }
      await refresh()
    },
    [refresh]
  )

  return { snap, error, act }
}
