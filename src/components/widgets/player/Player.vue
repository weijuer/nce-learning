<template>
  <div class="player-container" :class="{ 'is-loading': isLoading }">
    <!-- <div v-if="!isOnline" class="network-warning offline">
      <span class="warning-icon">⚠️</span>
      <span>您已离线，请检查网络连接</span>
    </div>
    <div v-else-if="isSlowNetwork" class="network-warning slow">
      <span class="warning-icon">📶</span>
      <span>当前网络较慢，可能影响加载速度</span>
    </div> -->

    <div v-if="isLoading" class="loading-overlay">
      <div class="loading-content">
        <div class="loading-spinner">
          <div class="spinner-ring"></div>
          <div class="spinner-dot"></div>
        </div>
        <div class="loading-text">
          <h3>Loading Resources</h3>
          <p>Loading [{{ props.name }}]...</p>
        </div>

        <div class="download-progress-container">
          <div class="progress-item">
            <div class="progress-header">
              <span class="progress-label">Audio</span>
              <span class="progress-percentage">{{ mp3DownloadProgress.progress }}%</span>
            </div>
            <div class="progress-bar">
              <div
                class="progress-fill"
                :class="mp3DownloadProgress.status.toLowerCase()"
                :style="{ width: mp3DownloadProgress.progress + '%' }"
              ></div>
            </div>
            <span v-if="mp3DownloadProgress.status === 'retrying'" class="retry-text">
              {{ mp3DownloadProgress.error }}
            </span>
          </div>

          <div class="progress-item">
            <div class="progress-header">
              <span class="progress-label">Lyrics</span>
              <span class="progress-percentage">{{ lrcDownloadProgress.progress }}%</span>
            </div>
            <div class="progress-bar">
              <div
                class="progress-fill"
                :class="lrcDownloadProgress.status.toLowerCase()"
                :style="{ width: lrcDownloadProgress.progress + '%' }"
              ></div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div v-if="error" class="error-card">
      <div class="error-icon">⚠️</div>
      <div class="error-content">
        <h4>Loading Error</h4>
        <p>{{ error }}</p>
        <button class="retry-btn" @click="retryLoad">重试</button>
      </div>
    </div>

    <div v-if="!isLoading && !error" class="player-content">
      <div class="top-bar">
        <button class="nav-btn" @click="prevLesson" title="上一课">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <polyline points="15 18 9 12 15 6"></polyline>
          </svg>
        </button>
        <div class="lesson-info">
          <span class="lesson-badge">{{ props.version }}</span>
          <span class="lesson-title">{{ props.name }}</span>
        </div>
        <button class="nav-btn" @click="nextLesson" title="下一课">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <polyline points="9 18 15 12 9 6"></polyline>
          </svg>
        </button>
      </div>

      <div class="player-layout">
        <div class="layout-sidebar">
          <div class="album-panel" @click="handleCoverClick">
            <div class="album-cover">
              <div class="cover-inner">
                <svg viewBox="0 0 100 100" class="music-icon">
                  <circle cx="50" cy="50" r="45" fill="url(#playerGradient)" />
                  <path
                    d="M35 35 L35 65 M45 35 L45 60 M55 35 L55 70 M65 35 L65 55"
                    stroke="white"
                    stroke-width="3"
                    stroke-linecap="round"
                    fill="none"
                  />
                  <defs>
                    <radialGradient id="playerGradient" cx="50%" cy="50%" r="50%">
                      <stop offset="0%" style="stop-color: #2c5530" />
                      <stop offset="100%" style="stop-color: #1a361e" />
                    </radialGradient>
                  </defs>
                </svg>
                <div class="play-overlay" :class="{ visible: !isPlaying }">
                  <svg width="40" height="40" viewBox="0 0 24 24" fill="white">
                    <path d="M8 5v14l11-7z" />
                  </svg>
                </div>
              </div>
            </div>
            <div class="album-meta">
              <span class="album-version">{{ props.version }}</span>
            </div>
          </div>

          <div class="settings-panel">
            <h3 class="panel-title">播放设置</h3>
            <div class="settings-grid">
              <label class="setting-row">
                <input type="checkbox" v-model="settings.enableSentenceLoop" />
                <span>句子循环播放</span>
              </label>
              <div v-if="settings.enableSentenceLoop" class="setting-row">
                <span>循环次数:</span>
                <select v-model="settings.sentenceLoopCount">
                  <option :value="1">1次</option>
                  <option :value="2">2次</option>
                  <option :value="3">3次</option>
                  <option :value="5">5次</option>
                </select>
              </div>
              <label v-if="settings.enableSentenceLoop" class="setting-row">
                <input type="checkbox" v-model="settings.continueAfterLoop" />
                <span>循环后继续播放</span>
              </label>
            </div>
          </div>
        </div>

        <div class="layout-main">
          <div class="current-lyric-panel" @click="handleLyricPanelClick">
            <div class="current-lyric-text">{{ currentLineText }}</div>
            <div v-if="currentLineTranslation" class="current-lyric-translation">
              {{ currentLineTranslation }}
            </div>
            <div v-if="!isPlaying" class="tap-hint">点击此处开始播放</div>
          </div>

          <div class="lyrics-scroll" ref="lyricsContainerRef">
            <div
              v-for="(line, index) in lrcLines"
              :key="index"
              class="lyric-line"
              :class="{ active: index === currentLineIndex }"
              @click="handleLineClick(index)"
            >
              <span class="lyric-en">{{ line.textEn }}</span>
              <span v-if="line.textZh" class="lyric-zh">{{ line.textZh }}</span>
            </div>
          </div>
        </div>
      </div>

      <div class="bottom-bar">
        <AudioPlayer />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, watch } from 'vue'
