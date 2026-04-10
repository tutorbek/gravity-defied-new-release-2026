import { MathF16 } from './MathF16.ts'
import type { MenuManager } from './MenuManager.ts'
import { Micro } from './Micro.ts'
import { Timer } from './Timer.ts'
import { toInt } from './cpp.ts'
import type { GamePhysics } from './GamePhysics.ts'
import { Font } from './lcdui/Font.ts'
import { FontStorage } from './lcdui/FontStorage.ts'
import { Graphics } from './lcdui/Graphics.ts'
import { Image } from './lcdui/Image.ts'
import SPLASH_URL from './assets/splash.png?url'
import LOGO_URL from './assets/logo.png?url'
import HELMET_URL from './assets/helmet.png?url'
import SPRITES_URL from './assets/sprites.png?url'
import BLUEARM_URL from './assets/bluearm.png?url'
import BLUELEG_URL from './assets/blueleg.png?url'
import BLUEBODY_URL from './assets/bluebody.png?url'
import ENGINE_URL from './assets/engine.png?url'
import FENDER_URL from './assets/fender.png?url'

type GameCanvasAssetCaches = {
  splashImage: Image
  logoImage: Image
  helmetImage: Image
  spritesImage: Image
  bluearmImage: Image
  bluelegImage: Image
  bluebodyImage: Image
  engineImage: Image
  fenderImage: Image
}

export class GameCanvas {
  static readonly spriteOffsetX = [0, 0, 15, 15, 15, 0, 6, 12, 18, 18, 25, 25, 25, 37, 37, 37, 15, 32]
  static readonly spriteOffsetY = [10, 25, 16, 20, 10, 0, 0, 0, 8, 0, 0, 6, 12, 0, 6, 12, 29, 18]
  static readonly spriteSizeX = [15, 15, 8, 8, 3, 6, 6, 6, 7, 7, 12, 12, 12, 12, 12, 12, 16, 17]
  static readonly spriteSizeY = [15, 15, 4, 4, 3, 10, 10, 10, 8, 8, 6, 6, 6, 6, 6, 6, 11, 22]

  private readonly canvas: HTMLCanvasElement
  private readonly ctx: CanvasRenderingContext2D
  private readonly graphics: Graphics
  private readonly micro: Micro
  private readonly assetCaches: GameCanvasAssetCaches
  private menuManager: MenuManager | null = null
  private dx = 0
  private dy = 0
  private engineSpriteWidth = 0
  private engineSpriteHeight = 0
  private fenderSpriteWidth = 0
  private fenderSpriteHeight = 0
  private gamePhysics: GamePhysics | null = null
  private cameraOffsetX = 0
  private cameraOffsetY = 0
  private loadingScreenMode = 1
  private readonly bodyPartsSpriteWidth = [0, 0, 0]
  private readonly bodyPartsSpriteHeight = [0, 0, 0]
  private static defaultFontWidth00 = 25
  private timerTriggered = false
  private screenFont = FontStorage.getFont(Font.STYLE_BOLD, Font.SIZE_MEDIUM)
  private isUiOverlayEnabled = true
  private timerMessage = ''
  private timerId = 0
  private readonly timers: Timer[] = []
  private isMenuButtonVisible = false
  private isBackButtonVisible = false
  private repaintHandler: (() => void) | null = null
  private pixelRatio = 1
  private renderZoom = 1.65
  private cameraReady = false
  private static stringWithTime = ''
  private readonly time10MsToStringCache = new Array<string>(100).fill('')
  private timeInSeconds = -1
  private static flagAnimationTime = 0
  private static flagAnimationPhase = 0
  private readonly actionInputDelta = [[0, 0], [1, 0], [0, -1], [0, 0], [0, 0], [0, 1], [-1, 0]]
  private readonly keyInputDeltaByMode = [
    [[0, 0], [1, -1], [1, 0], [1, 1], [0, -1], [-1, 0], [0, 1], [-1, -1], [-1, 0], [-1, 1]],
    [[0, 0], [1, 0], [0, 0], [0, 0], [-1, 0], [0, -1], [0, 1], [0, 0], [0, 0], [0, 0]],
    [[0, 0], [0, 0], [0, 0], [1, 0], [0, -1], [0, 1], [-1, 0], [0, 0], [0, 0], [0, 0]],
  ]
  private inputMode = 2
  private readonly activeActions = new Array<boolean>(7).fill(false)
  private readonly activeKeys = new Array<boolean>(10).fill(false)

  width: number
  height2: number
  height: number
  helmetImage: Image
  helmetSpriteWidth: number
  helmetSpriteHeight: number
  isDrawingTime = true
  splashImage: Image | null
  logoImage: Image | null
  bodyPartsImages: Array<Image | null> = [null, null, null]
  engineImage: Image | null = null
  fenderImage: Image | null = null
  spritesImage: Image

