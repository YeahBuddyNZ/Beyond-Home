import { MusicIcon, PauseIcon, PlayIcon, SkipBackIcon, SkipForwardIcon } from "lucide-react"
import * as lib from "@/lib.js"
import { player, usePlayer } from "@/hooks/use-player"
import { Button } from "@/components/ui/button"

// What's playing, on every screen: above the tabs on a phone, along the bottom on a laptop.
export function MusicBar() {
  const { now, playing, time, length } = usePlayer()
  if (!now) return null
  return (
    <div className="fixed inset-x-0 bottom-[calc(4.25rem+env(safe-area-inset-bottom))] z-30 px-3 md:bottom-4 md:left-[15rem] md:px-8">
      <div className="mx-auto flex max-w-3xl items-center gap-3 rounded-2xl border bg-card/95 p-2 pr-3 shadow-lg backdrop-blur">
        <div className="grid size-12 shrink-0 place-items-center overflow-hidden rounded-lg bg-muted">
          {now.cover ? <img src={now.cover} alt="" className="size-full object-cover" /> : <MusicIcon className="size-5 text-muted-foreground" />}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{now.title}</p>
          <p className="truncate text-xs text-muted-foreground">
            {now.by}
            {length > 0 && ` · ${lib.clock(time)} of ${lib.clock(length)}`}
          </p>
        </div>
        <Button variant="ghost" size="icon" className="hidden size-11 sm:inline-flex" aria-label="Back" onClick={player.previous}>
          <SkipBackIcon />
        </Button>
        <Button size="icon" className="size-11 rounded-full" aria-label={playing ? "Pause" : "Play"} onClick={player.toggle}>
          {playing ? <PauseIcon /> : <PlayIcon />}
        </Button>
        <Button variant="ghost" size="icon" className="size-11" aria-label="Next" onClick={player.next}>
          <SkipForwardIcon />
        </Button>
      </div>
    </div>
  )
}
