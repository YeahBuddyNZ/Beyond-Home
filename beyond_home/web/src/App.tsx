import { useEffect, useState } from "react"
import { Home } from "@/screens/Home"
import { Remote } from "@/screens/Remote"
import { Room } from "@/screens/Room"
import { Settings } from "@/screens/Settings"

// Screens by address: #home, #room/<id>, #remote, #remote/<id>, #settings.
const read = () => {
  const [screen, id] = location.hash.slice(1).split("/")
  return { screen: screen || "home", id: id ? decodeURIComponent(id) : undefined }
}

export function App() {
  const [at, setAt] = useState(read)
  useEffect(() => {
    const onHash = () => {
      setAt(read())
      window.scrollTo(0, 0)
    }
    window.addEventListener("hashchange", onHash)
    return () => window.removeEventListener("hashchange", onHash)
  }, [])

  if (at.screen === "room" && at.id) return <Room key={at.id} id={at.id} />
  if (at.screen === "remote") return <Remote id={at.id} />
  if (at.screen === "settings") return <Settings />
  return <Home />
}