  static async create(canvas: HTMLCanvasElement, micro: Micro): Promise<GameCanvas> {
    const [
      splashImage,
      logoImage,
      helmetImage,
      spritesImage,
      bluearmImage,
      bluelegImage,
      bluebodyImage,
      engineImage,
      fenderImage,
    ] = await Promise.all([
      Image.load(SPLASH_URL),
      Image.load(LOGO_URL),
      Image.load(HELMET_URL),
      Image.load(SPRITES_URL),
      Image.load(BLUEARM_URL),
      Image.load(BLUELEG_URL),
      Image.load(BLUEBODY_URL),
      Image.load(ENGINE_URL),
      Image.load(FENDER_URL),
    ])

    return new GameCanvas(canvas, micro, {
      splashImage,
      logoImage,
      helmetImage,
      spritesImage,
      bluearmImage,
      bluelegImage,
      bluebodyImage,
      engineImage,
      fenderImage,
    })
  }

  private constructor(canvas: HTMLCanvasElement, micro: Micro, assetCaches: GameCanvasAssetCaches) {
    const ctx = canvas.getContext('2d')
    if (ctx === null) {
      throw new Error('Canvas 2D context is not available')
    }

    this.canvas = canvas
    this.ctx = ctx
    this.graphics = new Graphics(ctx)
    this.micro = micro
    this.assetCaches = assetCaches
    this.splashImage = assetCaches.splashImage
    this.logoImage = assetCaches.logoImage
    this.helmetImage = assetCaches.helmetImage
    this.spritesImage = assetCaches.spritesImage
    this.helmetSpriteWidth = this.helmetImage.getWidth() / 6
    this.helmetSpriteHeight = this.helmetImage.getHeight() / 6
    this.width = canvas.width
    this.height = canvas.height
    this.height2 = canvas.height
    this.dy = this.height2
    this.ctx.lineCap = 'round'
    this.ctx.lineJoin = 'round'
    GameCanvas.defaultFontWidth00 = 25
  }

  resize(width: number, height: number): void {
    this.pixelRatio = Math.max(1, Math.min(window.devicePixelRatio || 1, 3))
    this.renderZoom = 1.65
    this.canvas.style.width = `${width}px`
    this.canvas.style.height = `${height}px`
    this.canvas.width = Math.max(1, Math.floor(width * this.pixelRatio))
    this.canvas.height = Math.max(1, Math.floor(height * this.pixelRatio))
    this.width = Math.max(1, Math.floor(width / this.renderZoom))
    this.height = Math.max(1, Math.floor(height / this.renderZoom))
    this.height2 = this.height
  }

  getWidth(): number {
    return this.width
  }

  getHeight(): number {
    return this.height2
  }

  getGraphics(): Graphics {
    return this.graphics
  }

  beginFrame(): void {
    void this.micro
    void this.cameraOffsetX
    void this.cameraOffsetY
    void this.loadingScreenMode
    this.ctx.setTransform(this.pixelRatio * this.renderZoom, 0, 0, this.pixelRatio * this.renderZoom, 0, 0)
    this.ctx.clearRect(0, 0, this.width, this.height)
    this.ctx.lineWidth = 1.35
    this.processTimers()
  }

  drawSprite(g: Graphics, spriteNo: number, x: number, y: number): void {
    g.setClip(x, y, GameCanvas.spriteSizeX[spriteNo], GameCanvas.spriteSizeY[spriteNo])
    g.drawImage(
      this.spritesImage,
      x - GameCanvas.spriteOffsetX[spriteNo],
      y - GameCanvas.spriteOffsetY[spriteNo],
      Graphics.LEFT | Graphics.TOP,
    )
    g.setClip(0, 0, this.getWidth(), this.getHeight())
  }

  requestRepaint(var1: number): void {
    this.loadingScreenMode = var1
    if (var1 === 0) {
      this.splashImage = null
      this.logoImage = null
    } else {
      this.repaint()
      this.serviceRepaints()
    }
  }

  setUiOverlayEnabled(var1: boolean): void {
    this.isUiOverlayEnabled = var1
    void this.isUiOverlayEnabled
    this.repaint()
  }

  init(gamePhysics: GamePhysics): void {
    this.gamePhysics = gamePhysics
    gamePhysics.setMinimalScreenWH(this.width < this.height2 ? this.width : this.height2)
  }

