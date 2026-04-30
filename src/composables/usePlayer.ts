import { ref, computed, watch, onMounted } from 'vue'
import type { Ref } from 'vue'
import { useOPFS } from './useOPFS'
import { useAudio } from './useAudio'
import { parseBilingualLRC } from '../utils/lrc-parser'
import type { LRCLine } from '../types'

interface PlayerProps {
  name?: string
  version?: string
}

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
  /** 版本信息 */
  version?: string
}

/**
 * 播放器事件回调
 */
export interface PlayerEvents {
  onPlay?: () => void
  onPause?: () => void
  onEnded?: () => void
  onTimeUpdate?: (currentTime: number) => void
  onVolumeChange?: (volume: number) => void
  onError?: (error: string) => void
  onLoading?: (loading: boolean) => void
  onDurationChange?: (duration: number) => void
  onLineChange?: (line: LRCLine | null, index: number) => void
  onResourcesLoaded?: () => void
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

  // 歌词相关
  lrcLines: Ref<LRCLine[]>
  currentLineIndex: Ref<number>
  currentLine: Ref<LRCLine | null>

  // 计算属性
  progress: Ref<number>
  audioReady: Ref<boolean>

  // 控制方法
  play: () => void
  pause: () => void
  seek: (time: number) => void
  loadAudio: (name: string, version?: string) => Promise<void>
  destroy: () => void

  // 资源管理
  initPlayer: () => Promise<void>
  clearCache: () => Promise<void>
}

/**
 * 专业音频播放器组合式函数
 * 集成音频播放、歌词同步、资源缓存等功能
 *
 * @param options - 播放器配置
 * @param events - 事件回调
 * @returns 播放器实例
 */
export function usePlayer(
  props: PlayerProps = {},
  options: PlayerOptions = {},
  events: PlayerEvents = {}
): UsePlayerReturn {
  // 默认配置
  const defaultOptions: Required<PlayerOptions> = {
    autoplay: false,
    loop: false,
    volume: 0.7,
    playbackRate: 1.0,
    loadTimeout: 10000,
    version: 'NCE1'
  }

  const config = { ...defaultOptions, ...options }

  // 组合式函数
  const { cacheFile, readFile, fileExists, deleteFile } = useOPFS()
  const {
    isPlaying,
    currentTimeOffset: currentTime,
    duration,
    loadFromBuffer,
    play,
    pause,
    resume,
    seek,
    getCurrentTime,
    destroy
  } = useAudio()

  // 响应式状态
  const state = ref<PlayerState>(PlayerState.IDLE)
  const isLoading = ref(false)
  const error = ref('')
  const audioReady = ref(false)
  const lrcLines = ref<LRCLine[]>([])
  const currentLineIndex = ref(-1)
  const currentLine = computed(() =>
    currentLineIndex.value >= 0 ? lrcLines.value[currentLineIndex.value] : null
  )

  const progress = computed(() => {
    if (duration.value === 0) return 0
    return (currentTime.value / duration.value) * 100
  })

  // 同步音频状态
  watch(isPlaying, playing => {
    state.value = playing ? PlayerState.PLAYING : PlayerState.PAUSED
  })

  watch(duration, newDuration => {
    duration.value = newDuration
    events.onDurationChange?.(newDuration)
  })

  // 资源缓存
  const cacheResource = async (
    filePath: string,
    url: string,
    type: '音频' | '歌词'
  ): Promise<void> => {
    const exists = await fileExists(filePath)
    if (exists) return

    console.log(`正在下载${type}文件...`)
    const response = await fetch(url)
    if (!response.ok) throw new Error(`${type}下载失败 (${response.status})`)

    const buffer = await response.arrayBuffer()
    await cacheFile(filePath, buffer)
    console.log(`${type}已缓存`)
  }

  // 加载资源
  const loadResources = async (name: string, version: string): Promise<void> => {
    const basePath = `data/${version}`
    const urls = {
      mp3: `${basePath}/${name}.mp3`,
      lrc: `${basePath}/${name}.lrc`
    }

    const paths = {
      mp3: `${name}.mp3`,
      lrc: `${name}.lrc`
    }

    try {
      await Promise.all([
        cacheResource(paths.mp3, urls.mp3, '音频'),
        cacheResource(paths.lrc, urls.lrc, '歌词')
      ])

      // 解析歌词
      const lrcBuffer = await readFile(paths.lrc)
      const lrcText = new TextDecoder('utf-8').decode(lrcBuffer)
      lrcLines.value = parseBilingualLRC(lrcText)
    } catch (err) {
      throw new Error(`资源加载失败: ${err instanceof Error ? err.message : '未知错误'}`)
    }
  }

  // 初始化音频
  const initAudio = async (name: string): Promise<void> => {
    try {
      const mp3Buffer = await readFile(`${name}.mp3`)
      await loadFromBuffer(mp3Buffer)
      audioReady.value = true
    } catch (err) {
      throw new Error(`音频初始化失败: ${err instanceof Error ? err.message : '未知错误'}`)
    }
  }

  // 加载音频
  const loadAudio = async (
    name: string = props.name || '',
    version: string = props.version || ''
  ): Promise<void> => {
    try {
      state.value = PlayerState.LOADING
      isLoading.value = true
      error.value = ''
      events.onLoading?.(true)

      await loadResources(name, version)
      await initAudio(name)

      state.value = PlayerState.IDLE
      isLoading.value = false
      events.onLoading?.(false)
      events.onResourcesLoaded?.()

      if (config.autoplay) {
        await play()
      }
    } catch (err) {
      state.value = PlayerState.ERROR
      isLoading.value = false
      error.value = err instanceof Error ? err.message : '未知错误'
      events.onLoading?.(false)
      events.onError?.(error.value)
    }
  }

  // 初始化播放器
  const initPlayer = async (): Promise<void> => {
    await loadAudio()
  }

  // 清除缓存
  const clearCache = async (): Promise<void> => {
    try {
      await (window as any).showDirectoryPicker?.()
      // 这里需要根据实际缓存机制实现
      console.log('清除缓存功能待实现')
    } catch (err) {
      console.error('清除缓存失败:', err)
    }
  }

  onMounted(() => {
    initPlayer()
  })

  return {
    // 基础状态
    state,
    currentTime,
    duration,
    isPlaying,
    isLoading,
    error,

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
    seek,
    loadAudio,
    destroy,

    // 资源管理
    initPlayer,
    clearCache
  }
}
