import { GameCanvas } from '../GameCanvas.ts'
import { GamePhysics } from '../GamePhysics.ts'
import { LevelLoader } from '../LevelLoader.ts'
import { MenuManager } from '../MenuManager.ts'
import { Micro } from '../Micro.ts'
import LEVELS_MRG_URL from '../assets/levels.mrg?url'
import { browserKeyCodeToGameKeyCode } from './browserInput.ts'
import { RollingAudio } from './RollingAudio.ts'

type RuntimeOptions = {
  canvasElement: HTMLCanvasElement
  viewportElement: HTMLDivElement
}

type AppState = {
  forcedRestartMs: number
  goalLoopEndMs: number
  isGoalLoopActive: boolean
  lastGoalLoopStepMs: number
  lastMenuStepMs: number
  lastOuterStepMs: number
  loadedSpriteFlags: number
  outerAccumulatorMs: number
  wasInGameMenu: boolean
}

const PHYSICS_FRAME_MS = 30

export async function startGameRuntime(options: RuntimeOptions): Promise<() => void> {
  const { canvasElement, viewportElement } = options
  const micro = new Micro()
  Micro.isGameVisible = true

  const levelLoader = await LevelLoader.create(LEVELS_MRG_URL)
  const gamePhysics = new GamePhysics(levelLoader)
  const gameCanvas = await GameCanvas.create(canvasElement, micro)
  const menuManager = new MenuManager(micro)
  const rollingAudio = new RollingAudio()

  micro.levelLoader = levelLoader
  micro.gamePhysics = gamePhysics
  micro.gameCanvas = gameCanvas
  micro.menuManager = menuManager

  gameCanvas.init(gamePhysics)

  function resize(): void {
    const rect = viewportElement.getBoundingClientRect()
    let width = Math.floor(rect.width)
    let height = Math.floor(rect.height)

    if (width <= 0 || height <= 0) {
      width = Math.max(window.innerWidth, 1280)
      height = Math.max(window.innerHeight, 720)
    }

    gameCanvas.resize(width, height)
    gamePhysics.setMinimalScreenWH(gameCanvas.getWidth() < gameCanvas.getHeight() ? gameCanvas.getWidth() : gameCanvas.getHeight())
  }

  resize()

  for (let i = 1; i <= 7; ++i) {
    menuManager.initPart(i)
  }

  gameCanvas.setMenuManager(menuManager)

  const state: AppState = {
    forcedRestartMs: 0,
    goalLoopEndMs: 0,
    isGoalLoopActive: false,
    lastGoalLoopStepMs: 0,
    lastMenuStepMs: performance.now(),
    lastOuterStepMs: performance.now(),
    loadedSpriteFlags: await gameCanvas.loadSprites(menuManager.getLoadedSpriteFlags()),
    outerAccumulatorMs: 0,
    wasInGameMenu: false,
  }

  gamePhysics.applyLoadedSpriteFlags(state.loadedSpriteFlags)
  menuManager.applyLoadedSpriteFlags(state.loadedSpriteFlags)
  gamePhysics.setMode(1)

  function render(): void {
    gameCanvas.paint(gameCanvas.getGraphics())
    rollingAudio.update(gamePhysics.getRollingAudioState(), gamePhysics.getMotorAudioState(), Micro.isInGameMenu || state.isGoalLoopActive)
  }

  gameCanvas.setRepaintHandler(render)

  function restart(scheduleTimerMessage: boolean): void {
    gamePhysics.resetSmth(true)
    micro.timeMs = 0
    micro.gameTimeMs = 0
    micro.crashRestartDeadlineMs = 0
    micro.isTimerRunning = false
    state.goalLoopEndMs = 0
    state.isGoalLoopActive = false
    state.lastGoalLoopStepMs = 0
    state.forcedRestartMs = 0
    if (scheduleTimerMessage) {
      gameCanvas.scheduleGameTimerTask(levelLoader.getName(menuManager.getCurrentLevel(), menuManager.getCurrentTrack()), 3000)
    }
    gameCanvas.resetInputState()
  }

  function openFinishedMenu(): void {
    menuManager.setFinishTime(micro.gameTimeMs / 10)
    menuManager.showMenuScreen(2)
  }

  function startGoalLoop(nowMs: number): void {
    state.goalLoopEndMs = nowMs + 1000
    state.isGoalLoopActive = true
    state.lastGoalLoopStepMs = nowMs
    gameCanvas.scheduleGameTimerTask(gamePhysics.isTrackFinished ? 'Finished' : 'Wheelie!', 1000)
  }

  function updateSpriteMode(): void {
    const nextSpriteFlags = menuManager.getLoadedSpriteFlags()
    if (gamePhysics.getLoadedSpriteFlags() !== nextSpriteFlags) {
      void gameCanvas.loadSprites(nextSpriteFlags).then((loadedSpriteFlags) => {
        gamePhysics.applyLoadedSpriteFlags(loadedSpriteFlags)
        menuManager.applyLoadedSpriteFlags(loadedSpriteFlags)
        state.loadedSpriteFlags = loadedSpriteFlags
      })
    }
  }

  function outerStep(nowMs: number): void {
    updateSpriteMode()

    if (state.forcedRestartMs !== 0) {
      if (nowMs >= state.forcedRestartMs) {
        restart(true)
      }
      return
    }

    for (let i = micro.numPhysicsLoops; i > 0; --i) {
      if (micro.isTimerRunning) {
        micro.gameTimeMs += 20
      }

      if (micro.timeMs === 0) {
        micro.timeMs = Date.now()
      }

      const updateResult = gamePhysics.updatePhysics()
      if (updateResult === 3 && micro.crashRestartDeadlineMs === 0) {
        micro.crashRestartDeadlineMs = Date.now() + 3000
        gameCanvas.scheduleGameTimerTask('Crashed', 3000)
        gameCanvas.repaint()
        gameCanvas.serviceRepaints()
      }

      if (micro.crashRestartDeadlineMs !== 0 && micro.crashRestartDeadlineMs < Date.now()) {
        restart(true)
        return
      }

      if (updateResult === 5) {
        gameCanvas.scheduleGameTimerTask('Crashed', 3000)
        gameCanvas.repaint()
        gameCanvas.serviceRepaints()
        let waitMs = 1000
        if (micro.crashRestartDeadlineMs > 0) {
          waitMs = Math.min(micro.crashRestartDeadlineMs - Date.now(), 1000)
        }
        if (waitMs < 0) {
          waitMs = 0
        }
        state.forcedRestartMs = nowMs + waitMs
        return
      }

      if (updateResult === 4) {
        micro.timeMs = 0
        micro.gameTimeMs = 0
      } else if (updateResult === 1 || updateResult === 2) {
        if (updateResult === 2) {
          micro.gameTimeMs -= 10
        }

        startGoalLoop(nowMs)
        micro.isTimerRunning = true
        return
      }

      micro.isTimerRunning = updateResult !== 4
    }

    gamePhysics.syncRenderStateFromSimulation()
  }

  function goalLoopStep(nowMs: number): void {
    if (!state.isGoalLoopActive) {
      return
    }

    if (nowMs >= state.goalLoopEndMs) {
      state.isGoalLoopActive = false
      openFinishedMenu()
      return
    }

    while (nowMs - state.lastGoalLoopStepMs >= PHYSICS_FRAME_MS) {
      for (let i = micro.numPhysicsLoops; i > 0; --i) {
        if (gamePhysics.updatePhysics() === 5) {
          state.isGoalLoopActive = false
          state.goalLoopEndMs = nowMs
          openFinishedMenu()
          return
        }
      }

      gamePhysics.syncRenderStateFromSimulation()
      state.lastGoalLoopStepMs += PHYSICS_FRAME_MS
    }
  }

  function menuStep(nowMs: number): void {
    if (!Micro.isInGameMenu) {
      return
    }

    while (nowMs - state.lastMenuStepMs >= 50) {
      if (gamePhysics.isGenerateInputAI) {
        const updateResult = gamePhysics.updatePhysics()
        if (updateResult !== 0 && updateResult !== 4) {
          gamePhysics.resetSmth(true)
        }

        gamePhysics.syncRenderStateFromSimulation()
      }

      state.lastMenuStepMs += 50
      if (!gamePhysics.isGenerateInputAI) {
        break
      }
    }
  }

  let animationFrameId = 0
  let isDisposed = false

  function loop(now: number): void {
    if (isDisposed) {
      return
    }

    if (Micro.isInGameMenu && !state.wasInGameMenu) {
      state.lastMenuStepMs = now
    }

    if (Micro.isInGameMenu && !state.wasInGameMenu && menuManager.isOpeningPauseMenu) {
      menuManager.showMenuScreen(1)
    }

    if (Micro.isInGameMenu) {
      menuStep(now)
      render()
      state.wasInGameMenu = true
      animationFrameId = requestAnimationFrame(loop)
      return
    }

    if (state.wasInGameMenu) {
      state.lastOuterStepMs = now
      state.outerAccumulatorMs = 0
    }

    state.wasInGameMenu = false
    if (menuManager.consumeRestartRequested()) {
      restart(true)
    }

    if (state.isGoalLoopActive) {
      goalLoopStep(now)
      render()
      animationFrameId = requestAnimationFrame(loop)
      return
    }

    state.outerAccumulatorMs += now - state.lastOuterStepMs
    state.lastOuterStepMs = now

    while (state.outerAccumulatorMs >= PHYSICS_FRAME_MS) {
      outerStep(now)
      state.outerAccumulatorMs -= PHYSICS_FRAME_MS
      if (Micro.isInGameMenu || state.isGoalLoopActive) {
        break
      }
    }

    gamePhysics.syncRenderStateFromSimulation(state.outerAccumulatorMs / PHYSICS_FRAME_MS)

    if (menuManager.consumeRestartRequested()) {
      restart(true)
    }

    render()
    animationFrameId = requestAnimationFrame(loop)
  }

  const handleResize = (): void => {
    resize()
    render()
  }

  const handleKeyDown = (event: KeyboardEvent): void => {
    void rollingAudio.resume()
    let handled = false
    const keyCode = browserKeyCodeToGameKeyCode(event.code)

    if (event.code === 'Escape') {
      if (Micro.isInGameMenu) {
        gameCanvas.handleBackAction()
        handled = true
      } else if (gameCanvas.hasMenuButton()) {
        gameCanvas.openPauseMenu()
        handled = true
      }
    }

    if (keyCode !== null) {
      gameCanvas.keyPressed(keyCode)
      handled = true
    }

    if (handled) {
      event.preventDefault()
      render()
    }
  }

  const handleKeyUp = (event: KeyboardEvent): void => {
    const keyCode = browserKeyCodeToGameKeyCode(event.code)
    if (keyCode !== null) {
      gameCanvas.keyReleased(keyCode)
      event.preventDefault()
    }
  }

  const handlePointerDown = (): void => {
    void rollingAudio.resume()
    canvasElement.focus({ preventScroll: true })
  }

  const handleCanvasFocus = (): void => {
    viewportElement.classList.add('app-root--focused')
  }

  const handleCanvasBlur = (): void => {
    gameCanvas.resetInputState()
    viewportElement.classList.remove('app-root--focused')
  }

  const handleWindowBlur = (): void => {
    gameCanvas.resetInputState()
    viewportElement.classList.remove('app-root--focused')
  }

  const resizeObserver = new ResizeObserver(() => {
    handleResize()
  })

  resizeObserver.observe(viewportElement)
  window.addEventListener('resize', handleResize)
  window.visualViewport?.addEventListener('resize', handleResize)
  window.addEventListener('keydown', handleKeyDown)
  window.addEventListener('keyup', handleKeyUp)
  window.addEventListener('blur', handleWindowBlur)
  canvasElement.addEventListener('pointerdown', handlePointerDown)
  canvasElement.addEventListener('focus', handleCanvasFocus)
  canvasElement.addEventListener('blur', handleCanvasBlur)

  gameCanvas.requestRepaint(0)
  restart(false)
  gameCanvas.setUiOverlayEnabled(false)
  menuManager.unlockAllContent()
  levelLoader.loadLevel(menuManager.getSelectedLevel(), menuManager.getSelectedTrack())
  gamePhysics.setMotoLeague(menuManager.getSelectedLeague())
  micro.menuToGame()
  animationFrameId = requestAnimationFrame(loop)

  return (): void => {
    isDisposed = true
    cancelAnimationFrame(animationFrameId)
    resizeObserver.disconnect()
    window.removeEventListener('resize', handleResize)
    window.visualViewport?.removeEventListener('resize', handleResize)
    window.removeEventListener('keydown', handleKeyDown)
    window.removeEventListener('keyup', handleKeyUp)
    window.removeEventListener('blur', handleWindowBlur)
    canvasElement.removeEventListener('pointerdown', handlePointerDown)
    canvasElement.removeEventListener('focus', handleCanvasFocus)
    canvasElement.removeEventListener('blur', handleCanvasBlur)
    gameCanvas.resetInputState()
    menuManager.saveAndClose()
    rollingAudio.stop()
    Micro.isGameVisible = false
  }
}