  async loadSprites(flags: number): Promise<number> {
    if ((flags & 1) !== 0) {
      this.fenderImage = this.assetCaches.fenderImage
      this.engineImage = this.assetCaches.engineImage
      this.fenderSpriteWidth = this.fenderImage.getWidth() / 6
      this.fenderSpriteHeight = this.fenderImage.getHeight() / 6
      this.engineSpriteWidth = this.engineImage.getWidth() / 6
      this.engineSpriteHeight = this.engineImage.getHeight() / 6
    } else {
      this.fenderImage = null
      this.engineImage = null
    }

    if ((flags & 2) !== 0) {
      this.bodyPartsImages[1] = this.assetCaches.bluelegImage
      this.bodyPartsSpriteWidth[1] = this.bodyPartsImages[1].getWidth() / 6
      this.bodyPartsSpriteHeight[1] = this.bodyPartsImages[1].getHeight() / 3

      this.bodyPartsImages[0] = this.assetCaches.bluearmImage
      this.bodyPartsSpriteWidth[0] = this.bodyPartsImages[0].getWidth() / 6
      this.bodyPartsSpriteHeight[0] = this.bodyPartsImages[0].getHeight() / 3

      this.bodyPartsImages[2] = this.assetCaches.bluebodyImage
      this.bodyPartsSpriteWidth[2] = this.bodyPartsImages[2].getWidth() / 6
      this.bodyPartsSpriteHeight[2] = this.bodyPartsImages[2].getHeight() / 3
    } else {
      this.bodyPartsImages[0] = null
      this.bodyPartsImages[1] = null
      this.bodyPartsImages[2] = null
    }

    return flags
  }

  resetInputState(): void {
    this.clearActiveInputs()
  }

  setViewPosition(dx: number, dy: number): void {
    if (!this.cameraReady) {
      this.dx = dx
      this.dy = dy
      this.cameraReady = true
    } else {
      this.dx += (dx - this.dx) * 0.18
      this.dy += (dy - this.dy) * 0.18
    }

    this.gamePhysics?.setRenderMinMaxX(-Math.round(this.dx), -Math.round(this.dx) + this.width)
  }

  getDx(): number {
    return this.dx
  }

  addDx(x: number): number {
    return x + this.dx
  }

  addDy(y: number): number {
    return -y + this.dy
  }

  drawLine(x: number, y: number, x2: number, y2: number): void {
    this.graphics.drawLine(this.addDx(x), this.addDy(y), this.addDx(x2), this.addDy(y2))
  }

  drawLineF16(x: number, y: number, x2: number, y2: number): void {
    this.graphics.drawLine(this.addDx(x / 16384), this.addDy(y / 16384), this.addDx(x2 / 16384), this.addDy(y2 / 16384))
  }

  renderBodyPart(x1F16: number, y1F16: number, x2F16: number, y2F16: number, bodyPartNo: number, tF16 = 32768): void {
    const x = this.addDx((toInt((BigInt(x2F16) * BigInt(tF16)) >> 16n) + toInt((BigInt(x1F16) * BigInt(65536 - tF16)) >> 16n)) >> 16)
    const y = this.addDy((toInt((BigInt(y2F16) * BigInt(tF16)) >> 16n) + toInt((BigInt(y1F16) * BigInt(65536 - tF16)) >> 16n)) >> 16)
    const angleFP16 = MathF16.atan2F16(x2F16 - x1F16, y2F16 - y1F16)
    const spriteNo = this.calcSpriteNo(angleFP16, 0, 205887, 16, false)

    if (this.bodyPartsImages[bodyPartNo] !== null) {
      const drawX = x - Math.trunc(this.bodyPartsSpriteWidth[bodyPartNo] / 2)
      const drawY = y - Math.trunc(this.bodyPartsSpriteHeight[bodyPartNo] / 2)
      this.graphics.setClip(drawX, drawY, this.bodyPartsSpriteWidth[bodyPartNo], this.bodyPartsSpriteHeight[bodyPartNo])
      this.graphics.drawImage(
        this.bodyPartsImages[bodyPartNo] as Image,
        drawX - this.bodyPartsSpriteWidth[bodyPartNo] * (spriteNo % 6),
        drawY - this.bodyPartsSpriteHeight[bodyPartNo] * Math.trunc(spriteNo / 6),
        Graphics.LEFT | Graphics.TOP,
      )
      this.graphics.setClip(0, 0, this.width, this.getHeight())
    }
  }

  drawWheelArc(var1: number, var2: number, var3: number, var4: number): void {
    const radius = var3 + 1
    let angle = -toInt(((BigInt(toInt((BigInt(var4) * 11796480n) >> 16n)) << 32n) / 205887n) >> 16n)
    if (angle < 0) {
      angle += 360
    }

    const startAngle = ((angle >> 16) + 170) * (Math.PI / 180)
    const endAngle = (((angle >> 16) + 260) * Math.PI) / 180
    this.ctx.save()
    this.ctx.beginPath()
    this.ctx.arc(this.addDx(var1), this.addDy(var2), radius, startAngle, endAngle)
    this.ctx.stroke()
    this.ctx.restore()
  }

