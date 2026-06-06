<template>
  <div class="player-container" :class="{ 'is-loading': isLoading, 'is-buffering': isBuffering }">
    <!-- 网络状态提示 -->
    <div v-if="!isOnline" class="network-warning offline">
      <span class="warning-icon">⚠️</span>
      <span>您已离线，请检查网络连接</span>
    </div>
    <div v-else-if="isSlowNetwork" class="network-warning slow">
      <span class="warning-icon">📶</span>
      <span>当前网络较慢，可能影响加载速度</span>
    </div>

    <!-- 加载状态 -->
    <div v-if="isLoading" class="loading-overlay">
      <div class="loading-content">
        <div class="loading-spinner">
          <div class="spinner-ring"></div>
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

    <!-- 缓冲状态 -->
    <div v-if="isBuffering" class="buffering-overlay">
      <div class="buffering-content">
        <div class="buffering-spinner"></div>
        <span class="buffering-text">缓冲中... {{ Math.round(bufferProgress) }}%</span>
      </div>
    </div>

    <!-- 错误卡片 -->
    <div v-if="error" class="error-card">
      <div class="error-icon">⚠️</div>
      <div class="error-content">
        <h4>Loading Error</h4>
        <p>{{ error }}</p>
        <button class="retry-btn" @click="retryLoad">重试</button>
      </div>
    </div>

    <!-- 主内容区域 -->
    <div v-if="!isLoading && !error" class="player-content">
      <!-- 顶部工具栏 -->
      <div class="top-bar">
        <button class="nav-btn" @click="prevLesson" :disabled="!hasPrevLesson" title="上一课">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="currentColor"
          >
            <polygon points="19 20 9 12 19 4 19 20"></polygon>
            <rect x="5" y="4" width="3" height="16"></rect>
          </svg>
        </button>
        <div class="lesson-info">
          <span class="lesson-badge">{{ props.version }}</span>
          <span class="lesson-title">{{ props.name }}</span>
        </div>
        <button class="nav-btn" @click="nextLesson" :disabled="!hasNextLesson" title="下一课">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="currentColor"
          >
            <polygon points="5 4 15 12 5 20 5 4"></polygon>
            <rect x="16" y="4" width="3" height="16"></rect>
          </svg>
        </button>
      </div>

      <section class="learning-mode-bar" aria-label="学习模式">
        <button
          v-for="mode in learningModes"
          :key="mode.id"
          type="button"
          class="mode-tab"
          :class="{ active: studyMode === mode.id }"
          @click="studyMode = mode.id"
        >
          <span>{{ mode.label }}</span>
          <small>{{ mode.description }}</small>
        </button>
      </section>

      <!-- 播放器布局 -->
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
                      <stop offset="0%" :style="`stop-color: var(--color-primary)`" />
                      <stop offset="100%" :style="`stop-color: var(--color-secondary)`" />
                    </radialGradient>
                  </defs>
                </svg>
                <div class="play-overlay" :class="{ visible: !isPlaying }">
                  <svg width="40" height="40" viewBox="0 0 24 24" fill="white">
                    <path d="M8 5v14l11-7z" />
                  </svg>
                </div>
                <!-- 播放状态指示 -->
                <div v-if="isPlaying" class="playing-indicator">
                  <span class="playing-dot"></span>
                  <span class="playing-dot"></span>
                  <span class="playing-dot"></span>
                </div>
              </div>
            </div>
            <div class="album-meta">
              <span class="album-version">{{ props.version }}</span>
              <span class="album-title">{{ props.name }}</span>
            </div>
          </div>

          <!-- 设置按钮 -->
          <button class="settings-btn" @click="showSettings = true">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="3"></circle>
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
            </svg>
            <span>设置</span>
          </button>

          <div class="progress-panel">
            <h3 class="panel-title">学习进度</h3>
            <div class="study-ring">
              <strong>{{ lineCompletionPercent }}%</strong>
              <span>逐句完成</span>
            </div>
            <div class="cache-item">
              <span class="cache-label">跟读最近得分:</span>
              <span class="cache-value">{{ lastPronunciationScore || '--' }}</span>
            </div>
            <div class="cache-item">
              <span class="cache-label">本地存储:</span>
              <span class="cache-value">已开启</span>
            </div>
          </div>
        </div>

        <div class="layout-main">
          <!-- 当前歌词面板 -->
          <div class="current-lyric-panel" @click="handleLyricPanelClick">
            <div class="current-lyric-text">{{ displayCurrentLineText }}</div>
            <div v-if="currentLineTranslation && !blindListening" class="current-lyric-translation">
              {{ currentLineTranslation }}
            </div>
            <div v-if="!isPlaying" class="tap-hint">点击此处开始播放</div>
          </div>

          <section v-if="studyMode === 'shadowing'" class="training-panel" aria-label="跟读练习">
            <div>
              <h3>逐句跟读</h3>
              <p>先听标准发音，再录下自己的朗读，系统会按文本接近度给出即时反馈。</p>
            </div>
            <div class="training-actions">
              <button type="button" @click="playCurrentSentence">播放示范</button>
              <button type="button" class="primary-action" :class="{ recording: isRecording }" @click="toggleRecording">
                {{ isRecording ? '结束录音' : '开始跟读' }}
              </button>
            </div>
            <div class="score-strip">
              <span>识别文本</span>
              <strong>{{ spokenTranscript || '等待录音结果' }}</strong>
              <b>{{ lastPronunciationScore || '--' }}</b>
            </div>
          </section>

          <section v-else-if="studyMode === 'dictation'" class="training-panel" aria-label="听写训练">
            <div>
              <h3>听写训练</h3>
              <p>隐藏原文，只保留播放控制，提交后即时对比当前句。</p>
            </div>
            <textarea v-model="dictationText" placeholder="输入你听到的这一句英文"></textarea>
            <div class="training-actions">
              <button type="button" @click="playCurrentSentence">重听当前句</button>
              <button type="button" class="primary-action" @click="submitDictation">提交听写</button>
            </div>
            <div class="score-strip">
              <span>听写得分</span>
              <strong>{{ dictationFeedback || '完成后显示差异反馈' }}</strong>
              <b>{{ dictationScore || '--' }}</b>
            </div>
          </section>

          <section v-else-if="studyMode === 'reading'" class="training-panel compact" aria-label="选读学习">
            <span>选读节奏</span>
            <strong>按句点读，结合中文释义确认理解，再进入跟读或听写。</strong>
          </section>

          <section v-else class="training-panel compact" aria-label="重复听读">
            <span>重复听读</span>
            <strong>{{ blindListening ? '盲听中，字幕已隐藏' : '可切换变速、单句循环、精听逐句' }}</strong>
          </section>

          <!-- 歌词滚动区域 -->
          <div class="lyrics-scroll" ref="lyricsContainerRef" :class="{ obscured: blindListening || studyMode === 'dictation' }">
            <div
              v-for="(line, index) in lrcLines"
              :key="index"
              class="lyric-line"
              :class="{ active: index === currentLineIndex }"
              @click="handleLineClick(index)"
            >
              <span class="lyric-en">{{ blindListening || studyMode === 'dictation' ? '••••••••••' : line.textEn }}</span>
              <span v-if="line.textZh && !blindListening && studyMode !== 'dictation'" class="lyric-zh">{{ line.textZh }}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- 底部控制栏 -->
      <div class="bottom-bar">
        <div class="progress-section">
          <span class="time-display">{{ formattedCurrentTime }}</span>
          <div class="progress-bar-container" @click="handleProgressClick">
            <div class="progress-track">
              <div class="progress-buffered" :style="{ width: bufferProgress + '%' }"></div>
              <div class="progress-fill" :style="{ width: progress + '%' }"></div>
              <div class="progress-thumb" :style="{ left: progress + '%' }"></div>
            </div>
          </div>
          <span class="time-display">{{ formattedDuration }}</span>
        </div>

        <div class="controls-section">
          <button class="control-btn" @click="toggleMute" title="静音">
            <svg
              v-if="isMuted"
              xmlns="http://www.w3.org/2000/svg"
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
            >
              <line x1="1" y1="1" x2="23" y2="23"></line>
              <path
                d="M9 9v6a3 3 0 0 0 5.12 2.12M15 9.34V15a3 3 0 0 1-5.12 2.12M12 4.5a3 3 0 0 0-3 3v9a3 3 0 0 0 6 0V7.5a3 3 0 0 0-3-3z"
              ></path>
            </svg>
            <svg
              v-else
              xmlns="http://www.w3.org/2000/svg"
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
            >
              <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
              <path d="M15.54 8.46a5 5 0 0 1 0 7.07"></path>
              <path d="M19.07 4.93a10 10 0 0 1 0 14.14"></path>
            </svg>
          </button>

          <button class="control-btn" @click="prevLesson" :disabled="!hasPrevLesson" title="上一课">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="currentColor"
            >
              <polygon points="19 20 9 12 19 4 19 20"></polygon>
              <rect x="5" y="4" width="3" height="16"></rect>
            </svg>
          </button>

          <button class="play-btn" @click="togglePlay">
            <svg
              v-if="isPlaying"
              xmlns="http://www.w3.org/2000/svg"
              width="32"
              height="32"
              viewBox="0 0 24 24"
              fill="currentColor"
            >
              <rect x="6" y="4" width="4" height="16"></rect>
              <rect x="14" y="4" width="4" height="16"></rect>
            </svg>
            <svg
              v-else
              xmlns="http://www.w3.org/2000/svg"
              width="32"
              height="32"
              viewBox="0 0 24 24"
              fill="currentColor"
            >
              <path d="M8 5v14l11-7z"></path>
            </svg>
          </button>

          <button class="control-btn" @click="nextLesson" :disabled="!hasNextLesson" title="下一课">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="currentColor"
            >
              <polygon points="5 4 15 12 5 20 5 4"></polygon>
              <rect x="16" y="4" width="3" height="16"></rect>
            </svg>
          </button>

          <button class="control-btn" @click="showSpeedMenu = !showSpeedMenu" title="播放速度">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
            >
              <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon>
            </svg>
            <span class="speed-text">{{ playbackRate }}x</span>
          </button>

          <!-- 音量控制 -->
          <div class="volume-control">
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              :value="volume"
              @input="handleVolumeChange"
              class="volume-slider"
            />
          </div>
        </div>

        <!-- 播放速度菜单 -->
        <div v-if="showSpeedMenu" class="speed-menu">
          <button
            v-for="speed in playbackRates"
            :key="speed"
            class="speed-option"
            :class="{ active: playbackRate === speed }"
            @click="setPlaybackRate(speed)"
          >
            {{ speed }}x
          </button>
        </div>
      </div>

      <!-- 设置抽屉 -->
      <w-drawer
        v-model="showSettings"
        position="right"
        width="clamp(280px, 80vw, 400px)"
        title="播放器设置"
        getContainer="body"
        close-on-click-overlay
      >
        <div class="settings-content">
          <!-- 训练设置 -->
          <section class="settings-section">
            <h3 class="settings-section-title">训练设置</h3>
            <label class="settings-item">
              <input type="checkbox" v-model="settings.enableSentenceLoop" />
              <span>句子循环播放</span>
            </label>
            <div v-if="settings.enableSentenceLoop" class="settings-item">
              <span>循环次数:</span>
              <select v-model="settings.sentenceLoopCount">
                <option :value="1">1次</option>
                <option :value="2">2次</option>
                <option :value="3">3次</option>
                <option :value="5">5次</option>
              </select>
            </div>
            <label v-if="settings.enableSentenceLoop" class="settings-item">
              <input type="checkbox" v-model="settings.continueAfterLoop" />
              <span>循环后继续播放</span>
            </label>
            <label class="settings-item">
              <input type="checkbox" v-model="blindListening" />
              <span>盲听模式隐藏字幕</span>
            </label>
          </section>

          <!-- 缓存管理 -->
          <section class="settings-section">
            <h3 class="settings-section-title">缓存管理</h3>
            <div class="settings-item">
              <span class="settings-label">已缓存:</span>
              <span class="settings-value">{{ formatFileSize(cacheStats.usedSize) }}</span>
            </div>
            <div class="settings-item">
              <span class="settings-label">缓存限制:</span>
              <span class="settings-value">{{ formatFileSize(cacheStats.maxSize) }}</span>
            </div>
            <div class="settings-item">
              <span class="settings-label">文件数量:</span>
              <span class="settings-value">{{ cacheStats.fileCount }}</span>
            </div>
            <div class="settings-item">
              <span class="settings-label">资源状态:</span>
              <span class="settings-value">{{ resourceStatusText }}</span>
            </div>
            <button class="clear-cache-btn" @click="clearCache">清空缓存</button>
          </section>

          <!-- 快捷键说明 -->
          <section class="settings-section">
            <h3 class="settings-section-title">快捷键</h3>
            <div class="shortcuts-list">
              <div class="shortcut-item">
                <kbd>空格</kbd>
                <span>播放/暂停</span>
              </div>
              <div class="shortcut-item">
                <kbd>←</kbd>
                <kbd>→</kbd>
                <span>上一课/下一课</span>
              </div>
              <div class="shortcut-item">
                <kbd>↑</kbd>
                <kbd>↓</kbd>
                <span>音量增减</span>
              </div>
              <div class="shortcut-item">
                <kbd>M</kbd>
                <span>静音切换</span>
              </div>
              <div class="shortcut-item">
                <kbd>R</kbd>
                <span>切换播放速度</span>
              </div>
              <div class="shortcut-item">
                <kbd>Home</kbd>
                <span>跳到开头</span>
              </div>
              <div class="shortcut-item">
                <kbd>End</kbd>
                <span>跳到末尾</span>
              </div>
            </div>
          </section>
        </div>
      </w-drawer>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { WDrawer } from '@/components/layouts'
