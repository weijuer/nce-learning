export interface PlaybackSession {
  current: number
  next: () => number
  invalidate: () => number
  isCurrent: (generation: number) => boolean
}

export const createPlaybackSession = (): PlaybackSession => {
  let current = 0

  return {
    get current() {
      return current
    },
    next() {
      current += 1
      return current
    },
    invalidate() {
      current += 1
      return current
    },
    isCurrent(generation: number) {
      return generation === current
    }
  }
}
