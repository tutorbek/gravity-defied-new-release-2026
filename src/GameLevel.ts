import { abs, divideF16, multiplyF16 } from './cpp.ts'
import { GameCanvas } from './GameCanvas.ts'
import { GamePhysics } from './GamePhysics.ts'
import { LevelLoader } from './LevelLoader.ts'
import { FileStream } from './utils/FileStream.ts'

export class GameLevel {
  private minX = 0
  private maxX = 0
  private shadowStartXF16 = 0
  private shadowEndXF16 = 0
  private shadowProjectionYF16 = 0
  private shadowBlendF16 = 0

  startPosX = 0
  startPosY = 0
  finishPosX = 13107200
  startFlagPoint = 0
  finishFlagPoint = 0
  finishPosY = 0
  pointsCount = 0
  unusedLevelFlag = 0
  pointPositions: number[][] = []

  constructor() {
    this.init()
  }

  init(): void {
    this.startPosX = 0
    this.startPosY = 0
    this.finishPosX = 13107200
    this.pointsCount = 0
    this.unusedLevelFlag = 0
  }

  setStartAndFinishPositions(var1: number, var2: number, var3: number, var4: number): void {
    this.startPosX = (var1 << 16) >> 3
    this.startPosY = (var2 << 16) >> 3
    this.finishPosX = (var3 << 16) >> 3
    this.finishPosY = (var4 << 16) >> 3
  }

  getStartPosX(): number {
    return (this.startPosX << 3) >> 16
  }

  getStartPosY(): number {
    return (this.startPosY << 3) >> 16
  }

  getFinishPosX(): number {
    return (this.finishPosX << 3) >> 16
  }

  getFinishPosY(): number {
    return (this.finishPosY << 3) >> 16
  }

  getPointX(pointNo: number): number {
    return (this.pointPositions[pointNo][0] << 3) >> 16
  }

  getPointY(pointNo: number): number {
    return (this.pointPositions[pointNo][1] << 3) >> 16
  }

  getProgressF16(var1: number): number {
    const var2 = var1 - this.pointPositions[this.startFlagPoint][0]
    const var3 = this.pointPositions[this.finishFlagPoint][0] - this.pointPositions[this.startFlagPoint][0]

    return abs(var3) >= 3 && var2 <= var3 ? divideF16(var2, var3) : 65536
  }

  setMinMaxX(minX: number, maxX: number): void {
    this.minX = (minX << 16) >> 3
    this.maxX = (maxX << 16) >> 3
  }

  setShadowProjectionRange(var1: number, var2: number): void {
    this.shadowStartXF16 = var1 >> 1
    this.shadowEndXF16 = var2 >> 1
  }

  setShadowProjectionState(var1: number, var2: number, var3: number): void {
    this.shadowStartXF16 = var1
    this.shadowEndXF16 = var2
    this.shadowProjectionYF16 = var3
  }