import { useStreamingPlayer } from 'Composables/useStreamingPlayer'
import { scoreTextSimilarity, type LearningMode, useLearningProgress } from '@/composables/useLearningProgress'

interface Props {
  name?: string
  version?: string
}

const props = withDefaults(defineProps<Props>(), {
  name: '',
  version: 'NCE1'
})

const playbackRates = [0.5, 0.75, 1.0, 1.25, 1.5, 2.0]
const showSpeedMenu = ref(false)
const showSettings = ref(false)
const studyMode = ref<LearningMode>('listening')
const blindListening = ref(false)
const dictationText = ref('')
const dictationFeedback = ref('')
const dictationScore = ref(0)
const spokenTranscript = ref('')
const isRecording = ref(false)
const lastPronunciationScore = ref(0)
const mediaRecorder = ref<MediaRecorder | null>(null)
const recognition = ref<any>(null)
let lastProgressSaveAt = 0

const learningModes: Array<{ id: LearningMode; label: string; description: string }> = [
  { id: 'listening', label: '重复听读', description: '盲听/精听/变速' },
  { id: 'shadowing', label: '跟读练习', description: '示范/录音/评分' },
  { id: 'reading', label: '选读学习', description: '点读/释义/进度' },
  { id: 'dictation', label: '听写训练', description: '隐藏原文对比' }
]

