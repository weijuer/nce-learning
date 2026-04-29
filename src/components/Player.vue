<script name="Player" setup lang="ts">
import { ref, onMounted, onUnmounted, computed, nextTick, watch } from 'vue'
import type { LRCLine } from '../types'
import { useOPFS } from '../composables/useOPFS'
import { useAudio } from '../composables/useAudio'
import { parseBilingualLRC } from '../utils/lrc-parser'
import AudioPlayer from './widgets/AudioPlayer.vue'

interface Props {
  name?: string
  version?: string
  fileName?: string
}

const props = withDefaults(defineProps<Props>(), {
  name: '',
  version: '',
  fileName: '001&002－Excuse Me'
})

// 计算资源路径
const resourceUrls = computed(() => {
  const basePath = `data/${props.version || 'NCE1'}`
  return {
    mp3: `${basePath}/${props.name}.mp3`,
    lrc: `${basePath}/${props.name}.lrc`
  }
})

const resourcePaths = computed(() => ({
  mp3: `${props.name}.mp3`,
  lrc: `${props.name}.lrc`
}))

// Composables
const { cacheFile, readFile, fileExists, deleteFile } = useOPFS()
const { isPlaying, duration, loadFromBuffer, play, pause, resume, seek, getCurrentTime, destroy } =
  useAudio()

// 响应式状态
const lrcLines = ref<LRCLine[]>([])
const currentLineIndex = ref(-1)
const currentTime = ref(0)
const isLoading = ref(true)
const audioReady = ref(false)
const error = ref('')

// DOM 引用
const lyricsContainer = ref<HTMLElement>()
const activeLineRef = ref<HTMLElement>()

// 计算属性
const currentLine = computed(() =>
  currentLineIndex.value >= 0 ? lrcLines.value[currentLineIndex.value] : null
)

const hasLyrics = computed(() => lrcLines.value.length > 0)

// 动画帧ID
let animationId = 0

/**
 * 缓存单个资源文件
 */
async function cacheResource(filePath: string, url: string, type: '音频' | '歌词'): Promise<void> {
  const exists = await fileExists(filePath)
  if (exists) return

  console.log(`正在下载${type}文件...`)
  const response = await fetch(url)
  if (!response.ok) throw new Error(`${type}下载失败 (${response.status})`)

  const buffer = await response.arrayBuffer()
  await cacheFile(filePath, buffer)
  console.log(`${type}已缓存`)
}

/**
 * 加载所有资源
 */
async function loadResources(): Promise<void> {
  try {
    // 并行缓存音频和歌词文件
    await Promise.all([
      cacheResource(resourcePaths.value.mp3, resourceUrls.value.mp3, '音频'),
      cacheResource(resourcePaths.value.lrc, resourceUrls.value.lrc, '歌词')
    ])

    // 读取并解析歌词
    const lrcBuffer = await readFile(resourcePaths.value.lrc)
    const lrcText = new TextDecoder('utf-8').decode(lrcBuffer)
    lrcLines.value = parseBilingualLRC(lrcText)
  } catch (err) {
    throw new Error(`资源加载失败: ${err instanceof Error ? err.message : '未知错误'}`)
  }
}

/**
 * 初始化音频
 */
async function initAudio(): Promise<void> {
  try {
    const mp3Buffer = await readFile(resourcePaths.value.mp3)
    await loadFromBuffer(mp3Buffer)
  } catch (err) {
    throw new Error(`音频初始化失败: ${err instanceof Error ? err.message : '未知错误'}`)
  }
}

/**
 * 播放/暂停切换
 */
function handlePlayPause(): void {
  if (!audioReady.value) return

  isPlaying.value ? pause() : resume()
}

/**
 * 点击歌词行跳转
 */
function handleLineClick(line: LRCLine): void {
  if (!audioReady.value) return

  seek(line.time)
  if (!isPlaying.value) {
    play(line.time)
  }
}

/**
 * 滚动到当前高亮行
 */
function scrollToActiveLine(): void {
  if (!lyricsContainer.value || !activeLineRef.value) return

  const container = lyricsContainer.value
  const activeLine = activeLineRef.value

  // 计算滚动位置，使当前行位于容器中间
  const containerHeight = container.clientHeight
  const lineHeight = activeLine.offsetHeight
  const lineTop = activeLine.offsetTop

  const scrollTo = lineTop - containerHeight / 2 + lineHeight / 2

  container.scrollTo({
    top: scrollTo,
    behavior: 'smooth'
  })
}

/**
 * 格式化时间显示
 */
function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
}

/**
 * 开始时间更新循环
 */
