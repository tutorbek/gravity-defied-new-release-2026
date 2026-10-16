import { GameCanvas } from '../GameCanvas.ts'
import { GamePhysics } from '../GamePhysics.ts'
import { LevelLoader } from '../LevelLoader.ts'
import { MenuManager } from '../MenuManager.ts'
import { Micro } from '../Micro.ts'
import LEVELS_MRG_URL from '../assets/levels.mrg?url'
import { browserKeyCodeToGameKeyCode } from './browserInput.ts'
import { RollingAudio } from './RollingAudio.ts'

import { RecordManager } from '../RecordManager.ts'
import {
  type GameRuntimeController,
  type GameRuntimeState,
  type GameUISettings,
  loadStoredSettings,
  saveStoredSettings,
} from '../ui/GameUI.ts'

type RuntimeOptions = {
  canvasElement: HTMLCanvasElement
  controlsElement?: HTMLDivElement
  viewportElement: HTMLDivElement
  onControllerReady?: (controller: GameRuntimeController) => void
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
  const { canvasElement, controlsElement, viewportElement } = options
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
    gameCanvas.resetCamera()
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

  function formatGameTime(time10Ms: number): string {
    const totalSec = Math.trunc(time10Ms / 100)
    const centisec = Math.trunc(time10Ms % 100)
    const mins = Math.trunc(totalSec / 60)
    const secs = totalSec % 60
    const mStr = mins < 10 ? `0${mins}` : `${mins}`
    const sStr = secs < 10 ? `0${secs}` : `${secs}`
    const csStr = centisec < 10 ? `0${centisec}` : `${centisec}`
    return `${mStr}:${sStr}.${csStr}`
  }

  const stateListeners = new Set<(state: GameRuntimeState) => void>()
  const notifyStateChange = (extra?: Partial<GameRuntimeState>): void => {
    const curLvl = menuManager.getCurrentLevel()
    const curTrk = menuManager.getCurrentTrack()
    const curLg = menuManager.getSelectedLeague()
    const st: GameRuntimeState = {
      isPaused: Micro.isInGameMenu,
      isInMenu: Micro.isInGameMenu,
      isFinished: false,
      levelIndex: curLvl,
      trackIndex: curTrk,
      leagueIndex: curLg,
      trackName: levelLoader.getName(curLvl, curTrk),
      leagueName: ['100cc', '175cc', '220cc', '325cc'][curLg] ?? '100cc',
      difficultyName: ['Oson', 'O‘rtacha', 'Qiyin'][curLvl] ?? 'Oson',
      ...extra,
    }
    for (const listener of stateListeners) {
      listener(st)
    }
  }

  function openFinishedMenu(): void {
    const finishTime10Ms = micro.gameTimeMs / 10
    menuManager.setFinishTime(finishTime10Ms)
    const curLg = menuManager.getSelectedLeague()
    const rank = menuManager.getRecordManager()?.getPosOfNewRecord(curLg, finishTime10Ms) ?? 3
    menuManager.showMenuScreen(2)
    notifyStateChange({
      isFinished: true,
      finishTimeStr: formatGameTime(finishTime10Ms),
      finishRank: rank,
    })
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

    if (event.code === 'KeyR') {
      restart(true)
      handled = true
      notifyStateChange()
    } else if (event.code === 'Escape') {
      if (Micro.isInGameMenu) {
        gameCanvas.handleBackAction()
        handled = true
      } else if (gameCanvas.hasMenuButton()) {
        gameCanvas.openPauseMenu()
        handled = true
      }
      notifyStateChange()
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

  const handlePointerDown = (event: PointerEvent): void => {
    void rollingAudio.resume()
    canvasElement.focus({ preventScroll: true })
    if (Micro.isInGameMenu) {
      const handled = gameCanvas.handleCanvasPointerClick(event.clientX, event.clientY)
      if (handled) {
        event.preventDefault()
        render()
        notifyStateChange()
      }
    }
  }

  const activeKeysSet = new Set<number>()
  const activePointerKeys = new Map<number, number>()
  const activePointerButtons = new Map<number, HTMLElement>()

  const pressTouchKey = (keyCode: number): void => {
    activeKeysSet.add(keyCode)
    gameCanvas.keyPressed(keyCode)
    render()
  }

  const releaseTouchKey = (keyCode: number): void => {
    activeKeysSet.delete(keyCode)
    gameCanvas.keyReleased(keyCode)
    render()
  }

  const releaseAllTouchKeys = (): void => {
    for (const keyCode of activeKeysSet) {
      gameCanvas.keyReleased(keyCode)
    }
    activeKeysSet.clear()
    for (const button of activePointerButtons.values()) {
      button.classList.remove('mobile-control-button--pressed')
    }
    activePointerKeys.clear()
    activePointerButtons.clear()
    gameCanvas.resetInputState()
    render()
  }

  const handleControlPointerDown = (event: PointerEvent): void => {
    const button = event.target instanceof HTMLElement ? event.target.closest<HTMLButtonElement>('[data-game-key]') : null
    if (button === null) {
      return
    }

    const keyCode = browserKeyCodeToGameKeyCode(button.dataset.gameKey ?? '')
    if (keyCode === null) {
      return
    }

    event.preventDefault()
    if (activePointerKeys.has(event.pointerId)) {
      return
    }

    void rollingAudio.resume()
    canvasElement.focus({ preventScroll: true })
    try {
      button.setPointerCapture(event.pointerId)
    } catch {
      // Ignore if pointer capture fails
    }
    button.classList.add('mobile-control-button--pressed')
    activePointerKeys.set(event.pointerId, keyCode)
    activePointerButtons.set(event.pointerId, button)
    pressTouchKey(keyCode)
  }

  const handleControlPointerRelease = (event: PointerEvent): void => {
    const keyCode = activePointerKeys.get(event.pointerId)
    if (keyCode === undefined) {
      return
    }

    event.preventDefault()
    const button = activePointerButtons.get(event.pointerId)
    button?.classList.remove('mobile-control-button--pressed')
    try {
      button?.releasePointerCapture(event.pointerId)
    } catch {
      // Ignore if capture already lost
    }
    activePointerKeys.delete(event.pointerId)
    activePointerButtons.delete(event.pointerId)
    releaseTouchKey(keyCode)
  }

  const handleCanvasFocus = (): void => {
    viewportElement.classList.add('app-root--focused')
  }

  const handleCanvasBlur = (event: FocusEvent): void => {
    if (controlsElement?.contains(event.relatedTarget as Node | null)) {
      canvasElement.focus({ preventScroll: true })
      return
    }

    releaseAllTouchKeys()
    gameCanvas.resetInputState()
    viewportElement.classList.remove('app-root--focused')
  }

  const handleWindowBlur = (): void => {
    releaseAllTouchKeys()
    gameCanvas.resetInputState()
    viewportElement.classList.remove('app-root--focused')
  }

  const handleVisibilityChange = (): void => {
    if (document.visibilityState === 'hidden') {
      releaseAllTouchKeys()
      gameCanvas.resetInputState()
    }
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
  document.addEventListener('visibilitychange', handleVisibilityChange)
  canvasElement.addEventListener('pointerdown', handlePointerDown)
  canvasElement.addEventListener('focus', handleCanvasFocus)
  canvasElement.addEventListener('blur', handleCanvasBlur)
  controlsElement?.addEventListener('pointerdown', handleControlPointerDown)
  controlsElement?.addEventListener('pointerup', handleControlPointerRelease)
  controlsElement?.addEventListener('pointercancel', handleControlPointerRelease)
  controlsElement?.addEventListener('lostpointercapture', handleControlPointerRelease)

  menuManager.unlockAllContent()
  levelLoader.loadLevel(menuManager.getSelectedLevel(), menuManager.getSelectedTrack())
  gamePhysics.setMotoLeague(menuManager.getSelectedLeague())
  gameCanvas.resetCamera()
  restart(false)
  gameCanvas.requestRepaint(0)
  gameCanvas.setUiOverlayEnabled(false)
  micro.menuToGame()

  const storedSettings = loadStoredSettings()
  rollingAudio.setUserMuted(!storedSettings.sound)
  LevelLoader.isEnabledPerspective = storedSettings.perspective
  LevelLoader.isEnabledShadows = storedSettings.shadows
  gamePhysics.setEnableLookAhead(storedSettings.lookAhead)
  const initialSpriteFlags = (storedSettings.bikeSprite ? 1 : 0) | (storedSettings.driverSprite ? 2 : 0)
  if (initialSpriteFlags !== state.loadedSpriteFlags) {
    void gameCanvas.loadSprites(initialSpriteFlags).then((loadedFlags) => {
      gamePhysics.applyLoadedSpriteFlags(loadedFlags)
      menuManager.applyLoadedSpriteFlags(loadedFlags)
      state.loadedSpriteFlags = loadedFlags
      render()
    })
  }

  const controller: GameRuntimeController = {
    startOrResume: () => {
      micro.menuToGame()
      render()
      notifyStateChange()
    },
    openMenu: () => {
      micro.gameToMenu()
      render()
      notifyStateChange({ isInMenu: true })
    },
    openPause: () => {
      micro.gameToMenu()
      render()
      notifyStateChange({ isPaused: true })
    },
    closeMenu: () => {
      micro.menuToGame()
      render()
      notifyStateChange()
    },
    restart: () => {
      restart(true)
      micro.menuToGame()
      render()
      notifyStateChange()
    },
    loadNextTrack: () => {
      const curLvl = menuManager.getCurrentLevel()
      const curTrk = menuManager.getCurrentTrack()
      const tracksInLvl = levelLoader.levelNames[curLvl]?.length ?? 10
      let nextLvl = curLvl
      let nextTrk = curTrk + 1
      if (nextTrk >= tracksInLvl) {
        if (nextLvl < 2) {
          nextLvl++
          nextTrk = 0
        } else {
          nextTrk = 0
        }
      }
      controller.loadTrack(nextLvl, nextTrk)
      return true
    },
    loadTrack: (levelIndex: number, trackIndex: number) => {
      levelLoader.loadLevel(levelIndex, trackIndex)
      gamePhysics.setMotoLeague(menuManager.getSelectedLeague())
      menuManager.setSelectedLevel(levelIndex)
      menuManager.setSelectedTrack(trackIndex)
      menuManager.persistState()
      restart(true)
      micro.menuToGame()
      render()
      notifyStateChange()
    },
    setLeague: (leagueIndex: number) => {
      gamePhysics.setMotoLeague(leagueIndex)
      menuManager.setSelectedLeague(leagueIndex)
      menuManager.persistState()
      notifyStateChange()
    },
    getCurrentLevel: () => menuManager.getCurrentLevel(),
    getCurrentTrack: () => menuManager.getCurrentTrack(),
    getCurrentLeague: () => menuManager.getSelectedLeague(),
    getCurrentTrackName: () => levelLoader.getName(menuManager.getCurrentLevel(), menuManager.getCurrentTrack()),
    getLevelNames: () => levelLoader.levelNames,
    getLeagueNames: () => ['100cc', '175cc', '220cc', '325cc'],
    getLevelDifficultyNames: () => ['Oson (Easy)', 'O‘rtacha (Medium)', 'Qiyin (Pro)'],
    getRecords: (levelIndex: number, trackIndex: number, leagueIndex: number) => {
      try {
        const rm = new RecordManager()
        rm.openRecordStoreForTrack(levelIndex, trackIndex)
        const recs = rm.getRecordDescription(leagueIndex)
        rm.closeRecordStore()
        return recs
      } catch {
        return ['', '', '']
      }
    },
    clearAllRecords: () => {
      try {
        const rm = new RecordManager()
        rm.deleteRecordStores()
        rm.closeRecordStore()
        notifyStateChange()
      } catch (_error) {
        void _error
      }
    },
    isAudioMuted: () => rollingAudio.isUserMuted(),
    setAudioMuted: (muted: boolean) => {
      rollingAudio.setUserMuted(muted)
      render()
    },
    getSettings: () => loadStoredSettings(),
    updateSetting: <K extends keyof GameUISettings>(key: K, value: GameUISettings[K]) => {
      const current = loadStoredSettings()
      current[key] = value
      saveStoredSettings(current)

      if (key === 'sound') {
        rollingAudio.setUserMuted(!value)
      } else if (key === 'perspective') {
        LevelLoader.isEnabledPerspective = Boolean(value)
        gamePhysics.applyPerspectiveOffset(Boolean(value))
      } else if (key === 'shadows') {
        LevelLoader.isEnabledShadows = Boolean(value)
      } else if (key === 'lookAhead') {
        gamePhysics.setEnableLookAhead(Boolean(value))
      } else if (key === 'bikeSprite' || key === 'driverSprite') {
        const flags = (current.bikeSprite ? 1 : 0) | (current.driverSprite ? 2 : 0)
        void gameCanvas.loadSprites(flags).then((loadedFlags) => {
          gamePhysics.applyLoadedSpriteFlags(loadedFlags)
          menuManager.applyLoadedSpriteFlags(loadedFlags)
          state.loadedSpriteFlags = loadedFlags
          render()
        })
      }
      render()
    },
    pressKey: (code: string) => {
      const kc = browserKeyCodeToGameKeyCode(code)
      if (kc !== null) {
        void rollingAudio.resume()
        pressTouchKey(kc)
      }
    },
    releaseKey: (code: string) => {
      const kc = browserKeyCodeToGameKeyCode(code)
      if (kc !== null) {
        releaseTouchKey(kc)
      }
    },
    onStateChange: (listener) => {
      stateListeners.add(listener)
      listener({
        isPaused: Micro.isInGameMenu,
        isInMenu: Micro.isInGameMenu,
        isFinished: false,
        levelIndex: menuManager.getCurrentLevel(),
        trackIndex: menuManager.getCurrentTrack(),
        leagueIndex: menuManager.getSelectedLeague(),
        trackName: levelLoader.getName(menuManager.getCurrentLevel(), menuManager.getCurrentTrack()),
        leagueName: ['100cc', '175cc', '220cc', '325cc'][menuManager.getSelectedLeague()] ?? '100cc',
        difficultyName: ['Oson', 'O‘rtacha', 'Qiyin'][menuManager.getCurrentLevel()] ?? 'Oson',
      })
      return () => {
        stateListeners.delete(listener)
      }
    },
  }

  options.onControllerReady?.(controller)
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
    document.removeEventListener('visibilitychange', handleVisibilityChange)
    canvasElement.removeEventListener('pointerdown', handlePointerDown)
    canvasElement.removeEventListener('focus', handleCanvasFocus)
    canvasElement.removeEventListener('blur', handleCanvasBlur)
    controlsElement?.removeEventListener('pointerdown', handleControlPointerDown)
    controlsElement?.removeEventListener('pointerup', handleControlPointerRelease)
    controlsElement?.removeEventListener('pointercancel', handleControlPointerRelease)
    controlsElement?.removeEventListener('lostpointercapture', handleControlPointerRelease)
    releaseAllTouchKeys()
    gameCanvas.resetInputState()
    menuManager.saveAndClose()
    rollingAudio.stop()
    Micro.isGameVisible = false
  }
}
