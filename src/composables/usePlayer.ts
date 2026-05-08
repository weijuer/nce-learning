import { ref, computed, watch, onUnmounted, shallowRef } from 'vue'
import type { Ref } from 'vue'
import { useOPFS } from './useOPFS'
import { parseBilingualLRC } from '../utils/lrc-parser'
import type { LRCLine } from '../types'

/**
 * 音频播放器状态枚举
 */
export const PlayerState = {
  IDLE: 'idle',
  LOADING: 'loading',
  PLAYING: 'playing',
  PAUSED: 'paused',
  ENDED: 'ended',
  ERROR: 'error'
} as const

export type PlayerState = (typeof PlayerState)[keyof typeof PlayerState]

/**
 * 播放器配置选项
 */
export interface PlayerOptions {
  /** 是否自动播放 */
  autoplay?: boolean
  /** 是否循环播放 */
  loop?: boolean
  /** 音量 (0-1) */
  volume?: number
  /** 播放速率 (0.5-4) */
  playbackRate?: number
  /** 音频加载超时时间（毫秒） */
  loadTimeout?: number
  /** 资源基础路径 */
  basePath?: string
}

/**
 * 播放器返回类型
 */
export interface UsePlayerReturn {
  // 基础状态
  state: Ref<PlayerState>
  currentTime: Ref<number>
  duration: Ref<number>
  isPlaying: Ref<boolean>
  isLoading: Ref<boolean>
  error: Ref<string>
  volume: Ref<number>
  isMuted: Ref<boolean>
  playbackRate: Ref<number>

  // 歌词相关
  lrcLines: Ref<LRCLine[]>
  currentLineIndex: Ref<number>
  currentLine: Ref<LRCLine | null>

  // 计算属性
  progress: Ref<number>
  audioReady: Ref<boolean>

  // 控制方法
  play: (fromTime?: number) => void
  pause: () => void
  resume: () => void
  seek: (time: number) => void
  togglePlay: () => void
  setVolume: (volume: number) => void
  toggleMute: () => void
  setPlaybackRate: (rate: number) => void
  destroy: () => void

  // 资源管理
  loadLesson: (name: string, version: string) => Promise<void>
}

/**
 * 专业音频播放器组合式函数
 * 集成音频播放、歌词同步、资源缓存、音量控制等功能
 *
 * @param options - 播放器配置选项
 * @returns 播放器实例
 */