  drawCircle(x: number, y: number, size: number): void {
    const radius = size / 2
    this.ctx.save()
    this.ctx.beginPath()
    this.ctx.arc(this.addDx(x), this.addDy(y), radius, 0, Math.PI * 2)
    this.ctx.stroke()
    this.ctx.restore()
  }

  fillRect(x: number, y: number, w: number, h: number): void {
    this.graphics.fillRect(this.addDx(x), this.addDy(y), w, h)
  }

  drawForthSpriteByCenter(centerX: number, centerY: number): void {
    const size = 4
    this.graphics.fillRect(this.addDx(centerX - Math.trunc(size / 2)), this.addDy(centerY + Math.trunc(size / 2)), size, size)
  }

  strokeSegmentF16(x1F16: number, y1F16: number, x2F16: number, y2F16: number, width: number, color: string): void {
    this.ctx.save()
    this.ctx.beginPath()
    this.ctx.lineCap = 'round'
    this.ctx.lineJoin = 'round'
    this.ctx.lineWidth = width
    this.ctx.strokeStyle = color
    this.ctx.moveTo(this.addDx(x1F16 / 16384), this.addDy(y1F16 / 16384))
    this.ctx.lineTo(this.addDx(x2F16 / 16384), this.addDy(y2F16 / 16384))
    this.ctx.stroke()
    this.ctx.restore()
  }

  fillCircleF16(xF16: number, yF16: number, radiusF16: number, fillColor: string, strokeColor?: string, strokeWidth = 1): void {
    this.ctx.save()
    this.ctx.beginPath()
    this.ctx.arc(this.addDx(xF16 / 16384), this.addDy(yF16 / 16384), radiusF16 / 16384, 0, Math.PI * 2)
    this.ctx.fillStyle = fillColor
    this.ctx.fill()
    if (strokeColor !== undefined) {
      this.ctx.lineWidth = strokeWidth
      this.ctx.strokeStyle = strokeColor
      this.ctx.stroke()
    }
    this.ctx.restore()
  }

  strokePolylineF16(points: ReadonlyArray<readonly [number, number]>, width: number, color: string, closed = false): void {
    if (points.length < 2) {
      return
    }

    this.ctx.save()
    this.ctx.beginPath()
    this.ctx.lineCap = 'round'
    this.ctx.lineJoin = 'round'
    this.ctx.lineWidth = width
    this.ctx.strokeStyle = color
    this.ctx.moveTo(this.addDx(points[0][0] / 16384), this.addDy(points[0][1] / 16384))
    for (let i = 1; i < points.length; ++i) {
      this.ctx.lineTo(this.addDx(points[i][0] / 16384), this.addDy(points[i][1] / 16384))
    }
    if (closed) {
      this.ctx.closePath()
    }
    this.ctx.stroke()
    this.ctx.restore()
  }

  fillPolygonF16(points: ReadonlyArray<readonly [number, number]>, fillColor: string, strokeColor?: string, strokeWidth = 1): void {
    if (points.length < 3) {
      return
    }

    this.ctx.save()
    this.ctx.beginPath()
    this.ctx.moveTo(this.addDx(points[0][0] / 16384), this.addDy(points[0][1] / 16384))
    for (let i = 1; i < points.length; ++i) {
      this.ctx.lineTo(this.addDx(points[i][0] / 16384), this.addDy(points[i][1] / 16384))
    }
    this.ctx.closePath()
    this.ctx.fillStyle = fillColor
    this.ctx.fill()
    if (strokeColor !== undefined) {
      this.ctx.lineWidth = strokeWidth
      this.ctx.strokeStyle = strokeColor
      this.ctx.stroke()
    }
    this.ctx.restore()
  }

  drawCoilShockF16(x1F16: number, y1F16: number, x2F16: number, y2F16: number, width: number, color: string, turns = 6): void {
    if (turns < 2) {
      this.strokeSegmentF16(x1F16, y1F16, x2F16, y2F16, width, color)
      return
    }

    const dx = x2F16 - x1F16
    const dy = y2F16 - y1F16
    const length = Math.hypot(dx, dy)
    if (length < 1) {
      return
    }

    const nx = -dy / length
    const ny = dx / length
    const amp = Math.min(14000, length * 0.16)
    const points: [number, number][] = [[x1F16, y1F16]]
    for (let i = 1; i < turns; ++i) {
      const t = i / turns
      const dir = i % 2 === 0 ? -1 : 1
      points.push([Math.round(x1F16 + dx * t + nx * amp * dir), Math.round(y1F16 + dy * t + ny * amp * dir)])
    }
    points.push([x2F16, y2F16])
    this.strokePolylineF16(points, width, color)
  }

