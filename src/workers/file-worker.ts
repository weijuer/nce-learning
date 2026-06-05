const ctx = self as unknown as Worker;

interface FileInfo {
  name: string;
  size: number;
  lastAccessed: number;
}

// 操作队列 - 确保文件操作串行执行
const operationQueue: Array<() => Promise<void>> = [];
let isProcessing = false;
const activeOperations = new Set<string>(); // 跟踪正在进行的文件操作

/**
 * 处理操作队列
 */
async function processQueue() {
  if (isProcessing || operationQueue.length === 0) return;
  
  isProcessing = true;
  while (operationQueue.length > 0) {
    const operation = operationQueue.shift();
    try {
      await operation?.();
    } catch (error) {
      console.error('[FileWorker] Operation failed:', error);
    }
  }
  isProcessing = false;
}

/**
 * 将文件操作加入队列
 * @param filePath 文件路径，用于冲突检测
 * @param operation 实际的文件操作
 */
async function enqueueOperation(filePath: string, operation: () => Promise<void>): Promise<void> {
  return new Promise((resolve, reject) => {
    operationQueue.push(async () => {
      // 等待同一文件的前一个操作完成
      while (activeOperations.has(filePath)) {
        await new Promise(r => setTimeout(r, 50));
      }
      
      activeOperations.add(filePath);
      try {
        await operation();
        resolve();
      } catch (error) {
        // 如果是 Access Handle 冲突，重试一次
        if (error instanceof DOMException && error.message.includes('Access Handles')) {
          console.warn('[FileWorker] Access handle conflict detected, retrying...');
          await new Promise(r => setTimeout(r, 100));
          try {
            await operation();
            resolve();
          } catch (retryError) {
            console.error('[FileWorker] Retry failed:', retryError);
            reject(retryError);
          }
        } else {
          reject(error);
        }
      } finally {
        activeOperations.delete(filePath);
      }
    });
    processQueue();
  });
}

ctx.onmessage = async (e: MessageEvent) => {
  const { type, payload } = e.data;

  try {
    if (type === "cache_file") {
      const { path, data, requestId } = payload;
      await enqueueOperation(path, async () => {
        const root = await navigator.storage.getDirectory();
        const fileHandle = await root.getFileHandle(path, { create: true });
        const accessHandle = await fileHandle.createSyncAccessHandle();
        try {
          accessHandle.truncate(0);
          accessHandle.write(data);
          accessHandle.truncate(data.byteLength);
          accessHandle.flush();
        } finally {
          accessHandle.close();
        }
      });
      ctx.postMessage({ type: "cache_complete", payload: { path, requestId } });
    } else if (type === "read_file") {
      const { path, requestId } = payload;
      await enqueueOperation(path, async () => {
        const root = await navigator.storage.getDirectory();
        const fileHandle = await root.getFileHandle(path);
        const file = await fileHandle.getFile();
        const buffer = await file.arrayBuffer();
        ctx.postMessage({ type: "file_data", payload: { path, buffer, requestId } });
      });
    } else if (type === "check_exists") {
      const { path, requestId } = payload;
      let exists = false;
      try {
        const root = await navigator.storage.getDirectory();
        await root.getFileHandle(path);
        exists = true;
      } catch {
        /* 文件不存在 */
      }
      ctx.postMessage({ type: "exists_result", payload: { path, exists, requestId } });
    } else if (type === "delete_file") {
      const { path, requestId } = payload;
      await enqueueOperation(path, async () => {
        const root = await navigator.storage.getDirectory();
        try {
          await root.removeEntry(path);
        } catch {
          /* 文件不存在，忽略错误 */
        }
      });
      ctx.postMessage({ type: "delete_complete", payload: { path, requestId } });
    } else if (type === "list_files") {
      const { requestId } = payload;
      const root = await navigator.storage.getDirectory();
      const files: FileInfo[] = [];
      for await (const [name, handle] of root.entries()) {
        if (handle.kind === "file") {
          const file = await handle.getFile();
          files.push({
            name,
            size: file.size,
            lastAccessed: file.lastModified
          });
        }
      }
      ctx.postMessage({ type: "list_files_result", payload: { files, requestId } });
    } else if (type === "clear_cache") {
      const { requestId } = payload;
      const root = await navigator.storage.getDirectory();
      const deletedFiles: string[] = [];
      for await (const [name, handle] of root.entries()) {
        if (handle.kind === "file") {
          try {
            await enqueueOperation(name, async () => {
              await root.removeEntry(name);
            });
            deletedFiles.push(name);
          } catch {
            /* 删除失败，继续处理其他文件 */
          }
        }
      }
      ctx.postMessage({ type: "clear_cache_complete", payload: { deletedFiles, requestId } });
    }
  } catch (error: any) {
    ctx.postMessage({ type: "error", payload: { message: error.message, requestId: payload?.requestId } });
  }
};
