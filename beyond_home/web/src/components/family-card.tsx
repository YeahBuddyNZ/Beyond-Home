import { useState } from "react"
import { toast } from "sonner"
import { Badge } from "@/components/reui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { home } from "@/api"
import { useEvery } from "@/hooks/use-every"
import type { FamilyLink } from "@/lib/types"

// Beyond Family, for the grown-ups away from home (server/family.mjs). Off until somebody taps Link here: until then
// the box says nothing to the internet. Once linked, the Beyond Family app shows the rooms and can ask for the same
// things a TV can: a moment, the sound, power, one thing on or off.
export function FamilyCard() {
  const [link, setLink] = useState<FamilyLink | null>(null)
  const [busy, setBusy] = useState(false)

  // Every few seconds while a code is showing, so it turns to "Linked" as soon as it is typed in.
  useEvery(link?.state === "waiting" ? 3000 : 60000, () => home.family().then(setLink, () => {}))

  const run = async (fn: () => Promise<FamilyLink>) => {
    setBusy(true)
    try {
      setLink(await fn())
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "That didn’t work. Try again.")
    }
    setBusy(false)
  }

  const state = link?.state ?? "off"
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center gap-2">
          Beyond™ Family
          {state === "linked" && (
            <Badge variant="success-light" radius="full">
              Linked
            </Badge>
          )}
        </CardTitle>
        <CardDescription>
          {state === "linked"
            ? `Linked to ${link?.household || "your household"}. The grown-ups can see the rooms in the Beyond Family app from anywhere, and start a moment, turn the sound down or switch something off.`
            : "See your rooms from anywhere in the Beyond Family app, and switch things off when you’re out. Only the grown-ups in your household can, and only the same things a TV can do. Nothing leaves this box until you link it."}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {state === "waiting" && link?.code && (
          <div className="flex flex-col gap-1">
            <p className="text-sm text-muted-foreground">In the Beyond Family app, go to Family, then Your home, and type:</p>
            <p className="font-mono text-3xl font-semibold tracking-[0.3em]" aria-live="polite">
              {link.code}
            </p>
            <p className="text-xs text-muted-foreground">Works for {link.minutes} more minute{link.minutes === 1 ? "" : "s"}.</p>
          </div>
        )}
        {state === "linked" ? (
          <Button variant="outline" className="self-start" disabled={busy} onClick={() => run(home.unlinkFamily)}>
            Unlink
          </Button>
        ) : (
          <Button className="self-start" disabled={busy} onClick={() => run(home.linkFamily)}>
            {state === "waiting" ? "Get a new code" : "Link to Beyond™ Family"}
          </Button>
        )}
      </CardContent>
    </Card>
  )
}