const {
  getProgress,
  markLineComplete,
  recordPronunciation,
  touchLesson,
  updateLesson
} = useLearningProgress()

const {
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
  progress,
  formattedCurrentTime,
  formattedDuration,
  mp3DownloadProgress,
  lrcDownloadProgress,
  isOnline,
  isSlowNetwork,
  hasNextLesson,
  hasPrevLesson,
  bufferProgress,
  cacheStats,
  play,
  togglePlay,
  seek,
  setVolume,
  toggleMute,
  setPlaybackRate,
  loadLesson,
  retryLoad,
  nextLesson,
  prevLesson,
  playSentence,
  clearCache,
  settings
} = useStreamingPlayer({
  autoplay: false,
  loop: true,
  volume: 0.7,
  basePath: 'data',
  timeout: 30000,
  maxRetries: 3,
  retryDelay: 2000,
  enableSentenceLoop: true,
  sentenceLoopCount: 3,
  continueAfterLoop: true,
  bufferThreshold: 5,
  maxBufferSize: 5 * 1024 * 1024,
  cacheMaxSize: 50 * 1024 * 1024
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

const lessonTitle = computed(() => props.name.split('－')[1] || props.name)

const displayCurrentLineText = computed(() => {
  if (blindListening.value || studyMode.value === 'dictation') {
    return currentLineIndex.value >= 0 ? '正在听写当前句' : currentLineText.value
  }
  return currentLineText.value
})

const currentProgress = computed(() => getProgress(props.version, props.name))

const lineCompletionPercent = computed(() => {
  if (!lrcLines.value.length) return 0
  const completed = currentProgress.value?.completedLines.length || 0
  return Math.min(100, Math.round((completed / lrcLines.value.length) * 100))
})

const resourceStatusText = computed(() => {
  if (mp3DownloadProgress.value.status === 'completed' && lrcDownloadProgress.value.status === 'completed') {
    return '可离线学习'
  }
  if (mp3DownloadProgress.value.status === 'downloading') {
    return `边播边缓存 ${mp3DownloadProgress.value.progress}%`
  }
  if (!isOnline.value) {
    return '离线，仅可用已缓存资源'
  }
  return '等待加载'
})

const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

const handleLineClick = (index: number) => {
  playSentence(index)
  markLineComplete(props.version, props.name, lessonTitle.value, index)
}

const handleLyricPanelClick = () => {
  if (!isPlaying.value) {
    play(0)
  }
}

const handleCoverClick = () => {
  togglePlay()
}

const handleProgressClick = (e: MouseEvent) => {
  const target = e.currentTarget as HTMLElement
  const rect = target.getBoundingClientRect()
  const x = e.clientX - rect.left
  const percent = x / rect.width
  seek(percent * duration.value)
}

const handleVolumeChange = (e: Event) => {
  const target = e.target as HTMLInputElement
  setVolume(parseFloat(target.value))
}

const playCurrentSentence = () => {
  const index = currentLineIndex.value >= 0 ? currentLineIndex.value : 0
  playSentence(index)
}

const finishRecordingScore = (transcript: string) => {
  const reference = currentLineText.value
  const score = scoreTextSimilarity(reference, transcript)
  spokenTranscript.value = transcript || '未识别到清晰语音'
  lastPronunciationScore.value = score
  recordPronunciation(props.version, props.name, lessonTitle.value, score)
  if (currentLineIndex.value >= 0 && score >= 60) {
    markLineComplete(props.version, props.name, lessonTitle.value, currentLineIndex.value)
  }
}

const stopRecording = () => {
  isRecording.value = false
  mediaRecorder.value?.stop()
  recognition.value?.stop?.()
}

const toggleRecording = async () => {
  if (isRecording.value) {
    stopRecording()
    return
  }

  spokenTranscript.value = ''
  playCurrentSentence()

  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    mediaRecorder.value = new MediaRecorder(stream)
    mediaRecorder.value.onstop = () => {
      stream.getTracks().forEach(track => track.stop())
      if (!spokenTranscript.value) {
        finishRecordingScore('')
      }
    }

    const RecognitionCtor = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (RecognitionCtor) {
      const speechRecognition = new RecognitionCtor()
      speechRecognition.lang = 'en-US'
      speechRecognition.interimResults = false
      speechRecognition.maxAlternatives = 1
      speechRecognition.onresult = (event: any) => {
        const transcript = event.results?.[0]?.[0]?.transcript || ''
        finishRecordingScore(transcript)
      }
      speechRecognition.onerror = () => finishRecordingScore('')
      recognition.value = speechRecognition
      speechRecognition.start()
    }

    mediaRecorder.value.start()
    isRecording.value = true
  } catch (err) {
    spokenTranscript.value = err instanceof Error ? err.message : '无法启动麦克风'
    isRecording.value = false
  }
}

const submitDictation = () => {
  const score = scoreTextSimilarity(currentLineText.value, dictationText.value)
  dictationScore.value = score
  dictationFeedback.value = score >= 85 ? '非常接近原句' : score >= 60 ? '核心意思正确，注意拼写和冠词' : '建议先精听，再逐词补全'
  updateLesson(props.version, props.name, lessonTitle.value, {
    dictationAttempts: (currentProgress.value?.dictationAttempts || 0) + 1,
    mode: 'dictation'
  })
  if (currentLineIndex.value >= 0 && score >= 70) {
    markLineComplete(props.version, props.name, lessonTitle.value, currentLineIndex.value)
  }
}

watch(
  () => props.name,
  newName => {
    if (newName) {
      touchLesson(props.version, newName, lessonTitle.value)
      loadLesson(newName, props.version)
    }
  }
)

watch(studyMode, mode => {
  updateLesson(props.version, props.name, lessonTitle.value, { mode })
  blindListening.value = mode === 'dictation' ? true : blindListening.value
})

watch(currentLineIndex, index => {
  if (index >= 0 && studyMode.value === 'reading') {
    markLineComplete(props.version, props.name, lessonTitle.value, index)
  }
})

watch(currentTime, time => {
  const now = Date.now()
  if (now - lastProgressSaveAt < 5000) return
  lastProgressSaveAt = now
  updateLesson(props.version, props.name, lessonTitle.value, {
    lastPosition: time,
    totalStudySeconds: (currentProgress.value?.totalStudySeconds || 0) + 5
  })
})

watch(mp3DownloadProgress, progressState => {
  if (progressState.status === 'completed') {
    updateLesson(props.version, props.name, lessonTitle.value, { cached: true })
  }
}, { deep: true })

watch(showSpeedMenu, newVal => {
  if (newVal) {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      if (!target.closest('.speed-menu') && !target.closest('.control-btn:last-child')) {
        showSpeedMenu.value = false
        document.removeEventListener('click', handleClickOutside)
      }
    }
    document.addEventListener('click', handleClickOutside)
  }
})