  renderShadow(gameCanvas: GameCanvas, var2: number, var3: number): void {
    if (var3 <= this.pointsCount - 1) {
      let var4 =
        this.shadowProjectionYF16 - ((this.pointPositions[var2][1] + this.pointPositions[var3 + 1][1]) >> 1) < 0
          ? 0
          : this.shadowProjectionYF16 - ((this.pointPositions[var2][1] + this.pointPositions[var3 + 1][1]) >> 1)

      if (this.shadowProjectionYF16 <= this.pointPositions[var2][1] || this.shadowProjectionYF16 <= this.pointPositions[var3 + 1][1]) {
        var4 = var4 < 327680 ? var4 : 327680
      }

      this.shadowBlendF16 = multiplyF16(this.shadowBlendF16, 49152) + multiplyF16(var4, 16384)
      if (this.shadowBlendF16 <= 557056) {
        const var5 = (multiplyF16(1638400, this.shadowBlendF16) >> 16)
        gameCanvas.setColor(var5, var5, var5)

        let var6 = this.pointPositions[var2][0] - this.pointPositions[var2 + 1][0]
        let var8 = divideF16(this.pointPositions[var2][1] - this.pointPositions[var2 + 1][1], var6)
        let var9 = this.pointPositions[var2][1] - multiplyF16(this.pointPositions[var2][0], var8)
        const var10 = multiplyF16(this.shadowStartXF16, var8) + var9

        var6 = this.pointPositions[var3][0] - this.pointPositions[var3 + 1][0]
        var8 = divideF16(this.pointPositions[var3][1] - this.pointPositions[var3 + 1][1], var6)
        var9 = this.pointPositions[var3][1] - multiplyF16(this.pointPositions[var3][0], var8)
        const var11 = multiplyF16(this.shadowEndXF16, var8) + var9

        if (var2 === var3) {
          gameCanvas.drawLine((this.shadowStartXF16 << 3) >> 16, ((var10 + 65536) << 3) >> 16, (this.shadowEndXF16 << 3) >> 16, ((var11 + 65536) << 3) >> 16)
          return
        }

        gameCanvas.drawLine(
          (this.shadowStartXF16 << 3) >> 16,
          ((var10 + 65536) << 3) >> 16,
          (this.pointPositions[var2 + 1][0] << 3) >> 16,
          ((this.pointPositions[var2 + 1][1] + 65536) << 3) >> 16,
        )

        for (let i = var2 + 1; i < var3; ++i) {
          gameCanvas.drawLine(
            (this.pointPositions[i][0] << 3) >> 16,
            ((this.pointPositions[i][1] + 65536) << 3) >> 16,
            (this.pointPositions[i + 1][0] << 3) >> 16,
            ((this.pointPositions[i + 1][1] + 65536) << 3) >> 16,
          )
        }

        gameCanvas.drawLine(
          (this.pointPositions[var3][0] << 3) >> 16,
          ((this.pointPositions[var3][1] + 65536) << 3) >> 16,
          (this.shadowEndXF16 << 3) >> 16,
          ((var11 + 65536) << 3) >> 16,
        )
      }
    }
  }

  renderLevel3D(gameCanvas: GameCanvas, xF16: number, yF16: number): void {
    let var7 = 0
    let var8 = 0
    let lineNo = 0

    for (lineNo = 0; lineNo < this.pointsCount - 1 && this.pointPositions[lineNo][0] <= this.minX; ++lineNo) {}

    if (lineNo > 0) {
      --lineNo
    }

    let var9 = xF16 - this.pointPositions[lineNo][0]
    let var10 = yF16 + 3276800 - this.pointPositions[lineNo][1]
    let var11 = GamePhysics.getSmthLikeMaxAbs(var9, var10)
    var9 = divideF16(var9, var11 >> 1 >> 1)
    var10 = divideF16(var10, var11 >> 1 >> 1)
    gameCanvas.setColor(0, 170, 0)

    while (lineNo < this.pointsCount - 1) {
      const var4 = var9
      const var5 = var10
      var9 = xF16 - this.pointPositions[lineNo + 1][0]
      var10 = yF16 + 3276800 - this.pointPositions[lineNo + 1][1]
      var11 = GamePhysics.getSmthLikeMaxAbs(var9, var10)
      var9 = divideF16(var9, var11 >> 1 >> 1)
      var10 = divideF16(var10, var11 >> 1 >> 1)

      gameCanvas.drawLine(
        ((this.pointPositions[lineNo][0] + var4) << 3) >> 16,
        ((this.pointPositions[lineNo][1] + var5) << 3) >> 16,
        ((this.pointPositions[lineNo + 1][0] + var9) << 3) >> 16,
        ((this.pointPositions[lineNo + 1][1] + var10) << 3) >> 16,
      )

      gameCanvas.drawLine(
        (this.pointPositions[lineNo][0] << 3) >> 16,
        (this.pointPositions[lineNo][1] << 3) >> 16,
        ((this.pointPositions[lineNo][0] + var4) << 3) >> 16,
        ((this.pointPositions[lineNo][1] + var5) << 3) >> 16,
      )

      if (lineNo > 1) {
        if (this.pointPositions[lineNo][0] > this.shadowStartXF16 && var7 === 0) {
          var7 = lineNo - 1
        }

        if (this.pointPositions[lineNo][0] > this.shadowEndXF16 && var8 === 0) {
          var8 = lineNo - 1
        }
      }

      if (this.startFlagPoint === lineNo) {
        gameCanvas.renderStartFlag(
          ((this.pointPositions[this.startFlagPoint][0] + var4) << 3) >> 16,
          ((this.pointPositions[this.startFlagPoint][1] + var5) << 3) >> 16,
        )
        gameCanvas.setColor(0, 170, 0)
      }

      if (this.finishFlagPoint === lineNo) {
        gameCanvas.renderFinishFlag(
          ((this.pointPositions[this.finishFlagPoint][0] + var4) << 3) >> 16,
          ((this.pointPositions[this.finishFlagPoint][1] + var5) << 3) >> 16,
        )
        gameCanvas.setColor(0, 170, 0)
      }

      if (this.pointPositions[lineNo][0] > this.maxX) {
        break
      }

      ++lineNo
    }

    gameCanvas.drawLine(
      (this.pointPositions[this.pointsCount - 1][0] << 3) >> 16,
      (this.pointPositions[this.pointsCount - 1][1] << 3) >> 16,
      ((this.pointPositions[this.pointsCount - 1][0] + var9) << 3) >> 16,
      ((this.pointPositions[this.pointsCount - 1][1] + var10) << 3) >> 16,
    )

    if (LevelLoader.isEnabledShadows) {
      this.renderShadow(gameCanvas, var7, var8)
    }
  }

