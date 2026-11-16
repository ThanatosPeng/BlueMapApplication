import { Command } from "cmdk";
import { Modal } from "antd";
import { App as AntdApp } from "antd";
import { redo, undo, useAppStore } from "../store/useAppStore";

interface Props {
  open: boolean;
  onClose: () => void;
  onExport: () => void;
  onNewBlueprint: () => void;
}

/**
 * Ctrl+K 命令面板。cmdk 只负责键盘/筛选/分组，弹层用 antd Modal，
 * 样式靠 index.css 里的 [cmdk-*] 选择器。
 */
export function CommandPalette({ open, onClose, onExport, onNewBlueprint }: Props) {
  const list = useAppStore((s) => s.list);
  const activeId = useAppStore((s) => s.activeId);
  const doc = useAppStore((s) => s.doc);
  const openBlueprint = useAppStore((s) => s.open);
  const relayout = useAppStore((s) => s.relayout);
  const addNodeFree = useAppStore((s) => s.addNodeFree);
  const setReviewOpen = useAppStore((s) => s.setReviewOpen);
  const setStatsOpen = useAppStore((s) => s.setStatsOpen);
  const openTimeline = useAppStore((s) => s.openTimeline);
  const storageLabel = useAppStore((s) => s.storageLabel);
  const storagePath = useAppStore((s) => s.storagePath);
  const savedAt = useAppStore((s) => s.savedAt);
  const { modal } = AntdApp.useApp();

  const showStorageInfo = async () => {
    const info = await window.bluemap?.store?.info?.().catch(() => null);
    modal.info({
      title: "存储诊断",
      width: 520,
      content: (
        <div style={{ fontSize: 12, lineHeight: 1.9 }}>
          <div>存储方式：{storageLabel}</div>
          <div style={{ wordBreak: "break-all" }}>数据文件：{info?.file ?? storagePath ?? "（浏览器存储，无文件）"}</div>
          <div>写入次数：{info?.writes ?? 0}</div>
          <div>
            启动时文件：
            {info?.loaded
              ? info.loaded.exists
                ? `存在（${info.loaded.bytes} 字节）`
                : "不存在（首次启动）"
              : "—"}
          </div>
          <div>
            最近落盘：
            {info?.lastWriteAt ? new Date(info.lastWriteAt).toLocaleString("zh-CN", { hour12: false }) : "还没写过"}
          </div>
          <div>最近保存：{savedAt ? new Date(savedAt).toLocaleString("zh-CN", { hour12: false }) : "—"}</div>
          <div>
            自动保存：每 {Math.round((info?.autoSave?.intervalMs ?? 10000) / 1000)} 秒
            {info?.autoSave?.lastAt
              ? `，最近 ${new Date(info.autoSave.lastAt).toLocaleTimeString("zh-CN", { hour12: false })}（共 ${info.autoSave.count} 次）`
              : "，还没触发"}
          </div>
          {info?.lastError ? <div style={{ color: "#fda4af" }}>写入错误：{info.lastError}</div> : null}
          {info?.loaded?.error ? (
            <div style={{ color: "#fda4af" }}>读取错误：{info.loaded.error}</div>
          ) : null}
        </div>
      ),
    });
  };
  const setFocusNode = useAppStore((s) => s.setFocusNode);

  const run = (action: () => void) => () => {
    action();
    onClose();
  };

  return (
    <Modal
      open={open}
      onCancel={onClose}
      footer={null}
      closable={false}
      width={560}
      styles={{ body: { padding: 0 } }}
      destroyOnHidden
    >
      <Command label="命令面板" className="bm-cmd" loop>
        <Command.Input placeholder="输入命令或蓝图名…" className="bm-cmd__input" autoFocus />
        <Command.List className="bm-cmd__list">
          <Command.Empty className="bm-cmd__empty">没有匹配的命令</Command.Empty>

          <Command.Group heading="蓝图" className="bm-cmd__group">
            {list.map((bp) => (
              <Command.Item
                key={bp.id}
                value={`切换 ${bp.title}`}
                onSelect={run(() => void openBlueprint(bp.id))}
                className="bm-cmd__item"
              >
                切换到 {bp.title}
                <span className="bm-cmd__hint">
                  {bp.id === activeId ? "当前" : `${bp.mastered}/${bp.total}`}
                </span>
              </Command.Item>
            ))}
          </Command.Group>

          <Command.Group heading="操作" className="bm-cmd__group">
            <Command.Item value="新建节点" onSelect={run(addNodeFree)} className="bm-cmd__item">
              新建节点
              <span className="bm-cmd__hint">当前蓝图末尾</span>
            </Command.Item>
            <Command.Item value="自动布局" onSelect={run(relayout)} className="bm-cmd__item">
              自动布局
              <span className="bm-cmd__hint">dagre 重排</span>
            </Command.Item>
            <Command.Item value="新建蓝图" onSelect={run(onNewBlueprint)} className="bm-cmd__item">
              新建蓝图
            </Command.Item>
            <Command.Item
              value="存储诊断"
              onSelect={run(() => void showStorageInfo())}
              className="bm-cmd__item"
            >
              存储诊断
              <span className="bm-cmd__hint">数据到底写到哪了</span>
            </Command.Item>
            <Command.Item value="导出 JSON" onSelect={run(onExport)} className="bm-cmd__item">
              导出 JSON
              <span className="bm-cmd__hint">不含 AI Key</span>
            </Command.Item>
            <Command.Item
              value="打开复习"
              onSelect={run(() => setReviewOpen(true))}
              className="bm-cmd__item"
            >
              打开复习
            </Command.Item>
            <Command.Item
              value="复盘统计"
              onSelect={run(() => setStatsOpen(true))}
              className="bm-cmd__item"
            >
              复盘统计
              <span className="bm-cmd__hint">掌握度 / 工时 / 瓶颈</span>
            </Command.Item>
            <Command.Item
              value="时间轴回放"
              onSelect={run(() => openTimeline())}
              className="bm-cmd__item"
            >
              时间轴回放
              <span className="bm-cmd__hint">重放点亮过程</span>
            </Command.Item>
            <Command.Item value="撤销" onSelect={run(undo)} className="bm-cmd__item">
              撤销
              <span className="bm-cmd__hint">Ctrl+Z</span>
            </Command.Item>
            <Command.Item value="重做" onSelect={run(redo)} className="bm-cmd__item">
              重做
              <span className="bm-cmd__hint">Ctrl+Shift+Z</span>
            </Command.Item>
          </Command.Group>

          <Command.Group heading="节点" className="bm-cmd__group">
            {(doc?.nodes ?? []).slice(0, 40).map((node) => (
              <Command.Item
                key={node.id}
                value={`定位 ${node.title}`}
                onSelect={run(() => setFocusNode(node.id))}
                className="bm-cmd__item"
              >
                定位到 {node.title}
              </Command.Item>
            ))}
          </Command.Group>
        </Command.List>
      </Command>
    </Modal>
  );
}
