// Types for lib.js, which stays plain JavaScript so node --test can run it with no build (tests/web.test.mjs).
import type { Call, Room, Thing } from "@/lib/types"
export type Kind = "tv" | "receiver" | "speaker" | "light" | "heatpump" | "fan" | "blind" | "plug" | "other"
export type Moment = { id: string; name: string; lead: string }
export function domainOf(id: string): string
export function kindOf(t: Thing): Kind
export const KIND_WORDS: Record<Kind, string>
export function thingName(t: Thing, roomName?: string): string
export function isOn(t: Thing): boolean
export function isAway(t: Thing): boolean
export function volumeOf(t: Thing): number | null
export function showing(t: Thing): string | null
export function roomSummary(room: Room): string
export function remoteTarget(room: Room): Thing | null
export function tvInput(receiver: Thing): string | null
export function toggleCall(t: Thing): Call
export function volumeCall(t: Thing, up: boolean): Call
export function muteCall(t: Thing): Call
export function sourceCall(t: Thing, source: string): Call
export function warmerCall(t: Thing, step: number): Call
export function dimCall(t: Thing, pct: number): Call
export function brightnessOf(t: Thing): number
export const MOMENTS: Moment[]
export function momentCalls(id: string, room: Room): Call[]
export function momentsFor(room: Room): Moment[]
export function sortRooms(rooms: Room[]): Room[]
import type { MusicAlbum, MusicLibrary, MusicTrack } from "@/lib/types"
export function albumTracks(library: MusicLibrary | null, album: MusicAlbum | null | undefined): MusicTrack[]
export function albumsToShow(library: MusicLibrary | null): MusicAlbum[]
export function clock(seconds: number | undefined): string
export function findAlbums(library: MusicLibrary | null, query: string): MusicAlbum[]