  drawPremiumWheelF16(xF16: number, yF16: number, radiusF16: number, angleF16: number, thinTire: boolean, accentColor: string): void {
    const radius = radiusF16 / 16384
    const x = this.addDx(xF16 / 16384)
    const y = this.addDy(yF16 / 16384)
    const tireThickness = thinTire ? 0.8 : 1.15
    const outerRadius = radius + tireThickness
    const rimRadius = radius * 0.88
    const rotorRadius = radius * 0.36
    const hubRadius = Math.max(1.4, radius * 0.09)
    const spokeCount = 5
    const baseAngle = (angleF16 / 65536) * Math.PI

    this.ctx.save()
    this.ctx.beginPath()
    this.ctx.arc(x, y, outerRadius, 0, Math.PI * 2)
    this.ctx.fillStyle = '#202124'
    this.ctx.fill()

    this.ctx.beginPath()
    this.ctx.arc(x, y, radius, 0, Math.PI * 2)
    this.ctx.fillStyle = '#eef2f4'
    this.ctx.fill()

    this.ctx.beginPath()
    this.ctx.arc(x, y, rimRadius, 0, Math.PI * 2)
    this.ctx.lineWidth = 0.8
    this.ctx.strokeStyle = '#70767c'
    this.ctx.stroke()

    this.ctx.lineWidth = Math.max(1.2, radius * 0.075)
    this.ctx.strokeStyle = '#495057'
    for (let i = 0; i < spokeCount; ++i) {
      const a = baseAngle + (i / spokeCount) * Math.PI * 2
      this.ctx.beginPath()
      this.ctx.moveTo(x, y)
      this.ctx.lineTo(x + Math.cos(a) * rotorRadius, y + Math.sin(a) * rotorRadius)
      this.ctx.stroke()
    }

    this.ctx.beginPath()
    this.ctx.arc(x, y, rotorRadius, 0, Math.PI * 2)
    this.ctx.lineWidth = 0.9
    this.ctx.strokeStyle = '#7a8087'
    this.ctx.stroke()

    this.ctx.beginPath()
    this.ctx.arc(x, y, hubRadius, 0, Math.PI * 2)
    this.ctx.fillStyle = accentColor
    this.ctx.fill()
    this.ctx.lineWidth = 0.9
    this.ctx.strokeStyle = '#30343a'
    this.ctx.stroke()
    this.ctx.restore()
  }

  drawHelmet(x: number, y: number, angleF16: number): void {
    const var4 = this.calcSpriteNo(angleF16, -102943, 411774, 32, true)
    const var5 = this.addDx(x) - Math.trunc(this.helmetSpriteWidth / 2)
    const var6 = this.addDy(y) - Math.trunc(this.helmetSpriteHeight / 2)
    this.graphics.setClip(var5, var6, this.helmetSpriteWidth, this.helmetSpriteHeight)
    this.graphics.drawImage(
      this.helmetImage,
      var5 - this.helmetSpriteWidth * (var4 % 6),
      var6 - this.helmetSpriteHeight * Math.trunc(var4 / 6),
      Graphics.LEFT | Graphics.TOP,
    )
    this.graphics.setClip(0, 0, this.width, this.getHeight())
  }

  drawTime(time10Ms: number): void {
    const seconds = Math.trunc(time10Ms / 100)
    const time10MsPart = Math.trunc(time10Ms % 100)

    if (this.timeInSeconds !== seconds || GameCanvas.stringWithTime.length === 0) {
      const zeroPadding = seconds % 60 >= 10 ? '' : '0'
      GameCanvas.stringWithTime = `${Math.trunc(seconds / 60)}:${zeroPadding}${seconds % 60}.`
      this.timeInSeconds = seconds
    }

    if (this.time10MsToStringCache[time10MsPart].length === 0) {
      const zeroPadding = time10MsPart >= 10 ? '' : '0'
      this.time10MsToStringCache[time10MsPart] = `${zeroPadding}${time10Ms % 100}`
    }

    this.setColor(0, 0, 0)
    this.graphics.setFont(FontStorage.getFont(Font.STYLE_BOLD, Font.SIZE_MEDIUM))

    if (time10Ms > 3600000) {
      this.graphics.drawString('0:00.', this.width - GameCanvas.defaultFontWidth00, this.height2 - 5, Graphics.RIGHT | Graphics.TOP)
      this.graphics.drawString('00', this.width - GameCanvas.defaultFontWidth00, this.height2 - 5, Graphics.LEFT | Graphics.TOP)
    } else {
      this.graphics.drawString(GameCanvas.stringWithTime, this.width - GameCanvas.defaultFontWidth00, this.height2 - 5, Graphics.RIGHT | Graphics.TOP)
      this.graphics.drawString(this.time10MsToStringCache[time10MsPart], this.width - GameCanvas.defaultFontWidth00, this.height2 - 5, Graphics.LEFT | Graphics.TOP)
    }
  }

