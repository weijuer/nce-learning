<script name="book" setup lang="ts">
import { reactive, ref, watch } from 'vue'
import { WTabs, WTab, WDrawer } from '@/components/layouts'
import { Player, MiniPlayer } from 'Widgets'

import { NCE_JSON } from '@/utils/nce-data'
import { useRouter } from 'vue-router'
import { usePlayer } from 'Composables/usePlayer'

const books = ref(NCE_JSON || {})

const router = useRouter()
const state = reactive({
  isOpen: false,
  title: '',
  description: '',
  name: '',
  version: ''
})

const showMiniPlayer = ref(false)
const hasPlayHistory = ref(false)

const {
  isPlaying,
  currentTime,
  duration,
  loadLesson
} = usePlayer()

const getLessonTitle = (fileName: string) => {
  return 'Lesson ' + fileName.split('－')[0]
}

const goLesson = (name: string, version: string | number) => {
  state.isOpen = true
  state.title = getLessonTitle(name)
  state.description = name
  state.name = name
  state.version = version as string
  
  loadLesson(name, version as string)
}

const handleDrawerClose = () => {
  if (currentTime.value > 0 || isPlaying.value) {
    hasPlayHistory.value = true
    showMiniPlayer.value = true
  }
}

const openDrawer = () => {
  state.isOpen = true
}

watch(isPlaying, (playing) => {
  if (!playing && currentTime.value === 0) {
    showMiniPlayer.value = false
  }
})
</script>

<template>
  <div class="book">
    <header class="page-hero">
      <h1>NCE Learning</h1>
      <p>Simple · Efficient · Focus</p>
    </header>

    <w-tabs variant="pills">
      <w-tab
        v-for="(folder, folderName) in books"
        :key="folderName"
        :title="folderName"
        :name="folderName"
      >
        <div class="lesssons">
          <div
            v-for="(course, courseName) in folder"
            :key="courseName"
            @click="goLesson(course.fileName, folderName)"
            class="lesson"
          >
            <div class="lesson-content">
              <div class="lesson-title">{{ getLessonTitle(course.fileName) }}</div>
              <div class="lesson-name">{{ course.name }}</div>
            </div>
          </div>
        </div>
      </w-tab>
    </w-tabs>

    <w-drawer
      v-model="state.isOpen"
      position="bottom"
      height="clamp(85%, 440px, 95%)"
      title="播放器"
      getContainer="body"
      close-on-click-overlay
      @update:model-value="(val) => !val && handleDrawerClose()"
    >
      <Player :name="state.name" :version="state.version" />
    </w-drawer>

    <MiniPlayer
      v-if="hasPlayHistory"
      :class="{ active: showMiniPlayer }"
      @open-drawer="openDrawer"
    />
  </div>
</template>

<style>
.book {
  padding: 2rem;
  padding-bottom: calc(2rem + 70px);
  display: flex;
  flex-direction: column;

  .lesssons {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(340px, 1fr));
    grid-gap: clamp(1rem, 2vw, 24px);
    justify-content: center;

    .lesson {
      padding: clamp(1rem, 2vmax, 2.5rem) 1rem;
      position: relative;
      display: flex;
      justify-content: space-between;
      flex-direction: column;
      background-color: var(--surface);
      border-radius: 10px;
      border: 1px solid var(--color-border);
      transition: all 0.2s cubic-bezier(0.25, 0.46, 0.45, 0.94);
      overflow: hidden;
      cursor: pointer;

      &:hover {
        transform: scale(1.02);
        box-shadow: 0 8px 25px rgba(0, 0, 0, 0.12);
        border-color: var(--color-border);
      }

      .lesson-title {
        font-size: 0.85rem;
        color: var(--secondary-text);
      }

      .lesson-name {
        font-size: 1rem;
        font-weight: 600;
        color: var(--text);
      }
    }
  }
}
</style>
