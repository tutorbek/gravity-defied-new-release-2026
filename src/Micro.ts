import type { GameCanvas } from './GameCanvas.ts'
import type { GamePhysics } from './GamePhysics.ts'
import type { LevelLoader } from './LevelLoader.ts'
import type { MenuManager } from './MenuManager.ts'

export class Micro {
  gameCanvas: GameCanvas | null = null
  levelLoader: LevelLoader | null = null
  gamePhysics: GamePhysics | null = null
  menuManager: MenuManager | null = null
  isLoadingBlocked = false
  numPhysicsLoops = 2
  timeMs = 0
  gameTimeMs = 0
  crashRestartDeadlineMs = 0
  isInited = false
  isTimerRunning = false
  static isGameVisible = false
  static isInGameMenu = false
  static gameLoadingStateStage = 0

  gameToMenu(): void {
    this.gameCanvas?.hideMenuButton()
    if (this.gameCanvas !== null) {
      this.gameCanvas.isDrawingTime = false
      this.gameCanvas.hideBackButton()
    }
    Micro.isInGameMenu = true
  }

  menuToGame(): void {
    Micro.isInGameMenu = false
    if (this.gameCanvas !== null) {
      this.gameCanvas.isDrawingTime = true
      this.gameCanvas.hideBackButton()
    }
    this.gameCanvas?.showMenuButton()
  }
}