  handleTimerFired(var1: number): void {
    if (this.timerId === var1) {
      this.timerTriggered = true
    }
  }

  static advanceFlagAnimation(): void {
    GameCanvas.flagAnimationPhase += 655
    const sinVal = MathF16.sinF16(GameCanvas.flagAnimationPhase)
    const var0 = 32768 + ((sinVal < 0 ? -sinVal : sinVal) >> 1)
    GameCanvas.flagAnimationTime += (6553 * var0) >> 16
  }

  renderStartFlag(x: number, y: number): void {
    if (GameCanvas.flagAnimationTime > 229376) {
      GameCanvas.flagAnimationTime = 0
    }

    this.drawVectorFlag(x, y, [42, 42, 42], false)
  }

  renderFinishFlag(x: number, y: number): void {
    if (GameCanvas.flagAnimationTime > 229376) {
      GameCanvas.flagAnimationTime = 0
    }

    this.drawVectorFlag(x, y, [42, 42, 42], true)
  }

  drawWheelTires(x: number, y: number, wheelIsThin: number): void {
    const spriteNo = wheelIsThin === 1 ? 0 : 1
    const spriteHalfX = Math.trunc(GameCanvas.spriteSizeX[spriteNo] / 2)
    const spriteHalfY = Math.trunc(GameCanvas.spriteSizeY[spriteNo] / 2)
    this.drawSprite(this.graphics, spriteNo, this.addDx(x - spriteHalfX), this.addDy(y + spriteHalfY))
  }

  calcSpriteNo(angleF16: number, var2: number, var3: number, var4: number, var5: boolean): number {
    for (angleF16 += var2; angleF16 < 0; angleF16 += var3) {
      // Normalize negative fixed-point angles into the sprite lookup range.
    }

    while (angleF16 >= var3) {
      angleF16 -= var3
    }

    if (var5) {
      angleF16 = var3 - angleF16
    }

    const var6 = toInt((BigInt(toInt((BigInt(angleF16) << 32n) / BigInt(var3) >> 16n)) * BigInt(var4 << 16)) >> 16n)
    return (var6 >> 16) < var4 - 1 ? var6 >> 16 : var4 - 1
  }

  renderEngine(x: number, y: number, angleF16: number): void {
    if (this.engineImage === null) {
      return
    }

    const spriteNo = this.calcSpriteNo(angleF16, -247063, 411774, 32, true)
    const centerX = this.addDx(x) - Math.trunc(this.engineSpriteWidth / 2)
    const centerY = this.addDy(y) - Math.trunc(this.engineSpriteHeight / 2)
    this.graphics.setClip(centerX, centerY, this.engineSpriteWidth, this.engineSpriteHeight)
    this.graphics.drawImage(
      this.engineImage,
      centerX - this.engineSpriteWidth * (spriteNo % 6),
      centerY - this.engineSpriteHeight * Math.trunc(spriteNo / 6),
      Graphics.LEFT | Graphics.TOP,
    )
    this.graphics.setClip(0, 0, this.width, this.getHeight())
  }

  renderFender(x: number, y: number, angleF16: number): void {
    if (this.fenderImage === null) {
      return
    }

    const spriteNo = this.calcSpriteNo(angleF16, -185297, 411774, 32, true)
    const centerX = this.addDx(x) - Math.trunc(this.fenderSpriteWidth / 2)
    const centerY = this.addDy(y) - Math.trunc(this.fenderSpriteHeight / 2)
    this.graphics.setClip(centerX, centerY, this.fenderSpriteWidth, this.fenderSpriteHeight)
    this.graphics.drawImage(
      this.fenderImage,
      centerX - this.fenderSpriteWidth * (spriteNo % 6),
      centerY - this.fenderSpriteHeight * Math.trunc(spriteNo / 6),
      Graphics.LEFT | Graphics.TOP,
    )
    this.graphics.setClip(0, 0, this.width, this.getHeight())
  }

  clearScreenWithWhite(): void {
    const skyGradient = this.ctx.createLinearGradient(0, 0, 0, this.height2)
    skyGradient.addColorStop(0, '#f5f9ff')
    skyGradient.addColorStop(0.38, '#ffffff')
    skyGradient.addColorStop(1, '#eef7ea')
    this.ctx.fillStyle = skyGradient
    this.ctx.fillRect(0, 0, this.width, this.height2)
  }

