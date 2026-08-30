# Kimi 前端审阅与美化 TODO 清单

> 审阅人：Kimi
> 审阅对象：`worktrees/99-final-acceptance` 分支 + 线上实例 `http://127.0.0.1:3188/`
> 审阅方式：源码逐文件精读（`src/client/**`，约 2 600 行）+ 线上页面抓取 + 现有参考截图目检 + 后端关键路径实测校验
> 定位：**前端为主，后端顺带**。目标是让 DSH-Rosalind 的前端"抓人眼球、非常漂亮"，同时先修掉影响体验的确定性缺陷。

---

## 0. 现状评价（一句话版）

现有前端工程素养不错：CSS 变量 + `color-mix()` 主题、container query 响应式、roving-tabindex 键盘导航、`prefers-reduced-motion` 处理都已就位。但**视觉气质偏"朴素工具"而非"科学工作台"**：

- 首屏目录页是白底 + 米色卡片的平铺列表，无视觉焦点、无层次节奏、无动效；
- 详情弹窗信息密度高但排版扁平，缺少数据可视化（证据、指标、provenance 全是文字列表）；
- 科学查看器（序列/结构/切片）是功能性的 canvas，缺少现代工具应有的状态反馈与微交互；
- 存在若干确定性 bug（wheel 事件穿透、注册泄漏、对比度不足、数据不一致），会直接影响"漂亮"的观感。

本清单按 **P0（必修缺陷）→ P1（视觉升级）→ P2（交互逻辑）→ P3（可访问性与响应式）→ P4（后端顺带）→ 实施路线** 组织。每条均给出文件位置、问题、实现建议。

---

## P0 — 必修缺陷（不做完美化也要先修）

### P0-1 canvas 滚轮缩放穿透页面滚动 【高】

- 位置：`src/client/viewers/structure/canvas.tsx:69`、`src/client/science-viewers.tsx:435`、`src/client/science-viewers.tsx:560`
- 问题：三处都用 React 的 `onWheel` + `event.preventDefault()`。React 17+ 把 `onWheel` 注册为**被动监听器**，`preventDefault()` 是空操作——用户在结构/切片查看器上滚轮缩放时，整个宿主页面跟着滚动，体验直接破功。
- 修法：改为 `ref` 回调中手动挂非被动监听器。

```tsx
useEffect(() => {
  const canvas = canvasRef.current;
  if (!canvas) return;
  const onWheel = (event: WheelEvent) => {
    event.preventDefault();
    setViewport((current) => ({
      ...current,
      scale: clamp(current.scale * (event.deltaY > 0 ? 0.88 : 1.14), 0.25, 8),
    }));
  };
  canvas.addEventListener("wheel", onWheel, { passive: false });
  return () => canvas.removeEventListener("wheel", onWheel);
}, []);
```

### P0-2 客户端模块注册不走 `ctx.effect`，卸载即泄漏 【高】

- 位置：`src/client/modules/sequence.tsx:12-18`（`slide.tsx`、`structure.tsx` 同构）
- 问题：`register*ClientModule()` 在 `apply()` 里同步执行 `ctx.slots.inject("tool.call.toolview", () => ctx.slots.register(...))`——`register` 返回的 disposer 被 `inject` 工厂直接丢弃。热重载或插件卸载后，toolview 注册持续累积。对比 `index.tsx:46` 的 `installStyles` 是正确包在 `ctx.effect` 里的。
- 修法：

```ts
export function registerSequenceClientModule(ctx: ClientContext): void {
  ctx.effect(() => {
    const disposers = SEQUENCE_CLIENT_MODULE.toolNames.map((toolName) =>
      ctx.slots.register({ name: "tool.call.toolview", key: toolName }, ScienceToolCard),
    );
    return () => { for (const dispose of disposers.reverse()) dispose(); };
  }, "dsh-rosalind: sequence client module");
}
```

### P0-3 NGS 证据取到"最旧"而非"最新" 【高】

- 位置：`src/client/session-evidence.ts:491`
- 问题：证据聚合取错方向，用户看到的是陈旧记录。`:557` 处 seed 路径不重置 `lastSignature`，签名去重会错误跳过更新。
- 修法：修正排序/取值方向；seed 时同步 `lastSignature = null`。

### P0-4 结构 canvas 大数组展开栈溢出 + 无原子上限 【高】

