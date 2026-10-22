import { Card, CardContent } from "@/components/ui/card"
import { Wordmark } from "@/components/brand"

// The welcome, sign-in and can't-reach screens: one card on paper with Beyond's violet glow behind it.
export function Centred({ children }: { children: React.ReactNode }) {
  return (
    <main className="grid min-h-dvh place-items-center bg-[radial-gradient(circle_at_15%_20%,rgb(110_61_219/0.16),transparent_40%),radial-gradient(circle_at_85%_80%,rgb(158_123_255/0.14),transparent_40%)] px-4 py-8">
      <Card className="w-full max-w-md">
        <CardContent className="flex flex-col gap-6">
          <Wordmark />
          {children}
        </CardContent>
      </Card>
    </main>
  )
}

export function Heading({ title, lead }: { title: string; lead?: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <h1 className="text-2xl font-semibold tracking-tight text-balance">{title}</h1>
      {lead && <p className="text-muted-foreground">{lead}</p>}
    </div>
  )
}
