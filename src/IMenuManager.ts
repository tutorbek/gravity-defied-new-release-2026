import type { GameMenu } from './GameMenu.ts'
import type { IGameMenuElement } from './IGameMenuElement.ts'

export interface IMenuManager {
  getCurrentMenu(): GameMenu | null
  openMenu(menu: GameMenu | null, preserveSelection: boolean): void
  saveAndClose(): void
  handleMenuSelection(element: IGameMenuElement): void
}
