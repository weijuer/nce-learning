import { ref, computed, onUnmounted, shallowRef, nextTick } from 'vue'
import type { Ref } from 'vue'
import { useOPFS } from './useOPFS'
import { parseBilingualLRC } from '../utils/lrc-parser'
import type { LRCLine } from '../types'

/**
 * 音频播放器状态常量
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
  autoplay?: boolean
  loop?: boolean
  volume?: number
  playbackRate?: number
  basePath?: string

  // 字幕循环播放设置
  enableSentenceLoop?: boolean
  sentenceLoopCount?: number
  continueAfterLoop?: boolean
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
  formattedCurrentTime: Ref<string>
  formattedDuration: Ref<string>

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

  // 课程切换
  nextLesson: () => void
  prevLesson: () => void

  // 字幕播放
  playSentence: (lineIndex: number) => void

  // 设置
  settings: {
    enableSentenceLoop: Ref<boolean>
    sentenceLoopCount: Ref<number>
    continueAfterLoop: Ref<boolean>
  }

  // 滚动引用
  lyricsContainerRef: Ref<HTMLElement | null>
}

/**
 * 专业音频播放器组合式函数
 * 集成音频播放、歌词同步、资源缓存、音量控制等功能
 */
export function usePlayer(options: PlayerOptions = {}): UsePlayerReturn {
  const config = {
    autoplay: false,
    loop: false,
    volume: 0.7,
    playbackRate: 1.0,
    basePath: 'data',
    enableSentenceLoop: true,
    sentenceLoopCount: 3,
    continueAfterLoop: true,
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

  // 字幕循环状态
  let currentSentenceIndex = -1
  let sentenceLoopCount = 0

  // 课程信息
  let currentLessonName = ''
  let currentVersion = ''

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

  // 设置
  const enableSentenceLoop = ref(config.enableSentenceLoop)
  const sentenceLoopCountSetting = ref(config.sentenceLoopCount)
  const continueAfterLoop = ref(config.continueAfterLoop)

  // 滚动容器引用
  const lyricsContainerRef = ref<HTMLElement | null>(null)

  // 组合式函数
  const { cacheFile, readFile, fileExists } = useOPFS()

  // 计算属性
  const currentLine = computed(() =>
    currentLineIndex.value >= 0 ? lrcLines.value[currentLineIndex.value] : null
  )

  const progress = computed(() => (duration.value ? (currentTime.value / duration.value) * 100 : 0))

  const formattedCurrentTime = computed(() => formatTime(currentTime.value))
  const formattedDuration = computed(() => formatTime(duration.value))

  // 辅助函数
  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }

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

  const scrollToCurrentLine = async (): Promise<void> => {
    await nextTick()
    const container = lyricsContainerRef.value
    if (!container) return

    const activeLine = container.querySelector('.lyric-line.active') as HTMLElement
    if (!activeLine) return

    const containerRect = container.getBoundingClientRect()
    const lineRect = activeLine.getBoundingClientRect()

    // 计算滚动位置，使当前行居中显示
    const scrollTop = activeLine.offsetTop - container.offsetHeight / 2 + lineRect.height / 2

    container.scrollTo({
      top: Math.max(0, scrollTop),
      behavior: 'smooth'
    })
  }

  const updateCurrentLine = (time: number): void => {
    const idx = lrcLines.value.findLastIndex(line => line.time <= time)
    if (idx !== currentLineIndex.value) {
      currentLineIndex.value = idx

      // 自动滚动到当前字幕
      if (idx >= 0) {
        scrollToCurrentLine()
      }
    }
  }

  const updateTime = (): void => {
    if (!audioContext.value || !isPlaying.value) return

    const now = audioContext.value.currentTime
    const elapsed = now - startTime + offset
    currentTime.value = Math.min(elapsed, duration.value)

    // 更新歌词显示
    updateCurrentLine(currentTime.value)

    // 检查是否到达当前句子末尾
    checkSentenceEnd()

    animationId = requestAnimationFrame(updateTime)
  }

  const checkSentenceEnd = (): void => {
    if (!enableSentenceLoop.value || currentSentenceIndex < 0) return

    const currentSentence = lrcLines.value[currentSentenceIndex]
    if (!currentSentence) return

    // 获取下一句的时间（作为当前句的结束时间）
    const nextSentence = lrcLines.value[currentSentenceIndex + 1]
    const sentenceEndTime = nextSentence ? nextSentence.time : duration.value

    // 检查是否到达句子末尾
    if (currentTime.value >= sentenceEndTime - 0.1) {
      // 留一点余量
      sentenceLoopCount++

      if (sentenceLoopCount < sentenceLoopCountSetting.value) {
        // 重新播放当前句子
        seek(currentSentence.time)
      } else {
        // 循环完成
        currentSentenceIndex = -1
        sentenceLoopCount = 0

        if (!continueAfterLoop.value) {
          pause()
        }
        // 如果 continueAfterLoop 为 true，继续播放下一句（自然继续）
      }
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
      currentSentenceIndex = -1
      sentenceLoopCount = 0
    }

    return source
  }

  const play = (fromTime?: number): void => {
    if (!audioBuffer.value || !audioContext.value) return

    const ctx = getContext()

    if (isPlaying.value) {
      stopCurrentSource()
    }

    if (currentTime.value >= duration.value) {
      offset = 0
      currentTime.value = 0
    }

    sourceNode.value = createSourceNode()
    if (!sourceNode.value) return

    startTime = ctx.currentTime
    const startOffset = fromTime !== undefined ? fromTime : offset
    sourceNode.value.start(0, startOffset)

    isPlaying.value = true
    state.value = PlayerState.PLAYING
    offset = startOffset

    if (animationId) cancelAnimationFrame(animationId)
    animationId = requestAnimationFrame(updateTime)
  }

  const pause = (): void => {
    if (!audioContext.value || !isPlaying.value) return

    const elapsed = audioContext.value.currentTime - startTime + offset
    offset = Math.min(elapsed, duration.value)
    currentTime.value = offset

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
      pause()
    }

    offset = newTime
    currentTime.value = newTime

    if (wasPlaying) {
      play(newTime)
    } else {
      stopCurrentSource()
    }

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

  const playSentence = (lineIndex: number): void => {
    if (lineIndex < 0 || lineIndex >= lrcLines.value.length) return

    const line = lrcLines.value[lineIndex]

    // 设置当前句子索引和循环计数
    currentSentenceIndex = lineIndex
    sentenceLoopCount = 0

    // 跳转到句子开始位置并播放
    seek(line.time)

    if (!isPlaying.value) {
      play()
    }
  }

  const loadLesson = async (name: string, version: string) => {
    try {
      state.value = PlayerState.LOADING
      isLoading.value = true
      error.value = ''

      // 更新当前课程信息
      currentLessonName = name
      currentVersion = version

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
      gainNode.value.gain.value = isMuted.value ? 0 : volume.value

      const mp3Buffer = await readFile(files.mp3)
      audioBuffer.value = await ctx.decodeAudioData(mp3Buffer)
      duration.value = audioBuffer.value.duration

      audioReady.value = true
      state.value = PlayerState.IDLE
      isLoading.value = false

      // 重置播放状态
      offset = 0
      currentTime.value = 0
      currentLineIndex.value = -1
      currentSentenceIndex = -1
      sentenceLoopCount = 0

      if (config.autoplay) play()
    } catch (err) {
      state.value = PlayerState.ERROR
      isLoading.value = false
      error.value = err instanceof Error ? err.message : '未知错误'
      throw err
    }
  }

  const nextLesson = (): void => {
    // 这里需要根据实际的课程列表来实现
    // 可以通过解析当前课程名称来推断下一课
    if (!currentLessonName) return

    const lessonMatch = currentLessonName.match(/(\d+)－/)
    if (lessonMatch) {
      const currentNum = parseInt(lessonMatch[1])
      const nextNum = currentNum + 1
      const nextName = currentLessonName.replace(/^\d+/, nextNum.toString())
      loadLesson(nextName, currentVersion)
    }
  }

  const prevLesson = (): void => {
    if (!currentLessonName) return

    const lessonMatch = currentLessonName.match(/(\d+)－/)
    if (lessonMatch) {
      const currentNum = parseInt(lessonMatch[1])
      if (currentNum > 1) {
        const prevNum = currentNum - 1
        const prevName = currentLessonName.replace(/^\d+/, prevNum.toString())
        loadLesson(prevName, currentVersion)
      }
    }
  }

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
    state,
    currentTime,
    duration,
    isPlaying,
    isLoading,
    error,
    volume,
    isMuted,
    playbackRate,
    lrcLines,
    currentLineIndex,
    currentLine,
    progress,
    audioReady,
    formattedCurrentTime,
    formattedDuration,
    play,
    pause,
    resume,
    seek,
    togglePlay,
    setVolume,
    toggleMute,
    setPlaybackRate,
    destroy,
    loadLesson,
    nextLesson,
    prevLesson,
    playSentence,
    settings: {
      enableSentenceLoop,
      sentenceLoopCount: sentenceLoopCountSetting,
      continueAfterLoop
    },
    lyricsContainerRef
  }
}
