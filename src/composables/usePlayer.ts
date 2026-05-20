import { ref, computed, onUnmounted, shallowRef, nextTick, reactive } from 'vue'
import type { Ref } from 'vue'
import { useOPFS } from './useOPFS'
import { parseBilingualLRC } from '../utils/lrc-parser'
import type { LRCLine } from '../types'

export const PlayerState = {
  IDLE: 'idle',
  LOADING: 'loading',
  BUFFERING: 'buffering',
  PLAYING: 'playing',
  PAUSED: 'paused',
  ENDED: 'ended',
  ERROR: 'error'
} as const

export type PlayerState = (typeof PlayerState)[keyof typeof PlayerState]

export const DownloadStatus = {
  IDLE: 'idle',
  DOWNLOADING: 'downloading',
  COMPLETED: 'completed',
  FAILED: 'failed',
  RETRYING: 'retrying'
} as const

export type DownloadStatus = (typeof DownloadStatus)[keyof typeof DownloadStatus]

export interface PlayerOptions {
  autoplay?: boolean
  loop?: boolean
  volume?: number
  playbackRate?: number
  basePath?: string
  timeout?: number
  maxRetries?: number
  retryDelay?: number
  enableSentenceLoop?: boolean
  sentenceLoopCount?: number
  continueAfterLoop?: boolean
}

export interface DownloadProgress {
  status: DownloadStatus
  progress: number
  downloadedBytes: number
  totalBytes: number
  fileName: string
  error?: string
  retryCount: number
}

export interface UsePlayerReturn {
  state: Ref<PlayerState>
  currentTime: Ref<number>
  duration: Ref<number>
  isPlaying: Ref<boolean>
  isLoading: Ref<boolean>
  error: Ref<string>
  volume: Ref<number>
  isMuted: Ref<boolean>
  playbackRate: Ref<number>
  lrcLines: Ref<LRCLine[]>
  currentLineIndex: Ref<number>
  currentLine: Ref<LRCLine | null>
  progress: Ref<number>
  audioReady: Ref<boolean>
  formattedCurrentTime: Ref<string>
  formattedDuration: Ref<string>
  mp3DownloadProgress: Ref<DownloadProgress>
  lrcDownloadProgress: Ref<DownloadProgress>
  isOnline: Ref<boolean>
  isSlowNetwork: Ref<boolean>
  play: (fromTime?: number) => void
  pause: () => void
  resume: () => void
  seek: (time: number) => void
  togglePlay: () => void
  setVolume: (volume: number) => void
  toggleMute: () => void
  setPlaybackRate: (rate: number) => void
  destroy: () => void
  loadLesson: (name: string, version: string) => Promise<void>
  retryLoad: () => void
  nextLesson: () => void
  prevLesson: () => void
  playSentence: (lineIndex: number) => void
  settings: {
    enableSentenceLoop: boolean
    sentenceLoopCount: number
    continueAfterLoop: boolean
  }
  lyricsContainerRef: Ref<HTMLElement | null>
}

let playerInstance: UsePlayerReturn | null = null