import { usePlayer } from 'Composables/usePlayer'
import AudioPlayer from './AudioPlayer.vue'

interface Props {
  name?: string
  version?: string
}

const props = withDefaults(defineProps<Props>(), {
  name: '',
  version: 'NCE1'
})

const {
  isPlaying,
  isLoading,
  lrcLines,
  currentLineIndex,
  error,
  settings,
  togglePlay,
  loadLesson,
  nextLesson,
  prevLesson,
  playSentence,
  retryLoad,
  mp3DownloadProgress,
  lrcDownloadProgress
} = usePlayer({
  autoplay: false,
  loop: true,
  volume: 0.7,
  basePath: 'data',
  timeout: 30000,
  maxRetries: 3,
  retryDelay: 2000,
  enableSentenceLoop: true,
  sentenceLoopCount: 3,
  continueAfterLoop: true
})

const currentLineText = computed(() => {
  if (currentLineIndex.value >= 0 && currentLineIndex.value < lrcLines.value.length) {
    return lrcLines.value[currentLineIndex.value].textEn
  }
  return isPlaying.value ? '' : '点击播放开始学习'
})

const currentLineTranslation = computed(() => {
  if (currentLineIndex.value >= 0 && currentLineIndex.value < lrcLines.value.length) {
    return lrcLines.value[currentLineIndex.value].textZh || ''
  }
  return ''
})

const handleLineClick = (index: number) => {
  playSentence(index)
}

const handleLyricPanelClick = () => {
  if (!isPlaying.value) {
    togglePlay()
  }
}

const handleCoverClick = () => {
  togglePlay()
}

watch(
  () => props.name,
  newName => {
    if (newName) {
      loadLesson(newName, props.version)
    }
  }
)
</script>

<style>
:root {
  --player-primary: #2c5530;
  --player-primary-light: #4a7c59;
  --player-accent: #d4af37;
  --player-text: #f5f5f5;
  --player-text-secondary: rgba(255, 255, 255, 0.7);
  --player-bg: linear-gradient(180deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%);
  --player-surface: rgba(255, 255, 255, 0.05);
  --player-surface-hover: rgba(255, 255, 255, 0.1);
  --player-border: rgba(255, 255, 255, 0.1);
}

