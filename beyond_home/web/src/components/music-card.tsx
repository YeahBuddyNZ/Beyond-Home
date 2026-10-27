import { useEffect, useState } from "react"
import { toast } from "sonner"
import { CircleCheckIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Alert, AlertTitle } from "@/components/reui/alert"
import { home } from "@/api"
import type { MusicWhere } from "@/lib/types"

// Where the family's music is. Found by itself on this box; a Mac needs its address typed once.
export function MusicCard() {
  const [where, setWhere] = useState<MusicWhere | null>(null)
  const [address, setAddress] = useState("")
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    home.musicWhere().then((w) => {
      setWhere(w)
      setAddress(w.address)
    }, () => {})
  }, [])

  const save = async () => {
    setBusy(true)
    try {
      const w = await home.setMusicWhere(address)
      setWhere(w)
      if (w.found) toast.success("Found your music.")
      else toast.error("Nothing answered there. Is Beyond Music running on that Mac?")
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "That didn’t work. Try again.")
    }
    setBusy(false)
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Music</CardTitle>
        <CardDescription>
          The Music tab plays the albums on the Mac, Raspberry Pi or box where Beyond Music runs. On this box it’s found by
          itself.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {where?.found && (
          <Alert variant="success">
            <CircleCheckIcon />
            <AlertTitle>Your music is connected</AlertTitle>
          </Alert>
        )}
        <form
          className="flex flex-col gap-3"
          onSubmit={(e) => {
            e.preventDefault()
            save()
          }}
        >
          <Field>
            <FieldLabel htmlFor="music-at">Where your music is</FieldLabel>
            <Input id="music-at" value={address} inputMode="url" autoComplete="off" placeholder="192.168.1.20" onChange={(e) => setAddress(e.target.value)} />
            <FieldDescription>Only for a Mac or another box. The Mac shows its address when Beyond Music starts. Leave it empty to look on this box.</FieldDescription>
          </Field>
          <Button type="submit" variant="outline" className="self-start" disabled={busy}>
            Save
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
