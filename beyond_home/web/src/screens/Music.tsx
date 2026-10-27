import { useEffect, useState } from "react"
import { ArrowLeftIcon, MusicIcon, PlayIcon, RadioIcon, SearchIcon, SettingsIcon, ShuffleIcon } from "lucide-react"
import * as lib from "@/lib.js"
import { home } from "@/api"
import { player, usePlayer } from "@/hooks/use-player"
import { Button, buttonVariants } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group"
import { Item, ItemActions, ItemContent, ItemDescription, ItemGroup, ItemMedia, ItemTitle } from "@/components/ui/item"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import type { MusicAlbum, MusicLibrary, MusicTrack, Playable, Station } from "@/lib/types"
import { PageTitle, Shell } from "./Shell"

// The family's own music: the albums on the Mac, Pi or box where Beyond Music runs, and New Zealand radio.
// #music, #music/radio, #music/album/<id>.

let cache: MusicLibrary | null = null

const song = (t: MusicTrack, album?: MusicAlbum): Playable => ({
  key: t.id,
  title: t.title,
  by: t.artist,
  src: home.playUrl(t.id),
  cover: album?.hasCover ? home.coverUrl(album.id) : undefined,
  trackId: t.id,
})

function Cover({ album, className }: { album: MusicAlbum; className?: string }) {
  return (
    <div className={"grid aspect-square place-items-center overflow-hidden rounded-xl bg-muted " + (className || "")}>
      {album.hasCover ? (
        <img src={home.coverUrl(album.id)} alt="" loading="lazy" className="size-full object-cover" />
      ) : (
        <MusicIcon className="size-8 text-muted-foreground/60" aria-hidden="true" />
      )}
    </div>
  )
}

export function Music({ id }: { id?: string }) {
  const [library, setLibrary] = useState<MusicLibrary | null>(cache)
  const [missing, setMissing] = useState(false)
  const [query, setQuery] = useState("")
  const [view, albumId] = (id || "").split(":")

  useEffect(() => {
    home.music().then(
      (l) => {
        cache = l
        setLibrary(l)
        setMissing(false)
      },
      () => setMissing(true),
    )
  }, [])

  const album = view === "album" ? library?.albums.find((a) => a.id === albumId) : undefined

  return (
    <Shell tab="music">
      {album && library ? (
        <AlbumView library={library} album={album} />
      ) : (
        <>
          <PageTitle title="Music" lead="Your own albums from the Mac or box they live on, and New Zealand radio." />
          <Tabs value={view === "radio" ? "radio" : "albums"} onValueChange={(v) => (location.hash = v === "radio" ? "music/radio" : "music")}>
            <TabsList>
              <TabsTrigger value="albums">
                <MusicIcon /> Albums
              </TabsTrigger>
              <TabsTrigger value="radio">
                <RadioIcon /> Radio
              </TabsTrigger>
            </TabsList>
          </Tabs>
          {missing && !library ? (
            <NotFound />
          ) : view === "radio" ? (
            <RadioView />
          ) : library == null ? (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
              {[0, 1, 2].map((i) => (
                <Skeleton key={i} className="aspect-square" />
              ))}
            </div>
          ) : (
            <AlbumsView library={library} query={query} setQuery={setQuery} />
          )}
        </>
      )}
    </Shell>
  )
}

function NotFound() {
  return (
    <Empty>
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <MusicIcon />
        </EmptyMedia>
        <EmptyTitle>Your music isn’t here yet</EmptyTitle>
        <EmptyDescription>
          Beyond Home plays the music on a Mac, a Raspberry Pi or this box once Beyond Music is running there. If it’s on
          a Mac, put the Mac’s address in Settings.
        </EmptyDescription>
      </EmptyHeader>
      <EmptyContent className="flex-row flex-wrap justify-center">
        <a href="#settings" className={buttonVariants()}>
          <SettingsIcon /> Settings
        </a>
        <a href="https://gobeyond.nz/home/music" target="_blank" rel="noreferrer" className={buttonVariants({ variant: "outline" })}>
          How to set it up
        </a>
      </EmptyContent>
    </Empty>
  )
}