function startTimeUpdateLoop(): void {
  function update(): void {
    if (!audioReady.value) return

    currentTime.value = getCurrentTime()

    // 查找当前高亮行（使用 findLastIndex 优化性能）
    const idx = lrcLines.value.findLastIndex(line => line.time <= currentTime.value)

    // 只有当行索引发生变化时才更新和滚动
    if (idx !== currentLineIndex.value) {
      currentLineIndex.value = idx

      // 延迟滚动以确保 DOM 已更新
      nextTick(() => {
        if (idx >= 0) {
          scrollToActiveLine()
        }
      })
    }

    animationId = requestAnimationFrame(update)
  }
  update()
}

/**
 * 清除缓存
 */
async function clearCache(): Promise<void> {
  try {
    await Promise.all([deleteFile(resourcePaths.value.mp3), deleteFile(resourcePaths.value.lrc)])

    error.value = '缓存已清除，刷新页面重新下载。'
    audioReady.value = false

    // 重新初始化播放器
    await initPlayer()
  } catch (err) {
    error.value = `清除缓存失败：${err instanceof Error ? err.message : '未知错误'}`
  }
}

/**
 * 初始化播放器
 */
async function initPlayer(): Promise<void> {
  try {
    isLoading.value = true
    error.value = ''

    await loadResources()
    await initAudio()
    audioReady.value = true
  } catch (err) {
    error.value = err instanceof Error ? err.message : '初始化失败'
    console.error('播放器初始化失败:', err)
  } finally {
    isLoading.value = false
  }
}

// 监听 props 变化，动态切换课程
watch([() => props.version, () => props.fileName], async () => {
  if (props.version && props.fileName) {
    await initPlayer()
  }
})

// 生命周期
onMounted(async () => {
  await initPlayer()
  startTimeUpdateLoop()
})

onUnmounted(() => {
  cancelAnimationFrame(animationId)
  destroy()
})
</script>

<template>
  <div class="player-container">
    <!-- 头部信息 -->
    <div v-if="props.name || props.version" class="player-header">
      <h2 v-if="props.name" class="lesson-name">{{ props.name }}</h2>
      <span v-if="props.version" class="lesson-version">{{ props.version }}</span>
    </div>

    <!-- 错误提示 -->
    <div v-if="error" class="error-message">
      <span class="error-icon">⚠️</span>
      {{ error }}
    </div>

    <!-- 加载状态 -->
    <div v-if="isLoading" class="loading-state">
      <div class="loading-spinner"></div>
      <span>加载资源中...</span>
    </div>

    <!-- 歌词显示区域 -->
    <div v-if="hasLyrics && !isLoading" ref="lyricsContainer" class="lyrics-container">
      <div
        v-for="(line, index) in lrcLines"
        :key="index"
        :ref="
          el => {
            if (index === currentLineIndex) activeLineRef = el
          }
        "
        class="lyric-line"
        :class="{
          active: index === currentLineIndex,
          'has-translation': line.textZh
        }"
        @click="() => handleLineClick(line)"
      >
        <div class="english-text">{{ line.textEn }}</div>
        <div v-if="line.textZh" class="chinese-text">{{ line.textZh }}</div>
        <div v-if="index === currentLineIndex" class="time-indicator">
          {{ formatTime(line.time) }}
        </div>
      </div>
    </div>

    <!-- 音频播放器 -->
    <div v-if="!isLoading" class="audio-section">
      <AudioPlayer :audio-src="resourceUrls.mp3" :auto-play="false" />
    </div>

    <!-- 控制按钮 -->
    <div v-if="!isLoading" class="control-section">
      <div class="control-buttons">
        <button
          class="control-btn play-btn"
          @click="handlePlayPause"
          :disabled="!audioReady"
          :title="isPlaying ? '暂停' : '播放'"
        >
          <span class="btn-icon">{{ isPlaying ? '⏸️' : '▶️' }}</span>
          <span class="btn-text">{{ isPlaying ? '暂停' : '播放' }}</span>
        </button>

        <button
          class="control-btn clear-btn"
          @click="clearCache"
          :disabled="isLoading"
          title="清除缓存"
        >
          <span class="btn-icon">🗑️</span>
          <span class="btn-text">清除缓存</span>
        </button>
      </div>

      <!-- 时间显示 -->
      <div class="time-display">
        <span class="current-time">{{ formatTime(currentTime) }}</span>
        <span class="time-separator">/</span>
        <span class="total-time">{{ formatTime(duration) }}</span>
      </div>
    </div>

    <!-- 当前播放行信息 -->
    <div v-if="currentLine && !isLoading" class="current-line-info">
      <div class="current-line-text">
        <strong>当前播放:</strong>
        {{ currentLine.textEn }}
        <span v-if="currentLine.textZh">- {{ currentLine.textZh }}</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.player-container {
  max-width: 800px;
  margin: 0 auto;
  padding: 20px;
  background: var(--surface);
  border-radius: 12px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.player-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 24px;
  padding-bottom: 16px;
  border-bottom: 1px solid var(--border);
}

