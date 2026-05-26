const ctx = self as unknown as Worker;

interface FileInfo {
  name: string;
  size: number;
  lastAccessed: number;
}

ctx.onmessage = async (e: MessageEvent) => {
  const { type, payload } = e.data;

  try {
    if (type === "cache_file") {
      const { path, data, requestId } = payload;
      const root = await navigator.storage.getDirectory();
      const fileHandle = await root.getFileHandle(path, { create: true });
      const accessHandle = await fileHandle.createSyncAccessHandle();
      accessHandle.truncate(0);
      accessHandle.write(data);
      accessHandle.truncate(data.byteLength);
      accessHandle.flush();
      accessHandle.close();
      ctx.postMessage({ type: "cache_complete", payload: { path, requestId } });
    } else if (type === "read_file") {
      const { path, requestId } = payload;
      const root = await navigator.storage.getDirectory();
      const fileHandle = await root.getFileHandle(path);
      const file = await fileHandle.getFile();
      const buffer = await file.arrayBuffer();
      ctx.postMessage({ type: "file_data", payload: { path, buffer, requestId } });
    } else if (type === "check_exists") {
      const { path, requestId } = payload;
      const root = await navigator.storage.getDirectory();
      let exists = false;
      try {
        await root.getFileHandle(path);
        exists = true;
      } catch {
        /* 文件不存在 */
      }
      ctx.postMessage({ type: "exists_result", payload: { path, exists, requestId } });
    } else if (type === "delete_file") {
      const { path, requestId } = payload;
      const root = await navigator.storage.getDirectory();
      try {
        await root.removeEntry(path);
      } catch {
        /* 文件不存在，忽略错误 */
      }
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
            await root.removeEntry(name);
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
