export class Time {
  static currentTimeMillis(): number {
    return Date.now()
  }

  static sleep(ms: number): Promise<void> {
    return new Promise((resolve) => {
      window.setTimeout(resolve, ms)
    })
  }
}
