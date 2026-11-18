import { useState } from "react"
import { toast } from "sonner"
import { Badge } from "@/components/reui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { home } from "@/api"
import { useEvery } from "@/hooks/use-every"
import type { AppleHome } from "@/lib/types"

// Apple Home (server/apple.mjs). Off until somebody taps Show in Apple Home. Then the rooms' things and moments show
// in Apple's Home app, on an Apple HomeView on the wall, and to Siri, and a moment pressed there is done by this box.
export function AppleCard() {
  const [apple, setApple] = useState<AppleHome | null>(null)
  const [busy, setBusy] = useState(false)

  // Every few seconds while the code is showing, so it turns to "In Apple Home" as soon as an iPhone adds it.
  useEvery(apple?.state === "pairing" ? 3000 : 60000, () => home.apple().then(setApple, () => {}))

  const run = async (what: "start" | "refresh" | "stop", done?: string) => {
    setBusy(true)
    try {
      setApple(await home.appleDo(what))
      if (done) toast.success(done)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "That didn’t work. Try again.")
    }
    setBusy(false)
  }

  const state = apple?.state ?? "off"
  const qr = state === "pairing" && apple?.qr ? home.appleQr() : ""
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center gap-2">
          Apple Home
          {state === "on" && (
            <Badge variant="success-light" radius="full">
              In Apple Home
            </Badge>
          )}
        </CardTitle>
        <CardDescription>
          {state === "on"
            ? `Your rooms are in Apple’s Home app, on an Apple HomeView and with Siri. Each room’s moments are buttons there too (${apple?.buttons ?? 0} of them): say “Hey Siri, Lounge Movie night”.`
            : "Put your rooms in Apple’s Home app, on an Apple HomeView on the wall, and on Siri. Each room’s moments come too, so “Hey Siri, Lounge Movie night” works. Everything still runs on this box."}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {state === "pairing" && (
          <div className="flex flex-col gap-3">
            {qr && (
              <>
                <p className="text-sm text-muted-foreground">On an iPhone or iPad signed in to your home, open the Camera and point it at this code:</p>
                <img src={qr} alt="Code to add Beyond Home to Apple Home" className="size-40 rounded-lg bg-white p-2" />
              </>
            )}
            <p className="text-sm text-muted-foreground">
              {qr ? "Or in" : "On an iPhone or iPad signed in to your home, open"} the Home app, tap +, then Add Accessory, then More options, pick the bridge it finds and type:
            </p>
            <p className="font-mono text-3xl font-semibold tracking-[0.2em]" aria-live="polite">
              {apple?.code}
            </p>
            <p className="text-xs text-muted-foreground">
              If it asks, tap Add Anyway: Beyond Home isn’t certified by Apple, and that’s fine. Apple puts everything in one room to start; move each into its room once in the Home app.
            </p>
          </div>
        )}
        {state === "on" && (
          <p className="text-xs text-muted-foreground">
            Added a room, a light or a TV? Tap Update so Apple Home has it too. Siri and Apple Home away from the house need an Apple home hub: an Apple HomeView, an Apple TV or a HomePod.
          </p>
        )}
        <div className="flex flex-wrap gap-2">
          {state === "off" && (
            <Button className="self-start" disabled={busy} onClick={() => run("start")}>
              Show in Apple Home
            </Button>
          )}
          {state === "on" && (
            <Button disabled={busy} onClick={() => run("refresh", "Apple Home is up to date.")}>
              Update Apple Home
            </Button>
          )}
          {state !== "off" && (
            <Button variant="outline" disabled={busy} onClick={() => run("stop", "Taken out of Apple Home.")}>
              Take out of Apple Home
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
