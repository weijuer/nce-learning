import { computed, ref } from 'vue'

export type LearningMode = 'shadowing' | 'reading' | 'listening' | 'dictation'

export interface LessonProgress {
  key: string
  version: string
  name: string
  title: string
  mode: LearningMode
  lastPosition: number
  completedLines: number[]
  pronunciationScores: number[]
  dictationAttempts: number
  totalStudySeconds: number
  cached: boolean
  updatedAt: number
}

export interface LearningSettings {
  preferredLevel: string
  preferredTheme: string
  dailyGoalMinutes: number
  syncEnabled: boolean
  deviceName: string
}

const STORAGE_KEY = 'nce-learning-progress-v1'
const SETTINGS_KEY = 'nce-learning-settings-v1'

const defaultSettings: LearningSettings = {
  preferredLevel: 'all',
  preferredTheme: 'all',
  dailyGoalMinutes: 20,
  syncEnabled: false,
  deviceName: 'This device'
}

const progressMap = ref<Record<string, LessonProgress>>({})
const settings = ref<LearningSettings>({ ...defaultSettings })
let hydrated = false

const getLessonKey = (version: string, name: string) => `${version}/${name}`

const safeParse = <T>(value: string | null, fallback: T): T => {
  if (!value) return fallback
  try {
    return JSON.parse(value) as T
  } catch {
    return fallback
  }
}

const persist = () => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(progressMap.value))
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings.value))
}

const hydrate = () => {
  if (hydrated || typeof localStorage === 'undefined') return

  progressMap.value = safeParse<Record<string, LessonProgress>>(localStorage.getItem(STORAGE_KEY), {})
  settings.value = {
    ...defaultSettings,
    ...safeParse<Partial<LearningSettings>>(localStorage.getItem(SETTINGS_KEY), {})
  }
  hydrated = true
}

const ensureProgress = (version: string, name: string, title = name): LessonProgress => {
  hydrate()

  const key = getLessonKey(version, name)
  if (!progressMap.value[key]) {
    progressMap.value[key] = {
      key,
      version,
      name,
      title,
      mode: 'listening',
      lastPosition: 0,
      completedLines: [],
      pronunciationScores: [],
      dictationAttempts: 0,
      totalStudySeconds: 0,
      cached: false,
      updatedAt: Date.now()
    }
    persist()
  }

  return progressMap.value[key]
}

const normalizeText = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9'\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim()

export const scoreTextSimilarity = (reference: string, spoken: string): number => {
  const source = normalizeText(reference)
  const target = normalizeText(spoken)
  if (!source || !target) return 0
  if (source === target) return 100

  const rows = source.length + 1
  const cols = target.length + 1
  const dp = Array.from({ length: rows }, () => new Array<number>(cols).fill(0))

  for (let i = 0; i < rows; i++) dp[i][0] = i
  for (let j = 0; j < cols; j++) dp[0][j] = j

  for (let i = 1; i < rows; i++) {
    for (let j = 1; j < cols; j++) {
      const cost = source[i - 1] === target[j - 1] ? 0 : 1
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + cost)
    }
  }

  const distance = dp[source.length][target.length]
  const longest = Math.max(source.length, target.length)
  return Math.max(0, Math.round((1 - distance / longest) * 100))
}

export function useLearningProgress() {
  hydrate()

  const allProgress = computed(() =>
    Object.values(progressMap.value).sort((a, b) => b.updatedAt - a.updatedAt)
  )

  const todayStudySeconds = computed(() => {
    const start = new Date()
    start.setHours(0, 0, 0, 0)
    return allProgress.value
      .filter(item => item.updatedAt >= start.getTime())
      .reduce((total, item) => total + item.totalStudySeconds, 0)
  })

  const completedLessonCount = computed(
    () => allProgress.value.filter(item => item.completedLines.length >= 5 || item.lastPosition > 60).length
  )

  const averagePronunciationScore = computed(() => {
    const scores = allProgress.value.flatMap(item => item.pronunciationScores)
    if (!scores.length) return 0
    return Math.round(scores.reduce((total, score) => total + score, 0) / scores.length)
  })

  const getProgress = (version: string, name: string) => {
    hydrate()
    return progressMap.value[getLessonKey(version, name)]
  }

  const touchLesson = (version: string, name: string, title = name) => ensureProgress(version, name, title)

  const updateLesson = (
    version: string,
    name: string,
    title: string,
    patch: Partial<Omit<LessonProgress, 'key' | 'version' | 'name' | 'title'>>
  ) => {
    const current = ensureProgress(version, name, title)
    progressMap.value[current.key] = {
      ...current,
      ...patch,
      updatedAt: Date.now()
    }
    persist()
  }

  const markLineComplete = (version: string, name: string, title: string, lineIndex: number) => {
    const current = ensureProgress(version, name, title)
    if (!current.completedLines.includes(lineIndex)) {
      progressMap.value[current.key] = {
        ...current,
        completedLines: [...current.completedLines, lineIndex],
        updatedAt: Date.now()
      }
      persist()
    }
  }

  const recordPronunciation = (version: string, name: string, title: string, score: number) => {
    const current = ensureProgress(version, name, title)
    progressMap.value[current.key] = {
      ...current,
      pronunciationScores: [...current.pronunciationScores.slice(-9), score],
      updatedAt: Date.now()
    }
    persist()
  }

  const updateSettings = (patch: Partial<LearningSettings>) => {
    settings.value = { ...settings.value, ...patch }
    persist()
  }

  return {
    allProgress,
    averagePronunciationScore,
    completedLessonCount,
    getProgress,
    markLineComplete,
    progressMap,
    recordPronunciation,
    scoreTextSimilarity,
    settings,
    todayStudySeconds,
    touchLesson,
    updateLesson,
    updateSettings
  }
}
