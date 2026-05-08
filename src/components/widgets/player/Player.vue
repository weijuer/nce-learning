<template>
  <div class="player-container" :class="{ 'is-loading': isLoading }">
    <!-- 加载状态 -->
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
      </div>
    </div>

    <!-- 错误提示 -->
    <div v-if="error" class="error-card">
      <div class="error-icon">⚠️</div>
      <div class="error-content">
        <h4>Loading Error</h4>
        <p>{{ error }}</p>
        <!-- <button class="retry-btn" @click="initPlayer">重试</button> -->
      </div>
    </div>

    <!-- 主内容区域 -->
    <div v-if="!isLoading && !error" class="player-content">
      <!-- 歌词显示区域 -->
      <section class="lyrics-section">
        <Lyrics
          :lrc-lines="lrcLines"
          :current-line-index="currentLineIndex"
          @line-click="handleLineClick"
        />
      </section>

      <!-- 音频控制区域 -->
      <section class="audio-section">
        <AudioPlayer
          :is-playing="isPlaying"
          :current-time="currentTime"
          :duration="duration"
          @seek="seek"
          @play="play"
          @pause="pause"
          @resume="resume"
        />
      </section>
    </div>
  </div>
</template>

<script setup lang="ts">
import { usePlayer } from 'Composables/usePlayer'
import AudioPlayer from './AudioPlayer.vue'
import Lyrics from './Lyrics.vue'

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
  currentTime,
  duration,
  lrcLines,
  currentLineIndex,
  error,
  play,
  pause,
  resume,
  seek,
  loadLesson
} = usePlayer({
  autoplay: false,
  loop: false,
  volume: 0.7,
  basePath: 'data'
})

const handleLineClick = (line: any) => {
  seek(line.time)
}

// 加载课程
if (props.name) {
  loadLesson(props.name, props.version)
}
</script>

<style>
:root {
  --primary-color: #2c5530;
  --primary-light: #4a7c59;
  --accent-color: #d4af37;
  --text-primary: #2d3748;
  --text-secondary: #718096;
  --text-light: #a0aec0;
  --bg-primary: #fefefe;
  --bg-secondary: #f7fafc;
  --bg-tertiary: #edf2f7;
  --border-color: #e2e8f0;
  --shadow-sm: 0 1px 3px rgba(0, 0, 0, 0.1);
  --shadow-md: 0 4px 6px rgba(0, 0, 0, 0.05);
  --shadow-lg: 0 10px 15px rgba(0, 0, 0, 0.1);
  --border-radius: 12px;
  --border-radius-sm: 8px;
  --spacing-xs: 0.5rem;
  --spacing-sm: 1rem;
  --spacing-md: 1.5rem;
  --spacing-lg: 2rem;
  --spacing-xl: 3rem;
}

.player-container {
  &.is-loading {
    pointer-events: none;
  }
}

.loading-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(255, 255, 255, 0.95);
  backdrop-filter: blur(10px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.loading-content {
  text-align: center;
  max-width: 400px;
  padding: var(--spacing-xl);
}

.loading-spinner {
  position: relative;
  width: 60px;
  height: 60px;
  margin: 0 auto var(--spacing-md);
}

.spinner-ring {
  width: 100%;
  height: 100%;
  border: 3px solid var(--border-color);
  border-top: 3px solid var(--primary-color);
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

.spinner-dot {
  position: absolute;
  top: 50%;
  left: 50%;
  width: 8px;
  height: 8px;
  background: var(--accent-color);
  border-radius: 50%;
  transform: translate(-50%, -50%);
}

.loading-text {
  h3 {
    font-family: 'Playfair Display', serif;
    font-size: 1.5rem;
    font-weight: 600;
    color: var(--text-primary);
    margin-bottom: var(--spacing-sm);
  }

  p {
    color: var(--text-secondary);
    line-height: 1.6;
  }
}

.error-card {
  background: #fed7d7;
  border: 1px solid #feb2b2;
  border-radius: var(--border-radius);
  padding: var(--spacing-md);
  margin: var(--spacing-lg);
  display: flex;
  align-items: center;
  gap: var(--spacing-md);
}

.error-icon {
  font-size: 1.5rem;
  flex-shrink: 0;
}

.error-content {
  flex: 1;

  h4 {
    font-weight: 600;
    color: #c53030;
    margin-bottom: var(--spacing-xs);
  }

  p {
    color: #742a2a;
    margin-bottom: var(--spacing-sm);
  }
}

.retry-btn {
  background: #c53030;
  color: white;
  border: none;
  padding: 0.5rem 1rem;
  border-radius: var(--border-radius-sm);
  cursor: pointer;
  font-weight: 500;
  transition: all 0.2s;

  &:hover {
    background: #9b2c2c;
    transform: translateY(-1px);
  }
}

.player-content {
  max-width: 800px;
  margin: auto;

  .audio-section {
    position: sticky;
    bottom: 1%;
  }
}

.player-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: var(--spacing-xl);
  padding-bottom: var(--spacing-md);
  border-bottom: 2px solid var(--border-color);
}

.lesson-info {
  .lesson-badge {
    display: inline-block;
    background: var(--primary-color);
    color: white;
    padding: 0.25rem 0.75rem;
    border-radius: 20px;
    font-size: 0.875rem;
    font-weight: 500;
    margin-bottom: var(--spacing-sm);
  }

  .lesson-title {
    font-family: 'Playfair Display', serif;
    font-size: 2.5rem;
    font-weight: 700;
    color: var(--text-primary);
    margin: 0 0 var(--spacing-sm) 0;
    line-height: 1.2;
  }

  .lesson-meta {
    display: flex;
    gap: var(--spacing-md);

    .meta-item {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      color: var(--text-secondary);
      font-size: 0.875rem;

      svg {
        opacity: 0.7;
      }
    }
  }
}

.header-actions {
  .action-btn {
    background: none;
    border: 1px solid var(--border-color);
    border-radius: var(--border-radius-sm);
    padding: 0.5rem;
    cursor: pointer;
    color: var(--text-secondary);
    transition: all 0.2s;

    &:hover {
      background: var(--bg-tertiary);
      color: var(--text-primary);
      border-color: var(--text-light);
    }
  }
}

@keyframes spin {
  0% {
    transform: rotate(0deg);
  }
  100% {
    transform: rotate(360deg);
  }
}
</style>