- 位置：`src/client/viewers/structure/canvas.tsx:30`
- 问题：大结构坐标数组用展开运算符传参，原子数大时直接 `RangeError: Maximum call stack size exceeded`；且无原子数上限保护。讽刺的是，仓库里**已有一个带上限的投影实现 `StructureProjection`（约 90 行，含 `coordinateAtoms`/`atomColour`）完全没被使用**——疑似重构遗漏。
- 修法：用 `for` 循环或 `Math.min` 分块替代展开；把 `StructureProjection` 的上限逻辑搬进 `LocalStructureCanvas`，或干脆删除死代码并迁移其上限常量。

### P0-5 序列表格无渲染上限 【高】

- 位置：`src/client/science-viewers.tsx:249`
- 问题：序列比对结果全量 `<tr>` 渲染，大行数直接卡死。
- 修法：虚拟滚动（行高固定，手写 `IntersectionObserver` 分页即可，不必引依赖），先渲染前 200 行 + "加载更多"。

### P0-6 主题对比度不足 【高·美观直接相关】

- `--rr-faint: #929995`（`src/client/styles.ts:9`）在浅底上对比度达不到 WCAG AA 的 4.5:1，而它被大量用于 8–9px 的小字标签（`styles.ts:65,73,125` 等）。dark 侧 `#7f8a85`（:25）同样偏弱。
- `science-viewers.css.ts` 的状态色在 dark 主题下对比度不足。
- 修法：浅主题提到 `#6b7672` 级别；建立"语义色阶梯"（faint/muted/ink 三档）并注明各档允许的最小字号，见 P1-6。

### P0-7 `.drr-ecosystem__read-only` 类没有对应 CSS 【中】

- 位置：`src/client/ecosystem.tsx:76-77`
- 问题：两段说明文字渲染为裸默认样式，明显是漏写。
- 修法：`styles.ts` 补 `.drr-ecosystem__read-only { margin: 8px 0 0; color: var(--rr-faint); font-size: 9px; line-height: 1.45; }`（颜色随 P0-6 一起调）。

### P0-8 固定 DOM id 多实例冲突 【中】

- 位置：`src/client/components.tsx:262-291`
- 问题：`rr-detail-title`、`rr-detail-tab-*`、`rr-detail-panel-*` 为硬编码 id；hero slot 与 conversation.view slot 可同时各挂一个 `Workbench`，`aria-labelledby` 指向重复 id。
- 修法：`const uid = useId()`，拼 `id={`${uid}-detail-tab-${tab}`}`。同理 `icons.tsx:10-17` 的 SVG gradient id `rr-mark-a/b`。

---

## P1 — 视觉升级方案（"抓人眼球"主战场）

> 设计主张：**"实验室仪器感"**——克制的底色、精确的数据排版、有生命的微交互。科学产品的漂亮不是堆渐变色，而是"每一处都像精密仪器"。以下按用户动线排序。

### P1-1 首屏 Hero：从"标题文字"到"工作台仪表盘"

现状（见 `docs/screenshots/dsh-light-catalogue-1280x720.png`）：居中大标题 + 一段说明 + 搜索框，视觉重心涣散。

TODO：

- [ ] 标题区改为**左对齐仪表板式布局**：左侧品牌印记（`RosalindMark` 已有渐变 DNA 双螺旋图标，放大到 40px 并加 `filter: drop-shadow` 微光），右侧并排三枚**实时统计 chip**：`23 PROJECTS` / `1,224 VALIDATED FILES` / `7 AREAS`，数字用 tabular-nums 等宽数字体。
- [ ] 统计 chip 数据来自 `src/generated/catalog.ts`，写一个纯函数：

```ts
// src/client/catalog-stats.ts
export function catalogueStats(catalogue: ShowcaseEntry[]): {
  projectCount: number; areaCount: number; reproduceReady: number;
} { /* 单次 reduce，按 area 去重计数 */ }
```

- [ ] 副标题用 `text-wrap: balance`（已有）+ 关键词 `<em>` 高亮（literature / structures / pathology 等七个领域词逐个用 accent 色）。
- [ ] 搜索框升级为"命令面板感"：聚焦时边框 1px → accent 色 + 4px 柔和光晕（`box-shadow: 0 0 0 3px color-mix(in srgb, var(--rr-accent) 18%, transparent)`），右侧加 `⌘K` kbd 提示装饰。

### P1-2 项目卡片：从"列表项"到"证据卡片"

现状：米色卡片 + 图标 + 两行文字 + 箭头，信息层级弱。

TODO：

- [ ] 卡片顶部加**领域色带**（2px，`background: var(--area-color)`），七个领域各一色，色板用 `src/shared/categories.ts` 已有分类生成，统一管理：

