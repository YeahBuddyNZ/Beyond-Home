import { HouseIcon, MusicIcon, SettingsIcon, TvMinimalPlayIcon } from "lucide-react"
import { cn } from "cn"
import { buttonVariants } from "@/components/ui/button"
import { Wordmark } from "@/components/brand"
import { MusicBar } from "@/components/music-bar"
import { usePlayer } from "@/hooks/use-player"

export const TABS = [
  ["home", "Home", HouseIcon],
  ["remote", "Remote", TvMinimalPlayIcon],
  ["music", "Music", MusicIcon],
  ["settings", "Settings", SettingsIcon],
] as const

export type Tab = (typeof TABS)[number][0]

// Signed in: the side menu on a laptop, a tab bar along the bottom on a phone.
export function Shell({ tab, children }: { tab: Tab; children: React.ReactNode }) {
  const { now } = usePlayer()
  return (
    <div className="min-h-dvh md:grid md:grid-cols-[15rem_1fr]">
      <aside className="hidden border-r bg-card md:flex md:flex-col md:gap-8 md:px-4 md:py-6">
        <Wordmark className="px-2" />
        <nav aria-label="Sections" className="flex flex-col gap-1">
          {TABS.map(([id, label, Icon]) => (
            <a
              key={id}
              href={"#" + id}
              aria-current={id === tab ? "page" : undefined}
              className={cn(
                buttonVariants({ variant: "ghost", size: "lg" }),
                "justify-start",
                id === tab && "bg-accent text-accent-foreground hover:bg-accent hover:text-accent-foreground"
              )}
            >
              <Icon aria-hidden="true" />
              {label}
            </a>
          ))}
        </nav>
      </aside>

      <main className={cn("mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 pt-4 md:px-8 md:pt-8", now ? "pb-48 md:pb-28" : "pb-28 md:pb-8")}>
        <header className="md:hidden">
          <Wordmark short className="text-base" />
        </header>
        {children}
      </main>

      <MusicBar />

      <nav
        aria-label="Sections"
        className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-4 border-t bg-card/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
      >
        {TABS.map(([id, label, Icon]) => (
          <a
            key={id}
            href={"#" + id}
            aria-current={id === tab ? "page" : undefined}
            className={cn(
              "flex flex-col items-center gap-1 py-2.5 text-xs font-medium text-muted-foreground transition-colors",
              id === tab && "text-accent-foreground"
            )}
          >
            <Icon aria-hidden="true" className="size-5" />
            {label}
          </a>
        ))}
      </nav>
    </div>
  )
}

export function PageTitle({ title, lead }: { title: string; lead?: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
      {lead && <p className="text-sm text-muted-foreground">{lead}</p>}
    </div>
  )
}