function AlbumsView({ library, query, setQuery }: { library: MusicLibrary; query: string; setQuery: (q: string) => void }) {
  const albums = lib.findAlbums(library, query)
  const shuffle = () => {
    const all = library.tracks.slice()
    for (let i = all.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[all[i], all[j]] = [all[j], all[i]]
    }
    const byId = new Map(library.albums.map((a) => [a.id, a]))
    player.play(all.slice(0, 200).map((t) => song(t, byId.get(t.albumId))))
  }
  if (!library.albums.length)
    return (
      <Empty>
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <MusicIcon />
          </EmptyMedia>
          <EmptyTitle>No albums yet</EmptyTitle>
          <EmptyDescription>Beyond Music is running but hasn’t found any music. Open it on the Mac or box and pick your music folder.</EmptyDescription>
        </EmptyHeader>
      </Empty>
    )
  return (
    <>
      <div className="flex gap-2">
        <InputGroup className="h-11 flex-1">
          <InputGroupAddon>
            <SearchIcon />
          </InputGroupAddon>
          <InputGroupInput aria-label="Find an album, artist or song" placeholder="Find an album, artist or song" value={query} onChange={(e) => setQuery(e.target.value)} />
        </InputGroup>
        <Button variant="outline" size="lg" className="h-11" onClick={shuffle}>
          <ShuffleIcon /> Shuffle all
        </Button>
      </div>
      {albums.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nothing matches that. Try fewer words.</p>
      ) : (
        <div className="grid grid-cols-2 gap-x-4 gap-y-5 sm:grid-cols-3">
          {albums.map((a) => (
            <a key={a.id} href={"#music/album:" + a.id} className="group flex flex-col gap-2 rounded-xl outline-none focus-visible:ring-3 focus-visible:ring-ring/50">
              <Cover album={a} className="transition-transform group-hover:scale-[1.02]" />
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{a.title}</p>
                <p className="truncate text-xs text-muted-foreground">{a.artist}</p>
              </div>
            </a>
          ))}
        </div>
      )}
    </>
  )
}

function AlbumView({ library, album }: { library: MusicLibrary; album: MusicAlbum }) {
  const tracks = lib.albumTracks(library, album)
  const { now } = usePlayer()
  const queue = tracks.map((t) => song(t, album))
  const length = tracks.reduce((n, t) => n + (t.duration || 0), 0)
  return (
    <>
      <a href="#music" className={buttonVariants({ variant: "ghost" }) + " self-start"}>
        <ArrowLeftIcon /> Music
      </a>
      <div className="flex flex-col gap-5 sm:flex-row sm:items-end">
        <Cover album={album} className="w-48 shrink-0 shadow-md" />
        <div className="flex min-w-0 flex-col gap-3">
          <PageTitle title={album.title} lead={[album.artist, album.year, length ? lib.clock(length) : ""].filter(Boolean).join(" · ")} />
          <Button size="lg" className="self-start" onClick={() => player.play(queue)}>
            <PlayIcon /> Play
          </Button>
        </div>
      </div>
      <Card>
        <CardContent>
          <ItemGroup>
            {tracks.map((t, i) => (
              <Item key={t.id} size="sm" render={<button type="button" onClick={() => player.play(queue, i)} />} className="w-full text-left">
                <ItemMedia className="w-6 justify-center text-sm text-muted-foreground tabular-nums">{t.track || i + 1}</ItemMedia>
                <ItemContent>
                  <ItemTitle className={now?.key === t.id ? "text-primary" : undefined}>{t.title}</ItemTitle>
                  {t.artist !== album.artist && <ItemDescription>{t.artist}</ItemDescription>}
                </ItemContent>
                <ItemActions className="text-sm text-muted-foreground tabular-nums">{t.duration ? lib.clock(t.duration) : ""}</ItemActions>
              </Item>
            ))}
          </ItemGroup>
        </CardContent>
      </Card>
    </>
  )
}

function RadioView() {
  const [stations, setStations] = useState<Station[] | null>(null)
  const [failed, setFailed] = useState(false)
  const { now } = usePlayer()
  useEffect(() => {
    home.radio().then(setStations, () => setFailed(true))
  }, [])
  if (failed) return <p className="text-sm text-muted-foreground">The radio list didn’t load. It needs the internet; try again in a moment.</p>
  if (!stations) return <Skeleton className="h-48 w-full" />
  return (
    <ItemGroup>
      {stations.map((s) => (
        <Item
          key={s.id}
          variant="outline"
          render={<button type="button" onClick={() => player.play([{ key: "radio:" + s.id, title: s.name, by: s.town || "Live radio", src: s.url, cover: s.logo || undefined }])} />}
          className="w-full text-left"
        >
          <ItemMedia variant="icon">
            <RadioIcon />
          </ItemMedia>
          <ItemContent>
            <ItemTitle className={now?.key === "radio:" + s.id ? "text-primary" : undefined}>{s.name}</ItemTitle>
            <ItemDescription>{s.town || "Live radio"}</ItemDescription>
          </ItemContent>
        </Item>
      ))}
    </ItemGroup>
  )
}