const handleKeydown = (e: KeyboardEvent) => {
  const target = e.target as HTMLElement
  const isInput = target.tagName === 'INPUT' || target.tagName === 'SELECT' || target.isContentEditable
  
  if (isInput) return

  switch (e.code) {
    case 'Space':
      e.preventDefault()
      togglePlay()
      break
    case 'ArrowLeft':
      e.preventDefault()
      if (hasPrevLesson.value) {
        prevLesson()
      }
      break
    case 'ArrowRight':
      e.preventDefault()
      if (hasNextLesson.value) {
        nextLesson()
      }
      break
    case 'ArrowUp':
      e.preventDefault()
      setVolume(Math.min(1, volume.value + 0.1))
      break
    case 'ArrowDown':
      e.preventDefault()
      setVolume(Math.max(0, volume.value - 0.1))
      break
    case 'KeyM':
      e.preventDefault()
      toggleMute()
      break
    case 'KeyR':
      e.preventDefault()
      const currentRateIndex = playbackRates.indexOf(playbackRate.value)
      const nextRateIndex = (currentRateIndex + 1) % playbackRates.length
      setPlaybackRate(playbackRates[nextRateIndex])
      break
    case 'Home':
      e.preventDefault()
      seek(0)
      break
    case 'End':
      e.preventDefault()
      seek(duration.value)
      break
  }
}

