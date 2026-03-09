function toBigInt(value: bigint | number): bigint {
  if (typeof value === 'bigint') {
    return value
  }

  return BigInt(Math.trunc(value))
}

export const INT_MAX = 2147483647
export const INT_MIN = -2147483648

export function toInt(value: bigint | number): number {
  return Number(BigInt.asIntN(32, toBigInt(value)))
}

export function abs(value: number): number {
  return value < 0 ? -value : value
}

export function truncDiv(a: number, b: number): number {
  return toInt(toBigInt(a) / toBigInt(b))
}

export function multiplyF16(a: number, b: number): number {
  return toInt((toBigInt(a) * toBigInt(b)) >> 16n)
}

export function divideF16(a: number, b: number): number {
  return toInt(((toBigInt(a) << 32n) / toBigInt(b)) >> 16n)
}

export function roundfToInt(value: number): number {
  const rounded = Math.round(Math.abs(value))
  return value < 0 ? -rounded : rounded
}
