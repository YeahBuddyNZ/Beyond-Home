import { PowerIcon, Volume1Icon, Volume2Icon, VolumeXIcon } from "lucide-react"
import * as lib from "@/lib.js"
import type { Call, Room } from "@/lib/types"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/reui/badge"

// One remote for the room, whatever is behind it: volume goes where the sound is coming from.
export function OneRemote({ room, act }: { room: Room; act: (c: Call | Call[]) => void }) {
  const target = lib.remoteTarget(room)
  const tv = room.things.find((t) => lib.kindOf(t) === "tv" && !lib.isAway(t))
  if (!target) return null
  const on = lib.isOn(target)
  const vol = lib.volumeOf(target)
  const muted = !!target.attributes.is_volume_muted
  const inputs = target.attributes.source_list ?? []
  const items = inputs.map((s) => ({ value: s, label: s }))

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between gap-3">
        <div className="flex flex-col gap-0.5">
          <span className="text-xs text-muted-foreground">Sound from</span>
          <span className="font-display text-lg font-semibold">{lib.thingName(target, room.name)}</span>
        </div>
        {on ? (
          <Badge variant="success-light">{muted ? "Muted" : vol != null ? "Volume " + vol : "On"}</Badge>
        ) : (
          <Badge variant="secondary">Off</Badge>
        )}
      </div>

      <div className="grid grid-cols-3 gap-3">
        <Button size="lg" variant="outline" className="h-16" aria-label="Volume down" disabled={!on} onClick={() => act(lib.volumeCall(target, false))}>
          <Volume1Icon className="size-6" />
        </Button>
        <Button size="lg" variant="outline" className="h-16" aria-label={muted ? "Sound back on" : "Mute"} disabled={!on} onClick={() => act(lib.muteCall(target))}>
          <VolumeXIcon className="size-6" />
        </Button>
        <Button size="lg" variant="outline" className="h-16" aria-label="Volume up" disabled={!on} onClick={() => act(lib.volumeCall(target, true))}>
          <Volume2Icon className="size-6" />
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        {tv && (
          <Button size="lg" variant={lib.isOn(tv) ? "outline" : "default"} onClick={() => act(lib.toggleCall(tv))}>
            <PowerIcon />
            {lib.isOn(tv) ? "TV off" : "TV on"}
          </Button>
        )}
        {target !== tv && (
          <Button size="lg" variant="outline" onClick={() => act(lib.toggleCall(target))}>
            <PowerIcon />
            {on ? lib.KIND_WORDS[lib.kindOf(target)] + " off" : lib.KIND_WORDS[lib.kindOf(target)] + " on"}
          </Button>
        )}
        {on && items.length > 0 && (
          <Select items={items} value={target.attributes.source ?? null} onValueChange={(v) => v && act(lib.sourceCall(target, v as string))}>
            <SelectTrigger className="h-9 min-w-40" aria-label="Watching or listening to">
              <SelectValue placeholder="Pick what to play" />
            </SelectTrigger>
            <SelectContent>
              {items.map((i) => (
                <SelectItem key={i.value} value={i.value}>
                  {i.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>
    </div>
  )
}
