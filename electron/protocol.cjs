const { net, protocol } = require("electron");
const path = require("node:path");
const { pathToFileURL } = require("node:url");

const APP_SCHEME = "app";
const APP_HOST = "bluemap";
const APP_URL = `${APP_SCHEME}://${APP_HOST}/index.html`;

/**
 * 用自定义协议加载 dist，而不是 file://。
 * 原因：file:// 是 opaque origin，Chromium 会禁用 IndexedDB/localStorage，
 * 我们的本地优先存储会直接降级成内存。
 * standard + secure 让它拥有正常的 origin，存储与 fetch 都可用。
 */
protocol.registerSchemesAsPrivileged([
  {
    scheme: APP_SCHEME,
    privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true },
  },
]);

function registerAppProtocol(distDir) {
  const root = path.resolve(distDir);

  protocol.handle(APP_SCHEME, async (request) => {
    const { pathname } = new URL(request.url);
    const relative = decodeURIComponent(pathname).replace(/^\/+/, "") || "index.html";
    const target = path.resolve(root, relative);

    // 防目录穿越
    if (target !== root && !target.startsWith(root + path.sep)) {
      return new Response("forbidden", { status: 403 });
    }

    try {
      return await net.fetch(pathToFileURL(target).toString());
    } catch {
      // 前端没有路由，但万一取不到就回 index.html
      return net.fetch(pathToFileURL(path.join(root, "index.html")).toString());
    }
  });
}

module.exports = { APP_URL, registerAppProtocol };
