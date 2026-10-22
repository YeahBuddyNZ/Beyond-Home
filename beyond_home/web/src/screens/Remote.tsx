import { TvIcon } from "lucide-react"
import * as lib from "@/lib.js"
import { useHome } from "@/hooks/use-home"
import { Card, CardContent } from "@/components/ui/card"
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { OneRemote } from "@/components/one-remote"
import { PageTitle, Shell } from "./Shell"

// The one remote: pick the room, and it works whatever is behind it.
export function Remote({ id }: { id?: string }) {
  const { snap, act } = useHome()
  const rooms = snap ? lib.sortRooms(snap.rooms).filter((r) => lib.remoteTarget(r)) : null
  const room = rooms?.find((r) => r.id === id) ?? rooms?.[0]

  return (
    <Shell tab="remote">
      <PageTitle title="Remote" lead="One remote for every room. Volume goes wherever the sound is coming from." />
      {rooms == null ? (
        <Skeleton className="h-56 w-full" />
      ) : !room ? (
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <TvIcon />
            </EmptyMedia>
            <EmptyTitle>No TVs or speakers yet</EmptyTitle>
            <EmptyDescription>When your TV, receiver or speakers are found, their remote is here.</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <>
          {rooms.length > 1 && (
            <Tabs value={room.id} onValueChange={(v) => (location.hash = "remote/" + encodeURIComponent(String(v)))}>
              <TabsList>
                {rooms.map((r) => (
                  <TabsTrigger key={r.id} value={r.id}>
                    {r.name}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
          )}
          <Card>
            <CardContent>
              <OneRemote room={room} act={act} />
            </CardContent>
          </Card>
        </>
      )}
    </Shell>
  )
}
