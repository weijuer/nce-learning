import { ref, onUnmounted } from 'vue'

export interface CachedFileInfo {
  name: string
  size: number
  lastAccessed: number
}

export function useOPFS() {
  const worker = ref<Worker | null>(null)
  const pending = new Map<string, (value: any) => void>()
  const pendingRejects = new Map<string, (error: Error) => void>()
  let requestId = 0

  function generateId(): string {
    return `req_${++requestId}_${Date.now()}`
  }

  function getWorker(): Worker {
    if (!worker.value) {
      const workerUrl = new URL('../workers/file-worker.ts', import.meta.url)
      worker.value = new Worker(workerUrl, { type: 'module' })
      
      const currentWorker = worker.value
      currentWorker.onmessage = (e: MessageEvent) => {
        const { type, payload } = e.data
        const requestId = payload.requestId
        if (type === 'cache_complete' || type === 'delete_complete') {
          const resolve = pending.get(requestId)
          if (resolve) {
            resolve(true)
            pending.delete(requestId)
          }
        }
        else if (type === 'file_data') {
          const resolve = pending.get(requestId)
          if (resolve) {
            const buffer = payload.buffer
            if (buffer instanceof ArrayBuffer) {
              resolve(buffer)
            } else if (buffer instanceof Uint8Array) {
              const ab = new ArrayBuffer(buffer.length)
              const view = new Uint8Array(ab)
              view.set(buffer)
              resolve(ab)
            } else {
              console.error('Unexpected buffer type:', buffer)
              resolve(buffer)
            }
            pending.delete(requestId)
          }
        }
        else if (type === 'exists_result') {
          const resolve = pending.get(requestId)
          if (resolve) {
            resolve(payload.exists)
            pending.delete(requestId)
          }
        }
        else if (type === 'list_files_result') {
          const resolve = pending.get(requestId)
          if (resolve) {
            resolve(payload.files)
            pending.delete(requestId)
          }
        }
        else if (type === 'clear_cache_complete') {
          const resolve = pending.get(requestId)
          if (resolve) {
            resolve(payload.deletedFiles)
            pending.delete(requestId)
          }
        }
        else if (type === 'error') {
          console.error('[useOPFS] Worker error:', payload.message)
          const reqId = payload.requestId
          const reject = pendingRejects.get(reqId)
          if (reject) {
            reject(new Error(payload.message))
            pendingRejects.delete(reqId)
          }
          // 也尝试调用 resolve 以防 reject 不存在
          const resolve = pending.get(reqId)
          if (resolve) {
            resolve(null)
            pending.delete(reqId)
          }
        }
      }

      currentWorker.onerror = (err) => {
        console.error('[useOPFS] Worker error:', err)
      }
    }
    return worker.value as Worker
  }

  function sendRequest(type: string, payload: any): Promise<any> {
    return new Promise((resolve, reject) => {
      const w = getWorker()
      const id = generateId()
      pending.set(id, resolve)
      pendingRejects.set(id, reject)
      const requestPayload = { ...payload, requestId: id }
      
      w.onerror = (err) => {
        reject(err)
        pending.delete(id)
        pendingRejects.delete(id)
      }
      
      if (type === 'cache_file') {
        w.postMessage({ type, payload: requestPayload }, [requestPayload.data])
      } else {
        w.postMessage({ type, payload: requestPayload })
      }
    })
  }

  async function cacheFile(path: string, data: ArrayBuffer) {
    await sendRequest('cache_file', { path, data })
  }

  async function readFile(path: string): Promise<ArrayBuffer> {
    return sendRequest('read_file', { path })
  }

  async function fileExists(path: string): Promise<boolean> {
    return sendRequest('check_exists', { path })
  }

  async function deleteFile(path: string) {
    await sendRequest('delete_file', { path })
  }

  async function listFiles(): Promise<CachedFileInfo[]> {
    return sendRequest('list_files', {})
  }

  async function clearCache(): Promise<string[]> {
    return sendRequest('clear_cache', {})
  }

  onUnmounted(() => {
    worker.value?.terminate()
    pending.clear()
    pendingRejects.clear()
  })

  return { cacheFile, readFile, fileExists, deleteFile, listFiles, clearCache }
}