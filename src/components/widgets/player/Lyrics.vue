<script setup lang="ts">
import { ref, computed, nextTick, watch, onMounted } from 'vue'
import type { LRCLine } from 'Types'
import { formatTime } from 'Utils/common'

interface Props {
  lrcLines?: LRCLine[]
  currentTime?: number
  duration?: number
  currentLineIndex?: number
  isPlaying?: boolean
  autoPlay?: boolean
}

interface Emits {
  (e: 'line-click', line: LRCLine): void
  (e: 'seek', time: number): void
}

const props = withDefaults(defineProps<Props>(), {
  lrcLines: () => [],
  currentTime: 0,
  duration: 0,
  currentLineIndex: -1,
  isPlaying: false,
  autoPlay: false
})

const emit = defineEmits<Emits>()

// 响应式状态
const showTranslation = ref(true)
const showTimestamps = ref(false)
const autoScroll = ref(true)

// DOM 引用
const lyricsContainer = ref<HTMLElement>()
const activeLineRef = ref<HTMLElement>()

// 计算属性
const currentLine = computed(() => {
  if (props.currentLineIndex >= 0 && props.currentLineIndex < props.lrcLines.length) {
    return props.lrcLines[props.currentLineIndex]
  }
  return null
})

// 监听当前行变化，自动滚动
watch(
  () => props.currentLineIndex,
  async (newIndex, oldIndex) => {
    if (newIndex !== oldIndex && autoScroll.value && newIndex >= 0) {
      await nextTick()
      scrollToActiveLine()
    }
  }
)

/**
 * 点击歌词行
 */
function handleLineClick(line: LRCLine): void {
  emit('line-click', line)
  emit('seek', line.time)
}

/**
 * 滚动到当前高亮行
 */
function scrollToActiveLine(): void {
  if (!lyricsContainer.value || !activeLineRef.value) return

  const container = lyricsContainer.value
  const activeLine = activeLineRef.value

  // 计算滚动位置，使当前行位于容器中间偏上位置
  const containerHeight = container.clientHeight
  const lineHeight = activeLine.offsetHeight
  const lineTop = activeLine.offsetTop

  // 让当前行显示在容器上方 1/3 位置
  const scrollTo = lineTop - containerHeight / 3 + lineHeight / 2

  container.scrollTo({
    top: Math.max(0, scrollTo),
    behavior: 'smooth'
  })
}

/**
 * 切换翻译显示
 */
function toggleTranslation(): void {
  showTranslation.value = !showTranslation.value
}

/**
 * 切换时间戳显示
 */
function toggleTimestamps(): void {
  showTimestamps.value = !showTimestamps.value
}

/**
 * 切换自动滚动
 */
function toggleAutoScroll(): void {
  autoScroll.value = !autoScroll.value
}

// 组件挂载时初始化滚动
onMounted(() => {
  if (props.currentLineIndex >= 0 && autoScroll.value) {
    nextTick(() => {
      scrollToActiveLine()
    })
  }
})
</script>

<template>
  <div class="lyrics">
    <!-- 当前播放行（大字体居中显示） -->
    <div v-if="currentLine" class="current-line-display">
      <div class="current-line-text">
        {{ currentLine.textEn }}
      </div>
      <div v-if="showTranslation && currentLine.textZh" class="current-line-translation">
        {{ currentLine.textZh }}
      </div>
    </div>

    <!-- 歌词滚动区域 -->
    <div
      ref="lyricsContainer"
      class="lyrics-scroll-container"
      :class="{ 'has-translations': showTranslation }"
    >
      <div
        v-for="(line, index) in lrcLines"
        :key="index"
        :ref="
          el => {
            if (index === currentLineIndex) activeLineRef = el as HTMLElement
          }
        "
        class="lyric-line"
        :class="{
          active: index === currentLineIndex,
          past: index < currentLineIndex,
          future: index > currentLineIndex,
          'has-translation': line.textZh && showTranslation
        }"
        @click="() => handleLineClick(line)"
      >
        <div class="english-text">{{ line.textEn }}</div>
        <div v-if="showTranslation && line.textZh" class="chinese-text">
          {{ line.textZh }}
        </div>
        <div v-if="showTimestamps" class="time-indicator">
          {{ formatTime(line.time) }}
        </div>
      </div>
    </div>

    <!-- 控制面板 -->
    <div class="control-panel">
      <div class="control-buttons">
        <button
          class="control-btn toggle-btn"
          @click="toggleTranslation"
          :title="showTranslation ? '隐藏翻译' : '显示翻译'"
        >
          <span class="btn-icon">{{ showTranslation ? '🌐' : '🔤' }}</span>
          <span class="btn-text">{{ showTranslation ? '隐藏翻译' : '显示翻译' }}</span>
        </button>

        <button
          class="control-btn toggle-btn"
          @click="toggleTimestamps"
          :title="showTimestamps ? '隐藏时间戳' : '显示时间戳'"
        >
          <span class="btn-icon">{{ showTimestamps ? '⏱️' : '🕐' }}</span>
          <span class="btn-text">{{ showTimestamps ? '隐藏时间' : '显示时间' }}</span>
        </button>

        <button
          class="control-btn toggle-btn"
          @click="toggleAutoScroll"
          :title="autoScroll ? '关闭自动滚动' : '开启自动滚动'"
        >
          <span class="btn-icon">{{ autoScroll ? '📜' : '📃' }}</span>
          <span class="btn-text">{{ autoScroll ? '自动滚动' : '手动滚动' }}</span>
        </button>
      </div>

      <!-- 播放进度 -->
      <div class="progress-info">
        <span class="current-time">{{ formatTime(currentTime) }}</span>
        <span class="time-separator">/</span>
        <span class="total-time">{{ formatTime(duration) }}</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.lyrics {
  display: flex;
  flex-direction: column;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  font-family: 'Segoe UI', system-ui, sans-serif;
}