.player-container {
  container-type: inline-size;
  container-name: player;
  min-height: 100vh;
  background: var(--player-bg);
  color: var(--player-text);
  box-sizing: border-box;
}

/* ===== 网络状态 ===== */
.network-warning {
  position: sticky;
  top: 0;
  z-index: 100;
  display: flex;
  align-items: center;
  gap: clamp(6px, 1vw, 10px);
  padding: clamp(8px, 1.5vw, 12px) clamp(12px, 2vw, 16px);
  font-size: clamp(0.75rem, 1.5vw, 0.875rem);

  &.offline {
    background: #dc2626;
    color: white;
  }
  &.slow {
    background: #d97706;
    color: white;
  }
}

/* ===== 加载状态 ===== */
.loading-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.9);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.loading-content {
  text-align: center;
  padding: clamp(20px, 4vw, 40px);
}

.loading-spinner {
  position: relative;
  width: clamp(40px, 8vw, 60px);
  height: clamp(40px, 8vw, 60px);
  margin: 0 auto clamp(16px, 2vw, 24px);
}

.spinner-ring {
  width: 100%;
  height: 100%;
  border: 3px solid rgba(255, 255, 255, 0.1);
  border-top: 3px solid var(--player-accent);
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

.spinner-dot {
  position: absolute;
  top: 50%;
  left: 50%;
  width: clamp(6px, 1vw, 8px);
  height: clamp(6px, 1vw, 8px);
  background: var(--player-accent);
  border-radius: 50%;
  transform: translate(-50%, -50%);
}

.loading-text h3 {
  font-size: clamp(1.1rem, 2.5vw, 1.5rem);
  font-weight: 600;
  margin-bottom: clamp(4px, 0.5vw, 8px);
}

.loading-text p {
  color: var(--player-text-secondary);
}

.download-progress-container {
  margin-top: clamp(20px, 3vw, 32px);
  padding: clamp(12px, 1.5vw, 16px);
  background: rgba(255, 255, 255, 0.05);
  border-radius: 12px;
}

.progress-item:not(:last-child) {
  margin-bottom: clamp(12px, 1.5vw, 16px);
}

.progress-header {
  display: flex;
  justify-content: space-between;
  margin-bottom: 8px;
}

.progress-label {
  font-size: clamp(0.75rem, 1.2vw, 0.875rem);
  color: var(--player-text-secondary);
}

.progress-percentage {
  font-size: clamp(0.75rem, 1.2vw, 0.875rem);
  color: var(--player-primary-light);
  font-weight: 600;
}

.progress-bar {
  height: 6px;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 3px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  transition:
    width 0.3s ease,
    background-color 0.3s ease;
  border-radius: 3px;

  &.downloading {
    background: linear-gradient(90deg, var(--player-primary), var(--player-primary-light));
  }
  &.retrying {
    background: linear-gradient(90deg, #d97706, #f59e0b);
    animation: pulse 1s ease-in-out infinite;
  }
  &.completed {
    background: #22c55e;
  }
  &.failed {
    background: #ef4444;
  }
}

.retry-text {
  display: block;
  margin-top: 8px;
  font-size: 0.75rem;
  color: #d97706;
}

/* ===== 错误卡片 ===== */
.error-card {
  margin: clamp(12px, 2vw, 16px);
  padding: clamp(12px, 2vw, 16px);
  background: rgba(239, 68, 68, 0.1);
  border: 1px solid rgba(239, 68, 68, 0.3);
  border-radius: 12px;
  display: flex;
  align-items: center;
  gap: 12px;
}

.error-icon {
  font-size: 1.5rem;
}
.error-content h4 {
  font-weight: 600;
  color: #ef4444;
  margin-bottom: 4px;
}
.error-content p {
  color: rgba(239, 68, 68, 0.8);
  margin-bottom: 12px;
}

.retry-btn {
  background: #ef4444;
  color: white;
  border: none;
  padding: 8px 16px;
  border-radius: 8px;
  cursor: pointer;
  font-weight: 500;
}

/* ===== 主内容区域 ===== */
.player-content {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
  padding-bottom: env(safe-area-inset-bottom);
}

/* ===== 顶部工具栏 ===== */
.top-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: clamp(8px, 1.5vw, 12px) clamp(12px, 3vw, 24px);
  background: rgba(0, 0, 0, 0.3);
  backdrop-filter: blur(10px);
  position: sticky;
  top: 0;
  z-index: 50;
}

.nav-btn {
  width: clamp(36px, 6vw, 40px);
  height: clamp(36px, 6vw, 40px);
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 50%;
  border: none;
  color: var(--player-text);
  cursor: pointer;
  transition: all 0.2s;
  flex-shrink: 0;

  &:hover {
    background: rgba(255, 255, 255, 0.2);
  }
  &:active {
    transform: scale(0.95);
  }
}

.lesson-info {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: clamp(1px, 0.3vw, 2px);
  min-width: 0;
  padding: 0 clamp(8px, 2vw, 16px);
}

.lesson-badge {
  font-size: clamp(0.65rem, 1.2vw, 0.75rem);
  padding: 2px 8px;
  background: var(--player-primary);
  border-radius: 10px;
  flex-shrink: 0;
}

.lesson-title {
  font-size: clamp(0.8rem, 1.5vw, 0.9rem);
  font-weight: 600;
  max-width: clamp(160px, 40vw, 300px);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* ===== 播放器布局 ===== */
.player-layout {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: clamp(12px, 2vw, 20px);
  padding: clamp(12px, 2vw, 20px);
}

.layout-sidebar {
  display: flex;
  flex-direction: column;
  gap: clamp(12px, 2vw, 20px);
}

.album-panel {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: clamp(8px, 1.5vw, 16px);
  cursor: pointer;
  background: var(--player-surface);
  border-radius: clamp(12px, 2vw, 16px);
  padding: clamp(16px, 3vw, 24px);
  transition: transform 0.2s;

  &:hover {
    transform: scale(1.02);
  }
  &:active {
    transform: scale(0.98);
  }
}

.album-cover {
  width: clamp(160px, 35vw, 220px);
  aspect-ratio: 1;
}

.cover-inner {
  width: 100%;
  height: 100%;
  border-radius: 12px;
  overflow: hidden;
  position: relative;
  box-shadow: 0 clamp(10px, 3vw, 20px) clamp(30px, 8vw, 60px) rgba(0, 0, 0, 0.4);
  display: flex;
  align-items: center;
  justify-content: center;
}

.music-icon {
  width: clamp(120px, 25vw, 180px);
  height: clamp(120px, 25vw, 180px);
}

.play-overlay {
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.35);
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0;
  transition: opacity 0.3s;

  &.visible {
    opacity: 1;
  }
}

.cover-inner:hover .play-overlay {
  opacity: 1;
}

.album-meta {
  text-align: center;
}

.album-version {
  display: inline-block;
  font-size: clamp(0.7rem, 1.2vw, 0.8rem);
  padding: clamp(3px, 0.5vw, 4px) clamp(8px, 1.5vw, 12px);
  background: var(--player-primary);
  border-radius: 12px;
}

/* ===== 设置面板 ===== */
.settings-panel {
  background: var(--player-surface);
  border-radius: clamp(12px, 2vw, 16px);
  padding: clamp(14px, 2.5vw, 20px);
}

.panel-title {
  font-size: clamp(0.85rem, 1.5vw, 1rem);
  font-weight: 600;
  margin-bottom: clamp(10px, 1.5vw, 16px);
  padding-bottom: clamp(8px, 1vw, 12px);
  border-bottom: 1px solid var(--player-border);
}

.settings-grid {
  display: flex;
  flex-direction: column;
  gap: clamp(8px, 1.2vw, 12px);
}

.setting-row {
  display: flex;
  align-items: center;
  gap: clamp(8px, 1.2vw, 12px);
  font-size: clamp(0.8rem, 1.3vw, 0.9rem);
  color: var(--player-text-secondary);
  cursor: pointer;
}

.setting-row input[type='checkbox'] {
  width: 16px;
  height: 16px;
  cursor: pointer;
}

.setting-row select {
  padding: clamp(4px, 0.6vw, 6px) clamp(8px, 1.2vw, 12px);
  border: 1px solid var(--player-border);
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.1);
  color: var(--player-text);
  font-size: clamp(0.8rem, 1.3vw, 0.9rem);
  cursor: pointer;
}

