import type { IGameMenuElement } from './IGameMenuElement.ts'
import type { GameMenu } from './GameMenu.ts'
import type { IMenuManager } from './IMenuManager.ts'
import { Graphics } from './lcdui/Graphics.ts'

export class TimerOrMotoPartOrMenuElem implements IGameMenuElement {
  private text = ''
  private targetMenu: GameMenu | null = null
  private menuManager: IMenuManager | null = null

  xF16 = 0
  yF16 = 0
  angleF16 = 0
  velocityXF16 = 0
  velocityYF16 = 0
  angularVelocityF16 = 0
  forceXF16 = 0
  forceYF16 = 0
  torqueF16 = 0
  timerNo = 0
  micro: unknown = null

  constructor()
  constructor(timerNo: number, micro: unknown)
  constructor(text: string, targetMenu: GameMenu | null, menuManager: IMenuManager | null)
  constructor(var1?: number | string, var2?: unknown, var3?: unknown) {
    this.resetState()

    if (typeof var1 === 'number') {
      this.micro = var2
      this.timerNo = var1
      return
    }

    if (typeof var1 === 'string') {
      this.text = var1 + '>'
      this.targetMenu = (var2 as GameMenu | null) ?? null
      this.menuManager = (var3 as IMenuManager | null) ?? null
    }
  }

  resetState(): void {
    this.xF16 = 0
    this.yF16 = 0
    this.angleF16 = 0
    this.velocityXF16 = 0
    this.velocityYF16 = 0
    this.angularVelocityF16 = 0
    this.forceXF16 = 0
    this.forceYF16 = 0
    this.torqueF16 = 0
  }

  setText(text: string): void {
    this.text = text + '>'
  }

  getText(): string {
    return this.text
  }

  isNotTextRender(): boolean {
    return true
  }

  menuElemMethod(_var1: number): void {
    switch (_var1) {
      case 1:
      case 2:
        this.menuManager?.handleMenuSelection(this)
        this.targetMenu?.setParentMenu(this.menuManager?.getCurrentMenu() ?? null)
        this.menuManager?.openMenu(this.targetMenu, false)
        break
      default:
        break
    }
  }

  setParentMenu(parentMenu: GameMenu | null): void {
    this.targetMenu = parentMenu
  }

  render(graphics: Graphics, y: number, x: number): void {
    graphics.drawString(this.text, x, y, Graphics.LEFT | Graphics.TOP)
  }
}
