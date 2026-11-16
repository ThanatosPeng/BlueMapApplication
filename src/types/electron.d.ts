export {};

export interface StoreBridge {
  load: () => Promise<unknown>;
  write: (
    kind: "blueprint" | "progress" | "setting" | "link",
    id: string,
    value: unknown,
  ) => Promise<{ ok: boolean; reason?: string }>;
  flush: () => Promise<{ ok: boolean }>;
  info?: () => Promise<{
    file: string;
    writes: number;
    lastWriteAt: number | null;
    lastError: string | null;
    loaded?: { exists: boolean; bytes: number; error: string | null };
    autoSave?: { intervalMs: number; lastAt: number | null; count: number };
  }>;
}

declare global {
  interface Window {
    /** Electron 预加载脚本注入；浏览器里为 undefined */
    bluemap?: {
      platform: string;
      aiRequest: (payload: {
        url: string;
        headers?: Record<string, string>;
        body?: string;
      }) => Promise<{ ok: boolean; status: number; text: string }>;
      store?: StoreBridge;
      /** 窗口即将关闭，回调里把待写数据 flush 掉 */
      onBeforeClose?: (cb: () => void) => void;
      closeReady?: () => void;
    };
  }
}
