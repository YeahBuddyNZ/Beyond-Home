import type { Call, PairedTv, Snapshot } from "@/lib/types"
export function mockSnapshot(): Promise<Snapshot>
export function mockAct(calls: Call[]): Promise<void>
export function mockTvs(): Promise<PairedTv[]>
export function mockPairTv(code: string): Promise<PairedTv[]>
export function mockRemoveTv(id: string): Promise<PairedTv[]>
