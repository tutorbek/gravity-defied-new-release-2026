export type GameUISettings = {
  sound: boolean
  haptics: boolean
  controlsMode: 'auto' | 'always' | 'hidden'
  driverSprite: boolean
  bikeSprite: boolean
  shadows: boolean
  perspective: boolean
  lookAhead: boolean
}

export type GameRuntimeState = {
  isPaused: boolean
  isInMenu: boolean
  isFinished: boolean
  finishTimeStr?: string
  finishRank?: number // 0: 1st, 1: 2nd, 2: 3rd, 3: completed
  levelIndex: number
  trackIndex: number
  leagueIndex: number
  trackName: string
  leagueName: string
  difficultyName: string
}

export type GameRuntimeController = {
  startOrResume: () => void
  openMenu: () => void
  openPause: () => void
  closeMenu: () => void
  restart: () => void
  loadNextTrack: () => boolean
  loadTrack: (levelIndex: number, trackIndex: number) => void
  setLeague: (leagueIndex: number) => void

  getCurrentLevel: () => number
  getCurrentTrack: () => number
  getCurrentLeague: () => number
  getCurrentTrackName: () => string
  getLevelNames: () => string[][]
  getLeagueNames: () => string[]
  getLevelDifficultyNames: () => string[]
  getRecords: (levelIndex: number, trackIndex: number, leagueIndex: number) => string[]
  clearAllRecords: () => void

  isAudioMuted: () => boolean
  setAudioMuted: (muted: boolean) => void
  getSettings: () => GameUISettings
  updateSetting: <K extends keyof GameUISettings>(key: K, value: GameUISettings[K]) => void

  pressKey: (code: string) => void
  releaseKey: (code: string) => void

  onStateChange: (listener: (state: GameRuntimeState) => void) => () => void
}

const SETTINGS_STORAGE_KEY = 'gravity_defied_settings_v3'

export function loadStoredSettings(): GameUISettings {
  const defaults: GameUISettings = {
    sound: true,
    haptics: true,
    controlsMode: 'auto',
    driverSprite: false,
    bikeSprite: false,
    shadows: true,
    perspective: true,
    lookAhead: true,
  }

  try {
    const raw = localStorage.getItem(SETTINGS_STORAGE_KEY)
    if (raw !== null) {
      const parsed = JSON.parse(raw) as Partial<GameUISettings>
      return { ...defaults, ...parsed }
    }
  } catch (_error) {
    void _error
  }

  return defaults
}

export function saveStoredSettings(settings: GameUISettings): void {
  try {
    localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings))
  } catch (_error) {
    void _error
  }
}

export class GameUI {
  private readonly root: HTMLElement
  private readonly controller: GameRuntimeController
  private container: HTMLDivElement | null = null
  private hudElement: HTMLDivElement | null = null
  private drawerElement: HTMLDivElement | null = null
  private drawerPanelElement: HTMLDivElement | null = null
  private drawerNavElement: HTMLDivElement | null = null
  private drawerBodyElement: HTMLDivElement | null = null
  private finishDialogElement: HTMLDivElement | null = null
  private pauseDialogElement: HTMLDivElement | null = null
  private confirmDialogElement: HTMLDivElement | null = null

  private activeTab: 'tracks' | 'settings' = 'tracks'
  private selectedLevelTab = 0
  private selectedLeagueTab = 0

  private readonly activePointers = new Map<number, { button: HTMLElement; key: string }>()
  private unsubscribeStateChange: (() => void) | null = null
  private currentState: GameRuntimeState

  // Global bound handlers for reliable pointer release
  private readonly boundGlobalPointerUp: (e: PointerEvent) => void
  private readonly boundGlobalPointerCancel: (e: PointerEvent) => void
  private readonly boundWindowBlur: () => void
  private readonly boundContextMenu: (e: MouseEvent) => void

  constructor(root: HTMLElement, controller: GameRuntimeController) {
    this.root = root
    this.controller = controller
    this.selectedLevelTab = controller.getCurrentLevel()
    this.selectedLeagueTab = controller.getCurrentLeague()

    this.currentState = {
      isPaused: false,
      isInMenu: false,
      isFinished: false,
      levelIndex: controller.getCurrentLevel(),
      trackIndex: controller.getCurrentTrack(),
      leagueIndex: controller.getCurrentLeague(),
      trackName: controller.getCurrentTrackName(),
      leagueName: controller.getLeagueNames()[controller.getCurrentLeague()] ?? '100cc',
      difficultyName: controller.getLevelDifficultyNames()[controller.getCurrentLevel()] ?? 'Oson',
    }

    this.boundGlobalPointerUp = (e) => this.handleGlobalPointerRelease(e)
    this.boundGlobalPointerCancel = (e) => this.handleGlobalPointerRelease(e)
    this.boundWindowBlur = () => this.releaseAllKeys()
    this.boundContextMenu = (e) => {
      e.preventDefault()
    }

    this.init()
  }

