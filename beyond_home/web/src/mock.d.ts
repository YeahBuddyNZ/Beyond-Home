import type { AppleHome, Call, PairedTv, FamilyLink, Snapshot } from "@/lib/types"
export function mockSnapshot(): Promise<Snapshot>
export function mockAct(calls: Call[]): Promise<void>
export function mockTvs(): Promise<PairedTv[]>
export function mockPairTv(code: string): Promise<PairedTv[]>
export function mockRemoveTv(id: string): Promise<PairedTv[]>
export function mockFamily(): Promise<FamilyLink>
export function mockLinkFamily(): Promise<FamilyLink>
export function mockUnlinkFamily(): Promise<FamilyLink>
import type { MusicLibrary, MusicWhere, Station } from "@/lib/types"
export function mockMusicWhere(): Promise<MusicWhere>
export function mockMusic(): Promise<MusicLibrary>
export function mockRadio(): Promise<Station[]>
export function mockApple(): Promise<AppleHome>
export function mockAppleDo(what: "start" | "refresh" | "stop"): Promise<AppleHome>
