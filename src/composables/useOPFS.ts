import { ref, onUnmounted } from 'vue'
import FileWorker from '../workers/file-worker.ts?worker'

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
      worker.value = new FileWorker()
      
      worker.value.onmessage = (e: MessageEvent) => {
        const { type, payload } = e.data
        const requestId = payload.requestId
        const resolveRequest = (value: any) => {
          const resolve = pending.get(requestId)
          if (resolve) {
            resolve(value)
            pending.delete(requestId)
            pendingRejects.delete(requestId)
          }
        }

        if (type === 'cache_complete' || type === 'delete_complete') {
          resolveRequest(true)
        }
        else if (type === 'file_data') {
          const buffer = payload.buffer
          if (buffer instanceof ArrayBuffer) {
            resolveRequest(buffer)
          } else if (buffer instanceof Uint8Array) {
            const ab = new ArrayBuffer(buffer.length)
            const view = new Uint8Array(ab)
            view.set(buffer)
            resolveRequest(ab)
          } else {
            console.error('Unexpected buffer type:', buffer)
            resolveRequest(buffer)
          }
        }
        else if (type === 'exists_result') {
          resolveRequest(payload.exists)
        }
        else if (type === 'list_files_result') {
          resolveRequest(payload.files)
        }
        else if (type === 'clear_cache_complete') {
          resolveRequest(payload.deletedFiles)
        }
        else if (type === 'error') {
          console.error('[useOPFS] Worker error:', payload.message)
          const reqId = payload.requestId
          const reject = pendingRejects.get(reqId)
          if (reject) {
            reject(new Error(payload.message))
            pendingRejects.delete(reqId)
          }
          const resolve = pending.get(reqId)
          if (resolve) {
            resolve(null)
            pending.delete(reqId)
          }
        }
      }

      worker.value.onerror = (err) => {
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
