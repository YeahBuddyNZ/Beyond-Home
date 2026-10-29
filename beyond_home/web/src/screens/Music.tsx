import { useEffect, useState } from "react"
import { ArrowLeftIcon, CheckCircle2Icon, DownloadIcon, MusicIcon, PlayIcon, RadioIcon, SearchIcon, SettingsIcon, ShuffleIcon } from "lucide-react"
import * as lib from "@/lib.js"
import { home } from "@/api"
import { player, usePlayer } from "@/hooks/use-player"
import { KEEPS, keepAlbum, keptCover, keptIds, keptSong, letGo, loadKept, useKept } from "@/offline"
import { toast } from "sonner"
import { Alert, AlertDescription, AlertTitle } from "@/components/reui/alert"
import { Badge } from "@/components/reui/badge"
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
  src: keptSong(t.id) ?? home.playUrl(t.id),
  cover: album ? coverOf(album) : undefined,
  trackId: t.id,
})

// A kept album's cover comes from the phone, so it shows away from home too.
const coverOf = (album: MusicAlbum) => keptCover(album.id) ?? (album.hasCover ? home.coverUrl(album.id) : undefined)

function Cover({ album, className }: { album: MusicAlbum; className?: string }) {
  return (
    <div className={"grid aspect-square place-items-center overflow-hidden rounded-xl bg-muted " + (className || "")}>
      {coverOf(album) ? (
        <img src={coverOf(album)} alt="" loading="lazy" className="size-full object-cover" />
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
  const { kept } = useKept()

  useEffect(() => {
    if (KEEPS) loadKept()
    home.music().then(
      async (l) => {
        cache = l
        setLibrary(l)
        setMissing(false)
        // An album the box has let go (sold, given away, taken out) goes from the phone too.
        if (KEEPS) {
          await loadKept()
          for (const gone of lib.keptGone(keptIds(), l)) letGo(gone).catch(() => {})
        }
      },
      () => setMissing(true),
    )
  }, [])

  // Away from home the box can't be reached: the albums kept on this phone are the library.
  const away = KEEPS && missing && !library && kept.length > 0
  const shown = away ? lib.keptLibrary(kept) : library
  const album = view === "album" ? shown?.albums.find((a) => a.id === albumId) : undefined

  return (
    <Shell tab="music">
      {album && shown ? (
        <AlbumView library={shown} album={album} />
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
          {away ? (
            <>
              <Alert variant="info">
                <DownloadIcon />
                <AlertTitle>Away from home</AlertTitle>
                <AlertDescription>
                  {view === "radio" ? "Radio comes through the box, so it’s back on the home Wi-Fi. Your kept albums are under Albums." : "These are the albums kept on this phone. Everything else comes back on the home Wi-Fi."}
                </AlertDescription>
              </Alert>
              {view !== "radio" && <AlbumsView library={shown!} query={query} setQuery={setQuery} />}
            </>
          ) : missing && !library ? (
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
      {KEEPS && <KeptLine />}
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

function KeptLine() {
  const { kept } = useKept()
  if (!kept.length) return null
  const bytes = kept.reduce((n, k) => n + k.bytes, 0)
  return (
    <p className="text-sm text-muted-foreground">
      {kept.length === 1 ? "1 album" : `${kept.length} albums`} kept on this phone ({lib.sizeWords(bytes)}) to play away from home.
    </p>
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
          <div className="flex flex-wrap items-center gap-2">
            <Button size="lg" onClick={() => player.play(queue)}>
              <PlayIcon /> Play
            </Button>
            {KEEPS && <KeepButton album={album} tracks={tracks} />}
          </div>
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

// Keep an album on the phone to play away from home, or let it go again.
function KeepButton({ album, tracks }: { album: MusicAlbum; tracks: MusicTrack[] }) {
  const { kept, saving } = useKept()
  const here = kept.find((k) => k.album.id === album.id)
  if (saving?.albumId === album.id)
    return (
      <Button size="lg" variant="outline" disabled>
        <DownloadIcon /> Saving {saving.done} of {saving.total}
      </Button>
    )
  if (here)
    return (
      <>
        <Badge variant="success-light" size="xl">
          <CheckCircle2Icon /> On this phone, {lib.sizeWords(here.bytes)}
        </Badge>
        <Button size="lg" variant="ghost" onClick={() => letGo(album.id).then(() => toast.success("Taken off this phone."), () => toast.error("That didn’t work. Try again."))}>
          Let go
        </Button>
      </>
    )
  return (
    <Button
      size="lg"
      variant="outline"
      disabled={Boolean(saving)}
      onClick={() => keepAlbum(album, tracks).then(() => toast.success("Kept on this phone. It plays away from home now."), (e) => toast.error(e instanceof Error ? e.message : "That didn’t come across. Try again at home."))}
    >
      <DownloadIcon /> Keep on this phone
    </Button>
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