/* ===== 主区域 ===== */
.layout-main {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: clamp(12px, 2vw, 20px);
  min-height: 0;
}

.current-lyric-panel {
  background: var(--player-surface);
  border-radius: clamp(12px, 2vw, 16px);
  padding: clamp(20px, 4vw, 32px);
  text-align: center;
  cursor: pointer;
  transition: background 0.2s;
  flex-shrink: 0;

  &:hover {
    background: var(--player-surface-hover);
  }
}

.current-lyric-text {
  font-size: clamp(1.25rem, 3.5vw, 2rem);
  font-weight: 600;
  line-height: 1.4;
  margin-bottom: clamp(4px, 0.8vw, 8px);
}

.current-lyric-translation {
  font-size: clamp(1rem, 2.2vw, 1.25rem);
  color: var(--player-text-secondary);
  font-style: italic;
}

.tap-hint {
  margin-top: clamp(8px, 1.5vw, 12px);
  font-size: clamp(0.8rem, 1.5vw, 0.9rem);
  color: var(--player-accent);
  animation: hint-pulse 2s ease-in-out infinite;
}

/* ===== 歌词滚动 ===== */
.lyrics-scroll {
  flex: 1;
  overflow-y: auto;
  min-height: 0;
  /* padding: 0 clamp(8px, 1.5vw, 12px); */
}