.lesson-name {
  font-size: 1.5rem;
  font-weight: 600;
  color: var(--text-primary);
  margin: 0;
}

.lesson-version {
  font-size: 0.875rem;
  color: var(--text-secondary);
  background: var(--surface-secondary);
  padding: 4px 8px;
  border-radius: 6px;
}

.error-message {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 16px;
  background: #fef2f2;
  border: 1px solid #fecaca;
  border-radius: 8px;
  color: #dc2626;
  margin-bottom: 16px;
}

.error-icon {
  font-size: 1.2rem;
}

.loading-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px 20px;
  color: var(--text-secondary);
}

.loading-spinner {
  width: 32px;
  height: 32px;
  border: 3px solid var(--border);
  border-top: 3px solid var(--primary);
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin-bottom: 12px;
}

@keyframes spin {
  0% {
    transform: rotate(0deg);
  }
  100% {
    transform: rotate(360deg);
  }
}

.lyrics-container {
  max-height: 400px;
  overflow-y: auto;
  margin-bottom: 24px;
  padding: 16px;
  background: var(--surface-secondary);
  border-radius: 8px;
  border: 1px solid var(--border);
  scroll-behavior: smooth;
}

.lyric-line {
  position: relative;
  padding: 12px 16px;
  margin-bottom: 8px;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s ease;
  border: 1px solid transparent;
}

.lyric-line:hover {
  background: var(--hover);
  transform: translateY(-1px);
}

.lyric-line.active {
  background: var(--primary-light);
  border-color: var(--primary);
  box-shadow: 0 2px 8px rgba(59, 130, 246, 0.1);
}

.lyric-line.has-translation {
  padding: 16px;
}

.english-text {
  font-size: 1.1rem;
  font-weight: 500;
  color: var(--text-primary);
  margin-bottom: 4px;
}

.chinese-text {
  font-size: 0.95rem;
  color: var(--text-secondary);
  line-height: 1.4;
}

.time-indicator {
  position: absolute;
  top: 50%;
  right: 12px;
  transform: translateY(-50%);
  font-size: 0.75rem;
  color: var(--primary);
  background: rgba(59, 130, 246, 0.1);
  padding: 2px 6px;
  border-radius: 4px;
}

.audio-section {
  margin-bottom: 20px;
}

.control-section {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}

.control-buttons {
  display: flex;
  gap: 12px;
}

.control-btn {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 16px;
  border: none;
  border-radius: 8px;
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
}

.control-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  transform: none;
}

.play-btn {
  background: var(--primary);
  color: white;
}

.play-btn:not(:disabled):hover {
  background: var(--primary-dark);
  transform: translateY(-1px);
}

.clear-btn {
  background: var(--surface-secondary);
  color: var(--text-secondary);
  border: 1px solid var(--border);
}

.clear-btn:not(:disabled):hover {
  background: var(--hover);
  color: var(--text-primary);
}

.btn-icon {
  font-size: 1rem;
}

.btn-text {
  font-weight: 500;
}

.time-display {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 0.875rem;
  color: var(--text-secondary);
  font-variant-numeric: tabular-nums;
}

.time-separator {
  color: var(--text-tertiary);
}

.current-time {
  color: var(--primary);
  font-weight: 500;
}

.current-line-info {
  margin-top: 16px;
  padding: 12px 16px;
  background: var(--surface-secondary);
  border-radius: 8px;
  border-left: 4px solid var(--primary);
}

.current-line-text {
  font-size: 0.9rem;
  color: var(--text-primary);
}

/* 响应式设计 */
@media (max-width: 640px) {
  .player-container {
    padding: 16px;
    margin: 0 8px;
  }

  .player-header {
    flex-direction: column;
    gap: 8px;
    align-items: flex-start;
  }

  .lesson-name {
    font-size: 1.25rem;
  }

  .control-section {
    flex-direction: column;
    align-items: stretch;
    gap: 12px;
  }

  .control-buttons {
    justify-content: center;
  }

  .time-display {
    justify-content: center;
  }

  .lyrics-container {
    max-height: 300px;
    padding: 12px;
  }

  .lyric-line {
    padding: 10px 12px;
  }

  .lyric-line.has-translation {
    padding: 12px;
  }

  .time-indicator {
    position: static;
    transform: none;
    margin-top: 4px;
    display: inline-block;
  }
}
</style>
