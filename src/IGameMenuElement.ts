import type { Graphics } from './lcdui/Graphics.ts'

export interface IGameMenuElement {
  setText(text: string): void
  render(graphics: Graphics, y: number, x: number): void
  isNotTextRender(): boolean
  menuElemMethod(var1: number): void
}
