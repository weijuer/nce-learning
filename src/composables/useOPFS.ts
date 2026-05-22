import { ref, onUnmounted } from 'vue'
import FileWorker from '../workers/file-worker?worker'

export function useOPFS() {
  const worker = ref<Worker | null>(null)
  const pending = new Map<string, (value: any) => void>()
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
        else if (type === 'error') {
          for (const [, reject] of pending) {
            reject(new Error(payload.message))
          }
          pending.clear()
        }
      }
    }
    return worker.value
  }

  function sendRequest(type: string, payload: any): Promise<any> {
    return new Promise((resolve, reject) => {
      const w = getWorker()
      const id = generateId()
      pending.set(id, resolve)
      const requestPayload = { ...payload, requestId: id }
      
      w.onerror = (err) => {
        reject(err)
        pending.delete(id)
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

  onUnmounted(() => {
    worker.value?.terminate()
    pending.clear()
  })

  return { cacheFile, readFile, fileExists, deleteFile }
}