```ts
export const AREA_HUES: Record<Area, number> = {
  literature: 158, databases: 210, sequence: 96, ngs: 260,
  structure: 24, pathology: 340, design: 190,
};
// CSS: --area-color: oklch(62% 0.09 var(--area-hue));
```

- [ ] hover 微交互三件套：`transform: translateY(-2px)` + 阴影加深 + 右侧箭头 `translateX(3px)`，统一 180ms `cubic-bezier(.2,.7,.3,1)`。`prefers-reduced-motion` 下全部降级为仅阴影（项目已有该媒体查询，复用）。
- [ ] 卡片右下角加**模式角标**：`Lesson / Replay / Reproduce` 三个小圆点，可用模式点亮 accent 色，让用户一眼知道这个项目能干嘛（数据在 `modes` 字段里已有）。
- [ ] 卡片进入视口的 stagger 动画：`animation: rr-card-in .4s both`，`animation-delay: calc(var(--i) * 40ms)`，`--i` 由渲染 index 注入。这是"高级感"性价比最高的一招。

### P1-3 详情弹窗：从"文字堆叠"到"证据仪表盘"

现状（见 `docs/screenshots/dsh-dark-pdl1-detail-1280x720.png`）：tab + 分区文字列表，数字埋在句子里。

TODO：

- [ ] **指标提取条**：从 `computed results` 里把关键数值（如 ensemble score 0.91750 ± 0.00803、ipTM 0.92386）抽成顶部一排 **metric tile**——大数字 + 小标签 + 迷你 spark bar。数据结构上加一个可选字段：

```ts
// src/shared/types.ts
interface ShowcaseMetric { label: string; value: number; unit?: string; display?: string; }
// src/client/components.tsx
function MetricStrip({ metrics }: { metrics: ShowcaseMetric[] }) { /* grid auto-fit minmax(140px,1fr) */ }
```

- [ ] **provenance 时间线**：把 `provenance` 记录渲染为横向时间线（圆点 + 连线 + commit 短 hash 的 monospace 标签），替代纯文字。科学产品的"可信感"就来自这里。
- [ ] tab 切换加内容淡入：`@keyframes rr-panel-in { from { opacity: 0; transform: translateY(4px) } }`，配合 P2-2 的"始终挂载"改造，动画加在 `hidden` 移除时。
- [ ] 关闭按钮加 `Esc` 支持（目前只有点击关闭，见 P2-3），按钮 hover 旋转 90° 的小动效。

### P1-4 科学查看器：仪器化反馈

- [ ] 结构查看器加**HUD 层**：左上角显示 `scale: 1.42×`、原子计数、选中原子残基名；右下角加"重置视图"小按钮（目前只有 `Home` 键，用户发现不了）。HUD 用绝对定位 + `pointer-events: none`（按钮除外）。
- [ ] 切片查看器加**缩略图导航条**（filmstrip）：底部一排 56px 缩略图，当前帧 2px accent 描边。
- [ ] 所有 canvas 加 **loading skeleton**：数据到达前渲染呼吸骨架（`@keyframes rr-pulse` 背景渐变位移），而不是空白。
- [ ] 空状态插画化：目前空态是纯文字。用 `icons.tsx` 的 `BaseIcon` 体系画 3 个 64px 线性插画（无数据/加载失败/待选择），文字降级为辅助。

### P1-5 动效令牌统一

现在动画时长/缓动散落各处。建立令牌：

```css
/* styles.ts 顶部 */
.rr-root {
  --rr-ease: cubic-bezier(.2, .7, .3, 1);
  --rr-fast: 140ms; --rr-med: 220ms; --rr-slow: 380ms;
}
```

所有 transition/animation 引用令牌，全局节奏一致——这是"看起来很贵"的隐性来源。

### P1-6 字体与色彩阶梯

- [ ] 数字统一 `font-variant-numeric: tabular-nums`（指标、计数、进度）。
- [ ] 小字号体系收敛：当前 8/8.5/9/10/11px 五档并存，收敛为 9px（标签）/11px（辅助）两档，配合 P0-6 的对比度阶梯。
- [ ] dark 主题专属润色：卡片背景加 1px `color-mix(in srgb, #fff 6%, transparent)` 内描边，深色下立刻"浮"起来。

---

## P2 — 交互逻辑与状态管理

### P2-1 修复 `session-evidence.ts` 的撕裂读 【高】

