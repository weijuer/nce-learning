export interface RawLesson {
  name?: string
  fileName?: string
}

export interface LessonThemeRule {
  id: string
  label: string
  pattern: RegExp
}

export interface EnrichedLesson {
  name: string
  fileName: string
  version: string
  title: string
  level: string
  levelDescription: string
  theme: string
}

export interface LessonProgressSummary {
  completedLines?: number[]
  pronunciationScores?: number[]
}

export type LessonProgressGetter<TProgress extends LessonProgressSummary> = (
  version: string,
  fileName: string
) => TProgress | undefined

export type GroupedLessons<TLesson> = Record<string, TLesson[]>

const lessonNumberPattern = /^(\d+)/

export const getLessonTitle = (fileName: string) => `Lesson ${fileName.split('－')[0]}`

export const getLessonNumber = (fileName: string) => {
  const match = fileName.match(lessonNumberPattern)
  return match ? Number.parseInt(match[1], 10) : Number.MAX_SAFE_INTEGER
}

export const getTheme = (lessonName: string, themeRules: LessonThemeRule[], fallbackTheme = 'general') => {
  return themeRules.find(rule => rule.pattern.test(lessonName))?.id || fallbackTheme
}

export interface LessonLibraryResult<TLesson> {
  lessons: TLesson[]
  groups: GroupedLessons<TLesson>
  hasResults: boolean
}

export function buildLessonGroups<TProgress extends LessonProgressSummary>(
  books: Record<string, RawLesson[]>,
  options: {
    searchText: string
    levelMeta: Record<string, { label: string; description: string }>
    themeRules: LessonThemeRule[]
    getProgress?: LessonProgressGetter<TProgress>
  }
): LessonLibraryResult<(typeof lessons)[number]> {
  const keyword = options.searchText.trim().toLowerCase()
  const seen = new Set<string>()
  const lessons = Object.entries(books)
    .flatMap(([version, rawLessons]) => {
      if (!Array.isArray(rawLessons)) return []

      return rawLessons
        .filter((lesson): lesson is Required<RawLesson> => Boolean(lesson?.fileName && lesson?.name))
        .map(lesson => {
          const progress = options.getProgress?.(version, lesson.fileName)
          const theme = getTheme(`${lesson.fileName} ${lesson.name}`, options.themeRules)
          const completedLines = progress?.completedLines?.length || 0
          const score = progress?.pronunciationScores?.at(-1) || 0

          return {
            ...lesson,
            version,
            title: getLessonTitle(lesson.fileName),
            level: options.levelMeta[version]?.label || version,
            levelDescription: options.levelMeta[version]?.description || '',
            theme,
            progress,
            completion: Math.min(100, Math.round((completedLines / 8) * 100)),
            score
          }
        })
    })
    .filter(lesson => {
      const key = `${lesson.version}/${lesson.fileName}`
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
    .filter(lesson => {
      if (!keyword) return true
      const searchableText = `${lesson.fileName} ${lesson.name} ${lesson.title} ${lesson.level}`.toLowerCase()
      return searchableText.includes(keyword)
    })
    .sort((a, b) => a.version.localeCompare(b.version) || getLessonNumber(a.fileName) - getLessonNumber(b.fileName))

  // 按版本分组，确保所有版本都存在
  const groups = lessons.reduce<GroupedLessons<(typeof lessons)[number]>>((currentGroups, lesson) => {
    currentGroups[lesson.version] ??= []
    currentGroups[lesson.version].push(lesson)
    return currentGroups
  }, {})

  // 补充没有课程的版本，确保所有级别都显示
  const allVersions = Object.keys(options.levelMeta)
  for (const version of allVersions) {
    if (!groups[version]) {
      groups[version] = []
    }
  }

  return { lessons, groups, hasResults: lessons.length > 0 }
}
