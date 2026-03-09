import { Font } from './Font.ts'

export class FontStorage {
  private static fontsMap = new Map<string, Font>()

  static getFont(style: string, size: number): Font {
    const key = `${style}:${size}`
    const existing = FontStorage.fontsMap.get(key)
    if (existing !== undefined) {
      return existing
    }

    const font = new Font(style, size)
    FontStorage.fontsMap.set(key, font)
    return font
  }

  static clearAll(): void {
    FontStorage.fontsMap.clear()
  }
}
