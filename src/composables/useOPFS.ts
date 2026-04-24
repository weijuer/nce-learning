import { ref, onUnmounted } from 'vue'
import FileWorker from '../workers/file-worker?worker'

export function useOPFS() {
  const worker = ref<Worker | null>(null)
  // 保存回调 resolver 的 map，用于处理多次请求
  const pending = new Map<string, (value: any) => void>()

  function getWorker(): Worker {
    if (!worker.value) {
      worker.value = new FileWorker()
      worker.value.onmessage = (e: MessageEvent) => {
        const { type, payload } = e.data
        if (type === 'cache_complete' || type === 'delete_complete') {
          const resolve = pending.get(payload.path)
          if (resolve) {
            resolve(true)
            pending.delete(payload.path)
          }
        }
        else if (type === 'file_data') {
          const resolve = pending.get(payload.path)
          if (resolve) {
            resolve(payload.buffer)
            pending.delete(payload.path)
          }
        }
        else if (type === 'exists_result') {
          const resolve = pending.get(payload.path)
          if (resolve) {
            resolve(payload.exists)
            pending.delete(payload.path)
          }
        }
        else if (type === 'error') {
          // 转发所有挂起请求的错误，简单处理
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
      const path = payload.path
      pending.set(path, resolve)
      // 简单错误处理，如果 worker 报错会触发 error 事件
      w.onerror = (err) => {
        reject(err)
        pending.delete(path)
      }
      if (type === 'cache_file') {
        // 传递 ArrayBuffer 需要可转移对象
        w.postMessage({ type, payload }, [payload.data])
      } else {
        w.postMessage({ type, payload })
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