import type { Call, Snapshot } from "@/lib/types"
export function mockSnapshot(): Promise<Snapshot>
export function mockAct(calls: Call[]): Promise<void>