- 问题：`session-evidence.ts` 的手写 store 里 hooks 存在"快照非订阅值"的撕裂读（`state.ts` 的实现是正确的，可对照）。
- 修法：统一为 `useSyncExternalStore(subscribe, getSnapshot)` 且 `getSnapshot` 返回**缓存的不可变快照**，不要在调用时新建数组/对象（否则 `Object.is` 比较失效导致无限重渲染）。

### P2-2 详情面板 tab 切换不要卸载子树 【中】

- 位置：`src/client/components.tsx:287-291`
- 问题：每个面板同时有 `hidden={...}` 和条件渲染 `{tab === "x" ? <Overview/> : null}`，二选一即可。建议**保留 `hidden` + 始终挂载**：tab 切换不重建子树，滚动位置和本地状态得以保留，也天然配合 P1-3 的淡入动画。
- 同理 `ecosystem.tsx:74` 的 tabpanel 补 `tabIndex={0}`。

### P2-3 焦点管理补全 【中】

- 位置：`src/client/components.tsx:231-236`
- 问题：`setTimeout` 未存 id 无法清理；关闭时 `previous?.focus()` 不检查该元素是否还在文档里；无 `Esc` 关闭。
- 修法：

```ts
useEffect(() => {
  const previous = document.activeElement as HTMLElement | null;
  const timer = window.setTimeout(() => panelRef.current?.focus(), 0);
  const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
  document.addEventListener("keydown", onKey);
  return () => {
    window.clearTimeout(timer);
    document.removeEventListener("keydown", onKey);
    if (previous && document.contains(previous)) previous.focus();
  };
}, []);
```

### P2-4 数据流组件 memo 化 【中】

- 位置：`src/client/components.tsx:80-85`
- 问题：`publishConversationNodes` 每次 nodes 变化都会让 `SessionDataFlow` 链路整体重渲染。
- 修法：`React.memo(SessionDataFlow)` + `Object.entries` 结果 `useMemo`。

### P2-5 消除内联样式，回归样式表 【低】

- `settings.tsx:16-21` 四处、`ecosystem.tsx:39,76` 两处内联 style，破坏项目"CSS 集中在 styles.ts"的约定。全部移入样式表；`.drr-ecosystem__ready` 改名为 `__dot` 并直接写 muted 背景（当前类 CSS 给绿色、内联又覆盖成灰，三层矛盾）。

### P2-6 `installStyles` 引用计数 【低】

- 位置：`src/client/index.tsx:34-43`。多实例（HMR）场景先装者先卸载会让样式裸奔。加引用计数或每实例独立 `<style data-instance>`。

---

## P3 — 可访问性与响应式

- [ ] `components.tsx:287` 详情面板用 `<main>` 与宿主地标冲突 → 改 `<div>`。
- [ ] `.sr-only` 改名 `.rr-sr-only` 防宿主类名冲突（`science-viewers.css.ts`）。
- [ ] `ecosystem.tsx:61` `aria-orientation="vertical"` 与 ≤760px 横向滚动布局矛盾 → 按布局动态切换或移除。
- [ ] 两个 canvas 的键盘能力残缺：slide 无法键盘建框、structure 无法键盘平移/缩放，但 `role="application"` 宣称了完整能力 → 补 `Arrow` 平移、`+`/`-` 缩放，或降级 role。
- [ ] `components.tsx:263` 预览 `<img>` 加 `loading="lazy" decoding="async"`。
- [ ] `previewFor`（`components.tsx:37`）静默丢弃无 data-URL 的 png 预览 → 至少加注释，或回退 `resourceUri`。

---

## P4 — 后端顺带发现（影响前端体验优先）

> 以下问题多位已用 `validateJsonSchemaValue` 实测复现。**dsh-tools 对成功结果强制做 output schema 校验，违例时前端只看到一次失败的工具调用**——这是"前端莫名报错"的最大隐藏来源。

### P4-1 数据不一致：README 说 100 个项目，可复现路由只有 23 个 【高】

- `src/host/reproduction.ts:210-211`：100 个 showcase 全部声明 `reproduce` 模式，但 `callsFor()` 只有 23 个 case 路由。其余 77 个会走完 `rosalind_plan`、甚至要求审批，直到 `rosalind_run` 才报 `RUN_FAILED: No reproduction route is recorded`。UI 上 "Reproduce path 23" 与 README "100 projects" 的矛盾即源于此。
- 修法：`plan()` 阶段就检查路由存在性，直接返回 `REPRODUCTION_ROUTE_UNAVAILABLE`；并把目录 `modes` 收窄到真实可复现集合。
- 另：`AGENTS.md:3` 仍写 "23-case catalogue"、旧 commit `f81e668c…`，与 `src/generated/catalog.ts`（100 个、`f8c2ea83…`）不一致，需同步更新。