function createPlayer(options: PlayerOptions): UsePlayerReturn {
  const config = {
    autoplay: false,
    loop: false,
    volume: 0.7,
    playbackRate: 1.0,
    basePath: 'data',
    timeout: 30000,
    maxRetries: 3,
    retryDelay: 2000,
    enableSentenceLoop: true,
    sentenceLoopCount: 3,
    continueAfterLoop: true,
    ...options
  }

  const audioContext = shallowRef<AudioContext | null>(null)
  const gainNode = shallowRef<GainNode | null>(null)
  const sourceNode = shallowRef<AudioBufferSourceNode | null>(null)
  const audioBuffer = shallowRef<AudioBuffer | null>(null)

  let startTime = 0
  let offset = 0
  let animationId: number | null = null
  let abortController: AbortController | null = null
  let currentSentenceIndex = -1
  let sentenceLoopCount = 0
  let currentLessonName = ''
  let currentVersion = ''
  let pendingRetry: ReturnType<typeof setTimeout> | null = null

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

  const isOnline = ref(navigator.onLine)
  const isSlowNetwork = ref(false)

  const mp3DownloadProgress = ref<DownloadProgress>({
    status: DownloadStatus.IDLE,
    progress: 0,
    downloadedBytes: 0,
    totalBytes: 0,
    fileName: '',
    retryCount: 0
  })

  const lrcDownloadProgress = ref<DownloadProgress>({
    status: DownloadStatus.IDLE,
    progress: 0,
    downloadedBytes: 0,
    totalBytes: 0,
    fileName: '',
    retryCount: 0
  })

  const settings = reactive({
    enableSentenceLoop: config.enableSentenceLoop,
    sentenceLoopCount: config.sentenceLoopCount,
    continueAfterLoop: config.continueAfterLoop
  })

  const lyricsContainerRef = ref<HTMLElement | null>(null)

  const { cacheFile, readFile, fileExists } = useOPFS()

  const currentLine = computed(() =>
    currentLineIndex.value >= 0 ? lrcLines.value[currentLineIndex.value] : null
  )

  const progress = computed(() => (duration.value ? (currentTime.value / duration.value) * 100 : 0))

  const formattedCurrentTime = computed(() => formatTime(currentTime.value))
  const formattedDuration = computed(() => formatTime(duration.value))

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
      }
      sourceNode.value.disconnect()
      sourceNode.value = null
    }
  }

  const scrollToCurrentLine = async (): Promise<void> => {
    await nextTick()
    const container = lyricsContainerRef.value || document.body
    if (!container) return

    const activeLine = container.querySelector('.lyric-line.active') as HTMLElement
    if (!activeLine) return

    const containerRect = container.getBoundingClientRect()
    const lineRect = activeLine.getBoundingClientRect()

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

    updateCurrentLine(currentTime.value)
    checkSentenceEnd()

    animationId = requestAnimationFrame(updateTime)
  }

  const checkSentenceEnd = (): void => {
    if (!settings.enableSentenceLoop || currentSentenceIndex < 0) return

    const currentSentence = lrcLines.value[currentSentenceIndex]
    if (!currentSentence) return

    const nextSentence = lrcLines.value[currentSentenceIndex + 1]
    const sentenceEndTime = nextSentence ? nextSentence.time : duration.value

    if (currentTime.value >= sentenceEndTime - 0.1) {
      sentenceLoopCount++

      if (sentenceLoopCount < settings.sentenceLoopCount) {
        seek(currentSentence.time)
      } else {
        currentSentenceIndex = -1
        sentenceLoopCount = 0

        if (!settings.continueAfterLoop) {
          pause()
        }
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

    if (currentTime.value >= duration.value) {
      offset = 0
      currentTime.value = 0
      currentLineIndex.value = -1
      currentSentenceIndex = -1
      sentenceLoopCount = 0
    }

    stopCurrentSource()

    if (animationId) {
      cancelAnimationFrame(animationId)
      animationId = null
    }

    sourceNode.value = createSourceNode()
    if (!sourceNode.value) return

    startTime = ctx.currentTime
    const startOffset = fromTime !== undefined ? fromTime : offset
    sourceNode.value.start(0, startOffset)

    isPlaying.value = true
    state.value = PlayerState.PLAYING
    offset = startOffset

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

    if (settings.enableSentenceLoop) {
      currentSentenceIndex = lineIndex
      sentenceLoopCount = 0
    } else {
      currentSentenceIndex = -1
      sentenceLoopCount = 0
    }

    if (isPlaying.value) {
      pause()
    }

    offset = line.time
    currentTime.value = line.time

    play(line.time)

    nextTick(() => {
      updateCurrentLine(line.time)
    })
  }

  const fetchWithRetry = async <T>(
    url: string,
    options: RequestInit = {},
    retries: number = config.maxRetries
  ): Promise<Response> => {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), config.timeout)

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      return response
    } catch (err) {
      clearTimeout(timeoutId)

      if (retries > 0) {
        await new Promise(resolve => setTimeout(resolve, config.retryDelay))
        return fetchWithRetry(url, options, retries - 1)
      }

      throw err
    } finally {
      clearTimeout(timeoutId)
    }
  }

  const downloadAndCache = async (
    url: string,
    fileName: string,
    progressRef: Ref<DownloadProgress>
  ): Promise<ArrayBuffer> => {
    const exists = await fileExists(fileName)
    if (exists) {
      progressRef.value = {
        status: DownloadStatus.COMPLETED,
        progress: 100,
        downloadedBytes: 0,
        totalBytes: 0,
        fileName,
        retryCount: 0
      }
      return await readFile(fileName)
    }

    progressRef.value = {
      status: DownloadStatus.DOWNLOADING,
      progress: 0,
      downloadedBytes: 0,
      totalBytes: 0,
      fileName,
      retryCount: 0
    }

    let retries = config.maxRetries
    let lastError: Error | null = null

    while (retries >= 0) {
      try {
        const response = await fetchWithRetry(url, {}, retries)

        const contentLength = response.headers.get('content-length')
        const totalBytes = contentLength ? parseInt(contentLength, 10) : 0
        progressRef.value.totalBytes = totalBytes

        const reader = response.body?.getReader()
        if (!reader) {
          throw new Error('无法获取响应流')
        }

        const chunks: Uint8Array[] = []
        let downloadedBytes = 0

        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          chunks.push(value)
          downloadedBytes += value.length

          progressRef.value.downloadedBytes = downloadedBytes
          progressRef.value.progress = totalBytes
            ? Math.round((downloadedBytes / totalBytes) * 100)
            : Math.min(99, (downloadedBytes / 1024 / 1024) * 10)
        }

        const totalBuffer = new Uint8Array(downloadedBytes)
        let offset = 0
        for (const chunk of chunks) {
          totalBuffer.set(chunk, offset)
          offset += chunk.length
        }

        const resultBuffer = totalBuffer.buffer.slice(0)
        const cacheBuffer = totalBuffer.buffer.slice(0)
        await cacheFile(fileName, cacheBuffer)

        progressRef.value = {
          status: DownloadStatus.COMPLETED,
          progress: 100,
          downloadedBytes,
          totalBytes,
          fileName,
          retryCount: 0
        }

        return resultBuffer
      } catch (err) {
        lastError = err instanceof Error ? err : new Error('下载失败')
        retries--

        if (retries >= 0) {
          progressRef.value = {
            status: DownloadStatus.RETRYING,
            progress: progressRef.value.progress,
            downloadedBytes: progressRef.value.downloadedBytes,
            totalBytes: progressRef.value.totalBytes,
            fileName,
            error: `重试中 (${config.maxRetries - retries}/${config.maxRetries})`,
            retryCount: config.maxRetries - retries
          }

          await new Promise(resolve => setTimeout(resolve, config.retryDelay))
        } else {
          progressRef.value = {
            status: DownloadStatus.FAILED,
            progress: progressRef.value.progress,
            downloadedBytes: progressRef.value.downloadedBytes,
            totalBytes: progressRef.value.totalBytes,
            fileName,
            error: lastError.message,
            retryCount: config.maxRetries + 1
          }

          throw lastError
        }
      }
    }

    throw lastError || new Error('下载失败')
  }

  const loadLesson = async (name: string, version: string) => {
    if (abortController) {
      abortController.abort()
    }
    abortController = new AbortController()

    try {
      state.value = PlayerState.LOADING
      isLoading.value = true
      error.value = ''

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

      const [mp3Buffer] = await Promise.all([
        downloadAndCache(urls.mp3, files.mp3, mp3DownloadProgress),
        downloadAndCache(urls.lrc, files.lrc, lrcDownloadProgress)
      ])

      const lrcBuffer = await readFile(files.lrc)
      const lrcText = new TextDecoder('utf-8').decode(lrcBuffer)
      lrcLines.value = parseBilingualLRC(lrcText)

      const ctx = getContext()
      gainNode.value = ctx.createGain()
      gainNode.value.connect(ctx.destination)
      gainNode.value.gain.value = isMuted.value ? 0 : volume.value

      if (!(mp3Buffer instanceof ArrayBuffer)) {
        throw new Error(`Invalid buffer type: ${typeof mp3Buffer}`)
      }
      
      audioBuffer.value = await ctx.decodeAudioData(mp3Buffer)
      duration.value = audioBuffer.value.duration

      audioReady.value = true
      state.value = PlayerState.IDLE
      isLoading.value = false

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
    } finally {
      abortController = null
    }
  }

  const retryLoad = (): void => {
    if (currentLessonName && currentVersion) {
      loadLesson(currentLessonName, currentVersion)
    }
  }

  const nextLesson = (): void => {
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

  const checkNetworkStatus = (): void => {
    isOnline.value = navigator.onLine

    if ('connection' in navigator) {
      const connection = (navigator as any).connection
      const slowTypes = ['slow-2g', '2g', '3g']
      isSlowNetwork.value = slowTypes.includes(connection.effectiveType)

      connection.addEventListener('change', () => {
        isSlowNetwork.value = slowTypes.includes(connection.effectiveType)
      })
    }
  }

  const destroy = (): void => {
    if (isPlaying.value) pause()
    if (animationId) cancelAnimationFrame(animationId)
    if (sourceNode.value) stopCurrentSource()
    if (audioContext.value) {
      audioContext.value.close()
    }
    if (abortController) {
      abortController.abort()
    }
    if (pendingRetry) {
      clearTimeout(pendingRetry)
    }
  }

  checkNetworkStatus()

  window.addEventListener('online', () => {
    isOnline.value = true
  })

  window.addEventListener('offline', () => {
    isOnline.value = false
  })

  onUnmounted(() => {
    window.removeEventListener('online', () => {})
    window.removeEventListener('offline', () => {})
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
    mp3DownloadProgress,
    lrcDownloadProgress,
    isOnline,
    isSlowNetwork,
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
    retryLoad,
    nextLesson,
    prevLesson,
    playSentence,
    settings,
    lyricsContainerRef
  }
}

export function usePlayer(options: PlayerOptions = {}): UsePlayerReturn {
  if (!playerInstance) {
    playerInstance = createPlayer(options)
  }
  return playerInstance
}