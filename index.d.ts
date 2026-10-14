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
  static stopRecording(): void
  /** @deprecated The force argument is ignored; call stopRecording(). */
  static stopRecording(force: boolean): void
  static listRecordedLogs(stage?: string | null): SafeLogValue[][]
  static clearRecordedLogs(stage?: string | null): void
  /** Remove only empty records; omit stage or pass null to check all records. */
  static clearEmptyRecordedLogs(stage?: string | null): void
  static info(...args: any[]): void
  static prioritizedInfo(...args: any[]): void
  /** @deprecated Use Debug.prioritizedInfo(). */
  static priotiriedInfo(...args: any[]): void
  static allowedInfo(...args: any[]): void
  static warn(...args: any[]): void
  static allowedWarn(...args: any[]): void
  static error(...args: any[]): void
  static allowedError(...args: any[]): void
  static debug(...args: any[]): void
  static log(...args: any[]): void
  static cleanup(): void
  static listStack(): SafeLogValue[]
}
