import { startGameRuntime } from './runtime/startGameRuntime.ts'
import { GameUI } from './ui/GameUI.ts'

type AppRoot = HTMLDivElement & {
  __gravityDefiedCleanup__?: () => void
}

export async function startGravityDefiedApp(root: HTMLDivElement): Promise<void> {
  const appRoot = root as AppRoot
  appRoot.__gravityDefiedCleanup__?.()

  root.className = 'app-root'

  const canvasElement = document.createElement('canvas')
  canvasElement.className = 'game-canvas'
  canvasElement.setAttribute('aria-label', 'Gravity Defied game viewport')

  root.replaceChildren(canvasElement)

  let ui: GameUI | null = null

  const cleanupRuntime = await startGameRuntime({
    canvasElement,
    viewportElement: root,
    onControllerReady: (controller) => {
      ui = new GameUI(root, controller)
    },
  })

  appRoot.__gravityDefiedCleanup__ = (): void => {
    ui?.destroy()
    cleanupRuntime()
  }
}