export function usePlayer(options: PlayerOptions = {}): UsePlayerReturn {
  // 默认配置
  const config = {
    autoplay: false,
    loop: false,
    volume: 0.7,
    playbackRate: 1.0,
    basePath: 'data',
    ...options
  }

  // Web Audio API 相关
  const audioContext = shallowRef<AudioContext | null>(null)
  const gainNode = shallowRef<GainNode | null>(null)
  const sourceNode = shallowRef<AudioBufferSourceNode | null>(null)
  const audioBuffer = shallowRef<AudioBuffer | null>(null)

  // 播放控制状态
  let startTime = 0
  let offset = 0
  let animationId: number | null = null

  // 响应式状态
  const state = ref<PlayerState>(PlayerState.IDLE)
  const isPlaying = ref(false)
  const currentTime = ref(0)
  const duration = ref(0)
  const volume = ref(config.volume)
  const isMuted = ref(false)
  const playbackRate = ref(config.playbackRate)
  const isLoading = ref(false)
  const error = ref('')
  const audioReady = ref(false)
  const lrcLines = ref<LRCLine[]>([])
  const currentLineIndex = ref(-1)

  // 组合式函数
  const { cacheFile, readFile, fileExists } = useOPFS()

  // 计算属性
  const currentLine = computed(() =>
    currentLineIndex.value >= 0 ? lrcLines.value[currentLineIndex.value] : null
  )

  const progress = computed(() => (duration.value ? (currentTime.value / duration.value) * 100 : 0))

  const getContext = (): AudioContext => {
    if (!audioContext.value) {
      const AudioCtor = window.AudioContext || (window as any).webkitAudioContext
      audioContext.value = new AudioCtor()
    }
    if (audioContext.value.state === 'suspended') {
      audioContext.value.resume()
    }
    return audioContext.value
  }

  const stopCurrentSource = (): void => {
    if (sourceNode.value) {
      try {
        sourceNode.value.stop()
      } catch {
        // 忽略已停止的错误
      }
      sourceNode.value.disconnect()
      sourceNode.value = null
    }
  }

  const updateTime = (): void => {
    if (!audioContext.value || !isPlaying.value) return

    const now = audioContext.value.currentTime
    const elapsed = now - startTime + offset
    currentTime.value = Math.min(elapsed, duration.value)

    // 更新歌词显示
    updateCurrentLine(currentTime.value)

    animationId = requestAnimationFrame(updateTime)
  }

  const updateCurrentLine = (time: number): void => {
    const idx = lrcLines.value.findLastIndex(line => line.time <= time)
    if (idx !== currentLineIndex.value) {
      currentLineIndex.value = idx
    }
  }

  const createSourceNode = (): AudioBufferSourceNode | null => {
    if (!audioContext.value || !audioBuffer.value) return null

    const source = audioContext.value.createBufferSource()
    source.buffer = audioBuffer.value
    source.playbackRate.value = playbackRate.value

    if (gainNode.value) {
      source.connect(gainNode.value)
    } else {
      source.connect(audioContext.value.destination)
    }

    source.onended = () => {
      isPlaying.value = false
      state.value = PlayerState.ENDED
    }

    return source
  }

  // 播放控制方法
  const play = (fromTime?: number): void => {
    if (!audioBuffer.value || !audioContext.value) return

    const ctx = getContext()
    // 如果已经在播放，先停止当前播放
    if (isPlaying.value) {
      stopCurrentSource()
    }

    // 如果已经到达末尾，从头开始
    if (currentTime.value >= duration.value) {
      offset = 0
      currentTime.value = 0
    }

    // 创建新源节点
    sourceNode.value = createSourceNode()
    if (!sourceNode.value) return

    // 记录开始时间
    startTime = ctx.currentTime
    const startOffset = fromTime !== undefined ? fromTime : offset
    sourceNode.value.start(0, startOffset)

    isPlaying.value = true
    state.value = PlayerState.PLAYING
    offset = startOffset

    // 启动时间更新循环
    if (animationId) cancelAnimationFrame(animationId)
    animationId = requestAnimationFrame(updateTime)
  }

  const pause = (): void => {
    if (!audioContext.value || !isPlaying.value) return

    // 记录当前播放位置
    const elapsed = audioContext.value.currentTime - startTime + offset
    offset = Math.min(elapsed, duration.value)
    currentTime.value = offset

    // 停止源节点
    stopCurrentSource()
    isPlaying.value = false
    state.value = PlayerState.PAUSED

    if (animationId) {
      cancelAnimationFrame(animationId)
      animationId = null
    }
  }

  const resume = (): void => {
    if (!isPlaying.value && audioBuffer.value) {
      play(offset)
    }
  }

  const togglePlay = (): void => {
    if (isPlaying.value) {
      pause()
    } else {
      play(offset)
    }
  }

  const seek = (time: number): void => {
    const newTime = Math.min(Math.max(0, time), duration.value)
    const wasPlaying = isPlaying.value

    if (wasPlaying) {
      // 如果正在播放，先暂停
      pause()
    }

    // 更新播放位置
    offset = newTime
    currentTime.value = newTime

    if (wasPlaying) {
      // 如果之前正在播放，从新位置继续播放
      play(newTime)
    } else {
      // 暂停状态只更新位置
      stopCurrentSource()
    }

    // 更新歌词显示
    updateCurrentLine(currentTime.value)
  }

  const setVolume = (value: number): void => {
    volume.value = Math.min(1, Math.max(0, value))
    if (gainNode.value) {
      gainNode.value.gain.value = isMuted.value ? 0 : volume.value
    }
  }

  const toggleMute = (): void => {
    isMuted.value = !isMuted.value
    if (gainNode.value) {
      gainNode.value.gain.value = isMuted.value ? 0 : volume.value
    }
  }

  const setPlaybackRate = (rate: number): void => {
    playbackRate.value = rate
    if (sourceNode.value) {
      sourceNode.value.playbackRate.value = rate
    }
  }

  const loadLesson = async (name: string, version: string) => {
    try {
      state.value = PlayerState.LOADING
      isLoading.value = true
      error.value = ''

      const basePath = `${config.basePath}/${version}`
      const files = {
        mp3: `${name}.mp3`,
        lrc: `${name}.lrc`
      }

      const urls = {
        mp3: `${basePath}/${name}.mp3`,
        lrc: `${basePath}/${name}.lrc`
      }

      // 缓存资源
      const existsMp3 = await fileExists(files.mp3)
      const existsLrc = await fileExists(files.lrc)

      if (!existsMp3) {
        const response = await fetch(urls.mp3)
        const buffer = await response.arrayBuffer()
        await cacheFile(files.mp3, buffer)
      }

      if (!existsLrc) {
        const response = await fetch(urls.lrc)
        const buffer = await response.arrayBuffer()
        await cacheFile(files.lrc, buffer)
      }

      // 解析歌词
      const lrcBuffer = await readFile(files.lrc)
      const lrcText = new TextDecoder('utf-8').decode(lrcBuffer)
      lrcLines.value = parseBilingualLRC(lrcText)

      // 初始化音频
      const ctx = getContext()
      gainNode.value = ctx.createGain()
      gainNode.value.connect(ctx.destination)
      gainNode.value.gain.value = volume.value

      const mp3Buffer = await readFile(files.mp3)
      audioBuffer.value = await ctx.decodeAudioData(mp3Buffer)
      duration.value = audioBuffer.value.duration

      state.value = PlayerState.IDLE
      isLoading.value = false

      if (config.autoplay) play()
    } catch (err) {
      state.value = PlayerState.ERROR
      isLoading.value = false
      error.value = err instanceof Error ? err.message : '未知错误'
      throw err
    }
  }

  // 状态同步
  watch(isPlaying, playing => {
    state.value = playing ? PlayerState.PLAYING : PlayerState.PAUSED
  })

  const destroy = (): void => {
    if (isPlaying.value) pause()
    if (animationId) cancelAnimationFrame(animationId)
    if (sourceNode.value) stopCurrentSource()
    if (audioContext.value) {
      audioContext.value.close()
    }
  }

  onUnmounted(() => {
    destroy()
  })

  return {
    // 基础状态
    state,
    currentTime,
    duration,
    isPlaying,
    isLoading,
    error,
    volume,
    isMuted,
    playbackRate,

    // 歌词相关
    lrcLines,
    currentLineIndex,
    currentLine,

    // 计算属性
    progress,
    audioReady,

    // 控制方法
    play,
    pause,
    resume,
    seek,
    togglePlay,
    setVolume,
    toggleMute,
    setPlaybackRate,
    destroy,
    loadLesson
  }
}
