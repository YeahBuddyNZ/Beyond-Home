import { ChevronLeftIcon, MinusIcon, PlusIcon } from "lucide-react"
import * as lib from "@/lib.js"
import type { Call, Thing } from "@/lib/types"
import { useHome } from "@/hooks/use-home"
import { Button, buttonVariants } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Item, ItemActions, ItemContent, ItemDescription, ItemGroup, ItemMedia, ItemTitle } from "@/components/ui/item"
import { Skeleton } from "@/components/ui/skeleton"
import { Switch } from "@/components/ui/switch"
import { Moments } from "@/components/moments"
import { OneRemote } from "@/components/one-remote"
import { ThingIcon } from "@/components/thing-icon"
import { PageTitle, Shell } from "./Shell"

function stateWords(t: Thing) {
  if (lib.isAway(t)) return "Not answering"
  const k = lib.kindOf(t)
  if (!lib.isOn(t)) return k === "blind" ? "Closed" : "Off"
  if (k === "light") return lib.brightnessOf(t) + "%"
  if (k === "heatpump") {
    const now = t.attributes.current_temperature
    return "Set to " + (t.attributes.temperature ?? "?") + "°" + (now != null ? ", it’s " + now + "° now" : "")
  }
  if (k === "blind") return "Open"
  return lib.showing(t) ?? "On"
}

function Steps({ onDown, onUp, label }: { onDown: () => void; onUp: () => void; label: string }) {
  return (
    <>
      <Button size="icon" variant="outline" aria-label={label + " down"} onClick={onDown}>
        <MinusIcon />
      </Button>
      <Button size="icon" variant="outline" aria-label={label + " up"} onClick={onUp}>
        <PlusIcon />
      </Button>
    </>
  )
}

function ThingRow({ t, roomName, act }: { t: Thing; roomName: string; act: (c: Call) => void }) {
  const k = lib.kindOf(t)
  const name = lib.thingName(t, roomName)
  return (
    <Item variant="outline">
      <ItemMedia variant="icon">
        <ThingIcon kind={k} />
      </ItemMedia>
      <ItemContent>
        <ItemTitle>{name}</ItemTitle>
        <ItemDescription>{stateWords(t)}</ItemDescription>
      </ItemContent>
      <ItemActions>
        {k === "light" && lib.isOn(t) && (
          <Steps label="Brightness" onDown={() => act(lib.dimCall(t, lib.brightnessOf(t) - 20))} onUp={() => act(lib.dimCall(t, lib.brightnessOf(t) + 20))} />
        )}
        {k === "heatpump" && lib.isOn(t) && <Steps label="Temperature" onDown={() => act(lib.warmerCall(t, -0.5))} onUp={() => act(lib.warmerCall(t, 0.5))} />}
        <Switch aria-label={name} checked={lib.isOn(t)} disabled={lib.isAway(t)} onCheckedChange={() => act(lib.toggleCall(t))} />
      </ItemActions>
    </Item>
  )
}

export function Room({ id }: { id: string }) {
  const { snap, act } = useHome()
  const room = snap?.rooms.find((r) => r.id === id)

  return (
    <Shell tab="home">
      <a href="#home" className={buttonVariants({ variant: "ghost", className: "self-start -ml-2" })}>
        <ChevronLeftIcon />
        Your home
      </a>
      {!snap ? (
        <Skeleton className="h-40 w-full" />
      ) : !room ? (
        <PageTitle title="That room has gone" lead="It may have been renamed. Go back to see your rooms." />
      ) : (
        <>
          <PageTitle title={room.name} lead={lib.roomSummary(room)} />
          <Moments room={room} act={act} size="default" />
          {lib.remoteTarget(room) && (
            <Card>
              <CardHeader>
                <CardTitle>Remote</CardTitle>
              </CardHeader>
              <CardContent>
                <OneRemote room={room} act={act} />
              </CardContent>
            </Card>
          )}
          <ItemGroup>
            {room.things.map((t) => (
              <ThingRow key={t.entity_id} t={t} roomName={room.name} act={act} />
            ))}
          </ItemGroup>
        </>
      )}
    </Shell>
  )
}
