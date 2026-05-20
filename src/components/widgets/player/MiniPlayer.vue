<template>
  <div class="mini-player" :class="{ 'is-playing': isPlaying }">
    <div class="mini-player-content" @click="toggleDrawer">
      <div class="mini-cover">
        <svg viewBox="0 0 100 100" class="mini-icon">
          <circle cx="50" cy="50" r="45" fill="url(#miniGradient)" />
          <path d="M35 35 L35 65 M45 35 L45 60 M55 35 L55 70 M65 35 L65 55" stroke="white" stroke-width="3" stroke-linecap="round" fill="none" />
          <defs>
            <radialGradient id="miniGradient" cx="50%" cy="50%" r="50%">
              <stop offset="0%" style="stop-color: #2c5530" />
              <stop offset="100%" style="stop-color: #1a361e" />
            </radialGradient>
          </defs>
        </svg>
        <div class="playing-indicator" :class="{ active: isPlaying }">
          <span class="bar bar-1"></span>
          <span class="bar bar-2"></span>
          <span class="bar bar-3"></span>
        </div>
      </div>
      
      <div class="mini-info">
        <div class="mini-title">{{ currentLessonName }}</div>
        <div class="mini-time">{{ formattedCurrentTime }} / {{ formattedDuration }}</div>
      </div>

      <div class="mini-progress">
        <div class="progress-bar">
          <div class="progress-fill" :style="{ width: progress + '%' }"></div>
        </div>
      </div>

      <button class="mini-play-btn" @click.stop="togglePlay">
        <svg v-if="!isPlaying" width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
          <path d="M8 5v14l11-7z" />
        </svg>
        <svg v-else width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
          <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
        </svg>
      </button>

      <button class="mini-close-btn" @click.stop="closePlayer">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
          <path d="M18 6L6 18M6 6l12 12" />
        </svg>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { usePlayer } from 'Composables/usePlayer'

const emit = defineEmits<{
  (e: 'open-drawer'): void
}>()

const {
  isPlaying,
  currentTime,
  duration,
  progress,
  formattedCurrentTime,
  formattedDuration,
  togglePlay
} = usePlayer()

const currentLessonName = ref('')

watch(
  () => currentTime.value,
  () => {
    if (duration.value > 0 && currentTime.value > 0) {
      currentLessonName.value = '播放中...'
    }
  }
)

const toggleDrawer = () => {
  emit('open-drawer')
}

const closePlayer = () => {
  if (isPlaying.value) {
    togglePlay()
  }
  currentLessonName.value = ''
}
</script>

<style scoped>
.mini-player {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  z-index: 100;
  background: rgba(0, 0, 0, 0.85);
  backdrop-filter: blur(20px);
  padding: clamp(8px, 1.5vw, 12px) clamp(12px, 3vw, 24px);
  border-top: 1px solid rgba(255, 255, 255, 0.1);
  transform: translateY(100%);
  transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.mini-player.active {
  transform: translateY(0);
}

.mini-player-content {
  display: flex;
  align-items: center;
  gap: clamp(10px, 2vw, 16px);
  cursor: pointer;
}

.mini-cover {
  position: relative;
  width: clamp(40px, 8vw, 56px);
  aspect-ratio: 1;
  border-radius: 8px;
  overflow: hidden;
  flex-shrink: 0;
}

.mini-icon {
  width: 100%;
  height: 100%;
}

.playing-indicator {
  position: absolute;
  bottom: 4px;
  right: 4px;
  display: flex;
  align-items: flex-end;
  gap: 2px;
  padding: 4px;
  background: rgba(0, 0, 0, 0.6);
  border-radius: 4px;
  opacity: 0;
  transition: opacity 0.3s;
}

.playing-indicator.active {
  opacity: 1;
}

.bar {
  width: 3px;
  background: #2c5530;
  border-radius: 2px;
  animation: soundWave 0.8s ease-in-out infinite;
}

.bar-1 { height: 6px; animation-delay: 0s; }
.bar-2 { height: 10px; animation-delay: 0.2s; }
.bar-3 { height: 6px; animation-delay: 0.4s; }

@keyframes soundWave {
  0%, 100% { transform: scaleY(1); }
  50% { transform: scaleY(1.5); }
}

.mini-info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.mini-title {
  font-size: clamp(0.85rem, 1.5vw, 0.95rem);
  font-weight: 500;
  color: #f5f5f5;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.mini-time {
  font-size: clamp(0.7rem, 1.2vw, 0.8rem);
  color: rgba(255, 255, 255, 0.6);
  font-variant-numeric: tabular-nums;
}

.mini-progress {
  flex: 1;
  min-width: 60px;
  max-width: 150px;
  padding: 0 8px;
}

.progress-bar {
  height: 4px;
  background: rgba(255, 255, 255, 0.2);
  border-radius: 2px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background: #2c5530;
  border-radius: 2px;
  transition: width 0.1s ease;
}

.mini-play-btn {
  width: clamp(32px, 5vw, 40px);
  height: clamp(32px, 5vw, 40px);
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(255, 255, 255, 0.1);
  border: none;
  border-radius: 50%;
  color: #f5f5f5;
  cursor: pointer;
  flex-shrink: 0;
  transition: all 0.2s;

  &:hover {
    background: rgba(255, 255, 255, 0.2);
    transform: scale(1.05);
  }
}

.mini-close-btn {
  width: clamp(28px, 4vw, 36px);
  height: clamp(28px, 4vw, 36px);
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(255, 255, 255, 0.1);
  border: none;
  border-radius: 50%;
  color: rgba(255, 255, 255, 0.6);
  cursor: pointer;
  flex-shrink: 0;
  transition: all 0.2s;

  &:hover {
    background: rgba(239, 68, 68, 0.3);
    color: #ef4444;
  }
}

@media (max-width: 640px) {
  .mini-progress {
    display: none;
  }
}
</style>