.lyric-line {
  display: flex;
  flex-direction: column;
  gap: clamp(2px, 0.3vw, 4px);
  padding: clamp(10px, 1.8vw, 14px) clamp(12px, 2vw, 16px);
  border-radius: clamp(6px, 1vw, 8px);
  margin-bottom: clamp(4px, 0.5vw, 8px);
  cursor: pointer;
  transition: all 0.2s;
  background: var(--player-surface);

  &:hover {
    background: var(--player-surface-hover);
  }

  &.active {
    background: rgba(44, 85, 48, 0.3);
    border-left: 3px solid var(--player-accent);
    padding-left: calc(clamp(12px, 2vw, 16px) - 3px);
  }
}

.lyric-en {
  font-size: clamp(0.95rem, 2vw, 1.05rem);
  font-weight: 500;
  line-height: 1.4;
}

.lyric-zh {
  font-size: clamp(0.8rem, 1.6vw, 0.9rem);
  color: var(--player-text-secondary);
  line-height: 1.4;
}

/* ===== 底部控制栏 ===== */
.bottom-bar {
  background: rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(20px);
  padding: clamp(10px, 2vw, 16px);
  border-top: 1px solid var(--player-border);
  position: sticky;
  bottom: 0;
}

/* ===== 容器查询 - 响应式布局 ===== */
@container player (min-width: 600px) {
  .player-layout {
    display: grid;
    grid-template-columns: clamp(220px, 30%, 280px) 1fr;
    grid-template-rows: 1fr auto;
    gap: clamp(16px, 2.5vw, 24px);
  }

  .layout-sidebar {
    grid-row: 1;
    grid-column: 1;
  }

  .layout-main {
    grid-row: 1;
    grid-column: 2;
  }
}

@container player (min-width: 800px) {
  .player-layout {
    grid-template-columns: clamp(240px, 25%, 300px) 1fr;
  }
}

@container player (min-width: 1000px) {
  .player-layout {
    grid-template-columns: clamp(260px, 22%, 320px) 1fr;
  }
}

/* ===== 动画 ===== */
@keyframes spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

@keyframes pulse {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0.6;
  }
}

@keyframes hint-pulse {
  0%,
  100% {
    opacity: 0.4;
  }
  50% {
    opacity: 1;
  }
}
</style>
