import { expect, test, type Page } from "@playwright/test";

/**
 * 覆盖 store 单测碰不到的部分：真实点击、拖拽连线、抽屉交互、文件流。
 * 每跑一个用例都是全新的 browser context，IndexedDB 干净 → 会重新播种 4 张蓝图。
 */
const node = (page: Page, id: string) => page.locator(`.react-flow__node[data-id="${id}"]`);

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await expect(page.locator(".react-flow__node").first()).toBeVisible({ timeout: 20_000 });
});

test("启动：四张蓝图、嵌入式渲染 21 个节点", async ({ page }) => {
  await expect(page.locator(".ant-segmented-item")).toHaveCount(4);
  await expect(page.locator(".react-flow__node")).toHaveCount(21);
  await expect(page.locator(".react-flow__minimap rect")).toHaveCount(21);
});

test("点节点开抽屉，改掌握度后节点变为已掌握", async ({ page }) => {
  await node(page, "emb-c").click();

  const drawer = page.getByRole("dialog");
  await expect(drawer).toBeVisible();
  await expect(drawer.getByText("C 语言与内存")).toBeVisible();

  // 掌握度 Segmented 的第 5 个（index 4 = 迁移）
  await drawer.locator(".ant-segmented-item").nth(4).click();
  await expect(node(page, "emb-c").locator(".bm-node")).toHaveClass(/is-mastered/);

  // 抽屉里的状态标签同步变成「已掌握」
  await expect(drawer.getByText("已掌握")).toBeVisible();
});

test("新建蓝图 → 空态提示 → 加一个节点", async ({ page }) => {
  await page.getByRole("button", { name: "＋ 蓝图" }).click();
  await page.getByPlaceholder("例如：嵌入式").fill("E2E 蓝图");
  await page.getByPlaceholder(/能独立交付/).fill("跑通端到端");
  await page.getByRole("button", { name: "创建" }).click();

  await expect(page.getByText("这张蓝图还是空的")).toBeVisible();
  await page.getByRole("button", { name: "＋ 节点" }).click();
  await expect(page.locator(".react-flow__node")).toHaveCount(1);
  await expect(page.locator(".react-flow__node .bm-node__title")).toHaveText("新节点");
});

test("Ctrl+K 命令面板：搜索并执行自动布局", async ({ page }) => {
  await page.keyboard.press("Control+k");
  const input = page.getByPlaceholder("输入命令或蓝图名…");
  await expect(input).toBeVisible();

  await input.fill("自动布局");
  await page.keyboard.press("Enter");
  await expect(input).toBeHidden();
});

test("从右侧圆点拖线建立依赖", async ({ page }) => {
  await expect(page.locator(".react-flow__edge")).toHaveCount(32);

  const source = node(page, "emb-c");
  await source.hover();
  const handle = source.locator(".react-flow__handle.source");
  const from = await handle.boundingBox();

  const target = node(page, "emb-linux");
  await target.hover();
  const drop = target.locator(".react-flow__handle.target");
  const to = await drop.boundingBox();
  if (!from || !to) throw new Error("拿不到连线坐标");

  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
  await page.mouse.down();
  await page.mouse.move(to.x + to.width / 2, to.y + to.height / 2, { steps: 15 });
  await page.mouse.up();

  // 连上后边数 +1（比依赖 toast 更稳）
  await expect(page.locator(".react-flow__edge")).toHaveCount(33);
});

test("时间轴回放：拖到末尾点亮数增加", async ({ page }) => {
  await page.getByRole("button", { name: "时间轴" }).click();
  const bar = page.locator(".bm-timeline");
  await expect(bar).toBeVisible();
  // 起点只有第一个点亮事件
  await expect(bar).toContainText("已点亮 1");

  const slider = bar.locator(".ant-slider");
  const box = await slider.boundingBox();
  if (!box) throw new Error("拿不到滑块坐标");
  await page.mouse.click(box.x + box.width - 2, box.y + box.height / 2);

  await expect(bar).toContainText("已点亮 2");
});