  setColor(red: number, green: number, blue: number): void {
    if (Micro.isInGameMenu) {
      red += 128
      green += 128
      blue += 128
      if (red > 240) {
        red = 240
      }
      if (green > 240) {
        green = 240
      }
      if (blue > 240) {
        blue = 240
      }
    }

    this.graphics.setColor(red, green, blue)
  }

  drawProgressBar(var1: number, mode: boolean): void {
    const h = mode ? this.height : this.height2
    this.setColor(0, 0, 0)
    this.graphics.fillRect(1, h - 4, this.width - 2, 3)
    this.setColor(255, 255, 255)
    this.graphics.fillRect(2, h - 3, toInt((BigInt((this.width - 4) << 16) * BigInt(var1)) >> 16n) >> 16, 1)
  }

  drawTimerMessage(): void {
    if (this.timerMessage.length === 0) {
      return
    }

    this.setColor(0, 0, 0)
    this.graphics.setFont(this.screenFont)
    if (this.height2 <= 128) {
      this.graphics.drawString(this.timerMessage, Math.trunc(this.width / 2), 1, Graphics.HCENTER | Graphics.TOP)
    } else {
      this.graphics.drawString(this.timerMessage, Math.trunc(this.width / 2), Math.trunc(this.height2 / 4), Graphics.HCENTER | Graphics.VCENTER)
    }

    if (this.timerTriggered) {
      this.timerTriggered = false
      this.timerMessage = ''
    }
  }

  setInputMode(var1: number): void {
    this.inputMode = var1
  }

  private drawVectorFlag(x: number, y: number, poleColor: [number, number, number], isFinishFlag: boolean): void {
    void isFinishFlag
    const wave = Math.sin(GameCanvas.flagAnimationPhase / 1800) * 2.5
    this.setColor(poleColor[0], poleColor[1], poleColor[2])
    this.drawLine(x, y, x, y + 38)

    const poleTopX = this.addDx(x + 1)
    const poleTopY = this.addDy(y + 36)
    const flagWidth = 34
    const flagHeight = 18
    const checkerSize = 5

    this.ctx.save()
    this.ctx.beginPath()
    this.ctx.moveTo(poleTopX, poleTopY)
    this.ctx.lineTo(poleTopX + flagWidth + wave, poleTopY + flagHeight / 2)
    this.ctx.lineTo(poleTopX, poleTopY + flagHeight)
    this.ctx.closePath()
    this.ctx.clip()

    for (let row = 0; row < 4; ++row) {
      for (let col = 0; col < 8; ++col) {
        this.ctx.fillStyle = (row + col) % 2 === 0 ? '#f8f8f2' : '#111111'
        this.ctx.fillRect(poleTopX + col * checkerSize, poleTopY + row * checkerSize, checkerSize, checkerSize)
      }
    }

    this.ctx.restore()
    this.ctx.save()
    this.ctx.beginPath()
    this.ctx.moveTo(poleTopX, poleTopY)
    this.ctx.lineTo(poleTopX + flagWidth + wave, poleTopY + flagHeight / 2)
    this.ctx.lineTo(poleTopX, poleTopY + flagHeight)
    this.ctx.closePath()
    this.ctx.lineWidth = 1.2
    this.ctx.strokeStyle = '#111111'
    this.ctx.stroke()
    this.ctx.restore()
  }

  drawGame(g: Graphics): void {
    if (!Micro.isGameVisible || this.micro.isLoadingBlocked || this.gamePhysics === null) {
      return
    }

    if (this.loadingScreenMode !== 0) {
      g.setColor(255, 255, 255)
      g.fillRect(0, 0, this.getWidth(), this.getHeight())
      if (this.loadingScreenMode === 1) {
        if (this.logoImage !== null) {
          g.drawImage(this.logoImage, this.getWidth() >> 1, this.getHeight() >> 1, Graphics.HCENTER | Graphics.VCENTER)
          this.drawSprite(g, 16, this.getWidth() - GameCanvas.spriteSizeX[16] - 5, this.getHeight() - GameCanvas.spriteSizeY[16] - 7)
          this.drawSprite(
            g,
            17,
            this.getWidth() - GameCanvas.spriteSizeX[17] - 4,
            this.getHeight() - GameCanvas.spriteSizeY[17] - GameCanvas.spriteSizeY[16] - 9,
          )
        }
      } else if (this.splashImage !== null) {
        g.drawImage(this.splashImage, this.getWidth() >> 1, this.getHeight() >> 1, Graphics.HCENTER | Graphics.VCENTER)
      }

      const var3 = toInt(((BigInt(Micro.gameLoadingStateStage << 16) << 32n) / 655360n) >> 16n)
      this.drawProgressBar(var3, true)
      return
    }

    this.gamePhysics.setMotoComponents()
    this.cameraOffsetY = Math.trunc(this.height2 * 0.11)
    this.setViewPosition(-this.gamePhysics.getCamPosX() + this.cameraOffsetX + (this.width >> 1), this.gamePhysics.getCamPosY() + this.cameraOffsetY + (this.height2 >> 1))
    this.gamePhysics.renderGame(this)
    if (this.isUiOverlayEnabled && this.isDrawingTime) {
      this.drawTime(this.micro.gameTimeMs / 10)
    }
    if (this.isUiOverlayEnabled) {
      this.drawTimerMessage()
      this.drawProgressBar(this.gamePhysics.getProgressF16(), false)
    }
  }

