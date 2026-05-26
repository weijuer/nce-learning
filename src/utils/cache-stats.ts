export interface CachedFileInfo {
  name: string
  size: number
  lastAccessed: number
}

export interface CacheSummary {
  usedSize: number
  maxSize: number
  fileCount: number
  files: CachedFileInfo[]
}

export const isCommittedCacheFile = (file: CachedFileInfo) => {
  return !file.name.endsWith('.partial') && file.size > 0
}

export const summarizeCacheFiles = (files: CachedFileInfo[], maxSize: number): CacheSummary => {
  const committedFiles = files
    .filter(isCommittedCacheFile)
    .sort((a, b) => b.lastAccessed - a.lastAccessed || a.name.localeCompare(b.name))

  return {
    usedSize: committedFiles.reduce((total, file) => total + file.size, 0),
    maxSize,
    fileCount: committedFiles.length,
    files: committedFiles
  }
}
