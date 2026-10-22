import { CloudOffIcon, HouseIcon } from "lucide-react"
import * as lib from "@/lib.js"
import { useHome } from "@/hooks/use-home"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import { Skeleton } from "@/components/ui/skeleton"
import { Alert, AlertDescription, AlertTitle } from "@/components/reui/alert"
import { Badge } from "@/components/reui/badge"
import { Moments } from "@/components/moments"
import { ThingIcon } from "@/components/thing-icon"
import { PageTitle, Shell } from "./Shell"

export function Home() {
  const { snap, error, act } = useHome()
  const rooms = snap ? lib.sortRooms(snap.rooms) : null
  const main = rooms?.find((r) => r.id !== "_elsewhere")

  return (
    <Shell tab="home">
      <PageTitle title="Your home" />

      {error && (
        <Alert variant="warning">
          <CloudOffIcon />
          <AlertTitle>Can’t reach your home right now</AlertTitle>
          <AlertDescription>It keeps trying by itself. Everything still works with its own remote.</AlertDescription>
        </Alert>
      )}

      {main && (
        <Card className="dark bg-[radial-gradient(circle_at_85%_0%,rgb(158_123_255/0.35),transparent_45%),linear-gradient(135deg,var(--color-void),var(--color-chrome))] text-foreground ring-0">
          <CardHeader>
            <CardTitle className="font-display text-xl">{main.name}</CardTitle>
            <CardDescription>{lib.roomSummary(main)}</CardDescription>
          </CardHeader>
          <CardContent>
            <Moments room={main} act={act} />
          </CardContent>
        </Card>
      )}

      {rooms == null ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <Skeleton className="h-28" />
          <Skeleton className="h-28" />
        </div>
      ) : rooms.length === 0 ? (
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <HouseIcon />
            </EmptyMedia>
            <EmptyTitle>No rooms yet</EmptyTitle>
            <EmptyDescription>Once your TV, sound and lights are found, they show here, room by room.</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {rooms.map((r) => {
            const on = r.things.filter(lib.isOn)
            return (
              <a key={r.id} href={"#room/" + encodeURIComponent(r.id)} className="rounded-xl outline-none focus-visible:ring-3 focus-visible:ring-ring/50">
                <Card className="h-full transition-colors hover:bg-accent/40">
                  <CardHeader>
                    <CardTitle>{r.name}</CardTitle>
                    <CardDescription>{lib.roomSummary(r)}</CardDescription>
                  </CardHeader>
                  <CardContent className="flex flex-wrap items-center gap-2">
                    {r.things.map((t) => (
                      <ThingIcon key={t.entity_id} kind={lib.kindOf(t)} className={lib.isOn(t) ? "size-5 text-primary" : "size-5 text-muted-foreground/60"} />
                    ))}
                    {on.length > 0 && (
                      <Badge variant="primary-light" className="ml-auto">
                        {on.length} on
                      </Badge>
                    )}
                  </CardContent>
                </Card>
              </a>
            )
          })}
        </div>
      )}
    </Shell>
  )
}
