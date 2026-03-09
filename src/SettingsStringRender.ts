import { GameCanvas } from './GameCanvas.ts'
import type { GameMenu } from './GameMenu.ts'
import type { IGameMenuElement } from './IGameMenuElement.ts'
import type { IMenuManager } from './IMenuManager.ts'
import type { Micro } from './Micro.ts'
import { Graphics } from './lcdui/Graphics.ts'
import { GameMenu as GameMenuClass } from './GameMenu.ts'

export class SettingsStringRender implements IGameMenuElement, IMenuManager {
  private optionsList: string[] = []
  private currentOptionPos = 0
  private maxAvailableOption = 0
  private text: string
  private readonly menuManager: IMenuManager
  private currentGameMenu: GameMenu | null = null
  private parentGameMenu: GameMenu | null = null
  private readonly isToggleSetting: boolean
  private selectionMenuRequested = false
  private selectedOptionName = ''
  private readonly micro: Micro
  private settingsStringRenders: SettingsStringRender[] = []
  private hasSprite = false
  private isDrawSprite8 = false
  private readonly useColon: boolean

  constructor(text: string, isDisabled: number, menuManager: IMenuManager, optionsList: string[], isToggleSetting: boolean, micro: Micro, parentGameMenu: GameMenu | null, useColon: boolean) {
    this.micro = micro
    this.menuManager = menuManager
    this.useColon = useColon
    this.isToggleSetting = isToggleSetting
    this.parentGameMenu = parentGameMenu

    if (useColon) {
      this.text = text
      this.isDrawSprite8 = true
      return
    }

    this.text = `${text}:`
    this.currentOptionPos = isDisabled
    this.optionsList = optionsList.length === 0 ? [''] : optionsList
    this.maxAvailableOption = optionsList.length - 1
    this.setCurrentOptionPos(isDisabled)
    if (isToggleSetting) {
      this.selectedOptionName = isDisabled === 1 ? 'Off' : 'On'
    } else {
      this.selectCurrentOptionName()
      this.init()
    }
  }

  setFlags(hasSprite: boolean, isDrawSprite8: boolean): void {
    this.hasSprite = hasSprite
    this.isDrawSprite8 = isDrawSprite8
  }

  setOptionsList(var1: string[]): void {
    this.optionsList = var1
    if (this.currentOptionPos > this.optionsList.length - 1) {
      this.currentOptionPos = this.optionsList.length - 1
    }
    if (this.maxAvailableOption > this.optionsList.length - 1) {
      this.maxAvailableOption = this.optionsList.length - 1
    }
    this.selectCurrentOptionName()
    this.init()
  }

  init(): void {
    this.currentGameMenu = new GameMenuClass(this.text, this.micro, this.parentGameMenu)
    this.settingsStringRenders = new Array<SettingsStringRender>(this.optionsList.length)
    for (let var1 = 0; var1 < this.settingsStringRenders.length; ++var1) {
      this.settingsStringRenders[var1] = new SettingsStringRender(this.optionsList[var1], 0, this, [], false, this.micro, this.parentGameMenu, true)
      if (var1 > this.maxAvailableOption) {
        this.settingsStringRenders[var1].setFlags(true, true)
      }
      this.currentGameMenu.addMenuElement(this.settingsStringRenders[var1])
    }
  }

  setParentGameMenu(parentGameMenu: GameMenu | null): void {
    this.parentGameMenu = parentGameMenu
  }

  setText(text: string): void {
    this.text = this.useColon ? text : `${text}:`
  }

  isNotTextRender(): boolean {
    return true
  }

  menuElemMethod(var1: number): void {
    if (this.useColon) {
      if (var1 === 1) {
        this.menuManager.handleMenuSelection(this)
      }
      return
    }

    switch (var1) {
      case 1:
        if (this.isToggleSetting) {
          ++this.currentOptionPos
          if (this.currentOptionPos > 1) {
            this.currentOptionPos = 0
          }
          this.selectedOptionName = this.currentOptionPos === 1 ? 'Off' : 'On'
          this.menuManager.handleMenuSelection(this)
          return
        }
        this.selectionMenuRequested = true
        this.menuManager.handleMenuSelection(this)
        return
      case 2:
        if (this.isToggleSetting) {
          if (this.currentOptionPos === 1) {
            this.currentOptionPos = 0
            this.selectedOptionName = 'On'
            this.menuManager.handleMenuSelection(this)
          }
          return
        }
        ++this.currentOptionPos
        if (this.currentOptionPos > this.optionsList.length - 1) {
          this.currentOptionPos = this.optionsList.length - 1
        } else {
          this.menuManager.handleMenuSelection(this)
        }
        this.selectCurrentOptionName()
        return
      case 3:
        if (this.isToggleSetting) {
          if (this.currentOptionPos === 0) {
            this.currentOptionPos = 1
            this.selectedOptionName = 'Off'
            this.menuManager.handleMenuSelection(this)
          }
          return
        }
        --this.currentOptionPos
        if (this.currentOptionPos < 0) {
          this.currentOptionPos = 0
        } else {
          this.selectCurrentOptionName()
          this.menuManager.handleMenuSelection(this)
        }
        this.selectCurrentOptionName()
    }
  }

