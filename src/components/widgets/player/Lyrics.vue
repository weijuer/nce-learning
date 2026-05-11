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
  (e: 'line-click', index: number): void
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
function handleLineClick(index: number): void {
  emit('line-click', index)
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
    <!-- <div v-if="currentLine" class="current-line-display">
      <div class="current-line-text">
        {{ currentLine.textEn }}
      </div>
      <div v-if="showTranslation && currentLine.textZh" class="current-line-translation">
        {{ currentLine.textZh }}
      </div>
    </div> -->

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
          future: index > currentLineIndex
        }"
        @click="() => handleLineClick(index)"
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
    <div class="control-panel" v-if="isPlaying">
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
}

.current-line-display {
  margin-bottom: 1rem;
  padding: 40px 20px;
  text-align: center;
  background: rgba(0, 0, 0, 0.3);
  backdrop-filter: blur(10px);
  border-radius: 14px;

  .current-line-text {
    font-size: clamp(1.5rem, 5vw, 2.5rem);
    font-weight: 600;
    line-height: 1.3;
    margin-bottom: 16px;
    text-shadow: 0 2px 10px rgba(0, 0, 0, 0.3);
  }

  .current-line-translation {
    font-size: clamp(1.1rem, 5vw, 1.5rem);
    opacity: 0.8;
    line-height: 1.4;
    text-shadow: 0 1px 5px rgba(0, 0, 0, 0.3);
  }
}

.lyrics-scroll-container {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  flex: 1;
  /* overflow-y: auto;
  scroll-behavior: smooth; */
}

.lyrics-scroll-container.has-translations .lyric-line {
  min-height: 80px;
}

.lyric-line {
  padding: 16px 20px;
  cursor: pointer;
  border: 2px solid var(--border-color);
  border-radius: 12px;
  background-color: rgba(255, 255, 255, 0.05);
  transition: all 0.3s ease;
  backdrop-filter: blur(5px);
  animation:
    fadeIn linear,
    fadeOut linear;
  animation-timeline: view(), view();
  animation-range: entry, exit;

  &:hover {
    background: rgba(255, 255, 255, 0.1);
  }

  &.active {
    background-color: rgba(255, 255, 255, 0.15);
    border-color: var(--border-color-dim);
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.2);
  }

  &.past {
    opacity: 0.6;
  }

  &.future {
    opacity: 0.4;
  }

  &.has-translation {
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
}

.control-panel {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  background: rgba(0, 0, 0, 0.4);
  backdrop-filter: blur(10px);
  border-top: 1px solid rgba(255, 255, 255, 0.1);

  .control-buttons {
    display: flex;
    gap: 8px;

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

      &:hover {
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
    }
  }

  .progress-info {
    display: flex;
    align-items: center;
    gap: 4px;
    font-size: 0.9rem;
    font-variant-numeric: tabular-nums;
    opacity: 0.8;
  }
}

.time-separator {
  opacity: 0.5;
}

.current-time {
  font-weight: 600;
  color: #ffd700;
}
</style>
