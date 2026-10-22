import { ClapperboardIcon, MoonIcon, PowerOffIcon, SunriseIcon } from "lucide-react"
import * as lib from "@/lib.js"
import type { Call, Room } from "@/lib/types"
import { Button } from "@/components/ui/button"

const ICONS: Record<string, typeof MoonIcon> = { movie: ClapperboardIcon, morning: SunriseIcon, bedtime: MoonIcon, off: PowerOffIcon }

// One tap that sets the room up. Only the moments that fit the room are shown.
export function Moments({ room, act, size = "lg" }: { room: Room; act: (c: Call[]) => void; size?: "default" | "lg" }) {
  const list = lib.momentsFor(room)
  if (!list.length) return null
  return (
    <div className="flex flex-wrap gap-2">
      {list.map((m, i) => {
        const Icon = ICONS[m.id] ?? PowerOffIcon
        return (
          <Button key={m.id} size={size} variant={i === 0 ? "default" : "secondary"} title={m.lead} onClick={() => act(lib.momentCalls(m.id, room))}>
            <Icon />
            {m.name}
          </Button>
        )
      })}
    </div>
  )
}