test.describe("移动端只读", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("窄屏：无横向溢出、无编辑入口、仍能看节点", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator(".react-flow__node").first()).toBeVisible({ timeout: 20_000 });

    // 布局不横向溢出
    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    expect(scrollWidth).toBeLessThanOrEqual(390);

    // 编辑入口全部消失
    await expect(page.getByRole("button", { name: "＋ 节点" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "自动布局" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "＋ 蓝图" })).toHaveCount(0);
    await expect(page.locator(".ant-segmented")).toHaveCount(0);

    // 节点不可拖（React Flow 会给可拖拽节点加 draggable 类）
    await expect(page.locator(".react-flow__node.draggable")).toHaveCount(0);

    // 抽屉占满宽度，且标题不可编辑
    await page.locator('.react-flow__node[data-id="emb-c"]').click();
    const drawer = page.getByRole("dialog");
    await expect(drawer).toBeVisible();
    const box = await drawer.boundingBox();
    expect(Math.round(box?.width ?? 0)).toBeGreaterThanOrEqual(380);
    await expect(drawer.locator(".ant-typography-edit")).toHaveCount(0);

    await page.waitForTimeout(400);
    const metrics = await page.evaluate(() => {
      const body = document.querySelector(".ant-drawer-body") as HTMLElement | null;
      const wrap = document.querySelector(".ant-drawer-content-wrapper") as HTMLElement | null;
      const desc = Array.from(document.querySelectorAll(".ant-drawer-body div")).find((d) =>
        d.textContent?.startsWith("任务优先级"),
      ) as HTMLElement | null;
      return {
        inner: window.innerWidth,
        wrapper: wrap?.getBoundingClientRect().width,
        body: body?.getBoundingClientRect().width,
        bodyScroll: body?.scrollWidth,
        bodyPad: body ? getComputedStyle(body).padding : null,
        descWidth: desc?.getBoundingClientRect().width,
        descScroll: desc?.scrollWidth,
      };
    });
    expect(Math.round(metrics.wrapper ?? 0)).toBeLessThanOrEqual(390);
    expect(metrics.bodyScroll).toBeLessThanOrEqual(Math.round(metrics.body ?? 0) + 1);
  });
});

test("跨蓝图关联：建立后能在两个蓝图间跳转", async ({ page }) => {
  await node(page, "emb-c").click();
  const drawer = page.locator(".ant-drawer").first();
  await expect(drawer).toBeVisible();

  await drawer.getByRole("button", { name: "关联到其他蓝图" }).click();
  const modal = page.locator(".ant-modal").last();
  await expect(modal).toBeVisible();

  await modal.locator(".ant-select").first().click();
  await page.getByTitle("前端 React").last().click();
  await modal.locator(".ant-select").nth(1).click();
  await page.getByTitle("React 核心").last().click();
  await modal.getByRole("button", { name: "建立关联" }).click();

  await expect(modal).toBeHidden();
  await expect(drawer.getByText(/→ 前端 React · React 核心/)).toBeVisible();
  // 画布上出现跨蓝图角标
  await expect(node(page, "emb-c").locator(".bm-node__meta")).toContainText("⇄1");

  // 点关联跳到 React 蓝图的那个节点
  await drawer.getByText(/→ 前端 React · React 核心/).click();
  await expect(drawer.getByText("React 核心").first()).toBeVisible();
});

test("AI 拆解：生成子蓝图并关联回父节点", async ({ page }) => {
  await page.goto("/?bp=emb&expand=demo");

  const modal = page.locator(".ant-modal").last();
  await expect(modal).toBeVisible({ timeout: 20_000 });
  await modal.getByRole("button", { name: /采纳 3 个/ }).click();
  await expect(modal).toBeHidden();

  // 自动切到子蓝图：3 个子节点 + 顶部合成的父节点 = 4
  await expect(page.locator(".react-flow__node")).toHaveCount(4);

  // 父蓝图的 tab 仍选中，旁边出现子蓝图下拉
  await expect(
    page.locator(".ant-segmented-item-selected", { hasText: "嵌入式" }),
  ).toBeVisible();
  await expect(page.getByText(/└ FreeRTOS 任务与同步/)).toBeVisible();

  // 子蓝图顶部合成一个「父蓝图节点」，标记来源
  const parentRef = page.locator('.react-flow__node[data-id="__parent__"]');
  await expect(parentRef).toBeVisible();
  await expect(parentRef).toContainText("父蓝图");
  await expect(parentRef).toContainText("FreeRTOS 任务与同步");

  // 点它直接回父蓝图，并打开该父节点的详情
  // 先把子图 3 个节点全部点亮（掌握度 4）
  const childIds = await page
    .locator(".react-flow__node")
    .evaluateAll((nodes) =>
      nodes.map((n) => n.getAttribute("data-id")).filter((id) => id && id !== "__parent__"),
    );
  expect(childIds).toHaveLength(3);

  for (const id of childIds) {
    await page.locator(`.react-flow__node[data-id="${id}"]`).click();
    await page.locator(".ant-drawer .ant-segmented-item").nth(4).click();
    await page.keyboard.press("Escape");
  }

  // 回父蓝图：容器节点应显示 3/3 并自动点亮
  await parentRef.click();
  const drawer = page.locator(".ant-drawer").first();
  await expect(drawer).toContainText("FreeRTOS 任务与同步");
  await expect(drawer).toContainText("3/3 完成");
  await expect(drawer).toContainText("掌握度由子蓝图自动结算");
  // 容器节点不再显示掌握度与证据
  await expect(drawer.getByText("掌握度", { exact: true })).toHaveCount(0);
  await expect(drawer.getByText("证据", { exact: true })).toHaveCount(0);
  await expect(drawer.getByText("AI 问答", { exact: true })).toHaveCount(0);

  const card = page.locator('.react-flow__node[data-id="emb-rtos"] .bm-node');
  await expect(card).toHaveClass(/is-mastered/);
  await expect(card).toContainText("子蓝图 · 3/3 完成");

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
  await page.keyboard.press("Escape");
  await page.waitForTimeout(400);
  await page.screenshot({ path: "docs/shot-child-node.png" });
});