onMounted(() => {
  document.addEventListener('keydown', handleKeydown)
  if (props.name) {
    touchLesson(props.version, props.name, lessonTitle.value)
    loadLesson(props.name, props.version)
  }
})

onUnmounted(() => {
  document.removeEventListener('keydown', handleKeydown)
  stopRecording()
  updateLesson(props.version, props.name, lessonTitle.value, {
    lastPosition: currentTime.value
  })
})
</script>

<style>
/* Player 使用全局 CSS 变量以支持主题切换 */
.player-container {
  position: relative;
  container-type: inline-size;
  container-name: player;
  min-height: 100%;
  background: var(--color-bg);
  color: var(--color-text);
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
    background: var(--w-color-danger);
    color: white;
  }
  &.slow {
    background: var(--w-color-warning);
    color: white;
  }
}

/* ===== 加载状态 ===== */
.loading-overlay {
  position: absolute;
  inset: 0;
  background: color-mix(in srgb, var(--color-bg) 95%, transparent);
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
  border-top: 3px solid var(--color-accent);
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

.loading-text h3 {
  font-size: clamp(1.1rem, 2.5vw, 1.5rem);
  font-weight: 600;
  margin-bottom: clamp(4px, 0.5vw, 8px);
}

.loading-text p {
  color: var(--color-text-dim);
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
  color: var(--color-text-dim);
}

.progress-percentage {
  font-size: clamp(0.75rem, 1.2vw, 0.875rem);
  color: var(--color-secondary);
  font-weight: 600;
}

.progress-bar {
  position: relative;
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
    background: linear-gradient(90deg, var(--color-primary), var(--color-secondary));
  }
  &.retrying {
    background: linear-gradient(90deg, var(--w-color-warning), #f59e0b);
    animation: pulse 1s ease-in-out infinite;
  }
  &.completed {
    background: var(--color-primary);
  }
  &.failed {
    background: var(--w-color-danger);
  }
}

.retry-text {
  display: block;
  margin-top: 8px;
  font-size: 0.75rem;
  color: var(--w-color-warning);
}

/* ===== 缓冲状态 ===== */
.buffering-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.7);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 900;
  backdrop-filter: blur(5px);
}

.buffering-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
}

