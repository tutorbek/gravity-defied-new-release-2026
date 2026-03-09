import { Time } from './utils/Time.ts'

export class Timer {
  private readonly id: number
  private readonly startTimeMs: number
  private readonly timeoutMs: number

  constructor(id: number, timeoutMs: number) {
    this.id = id
    this.timeoutMs = timeoutMs
    this.startTimeMs = Time.currentTimeMillis()
  }

  ready(): boolean {
    return Time.currentTimeMillis() - this.startTimeMs > this.timeoutMs
  }

  getId(): number {
    return this.id
  }
}
