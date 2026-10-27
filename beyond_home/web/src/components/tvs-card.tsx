import { useEffect, useState } from "react"
import { toast } from "sonner"
import { SmartphoneIcon, TvIcon, XIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Item, ItemActions, ItemContent, ItemDescription, ItemGroup, ItemMedia, ItemTitle } from "@/components/ui/item"
import { home } from "@/api"
import type { PairedTv } from "@/lib/types"

// Beyond TV on the TVs in the house, and the Beyond Home phone app: each shows a code, somebody types it here.
export function TvsCard() {
  const [tvs, setTvs] = useState<PairedTv[] | null>(null)
  const [code, setCode] = useState("")
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    home.tvs().then(setTvs, () => setTvs([]))
  }, [])

  const pair = async () => {
    setBusy(true)
    try {
      setTvs(await home.pairTv(code))
      setCode("")
      toast.success("Paired. Your rooms show there in a few seconds.")
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "That didn’t work. Try again.")
    }
    setBusy(false)
  }

  const remove = async (tv: PairedTv) => {
    try {
      setTvs(await home.removeTv(tv.id))
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "That didn’t work. Try again.")
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>TVs and phones</CardTitle>
        <CardDescription>
          Beyond TV shows your rooms, Moments and the one remote right on the TV, and the Beyond Home phone app does the
          same on a phone. Open Beyond TV and go to Home, or open the phone app at home: each shows a code. Type it here.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {tvs && tvs.length > 0 && (
          <ItemGroup>
            {tvs.map((tv) => (
              <Item key={tv.id} variant="outline" size="sm">
                <ItemMedia variant="icon">
                  {tv.kind === "phone" ? <SmartphoneIcon /> : <TvIcon />}
                </ItemMedia>
                <ItemContent>
                  <ItemTitle>{tv.name}</ItemTitle>
                  <ItemDescription>Paired {new Date(tv.added).toLocaleDateString("en-NZ")}</ItemDescription>
                </ItemContent>
                <ItemActions>
                  <Button variant="ghost" size="icon" className="size-11" aria-label={"Take " + tv.name + " off"} onClick={() => remove(tv)}>
                    <XIcon />
                  </Button>
                </ItemActions>
              </Item>
            ))}
          </ItemGroup>
        )}
        <form
          className="flex flex-col gap-3"
          onSubmit={(e) => {
            e.preventDefault()
            if (code.trim()) pair()
          }}
        >
          <Field>
            <FieldLabel htmlFor="tv-code">Code on the TV or phone</FieldLabel>
            <Input
              id="tv-code"
              value={code}
              maxLength={12}
              autoComplete="off"
              autoCapitalize="characters"
              placeholder="ABC234"
              className="font-mono uppercase tracking-widest"
              onChange={(e) => setCode(e.target.value)}
            />
            <FieldDescription>The code works for ten minutes. Taking one off here stops it straight away.</FieldDescription>
          </Field>
          <Button type="submit" className="self-start" disabled={busy || !code.trim()}>
            Pair
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
