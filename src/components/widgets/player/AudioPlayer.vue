<template>
  <div class="audio-player">
    <div class="audio-controls">
      <button class="play-pause-btn" @click="togglePlay" :disabled="duration === 0">
        <svg v-if="!isPlaying" width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
          <path d="M8 5v14l11-7z" />
        </svg>
        <svg v-else width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
          <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
        </svg>
      </button>

      <div class="progress-section">
        <span class="time current-time">{{ formattedCurrentTime }}</span>

        <div class="progress-bar-container" @click="seekToPosition">
          <div class="progress-bar-background">
            <div class="progress-bar-fill" :style="{ width: progressPercentage + '%' }"></div>
            <div
              class="progress-bar-thumb"
              :style="{ left: progressPercentage + '%' }"
              @mousedown="startDragging"
            ></div>
          </div>
        </div>

        <span class="time total-time">{{ formattedDuration }}</span>
      </div>

      <div class="volume-control">
        <button class="volume-btn" @click="toggleMute" :title="isMuted ? '取消静音' : '静音'">
          <svg v-if="isMuted" width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
            <path
              d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z"
            />
          </svg>
          <svg
            v-else-if="volume > 0.5"
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="currentColor"
          >
            <path
              d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"
            />
          </svg>
          <svg v-else width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
            <path
              d="M18.5 12c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM3 9v6h4l5 5V4L7 9H3z"
            />
          </svg>
        </button>

        <div class="volume-slider-container">
          <div class="volume-slider" @click="handleVolumeClick">
            <div class="volume-slider-background">
              <div
                class="volume-slider-fill"
                :style="{ width: (isMuted ? 0 : volume) * 100 + '%' }"
              ></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useStreamingPlayer } from 'Composables/useStreamingPlayer'

const {
  isPlaying,
  currentTime,
  duration,
  volume,
  isMuted,
  formattedCurrentTime,
  formattedDuration,
  togglePlay,
  seek,
  setVolume,
  toggleMute
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
  continueAfterLoop: true
})

const progressPercentage = computed(() => {
  if (duration.value === 0) return 0
  return (currentTime.value / duration.value) * 100
})

const seekToPosition = (event: MouseEvent) => {
  if (duration.value === 0) return

  const progressBar = event.currentTarget as HTMLElement
  const rect = progressBar.getBoundingClientRect()
  const clickX = event.clientX - rect.left
  const percentage = clickX / rect.width
  const newTime = percentage * duration.value

  seek(newTime)
}

const handleVolumeClick = (event: MouseEvent) => {
  const slider = event.currentTarget as HTMLElement
  const rect = slider.getBoundingClientRect()
  const clickX = event.clientX - rect.left
  const newVolume = Math.max(0, Math.min(1, clickX / rect.width))

  setVolume(newVolume)
}

const startDragging = (event: MouseEvent) => {
  event.preventDefault()

  const onMouseMove = (moveEvent: MouseEvent) => {
    const progressBar = document.querySelector('.progress-bar-container') as HTMLElement
    if (!progressBar) return

    const rect = progressBar.getBoundingClientRect()
    const clickX = Math.max(0, Math.min(rect.width, moveEvent.clientX - rect.left))
    const percentage = clickX / rect.width
    const newTime = percentage * duration.value

    seek(newTime)
  }

  const onMouseUp = () => {
    document.removeEventListener('mousemove', onMouseMove)
    document.removeEventListener('mouseup', onMouseUp)
  }

  document.addEventListener('mousemove', onMouseMove)
  document.addEventListener('mouseup', onMouseUp)
}
</script>

<style scoped>
.audio-player {
  padding: clamp(10px, 2vw, 14px);
  background-color: rgba(255, 255, 255, 0.05);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  border-radius: 12px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  backdrop-filter: blur(4px);
}

.audio-controls {
  display: flex;
  align-items: center;
  gap: clamp(10px, 2vw, 16px);
}

.play-pause-btn {
  width: clamp(2rem, 8vw, 48px);
  aspect-ratio: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  cursor: pointer;
  border: none;
  border-radius: 50%;
  background: #2c5530;
  color: white;
  transition: all 0.2s ease;
}

.play-pause-btn:hover:not(:disabled) {
  background: #4a7c59;
  transform: scale(1.05);
}

.play-pause-btn:disabled {
  background-color: rgba(255, 255, 255, 0.2);
  cursor: not-allowed;
  opacity: 0.6;
}

.progress-section {
  display: flex;
  align-items: center;
  gap: clamp(4px, 1vw, 12px);
  flex: 1;
  min-width: 0;
}

.time {
  font-size: clamp(12px, 1.8vw, 14px);
  color: rgba(255, 255, 255, 0.7);
  font-variant-numeric: tabular-nums;
  min-width: 35px;
  text-align: center;
}

.progress-bar-container {
  flex: 1;
  height: 24px;
  display: flex;
  align-items: center;
  cursor: pointer;
  padding: 0 8px;
}

.progress-bar-background {
  position: relative;
  width: 100%;
  height: 4px;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 2px;
  overflow: visible;
}

.progress-bar-fill {
  height: 100%;
  background: #2c5530;
  border-radius: 2px;
  transition: width 0.1s ease;
}

.progress-bar-thumb {
  position: absolute;
  top: 50%;
  transform: translate(-50%, -50%);
  width: 12px;
  height: 12px;
  background: #2c5530;
  border-radius: 50%;
  cursor: grab;
  opacity: 0;
  transition: opacity 0.2s ease;
}

.progress-bar-container:hover .progress-bar-thumb {
  opacity: 1;
}

.progress-bar-thumb:active {
  cursor: grabbing;
}

.volume-control {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}

.volume-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  background: none;
  border: none;
  color: rgba(255, 255, 255, 0.7);
  cursor: pointer;
  padding: 4px;
  border-radius: 4px;
  transition: all 0.2s ease;
}

.volume-btn:hover {
  color: #4a7c59;
  background: rgba(255, 255, 255, 0.1);
}

.volume-slider-container {
  width: clamp(60px, 12vw, 80px);
}

.volume-slider {
  height: 24px;
  display: flex;
  align-items: center;
  cursor: pointer;
  padding: 0 4px;
}

.volume-slider-background {
  width: 100%;
  height: 4px;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 2px;
  position: relative;
}

.volume-slider-fill {
  height: 100%;
  background: #2c5530;
  border-radius: 2px;
  transition: width 0.1s ease;
}

@media (max-width: 640px) {
  .audio-controls {
    gap: 12px;
  }

  .play-pause-btn {
    width: 2rem;
    height: 2rem;
  }

  .volume-control {
    display: none;
  }
}
</style>
