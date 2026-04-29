export interface LRCLine {
  time: number // 秒
  textEn: string // 英文原文
  textZh: string // 中文翻译（可能为空）
}

export interface CachedFile {
  path: string
  buffer: ArrayBuffer
}

export interface AudioState {
  isPlaying: boolean
  currentTime: number // 当前播放时间（秒）
  duration: number // 总时长（秒）
}