  paint(g: Graphics): void {
    this.beginFrame()
    if (Micro.isInGameMenu && this.menuManager !== null) {
      this.menuManager.renderCurrentMenu(g)
      return
    }

    this.drawGame(g)
  }

  clearActiveInputs(): void {
    for (let var1 = 0; var1 < 10; ++var1) {
      this.activeKeys[var1] = false
    }

    for (let var1 = 0; var1 < 7; ++var1) {
      this.activeActions[var1] = false
    }
  }

  handleUpdatedInput(): void {
    let var1 = 0
    let var2 = 0
    const var3 = this.inputMode

    for (let var4 = 0; var4 < 10; ++var4) {
      if (this.activeKeys[var4]) {
        var1 += this.keyInputDeltaByMode[var3][var4][0]
        var2 += this.keyInputDeltaByMode[var3][var4][1]
      }
    }

    for (let var4 = 0; var4 < 7; ++var4) {
      if (this.activeActions[var4]) {
        var1 += this.actionInputDelta[var4][0]
        var2 += this.actionInputDelta[var4][1]
      }
    }

    this.gamePhysics?.setInputDirection(var1, var2)
  }

  processTimers(): void {
    for (let i = 0; i < this.timers.length; ) {
      if (this.timers[i].ready()) {
        this.handleTimerFired(this.timers[i].getId())
        this.timers.splice(i, 1)
      } else {
        ++i
      }
    }
  }

  processKeyPressed(keyCode: number): void {
    const action = this.getGameAction(keyCode)
    const numKey = keyCode - 48
    if (numKey >= 0 && numKey < 10) {
      this.activeKeys[numKey] = true
    } else if (action >= 0 && action < 7) {
      this.activeActions[action] = true
    }

    this.handleUpdatedInput()
  }

  processKeyReleased(keyCode: number): void {
    const action = this.getGameAction(keyCode)
    const numKey = keyCode - 48
    if (numKey >= 0 && numKey < 10) {
      this.activeKeys[numKey] = false
    } else if (action >= 0 && action < 7) {
      this.activeActions[action] = false
    }

    this.handleUpdatedInput()
  }

  getGameAction(keyCode: number): number {
    switch (keyCode) {
      case 1:
      case 2:
      case 5:
      case 6:
      case 8:
        return keyCode
      default:
        return -1
    }
  }

  scheduleGameTimerTask(timerMessage: string, delayMs: number): void {
    this.timerTriggered = false
    ++this.timerId
    this.timerMessage = timerMessage
    this.timers.push(new Timer(this.timerId, delayMs))
  }

  setMenuManager(menuManager: MenuManager | null): void {
    this.menuManager = menuManager
  }

  setRepaintHandler(repaintHandler: (() => void) | null): void {
    this.repaintHandler = repaintHandler
  }

  openPauseMenu(): void {
    if (this.menuManager !== null) {
      this.menuManager.isOpeningPauseMenu = true
      this.micro.gameToMenu()
    }
  }

  handleBackAction(): void {
    if (Micro.isInGameMenu) {
      this.menuManager?.handleBackAction()
    }
  }

  keyPressed(var1: number): void {
    if (Micro.isInGameMenu && this.menuManager !== null) {
      this.menuManager.processKeyCode(var1)
    }

    this.processKeyPressed(var1)
  }

  keyReleased(var1: number): void {
    this.processKeyReleased(var1)
  }

  showMenuButton(): void {
    this.isMenuButtonVisible = true
  }

  hideMenuButton(): void {
    this.isMenuButtonVisible = false
  }

  hasMenuButton(): boolean {
    return this.isMenuButtonVisible
  }

  showBackButton(): void {
    this.isBackButtonVisible = true
  }

  hideBackButton(): void {
    this.isBackButtonVisible = false
  }

  hasBackButton(): boolean {
    return this.isBackButtonVisible
  }

  repaint(): void {
    this.repaintHandler?.()
  }

  serviceRepaints(): void {
    this.repaintHandler?.()
  }
}
