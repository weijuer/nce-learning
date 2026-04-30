import { ref, shallowRef, type Ref } from 'vue'

export interface AudioControls {
  isPlaying: Ref<boolean>
  currentTimeOffset: Ref<number>
  duration: Ref<number>
  loadFromBuffer: (buffer: ArrayBuffer) => Promise<void>
  play: (fromTime?: number) => void
  pause: () => void
  resume: () => void
  seek: (time: number) => void
  getCurrentTime: () => number
  stop: () => void
  destroy: () => void
}

export function useAudio(): AudioControls {
  const audioContext = shallowRef<AudioContext | null>(null)
  const audioBuffer = shallowRef<AudioBuffer | null>(null)
  const sourceNode = shallowRef<AudioBufferSourceNode | null>(null)
  const isPlaying = ref(false)
  const currentTimeOffset = ref(0) // 当前播放偏移量（秒）
  const startedAt = ref(0) // context.currentTime 开始时间
  const duration = ref(0) // 总时长（秒）

  function getContext(): AudioContext {
    if (!audioContext.value) {
      audioContext.value = new AudioContext()
    }
    if (audioContext.value.state === 'suspended') {
      audioContext.value.resume()
    }
    return audioContext.value
  }

  async function loadFromBuffer(buffer: ArrayBuffer): Promise<void> {
    try {
      const ctx = getContext()
      const decoded = await ctx.decodeAudioData(buffer)
      audioBuffer.value = decoded
      duration.value = decoded.duration
    } catch (error) {
      console.error('Failed to decode audio data:', error)
      throw new Error('音频解码失败')
    }
  }

  function play(fromTime = 0): void {
    try {
      const ctx = getContext()
      const buffer = audioBuffer.value
      if (!buffer) {
        console.warn('Audio buffer not loaded')
        return
      }

      stopCurrentSource()
      const node = ctx.createBufferSource()
      node.buffer = buffer
      node.connect(ctx.destination)
      node.start(0, Math.max(0, fromTime))
      node.onended = () => {
        isPlaying.value = false
        currentTimeOffset.value = 0
        sourceNode.value = null
      }

      sourceNode.value = node
      startedAt.value = ctx.currentTime
      currentTimeOffset.value = Math.max(0, fromTime)
      isPlaying.value = true
    } catch (error) {
      console.error('Failed to play audio:', error)
      isPlaying.value = false
    }
  }

  function pause(): void {
    if (!isPlaying.value) return
    const ctx = getContext()
    currentTimeOffset.value += ctx.currentTime - startedAt.value
    stopCurrentSource()
    isPlaying.value = false
  }

  function resume(): void {
    if (!isPlaying.value && audioBuffer.value) {
      play(currentTimeOffset.value)
    }
  }

  function seek(time: number): void {
    if (isPlaying.value) {
      play(time)
    } else {
      currentTimeOffset.value = time
    }
  }

  function getCurrentTime(): number {
    if (isPlaying.value && sourceNode.value) {
      const ctx = getContext()
      return currentTimeOffset.value + (ctx.currentTime - startedAt.value)
    }
    return currentTimeOffset.value
  }

  function stop(): void {
    stopCurrentSource()
    isPlaying.value = false
    currentTimeOffset.value = 0
  }

  function stopCurrentSource(): void {
    try {
      sourceNode.value?.stop()
    } catch {
      /* 忽略已停止的错误 */
    }
    sourceNode.value = null
  }

  function destroy(): void {
    stop()
    audioContext.value?.close()
    audioContext.value = null
    audioBuffer.value = null
  }

  return {
    isPlaying,
    currentTimeOffset,
    duration,
    loadFromBuffer,
    play,
    pause,
    resume,
    seek,
    getCurrentTime,
    stop,
    destroy
  }
}
