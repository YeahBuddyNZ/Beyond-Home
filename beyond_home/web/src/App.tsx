import { useEffect, useState } from "react"
import { Home } from "@/screens/Home"
import { Music } from "@/screens/Music"
import { Remote } from "@/screens/Remote"
import { Room } from "@/screens/Room"
import { Settings } from "@/screens/Settings"
import { Connect } from "@/screens/Connect"
import { PHONE, paired } from "@/phone"

// Screens by address: #home, #room/<id>, #remote, #remote/<id>, #music, #music/<view>, #settings.
const read = () => {
  const [screen, id] = location.hash.slice(1).split("/")
  return { screen: screen || "home", id: id ? decodeURIComponent(id) : undefined }
}

export function App() {
  const [at, setAt] = useState(read)
  const [linked, setLinked] = useState(() => !PHONE || paired())
  useEffect(() => {
    const onHash = () => {
      setAt(read())
      window.scrollTo(0, 0)
    }
    window.addEventListener("hashchange", onHash)
    return () => window.removeEventListener("hashchange", onHash)
  }, [])

  // The phone app pairs with the box first (src/phone.ts); through Home Assistant it already knows who you are.
  if (!linked) return <Connect onDone={() => setLinked(true)} />
  if (at.screen === "room" && at.id) return <Room key={at.id} id={at.id} />
  if (at.screen === "remote") return <Remote id={at.id} />
  if (at.screen === "music") return <Music id={at.id} />
  if (at.screen === "settings") return <Settings />
  return <Home />
}
