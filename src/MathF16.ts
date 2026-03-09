import {
  abs,
  divideF16 as divideF16Compat,
  roundfToInt,
} from './cpp.ts'

export class MathF16 {
  static readonly PiHalfF16 = 102944
  static readonly PiF16 = 205887

  private static divideF16(a: number, b: number): number {
    return divideF16Compat(a, b)
  }

  private static atanF16(angle: number): number {
    return roundfToInt(Math.atan(angle / 0xffff) * 65536)
  }

  static sinF16(angle: number): number {
    return roundfToInt(Math.sin(angle / 0xffff) * 65536)
  }

  static cosF16(angle: number): number {
    return MathF16.sinF16(MathF16.PiHalfF16 - angle)
  }

  static atan2F16(dx: number, dy: number): number {
    if (abs(dy) < 3) {
      return (dx > 0 ? 1 : -1) * MathF16.PiHalfF16
    }

    const atanVal = MathF16.atanF16(MathF16.divideF16(dx, dy))
    if (dx > 0) {
      return dy > 0 ? atanVal : MathF16.PiF16 + atanVal
    }

    return dy > 0 ? atanVal : atanVal - MathF16.PiF16
  }
}
