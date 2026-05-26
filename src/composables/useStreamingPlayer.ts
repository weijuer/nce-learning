import { ref, computed, onUnmounted, shallowRef, reactive } from 'vue'
import type { Ref } from 'vue'
import { useOPFS } from './useOPFS'
import { parseBilingualLRC } from '../utils/lrc-parser'
import { NCE_JSON } from '../utils/nce-data'
import type { LRCLine } from '../types'

export const StreamingPlayerState = {
  IDLE: 'idle',
  LOADING: 'loading',
  BUFFERING: 'buffering',
  PLAYING: 'playing',
  PAUSED: 'paused',
  ENDED: 'ended',
  ERROR: 'error'
} as const

export type StreamingPlayerState = (typeof StreamingPlayerState)[keyof typeof StreamingPlayerState]

export const DownloadStatus = {
  IDLE: 'idle',
  DOWNLOADING: 'downloading',
  COMPLETED: 'completed',
  FAILED: 'failed',
  RETRYING: 'retrying'
} as const

export type DownloadStatus = (typeof DownloadStatus)[keyof typeof DownloadStatus]

export interface LessonInfo {
  name: string
  version: string
  title?: string
  albumName?: string
  albumCover?: string
  duration?: number
}

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
  bufferThreshold?: number
  maxBufferSize?: number
  cacheMaxSize?: number
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

export interface CacheStats {
  usedSize: number
  maxSize: number
  fileCount: number
  files: Array<{
    name: string
    size: number
    lastAccessed: number
  }>
}

export interface StreamingPlayerReturn {
  state: Ref<StreamingPlayerState>
  currentTime: Ref<number>
  duration: Ref<number>
  isPlaying: Ref<boolean>
  isLoading: Ref<boolean>
  isBuffering: Ref<boolean>
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
  currentLesson: Ref<LessonInfo | null>
  hasNextLesson: Ref<boolean>
  hasPrevLesson: Ref<boolean>
  bufferProgress: Ref<number>
  cacheStats: Ref<CacheStats>
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
  clearCache: () => Promise<void>
  settings: {
    enableSentenceLoop: boolean
    sentenceLoopCount: number
    continueAfterLoop: boolean
  }
  lyricsContainerRef: Ref<HTMLElement | null>
}

let playerInstance: StreamingPlayerReturn | null = null

