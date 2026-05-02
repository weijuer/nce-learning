import { ref, computed, onUnmounted } from 'vue'
import type { LRCLine } from '../types'

export interface SubtitleItem {
  start: number // 开始时间（秒）
  end: number // 结束时间（秒）
  zh: string // 中文字幕
  en: string // 英文字幕
}

export function useAudioPlayer() {
  // ---------- 响应式状态 ----------
  const audioContext = ref<AudioContext | null>(null)
  const gainNode = ref<GainNode | null>(null) // 音量控制节点
  const sourceNode = ref<AudioBufferSourceNode | null>(null)
  const audioBuffer = ref<AudioBuffer | null>(null)

  const isPlaying = ref(false)
  const totalDuration = ref(0) // 音频总时长（秒）
  const currentTime = ref(0) // 当前播放时间（秒）
  const volume = ref(1) // 音量 (0-1)
  const isMuted = ref(false) // 是否静音
  const playbackRate = ref(1) // 播放倍速

  // 用于播放控制的私有变量
  let startTime = 0 // 当前播放片段的起始音频上下文时间
  let offset = 0 // 播放头在音频中的偏移（秒）
  let animationId: number | null = null // requestAnimationFrame ID
  let lastTimestamp = 0 // 用于精确同步字幕的时间戳

  // 字幕列表
  const subtitles = ref<SubtitleItem[]>([])
  const lrcLines = ref<LRCLine[]>([])
  const currentLineIndex = ref(-1)
  const currentSubtitle = ref<SubtitleItem | null>(null) // 当前激活的字幕

  // 计算属性：进度百分比
  const progressPercent = computed(() => {
    if (totalDuration.value === 0) return 0
    return (currentTime.value / totalDuration.value) * 100
  })

  // ---------- 辅助函数 ----------
  // 格式化时间 (秒 -> mm:ss)
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }

  // 更新当前时间（在动画帧中调用）
  const updateTime = () => {
    if (!audioContext.value || !isPlaying.value) return

    const now = audioContext.value.currentTime
    const elapsed = now - startTime + offset
    currentTime.value = Math.min(elapsed, totalDuration.value)

    // 更新字幕显示
    updateCurrentSubtitle(currentTime.value)

    animationId = requestAnimationFrame(updateTime)
  }

  // 根据播放时间更新当前字幕
  const updateCurrentSubtitle = (time: number) => {
    const active = subtitles.value.find(sub => time >= sub.start && time <= sub.end)
    currentSubtitle.value = active || null
  }

  // 创建音频源节点并配置参数
  const createSourceNode = () => {
    if (!audioContext.value || !audioBuffer.value) return null

    const source = audioContext.value.createBufferSource()
    source.buffer = audioBuffer.value
    source.playbackRate.value = playbackRate.value

    // 连接音量节点
    if (gainNode.value) {
      source.connect(gainNode.value)
    } else {
      source.connect(audioContext.value.destination)
    }

    return source
  }

  // 停止当前播放的源节点
  const stopCurrentSource = () => {
    if (sourceNode.value) {
      try {
        sourceNode.value.stop()
      } catch (e) {
        // 可能已经停止，忽略错误
      }
      sourceNode.value.disconnect()
      sourceNode.value = null
    }
  }

  // 恢复/启动音频上下文（处理浏览器自动播放策略）
  const resumeContext = async () => {
    if (audioContext.value && audioContext.value.state === 'suspended') {
      await audioContext.value.resume()
    }
  }

  // ---------- 公共方法 ----------
  // 加载音频文件
  const loadAudio = async (url: string) => {
    // 停止当前播放
    if (isPlaying.value) pause()
    stopCurrentSource()

    // 关闭旧的上下文
    if (audioContext.value) {
      await audioContext.value.close()
    }

    // 创建新的 AudioContext
    const AudioCtor = window.AudioContext || (window as any).webkitAudioContext
    audioContext.value = new AudioCtor()

    // 创建音量控制节点
    gainNode.value = audioContext.value.createGain()
    gainNode.value.connect(audioContext.value.destination)
    gainNode.value.gain.value = isMuted.value ? 0 : volume.value

    // 获取音频数据
    const response = await fetch(url)
    const arrayBuffer = await response.arrayBuffer()
    audioBuffer.value = await audioContext.value.decodeAudioData(arrayBuffer)
    totalDuration.value = audioBuffer.value.duration

    // 重置播放状态
    offset = 0
    currentTime.value = 0
    isPlaying.value = false
    if (animationId) cancelAnimationFrame(animationId)
  }

  // 播放（从当前位置）
  const play = async () => {
    if (!audioBuffer.value || !audioContext.value) return

    await resumeContext()
    if (isPlaying.value) return

    // 如果已经到达末尾，从头开始
    if (currentTime.value >= totalDuration.value) {
      offset = 0
      currentTime.value = 0
    }

    // 创建新源节点
    stopCurrentSource()
    sourceNode.value = createSourceNode()
    if (!sourceNode.value) return

    // 记录开始时间
    startTime = audioContext.value.currentTime
    // 从 offset 处开始播放
    sourceNode.value.start(0, offset)
    isPlaying.value = true

    // 启动时间更新循环
    if (animationId) cancelAnimationFrame(animationId)
    animationId = requestAnimationFrame(updateTime)
  }

  // 暂停
  const pause = () => {
    if (!audioContext.value || !isPlaying.value) return

    // 记录当前播放位置
    const elapsed = audioContext.value.currentTime - startTime + offset
    offset = Math.min(elapsed, totalDuration.value)
    currentTime.value = offset

    // 停止源节点
    stopCurrentSource()
    isPlaying.value = false

    if (animationId) {
      cancelAnimationFrame(animationId)
      animationId = null
    }
  }

  // 跳转到指定时间（秒）
  const seekTo = async (time: number) => {
    if (!audioBuffer.value) return

    let newTime = Math.min(Math.max(0, time), totalDuration.value)
    const wasPlaying = isPlaying.value

    if (wasPlaying) {
      // 如果正在播放，需要先暂停再跳转后继续播放
      pause()
      offset = newTime
      currentTime.value = newTime
      await play()
    } else {
      // 暂停状态只更新位置，不播放
      offset = newTime
      currentTime.value = newTime
      // 如果当前有源节点（比如刚加载完还没播放），停止它
      stopCurrentSource()
    }

    // 更新字幕显示
    updateCurrentSubtitle(currentTime.value)
  }

  // 设置音量 (0-1)
  const setVolume = (value: number) => {
    volume.value = Math.min(1, Math.max(0, value))
    if (gainNode.value) {
      gainNode.value.gain.value = isMuted.value ? 0 : volume.value
    }
  }

  // 静音切换
  const toggleMute = () => {
    isMuted.value = !isMuted.value
    if (gainNode.value) {
      gainNode.value.gain.value = isMuted.value ? 0 : volume.value
    }
  }

  // 设置播放倍速
  const setPlaybackRate = (rate: number) => {
    playbackRate.value = rate
    if (sourceNode.value) {
      // 如果正在播放，动态调整倍速
      sourceNode.value.playbackRate.value = rate
    }
    // 注意：如果由暂停状态再播放，新创建的 sourceNode 会使用新的 playbackRate
  }

  // 加载字幕（接受一个字幕数组）
  const loadSubtitles = (subs: SubtitleItem[]) => {
    subtitles.value = subs.sort((a, b) => a.start - b.start)
    updateCurrentSubtitle(currentTime.value)
  }

  // 清理资源（组件卸载时调用）
  const cleanup = async () => {
    if (isPlaying.value) pause()
    if (animationId) cancelAnimationFrame(animationId)
    if (sourceNode.value) stopCurrentSource()
    if (audioContext.value) {
      await audioContext.value.close()
    }
  }

  // 组件卸载时自动清理
  onUnmounted(() => {
    cleanup()
  })

  return {
    // 状态
    isPlaying,
    totalDuration,
    currentTime,
    volume,
    isMuted,
    playbackRate,
    subtitles,
    currentSubtitle,
    progressPercent,

    // 方法
    loadAudio,
    play,
    pause,
    seekTo,
    setVolume,
    toggleMute,
    setPlaybackRate,
    loadSubtitles,
    formatTime,
    cleanup
  }
}
