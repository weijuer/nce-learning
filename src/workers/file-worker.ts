const ctx = self as unknown as Worker;

ctx.onmessage = async (e: MessageEvent) => {
  const { type, payload } = e.data;

  try {
    if (type === "cache_file") {
      const { path, data, requestId } = payload;
      const root = await navigator.storage.getDirectory();
      const fileHandle = await root.getFileHandle(path, { create: true });
      const accessHandle = await fileHandle.createSyncAccessHandle();
      accessHandle.write(data);
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
      await root.removeEntry(path);
      ctx.postMessage({ type: "delete_complete", payload: { path, requestId } });
    }
  } catch (error: any) {
    ctx.postMessage({ type: "error", payload: { message: error.message } });
  }
};