export type Thing = {
  entity_id: string
  state: string
  attributes: {
    friendly_name?: string
    device_class?: string
    volume_level?: number
    is_volume_muted?: boolean
    source?: string
    source_list?: string[]
    app_name?: string
    brightness?: number
    temperature?: number
    current_temperature?: number
  }
}
export type Room = { id: string; name: string; things: Thing[] }
export type Snapshot = { rooms: Room[]; time: number }
export type Call = { domain: string; service: string; data: Record<string, unknown> }
export type PairedTv = { id: string; name: string; added: number }

// The family's music, from the Beyond Music server through Beyond Home (server/music.mjs). Only what the tab uses.
export type MusicTrack = { id: string; title: string; artist: string; album: string; albumId: string; track?: number; disc?: number; duration?: number }
export type MusicAlbum = { id: string; title: string; artist: string; year?: number; hasCover: boolean; trackIds: string[]; added: number }
export type MusicLibrary = { name: string; albums: MusicAlbum[]; tracks: MusicTrack[]; recent: { id: string; at: number }[] }
export type Station = { id: string; name: string; url: string; logo: string; town: string; rnz: boolean }
export type MusicWhere = { address: string; found: boolean }
// What plays: a song from the music server, or a radio station's own stream.
export type Playable = { key: string; title: string; by: string; src: string; cover?: string; trackId?: string }
