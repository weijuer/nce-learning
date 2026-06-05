<script name="book" setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { WTabs, WTab, WDrawer } from '@/components/layouts'
import { Player, MiniPlayer } from 'Widgets'

import { NCE_JSON } from '@/utils/nce-data'
import { useStreamingPlayer } from 'Composables/useStreamingPlayer'
import { useLearningProgress } from '@/composables/useLearningProgress'
import { buildLessonGroups, getLessonTitle } from '@/utils/lesson-library'

const books = ref(NCE_JSON || {})

const state = reactive({
  isOpen: false,
  title: '',
  description: '',
  name: '',
  version: ''
})

const showMiniPlayer = ref(false)
const hasPlayHistory = ref(false)
const searchText = ref('')

const levelMeta = {
  NCE1: { label: '入门', description: '基础句型与日常表达' },
  NCE2: { label: '进阶', description: '核心语法与短篇叙事' },
  NCE3: { label: '强化', description: '复杂表达与精读能力' },
  NCE4: { label: '高级', description: '学术阅读与思想表达' }
} as const

const themeRules = [
  { id: 'daily', label: '日常沟通', pattern: /shirt|coffee|holiday|weekend|doctor|kitchen|weather|supper|shopping|passport|teacher|breakfast/i },
  { id: 'story', label: '故事叙事', pattern: /story|dream|ghost|alibi|escape|mine|murder|puma|titanic|island|gangster/i },
  { id: 'culture', label: '文化社会', pattern: /education|industry|banks|culture|government|sporting|old|youth|city|press/i },
  { id: 'science', label: '科学自然', pattern: /volcanoes|hubble|sound|space|noise|river|bats|fossil|snake|earth|electric|bridge/i },
  { id: 'general', label: '综合能力', pattern: /./ }
]

const {
  isPlaying,
  currentTime,
  loadLesson
} = useStreamingPlayer()

const {
  averagePronunciationScore,
  completedLessonCount,
  getProgress,
  settings,
  todayStudySeconds,
  touchLesson,
  updateSettings
} = useLearningProgress()

const getThemeLabel = (themeId: string) => {
  return themeRules.find(rule => rule.id === themeId)?.label || '综合'
}

const lessonLibrary = computed(() => buildLessonGroups(books.value, {
    searchText: searchText.value,
    levelMeta,
    themeRules,
    getProgress
  }))

const flattenedLessons = computed(() => lessonLibrary.value.lessons)

const groupedLessons = computed(() => lessonLibrary.value.groups)

const hasSearchResults = computed(() => lessonLibrary.value.hasResults)

const hasSearchText = computed(() => searchText.value.trim().length > 0)

const dailyGoalPercent = computed(() => {
  const goalSeconds = settings.value.dailyGoalMinutes * 60
  return Math.min(100, Math.round((todayStudySeconds.value / goalSeconds) * 100))
})

const resumeLesson = computed(() => {
  return flattenedLessons.value.find(lesson => lesson.progress?.lastPosition || lesson.progress?.completedLines.length)
    || flattenedLessons.value[0]
})

