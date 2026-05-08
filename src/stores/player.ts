import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { LRCLine } from '../types'

export const usePlayerStore = defineStore('player', () => {
  // 播放器状态
  const currentBook = ref<string>('')
  const currentLesson = ref<string>('')
  const isPlaying = ref(false)
  const currentTime = ref(0)
  const duration = ref(0)
  const volume = ref(0.7)
  const playbackRate = ref(1)
  const isMuted = ref(false)

  // 歌词状态
  const lrcLines = ref<LRCLine[]>([])
  const currentLineIndex = ref(-1)

  // 计算属性
  const progress = computed(() => (duration.value ? (currentTime.value / duration.value) * 100 : 0))

  const currentLine = computed(() =>
    currentLineIndex.value >= 0 ? lrcLines.value[currentLineIndex.value] : null
  )

  const formattedCurrentTime = computed(() => formatTime(currentTime.value))
  const formattedDuration = computed(() => formatTime(duration.value))

  // 辅助函数
  function formatTime(seconds: number): string {
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }

  // 方法
  function setLesson(book: string, lesson: string) {
    currentBook.value = book
    currentLesson.value = lesson
    reset()
  }

  function updateTime(time: number) {
    currentTime.value = time
    updateCurrentLine(time)
  }

  function updateCurrentLine(time: number) {
    const idx = lrcLines.value.findLastIndex(line => line.time <= time)
    currentLineIndex.value = idx
  }

  function setLrcLines(lines: LRCLine[]) {
    lrcLines.value = lines
  }

  function reset() {
    isPlaying.value = false
    currentTime.value = 0
    duration.value = 0
    currentLineIndex.value = -1
  }

  function toggleMute() {
    isMuted.value = !isMuted.value
  }

  return {
    // 状态
    currentBook,
    currentLesson,
    isPlaying,
    currentTime,
    duration,
    volume,
    playbackRate,
    isMuted,
    lrcLines,
    currentLineIndex,

    // 计算属性
    progress,
    currentLine,
    formattedCurrentTime,
    formattedDuration,

    // 方法
    setLesson,
    updateTime,
    updateCurrentLine,
    setLrcLines,
    reset,
    toggleMute
  }
})
