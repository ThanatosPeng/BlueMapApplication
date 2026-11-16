import { useEffect, useRef, useState } from "react";
import {
  App as AntdApp,
  AutoComplete,
  Button,
  Dropdown,
  Empty,
  Input,
  Layout,
  Modal,
  Progress,
  Segmented,
  Select,
  Space,
  Typography,
} from "antd";
import { Canvas } from "./graph/Canvas";
import { Rail } from "./features/Rail";
import { Inspector } from "./features/Inspector";
import { ReviewDrawer } from "./features/ReviewDrawer";
import { CommandPalette } from "./features/CommandPalette";
import { ExpandModal } from "./features/ExpandModal";
import { StatsDrawer } from "./features/StatsDrawer";
import { redo, undo, useAppStore } from "./store/useAppStore";
import { levelOf, xpOf } from "./domain/mastery";
import { flushSaves } from "./store/useAppStore";
import { timelineRange } from "./domain/timeline";
import { useIsNarrow } from "./ui/useIsNarrow";
import { useHotkeys } from "react-hotkeys-hook";
import { BarChartOutlined, HistoryOutlined } from "@ant-design/icons";

const { Header, Sider, Content } = Layout;

export default function App() {
  const ready = useAppStore((s) => s.ready);
  const error = useAppStore((s) => s.error);
  const persistent = useAppStore((s) => s.persistent);
  const list = useAppStore((s) => s.list);
  const activeId = useAppStore((s) => s.activeId);
  const doc = useAppStore((s) => s.doc);
  const progress = useAppStore((s) => s.progress);
  const init = useAppStore((s) => s.init);
  const open = useAppStore((s) => s.open);
  const exportAll = useAppStore((s) => s.exportAll);
  const importAll = useAppStore((s) => s.importAll);
  const createBlueprint = useAppStore((s) => s.createBlueprint);
  const deleteBlueprint = useAppStore((s) => s.deleteBlueprint);
  const setFocusNode = useAppStore((s) => s.setFocusNode);
  const setStatsOpen = useAppStore((s) => s.setStatsOpen);
  const openTimeline = useAppStore((s) => s.openTimeline);

  const { message, modal } = AntdApp.useApp();
  // 关窗/切后台前把防抖中的保存立刻发出去，避免「改完马上关」丢最后一笔
  useEffect(() => {
    const bridge = window.bluemap;
    if (bridge?.onBeforeClose) {
      bridge.onBeforeClose(() => {
        void (async () => {
          try {
            await flushSaves();
            await bridge.store?.flush();
          } finally {
            bridge.closeReady?.();
          }
        })();
      });
      return;
    }
    const onUnload = () => {
      void flushSaves();
    };
    window.addEventListener("beforeunload", onUnload);
    return () => window.removeEventListener("beforeunload", onUnload);
  }, []);
  const narrow = useIsNarrow();
  const compact = useIsNarrow("(max-width: 1400px)");
  const fileRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [newOpen, setNewOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [draft, setDraft] = useState({ title: "", goal: "" });
  const searchRef = useRef<React.ComponentRef<typeof AutoComplete>>(null);

  useHotkeys(
    "mod+k",
    () => setPaletteOpen((open) => !open),
    { preventDefault: true },
  );
  useHotkeys("mod+z", () => undo(), { preventDefault: true });
  useHotkeys("mod+shift+z", () => redo(), { preventDefault: true });
  useHotkeys(
    "/",
    () => searchRef.current?.focus(),
    { preventDefault: true },
  );

  const booted = useRef(false);
  useEffect(() => {
    if (booted.current) return;
    booted.current = true;
    void init().then(() => {
      const params = new URLSearchParams(window.location.search);
      // 调试深链：?stats=1 直接打开复盘抽屉
      if (params.get("stats") === "1") useAppStore.setState({ statsOpen: true });
      // 调试深链：?timeline=1 打开时间轴并停在全过程的 60%
      if (params.get("timeline") === "1") {
        const { progress, openTimeline: open, setReplayAt } = useAppStore.getState();
        open();
        const range = timelineRange(progress.nodes);
        if (range) setReplayAt(range.start + (range.end - range.start) * 0.6);
      }
      // 调试深链：?expand=demo 注入一份拆解草稿，用于手工验收预览弹窗
      if (params.get("expand") === "demo") {
        useAppStore.setState({
          selectedId: "emb-rtos",
          expand: {
            nodeId: "emb-rtos",
            drafts: [
              { title: "任务创建与调度", sub: "xTaskCreate / 优先级", hours: 4 },
              { title: "队列与信号量", sub: "生产者消费者模型", hours: 4 },
              { title: "互斥锁与优先级反转", sub: "mutex / 临界区", hours: 3 },
            ],
            busy: false,
            error: null,
          },
        });
      }
    });
    // 调试深链：?palette=1 直接打开命令面板（用于截图/手工验证）
    if (new URLSearchParams(window.location.search).get("palette") === "1") {
      setPaletteOpen(true);
    }
  }, [init]);

  const xp = doc ? xpOf(doc.nodes, progress.nodes) : 0;
  const level = levelOf(xp);

  const roots = list.filter((b) => !b.parentId);
  const activeSummary = list.find((b) => b.id === activeId) ?? null;
  const rootId = activeSummary?.parentId ?? activeSummary?.id ?? null;
  const children = rootId ? list.filter((b) => b.parentId === rootId) : [];

  const handleExport = async () => {
    try {
      const text = await exportAll();
      const url = URL.createObjectURL(new Blob([text], { type: "application/json" }));
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `bluemap-${new Date().toISOString().slice(0, 10)}.json`;
      anchor.click();
      URL.revokeObjectURL(url);
      message.success("已导出（不含 AI Key）");
    } catch {
      message.error("导出失败");
    }
  };

  const handleImport = async (file: File) => {
    const result = await importAll(await file.text());
    if (result.ok) message.success("导入成功");
    else message.error(result.reason ?? "导入失败");
  };

  const handleCreate = async () => {
    const id = await createBlueprint(draft.title, draft.goal);
    if (!id) {
      message.error("创建失败：存储未就绪");
      return;
    }
    setNewOpen(false);
    setDraft({ title: "", goal: "" });
    message.success("蓝图已创建，先加几个节点吧");
  };

  const handleMenu = ({ key }: { key: string }) => {
    if (key !== "delete" || !doc) return;
    modal.confirm({
      title: `删除蓝图「${doc.title}」？`,
      content: "节点、笔记、复习记录会一起删掉，且不可撤销。",
      okText: "删除",
      okButtonProps: { danger: true },
      cancelText: "取消",
      onOk: async () => {
        await deleteBlueprint(doc.id);
        message.success("已删除");
      },
    });
  };

  const searchOptions = (doc?.nodes ?? []).map((node) => ({
    value: node.id,
    label: node.title,
  }));

  return (
    <Layout style={{ height: "100vh" }}>
      <input
        ref={fileRef}
        type="file"
        accept="application/json,.json"
        style={{ display: "none" }}
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void handleImport(file);
          event.target.value = "";
        }}
      />
      <Header
        style={{
          display: "flex",
          alignItems: "center",
          gap: narrow ? 6 : 8,
          borderBottom: "1px solid rgba(120,160,220,0.14)",
          // 顶栏内容多时只允许「蓝图 tab」横向滚动，其余控件不许被压扁/换行，
          // 更不能溢出到画布上（曾出现 Lv.3 被挤成 7px 竖条、字符跑到画布上的 bug）
          overflow: "hidden",
          zIndex: 10,
        }}
      >
        {!narrow ? (
          <Typography.Text
            strong
            style={{ fontSize: 15, letterSpacing: 0.3, flex: "none", whiteSpace: "nowrap" }}
          >
            BlueMap
          </Typography.Text>
        ) : null}

        {narrow ? (
          <Select
            size="small"
            value={activeId ?? undefined}
            onChange={(value) => void open(String(value))}
            style={{ width: 150 }}
            options={roots.flatMap((r) => [
              { value: r.id, label: r.title },
              ...children
                .filter((c) => c.parentId === r.id)
                .map((c) => ({ value: c.id, label: `└ ${c.title}` })),
            ])}
          />
        ) : (
          <>
            {/* 蓝图多了以后，只有这一块可以横向滚动，别的控件保持完整 */}
            <div className="bm-tabs">
              <Segmented
                value={rootId ?? undefined}
                onChange={(value) => void open(String(value))}
                options={roots.map((b) => ({
                  value: b.id,
                  label: `${b.title} ${b.mastered}/${b.total}`,
                }))}
              />
            </div>
            {children.length > 0 ? (
              <Select
                size="small"
                value={activeSummary?.parentId ? activeId ?? undefined : "__root__"}
                style={{ width: 128 }}
                onChange={(value) =>
                  void open(value === "__root__" ? String(rootId) : String(value))
                }
                options={[
                  { value: "__root__", label: "总览" },
                  ...children.map((c) => ({ value: c.id, label: `└ ${c.title}` })),
                ]}
              />
            ) : null}
          </>
        )}

        {!narrow ? (
          <>
            <Button size="small" onClick={() => setNewOpen(true)}>
              ＋ 蓝图
            </Button>
            <Dropdown
              trigger={["click"]}
              disabled={!doc}
              menu={{
                items: [{ key: "delete", label: "删除当前蓝图", danger: true }],
                onClick: handleMenu,
              }}
            >
              <Button size="small">⋯</Button>
            </Dropdown>
          </>
        ) : null}

        <div style={{ flex: 1 }} />

        {!narrow ? (
          <AutoComplete
            ref={searchRef}
            value={query}
            options={searchOptions}
            onSearch={setQuery}
            onSelect={(value) => {
              setFocusNode(String(value));
              setQuery("");
            }}
            style={{ width: 160 }}
            placeholder="搜索节点"
            filterOption={(input, option) =>
              String(option?.label ?? "")
                .toLowerCase()
                .includes(input.toLowerCase())
            }
          />
        ) : null}

        <Space size={8} align="center" style={{ flex: "none" }}>
          {!narrow ? (
            <>
              <Typography.Text
                strong
                style={{ color: "#fbbf24", fontSize: 12, whiteSpace: "nowrap", flex: "none" }}
              >
                Lv.{level.level}
              </Typography.Text>
              {!compact ? (
                <>
                  <Progress
                    percent={Math.round(level.pct * 100)}
                    showInfo={false}
                    size={{ width: 76, height: 5 }}
                    strokeColor={{ "0%": "#f59e0b", "100%": "#fbbf24" }}
                  />
                  <Typography.Text type="secondary" style={{ fontSize: 10.5 }}>
                    {xp} / {level.next} XP
                  </Typography.Text>
                </>
              ) : null}
            </>
          ) : null}
          <Button
            size="small"
            icon={narrow ? <BarChartOutlined /> : undefined}
            aria-label="复盘"
            onClick={() => setStatsOpen(true)}
          >
            {narrow ? null : "复盘"}
          </Button>
          <Button
            size="small"
            icon={narrow ? <HistoryOutlined /> : undefined}
            aria-label="时间轴"
            onClick={() => openTimeline()}
          >
            {narrow ? null : "时间轴"}
          </Button>
          {!narrow ? (
            <>
              <Button size="small" onClick={() => void handleExport()}>
                导出
              </Button>
              <Button size="small" onClick={() => fileRef.current?.click()}>
                导入
              </Button>
              <Button size="small" onClick={undo}>
                撤销
              </Button>
              <Button size="small" onClick={redo}>
                重做
              </Button>
            </>
          ) : null}
        </Space>
      </Header>

      {!persistent && ready ? (
        <div
          style={{
            padding: "6px 18px",
            background: "rgba(251,191,36,0.1)",
            borderBottom: "1px solid rgba(251,191,36,0.25)",
            color: "#fbbf24",
            fontSize: 11.5,
          }}
        >
          存储不可用：数据只保存在内存中，关闭后丢失。桌面端请确认数据目录可写；浏览器请关闭隐私模式或检查存储权限。
        </div>
      ) : null}

      <Layout>
        {!narrow ? (
          <Sider width={300} theme="dark" style={{ borderRight: "1px solid rgba(120,160,220,0.12)" }}>
            <Rail />
          </Sider>
        ) : null}
        <Content style={{ position: "relative", background: "#070d18" }}>
          {ready && doc ? (
            <Canvas />
          ) : !ready && !error ? (
            <div style={{ padding: 40, color: "#7d90ab", fontSize: 13 }}>正在加载蓝图…</div>
          ) : error ? (
            <div style={{ padding: 40, color: "#fda4af", fontSize: 13 }}>加载失败：{error}</div>
          ) : (
            <div style={{ paddingTop: 120 }}>
              <Empty description="还没有蓝图">
                <Button type="primary" onClick={() => setNewOpen(true)}>
                  新建第一张蓝图
                </Button>
              </Empty>
            </div>
          )}
        </Content>
      </Layout>

      <Inspector />
      <ReviewDrawer />
      <CommandPalette
        open={paletteOpen}
        onClose={() => setPaletteOpen(false)}
        onExport={() => void handleExport()}
        onNewBlueprint={() => setNewOpen(true)}
      />
      <ExpandModal />
      <StatsDrawer />

      <Modal
        open={newOpen}
        title="新建蓝图"
        okText="创建"
        cancelText="取消"
        onOk={() => void handleCreate()}
        onCancel={() => setNewOpen(false)}
      >
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 10.5, color: "#7d90ab", marginBottom: 4 }}>名称</div>
          <Input
            value={draft.title}
            placeholder="例如：嵌入式"
            onChange={(e) => setDraft({ ...draft, title: e.target.value })}
            onPressEnter={() => void handleCreate()}
          />
        </div>
        <div>
          <div style={{ fontSize: 10.5, color: "#7d90ab", marginBottom: 4 }}>目标（一句话）</div>
          <Input
            value={draft.goal}
            placeholder="例如：能独立交付一块带 RTOS 的量产级板子"
            onChange={(e) => setDraft({ ...draft, goal: e.target.value })}
            onPressEnter={() => void handleCreate()}
          />
        </div>
      </Modal>
    </Layout>
  );
}
