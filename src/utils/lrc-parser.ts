import type { LRCLine } from '../types'

/**
 * 解析双语 LRC 歌词
 * 支持两种双语格式：
 * 1. 同时间戳双行（时间完全相同，前一行英文，后一行中文）
 * 2. 单行分隔符 "english / 中文" 
 */
export function parseBilingualLRC(lrcContent: string): LRCLine[] {
  const lines = lrcContent.split('\n')
  const timeTagRe = /^\[(\d{2}):(\d{2})\.(\d{2,3})\](.*)$/
  const tempMap = new Map<number, { textEn: string; textZh: string }>()

  for (const line of lines) {
    const match = line.match(timeTagRe)
    if (!match) continue

    const minutes = parseInt(match[1], 10)
    const seconds = parseInt(match[2], 10)
    const millis = parseInt(match[3].padEnd(3, '0'), 10)
    const time = minutes * 60 + seconds + millis / 1000
    const text = match[4].trim()
    if (!text) continue

    // 尝试作为分隔符格式 "English / 中文"
    const sepIdx = text.indexOf(' / ')
    if (sepIdx > -1) {
      const en = text.slice(0, sepIdx).trim()
      const zh = text.slice(sepIdx + 3).trim()
      // 覆盖重复时间戳（以后出现的为准）
      tempMap.set(time, { textEn: en, textZh: zh })
      continue
    }

    // 同时间戳双行处理
    if (tempMap.has(time)) {
      const existing = tempMap.get(time)!
      // 如果已有英文，且当前行不含分隔符，则可能是中文行
      if (!existing.textZh && text) {
        existing.textZh = text
      } else if (!existing.textEn && text) {
        existing.textEn = text
      }
    } else {
      // 第一行先当作英文
      tempMap.set(time, { textEn: text, textZh: '' })
    }
  }

  const result: LRCLine[] = []
  for (const [time, { textEn, textZh }] of tempMap) {
    result.push({ time, textEn, textZh })
  }
  // 按时间排序
  result.sort((a, b) => a.time - b.time)
  return result
}