  private init(): void {
    const container = document.createElement('div')
    container.className = 'game-ui-layer'
    this.container = container

    this.hudElement = this.createHud()
    container.appendChild(this.hudElement)

    this.root.appendChild(container)

    this.unsubscribeStateChange = this.controller.onStateChange((state) => {
      this.handleStateChange(state)
    })

    window.addEventListener('pointerup', this.boundGlobalPointerUp, { passive: false })
    window.addEventListener('pointercancel', this.boundGlobalPointerCancel, { passive: false })
    window.addEventListener('blur', this.boundWindowBlur)
    window.addEventListener('contextmenu', this.boundContextMenu, { capture: true, passive: false })
    document.addEventListener('visibilitychange', this.boundWindowBlur)

    // Globally suppress text selection and callouts
    document.addEventListener(
      'selectstart',
      (e) => {
        const target = e.target as HTMLElement | null
        if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) return
        e.preventDefault()
      },
      { capture: true, passive: false },
    )

    document.addEventListener('selectionchange', () => {
      const sel = window.getSelection()
      if (sel && !sel.isCollapsed) {
        sel.removeAllRanges()
      }
    })

    this.updateHudVisibility()
    this.updateHudInfo()
  }

  private triggerHaptic(): void {
    if (this.controller.getSettings().haptics && typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      try {
        navigator.vibrate(10)
      } catch (_error) {
        void _error
      }
    }
  }

  private handleGlobalPointerRelease(event: PointerEvent): void {
    const entry = this.activePointers.get(event.pointerId)
    if (!entry) return

    this.activePointers.delete(event.pointerId)
    entry.button.classList.remove('is-active')
    this.controller.releaseKey(entry.key)
  }

  private releaseAllKeys(): void {
    for (const entry of this.activePointers.values()) {
      entry.button.classList.remove('is-active')
      this.controller.releaseKey(entry.key)
    }
    this.activePointers.clear()
  }

  // ==========================================
  // HUD (MINIMALIST IN-GAME INTERFACE)
  // ==========================================

  private createHud(): HTMLDivElement {
    const hud = document.createElement('div')
    hud.className = 'game-hud'
    hud.setAttribute('aria-label', 'Boshqaruv paneli')

    // Top Header: Minimalist Top Bar with Burger Menu
    const topBar = document.createElement('div')
    topBar.className = 'game-hud__top'

    // Left: Minimal Hamburger Button
    const burgerBtn = document.createElement('button')
    burgerBtn.type = 'button'
    burgerBtn.className = 'hud-btn hud-btn--burger'
    burgerBtn.setAttribute('aria-label', 'Menyuni ochish')
    burgerBtn.title = 'Menyu'
    burgerBtn.innerHTML = `
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
        <line x1="4" y1="7" x2="20" y2="7"/>
        <line x1="4" y1="12" x2="20" y2="12"/>
        <line x1="4" y1="17" x2="20" y2="17"/>
      </svg>
    `
    burgerBtn.addEventListener('click', (e) => {
      e.preventDefault()
      e.stopPropagation()
      this.triggerHaptic()
      this.openDrawer('tracks')
    })

    // Center: Subtle, non-distracting track title
    const trackBadge = document.createElement('button')
    trackBadge.type = 'button'
    trackBadge.className = 'hud-track-badge'
    trackBadge.setAttribute('aria-label', 'Trassani almashtirish')
    trackBadge.innerHTML = `
      <span class="hud-track-badge__name">${this.getTrackBadgeText()}</span>
      <span class="hud-track-badge__sep">/</span>
      <span class="hud-track-badge__bike">${this.currentState.leagueName}</span>
    `
    trackBadge.addEventListener('click', (e) => {
      e.preventDefault()
      e.stopPropagation()
      this.triggerHaptic()
      this.openDrawer('tracks')
    })

    // Right: Minimal Restart & Sound Buttons
    const rightGroup = document.createElement('div')
    rightGroup.className = 'hud-top-right'

    const restartBtn = document.createElement('button')
    restartBtn.type = 'button'
    restartBtn.className = 'hud-btn hud-btn--restart'
    restartBtn.setAttribute('aria-label', 'Trassani qayta boshlash')
    restartBtn.title = 'Qayta (R)'
    restartBtn.innerHTML = `
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/>
        <path d="M3 3v5h5"/>
      </svg>
    `
    restartBtn.addEventListener('click', (e) => {
      e.preventDefault()
      e.stopPropagation()
      this.triggerHaptic()
      this.controller.restart()
    })

    const soundBtn = document.createElement('button')
    soundBtn.type = 'button'
    soundBtn.className = 'hud-btn hud-btn--sound'
    soundBtn.setAttribute('aria-label', 'Ovozni o‘zgartirish')
    this.updateSoundButtonHtml(soundBtn)
    soundBtn.addEventListener('click', (e) => {
      e.preventDefault()
      e.stopPropagation()
      this.triggerHaptic()
      const nextMuted = !this.controller.isAudioMuted()
      this.controller.setAudioMuted(nextMuted)
      this.controller.updateSetting('sound', !nextMuted)
      this.updateSoundButtonHtml(soundBtn)
    })

    const preventCallout = (el: HTMLElement) => {
      el.addEventListener('contextmenu', (e) => {
        e.preventDefault()
        e.stopPropagation()
      }, { capture: true })
      el.addEventListener('selectstart', (e) => {
        e.preventDefault()
      }, { capture: true })
    }

    preventCallout(burgerBtn)
    preventCallout(trackBadge)
    preventCallout(restartBtn)
    preventCallout(soundBtn)

    rightGroup.append(restartBtn, soundBtn)
    topBar.append(burgerBtn, trackBadge, rightGroup)

    // Bottom Controls: Clean, Minimalist, Pure Tactile Buttons
    const bottomControls = document.createElement('div')
    bottomControls.className = 'game-hud__bottom'

    // Left Cluster: Lean backward / forward
    const leftCluster = document.createElement('div')
    leftCluster.className = 'game-hud__cluster game-hud__cluster--lean'

    const leanBackBtn = this.createControlButton('KeyA', 'control-btn--lean', 'Orqaga og‘ish (A)', `
      <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
        <line x1="19" y1="12" x2="5" y2="12"/>
        <polyline points="12 19 5 12 12 5"/>
      </svg>
    `)

    const leanForwardBtn = this.createControlButton('KeyD', 'control-btn--lean', 'Oldinga og‘ish (D)', `
      <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
        <line x1="5" y1="12" x2="19" y2="12"/>
        <polyline points="12 5 19 12 12 19"/>
      </svg>
    `)

    leftCluster.append(leanBackBtn, leanForwardBtn)

    // Right Cluster: Accelerate (Gas) & Brake
    const rightCluster = document.createElement('div')
    rightCluster.className = 'game-hud__cluster game-hud__cluster--drive'

    const brakeBtn = this.createControlButton('KeyS', 'control-btn--brake', 'Tormoz (S)', `
      <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
        <line x1="12" y1="5" x2="12" y2="19"/>
        <polyline points="19 12 12 19 5 12"/>
      </svg>
    `)

    const gasBtn = this.createControlButton('KeyW', 'control-btn--gas', 'Gaz (W)', `
      <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
        <line x1="12" y1="19" x2="12" y2="5"/>
        <polyline points="5 12 12 5 19 12"/>
      </svg>
    `)

    rightCluster.append(brakeBtn, gasBtn)
    bottomControls.append(leftCluster, rightCluster)

    hud.append(topBar, bottomControls)
    return hud
  }

  private createControlButton(
    key: string,
    extraClass: string,
    ariaLabel: string,
    iconSvg: string,
  ): HTMLButtonElement {
    const btn = document.createElement('button')
    btn.type = 'button'
    btn.className = `control-btn ${extraClass}`
    btn.dataset.gameKey = key
    btn.setAttribute('aria-label', ariaLabel)
    btn.setAttribute('draggable', 'false')

    // Pure button without text to prevent selection / share callouts completely
    btn.innerHTML = `<div class="control-btn__icon">${iconSvg}</div>`

    // Completely prevent context menu, callout, and text selection
    btn.addEventListener('contextmenu', (e) => {
      e.preventDefault()
      e.stopPropagation()
      return false
    }, { capture: true })

    btn.addEventListener('selectstart', (e) => {
      e.preventDefault()
      return false
    }, { capture: true })

    // On iOS Safari, touchstart preventDefault blocks native magnifier and callout menu (Share, Copy, etc.)
    btn.addEventListener('touchstart', (e) => {
      e.preventDefault()
    }, { passive: false })

    const press = (pointerId: number) => {
      if (this.activePointers.has(pointerId)) return

      this.triggerHaptic()
      btn.classList.add('is-active')
      this.activePointers.set(pointerId, { button: btn, key })
      this.controller.pressKey(key)
    }

    const release = (pointerId: number) => {
      if (this.activePointers.has(pointerId)) {
        this.activePointers.delete(pointerId)
        btn.classList.remove('is-active')
        this.controller.releaseKey(key)
      }
    }

    btn.addEventListener('pointerdown', (e: PointerEvent) => {
      e.preventDefault()
      e.stopPropagation()

      try {
        btn.setPointerCapture(e.pointerId)
      } catch (_err) {
        void _err
      }

      press(e.pointerId)
    }, { passive: false })

    btn.addEventListener('pointerup', (e: PointerEvent) => {
      e.preventDefault()
      e.stopPropagation()
      release(e.pointerId)
    }, { passive: false })

    btn.addEventListener('pointercancel', (e: PointerEvent) => {
      e.preventDefault()
      e.stopPropagation()
      release(e.pointerId)
    }, { passive: false })

    btn.addEventListener('lostpointercapture', (e: PointerEvent) => {
      release(e.pointerId)
    })

    btn.addEventListener('pointerleave', (e: PointerEvent) => {
      if (!btn.hasPointerCapture || !btn.hasPointerCapture(e.pointerId)) {
        release(e.pointerId)
      }
    })

    return btn
  }

  private updateSoundButtonHtml(btn: HTMLButtonElement): void {
    const isMuted = this.controller.isAudioMuted()
    if (isMuted) {
      btn.innerHTML = `
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <line x1="1" y1="1" x2="23" y2="23"/>
          <path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6"/>
          <path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2a7 7 0 0 1-.11 1.23"/>
        </svg>
      `
      btn.classList.add('hud-btn--off')
    } else {
      btn.innerHTML = `
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
          <path d="M15.54 8.46a5 5 0 0 1 0 7.07"/>
          <path d="M19.07 4.93a10 10 0 0 1 0 14.14"/>
        </svg>
      `
      btn.classList.remove('hud-btn--off')
    }
  }

  private updateHudVisibility(): void {
    if (!this.hudElement) return
    const mode = this.controller.getSettings().controlsMode
    const bottomEl = this.hudElement.querySelector('.game-hud__bottom') as HTMLElement | null
    if (!bottomEl) return

    if (mode === 'hidden') {
      bottomEl.style.display = 'none'
    } else if (mode === 'always') {
      bottomEl.style.display = 'flex'
    } else {
      bottomEl.style.removeProperty('display')
    }
  }

  private getTrackBadgeText(): string {
    const diff = this.currentState.difficultyName
    const name = this.currentState.trackName || 'Intro'
    return `${diff.toUpperCase()} · ${name.toUpperCase()}`
  }

  private updateHudInfo(): void {
    if (!this.hudElement) return
    const titleEl = this.hudElement.querySelector('.hud-track-badge__name')
    const bikeEl = this.hudElement.querySelector('.hud-track-badge__bike')

    if (titleEl) {
      titleEl.textContent = `${this.currentState.difficultyName.toUpperCase()} · ${(this.currentState.trackName || 'Intro').toUpperCase()}`
    }
    if (bikeEl) {
      bikeEl.textContent = this.currentState.leagueName.toUpperCase()
    }
  }

  private handleStateChange(state: GameRuntimeState): void {
    this.currentState = state
    this.updateHudInfo()

    if (state.isFinished) {
      this.showFinishedModal(state.finishTimeStr ?? '00:00.00', state.finishRank ?? 3)
    } else if (this.finishDialogElement) {
      this.closeFinishedModal()
    }

    if (state.isPaused && !state.isInMenu && !this.drawerElement && !this.finishDialogElement) {
      this.showPauseModal()
    } else if (!state.isPaused && this.pauseDialogElement) {
      this.closePauseModal()
    }
  }

  // ==========================================
  // BURGER MENU DRAWER (SLIDE-OUT MODERN DRAWER)
  // ==========================================

  openDrawer(tab: 'tracks' | 'settings' = 'tracks'): void {
    this.releaseAllKeys()
    this.activeTab = tab
    this.selectedLevelTab = this.controller.getCurrentLevel()
    this.selectedLeagueTab = this.controller.getCurrentLeague()

    if (this.pauseDialogElement) {
      this.closePauseModal()
    }
    if (this.finishDialogElement) {
      this.closeFinishedModal()
    }

    if (this.drawerElement && this.drawerPanelElement && this.drawerBodyElement && this.drawerNavElement) {
      this.updateDrawerContent()
      return
    }

    const overlay = document.createElement('div')
    overlay.className = 'drawer-overlay'
    overlay.setAttribute('role', 'dialog')
    overlay.setAttribute('aria-modal', 'true')

    // Close when clicking directly on the overlay backdrop
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        this.triggerHaptic()
        this.closeDrawer()
      }
    })

    const drawer = document.createElement('div')
    drawer.className = 'drawer-panel'
    drawer.addEventListener('click', (e) => {
      e.stopPropagation()
    })

    // Drawer Header
    const header = document.createElement('div')
    header.className = 'drawer-header'

    const titleGroup = document.createElement('div')
    titleGroup.className = 'drawer-header__title'
    titleGroup.innerHTML = `
      <div class="drawer-title">GRAVITY DEFIED</div>
      <div class="drawer-subtitle">2026 EDITION</div>
    `

    const closeBtn = document.createElement('button')
    closeBtn.type = 'button'
    closeBtn.className = 'drawer-close-btn'
    closeBtn.setAttribute('aria-label', 'Yopish')
    closeBtn.innerHTML = `
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
        <line x1="18" y1="6" x2="6" y2="18"/>
        <line x1="6" y1="6" x2="18" y2="18"/>
      </svg>
    `
    closeBtn.addEventListener('click', (e) => {
      e.stopPropagation()
      this.triggerHaptic()
      this.closeDrawer()
    })

    header.append(titleGroup, closeBtn)

    // Segmented Navigation Tabs
    const nav = document.createElement('div')
    nav.className = 'drawer-nav'

    const tabs: Array<{ id: 'tracks' | 'settings'; label: string }> = [
      { id: 'tracks', label: 'Trassalar' },
      { id: 'settings', label: 'Sozlamalar' },
    ]

    for (const tabItem of tabs) {
      const tabBtn = document.createElement('button')
      tabBtn.type = 'button'
      tabBtn.className = `drawer-tab ${this.activeTab === tabItem.id ? 'is-active' : ''}`
      tabBtn.dataset.tabId = tabItem.id
      tabBtn.textContent = tabItem.label
      tabBtn.addEventListener('click', (e) => {
        e.stopPropagation()
        this.triggerHaptic()
        this.activeTab = tabItem.id
        this.updateDrawerContent()
      })
      nav.appendChild(tabBtn)
    }

    // Scrollable drawer body
    const body = document.createElement('div')
    body.className = 'drawer-body'

    // Footer with sponsor link
    const footer = document.createElement('div')
    footer.className = 'drawer-footer'
    footer.innerHTML = `
      <a class="drawer-sponsor" href="https://t.me/bkzd19" target="_blank" rel="noopener noreferrer">
        <span class="drawer-sponsor__dot"></span>
        <span>Powered by bkzd</span>
      </a>
    `

    drawer.append(header, nav, body, footer)
    overlay.appendChild(drawer)

    this.drawerElement = overlay
    this.drawerPanelElement = drawer
    this.drawerNavElement = nav
    this.drawerBodyElement = body

    this.container?.appendChild(overlay)
    this.updateDrawerContent()
    this.controller.openMenu()
  }

  closeDrawer(): void {
    if (this.drawerElement) {
      this.drawerElement.remove()
      this.drawerElement = null
      this.drawerPanelElement = null
      this.drawerNavElement = null
      this.drawerBodyElement = null
    }
    this.controller.closeMenu()
  }

  private updateDrawerContent(): void {
    if (!this.drawerBodyElement || !this.drawerNavElement) return

    // Update active tab buttons without recreating DOM
    const tabButtons = this.drawerNavElement.querySelectorAll<HTMLButtonElement>('.drawer-tab')
    tabButtons.forEach((btn) => {
      const tabId = btn.dataset.tabId
      if (tabId === this.activeTab) {
        btn.classList.add('is-active')
      } else {
        btn.classList.remove('is-active')
      }
    })

    // Update body content smoothly
    this.drawerBodyElement.innerHTML = ''
    if (this.activeTab === 'tracks') {
      this.drawerBodyElement.appendChild(this.renderTracksTab())
    } else if (this.activeTab === 'settings') {
      this.drawerBodyElement.appendChild(this.renderSettingsTab())
    }
  }

  // ==========================================
  // TAB 1: TRASSALAR (TRACKS)
  // ==========================================

  private renderTracksTab(): HTMLElement {
    const container = document.createElement('div')
    container.className = 'tab-content tab-tracks'

    // Difficulty Selector
    const diffSection = document.createElement('div')
    diffSection.className = 'panel-section'

    const diffTitle = document.createElement('div')
    diffTitle.className = 'panel-section-title'
    diffTitle.textContent = 'Qiyinlik darajasi'

    const diffRow = document.createElement('div')
    diffRow.className = 'segmented-control'

    const diffs = [
      { id: 0, label: 'Oson' },
      { id: 1, label: 'O‘rtacha' },
      { id: 2, label: 'Qiyin' },
    ]

    for (const diff of diffs) {
      const btn = document.createElement('button')
      btn.type = 'button'
      btn.className = `segmented-item ${this.selectedLevelTab === diff.id ? 'is-active' : ''}`
      btn.textContent = diff.label
      btn.addEventListener('click', (e) => {
        e.stopPropagation()
        this.triggerHaptic()
        this.selectedLevelTab = diff.id
        this.updateDrawerContent()
      })
      diffRow.appendChild(btn)
    }
    diffSection.append(diffTitle, diffRow)

    // Bike Selector
    const bikeSection = document.createElement('div')
    bikeSection.className = 'panel-section'

    const bikeTitle = document.createElement('div')
    bikeTitle.className = 'panel-section-title'
    bikeTitle.textContent = 'Motosikl'

    const bikeRow = document.createElement('div')
    bikeRow.className = 'segmented-control'

    const leagues = this.controller.getLeagueNames()
    leagues.forEach((name, idx) => {
      const btn = document.createElement('button')
      btn.type = 'button'
      btn.className = `segmented-item ${this.selectedLeagueTab === idx ? 'is-active' : ''}`
      btn.textContent = name
      btn.addEventListener('click', (e) => {
        e.stopPropagation()
        this.triggerHaptic()
        this.selectedLeagueTab = idx
        this.controller.setLeague(idx)
        this.updateDrawerContent()
      })
      bikeRow.appendChild(btn)
    })
    bikeSection.append(bikeTitle, bikeRow)

    // Track Cards
    const tracksSection = document.createElement('div')
    tracksSection.className = 'panel-section'

    const tracksTitle = document.createElement('div')
    tracksTitle.className = 'panel-section-title'
    tracksTitle.textContent = 'Trassani tanlang'

    const grid = document.createElement('div')
    grid.className = 'track-list'

    const levelTracks = this.controller.getLevelNames()[this.selectedLevelTab] ?? []
    const currentLvl = this.controller.getCurrentLevel()
    const currentTrk = this.controller.getCurrentTrack()

    levelTracks.forEach((trackName, trackIdx) => {
      const isCurrent = currentLvl === this.selectedLevelTab && currentTrk === trackIdx
      const card = document.createElement('button')
      card.type = 'button'
      card.className = `track-item ${isCurrent ? 'is-active' : ''}`

      const records = this.controller.getRecords(this.selectedLevelTab, trackIdx, this.selectedLeagueTab)
      const bestRecord = records[0] ? records[0].replace(/^[A-Z0-9\s]+\s+/, '') : '--:--.--'

      card.innerHTML = `
        <div class="track-item__index">${trackIdx + 1 < 10 ? '0' + (trackIdx + 1) : trackIdx + 1}</div>
        <div class="track-item__info">
          <div class="track-item__name">${trackName}</div>
          <div class="track-item__time">${bestRecord}</div>
        </div>
        ${isCurrent ? '<div class="track-item__dot"></div>' : ''}
      `

      card.addEventListener('click', (e) => {
        e.stopPropagation()
        this.triggerHaptic()
        this.controller.setLeague(this.selectedLeagueTab)
        this.controller.loadTrack(this.selectedLevelTab, trackIdx)
        this.closeDrawer()
      })

      grid.appendChild(card)
    })

    tracksSection.append(tracksTitle, grid)

    // Footer actions inside tab
    const actionRow = document.createElement('div')
    actionRow.className = 'tab-actions'

    const playBtn = document.createElement('button')
    playBtn.type = 'button'
    playBtn.className = 'btn-minimal btn-minimal--primary'
    playBtn.textContent = 'Davom ettirish'
    playBtn.addEventListener('click', (e) => {
      e.stopPropagation()
      this.triggerHaptic()
      this.closeDrawer()
    })

    const restartBtn = document.createElement('button')
    restartBtn.type = 'button'
    restartBtn.className = 'btn-minimal btn-minimal--secondary'
    restartBtn.textContent = 'Qayta boshlash'
    restartBtn.addEventListener('click', (e) => {
      e.stopPropagation()
      this.triggerHaptic()
      this.controller.restart()
      this.closeDrawer()
    })

    actionRow.append(playBtn, restartBtn)

    container.append(diffSection, bikeSection, tracksSection, actionRow)
    return container
  }

  // ==========================================
  // TAB 2: SOZLAMALAR (SETTINGS)
  // ==========================================

  private renderSettingsTab(): HTMLElement {
    const container = document.createElement('div')
    container.className = 'tab-content tab-settings'

    const settings = this.controller.getSettings()

    const list = document.createElement('div')
    list.className = 'settings-group'

    list.appendChild(
      this.createSettingRow('O‘yin ovozi', 'Dvigatel va harakat tovushlari', settings.sound, (val) => {
        this.controller.updateSetting('sound', val)
        this.controller.setAudioMuted(!val)
        this.updateHudVisibility()
      }),
    )

    list.appendChild(
      this.createSettingRow('Vibratsiya', 'Tugmalar bosilganda haptik sezgi', settings.haptics, (val) => {
        this.controller.updateSetting('haptics', val)
      }),
    )

    list.appendChild(
      this.createSettingRow('3D Perspektiva', 'Trassa chuqurlik effekti', settings.perspective, (val) => {
        this.controller.updateSetting('perspective', val)
      }),
    )

    list.appendChild(
      this.createSettingRow('Soyalar', 'Motosikl va relyef soyasi', settings.shadows, (val) => {
        this.controller.updateSetting('shadows', val)
      }),
    )

    list.appendChild(
      this.createSettingRow('Aqlli kamera', 'Harakat tezligiga qarab oldinga siljish', settings.lookAhead, (val) => {
        this.controller.updateSetting('lookAhead', val)
      }),
    )

    list.appendChild(
      this.createSettingRow('Haydovchi teksturasi', 'Teksturali yoki klassik chiziqli rejim', settings.driverSprite, (val) => {
        this.controller.updateSetting('driverSprite', val)
      }),
    )

    list.appendChild(
      this.createSettingRow('Motosikl teksturasi', 'Teksturali yoki klassik chiziqli rejim', settings.bikeSprite, (val) => {
        this.controller.updateSetting('bikeSprite', val)
      }),
    )

    // Controls Mode
    const controlsRow = document.createElement('div')
    controlsRow.className = 'setting-row'

    const controlsMeta = document.createElement('div')
    controlsMeta.className = 'setting-row__meta'
    controlsMeta.innerHTML = `
      <div class="setting-row__title">Ekrandagi tugmalar</div>
      <div class="setting-row__desc">Mobil boshqaruv tugmalarini ko‘rsatish</div>
    `

    const modePicker = document.createElement('div')
    modePicker.className = 'segmented-control segmented-control--compact'

    const modes: Array<{ id: 'auto' | 'always' | 'hidden'; label: string }> = [
      { id: 'auto', label: 'Avto' },
      { id: 'always', label: 'Doimiy' },
      { id: 'hidden', label: 'Yashirish' },
    ]

    for (const m of modes) {
      const btn = document.createElement('button')
      btn.type = 'button'
      btn.className = `segmented-item ${settings.controlsMode === m.id ? 'is-active' : ''}`
      btn.textContent = m.label
      btn.addEventListener('click', (e) => {
        e.stopPropagation()
        this.triggerHaptic()
        this.controller.updateSetting('controlsMode', m.id)
        this.updateHudVisibility()
        this.updateDrawerContent()
      })
      modePicker.appendChild(btn)
    }

    controlsRow.append(controlsMeta, modePicker)
    list.appendChild(controlsRow)

    // Clear Records
    const clearBtn = document.createElement('button')
    clearBtn.type = 'button'
    clearBtn.className = 'btn-minimal btn-minimal--danger'
    clearBtn.textContent = 'Barcha rekordlarni tozalash'
    clearBtn.addEventListener('click', (e) => {
      e.stopPropagation()
      this.triggerHaptic()
      this.showConfirmDialog(
        'Barcha rekordlarni tozalash',
        'Barcha o‘rnatilgan vaqt natijalari o‘chib ketadi. Buni tasdiqlaysizmi?',
        () => {
          this.controller.clearAllRecords()
          this.updateDrawerContent()
        },
      )
    })

    container.append(list, clearBtn)
    return container
  }

  private createSettingRow(
    title: string,
    desc: string,
    initialValue: boolean,
    onChange: (val: boolean) => void,
  ): HTMLDivElement {
    const row = document.createElement('div')
    row.className = 'setting-row'

    const meta = document.createElement('div')
    meta.className = 'setting-row__meta'
    meta.innerHTML = `
      <div class="setting-row__title">${title}</div>
      <div class="setting-row__desc">${desc}</div>
    `

    const switchLabel = document.createElement('label')
    switchLabel.className = 'minimal-switch'

    const checkbox = document.createElement('input')
    checkbox.type = 'checkbox'
    checkbox.checked = initialValue
    checkbox.addEventListener('change', () => {
      this.triggerHaptic()
      onChange(checkbox.checked)
    })

    const slider = document.createElement('span')
    slider.className = 'minimal-switch__slider'

    switchLabel.append(checkbox, slider)
    row.append(meta, switchLabel)
    return row
  }

  // ==========================================
  // FINISHED DIALOG (MINIMALIST MARRA)
  // ==========================================

  showFinishedModal(timeStr: string, rank: number): void {
    this.releaseAllKeys()
    if (this.finishDialogElement) {
      this.closeFinishedModal()
    }

    const overlay = document.createElement('div')
    overlay.className = 'dialog-overlay'
    overlay.setAttribute('role', 'dialog')
    overlay.setAttribute('aria-modal', 'true')
    this.finishDialogElement = overlay

    const card = document.createElement('div')
    card.className = 'dialog-card'

    let rankBadge = ''
    if (rank === 0) {
      rankBadge = '<div class="dialog-badge">1-O‘RIN REKORDI</div>'
    } else if (rank === 1) {
      rankBadge = '<div class="dialog-badge">2-O‘RIN NATIJASI</div>'
    } else if (rank === 2) {
      rankBadge = '<div class="dialog-badge">3-O‘RIN NATIJASI</div>'
    } else {
      rankBadge = '<div class="dialog-badge">TRASSA YAKUNLANDI</div>'
    }

    const trackName = this.controller.getCurrentTrackName()
    const diffName = this.controller.getLevelDifficultyNames()[this.controller.getCurrentLevel()] ?? 'Oson'

    card.innerHTML = `
      <div class="dialog-header">
        <div class="dialog-title">MARRA</div>
        <div class="dialog-subtitle">${diffName} · ${trackName}</div>
      </div>
      ${rankBadge}
      <div class="dialog-timer">${timeStr}</div>
      <div class="dialog-actions">
        <button type="button" class="btn-minimal btn-minimal--primary finish-btn-next">Keyingi trassa</button>
        <button type="button" class="btn-minimal btn-minimal--secondary finish-btn-retry">Qayta o‘ynash</button>
        <button type="button" class="btn-minimal btn-minimal--secondary finish-btn-menu">Barcha trassalar</button>
      </div>
    `

    card.querySelector('.finish-btn-next')?.addEventListener('click', () => {
      this.triggerHaptic()
      this.closeFinishedModal()
      this.controller.loadNextTrack()
    })

    card.querySelector('.finish-btn-retry')?.addEventListener('click', () => {
      this.triggerHaptic()
      this.closeFinishedModal()
      this.controller.restart()
    })

    card.querySelector('.finish-btn-menu')?.addEventListener('click', () => {
      this.triggerHaptic()
      this.closeFinishedModal()
      this.openDrawer('tracks')
    })

    overlay.appendChild(card)
    this.container?.appendChild(overlay)
  }

  closeFinishedModal(): void {
    if (this.finishDialogElement) {
      this.finishDialogElement.remove()
      this.finishDialogElement = null
    }
  }

  // ==========================================
  // QUICK PAUSE DIALOG
  // ==========================================

  showPauseModal(): void {
    this.releaseAllKeys()
    if (this.pauseDialogElement) return

    const overlay = document.createElement('div')
    overlay.className = 'dialog-overlay'
    overlay.setAttribute('role', 'dialog')
    overlay.setAttribute('aria-modal', 'true')
    this.pauseDialogElement = overlay

    const card = document.createElement('div')
    card.className = 'dialog-card'

    const trackName = this.controller.getCurrentTrackName()
    const diffName = this.controller.getLevelDifficultyNames()[this.controller.getCurrentLevel()] ?? 'Oson'

    card.innerHTML = `
      <div class="dialog-header">
        <div class="dialog-title">PAUZA</div>
        <div class="dialog-subtitle">${diffName} · ${trackName}</div>
      </div>
      <div class="dialog-actions">
        <button type="button" class="btn-minimal btn-minimal--primary pause-btn-resume">Davom ettirish</button>
        <button type="button" class="btn-minimal btn-minimal--secondary pause-btn-restart">Qayta boshlash</button>
        <button type="button" class="btn-minimal btn-minimal--secondary pause-btn-menu">Menyu / Trassalar</button>
      </div>
    `

    card.querySelector('.pause-btn-resume')?.addEventListener('click', () => {
      this.triggerHaptic()
      this.closePauseModal()
      this.controller.startOrResume()
    })

    card.querySelector('.pause-btn-restart')?.addEventListener('click', () => {
      this.triggerHaptic()
      this.closePauseModal()
      this.controller.restart()
    })

    card.querySelector('.pause-btn-menu')?.addEventListener('click', () => {
      this.triggerHaptic()
      this.closePauseModal()
      this.openDrawer('tracks')
    })

    overlay.appendChild(card)
    this.container?.appendChild(overlay)
  }

  closePauseModal(): void {
    if (this.pauseDialogElement) {
      this.pauseDialogElement.remove()
      this.pauseDialogElement = null
    }
  }

  // ==========================================
  // CONFIRM DIALOG
  // ==========================================

  private showConfirmDialog(title: string, message: string, onConfirm: () => void): void {
    if (this.confirmDialogElement) {
      this.confirmDialogElement.remove()
    }

    const overlay = document.createElement('div')
    overlay.className = 'dialog-overlay'
    this.confirmDialogElement = overlay

    const card = document.createElement('div')
    card.className = 'dialog-card'

    card.innerHTML = `
      <div class="dialog-header">
        <div class="dialog-title">${title}</div>
        <div class="dialog-subtitle">${message}</div>
      </div>
      <div class="dialog-actions">
        <button type="button" class="btn-minimal btn-minimal--danger confirm-btn-yes">Tozalansin</button>
        <button type="button" class="btn-minimal btn-minimal--secondary confirm-btn-no">Bekor qilish</button>
      </div>
    `

    card.querySelector('.confirm-btn-yes')?.addEventListener('click', () => {
      this.triggerHaptic()
      overlay.remove()
      this.confirmDialogElement = null
      onConfirm()
    })

    card.querySelector('.confirm-btn-no')?.addEventListener('click', () => {
      this.triggerHaptic()
      overlay.remove()
      this.confirmDialogElement = null
    })

    overlay.appendChild(card)
    this.container?.appendChild(overlay)
  }

  destroy(): void {
    window.removeEventListener('pointerup', this.boundGlobalPointerUp)
    window.removeEventListener('pointercancel', this.boundGlobalPointerCancel)
    window.removeEventListener('blur', this.boundWindowBlur)
    window.removeEventListener('contextmenu', this.boundContextMenu, { capture: true })
    document.removeEventListener('visibilitychange', this.boundWindowBlur)

    this.unsubscribeStateChange?.()
    this.releaseAllKeys()
    this.container?.remove()
    this.container = null
  }
}
