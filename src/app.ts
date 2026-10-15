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

  const mobileControlsElement = document.createElement('div')
  mobileControlsElement.className = 'mobile-controls'
  mobileControlsElement.setAttribute('aria-label', 'Mobile game controls')
  mobileControlsElement.innerHTML = `
    <div class="mobile-controls__cluster mobile-controls__cluster--lean" aria-label="Lean controls">
      <button class="mobile-control-button" type="button" data-game-key="KeyA" aria-label="Lean backward">A</button>
      <button class="mobile-control-button" type="button" data-game-key="KeyD" aria-label="Lean forward">D</button>
    </div>
    <div class="mobile-controls__cluster mobile-controls__cluster--drive" aria-label="Drive controls">
      <button class="mobile-control-button" type="button" data-game-key="KeyW" aria-label="Accelerate">W</button>
      <button class="mobile-control-button" type="button" data-game-key="KeyS" aria-label="Brake">S</button>
    </div>
  `
  for (const buttonElement of mobileControlsElement.querySelectorAll('button')) {
    buttonElement.tabIndex = -1
  }

  const sponsorLinkElement = document.createElement('a')
  sponsorLinkElement.className = 'sponsor-link'
  sponsorLinkElement.href = 'https://t.me/tutorbek'
  sponsorLinkElement.target = '_blank'
  sponsorLinkElement.rel = 'noopener noreferrer'
  sponsorLinkElement.innerHTML = '<span class="sponsor-link__pulse"></span><span>Powered by tutorbek</span>'

  root.replaceChildren(canvasElement, sponsorLinkElement, mobileControlsElement)

  appRoot.__gravityDefiedCleanup__ = await startGameRuntime({
    canvasElement,
    controlsElement: mobileControlsElement,
    viewportElement: root,
  })
}
