import type { IGameMenuElement } from './IGameMenuElement.ts'
import { Micro } from './Micro.ts'
import { Font } from './lcdui/Font.ts'
import { Graphics } from './lcdui/Graphics.ts'

export class TextRender implements IGameMenuElement {
  private text: string
  private static defaultFont: Font
  private font: Font | null = null
  private dx = 0
  private static fieldMaxWidth = 100
  private static fieldMaxHeightUnused = 100
  private isDrawSprite = false
  private spriteNo = 0
  private readonly micro: Micro

  constructor(text: string, var2: Micro) {
    this.text = text
    this.micro = var2
  }

  static getBaselinePosition(): number {
    return TextRender.defaultFont.getBaselinePosition()
  }

  setFont(font: Font): void {
    this.font = font
  }

  static setDefaultFont(font: Font): void {
    TextRender.defaultFont = font
  }

  static setMaxArea(w: number, h: number): void {
    TextRender.fieldMaxWidth = w
    TextRender.fieldMaxHeightUnused = h
    void TextRender.fieldMaxHeightUnused
  }

  setText(text: string): void {
    this.text = text
  }

  isNotTextRender(): boolean {
    return false
  }

  menuElemMethod(_var1: number): void {}

  render(graphics: Graphics, y: number, x: number): void {
    const preservedFont = graphics.getFont()
    graphics.setFont(TextRender.defaultFont)
    if (this.font !== null) {
      graphics.setFont(this.font)
    }

    graphics.drawString(this.text, x + this.dx, y, Graphics.LEFT | Graphics.TOP)
    if (this.isDrawSprite && this.micro.gameCanvas !== null) {
      this.micro.gameCanvas.drawSprite(graphics, this.spriteNo, x, y)
    }

    graphics.setFont(preservedFont)
  }

  static makeMultilineTextRenders(text: string, micro: Micro): TextRender[] {
    let startPos = 0
    let endPos = 0
    const var4 = 25
    const vector: TextRender[] = []

    while (endPos < text.length) {
      let var6 = text.indexOf(' ', startPos)
      if (var6 === -1) {
        endPos = text.length
        var6 = text.length
      }

      while (endPos < text.length && TextRender.defaultFont.substringWidth(text, startPos, var6 - startPos) < TextRender.fieldMaxWidth - var4) {
        endPos = var6 + 1
        var6 = text.indexOf(' ', var6 + 1)
        if (var6 === -1) {
          if (TextRender.defaultFont.substringWidth(text, startPos, text.length - 1 - startPos) <= TextRender.fieldMaxWidth - var4) {
            endPos = text.length
          }
          break
        }
      }

      vector.push(new TextRender(text.substring(startPos, endPos), micro))
      startPos = ++endPos - 1
    }

    return vector
  }

  setDx(var1: number): void {
    this.dx = var1
  }

  setDrawSprite(isDrawSprite: boolean, spriteNo: number): void {
    this.isDrawSprite = isDrawSprite
    this.spriteNo = spriteNo
  }
}
