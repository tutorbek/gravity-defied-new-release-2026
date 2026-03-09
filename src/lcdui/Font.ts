export class Font {
  static readonly SIZE_SMALL = 8
  static readonly SIZE_MEDIUM = 0
  static readonly SIZE_LARGE = 16

  static readonly STYLE_PLAIN = 'normal'
  static readonly STYLE_BOLD = 'bold'
  static readonly STYLE_ITALIC = 'italic'

  static readonly FACE_SYSTEM = 0

  private static measureCanvas: HTMLCanvasElement | null = null
  private static measureCtx: CanvasRenderingContext2D | null = null

  private readonly cssFont: string
  private readonly height: number

  constructor(style: string, pointSize: number) {
    this.height = Font.getRealFontSize(pointSize)
    this.cssFont = `${style} ${this.height}px "Trebuchet MS", "Segoe UI", sans-serif`
  }

  getBaselinePosition(): number {
    return this.height
  }

  getHeight(): number {
    return this.height
  }

  getCssFont(): string {
    return this.cssFont
  }

  charWidth(c: string): number {
    return this.stringWidth(c.slice(0, 1))
  }

  stringWidth(s: string): number {
    const ctx = Font.getMeasureCtx()
    ctx.font = this.cssFont
    return Math.ceil(ctx.measureText(s).width)
  }

  substringWidth(string: string, offset: number, len: number): number {
    return this.stringWidth(string.substring(offset, offset + len))
  }

  private static getMeasureCtx(): CanvasRenderingContext2D {
    if (Font.measureCtx !== null) {
      return Font.measureCtx
    }

    Font.measureCanvas = document.createElement('canvas')
    Font.measureCtx = Font.measureCanvas.getContext('2d')
    if (Font.measureCtx === null) {
      throw new Error('Canvas 2D context is not available')
    }

    return Font.measureCtx
  }

  private static getRealFontSize(size: number): number {
    switch (size) {
      case Font.SIZE_LARGE:
        return 32
      case Font.SIZE_MEDIUM:
        return 16
      case Font.SIZE_SMALL:
        return 12
      default:
        throw new Error(`unknown font size: ${size}`)
    }
  }
}
