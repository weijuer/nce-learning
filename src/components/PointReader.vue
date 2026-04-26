<template>
  <div class="point-reader">
    <div class="header">
      <button class="btn" @click="handlePlayPause" :disabled="!audioReady">
        {{ isPlaying ? "⏸️ 暂停" : "▶️ 播放" }}
      </button>
      <span class="time-info"
        >{{ formatTime(currentTime) }} / {{ formatTime(duration) }}</span
      >
      <button class="btn btn-small" @click="clearCache" :disabled="isLoading">
        🗑️ 清除缓存
      </button>
    </div>

    <div v-if="error" class="error">{{ error }}</div>
    <div v-if="isLoading" class="loading">加载资源中，请稍候...</div>

    <div
      class="subtitle-container"
      ref="subtitleContainer"
      v-show="lrcLines.length > 0"
    >
      <div
        v-for="(line, index) in lrcLines"
        :key="index"
        class="lyric-line"
        :class="{ active: index === currentLineIndex }"
        @click="handleLineClick(line)"
      >
        <div class="en-text">{{ line.textEn }}</div>
        <div v-if="line.textZh" class="zh-text">{{ line.textZh }}</div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from "vue";
import { useOPFS } from "../composables/useOPFS";
import { useAudio } from "../composables/useAudio";
import { parseBilingualLRC } from "../utils/lrc-parser";
import type { LRCLine } from "../types";

interface ResourceUrls {
  mp3: string;
  lrc: string;
}

interface ResourcePaths {
  mp3: string;
  lrc: string;
}

// 默认课程资源（新概念英语第一册第一课）
const RESOURCE_URLS: ResourceUrls = {
  mp3: "data/NCE1/001&002－Excuse Me.mp3",
  lrc: "data/NCE1/001&002－Excuse Me.lrc",
};

const RESOURCE_PATHS: ResourcePaths = {
  mp3: "001&002－Excuse Me.mp3",
  lrc: "001&002－Excuse Me.lrc",
};

const { cacheFile, readFile, fileExists, deleteFile } = useOPFS();
const {
  isPlaying,
  duration,
  loadFromBuffer,
  play,
  pause,
  resume,
  seek,
  getCurrentTime,
  destroy,
} = useAudio();

const lrcLines = ref<LRCLine[]>([]);
const currentLineIndex = ref(-1);
const currentTime = ref(0);
const isLoading = ref(true);
const audioReady = ref(false);
const error = ref("");

const subtitleContainer = ref<HTMLElement | null>(null);
let animationId = 0;

onMounted(async () => {
  try {
    await loadResources();
    await initAudio();
    audioReady.value = true;
  } catch (e: any) {
    error.value = "资源加载失败：" + e.message;
    console.error(e);
  } finally {
    isLoading.value = false;
  }
  startTimeUpdateLoop();
});

onUnmounted(() => {
  cancelAnimationFrame(animationId);
  destroy();
});

async function loadResources(): Promise<void> {
  try {
    // 检查并缓存 MP3
    const mp3Exists = await fileExists(RESOURCE_PATHS.mp3);
    if (!mp3Exists) {
      console.log("正在下载音频文件...");
      const response = await fetch(RESOURCE_URLS.mp3);
      if (!response.ok) throw new Error(`音频下载失败 (${response.status})`);
      const buffer = await response.arrayBuffer();
      await cacheFile(RESOURCE_PATHS.mp3, buffer);
      console.log("音频已缓存");
    }

    // 检查并缓存 LRC
    const lrcExists = await fileExists(RESOURCE_PATHS.lrc);
    if (!lrcExists) {
      console.log("正在下载歌词文件...");
      const response = await fetch(RESOURCE_URLS.lrc);
      if (!response.ok) throw new Error(`歌词下载失败 (${response.status})`);
      const buffer = await response.arrayBuffer();
      await cacheFile(RESOURCE_PATHS.lrc, buffer);
      console.log("歌词已缓存");
    }

    // 读取歌词并解析
    const lrcBuffer = await readFile(RESOURCE_PATHS.lrc);
    const decoder = new TextDecoder("utf-8");
    const lrcText = decoder.decode(lrcBuffer);
    lrcLines.value = parseBilingualLRC(lrcText);
  } catch (err) {
    console.error("资源加载失败:", err);
    throw new Error(
      `资源加载失败: ${err instanceof Error ? err.message : "未知错误"}`,
    );
  }
}

