type RollingAudioState = {
  contact: number
  pitch: number
  speed: number
}

type MotorAudioState = {
  load: number
  pitch: number
  throttle: number
}

export class RollingAudio {
  private audioContext: AudioContext | null = null
  private filter: BiquadFilterNode | null = null
  private gain: GainNode | null = null
  private motorFilter: BiquadFilterNode | null = null
  private motorGain: GainNode | null = null
  private motorCompressor: DynamicsCompressorNode | null = null
  private motorOscillator: OscillatorNode | null = null
  private motorShape: WaveShaperNode | null = null
  private motorSubOscillator: OscillatorNode | null = null
  private noise: AudioBufferSourceNode | null = null

  private createNoiseBuffer(audioContext: AudioContext): AudioBuffer {
    const length = audioContext.sampleRate * 2
    const buffer = audioContext.createBuffer(1, length, audioContext.sampleRate)
    const data = buffer.getChannelData(0)

    for (let i = 0; i < length; ++i) {
      data[i] = (Math.random() * 2 - 1) * 0.45
    }

    return buffer
  }

  private createEngineWave(audioContext: AudioContext): PeriodicWave {
    const real = new Float32Array([0, 0.9, 0.18, 0.3, 0.08, 0.13, 0.04, 0.06])
    const imag = new Float32Array(real.length)
    return audioContext.createPeriodicWave(real, imag, { disableNormalization: false })
  }

  private createEngineSaturationCurve(): Float32Array<ArrayBuffer> {
    const samples = 1024
    const curve = new Float32Array(samples) as Float32Array<ArrayBuffer>

    for (let i = 0; i < samples; ++i) {
      const x = (i / (samples - 1)) * 2 - 1
      curve[i] = Math.tanh(x * 1.9)
    }

    return curve
  }

  async resume(): Promise<void> {
    if (this.audioContext === null) {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext
      this.audioContext = new AudioContextClass()
      this.gain = this.audioContext.createGain()
      this.filter = this.audioContext.createBiquadFilter()
      this.motorFilter = this.audioContext.createBiquadFilter()
      this.motorGain = this.audioContext.createGain()
      this.motorCompressor = this.audioContext.createDynamicsCompressor()
      this.motorOscillator = this.audioContext.createOscillator()
      this.motorShape = this.audioContext.createWaveShaper()
      this.motorSubOscillator = this.audioContext.createOscillator()
      this.noise = this.audioContext.createBufferSource()

      this.noise.buffer = this.createNoiseBuffer(this.audioContext)
      this.noise.loop = true
      this.filter.type = 'bandpass'
      this.filter.frequency.value = 90
      this.filter.Q.value = 0.8
      this.gain.gain.value = 0
      this.motorFilter.type = 'lowpass'
      this.motorFilter.frequency.value = 760
      this.motorFilter.Q.value = 0.55
      this.motorGain.gain.value = 0
      this.motorCompressor.threshold.value = -18
      this.motorCompressor.knee.value = 18
      this.motorCompressor.ratio.value = 3
      this.motorCompressor.attack.value = 0.006
      this.motorCompressor.release.value = 0.12
      this.motorOscillator.setPeriodicWave(this.createEngineWave(this.audioContext))
      this.motorOscillator.frequency.value = 46
      this.motorSubOscillator.type = 'triangle'
      this.motorSubOscillator.frequency.value = 23
      this.motorShape.curve = this.createEngineSaturationCurve()
      this.motorShape.oversample = '4x'

      this.noise.connect(this.filter)
      this.filter.connect(this.gain)
      this.gain.connect(this.audioContext.destination)
      this.motorOscillator.connect(this.motorShape)
      this.motorSubOscillator.connect(this.motorShape)
      this.motorShape.connect(this.motorFilter)
      this.motorFilter.connect(this.motorCompressor)
      this.motorCompressor.connect(this.motorGain)
      this.motorGain.connect(this.audioContext.destination)
      this.noise.start()
      this.motorOscillator.start()
      this.motorSubOscillator.start()
    }

    if (this.audioContext.state !== 'running') {
      await this.audioContext.resume()
    }
  }

  update(rollingState: RollingAudioState, motorState: MotorAudioState, isMuted: boolean): void {
    if (this.audioContext === null || this.gain === null || this.filter === null || this.motorGain === null || this.motorFilter === null || this.motorOscillator === null || this.motorSubOscillator === null) {
      return
    }

    const now = this.audioContext.currentTime
    const speed = Math.max(0, Math.min(rollingState.speed, 1))
    const contact = Math.max(0, Math.min(rollingState.contact, 1))
    const targetGain = isMuted ? 0 : Math.min(0.18, contact * speed * 0.16)
    const targetFrequency = 70 + Math.max(0, Math.min(rollingState.pitch, 1)) * 260
    const targetQ = 0.6 + speed * 1.2
    const throttle = Math.max(0, Math.min(motorState.throttle, 1))
    const load = Math.max(0, Math.min(motorState.load, 1))
    const motorPitch = Math.max(0, Math.min(motorState.pitch, 1))
    const motorGain = isMuted ? 0 : Math.min(0.24, (0.035 + throttle * 0.155 + load * 0.075) * (throttle > 0 || load > 0.08 ? 1 : 0))
    const motorFrequency = 38 + motorPitch * 95 + throttle * 24
    const motorFilterFrequency = 460 + motorPitch * 940 + load * 420

    this.gain.gain.cancelScheduledValues(now)
    this.gain.gain.setTargetAtTime(targetGain, now, 0.08)
    this.filter.frequency.cancelScheduledValues(now)
    this.filter.frequency.setTargetAtTime(targetFrequency, now, 0.08)
    this.filter.Q.cancelScheduledValues(now)
    this.filter.Q.setTargetAtTime(targetQ, now, 0.08)
    this.motorGain.gain.cancelScheduledValues(now)
    this.motorGain.gain.setTargetAtTime(motorGain, now, 0.1)
    this.motorOscillator.frequency.cancelScheduledValues(now)
    this.motorOscillator.frequency.setTargetAtTime(motorFrequency, now, 0.08)
    this.motorSubOscillator.frequency.cancelScheduledValues(now)
    this.motorSubOscillator.frequency.setTargetAtTime(motorFrequency * 0.5, now, 0.08)
    this.motorFilter.frequency.cancelScheduledValues(now)
    this.motorFilter.frequency.setTargetAtTime(motorFilterFrequency, now, 0.1)
  }

  stop(): void {
    this.gain?.disconnect()
    this.filter?.disconnect()
    this.motorGain?.disconnect()
    this.motorFilter?.disconnect()
    this.motorCompressor?.disconnect()
    this.motorOscillator?.disconnect()
    this.motorShape?.disconnect()
    this.motorSubOscillator?.disconnect()
    this.noise?.disconnect()
    this.audioContext?.close().catch(() => {})
    this.audioContext = null
    this.filter = null
    this.gain = null
    this.motorFilter = null
    this.motorGain = null
    this.motorCompressor = null
    this.motorOscillator = null
    this.motorShape = null
    this.motorSubOscillator = null
    this.noise = null
  }
}

declare global {
  interface Window {
    webkitAudioContext?: typeof AudioContext
  }
}