.current-line-display {
  padding: 40px 20px;
  text-align: center;
  background: rgba(0, 0, 0, 0.3);
  backdrop-filter: blur(10px);
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.current-line-text {
  font-size: 2.5rem;
  font-weight: 600;
  line-height: 1.3;
  margin-bottom: 16px;
  text-shadow: 0 2px 10px rgba(0, 0, 0, 0.3);
}

.current-line-translation {
  font-size: 1.5rem;
  opacity: 0.8;
  line-height: 1.4;
  text-shadow: 0 1px 5px rgba(0, 0, 0, 0.3);
}

.lyrics-scroll-container {
  flex: 1;
  overflow-y: auto;
  padding: 20px;
  scroll-behavior: smooth;
}

.lyrics-scroll-container.has-translations .lyric-line {
  min-height: 80px;
}

.lyric-line {
  padding: 16px 20px;
  margin-bottom: 8px;
  border-radius: 12px;
  cursor: pointer;
  transition: all 0.3s ease;
  border: 2px solid transparent;
  background: rgba(255, 255, 255, 0.05);
  backdrop-filter: blur(5px);
}

.lyric-line:hover {
  background: rgba(255, 255, 255, 0.1);
  transform: translateX(5px);
}

.lyric-line.active {
  background: rgba(255, 255, 255, 0.15);
  border-color: rgba(255, 255, 255, 0.3);
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.2);
  transform: scale(1.02);
}

.lyric-line.past {
  opacity: 0.6;
  transform: scale(0.95);
}

.lyric-line.future {
  opacity: 0.4;
}

.lyric-line.has-translation {
  padding: 20px;
}

.english-text {
  font-size: 1.3rem;
  font-weight: 500;
  line-height: 1.4;
  margin-bottom: 8px;
}

.chinese-text {
  font-size: 1.1rem;
  opacity: 0.8;
  line-height: 1.4;
  font-style: italic;
}

.time-indicator {
  position: absolute;
  top: 50%;
  right: 12px;
  transform: translateY(-50%);
  font-size: 0.8rem;
  opacity: 0.6;
  background: rgba(255, 255, 255, 0.1);
  padding: 2px 8px;
  border-radius: 12px;
}

.control-panel {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  background: rgba(0, 0, 0, 0.4);
  backdrop-filter: blur(10px);
  border-top: 1px solid rgba(255, 255, 255, 0.1);
}

.control-buttons {
  display: flex;
  gap: 8px;
}

.control-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 12px;
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.1);
  color: white;
  font-size: 0.85rem;
  cursor: pointer;
  transition: all 0.2s ease;
  backdrop-filter: blur(5px);
}

.control-btn:hover {
  background: rgba(255, 255, 255, 0.2);
  border-color: rgba(255, 255, 255, 0.3);
  transform: translateY(-1px);
}

.btn-icon {
  font-size: 1rem;
}

.btn-text {
  font-weight: 500;
}

.progress-info {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 0.9rem;
  font-variant-numeric: tabular-nums;
  opacity: 0.8;
}

.time-separator {
  opacity: 0.5;
}

.current-time {
  font-weight: 600;
  color: #ffd700;
}

/* 响应式设计 */
@media (max-width: 768px) {
  .current-line-text {
    font-size: 2rem;
  }

  .current-line-translation {
    font-size: 1.2rem;
  }

  .english-text {
    font-size: 1.1rem;
  }

  .chinese-text {
    font-size: 1rem;
  }

  .control-panel {
    flex-direction: column;
    gap: 12px;
    align-items: stretch;
  }

  .control-buttons {
    justify-content: center;
    flex-wrap: wrap;
  }

  .progress-info {
    justify-content: center;
  }

  .lyric-line {
    padding: 12px 16px;
  }

  .lyric-line.has-translation {
    padding: 16px;
  }

  .time-indicator {
    position: static;
    transform: none;
    margin-top: 8px;
    display: inline-block;
  }
}

@media (max-width: 480px) {
  .current-line-text {
    font-size: 1.6rem;
  }

  .current-line-translation {
    font-size: 1rem;
  }

  .english-text {
    font-size: 1rem;
  }

  .lyrics-scroll-container {
    padding: 12px;
  }

  .control-btn {
    padding: 6px 10px;
    font-size: 0.8rem;
  }

  .btn-text {
    display: none;
  }
}

/* 滚动条样式 */
.lyrics-scroll-container::-webkit-scrollbar {
  width: 6px;
}

.lyrics-scroll-container::-webkit-scrollbar-track {
  background: rgba(255, 255, 255, 0.1);
  border-radius: 3px;
}

.lyrics-scroll-container::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.3);
  border-radius: 3px;
}

.lyrics-scroll-container::-webkit-scrollbar-thumb:hover {
  background: rgba(255, 255, 255, 0.5);
}
</style>