const goLesson = (name: string, version: string | number) => {
  state.isOpen = true
  state.title = getLessonTitle(name)
  state.description = name
  state.name = name
  state.version = version as string
  touchLesson(version as string, name, state.description)
  
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
    <header class="learning-hero">
      <div>
        <p class="eyebrow">Learning path</p>
        <h1>今天从可理解输入开始</h1>
        <p>按难度、主题和最近进度选择课程，听读、跟读、听写在同一个学习流里完成。</p>
      </div>
      <button
        v-if="resumeLesson"
        type="button"
        class="resume-btn"
        @click="goLesson(resumeLesson.fileName, resumeLesson.version)"
      >
        继续 {{ resumeLesson.title }}
      </button>
    </header>

    <section class="learning-dashboard" aria-label="学习概览">
      <div class="metric">
        <span class="metric-label">今日目标</span>
        <strong>{{ Math.round(todayStudySeconds / 60) }}/{{ settings.dailyGoalMinutes }} min</strong>
        <div class="metric-bar"><span :style="{ width: dailyGoalPercent + '%' }"></span></div>
      </div>
      <div class="metric">
        <span class="metric-label">完成课程</span>
        <strong>{{ completedLessonCount }}</strong>
        <small>本地优先记录</small>
      </div>
      <div class="metric">
        <span class="metric-label">跟读均分</span>
        <strong>{{ averagePronunciationScore || '--' }}</strong>
        <small>{{ settings.syncEnabled ? '云同步已开启' : '离线可用，待同步' }}</small>
      </div>
    </section>

    <section class="library-toolbar" aria-label="内容筛选">
      <input v-model="searchText" type="search" placeholder="搜索课程标题或编号" />
      <label class="sync-toggle">
        <input
          type="checkbox"
          :checked="settings.syncEnabled"
          @change="updateSettings({ syncEnabled: ($event.target as HTMLInputElement).checked })"
        />
        <span>多设备同步</span>
      </label>
    </section>

    <w-tabs variant="pills">
      <w-tab
        v-for="(_, folderName) in groupedLessons"
        :key="folderName"
        :title="folderName"
        :name="folderName"
      >
        <!-- 无搜索结果提示 -->
        <div v-if="hasSearchText && !hasSearchResults" class="no-results">
          <div class="no-results-icon">
            <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
              <circle cx="11" cy="11" r="8"></circle>
              <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
            </svg>
          </div>
          <p class="no-results-text">未找到匹配的课程</p>
          <p class="no-results-hint">尝试其他关键词或清除搜索</p>
        </div>

        <!-- 无内容提示 -->
        <div v-else-if="!groupedLessons[folderName]?.length" class="no-results">
          <div class="no-results-icon">
            <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
              <polyline points="14 2 14 8 20 8"></polyline>
            </svg>
          </div>
          <p class="no-results-text">此版本暂无课程</p>
        </div>

        <!-- 课程列表 -->
        <div v-else class="lesssons">
          <div
            v-for="course in groupedLessons[folderName]"
            :key="course.fileName"
            @click="goLesson(course.fileName, course.version)"
            class="lesson"
          >
            <div class="lesson-content">
              <div class="lesson-topline">
                <span class="lesson-title">{{ course.title }}</span>
                <span class="lesson-chip">{{ course.level }}</span>
              </div>
              <div class="lesson-name">{{ course.name }}</div>
              <p>{{ course.levelDescription }}</p>
              <div class="lesson-meta">
                <span>{{ getThemeLabel(course.theme) }}</span>
                <span v-if="course.progress?.cached">已缓存</span>
                <span v-else>可预下载</span>
                <span v-if="course.score">跟读 {{ course.score }}</span>
              </div>
              <div class="lesson-progress" aria-hidden="true">
                <span :style="{ width: course.completion + '%' }"></span>
              </div>
            </div>
          </div>
        </div>
      </w-tab>
    </w-tabs>

    <w-drawer
      v-model="state.isOpen"
      position="left"
      width="clamp(40vw, 460px, 100vw)"
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
  padding: clamp(1rem, 3vw, 2rem);
  padding-bottom: calc(2rem + 70px);
  display: flex;
  flex-direction: column;
  gap: 1rem;

  .learning-hero {
    display: flex;
    align-items: end;
    justify-content: space-between;
    gap: 1rem;
    padding-block: clamp(0.5rem, 2vw, 1rem);

    h1 {
      margin: 0;
      font-size: clamp(1.8rem, 4vw, 3.5rem);
      line-height: 1.05;
    }

    p {
      max-width: 680px;
      color: var(--color-text-dim);
    }
  }

  .eyebrow {
    margin: 0 0 0.35rem;
    text-transform: uppercase;
    letter-spacing: 0;
    font-size: 0.75rem;
    color: var(--color-secondary);
    font-weight: 700;
  }

  .resume-btn {
    border: 1px solid var(--color-border);
    border-radius: 8px;
    padding: 0.75rem 1rem;
    color: var(--color-text);
    background: var(--color-surface);
    cursor: pointer;
    white-space: nowrap;
  }

  .learning-dashboard {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
    gap: 0.75rem;
  }

  .metric {
    padding: 1rem;
    border: 1px solid var(--color-border);
    border-radius: 8px;
    background: var(--color-surface);
    display: grid;
    gap: 0.35rem;

    strong {
      font-size: 1.6rem;
      line-height: 1;
    }

    small,
    .metric-label {
      color: var(--color-text-dim);
    }
  }

  .metric-bar,
  .lesson-progress {
    height: 6px;
    border-radius: 999px;
    background: color-mix(in srgb, var(--color-border) 70%, transparent);
    overflow: hidden;

    span {
      display: block;
      height: 100%;
      background: #2f7d62;
    }
  }

  .library-toolbar {
    display: grid;
    grid-template-columns: minmax(180px, 1fr) auto;
    gap: 0.75rem;
    align-items: center;

    input,
    select {
      min-height: 42px;
      border: 1px solid var(--color-border);
      border-radius: 8px;
      padding: 0 0.8rem;
      color: var(--color-text);
      background: var(--color-surface);
    }
  }

  .sync-toggle {
    min-height: 42px;
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    padding-inline: 0.8rem;
    border: 1px solid var(--color-border);
    border-radius: 8px;
    color: var(--color-text-dim);
    background: var(--color-surface);
  }

  .lesssons {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(min(100%, 280px), 1fr));
    gap: clamp(0.75rem, 2vw, 1rem);
    justify-content: center;

    .lesson {
      min-height: 170px;
      padding: 1rem;
      position: relative;
      display: flex;
      justify-content: space-between;
      flex-direction: column;
      background-color: var(--surface);
      border-radius: 8px;
      border: 1px solid var(--color-border);
      transition: all 0.2s cubic-bezier(0.25, 0.46, 0.45, 0.94);
      overflow: hidden;
      cursor: pointer;

      &:hover {
        transform: scale(1.02);
        box-shadow: 0 8px 25px rgba(0, 0, 0, 0.12);
        border-color: var(--color-border);
      }

      .lesson-content {
        display: grid;
        gap: 0.55rem;
      }

      .lesson-topline,
      .lesson-meta {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 0.5rem;
      }

      .lesson-title {
        font-size: 0.85rem;
        color: var(--secondary-text);
      }

      .lesson-chip,
      .lesson-meta span {
        border-radius: 999px;
        padding: 0.15rem 0.45rem;
        background: color-mix(in srgb, var(--color-border) 65%, transparent);
        color: var(--color-text-dim);
        font-size: 0.72rem;
      }

      .lesson-name {
        font-size: 1rem;
        font-weight: 600;
        color: var(--text);
      }

      p {
        margin: 0;
        min-height: 2.8em;
        color: var(--color-text-dim);
        font-size: 0.85rem;
      }

      .lesson-meta {
        justify-content: start;
        flex-wrap: wrap;
      }
    }
  }

  .no-results {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 3rem 1rem;
    text-align: center;

    .no-results-icon {
      color: var(--color-text-dim);
      opacity: 0.5;
      margin-bottom: 1rem;
    }

    .no-results-text {
      margin: 0;
      font-size: 1.1rem;
      font-weight: 500;
      color: var(--color-text);
    }

    .no-results-hint {
      margin: 0.5rem 0 0;
      font-size: 0.9rem;
      color: var(--color-text-dim);
    }
  }
}

@media (max-width: 760px) {
  .book {
    .learning-hero {
      align-items: start;
      flex-direction: column;
    }

    .library-toolbar {
      grid-template-columns: 1fr;
    }

    .resume-btn {
      width: 100%;
    }
  }
}
</style>