  private selectCurrentOptionName(): void {
    this.selectedOptionName = this.optionsList[this.currentOptionPos]
  }

  render(graphics: Graphics, y: number, x: number): void {
    if (this.useColon) {
      if (!this.hasSprite) {
        graphics.drawString(this.text, x, y, Graphics.LEFT | Graphics.TOP)
      } else if (this.micro.gameCanvas !== null) {
        graphics.drawString(this.text, x + GameCanvas.spriteSizeX[8] + 3, y, Graphics.LEFT | Graphics.TOP)
        this.micro.gameCanvas.drawSprite(graphics, this.isDrawSprite8 ? 8 : 9, x, y - Math.trunc(GameCanvas.spriteSizeY[this.isDrawSprite8 ? 8 : 9] / 2) + Math.trunc(graphics.getFont().getHeight() / 2))
      }
      return
    }

    graphics.drawString(this.text, x, y, Graphics.LEFT | Graphics.TOP)
    let shiftedX = x + graphics.getFont().stringWidth(this.text)
    if (this.currentOptionPos > this.maxAvailableOption && !this.isToggleSetting && this.micro.gameCanvas !== null) {
      this.micro.gameCanvas.drawSprite(graphics, 8, shiftedX + 1, y - Math.trunc(GameCanvas.spriteSizeY[8] / 2) + Math.trunc(graphics.getFont().getHeight() / 2))
      shiftedX += GameCanvas.spriteSizeX[9] + 1
    }
    shiftedX += 2
    graphics.drawString(this.selectedOptionName, shiftedX, y, Graphics.LEFT | Graphics.TOP)
  }

  setAvailableOptions(maxAvailableOption: number): void {
    this.maxAvailableOption = maxAvailableOption
    if (maxAvailableOption > this.optionsList.length - 1) {
      maxAvailableOption = this.optionsList.length - 1
    }
    if (this.currentGameMenu !== null) {
      for (let i = 0; i < this.settingsStringRenders.length; ++i) {
        this.settingsStringRenders[i].setFlags(i > maxAvailableOption, i > maxAvailableOption)
      }
    }
  }

  getMaxAvailableOptionPos(): number {
    return this.maxAvailableOption
  }

  getMaxOptionPos(): number {
    return this.optionsList.length - 1
  }

  getOptionsList(): string[] {
    return this.optionsList
  }

  setCurrentOptionPos(pos: number): void {
    this.currentOptionPos = pos
    if (this.currentOptionPos > this.optionsList.length - 1) {
      this.currentOptionPos = 0
    }
    if (this.currentOptionPos < 0) {
      this.currentOptionPos = this.optionsList.length - 1
    }
    this.selectCurrentOptionName()
  }

  getCurrentOptionPos(): number {
    return this.currentOptionPos
  }

  getCurrentMenu(): GameMenu | null {
    return this.currentGameMenu
  }

  openMenu(menu: GameMenu | null, preserveSelection: boolean): void {
    this.menuManager.openMenu(menu, preserveSelection)
  }

  saveAndClose(): void {
    this.menuManager.saveAndClose()
  }

  handleMenuSelection(var1: IGameMenuElement): void {
    for (let var2 = 0; var2 < this.settingsStringRenders.length; ++var2) {
      if (var1 === this.settingsStringRenders[var2]) {
        this.currentOptionPos = var2
        this.selectCurrentOptionName()
        break
      }
    }

    this.menuManager.openMenu(this.parentGameMenu, true)
    this.menuManager.handleMenuSelection(this)
  }

  getSettingsStringRenders(): SettingsStringRender[] {
    return this.settingsStringRenders
  }

  consumeSelectionMenuRequested(): boolean {
    const var1 = this.selectionMenuRequested
    this.selectionMenuRequested = false
    return var1
  }
}