.buffering-spinner {
  width: 50px;
  height: 50px;
  border: 3px solid rgba(255, 255, 255, 0.1);
  border-top: 3px solid var(--color-accent);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

.buffering-text {
  font-size: 1rem;
  color: var(--color-text-dim);
}

/* ===== 错误卡片 ===== */
.error-card {
  margin: clamp(12px, 2vw, 16px);
  padding: clamp(12px, 2vw, 16px);
  background: color-mix(in srgb, var(--w-color-danger) 10%, transparent);
  border: 1px solid color-mix(in srgb, var(--w-color-danger) 30%, transparent);
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
  color: var(--w-color-danger);
  margin-bottom: 4px;
}
.error-content p {
  color: color-mix(in srgb, var(--w-color-danger) 80%, transparent);
  margin-bottom: 12px;
}

.retry-btn {
  background: var(--w-color-danger);
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

.learning-mode-bar {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 8px;
  padding: 10px clamp(12px, 3vw, 24px);
  background: rgba(0, 0, 0, 0.22);
  border-bottom: 1px solid var(--color-border);
}

.mode-tab {
  min-height: 58px;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.06);
  color: var(--color-text-dim);
  display: grid;
  align-content: center;
  gap: 2px;
  cursor: pointer;
  transition:
    border-color 0.2s,
    background 0.2s,
    color 0.2s;

  span {
    font-weight: 700;
    color: var(--color-text);
  }

  small {
    color: inherit;
    font-size: 0.72rem;
  }

  &.active {
    border-color: var(--color-accent);
    background: rgba(212, 175, 55, 0.16);
    color: var(--color-accent);
  }
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
  color: var(--color-text);
  cursor: pointer;
  transition: all 0.2s;
  flex-shrink: 0;

  &:hover:not(:disabled) {
    background: rgba(255, 255, 255, 0.2);
  }
  &:active:not(:disabled) {
    transform: scale(0.95);
  }
  &:disabled {
    opacity: 0.4;
    cursor: not-allowed;
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
  background: var(--color-primary);
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
  min-height: 0;
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
  background: var(--color-surface);
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

/* 播放状态指示 */
.playing-indicator {
  position: absolute;
  bottom: 10px;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  gap: 4px;
}

.playing-dot {
  width: 4px;
  height: 12px;
  background: var(--color-accent);
  border-radius: 2px;
  animation: sound-wave 0.8s ease-in-out infinite;

  &:nth-child(1) {
    animation-delay: 0s;
  }
  &:nth-child(2) {
    animation-delay: 0.2s;
  }
  &:nth-child(3) {
    animation-delay: 0.4s;
  }
}

.album-meta {
  text-align: center;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

/* 设置按钮 */
.settings-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 12px;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: clamp(12px, 2vw, 16px);
  color: var(--color-text);
  cursor: pointer;
  transition: all 0.2s;

  &:hover {
    background: color-mix(in srgb, var(--color-border) 50%, transparent);
    border-color: var(--color-accent);
    color: var(--color-accent);
  }

  span {
    font-size: 0.9rem;
    font-weight: 500;
  }
}

.album-version {
  display: inline-block;
  font-size: clamp(0.7rem, 1.2vw, 0.8rem);
  padding: clamp(3px, 0.5vw, 4px) clamp(8px, 1.5vw, 12px);
  background: var(--color-primary);
  border-radius: 12px;
}

.album-title {
  font-size: clamp(0.9rem, 1.5vw, 1rem);
  font-weight: 600;
  margin-top: 4px;
}

/* ===== 设置面板 ===== */
.settings-panel {
  background: var(--color-surface);
  border-radius: clamp(12px, 2vw, 16px);
  padding: clamp(14px, 2.5vw, 20px);
}

.cache-panel,
.progress-panel {
  background: var(--color-surface);
  border-radius: clamp(12px, 2vw, 16px);
  padding: clamp(14px, 2.5vw, 20px);
}

.panel-title {
  font-size: clamp(0.85rem, 1.5vw, 1rem);
  font-weight: 600;
  margin-bottom: clamp(10px, 1.5vw, 16px);
  padding-bottom: clamp(8px, 1vw, 12px);
  border-bottom: 1px solid var(--color-border);
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
  color: var(--color-text-dim);
  cursor: pointer;
}

.setting-row input[type='checkbox'] {
  width: 16px;
  height: 16px;
  cursor: pointer;
}

.setting-row select {
  padding: clamp(4px, 0.6vw, 6px) clamp(8px, 1.2vw, 12px);
  border: 1px solid var(--color-border);
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.1);
  color: var(--color-text);
  font-size: clamp(0.8rem, 1.3vw, 0.9rem);
  cursor: pointer;
}

.cache-info {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.cache-item {
  display: flex;
  justify-content: space-between;
  font-size: clamp(0.8rem, 1.3vw, 0.9rem);
}

.cache-label {
  color: var(--color-text-dim);
}

.cache-value {
  font-weight: 500;
}

.clear-cache-btn {
  margin-top: 12px;
  padding: 8px 16px;
  background: color-mix(in srgb, var(--w-color-danger) 20%, transparent);
  border: 1px solid color-mix(in srgb, var(--w-color-danger) 30%, transparent);
  border-radius: 8px;
  color: var(--w-color-danger);
  font-size: clamp(0.8rem, 1.3vw, 0.9rem);
  cursor: pointer;
  transition: background 0.2s;

  &:hover {
    background: color-mix(in srgb, var(--w-color-danger) 30%, transparent);
  }
}

.study-ring {
  aspect-ratio: 1;
  width: min(130px, 55%);
  margin: 0 auto 14px;
  border-radius: 50%;
  border: 8px solid rgba(212, 175, 55, 0.22);
  display: grid;
  place-content: center;
  text-align: center;

  strong {
    font-size: 1.6rem;
    line-height: 1;
  }

  span {
    color: var(--color-text-dim);
    font-size: 0.75rem;
  }
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
  background: var(--color-surface);
  border-radius: clamp(12px, 2vw, 16px);
  padding: clamp(20px, 4vw, 32px);
  text-align: center;
  cursor: pointer;
  transition: background 0.2s;
  flex-shrink: 0;

  &:hover {
    background: color-mix(in srgb, var(--color-border) 50%, transparent);
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
  color: var(--color-text-dim);
  font-style: italic;
}

.training-panel {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: 8px;
  padding: clamp(14px, 2vw, 18px);
  display: grid;
  gap: 12px;

  h3 {
    margin: 0 0 4px;
    font-size: 1rem;
  }

  p {
    margin: 0;
    color: var(--color-text-dim);
  }

  textarea {
    width: 100%;
    min-height: 86px;
    resize: vertical;
    border: 1px solid var(--color-border);
    border-radius: 8px;
    padding: 0.75rem;
    color: var(--color-text);
    background: rgba(0, 0, 0, 0.22);
    font: inherit;
  }

  &.compact {
    grid-template-columns: auto 1fr;
    align-items: center;

    span {
      color: var(--color-accent);
      font-weight: 700;
    }
  }
}

.training-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;

  button {
    min-height: 40px;
    border: 1px solid var(--color-border);
    border-radius: 8px;
    padding: 0 0.9rem;
    color: var(--color-text);
    background: rgba(255, 255, 255, 0.08);
    cursor: pointer;
  }

  .primary-action {
    border-color: var(--color-secondary);
    background: var(--color-primary);
  }

  .recording {
    border-color: var(--w-color-danger);
    background: color-mix(in srgb, var(--w-color-danger) 24%, transparent);
  }
}

.score-strip {
  display: grid;
  grid-template-columns: auto 1fr auto;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  border-radius: 8px;
  background: rgba(0, 0, 0, 0.18);

  span {
    color: var(--color-text-dim);
    font-size: 0.78rem;
  }

  strong {
    min-width: 0;
    color: var(--color-text);
    font-size: 0.9rem;
    overflow-wrap: anywhere;
  }

  b {
    color: var(--color-accent);
    font-size: 1.2rem;
  }
}

.tap-hint {
  margin-top: clamp(8px, 1.5vw, 12px);
  font-size: clamp(0.8rem, 1.5vw, 0.9rem);
  color: var(--color-accent);
  animation: hint-pulse 2s ease-in-out infinite;
}

/* ===== 歌词滚动 ===== */
.lyrics-scroll {
  flex: 1;
  overflow-y: auto;
  min-height: 0;

  &.obscured .lyric-line {
    min-height: 52px;
  }
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
  background: var(--color-surface);

  &:hover {
    background: color-mix(in srgb, var(--color-border) 50%, transparent);
  }

  &.active {
    background: rgba(44, 85, 48, 0.3);
    border-left: 3px solid var(--color-accent);
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
  color: var(--color-text-dim);
  line-height: 1.4;
}

/* ===== 底部控制栏 ===== */
.bottom-bar {
  background: rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(20px);
  padding: clamp(10px, 2vw, 16px);
  border-top: 1px solid var(--color-border);
  position: sticky;
  bottom: 0;
}

.progress-section {
  display: flex;
  align-items: center;
  gap: clamp(8px, 1.5vw, 12px);
  margin-bottom: clamp(10px, 1.5vw, 14px);
}

.time-display {
  font-size: clamp(0.75rem, 1.2vw, 0.875rem);
  color: var(--color-text-dim);
  min-width: 40px;
  text-align: center;
}

.progress-bar-container {
  flex: 1;
  cursor: pointer;
  height: 6px;
}

.progress-track {
  position: relative;
  width: 100%;
  height: 100%;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 3px;
  overflow: visible;
}

.progress-buffered {
  position: absolute;
  top: 0;
  left: 0;
  height: 100%;
  background: rgba(255, 255, 255, 0.2);
  border-radius: 3px;
}

.progress-fill {
  position: absolute;
  top: 0;
  left: 0;
  height: 100%;
  background: linear-gradient(90deg, var(--color-primary), var(--color-accent));
  border-radius: 3px;
  transition: width 0.1s linear;
}

.progress-thumb {
  position: absolute;
  top: 50%;
  width: 14px;
  height: 14px;
  background: white;
  border-radius: 50%;
  transform: translate(-50%, -50%);
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.3);
  opacity: 0;
  transition: opacity 0.2s;
}

.progress-bar-container:hover .progress-thumb {
  opacity: 1;
}

.controls-section {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: clamp(10px, 2vw, 16px);
}

.control-btn {
  width: clamp(36px, 5vw, 40px);
  height: clamp(36px, 5vw, 40px);
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: none;
  color: var(--color-text);
  cursor: pointer;
  transition: all 0.2s;
  gap: 4px;

  &:hover:not(:disabled) {
    color: var(--color-accent);
  }
  &:active:not(:disabled) {
    transform: scale(0.95);
  }
  &:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }
}

.speed-text {
  font-size: clamp(0.7rem, 1.2vw, 0.8rem);
}

.play-btn {
  width: clamp(50px, 8vw, 60px);
  height: clamp(50px, 8vw, 60px);
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--color-primary);
  border-radius: 50%;
  border: none;
  color: white;
  cursor: pointer;
  transition: all 0.2s;
  box-shadow: 0 4px 12px rgba(44, 85, 48, 0.4);

  &:hover {
    background: var(--color-secondary);
    transform: scale(1.05);
  }
  &:active {
    transform: scale(0.95);
  }
}

.volume-control {
  width: clamp(60px, 12vw, 80px);
}

.volume-slider {
  width: 100%;
  height: 4px;
  -webkit-appearance: none;
  appearance: none;
  background: rgba(255, 255, 255, 0.2);
  border-radius: 2px;
  cursor: pointer;

  &::-webkit-slider-thumb {
    -webkit-appearance: none;
    appearance: none;
    width: 12px;
    height: 12px;
    background: white;
    border-radius: 50%;
    cursor: pointer;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
  }

  &::-moz-range-thumb {
    width: 12px;
    height: 12px;
    background: white;
    border-radius: 50%;
    cursor: pointer;
    border: none;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
  }
}

/* 播放速度菜单 */
.speed-menu {
  position: absolute;
  bottom: 100%;
  right: 20px;
  background: rgba(0, 0, 0, 0.9);
  backdrop-filter: blur(10px);
  border-radius: 8px;
  padding: 8px;
  display: flex;
  flex-direction: column;
  gap: 4px;
  z-index: 100;
  box-shadow: 0 -4px 20px rgba(0, 0, 0, 0.3);
}

.speed-option {
  padding: 8px 16px;
  background: transparent;
  border: none;
  color: var(--color-text-dim);
  font-size: 0.875rem;
  cursor: pointer;
  border-radius: 4px;
  text-align: left;
  transition: all 0.2s;

  &:hover {
    background: rgba(255, 255, 255, 0.1);
    color: var(--color-text);
  }

  &.active {
    background: var(--color-primary);
    color: white;
  }
}

/* ===== 容器查询 - 响应式布局 ===== */
@container player (min-width: 600px) {
  .player-layout {
    display: grid;
    grid-template-columns: clamp(220px, 30%, 280px) 1fr;
    grid-template-rows: 1fr;
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

  .bottom-bar {
    position: relative;
  }
}

@container player (max-width: 560px) {
  .learning-mode-bar {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .score-strip {
    grid-template-columns: 1fr auto;

    span {
      grid-column: 1 / -1;
    }
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

@keyframes sound-wave {
  0%,
  100% {
    transform: scaleY(0.3);
  }
  50% {
    transform: scaleY(1);
  }
}

/* ===== 设置抽屉内容样式 ===== */
.settings-content {
  padding: 16px 0;
  color: var(--color-text);
}

.settings-section {
  padding: 0 16px;
  margin-bottom: 24px;

  &:last-child {
    margin-bottom: 0;
  }
}

.settings-section-title {
  font-size: 0.95rem;
  font-weight: 600;
  margin-bottom: 12px;
  padding-bottom: 8px;
  border-bottom: 1px solid var(--color-border);
  color: var(--color-text);
}

.settings-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 0;
  font-size: 0.9rem;
  color: var(--color-text-dim);

  input[type="checkbox"] {
    width: 16px;
    height: 16px;
    cursor: pointer;
    accent-color: var(--color-primary);
  }

  select {
    padding: 6px 12px;
    border: 1px solid var(--color-border);
    border-radius: 8px;
    background: var(--color-surface);
    color: var(--color-text);
    font-size: 0.85rem;
    cursor: pointer;

    &:focus {
      outline: 2px solid var(--color-primary);
      outline-offset: 1px;
    }
  }
}

.settings-label {
  color: var(--color-text-dim);
}

.settings-value {
  font-weight: 500;
  color: var(--color-text);
}

.settings-content .clear-cache-btn {
  width: 100%;
  margin-top: 16px;
  padding: 10px 16px;
  background: color-mix(in srgb, var(--w-color-danger) 15%, transparent);
  border: 1px solid color-mix(in srgb, var(--w-color-danger) 30%, transparent);
  border-radius: 8px;
  color: var(--w-color-danger);
  font-size: 0.9rem;
  cursor: pointer;
  transition: background 0.2s;

  &:hover {
    background: color-mix(in srgb, var(--w-color-danger) 25%, transparent);
  }
}

/* 快捷键列表 */
.shortcuts-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.shortcut-item {
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 0.85rem;
  color: var(--color-text-dim);

  kbd {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 24px;
    height: 24px;
    padding: 0 6px;
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: 4px;
    font-size: 0.75rem;
    font-family: monospace;
    color: var(--color-text);
    box-shadow: var(--w-shadow-sm);
  }

  span {
    flex: 1;
  }
}
</style>
