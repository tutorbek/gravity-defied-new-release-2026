import { startGameRuntime } from './runtime/startGameRuntime.ts'

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

  appRoot.__gravityDefiedCleanup__ = await startGameRuntime({
    canvasElement,
    viewportElement: root,
  })
}