function createStreamingPlayer(options: PlayerOptions): StreamingPlayerReturn {
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
    bufferThreshold: 5,
    maxBufferSize: 5 * 1024 * 1024,
    cacheMaxSize: 50 * 1024 * 1024,
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
  let streamReader: ReadableStreamDefaultReader<Uint8Array> | null = null
  let downloadBuffer: Uint8Array[] = []
  let totalDownloadedBytes = 0
  let isStreamComplete = false
  let bufferedUntilTime = 0

  const state = ref<StreamingPlayerState>(StreamingPlayerState.IDLE)
  const isPlaying = ref(false)
  const isBuffering = ref(false)
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
  const bufferProgress = ref(0)

  const isOnline = ref(navigator.onLine)
  const isSlowNetwork = ref(false)

  const currentLesson = ref<LessonInfo | null>(null)
  const hasNextLesson = ref(false)
  const hasPrevLesson = ref(false)

  const cacheStats = ref<CacheStats>({
    usedSize: 0,
    maxSize: config.cacheMaxSize,
    fileCount: 0,
    files: []
  })

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

  const { cacheFile, readFile, fileExists, deleteFile, listFiles, clearCache: opfsClearCache } = useOPFS()

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
    return audioContext.value
  }

  const ensureContextRunning = async (): Promise<void> => {
    const ctx = getContext()
    if (ctx.state === 'suspended') {
      console.log('[useStreamingPlayer] AudioContext was suspended, resuming...')
      await ctx.resume()
      console.log('[useStreamingPlayer] AudioContext resumed, state:', ctx.state)
    }
  }

  const stopCurrentSource = (): void => {
    if (sourceNode.value) {
      try {
        sourceNode.value.stop()
      } catch {}
      sourceNode.value.disconnect()
      sourceNode.value = null
    }
  }

  const scrollToCurrentLine = async (): Promise<void> => {
    await new Promise(resolve => requestAnimationFrame(resolve))
    const container = lyricsContainerRef.value || document.body
    if (!container) return

    const activeLine = container.querySelector('.lyric-line.active') as HTMLElement
    if (!activeLine) return

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

  const scheduleNextBufferCheck = (): void => {
    if (!isPlaying.value || isStreamComplete) return

    const bufferAhead = bufferedUntilTime - currentTime.value
    
    if (bufferAhead < config.bufferThreshold && !isBuffering.value) {
      isBuffering.value = true
      state.value = StreamingPlayerState.BUFFERING
      pause()
    }

    if (bufferAhead >= config.bufferThreshold && isBuffering.value) {
      isBuffering.value = false
      if (state.value === StreamingPlayerState.BUFFERING) {
        state.value = StreamingPlayerState.PLAYING
        resume()
      }
    }

    setTimeout(scheduleNextBufferCheck, 500)
  }

  const createSourceNode = (startOffset: number, endOffset?: number): AudioBufferSourceNode | null => {
    if (!audioContext.value || !audioBuffer.value) {
      console.warn('[useStreamingPlayer] Cannot create source node: missing context or buffer')
      return null
    }

    const ctx = audioContext.value
    const buffer = audioBuffer.value
    
    const actualEnd = endOffset && endOffset < buffer.duration ? endOffset : buffer.duration
    const segmentDuration = actualEnd - startOffset

    if (segmentDuration <= 0) {
      console.warn('[useStreamingPlayer] Invalid segment duration:', segmentDuration)
      return null
    }

    console.log('[useStreamingPlayer] Creating source node:', { startOffset, actualEnd, segmentDuration })

    // 计算采样点
    const startSample = Math.floor(startOffset * buffer.sampleRate)
    const endSample = Math.floor(actualEnd * buffer.sampleRate)
    const sampleCount = endSample - startSample
    
    console.log('[useStreamingPlayer] Sample calculation:', { 
      startSample, endSample, sampleCount, 
      bufferDuration: buffer.duration,
      bufferLength: buffer.length 
    })
    
    // 边界检查
    if (startSample < 0) {
      console.warn('[useStreamingPlayer] startSample out of bounds:', startSample)
      return null
    }
    if (endSample > buffer.length) {
      console.warn('[useStreamingPlayer] endSample exceeds buffer length:', { endSample, bufferLength: buffer.length })
      return null
    }
    if (sampleCount <= 0) {
      console.warn('[useStreamingPlayer] Invalid sample count:', sampleCount)
      return null
    }

    // 创建音频片段缓冲区（使用实际的采样点数量）
    const segmentBuffer = ctx.createBuffer(
      buffer.numberOfChannels,
      sampleCount,
      buffer.sampleRate
    )

    // 复制音频数据
    for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
      const sourceData = buffer.getChannelData(channel)
      const targetData = segmentBuffer.getChannelData(channel)
      
      // 确保复制的数据长度匹配目标数组长度
      const sourceSlice = sourceData.subarray(startSample, endSample)
      if (sourceSlice.length !== targetData.length) {
        console.warn('[useStreamingPlayer] Data length mismatch:', {
          sourceLength: sourceSlice.length,
          targetLength: targetData.length
        })
        // 如果长度不匹配，只复制有效部分
        const minLength = Math.min(sourceSlice.length, targetData.length)
        targetData.set(sourceSlice.subarray(0, minLength))
      } else {
        targetData.set(sourceSlice)
      }
    }

    console.log('[useStreamingPlayer] Segment buffer created:', {
      channels: segmentBuffer.numberOfChannels,
      duration: segmentBuffer.duration,
      sampleRate: segmentBuffer.sampleRate
    })

    const source = ctx.createBufferSource()
    source.buffer = segmentBuffer
    source.playbackRate.value = playbackRate.value

    // 确保连接到音频输出
    if (gainNode.value) {
      console.log('[useStreamingPlayer] Connecting to gain node')
      source.connect(gainNode.value)
    } else {
      console.log('[useStreamingPlayer] Connecting directly to destination')
      source.connect(ctx.destination)
    }

    source.onended = () => {
      console.log('[useStreamingPlayer] Source node ended')
      
      if (!isPlaying.value) {
        console.log('[useStreamingPlayer] Source ended but not playing, skipping')
        return
      }

      if (!isStreamComplete) {
        const newOffset = startOffset + segmentDuration
        if (newOffset < bufferedUntilTime) {
          schedulePlayFrom(newOffset)
        } else if (!isBuffering.value) {
          isBuffering.value = true
          state.value = StreamingPlayerState.BUFFERING
        }
      } else {
        const newOffset = startOffset + segmentDuration
        if (newOffset < duration.value) {
          schedulePlayFrom(newOffset)
        } else if (config.loop) {
          seek(0)
        } else {
          isPlaying.value = false
          state.value = StreamingPlayerState.ENDED
        }
      }
    }

    return source
  }

  const schedulePlayFrom = (fromTime: number): void => {
    console.log('[useStreamingPlayer] schedulePlayFrom called with:', fromTime)
    
    if (!audioContext.value || !isPlaying.value) {
      console.warn('[useStreamingPlayer] schedulePlayFrom: context or playing state missing')
      return
    }

    stopCurrentSource()
    if (animationId) {
      cancelAnimationFrame(animationId)
      animationId = null
    }

    const nextSentenceIndex = lrcLines.value.findIndex(line => line.time > fromTime)
    const endOffset = nextSentenceIndex >= 0 ? lrcLines.value[nextSentenceIndex].time : undefined
    console.log('[useStreamingPlayer] schedulePlayFrom:', { fromTime, endOffset, nextSentenceIndex })

    sourceNode.value = createSourceNode(fromTime, endOffset)
    if (!sourceNode.value) {
      console.error('[useStreamingPlayer] schedulePlayFrom: failed to create source node')
      return
    }

    const ctx = audioContext.value
    startTime = ctx.currentTime
    offset = fromTime
    
    console.log('[useStreamingPlayer] schedulePlayFrom: starting source node')
    sourceNode.value.start(0)

    animationId = requestAnimationFrame(updateTime)
  }

  const play = async (fromTime?: number): Promise<void> => {
    console.log('[useStreamingPlayer] play called, fromTime:', fromTime)
    
    if (!audioBuffer.value) {
      console.warn('[useStreamingPlayer] No audio buffer, isLoading:', isLoading.value)
      if (isLoading.value) {
        return
      }
      return
    }

    await ensureContextRunning()
    const ctx = getContext()
    console.log('[useStreamingPlayer] AudioContext state:', ctx.state)

    if (currentTime.value >= duration.value && duration.value > 0) {
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

    const playTime = fromTime !== undefined ? fromTime : offset
    console.log('[useStreamingPlayer] Starting playback from:', playTime)
    
    const nextSentenceIndex = lrcLines.value.findIndex(line => line.time > playTime)
    const endOffset = nextSentenceIndex >= 0 ? lrcLines.value[nextSentenceIndex].time : undefined
    console.log('[useStreamingPlayer] End offset:', endOffset)

    sourceNode.value = createSourceNode(playTime, endOffset)
    if (!sourceNode.value) {
      console.error('[useStreamingPlayer] Failed to create source node')
      return
    }

    console.log('[useStreamingPlayer] Starting source node, gain:', gainNode.value?.gain?.value)
    startTime = ctx.currentTime
    isPlaying.value = true
    state.value = StreamingPlayerState.PLAYING
    offset = playTime

    sourceNode.value.start(0)
    console.log('[useStreamingPlayer] sourceNode.start() called successfully')

    animationId = requestAnimationFrame(updateTime)
    scheduleNextBufferCheck()
  }

  const pause = (): void => {
    if (!audioContext.value || !isPlaying.value) return

    const elapsed = audioContext.value.currentTime - startTime + offset
    offset = Math.min(elapsed, duration.value)
    currentTime.value = offset

    stopCurrentSource()
    isPlaying.value = false
    state.value = StreamingPlayerState.PAUSED

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
    if (!line) return

    if (settings.enableSentenceLoop) {
      currentSentenceIndex = lineIndex
      sentenceLoopCount = 0
    } else {
      currentSentenceIndex = -1
      sentenceLoopCount = 0
    }

    const wasPlaying = isPlaying.value

    if (wasPlaying) {
      const elapsed = audioContext.value?.currentTime
        ? audioContext.value.currentTime - startTime + offset
        : currentTime.value
      offset = Math.min(elapsed, duration.value)
    }

    stopCurrentSource()
    if (animationId) {
      cancelAnimationFrame(animationId)
      animationId = null
    }

    offset = line.time
    currentTime.value = line.time
    currentLineIndex.value = lineIndex

    if (wasPlaying) {
      play(line.time)
    } else {
      state.value = StreamingPlayerState.PAUSED
    }
  }

  const fetchWithRetry = async (
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

  const downloadLRC = async (url: string, fileName: string): Promise<void> => {
    console.log('[useStreamingPlayer] downloadLRC started:', { url, fileName })
    
    try {
      const exists = await fileExists(fileName)
      console.log('[useStreamingPlayer] LRC file exists in cache:', exists)
      
      if (exists) {
        lrcDownloadProgress.value = {
          status: DownloadStatus.COMPLETED,
          progress: 100,
          downloadedBytes: 0,
          totalBytes: 0,
          fileName,
          retryCount: 0
        }
        console.log('[useStreamingPlayer] LRC file found in cache')
        return
      }
    } catch (cacheError) {
      console.error('[useStreamingPlayer] Error checking LRC cache:', cacheError)
    }

    lrcDownloadProgress.value = {
      status: DownloadStatus.DOWNLOADING,
      progress: 0,
      downloadedBytes: 0,
      totalBytes: 0,
      fileName,
      retryCount: 0
    }

    try {
      console.log('[useStreamingPlayer] Fetching LRC from network:', url)
      const response = await fetchWithRetry(url)
      const text = await response.text()
      const buffer = new TextEncoder().encode(text).buffer
      
      console.log('[useStreamingPlayer] Caching LRC file:', fileName)
      await cacheFile(fileName, buffer)
      console.log('[useStreamingPlayer] LRC file cached successfully')

      lrcDownloadProgress.value = {
        status: DownloadStatus.COMPLETED,
        progress: 100,
        downloadedBytes: buffer.byteLength,
        totalBytes: buffer.byteLength,
        fileName,
        retryCount: 0
      }
      console.log('[useStreamingPlayer] downloadLRC completed successfully')
    } catch (err) {
      console.error('[useStreamingPlayer] downloadLRC failed:', err)
      lrcDownloadProgress.value = {
        status: DownloadStatus.FAILED,
        progress: 0,
        downloadedBytes: 0,
        totalBytes: 0,
        fileName,
        error: err instanceof Error ? err.message : '下载失败',
        retryCount: config.maxRetries + 1
      }
      throw err
    }
  }

  const streamAudio = async (url: string, fileName: string): Promise<void> => {
    console.log('[useStreamingPlayer] streamAudio started:', { url, fileName })
    await ensureContextRunning()
    
    try {
      console.log('[useStreamingPlayer] Checking if file exists in cache:', fileName)
      const exists = await fileExists(fileName)
      console.log('[useStreamingPlayer] File exists in cache:', exists)
      
      if (exists) {
        console.log('[useStreamingPlayer] Reading file from cache:', fileName)
        const buffer = await readFile(fileName)
        console.log('[useStreamingPlayer] File read from cache, size:', buffer.byteLength)
        
        console.log('[useStreamingPlayer] Decoding audio data...')
        audioBuffer.value = await getContext().decodeAudioData(buffer)
        console.log('[useStreamingPlayer] Audio data decoded, duration:', audioBuffer.value.duration)
        
        duration.value = audioBuffer.value.duration
        bufferedUntilTime = duration.value
        isStreamComplete = true
        bufferProgress.value = 100

        mp3DownloadProgress.value = {
          status: DownloadStatus.COMPLETED,
          progress: 100,
          downloadedBytes: buffer.byteLength,
          totalBytes: buffer.byteLength,
          fileName,
          retryCount: 0
        }
        
        console.log('[useStreamingPlayer] streamAudio completed from cache')
        return
      }
    } catch (cacheError) {
      console.error('[useStreamingPlayer] Error reading from cache:', cacheError)
      console.log('[useStreamingPlayer] Falling back to network download')
    }

    mp3DownloadProgress.value = {
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
        const response = await fetchWithRetry(url)
        
        const contentLength = response.headers.get('content-length')
        const totalBytes = contentLength ? parseInt(contentLength, 10) : 0
        mp3DownloadProgress.value.totalBytes = totalBytes

        if (totalBytes > 0) {
          const durationSeconds = totalBytes / (44.1 * 1024)
          duration.value = durationSeconds
        }

        streamReader = response.body?.getReader() || null
        if (!streamReader) {
          throw new Error('无法获取响应流')
        }

        downloadBuffer = []
        totalDownloadedBytes = 0

        let cachedChunks: Uint8Array[] = []
        let cacheBytes = 0
        const cacheThreshold = 1024 * 1024

        while (true) {
          const { done, value } = await streamReader.read()
          
          if (done) {
            isStreamComplete = true
            console.log('[useStreamingPlayer] Stream complete, total downloaded:', totalDownloadedBytes)
            break
          }

          downloadBuffer.push(value)
          totalDownloadedBytes += value.length

          cachedChunks.push(value)
          cacheBytes += value.length

          if (cacheBytes >= cacheThreshold) {
            console.log('[useStreamingPlayer] Cache threshold reached, writing partial cache:', cacheBytes)
            const totalCacheBuffer = new Uint8Array(cacheBytes)
            let offset = 0
            for (const chunk of cachedChunks) {
              totalCacheBuffer.set(chunk, offset)
              offset += chunk.length
            }
            
            const cacheData = totalCacheBuffer.buffer.slice(0)
            console.log('[useStreamingPlayer] Caching partial file, size:', cacheData.byteLength)
            await cacheFile(`${fileName}.partial`, cacheData)
            console.log('[useStreamingPlayer] Partial cache written successfully')
            cachedChunks = []
            cacheBytes = 0
          }

          mp3DownloadProgress.value.downloadedBytes = totalDownloadedBytes
          mp3DownloadProgress.value.progress = totalBytes
            ? Math.round((totalDownloadedBytes / totalBytes) * 100)
            : Math.min(99, (totalDownloadedBytes / 1024 / 1024) * 10)

          const totalBuffer = new Uint8Array(totalDownloadedBytes)
          let bufOffset = 0
          for (const chunk of downloadBuffer) {
            totalBuffer.set(chunk, bufOffset)
            bufOffset += chunk.length
          }

          try {
            audioBuffer.value = await getContext().decodeAudioData(totalBuffer.buffer.slice(0))
            bufferedUntilTime = audioBuffer.value.duration * (totalDownloadedBytes / (totalBytes || totalDownloadedBytes))
            bufferProgress.value = (totalDownloadedBytes / (totalBytes || totalDownloadedBytes)) * 100

            if (!audioReady.value && bufferedUntilTime >= config.bufferThreshold) {
              audioReady.value = true
              state.value = StreamingPlayerState.IDLE
              isLoading.value = false
              console.log('[useStreamingPlayer] Audio ready, triggering autoplay')

              if (config.autoplay) {
                play(0)
              }
            }
          } catch (e) {
            console.warn('[useStreamingPlayer] decodeAudioData failed:', e)
          }
        }

        console.log('[useStreamingPlayer] Stream ended, processing final cache')
        
        if (cachedChunks.length > 0) {
          console.log('[useStreamingPlayer] Writing remaining cached chunks:', cacheBytes)
          const remainingBuffer = new Uint8Array(cacheBytes)
          let remOffset = 0
          for (const chunk of cachedChunks) {
            remainingBuffer.set(chunk, remOffset)
            remOffset += chunk.length
          }
          await cacheFile(`${fileName}.partial`, remainingBuffer.buffer.slice(0))
        }

        const finalBuffer = new Uint8Array(totalDownloadedBytes)
        let finalOffset = 0
        for (const chunk of downloadBuffer) {
          finalBuffer.set(chunk, finalOffset)
          finalOffset += chunk.length
        }

        const finalData = finalBuffer.buffer.slice(0)
        console.log('[useStreamingPlayer] Caching final file, size:', finalData.byteLength)
        await cacheFile(fileName, finalData)
        console.log('[useStreamingPlayer] Final file cached successfully')
        
        await updateCacheStats()

        if (cachedChunks.length > 0) {
          console.log('[useStreamingPlayer] Cleaning up partial cache')
          try {
            await deleteFile(`${fileName}.partial`)
            console.log('[useStreamingPlayer] Partial cache deleted')
          } catch (e) {
            console.warn('[useStreamingPlayer] Failed to delete partial cache:', e)
          }
        }

        try {
          await deleteFile(`${fileName}.partial`)
        } catch {}

        mp3DownloadProgress.value = {
          status: DownloadStatus.COMPLETED,
          progress: 100,
          downloadedBytes: totalDownloadedBytes,
          totalBytes: totalBytes || totalDownloadedBytes,
          fileName,
          retryCount: 0
        }

        bufferProgress.value = 100

        return
      } catch (err) {
        lastError = err instanceof Error ? err : new Error('下载失败')
        retries--

        if (retries >= 0) {
          mp3DownloadProgress.value = {
            status: DownloadStatus.RETRYING,
            progress: mp3DownloadProgress.value.progress,
            downloadedBytes: mp3DownloadProgress.value.downloadedBytes,
            totalBytes: mp3DownloadProgress.value.totalBytes,
            fileName,
            error: `重试中 (${config.maxRetries - retries}/${config.maxRetries})`,
            retryCount: config.maxRetries - retries
          }

          await new Promise(resolve => setTimeout(resolve, config.retryDelay))
        } else {
          mp3DownloadProgress.value = {
            status: DownloadStatus.FAILED,
            progress: mp3DownloadProgress.value.progress,
            downloadedBytes: mp3DownloadProgress.value.downloadedBytes,
            totalBytes: mp3DownloadProgress.value.totalBytes,
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
    console.log('[useStreamingPlayer] loadLesson started:', { name, version })
    
    if (abortController) {
      console.log('[useStreamingPlayer] Aborting previous load')
      abortController.abort()
    }
    abortController = new AbortController()

    try {
      state.value = StreamingPlayerState.LOADING
      isLoading.value = true
      error.value = ''
      audioReady.value = false
      isStreamComplete = false
      downloadBuffer = []
      totalDownloadedBytes = 0

      console.log('[useStreamingPlayer] State set to LOADING, isLoading:', isLoading.value)

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

      console.log('[useStreamingPlayer] Starting LRC download:', urls.lrc)
      await downloadLRC(urls.lrc, files.lrc)

      console.log('[useStreamingPlayer] Reading LRC file:', files.lrc)
      const lrcBuffer = await readFile(files.lrc)
      const lrcText = new TextDecoder('utf-8').decode(lrcBuffer)
      lrcLines.value = parseBilingualLRC(lrcText)
      console.log('[useStreamingPlayer] LRC parsed, lines count:', lrcLines.value.length)

      const ctx = getContext()
      gainNode.value = ctx.createGain()
      gainNode.value.connect(ctx.destination)
      gainNode.value.gain.value = isMuted.value ? 0 : volume.value

      console.log('[useStreamingPlayer] Starting audio stream:', urls.mp3)
      await streamAudio(urls.mp3, files.mp3)

      if (!isStreamComplete && audioBuffer.value) {
        duration.value = audioBuffer.value.duration * (mp3DownloadProgress.value.totalBytes ? 
          mp3DownloadProgress.value.downloadedBytes / mp3DownloadProgress.value.totalBytes : 1)
      }

      const lessonMatch = name.match(/(\d+)－/)
      const lessonNum = lessonMatch ? parseInt(lessonMatch[1]) : 0

      currentLesson.value = {
        name,
        version,
        title: name,
        albumName: version,
        duration: duration.value
      }
      
      hasPrevLesson.value = lessonNum > 1
      
      const currentBookLessons = NCE_JSON[version] || []
      const maxLessonNum = currentBookLessons.length > 0 
        ? Math.max(...currentBookLessons.map(lesson => {
            const match = lesson.fileName.match(/^(\d+)/)
            return match ? parseInt(match[1]) : 0
          }))
        : 0
      hasNextLesson.value = lessonNum > 0 && lessonNum < maxLessonNum

      offset = 0
      currentTime.value = 0
      currentLineIndex.value = -1
      currentSentenceIndex = -1
      sentenceLoopCount = 0

      console.log('[useStreamingPlayer] loadLesson completed successfully')
    } catch (err) {
      console.error('[useStreamingPlayer] loadLesson failed:', err)
      state.value = StreamingPlayerState.ERROR
      error.value = err instanceof Error ? err.message : '未知错误'
      throw err
    } finally {
      isLoading.value = false
      console.log('[useStreamingPlayer] loadLesson finished, isLoading:', isLoading.value, 'state:', state.value)
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

  const updateCacheStats = async (): Promise<void> => {
    try {
      const files = await listFiles()
      const usedSize = files.reduce((total, file) => total + file.size, 0)
      cacheStats.value = {
        usedSize,
        maxSize: config.cacheMaxSize,
        fileCount: files.length,
        files: files.map(file => ({
          name: file.name,
          size: file.size,
          lastAccessed: file.lastAccessed
        }))
      }
    } catch (err) {
      console.error('[useStreamingPlayer] Failed to update cache stats:', err)
    }
  }

  const clearCache = async (): Promise<void> => {
    try {
      await opfsClearCache()
      cacheStats.value = {
        usedSize: 0,
        maxSize: config.cacheMaxSize,
        fileCount: 0,
        files: []
      }
      console.log('[useStreamingPlayer] Cache cleared successfully')
    } catch (err) {
      console.error('[useStreamingPlayer] Failed to clear cache:', err)
      throw err
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
    if (streamReader) {
      streamReader.cancel()
      streamReader = null
    }
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
    isBuffering,
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
    currentLesson,
    hasNextLesson,
    hasPrevLesson,
    bufferProgress,
    cacheStats,
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
    clearCache,
    settings,
    lyricsContainerRef
  }
}

export function useStreamingPlayer(options: PlayerOptions = {}): StreamingPlayerReturn {
  if (!playerInstance) {
    playerInstance = createStreamingPlayer(options)
  }
  return playerInstance
}
