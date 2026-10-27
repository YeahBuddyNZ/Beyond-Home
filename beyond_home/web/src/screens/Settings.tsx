import { ExternalLinkIcon } from "lucide-react"
import { buttonVariants } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { TvsCard } from "@/components/tvs-card"
import { MusicCard } from "@/components/music-card"
import { PageTitle, Shell } from "./Shell"
import { PhoneCard } from "@/components/phone-card"
import { PHONE } from "@/phone"

export function Settings() {
  return (
    <Shell tab="settings">
      <PageTitle title="Settings" />
      {PHONE ? <PhoneCard /> : <TvsCard />}
      {!PHONE && <MusicCard />}
      <Card>
        <CardHeader>
          <CardTitle>Rooms</CardTitle>
          <CardDescription>
            Beyond Home groups everything by room. To move a light or a TV to another room, or add a new room, use the
            advanced screens below: Settings, then Areas.
          </CardDescription>
        </CardHeader>
      </Card>
      {!PHONE && (
      <Card>
        <CardHeader>
          <CardTitle>Advanced</CardTitle>
          <CardDescription>
            Beyond Home runs on Home Assistant. Its own screens are still there for adding new gear and anything Beyond
            Home doesn’t do yet.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <a href="/" target="_top" className={buttonVariants({ variant: "outline" })}>
            Open Home Assistant
            <ExternalLinkIcon />
          </a>
        </CardContent>
      </Card>
      )}
      <p className="text-xs text-muted-foreground">Beyond™ Home {__APP_VERSION__}. Free for homes, always.</p>
    </Shell>
  )
}
