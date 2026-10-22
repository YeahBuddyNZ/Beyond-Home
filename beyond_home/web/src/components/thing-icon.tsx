import { BlindsIcon, FanIcon, LightbulbIcon, PlugIcon, RadioReceiverIcon, SpeakerIcon, ThermometerIcon, TvIcon, CircleIcon } from "lucide-react"
import type { Kind } from "@/lib.js"

const ICONS = { tv: TvIcon, receiver: RadioReceiverIcon, speaker: SpeakerIcon, light: LightbulbIcon, heatpump: ThermometerIcon, fan: FanIcon, blind: BlindsIcon, plug: PlugIcon, other: CircleIcon }

export function ThingIcon({ kind, className }: { kind: Kind; className?: string }) {
  const Icon = ICONS[kind] ?? CircleIcon
  return <Icon aria-hidden="true" className={className} />
}
