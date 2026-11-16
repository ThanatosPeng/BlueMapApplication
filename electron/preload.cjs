const { contextBridge, ipcRenderer } = require("electron");

/**
 * 只暴露一个极小的桥：
 * - platform：UI 可以据此隐藏"浏览器专属"的提示；
 * - aiRequest：AI 请求交给主进程发，绕开 CORS 与 Vite 代理；
 * - store：本地 JSON 仓库（主进程持有内存副本并落盘）。
 * 不暴露 ipcRenderer 本身，也不开 nodeIntegration。
 */
contextBridge.exposeInMainWorld("bluemap", {
  platform: process.platform,
  aiRequest: (payload) => ipcRenderer.invoke("ai:request", payload),
  store: {
    load: () => ipcRenderer.invoke("store:load"),
    write: (kind, id, value) => ipcRenderer.invoke("store:write", kind, id, value),
    flush: () => ipcRenderer.invoke("store:flush"),
    info: () => ipcRenderer.invoke("store:info"),
  },
  /** 窗口即将关闭：给渲染进程一个把待写数据发出去的机会 */
  onBeforeClose: (cb) => {
    ipcRenderer.on("app:before-close", () => cb());
  },
  closeReady: () => ipcRenderer.send("app:close-ready"),
});