### P4-2 工具输出 schema 违例（均已实测） 【高】

| 位置 | 问题 |
|---|---|
| `src/host/science/runtime.ts:166-177` | NGS 模块禁用时返回 `status:"unavailable"` + 未声明字段，枚举/`additionalProperties` 双违例。改 `"blocked"` 并把字段挪进 `error.details` |
| `src/host/science/runtime.ts:57-67` | `normalize()` 让服务返回的 `record.operation` 覆盖身份字段 → `sequence.edit_copy` 必崩。身份字段放展开之后 |
| `src/host/science/ngs.ts:814` | `missingRun()` 返回未声明的 `errors` 字段，`get/observe/cancel_ngs_run` 全部违例；错误消息最终退化为 "Scientific operation reported ok=false." |
| `src/host/science/ngs.ts:541-550` | `PLAN_ALREADY_CONSUMED` 幂等分支带出 8 个未声明字段——模型重试是常态，极易踩中 |
| `src/host/science/sequence.ts:509` | `query_viewer` 的 `query`/`selectedHit` 落到默认 `{type:"object"}` 违例 |
| `src/host/science/slide.ts:594` | 无编解码器路径 `note` 返回对象，schema 要求 string |

配套：`tests/science-output-schema.test.ts` 现有 7 用例全部通过却完全没覆盖上述路径，需补回归用例。

### P4-3 同步阻塞与性能 【中】

- `structure.ts:962` `execFileSync("ffmpeg", …, 120s)` + 逐帧同步光栅化：**冻结整个宿主事件循环最长 120 秒**，UI 心跳全停。改异步 `spawn` + abort 检查。
- `ngs.ts:701-702` 每个 stdout chunk 都 `saveState()` 全量落盘 → 500ms 节流。
- `literature.ts`/`databases.ts` 无缓存，重复 URL 全量重打 → 进程内 TTL 缓存（仅 2xx）。
- `tools.ts:50-54` 12 个 `rosalind_*` 工具共用 `jsonOutput`，前端只能展示原始 JSON 大字符串 → 为 catalog/status/plan 提供结构化 schema，前端才能做漂亮卡片。

### P4-4 其他 【中/低】

- `tools.ts:26` `FALLBACK_SESSION`：无 agent 身份时所有调用共享同一 `{}` 会话键，状态互相泄漏。
- `tools.ts:275` `rosalind_export` 用 `process.cwd()` 当工作区，与 UI 展示的工作区根可能不一致。
- `tools.ts:60-68` / `science-tools.ts:422-427` 失败卡片不带 `error.code`/`message`，前端看不到失败原因。
- `slide.ts:698-707` `wait_for_render` 名不副实（立即返回 `timedOut:true`），前端/模型极易误读。
- `sequence.ts:668-675` `export_artifact` 写文件无审批钩子，与 AGENTS.md "写操作需确认" 口径不一致。

---

## 实施路线建议

| 阶段 | 内容 | 预期产出 |
|---|---|---|
| 第 1 期（1 天） | P0-1 ~ P0-8 全部 | 线上体验无确定性 bug，对比度过 AA |
| 第 2 期（2 天） | P1-1 ~ P1-3（Hero / 卡片 / 详情面板）+ P1-5 动效令牌 | 首屏"第一眼高级感"达成，截图可进 README |
| 第 3 期（2 天） | P1-4 查看器 HUD + P2 交互逻辑 | 工具类视图仪器化，tab/焦点/滚动体验顺滑 |
| 第 4 期（1 天） | P3 + P4-1/P4-2 | a11y 收尾，前后端数据契约修复 |
| 全程 | 每阶段结束跑 `npm run validate` + Playwright 截图对照（`docs/verification.md` 流程） | 回归无忧 |

## 验收标准

- [ ] `npm run validate` 全绿，新增回归测试覆盖 P4-2 六条 schema 违例路径。
- [ ] 1280×720 / 720×900 / dark 三份新截图替换 `docs/screenshots/` 现有参考图。
- [ ] Lighthouse（或手工核对）对比度 AA、键盘全路径可达、`prefers-reduced-motion` 下无动画。
- [ ] 结构查看器 10 万原子 fixture 不崩、序列表格 1 万行流畅滚动。

---

*本清单由 Kimi 在 99-final-acceptance 工作区审阅生成。涉及 showcase 内容数据（`showcases/`、`src/generated/`）时，请先读各 case 的 README/showcase.json/provenance，遵守根 AGENTS.md 的可复现性要求。*