async function initAudio(): Promise<void> {
  try {
    const mp3Buffer = await readFile(RESOURCE_PATHS.mp3);
    await loadFromBuffer(mp3Buffer);
  } catch (err) {
    console.error("音频初始化失败:", err);
    throw new Error(
      `音频初始化失败: ${err instanceof Error ? err.message : "未知错误"}`,
    );
  }
}

function handlePlayPause() {
  if (!audioReady.value) return;
  if (isPlaying.value) {
    pause();
  } else {
    // 如果当前不播放，从当前位置继续，若位置为0则从头开始
    resume();
  }
}

function handleLineClick(line: LRCLine): void {
  if (!audioReady.value) return;

  seek(line.time);
  if (!isPlaying.value) {
    // 手动触发播放（需要用户手势，这里已在点击事件中）
    play(line.time);
  }
}

function startTimeUpdateLoop(): void {
  function update(): void {
    if (!audioReady.value) return;

    currentTime.value = getCurrentTime();
    // 同步高亮行
    const idx = lrcLines.value.findLastIndex(
      (line: LRCLine) => line.time <= currentTime.value,
    );
    currentLineIndex.value = idx;
    animationId = requestAnimationFrame(update);
  }
  update();
}

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
}

async function clearCache(): Promise<void> {
  try {
    await deleteFile(RESOURCE_PATHS.mp3);
    await deleteFile(RESOURCE_PATHS.lrc);
    error.value = "缓存已清除，刷新页面重新下载。";
    audioReady.value = false;
  } catch (err) {
    console.error("清除缓存失败:", err);
    error.value = `清除缓存失败：${err instanceof Error ? err.message : "未知错误"}`;
  }
}
</script>

<style scoped>
.point-reader {
  background: var(--card-bg);
  border-radius: 16px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.06);
  padding: 1.5rem;
}
.header {
  display: flex;
  align-items: center;
  gap: 1rem;
  margin-bottom: 1.5rem;
  flex-wrap: wrap;
}
.btn {
  background: var(--primary);
  color: white;
  border: none;
  padding: 0.6rem 1.2rem;
  border-radius: 8px;
  font-size: 1rem;
  cursor: pointer;
  transition: background 0.2s;
}
.btn:hover:not(:disabled) {
  filter: brightness(1.1);
}
.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.btn-small {
  padding: 0.4rem 0.8rem;
  font-size: 0.9rem;
}
.time-info {
  font-size: 1rem;
  color: var(--secondary-text);
  min-width: 100px;
}
.loading,
.error {
  padding: 1rem;
  text-align: center;
  color: var(--secondary-text);
}
.error {
  color: #e74c3c;
  background: #fdecea;
  border-radius: 8px;
}
.subtitle-container {
  display: flex;
  gap: 1rem;
  max-height: 60vh;
  overflow-y: auto;
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 0.5rem 0;
  flex-direction: column;
}
.lyric-line {
  padding: 0.7rem 1.2rem;
  cursor: pointer;
  transition: background 0.2s;
  border-left: 4px solid transparent;
}
.lyric-line:hover {
  background: #f7f9fc;
}
.lyric-line.active {
  background: var(--highlight-bg);
  border-left-color: var(--primary);
}
.en-text {
  font-size: 1.1rem;
  font-weight: 500;
  margin-bottom: 0.2rem;
}
.zh-text {
  font-size: 0.95rem;
  color: var(--secondary-text);
}
</style>
