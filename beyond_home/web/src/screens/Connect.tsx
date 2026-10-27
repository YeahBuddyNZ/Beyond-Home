import { useEffect, useState } from "react"
import { LoaderCircleIcon, WifiOffIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Item, ItemContent, ItemDescription, ItemGroup, ItemMedia } from "@/components/ui/item"
import { Alert, AlertDescription, AlertTitle } from "@/components/reui/alert"
import { useEvery } from "@/hooks/use-every"
import { boxAddress } from "@/lib.js"
import { box, findBox, pairing, startPairing } from "@/phone"
import { Centred, Heading } from "./Centred"

type Step = { at: "looking" } | { at: "type"; missed?: string } | { at: "code"; code: string }

// The phone app's first screen: find the box on the house Wi-Fi, then pair once with a code typed on the box.
export function Connect({ onDone }: { onDone: () => void }) {
  const waiting = box()
  const [step, setStep] = useState<Step>(waiting?.code ? { at: "code", code: waiting.code } : { at: "looking" })
  const [address, setAddress] = useState("")
  const [problem, setProblem] = useState("")

  const pairWith = async (base: string) => {
    try {
      setStep({ at: "code", code: await startPairing(base) })
    } catch (e) {
      setStep({ at: "type", missed: e instanceof Error ? e.message : "The box didn’t answer." })
    }
  }

  useEffect(() => {
    if (step.at !== "looking") return
    findBox().then((base) => (base ? pairWith(base) : setStep({ at: "type" })))
  }, [step.at])

  useEvery(3000, async () => {
    if (step.at !== "code") return
    const now = await pairing().catch(() => "waiting" as const)
    if (now === "paired") onDone()
    if (now === "gone") setStep({ at: "looking" })
  })

  const tryTyped = async () => {
    const base = boxAddress(address)
    if (!base) return setProblem("That doesn’t look like an address in the house, like 192.168.1.20.")
    setProblem("")
    setStep({ at: "looking" })
    const found = await findBox(base)
    if (found) pairWith(found)
    else setStep({ at: "type", missed: "Nothing answered at " + address.trim() + "." })
  }

  if (step.at === "looking")
    return (
      <Centred>
        <Heading title="Looking for your Beyond Home box" lead="On your home Wi-Fi. This takes a few seconds." />
        <LoaderCircleIcon className="size-6 animate-spin text-muted-foreground motion-reduce:animate-none" aria-hidden="true" />
      </Centred>
    )

  if (step.at === "code")
    return (
      <Centred>
        <Heading title="Type this code on the box" lead="One time only, so the box knows this phone is yours." />
        <p className="rounded-lg border bg-muted py-4 text-center font-mono text-4xl font-semibold tracking-[0.3em]" aria-label={"Code " + step.code.split("").join(" ")}>
          {step.code}
        </p>
        <ItemGroup>
          {["On a computer or tablet at home, open Beyond Home.", "Go to Settings, then TVs and phones.", "Type the code and press Pair."].map((line, i) => (
            <Item key={line} variant="muted" size="sm">
              <ItemMedia variant="icon">{i + 1}</ItemMedia>
              <ItemContent>
                <ItemDescription>{line}</ItemDescription>
              </ItemContent>
            </Item>
          ))}
        </ItemGroup>
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <LoaderCircleIcon className="size-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />
          Waiting for the code. It works for ten minutes.
        </p>
      </Centred>
    )

  return (
    <Centred>
      <Heading title="Where’s your Beyond Home box?" lead="It didn’t answer by itself. Check this phone is on your home Wi-Fi, or type the box’s address." />
      {step.missed && (
        <Alert variant="warning">
          <WifiOffIcon />
          <AlertTitle>Couldn’t reach it</AlertTitle>
          <AlertDescription>{step.missed}</AlertDescription>
        </Alert>
      )}
      <form
        className="flex flex-col gap-3"
        onSubmit={(e) => {
          e.preventDefault()
          tryTyped()
        }}
      >
        <Field data-invalid={problem ? true : undefined}>
          <FieldLabel htmlFor="box-address">The box’s address</FieldLabel>
          <Input id="box-address" value={address} inputMode="url" autoComplete="off" autoCapitalize="none" placeholder="192.168.1.20" onChange={(e) => setAddress(e.target.value)} />
          {problem ? <FieldError>{problem}</FieldError> : <FieldDescription>Your router’s app lists it, or Settings on the box shows it.</FieldDescription>}
        </Field>
        <div className="flex flex-wrap gap-2">
          <Button type="submit" disabled={!address.trim()}>
            Connect
          </Button>
          <Button type="button" variant="outline" onClick={() => setStep({ at: "looking" })}>
            Look again
          </Button>
        </div>
      </form>
    </Centred>
  )
}
