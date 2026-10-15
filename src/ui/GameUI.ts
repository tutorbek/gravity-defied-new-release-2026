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
  openMenu: (tab?: 'tracks' | 'settings' | 'records' | 'controls') => void
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

const SETTINGS_STORAGE_KEY = 'gravity_defied_settings_v2'

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
  private modalElement: HTMLDivElement | null = null
  private finishDialogElement: HTMLDivElement | null = null
  private pauseDialogElement: HTMLDivElement | null = null
  private confirmDialogElement: HTMLDivElement | null = null

  private activeTab: 'tracks' | 'settings' | 'records' | 'controls' = 'tracks'
  private selectedLevelTab = 0
  private selectedLeagueTab = 0

  private readonly activePointerKeys = new Map<number, string>()
  private readonly activePointerButtons = new Map<number, HTMLElement>()
  private unsubscribeStateChange: (() => void) | null = null
  private currentState: GameRuntimeState

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

    this.updateHudVisibility()
    this.updateHudInfo()
  }

  private triggerHaptic(): void {
    if (this.controller.getSettings().haptics && typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      try {
        navigator.vibrate(12)
      } catch (_error) {
        void _error
      }
    }
  }

  private createHud(): HTMLDivElement {
    const hud = document.createElement('div')
    hud.className = 'game-hud'
    hud.setAttribute('aria-label', 'Mobil boshqaruv paneli')

    // Top Header Bar
    const topBar = document.createElement('div')
    topBar.className = 'game-hud__top'

    const topButtonsLeft = document.createElement('div')
    topButtonsLeft.className = 'game-hud__top-group'

    const menuBtn = document.createElement('button')
    menuBtn.type = 'button'
    menuBtn.className = 'hud-icon-button hud-icon-button--menu'
    menuBtn.title = 'Menyuni ochish (Esc)'
    menuBtn.innerHTML = `
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
        <line x1="3" y1="6" x2="21" y2="6"/>
        <line x1="3" y1="12" x2="21" y2="12"/>
        <line x1="3" y1="18" x2="21" y2="18"/>
      </svg>
      <span>Menyu</span>
    `
    menuBtn.addEventListener('click', (e) => {
      e.stopPropagation()
      this.triggerHaptic()
      this.openMenuModal('tracks')
    })

    const restartBtn = document.createElement('button')
    restartBtn.type = 'button'
    restartBtn.className = 'hud-icon-button hud-icon-button--restart'
    restartBtn.title = 'Trassani qayta boshlash (R)'
    restartBtn.innerHTML = `
      <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
        <path d="M21 2v6h-6"/>
        <path d="M3 12a9 9 0 0 1 15.36-6.36L21 8"/>
        <path d="M3 22v-6h6"/>
        <path d="M21 12a9 9 0 0 1-15.36 6.36L3 16"/>
      </svg>
      <span>Qayta</span>
    `
    restartBtn.addEventListener('click', (e) => {
      e.stopPropagation()
      this.triggerHaptic()
      this.controller.restart()
    })

    const soundBtn = document.createElement('button')
    soundBtn.type = 'button'
    soundBtn.className = 'hud-icon-button hud-icon-button--sound'
    soundBtn.title = 'Ovozni yoqish / o‘chirish'
    this.updateSoundButtonHtml(soundBtn)
    soundBtn.addEventListener('click', (e) => {
      e.stopPropagation()
      this.triggerHaptic()
      const nextMuted = !this.controller.isAudioMuted()
      this.controller.setAudioMuted(nextMuted)
      this.controller.updateSetting('sound', !nextMuted)
      this.updateSoundButtonHtml(soundBtn)
    })

    topButtonsLeft.append(menuBtn, restartBtn, soundBtn)

    // Center Info Pill
    const infoPill = document.createElement('div')
    infoPill.className = 'game-hud__info-pill'
    infoPill.innerHTML = `
      <span class="game-hud__track-title">${this.getTrackBadgeText()}</span>
      <span class="game-hud__league-badge">${this.currentState.leagueName}</span>
    `
    infoPill.addEventListener('click', (e) => {
      e.stopPropagation()
      this.triggerHaptic()
      this.openMenuModal('tracks')
    })

    // Sponsor Link
    const sponsorLink = document.createElement('a')
    sponsorLink.className = 'hud-sponsor-link'
    sponsorLink.href = 'https://t.me/tutorbek'
    sponsorLink.target = '_blank'
    sponsorLink.rel = 'noopener noreferrer'
    sponsorLink.innerHTML = '<span class="hud-sponsor-link__pulse"></span><span>tutorbek</span>'

    topBar.append(topButtonsLeft, infoPill, sponsorLink)

    // Bottom Controls
    const bottomControls = document.createElement('div')
    bottomControls.className = 'game-hud__bottom'

    // Left Cluster: Lean back / forward
    const leftCluster = document.createElement('div')
    leftCluster.className = 'game-hud__cluster game-hud__cluster--lean'

    const leanBackBtn = document.createElement('button')
    leanBackBtn.type = 'button'
    leanBackBtn.className = 'control-btn control-btn--lean-back'
    leanBackBtn.dataset.gameKey = 'KeyA'
    leanBackBtn.setAttribute('aria-label', 'Orqaga og‘ish')
    leanBackBtn.innerHTML = `
      <div class="control-btn__icon">
        <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor">
          <path d="M15.41 16.59L10.83 12l4.58-4.59L14 6l-6 6 6 6 1.41-1.41z"/>
        </svg>
      </div>
      <div class="control-btn__label">ORQAGA</div>
      <div class="control-btn__sub">A</div>
    `

    const leanForwardBtn = document.createElement('button')
    leanForwardBtn.type = 'button'
    leanForwardBtn.className = 'control-btn control-btn--lean-forward'
    leanForwardBtn.dataset.gameKey = 'KeyD'
    leanForwardBtn.setAttribute('aria-label', 'Oldinga og‘ish')
    leanForwardBtn.innerHTML = `
      <div class="control-btn__icon">
        <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor">
          <path d="M8.59 16.59L13.17 12 8.59 7.41 10 6l6 6-6 6-1.41-1.41z"/>
        </svg>
      </div>
      <div class="control-btn__label">OLDINGA</div>
      <div class="control-btn__sub">D</div>
    `

    leftCluster.append(leanBackBtn, leanForwardBtn)

    // Right Cluster: Accelerate (Gas) & Brake
    const rightCluster = document.createElement('div')
    rightCluster.className = 'game-hud__cluster game-hud__cluster--drive'

    const gasBtn = document.createElement('button')
    gasBtn.type = 'button'
    gasBtn.className = 'control-btn control-btn--gas'
    gasBtn.dataset.gameKey = 'KeyW'
    gasBtn.setAttribute('aria-label', 'Gaz (Tezlanish)')
    gasBtn.innerHTML = `
      <div class="control-btn__icon">
        <svg width="32" height="32" viewBox="0 0 24 24" fill="currentColor">
          <path d="M7 14l5-5 5 5z"/>
        </svg>
      </div>
      <div class="control-btn__label">GAZ</div>
      <div class="control-btn__sub">W</div>
    `

    const brakeBtn = document.createElement('button')
    brakeBtn.type = 'button'
    brakeBtn.className = 'control-btn control-btn--brake'
    brakeBtn.dataset.gameKey = 'KeyS'
    brakeBtn.setAttribute('aria-label', 'Tormoz')
    brakeBtn.innerHTML = `
      <div class="control-btn__icon">
        <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor">
          <path d="M7 10l5 5 5-5z"/>
        </svg>
      </div>
      <div class="control-btn__label">TORMOZ</div>
      <div class="control-btn__sub">S</div>
    `

    rightCluster.append(brakeBtn, gasBtn)

    bottomControls.append(leftCluster, rightCluster)

    hud.append(topBar, bottomControls)

    this.bindControlPointerEvents(bottomControls)

    return hud
  }

  private updateSoundButtonHtml(btn: HTMLButtonElement): void {
    const isMuted = this.controller.isAudioMuted()
    if (isMuted) {
      btn.innerHTML = `
        <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <line x1="1" y1="1" x2="23" y2="23"/>
          <path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6"/>
          <path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2a7 7 0 0 1-.11 1.23"/>
          <line x1="12" y1="19" x2="12" y2="23"/>
          <line x1="8" y1="23" x2="16" y2="23"/>
        </svg>
        <span>Ovoz</span>
      `
      btn.classList.add('hud-icon-button--off')
    } else {
      btn.innerHTML = `
        <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
          <path d="M15.54 8.46a5 5 0 0 1 0 7.07"/>
          <path d="M19.07 4.93a10 10 0 0 1 0 14.14"/>
        </svg>
        <span>Ovoz</span>
      `
      btn.classList.remove('hud-icon-button--off')
    }
  }

  private bindControlPointerEvents(container: HTMLElement): void {
    const handlePointerDown = (event: PointerEvent): void => {
      const button = (event.target as HTMLElement | null)?.closest<HTMLButtonElement>('[data-game-key]')
      if (!button) return

      const key = button.dataset.gameKey
      if (!key) return

      event.preventDefault()
      if (this.activePointerKeys.has(event.pointerId)) return

      this.triggerHaptic()
      button.setPointerCapture(event.pointerId)
      button.classList.add('is-pressed')

      this.activePointerKeys.set(event.pointerId, key)
      this.activePointerButtons.set(event.pointerId, button)
      this.controller.pressKey(key)
    }

    const handlePointerRelease = (event: PointerEvent): void => {
      const key = this.activePointerKeys.get(event.pointerId)
      if (!key) return

      event.preventDefault()
      this.activePointerKeys.delete(event.pointerId)
      const button = this.activePointerButtons.get(event.pointerId)
      button?.classList.remove('is-pressed')
      this.activePointerButtons.delete(event.pointerId)

      this.controller.releaseKey(key)
    }

    container.addEventListener('pointerdown', handlePointerDown)
    container.addEventListener('pointerup', handlePointerRelease)
    container.addEventListener('pointercancel', handlePointerRelease)
    container.addEventListener('lostpointercapture', handlePointerRelease)
  }

  private releaseAllKeys(): void {
    for (const key of this.activePointerKeys.values()) {
      this.controller.releaseKey(key)
    }
    for (const button of this.activePointerButtons.values()) {
      button.classList.remove('is-pressed')
    }
    this.activePointerKeys.clear()
    this.activePointerButtons.clear()
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
    return `${diff} • ${name}`
  }

  private updateHudInfo(): void {
    if (!this.hudElement) return
    const titleEl = this.hudElement.querySelector('.game-hud__track-title')
    const leagueEl = this.hudElement.querySelector('.game-hud__league-badge')

    if (titleEl) {
      titleEl.textContent = this.getTrackBadgeText()
    }
    if (leagueEl) {
      leagueEl.textContent = this.currentState.leagueName
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

    if (state.isPaused && !state.isInMenu && !this.modalElement && !this.finishDialogElement) {
      this.showPauseModal()
    } else if (!state.isPaused && this.pauseDialogElement) {
      this.closePauseModal()
    }
  }

  // ==========================================
  // UNIFIED MODERN MENU MODAL
  // ==========================================

  openMenuModal(tab: 'tracks' | 'settings' | 'records' | 'controls' = 'tracks'): void {
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

    if (this.modalElement) {
      this.renderModalContent()
      return
    }

    const modal = document.createElement('div')
    modal.className = 'game-modal-overlay'
    modal.setAttribute('role', 'dialog')
    modal.setAttribute('aria-modal', 'true')
    this.modalElement = modal

    this.renderModalContent()
    this.container?.appendChild(modal)
    this.controller.openMenu(tab)
  }

  closeMenuModal(): void {
    if (this.modalElement) {
      this.modalElement.remove()
      this.modalElement = null
    }
    this.controller.closeMenu()
  }

  private renderModalContent(): void {
    if (!this.modalElement) return
    this.modalElement.innerHTML = ''

    const card = document.createElement('div')
    card.className = 'game-modal-card'

    // Header
    const header = document.createElement('div')
    header.className = 'game-modal__header'

    const titleGroup = document.createElement('div')
    titleGroup.className = 'game-modal__title-group'
    titleGroup.innerHTML = `
      <div class="game-modal__title">GRAVITY DEFIED</div>
      <div class="game-modal__subtitle">Oddiy va qulay boshqaruv menyusi</div>
    `

    const closeBtn = document.createElement('button')
    closeBtn.type = 'button'
    closeBtn.className = 'game-modal__close-btn'
    closeBtn.setAttribute('aria-label', 'Yopish va o‘ynash')
    closeBtn.innerHTML = `
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
        <line x1="18" y1="6" x2="6" y2="18"/>
        <line x1="6" y1="6" x2="18" y2="18"/>
      </svg>
    `
    closeBtn.addEventListener('click', () => {
      this.triggerHaptic()
      this.closeMenuModal()
    })

    header.append(titleGroup, closeBtn)

    // Tabs Nav
    const tabsNav = document.createElement('div')
    tabsNav.className = 'game-modal__nav'

    const tabs: Array<{ id: 'tracks' | 'settings' | 'records' | 'controls'; label: string; icon: string }> = [
      { id: 'tracks', label: 'Trassalar', icon: '🏁' },
      { id: 'settings', label: 'Sozlamalar', icon: '⚙️' },
      { id: 'records', label: 'Rekordlar', icon: '🏆' },
      { id: 'controls', label: 'Boshqaruv', icon: '❓' },
    ]

    for (const tab of tabs) {
      const tabBtn = document.createElement('button')
      tabBtn.type = 'button'
      tabBtn.className = `game-modal__nav-tab ${this.activeTab === tab.id ? 'is-active' : ''}`
      tabBtn.innerHTML = `<span>${tab.icon}</span> <span>${tab.label}</span>`
      tabBtn.addEventListener('click', () => {
        this.triggerHaptic()
        this.activeTab = tab.id
        this.renderModalContent()
      })
      tabsNav.appendChild(tabBtn)
    }

    // Tab Body
    const body = document.createElement('div')
    body.className = 'game-modal__body'

    if (this.activeTab === 'tracks') {
      body.appendChild(this.renderTracksTab())
    } else if (this.activeTab === 'settings') {
      body.appendChild(this.renderSettingsTab())
    } else if (this.activeTab === 'records') {
      body.appendChild(this.renderRecordsTab())
    } else if (this.activeTab === 'controls') {
      body.appendChild(this.renderControlsTab())
    }

    card.append(header, tabsNav, body)
    this.modalElement.appendChild(card)
  }

  // ==========================================
  // TAB 1: TRASSALAR (TRACKS)
  // ==========================================

  private renderTracksTab(): HTMLElement {
    const container = document.createElement('div')
    container.className = 'tab-tracks'

    // Difficulty Select Row
    const diffSection = document.createElement('div')
    diffSection.className = 'section-block'

    const diffTitle = document.createElement('div')
    diffTitle.className = 'section-title'
    diffTitle.textContent = 'Qiyinlik darajasi:'

    const diffRow = document.createElement('div')
    diffRow.className = 'segmented-row'

    const difficulties = [
      { id: 0, label: 'Oson (Easy)', color: '#10b981' },
      { id: 1, label: 'O‘rtacha (Medium)', color: '#f59e0b' },
      { id: 2, label: 'Qiyin (Pro)', color: '#ef4444' },
    ]

    for (const diff of difficulties) {
      const btn = document.createElement('button')
      btn.type = 'button'
      btn.className = `segmented-btn ${this.selectedLevelTab === diff.id ? 'is-active' : ''}`
      btn.innerHTML = `<span class="dot" style="background:${diff.color}"></span><span>${diff.label}</span>`
      btn.addEventListener('click', () => {
        this.triggerHaptic()
        this.selectedLevelTab = diff.id
        this.renderModalContent()
      })
      diffRow.appendChild(btn)
    }
    diffSection.append(diffTitle, diffRow)

    // Bike (League) Select Row
    const bikeSection = document.createElement('div')
    bikeSection.className = 'section-block'

    const bikeTitle = document.createElement('div')
    bikeTitle.className = 'section-title'
    bikeTitle.textContent = 'Motosikl kuchi (League):'

    const bikeRow = document.createElement('div')
    bikeRow.className = 'segmented-row'

    const leagues = this.controller.getLeagueNames()
    leagues.forEach((name, idx) => {
      const btn = document.createElement('button')
      btn.type = 'button'
      btn.className = `segmented-btn ${this.selectedLeagueTab === idx ? 'is-active' : ''}`
      btn.innerHTML = `<span>🏍️ ${name}</span>`
      btn.addEventListener('click', () => {
        this.triggerHaptic()
        this.selectedLeagueTab = idx
        this.controller.setLeague(idx)
        this.renderModalContent()
      })
      bikeRow.appendChild(btn)
    })
    bikeSection.append(bikeTitle, bikeRow)

    // Tracks Grid
    const tracksSection = document.createElement('div')
    tracksSection.className = 'section-block'

    const tracksTitle = document.createElement('div')
    tracksTitle.className = 'section-title'
    tracksTitle.textContent = 'Trassani tanlang (Bosing va o‘ynang):'

    const grid = document.createElement('div')
    grid.className = 'tracks-grid'

    const levelTracks = this.controller.getLevelNames()[this.selectedLevelTab] ?? []
    const currentLvl = this.controller.getCurrentLevel()
    const currentTrk = this.controller.getCurrentTrack()

    levelTracks.forEach((trackName, trackIdx) => {
      const isCurrent = currentLvl === this.selectedLevelTab && currentTrk === trackIdx
      const card = document.createElement('button')
      card.type = 'button'
      card.className = `track-card ${isCurrent ? 'is-active' : ''}`

      const records = this.controller.getRecords(this.selectedLevelTab, trackIdx, this.selectedLeagueTab)
      const bestRecord = records[0] ? records[0].replace(/^[A-Z0-9\s]+\s+/, '') : '--:--.--'

      card.innerHTML = `
        <div class="track-card__top">
          <span class="track-card__badge">#${trackIdx + 1}</span>
          ${isCurrent ? '<span class="track-card__playing">O‘ynalmoqda</span>' : ''}
        </div>
        <div class="track-card__name">${trackName}</div>
        <div class="track-card__time">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10 10-4.5 10-10S17.5 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm.5-13H11v6l5.2 3.2.8-1.3-4.5-2.7V7z"/>
          </svg>
          <span>${bestRecord}</span>
        </div>
      `

      card.addEventListener('click', () => {
        this.triggerHaptic()
        this.controller.setLeague(this.selectedLeagueTab)
        this.controller.loadTrack(this.selectedLevelTab, trackIdx)
        this.closeMenuModal()
      })

      grid.appendChild(card)
    })

    tracksSection.append(tracksTitle, grid)

    // Actions Footer
    const footer = document.createElement('div')
    footer.className = 'tab-footer'

    const playBtn = document.createElement('button')
    playBtn.type = 'button'
    playBtn.className = 'btn-primary'
    playBtn.innerHTML = `
      <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
        <path d="M8 5v14l11-7z"/>
      </svg>
      <span>O‘yinga qaytish</span>
    `
    playBtn.addEventListener('click', () => {
      this.triggerHaptic()
      this.closeMenuModal()
    })

    const restartBtn = document.createElement('button')
    restartBtn.type = 'button'
    restartBtn.className = 'btn-secondary'
    restartBtn.innerHTML = `
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
        <path d="M21 2v6h-6"/>
        <path d="M3 12a9 9 0 0 1 15.36-6.36L21 8"/>
        <path d="M3 22v-6h6"/>
        <path d="M21 12a9 9 0 0 1-15.36 6.36L3 16"/>
      </svg>
      <span>Boshidan boshlash</span>
    `
    restartBtn.addEventListener('click', () => {
      this.triggerHaptic()
      this.controller.restart()
      this.closeMenuModal()
    })

    footer.append(playBtn, restartBtn)

    container.append(diffSection, bikeSection, tracksSection, footer)
    return container
  }

  // ==========================================
  // TAB 2: SOZLAMALAR (SETTINGS) - FLAT & CLEAN
  // ==========================================

  private renderSettingsTab(): HTMLElement {
    const container = document.createElement('div')
    container.className = 'tab-settings'

    const settings = this.controller.getSettings()

    const list = document.createElement('div')
    list.className = 'settings-list'

    // Sound FX
    list.appendChild(
      this.createSettingRow(
        '🔊 O‘yin ovozi (Sound FX)',
        'Dvigatel va harakat tovushlari',
        settings.sound,
        (val) => {
          this.controller.updateSetting('sound', val)
          this.controller.setAudioMuted(!val)
          this.updateHudVisibility()
        },
      ),
    )

    // Haptics (Vibration)
    list.appendChild(
      this.createSettingRow(
        '📳 Tugma tebranishi (Vibratsiya)',
        'Tugmalarni bosganda yengil titrash',
        settings.haptics,
        (val) => {
          this.controller.updateSetting('haptics', val)
        },
      ),
    )

    // Shadows
    list.appendChild(
      this.createSettingRow(
        '🕶️ Soyalar (Shadows)',
        'Trassa va motosikl ostidagi relyef soyalari',
        settings.shadows,
        (val) => {
          this.controller.updateSetting('shadows', val)
        },
      ),
    )

    // 3D Perspective
    list.appendChild(
      this.createSettingRow(
        '📐 3D Perspektiva',
        'Trassa relyefining chuqurlik effekti',
        settings.perspective,
        (val) => {
          this.controller.updateSetting('perspective', val)
        },
      ),
    )

    // Look Ahead Camera
    list.appendChild(
      this.createSettingRow(
        '🎥 Aqlli kamera (Look Ahead)',
        'Tezlikka qarab kamerani oldinga siljitish',
        settings.lookAhead,
        (val) => {
          this.controller.updateSetting('lookAhead', val)
        },
      ),
    )

    // Driver 2D Texture
    list.appendChild(
      this.createSettingRow(
        '🏍️ Haydovchi teksturasi (Texture)',
        'Yoqilganda rangli rasm, o‘chirilganda klassik chiziqlar',
        settings.driverSprite,
        (val) => {
          this.controller.updateSetting('driverSprite', val)
        },
      ),
    )

    // Bike 2D Texture
    list.appendChild(
      this.createSettingRow(
        '🚲 Motosikl teksturasi (Texture)',
        'Yoqilganda rangli rasm, o‘chirilganda klassik chiziqlar',
        settings.bikeSprite,
        (val) => {
          this.controller.updateSetting('bikeSprite', val)
        },
      ),
    )

    // On-screen controls mode
    const controlsModeRow = document.createElement('div')
    controlsModeRow.className = 'setting-row'

    const controlsMeta = document.createElement('div')
    controlsMeta.className = 'setting-row__meta'
    controlsMeta.innerHTML = `
      <div class="setting-row__title">📱 Ekrandagi tugmalar ko‘rinishi</div>
      <div class="setting-row__desc">Mobil boshqaruv tugmalarini ko‘rsatish rejimi</div>
    `

    const modePicker = document.createElement('div')
    modePicker.className = 'segmented-row segmented-row--compact'

    const modes: Array<{ id: 'auto' | 'always' | 'hidden'; label: string }> = [
      { id: 'auto', label: 'Avtomatik' },
      { id: 'always', label: 'Doimiy' },
      { id: 'hidden', label: 'Yashirish' },
    ]

    for (const m of modes) {
      const btn = document.createElement('button')
      btn.type = 'button'
      btn.className = `segmented-btn ${settings.controlsMode === m.id ? 'is-active' : ''}`
      btn.textContent = m.label
      btn.addEventListener('click', () => {
        this.triggerHaptic()
        this.controller.updateSetting('controlsMode', m.id)
        this.updateHudVisibility()
        this.renderModalContent()
      })
      modePicker.appendChild(btn)
    }

    controlsModeRow.append(controlsMeta, modePicker)
    list.appendChild(controlsModeRow)

    // Clear Records Action
    const dangerSection = document.createElement('div')
    dangerSection.className = 'danger-zone'

    const clearRecordsBtn = document.createElement('button')
    clearRecordsBtn.type = 'button'
    clearRecordsBtn.className = 'btn-danger'
    clearRecordsBtn.innerHTML = `
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
        <polyline points="3 6 5 6 21 6"/>
        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
      </svg>
      <span>Barcha rekordlarni tozalash</span>
    `
    clearRecordsBtn.addEventListener('click', () => {
      this.triggerHaptic()
      this.showConfirmDialog(
        'Barcha rekordlarni tozalaysizmi?',
        'Barcha trassalarda o‘rnatilgan vaqt rekordlari o‘chib ketadi. Bu amalni qaytarib bo‘lmaydi.',
        () => {
          this.controller.clearAllRecords()
          this.renderModalContent()
        },
      )
    })

    dangerSection.appendChild(clearRecordsBtn)

    container.append(list, dangerSection)
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
    switchLabel.className = 'ui-switch'

    const checkbox = document.createElement('input')
    checkbox.type = 'checkbox'
    checkbox.checked = initialValue
    checkbox.addEventListener('change', () => {
      this.triggerHaptic()
      onChange(checkbox.checked)
    })

    const slider = document.createElement('span')
    slider.className = 'ui-switch__slider'

    switchLabel.append(checkbox, slider)
    row.append(meta, switchLabel)
    return row
  }

  // ==========================================
  // TAB 3: REKORDLAR (HIGHSCORES)
  // ==========================================

  private renderRecordsTab(): HTMLElement {
    const container = document.createElement('div')
    container.className = 'tab-records'

    const currentLvl = this.selectedLevelTab
    const currentTrk = this.controller.getCurrentTrack()
    const currentLeague = this.selectedLeagueTab

    const trackName = this.controller.getLevelNames()[currentLvl]?.[currentTrk] ?? 'Intro'
    const leagueName = this.controller.getLeagueNames()[currentLeague] ?? '100cc'
    const diffName = this.controller.getLevelDifficultyNames()[currentLvl] ?? 'Oson'

    const header = document.createElement('div')
    header.className = 'records-header'
    header.innerHTML = `
      <div class="records-header__track">${diffName} • ${trackName}</div>
      <div class="records-header__bike">Motosikl: ${leagueName}</div>
    `

    const records = this.controller.getRecords(currentLvl, currentTrk, currentLeague)

    const list = document.createElement('div')
    list.className = 'records-list'

    const medals = [
      { rank: '1-o‘rin', icon: '🥇', class: 'gold' },
      { rank: '2-o‘rin', icon: '🥈', class: 'silver' },
      { rank: '3-o‘rin', icon: '🥉', class: 'bronze' },
    ]

    let hasAnyRecord = false
    medals.forEach((medal, idx) => {
      const rec = records[idx]
      const row = document.createElement('div')
      row.className = `record-row record-row--${medal.class}`

      if (rec && rec.trim() !== '') {
        hasAnyRecord = true
        row.innerHTML = `
          <div class="record-row__rank">${medal.icon} <span>${medal.rank}</span></div>
          <div class="record-row__details">${rec}</div>
        `
      } else {
        row.innerHTML = `
          <div class="record-row__rank">${medal.icon} <span>${medal.rank}</span></div>
          <div class="record-row__empty">Hozircha rekord yo‘q</div>
        `
      }
      list.appendChild(row)
    })

    if (!hasAnyRecord) {
      const emptyNotice = document.createElement('div')
      emptyNotice.className = 'empty-notice'
      emptyNotice.innerHTML = `Bu trassada ushbu motosikl bilan hali natija qayd etilmagan. Trassani yakunlang va o‘z rekordingizni o‘rnating!`
      container.append(header, list, emptyNotice)
    } else {
      container.append(header, list)
    }

    return container
  }

  // ==========================================
  // TAB 4: BOSHQARUV VA YORDAM (CONTROLS & HELP)
  // ==========================================

  private renderControlsTab(): HTMLElement {
    const container = document.createElement('div')
    container.className = 'tab-controls-help'

    container.innerHTML = `
      <div class="help-card">
        <div class="help-card__title">📱 Mobil telefon boshqaruvi</div>
        <div class="help-grid">
          <div class="help-item">
            <span class="key-pill key-pill--gas">⚡ GAZ (W)</span>
            <span>Oldinga harakatlanish va tezlanish berish.</span>
          </div>
          <div class="help-item">
            <span class="key-pill key-pill--brake">🛑 TORMOZ (S)</span>
            <span>Motosiklni to‘xtatish va orqaga harakat.</span>
          </div>
          <div class="help-item">
            <span class="key-pill key-pill--lean">◀ ORQAGA (A)</span>
            <span>Motosiklni orqaga burish / g‘ildirakni ko‘tarish.</span>
          </div>
          <div class="help-item">
            <span class="key-pill key-pill--lean">▶ OLDINGA (D)</span>
            <span>Motosiklni oldinga egish va muvozanatlash.</span>
          </div>
          <div class="help-item">
            <span class="key-pill">⏸️ MENYU</span>
            <span>O‘yinni pauza qilish va sozlamalarni ochish.</span>
          </div>
          <div class="help-item">
            <span class="key-pill">🔄 QAYTA</span>
            <span>Trassani bir zumda boshidan qayta boshlash.</span>
          </div>
        </div>
      </div>

      <div class="help-card">
        <div class="help-card__title">💻 Klaviatura boshqaruvi (Kompyuterda)</div>
        <div class="help-grid">
          <div class="help-item">
            <span class="key-pill">W / ↑</span>
            <span>Gaz (Tezlanish)</span>
          </div>
          <div class="help-item">
            <span class="key-pill">S / ↓</span>
            <span>Tormoz (To‘xtash)</span>
          </div>
          <div class="help-item">
            <span class="key-pill">A / ←</span>
            <span>Orqaga og‘ish (Tilt Back)</span>
          </div>
          <div class="help-item">
            <span class="key-pill">D / →</span>
            <span>Oldinga og‘ish (Tilt Forward)</span>
          </div>
          <div class="help-item">
            <span class="key-pill">R</span>
            <span>Tezkor qayta boshlash (Restart)</span>
          </div>
          <div class="help-item">
            <span class="key-pill">Esc / Space</span>
            <span>Menyu / Pauza</span>
          </div>
        </div>
      </div>

      <div class="pro-tip-box">
        <div class="pro-tip-box__title">💡 Muhim mototrial maslahati:</div>
        <div class="pro-tip-box__text">
          Tepalikdan sakrash vaqtida motosikl holatini <b>◀ Orqaga</b> va <b>▶ Oldinga</b> tugmalari yordamida havoda to‘g‘rilang.
          Yerga <b>ikkala g‘ildirak bilan baravar</b> qo‘nish motosikl ag‘darilib ketmasligini ta’minlaydi!
        </div>
      </div>
    `

    return container
  }

  // ==========================================
  // FINISHED DIALOG (MARRA)
  // ==========================================

  showFinishedModal(timeStr: string, rank: number): void {
    this.releaseAllKeys()
    if (this.finishDialogElement) {
      this.closeFinishedModal()
    }

    const overlay = document.createElement('div')
    overlay.className = 'game-modal-overlay game-modal-overlay--finish'
    overlay.setAttribute('role', 'dialog')
    overlay.setAttribute('aria-modal', 'true')
    this.finishDialogElement = overlay

    const card = document.createElement('div')
    card.className = 'game-modal-card finish-card'

    let rankBadge = ''
    if (rank === 0) {
      rankBadge = '<div class="finish-rank-pill finish-rank-pill--gold">🥇 Yangi 1-o‘rin Rekordi!</div>'
    } else if (rank === 1) {
      rankBadge = '<div class="finish-rank-pill finish-rank-pill--silver">🥈 Ajoyib! 2-o‘rin Rekordi!</div>'
    } else if (rank === 2) {
      rankBadge = '<div class="finish-rank-pill finish-rank-pill--bronze">🥉 Yaxshi! 3-o‘rin Rekordi!</div>'
    } else {
      rankBadge = '<div class="finish-rank-pill finish-rank-pill--passed">🏁 Trassa muvaffaqiyatli yakunlandi!</div>'
    }

    const trackName = this.controller.getCurrentTrackName()
    const diffName = this.controller.getLevelDifficultyNames()[this.controller.getCurrentLevel()] ?? 'Oson'

    card.innerHTML = `
      <div class="finish-card__trophy">🏆</div>
      <div class="finish-card__title">TABRIKLAYMIZ! MARRA!</div>
      <div class="finish-card__track">${diffName} • ${trackName}</div>
      ${rankBadge}
      <div class="finish-card__time-box">
        <div class="finish-card__time-label">Sizning vaqtingiz:</div>
        <div class="finish-card__time-val">${timeStr}</div>
      </div>
      <div class="finish-card__actions">
        <button type="button" class="btn-primary finish-btn-next">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
            <path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z"/>
          </svg>
          <span>Keyingi trassa</span>
        </button>
        <button type="button" class="btn-secondary finish-btn-retry">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M21 2v6h-6"/>
            <path d="M3 12a9 9 0 0 1 15.36-6.36L21 8"/>
            <path d="M3 22v-6h6"/>
            <path d="M21 12a9 9 0 0 1-15.36 6.36L3 16"/>
          </svg>
          <span>Qayta o‘ynash</span>
        </button>
        <button type="button" class="btn-secondary finish-btn-menu">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
            <line x1="3" y1="6" x2="21" y2="6"/>
            <line x1="3" y1="12" x2="21" y2="12"/>
            <line x1="3" y1="18" x2="21" y2="18"/>
          </svg>
          <span>Barcha trassalar</span>
        </button>
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
      this.openMenuModal('tracks')
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
  // QUICK PAUSE MODAL
  // ==========================================

  showPauseModal(): void {
    this.releaseAllKeys()
    if (this.pauseDialogElement) return

    const overlay = document.createElement('div')
    overlay.className = 'game-modal-overlay game-modal-overlay--pause'
    overlay.setAttribute('role', 'dialog')
    overlay.setAttribute('aria-modal', 'true')
    this.pauseDialogElement = overlay

    const card = document.createElement('div')
    card.className = 'game-modal-card pause-card'

    const trackName = this.controller.getCurrentTrackName()
    const diffName = this.controller.getLevelDifficultyNames()[this.controller.getCurrentLevel()] ?? 'Oson'

    card.innerHTML = `
      <div class="pause-card__header">
        <div class="pause-card__icon">⏸️</div>
        <div class="pause-card__title">O‘YIN TO‘XTATILDI</div>
        <div class="pause-card__track">${diffName} • ${trackName}</div>
      </div>
      <div class="pause-card__actions">
        <button type="button" class="btn-primary pause-btn-resume">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
            <path d="M8 5v14l11-7z"/>
          </svg>
          <span>Davom ettirish</span>
        </button>
        <button type="button" class="btn-secondary pause-btn-restart">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M21 2v6h-6"/>
            <path d="M3 12a9 9 0 0 1 15.36-6.36L21 8"/>
            <path d="M3 22v-6h6"/>
            <path d="M21 12a9 9 0 0 1-15.36 6.36L3 16"/>
          </svg>
          <span>Boshidan boshlash</span>
        </button>
        <button type="button" class="btn-secondary pause-btn-tracks">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
            <polygon points="12 2 2 7 12 12 22 7 12 2"/>
            <polyline points="2 17 12 22 22 17"/>
            <polyline points="2 12 12 17 22 12"/>
          </svg>
          <span>Trassani tanlash</span>
        </button>
        <button type="button" class="btn-secondary pause-btn-settings">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="3"/>
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>
          </svg>
          <span>Sozlamalar</span>
        </button>
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

    card.querySelector('.pause-btn-tracks')?.addEventListener('click', () => {
      this.triggerHaptic()
      this.closePauseModal()
      this.openMenuModal('tracks')
    })

    card.querySelector('.pause-btn-settings')?.addEventListener('click', () => {
      this.triggerHaptic()
      this.closePauseModal()
      this.openMenuModal('settings')
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
  // CONFIRMATION DIALOG
  // ==========================================

  private showConfirmDialog(title: string, message: string, onConfirm: () => void): void {
    if (this.confirmDialogElement) {
      this.confirmDialogElement.remove()
    }

    const overlay = document.createElement('div')
    overlay.className = 'game-modal-overlay game-modal-overlay--confirm'
    this.confirmDialogElement = overlay

    const card = document.createElement('div')
    card.className = 'game-modal-card confirm-card'

    card.innerHTML = `
      <div class="confirm-card__title">${title}</div>
      <div class="confirm-card__message">${message}</div>
      <div class="confirm-card__actions">
        <button type="button" class="btn-danger confirm-btn-yes">Ha, tozalansin</button>
        <button type="button" class="btn-secondary confirm-btn-no">Bekor qilish</button>
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
    this.unsubscribeStateChange?.()
    this.releaseAllKeys()
    this.container?.remove()
    this.container = null
  }
}
