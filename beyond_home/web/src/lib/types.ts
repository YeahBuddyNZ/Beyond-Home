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