  renderTrackNearestGreenLine(gameCanvas: GameCanvas): void {
    let pointNo = 0

    for (pointNo = 0; pointNo < this.pointsCount - 1 && this.pointPositions[pointNo][0] <= this.minX; ++pointNo) {}

    if (pointNo > 0) {
      --pointNo
    }

    while (pointNo < this.pointsCount - 1) {
      gameCanvas.drawLine(
        (this.pointPositions[pointNo][0] << 3) >> 16,
        (this.pointPositions[pointNo][1] << 3) >> 16,
        (this.pointPositions[pointNo + 1][0] << 3) >> 16,
        (this.pointPositions[pointNo + 1][1] << 3) >> 16,
      )

      if (this.startFlagPoint === pointNo) {
        gameCanvas.renderStartFlag(
          (this.pointPositions[this.startFlagPoint][0] << 3) >> 16,
          (this.pointPositions[this.startFlagPoint][1] << 3) >> 16,
        )
        gameCanvas.setColor(0, 255, 0)
      }

      if (this.finishFlagPoint === pointNo) {
        gameCanvas.renderFinishFlag(
          (this.pointPositions[this.finishFlagPoint][0] << 3) >> 16,
          (this.pointPositions[this.finishFlagPoint][1] << 3) >> 16,
        )
        gameCanvas.setColor(0, 255, 0)
      }

      if (this.pointPositions[pointNo][0] > this.maxX) {
        break
      }

      ++pointNo
    }
  }

  addPointSimple(var1: number, var2: number): void {
    this.addPoint((var1 << 16) >> 3, (var2 << 16) >> 3)
  }

  addPoint(x: number, y: number): void {
    if (this.pointPositions.length === 0 || this.pointPositions.length <= this.pointsCount) {
      let var3 = 100
      if (this.pointPositions.length !== 0) {
        var3 = var3 < this.pointPositions.length + 30 ? this.pointPositions.length + 30 : var3
      }

      const resized = new Array<number[]>(var3)
      for (let i = 0; i < var3; ++i) {
        resized[i] = i < this.pointPositions.length ? this.pointPositions[i] : [0, 0]
      }
      this.pointPositions = resized
    }

    if (this.pointsCount === 0 || this.pointPositions[this.pointsCount - 1][0] < x) {
      this.pointPositions[this.pointsCount][0] = x
      this.pointPositions[this.pointsCount][1] = y
      ++this.pointsCount
    }
  }

  load(inStream: FileStream): void {
    this.init()
    const c = inStream.readInt8()
    if (c === 50) {
      inStream.readBytes(20)
    }

    this.finishFlagPoint = 0
    this.startFlagPoint = 0

    this.startPosX = inStream.readInt32(true)
    this.startPosY = inStream.readInt32(true)
    this.finishPosX = inStream.readInt32(true)
    this.finishPosY = inStream.readInt32(true)

    const pointsCount = inStream.readInt16(true)
    let pointX = inStream.readInt32(true)
    let pointY = inStream.readInt32(true)
    let offsetX = pointX
    let offsetY = pointY
    this.addPointSimple(pointX, pointY)

    for (let i = 1; i < pointsCount; ++i) {
      const modeOrDx = inStream.readInt8()
      if (modeOrDx === -1) {
        offsetY = 0
        offsetX = 0
        pointX = inStream.readInt32(true)
        pointY = inStream.readInt32(true)
      } else {
        pointX = modeOrDx
        pointY = inStream.readInt8()
      }

      offsetX += pointX
      offsetY += pointY
      this.addPointSimple(offsetX, offsetY)
    }
  }
}
