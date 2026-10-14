export type SafeLogValue = string | number | boolean | null | undefined

export declare function SetStoreTTL(ttl: number): void
export declare function SetStored(value: boolean): void
export declare function SetStoredStackSize(value: number): void
export declare function SetUTC(value: boolean): void
export declare function SetAllow(allow: boolean): void
export declare function SetDebug(value: boolean): void
export declare function SetPriority(value: boolean): void

export declare class Debug {
  static startRecording(stage: string): void
  static getRecordName(): string | null
  static getOldRecordName(): string | null
  static stopRecording(force?: boolean): void
  static listRecordedLogs(stage?: string | null): SafeLogValue[][]
  static clearRecordedLogs(stage?: string | null): void
  static clearEmptyRecordedLogs(stage?: string | null): void
  static info(...args: any[]): void
  static priotiriedInfo(...args: any[]): void
  static allowedInfo(...args: any[]): void
  static warn(...args: any[]): void
  static allowedWarn(...args: any[]): void
  static error(...args: any[]): void
  static allowedError(...args: any[]): void
  static debug(...args: any[]): void
  static log(...args: any[]): void
  static dispose(): void
  static listStack(): SafeLogValue[]
}
