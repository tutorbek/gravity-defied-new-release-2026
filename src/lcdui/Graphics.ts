import { Image } from './Image.ts'
import { Font } from './Font.ts'

type ClipRect = {
  x: number
  y: number
  w: number
  h: number
}

export class Graphics {
  static readonly HCENTER = 1
  static readonly VCENTER = 2
  static readonly LEFT = 4
  static readonly RIGHT = 8
  static readonly TOP = 16
  static readonly BOTTOM = 32
  static readonly BASELINE = 64

  private readonly ctx: CanvasRenderingContext2D
  private font: Font = new Font(Font.STYLE_PLAIN, Font.SIZE_MEDIUM)
  private currentColor = 'rgb(0 0 0)'
  private clipRect: ClipRect | null = null

  constructor(ctx: CanvasRenderingContext2D) {
    this.ctx = ctx
    this.ctx.lineWidth = 1
    this.ctx.textRendering = 'geometricPrecision'
    this.ctx.imageSmoothingEnabled = false
  }

  drawString(s: string, x: number, y: number, anchor: number): void {
    this.ctx.font = this.font.getCssFont()
    this.ctx.fillStyle = this.currentColor

    const metrics = this.ctx.measureText(s)
    const width = Math.ceil(metrics.width)
    const ascent = Math.ceil(metrics.actualBoundingBoxAscent || 12)
    const descent = Math.ceil(metrics.actualBoundingBoxDescent || 4)
    const drawX = Graphics.getAnchorX(x, width, anchor)
    const baselineY = Graphics.getAnchorTextY(y, ascent, descent, anchor)

    this.withClip(() => {
      this.ctx.fillText(s, drawX, baselineY)
    })
  }

  setColor(r: number, g: number, b: number): void {
    this.currentColor = `rgb(${r} ${g} ${b})`
    this.ctx.fillStyle = this.currentColor
    this.ctx.strokeStyle = this.currentColor
  }

  setFont(font: Font): void {
    this.font = font
  }

  getFont(): Font {
    return this.font
  }

  drawChar(c: string, x: number, y: number, anchor: number): void {
    this.drawString(c.slice(0, 1), x, y, anchor)
  }

  setClip(x: number, y: number, w: number, h: number): void {
    this.clipRect = { x, y, w, h }
  }

  fillRect(x: number, y: number, w: number, h: number): void {
    this.withClip(() => {
      this.ctx.fillRect(x, y, w, h)
    })
  }

  drawLine(x1: number, y1: number, x2: number, y2: number): void {
    this.withClip(() => {
      this.ctx.beginPath()
      this.ctx.moveTo(x1, y1)
      this.ctx.lineTo(x2, y2)
      this.ctx.stroke()
    })
  }

  drawArc(x: number, y: number, width: number, heigth: number, startAngle: number, arcAngle: number): void {
    const xradius = Math.trunc(width / 2)
    const yradius = Math.trunc(heigth / 2)
    x += xradius
    y += yradius
    if (xradius === 0 && yradius === 0) {
      return
    }

    this.withClip(() => {
      for (let angle = startAngle; angle < startAngle + arcAngle; ++angle) {
        this.drawLine(
          x + Math.trunc(xradius * Math.cos((angle * Math.PI) / 180)),
          y - Math.trunc(yradius * Math.sin((angle * Math.PI) / 180)),
          x + Math.trunc(xradius * Math.cos(((angle + 1) * Math.PI) / 180)),
          y - Math.trunc(yradius * Math.sin(((angle + 1) * Math.PI) / 180)),
        )
      }
    })
  }

  drawImage(image: Image, x: number, y: number, anchor: number): void {
    const width = image.getWidth()
    const height = image.getHeight()
    const drawX = Graphics.getAnchorX(x, width, anchor)
    const drawY = Graphics.getAnchorY(y, height, anchor)

    this.withClip(() => {
      this.ctx.drawImage(image.getElement(), drawX, drawY)
    })
  }

  private withClip(draw: () => void): void {
    if (this.clipRect === null) {
      draw()
      return
    }

    this.ctx.save()
    this.ctx.beginPath()
    this.ctx.rect(this.clipRect.x, this.clipRect.y, this.clipRect.w, this.clipRect.h)
    this.ctx.clip()
    draw()
    this.ctx.restore()
  }

  static getAnchorX(x: number, size: number, anchor: number): number {
    if ((anchor & Graphics.LEFT) !== 0) {
      return x
    }

    if ((anchor & Graphics.RIGHT) !== 0) {
      return x - size
    }

    if ((anchor & Graphics.HCENTER) !== 0) {
      return x - (size >> 1)
    }

    throw new Error(`unknown xanchor = ${anchor}`)
  }

  static getAnchorY(y: number, size: number, anchor: number): number {
    if ((anchor & Graphics.TOP) !== 0) {
      return y
    }

    if ((anchor & Graphics.BOTTOM) !== 0) {
      return y - size
    }

    if ((anchor & Graphics.VCENTER) !== 0) {
      return y - (size >> 1)
    }

    if ((anchor & Graphics.BASELINE) !== 0) {
      return y - size
    }

    throw new Error(`unknown yanchor = ${anchor}`)
  }

  static getAnchorTextY(y: number, ascent: number, descent: number, anchor: number): number {
    if ((anchor & Graphics.TOP) !== 0) {
      return y + ascent
    }

    if ((anchor & Graphics.BOTTOM) !== 0) {
      return y - descent
    }

    if ((anchor & Graphics.VCENTER) !== 0) {
      return y + ((ascent - descent) >> 1)
    }

    if ((anchor & Graphics.BASELINE) !== 0) {
      return y
    }

    throw new Error(`unknown yanchor = ${anchor}`)
  }
}
