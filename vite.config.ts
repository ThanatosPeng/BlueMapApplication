import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  // Electron 用 file:// 加载，必须相对路径
  base: "./",
  plugins: [react()],
  build: {
    // 已按 vendor 分包；主包只留业务代码，antd / React Flow 各走独立 chunk
    chunkSizeWarningLimit: 1600,
    rollupOptions: {
      output: {
        // rolldown 只支持函数式 manualChunks
        manualChunks(id: string) {
          if (!id.includes("node_modules")) return;
          if (id.includes("node_modules/antd") || id.includes("@ant-design")) return "antd";
          if (id.includes("@xyflow") || id.includes("@dagrejs")) return "flow";
          if (id.includes("node_modules/react-dom") || id.includes("node_modules/react/")) {
            return "react";
          }
          return "vendor";
        },
      },
    },
  },
  server: {
    port: 5178,
    strictPort: true,
    proxy: {
      // DeepSeek 代理：Key 只放在本机环境变量里，不下发到浏览器
      "/api/deepseek": {
        target: "https://api.deepseek.com",
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/api\/deepseek/, ""),
      },
    },
  },
});