test("抽屉里删除节点，依赖一并断开", async ({ page }) => {
  await expect(page.locator(".react-flow__node")).toHaveCount(21);
  await node(page, "emb-gpio").click();

  const drawer = page.locator(".ant-drawer").first();
  await drawer.getByRole("button", { name: "删除节点" }).click();

  const pop = page.locator(".ant-popconfirm");
  await expect(pop).toBeVisible();
  await pop.getByRole("button", { name: "删除" }).click();

  await expect(page.locator(".react-flow__node")).toHaveCount(20);
  // antd 抽屉关闭后容器仍留在 DOM，所以断言内容消失而不是元素隐藏
  await expect(page.locator(".ant-drawer").getByText("GPIO 与中断")).toHaveCount(0);
});

test("重新打开应用后，容器节点仍按子蓝图显示（回归）", async ({ page }) => {
  // 先造一张子蓝图，产生 blueprint 级关联
  await page.goto("/?bp=emb&expand=demo");
  const modal = page.locator(".ant-modal").last();
  await expect(modal).toBeVisible({ timeout: 20_000 });
  await modal.getByRole("button", { name: /采纳 3 个/ }).click();
  await expect(modal).toBeHidden();

  // 重新加载应用（模拟"关闭后重新打开"，数据来自存储）
  await page.goto("/?bp=emb");
  await expect(page.locator(".react-flow__node").first()).toBeVisible({ timeout: 20_000 });

  await page.locator('.react-flow__node[data-id="emb-rtos"]').click();
  const drawer = page.locator(".ant-drawer").first();
  await expect(drawer).toContainText("容器节点");
  await expect(drawer).toContainText("0/3 完成");
  // 关键断言：重开后也不该出现掌握度与证据
  await expect(drawer.getByText("掌握度", { exact: true })).toHaveCount(0);
  await expect(drawer.getByText("证据", { exact: true })).toHaveCount(0);

  // 画布卡片也是容器形态
  await expect(
    page.locator('.react-flow__node[data-id="emb-rtos"] .bm-node'),
  ).toContainText("子蓝图 · 0/3 完成");
});
test("普通节点：证据勾选已被 AI 两层判断取代", async ({ page }) => {
  await node(page, "emb-gpio").click();
  const drawer = page.locator(".ant-drawer").first();
  await expect(drawer.getByText("掌握度", { exact: true })).toBeVisible();
  // 旧的四项勾选整段消失
  await expect(drawer.getByText("证据", { exact: true })).toHaveCount(0);
  await expect(drawer.getByText("自评", { exact: true })).toHaveCount(0);
  await expect(drawer.getByText("测验", { exact: true })).toHaveCount(0);
  // 换成两个入口
  await expect(drawer.getByRole("button", { name: "AI 问答" })).toBeVisible();
  await expect(drawer.getByRole("button", { name: "关联作品 / 仓库" })).toBeVisible();
});
test("窄窗口下顶栏不会把控件挤成竖排（回归）", async ({ page }) => {
  await page.setViewportSize({ width: 1000, height: 800 });
  await page.goto("/");
  await expect(page.locator(".react-flow__node").first()).toBeVisible({ timeout: 20_000 });

  // 以前这里会把 Lv / 按钮压成 1px 宽的竖条，文字溢出到画布上
  const tallest = await page.evaluate(() =>
    Math.max(
      ...[...document.querySelectorAll("header *")].map(
        (el) => el.getBoundingClientRect().height,
      ),
    ),
  );
  expect(tallest).toBeLessThanOrEqual(62);

  const overflow = await page.evaluate(
    () => getComputedStyle(document.querySelector("header") as HTMLElement).overflow,
  );
  expect(overflow).toBe("hidden");

  // 蓝图 tab 自己滚动，而不是挤别的控件
  const scrolls = await page.evaluate(() => {
    const tabs = document.querySelector(".bm-tabs");
    return tabs ? tabs.scrollWidth > tabs.clientWidth : false;
  });
  expect(scrolls).toBe(true);
});
test("撤销恢复掌握度修改", async ({ page }) => {
  await node(page, "emb-gpio").click();
  const drawer = page.getByRole("dialog");
  // index 0 = 未知 → 回到 available
  await drawer.locator(".ant-segmented-item").first().click();
  await expect(node(page, "emb-gpio").locator(".bm-node")).toHaveClass(/is-available/);

  // 抽屉带遮罩会挡住画布；先 Esc 关掉
  await page.keyboard.press("Escape");
  await expect(drawer).toBeHidden();

  // 快捷键撤销 → 恢复已掌握
  await page.keyboard.press("Control+z");
  await expect(node(page, "emb-gpio").locator(".bm-node")).toHaveClass(/is-mastered/);

  // 顶栏按钮重做 → 回到 available
  await page.getByRole("button", { name: "重做" }).click();
  await expect(node(page, "emb-gpio").locator(".bm-node")).toHaveClass(/is-available/);
});
