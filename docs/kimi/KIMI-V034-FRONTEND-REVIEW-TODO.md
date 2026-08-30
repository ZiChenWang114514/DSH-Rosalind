# Kimi DSH-Rosalind 0.3.4 Frontend Review TODO

> 审阅人：Kimi（第二轮独立复审）
> 对象：`worktrees/99-final-acceptance` @ `76056cef9897f4faa261cbe9d22503654ee48390`，版本 0.3.4
> 对照：`docs/kimi/FRONTEND-REVIEW-TODO.md`（上一轮，针对较早版本）

---

## 1. 审阅范围、版本和验证环境

**已完成的审阅（源码确认）**：

- 客户端全部 21 个源文件逐文件精读：`src/client/`（components / ecosystem / science-mode / settings / state / session-evidence / project-flow / toolview / workflow-modules / module-settings-control / icons / prompt / styles / science-viewers + science-viewers.css / viewers/structure|slide/canvas / modules/sequence|structure|slide）。
- Host 契约路径精读：`src/host/tools.ts`、`src/host/runtime.ts`、`src/host/reproduction.ts`、`src/host/science-tools.ts`、`src/host/science/runtime.ts`、`src/host/science/ngs.ts`（关键段）、`src/host/science/slide.ts`（关键段）、`scripts/generate-catalog.mjs`、`scripts/lib/showcase-data.mjs`、`src/generated/catalog.ts`（抽样）、`src/shared/module-settings-contract.ts`。
- 测试盘点：`tests/` 下 47 个测试文件清单 + `tests/e2e/workbench.spec.ts`、`tests/e2e/science-viewers.spec.ts`、`tests/client-styles.test.ts`、`tests/session-evidence.test.ts`、`tests/client-composition.test.ts` 的内容级核对；`docs/verification.md` 核对。

**验证环境限制（重要）**：本轮运行环境无法访问 `http://127.0.0.1:3188/`（工具策略拒绝 loopback 抓取，且本环境没有浏览器自动化工具），也无法运行 `npm run validate` / Playwright。因此所有结论分为四档标注：**已实际复现**（本轮无法新复现，仅引用已有 e2e 断言）、**源码确认**、**推断**、**未能验证**。视觉效果、真实 DSH 宿主内的侧栏/主题/会话切换、200% 浏览器缩放均属于"未能验证"，见第 7 节。

---

## 2. 产品观感摘要（源码确认 + 推断）

0.3.4 相对上一轮被审版本发生了**架构级改向**，方向与产品定位一致：

- **科学模式成为可切换的 Harness 模式而非独立首页**。`science-mode.tsx` 注册了 `workspaceSidebar` 视图（"科学"侧栏，宽/窄两态，`science-mode.tsx:396-402`）、`rosalind-science` 主题、conversation view `dsh-rosalind`（label "Science"），并提供启用/恢复闭环（记录并还原 prior theme/sidebar/preset/conversation view）。空工作区 hero 只剩品牌印记（`workflow-modules.tsx:48`），`client-composition.test.ts:57` 显式断言 `conversation.hero.workspace` 不再注册——"不遮挡原生会话体验"已落实。
- **七模块生命周期有了真实的状态面**。`settings.tsx` 提供逐模块 switch（期望 vs 实际分离、`role="switch"`、`aria-live` 变更提示、Provider 凭据状态）；`module-settings-contract.ts` 定义了 secret-free 的运行时视图契约；`session-evidence.ts` 重写为按时间/序号去重重放的证据投影，模块停用时保留历史证据（`runtime.ts:176-187` 的 `NGS_MODULE_DISABLED` 明确告知"历史记录仍可读"）。
- **科学查看器明显仪器化**：Sequence 有 250 行渲染上限 + 过滤 + 指标 spark 轨道；Structure 有 12,000 原子采样上限、DPR 感知 canvas、渲染确认 HUD 文案；Slide 有 zoom/pan 控件与 `<output aria-live>` 位置读数；NGS 有运行卡片 + 事件时间线。

**主要观感短板（详见第 4 节）**：设置页深色主题下卡片底色/文字对比度存在确定性缺陷；科学模式主题只有 light 变体；中英文案混排；约 40–45% 的 `styles.ts` 是已删除目录页遗留的死 CSS；`StructureProjection` 与 `HeroWorkspacePicker` 是死代码；展示预览图因键名不匹配对 PNG 永不生效。

---

## 3. 上一轮问题逐项复查表

| 上轮条目 | 结论 | 验证方式（0.3.4 证据） |
|---|---|---|
| P0-1 canvas 滚轮穿透 | **已修复** | 源码确认：`viewers/structure/canvas.tsx:75-84` 改为非被动 `addEventListener("wheel", …, { passive: false })`；SVG 视图统一走 `science-viewers.tsx:97-109` 的 `useNonPassiveWheel`。已有 e2e 回归：`tests/e2e/science-viewers.spec.ts:37-45` 断言滚轮后 `window.scrollY` 不变。 |
| P0-2 模块注册不走 `ctx.effect` | **仍存在** | 源码确认：`modules/sequence.tsx:12-18`、`modules/structure.tsx:12-18`、`modules/slide.tsx:12-18` 仍是 `ctx.slots.inject(..., () => ctx.slots.register(...))`，register 的 disposer 被 inject 工厂丢弃。对照：`workflow-modules.tsx:19-27, 42-57` 的 NGS/Rosalind 模块已用正确的 `ctx.effect` + disposer 数组——同一仓库两种模式并存。 |
| P0-3 NGS 证据取最旧 | **已修复** | 源码确认：`session-evidence.ts:374-395` `orderedConversationNodes` 按 callId 去重保留最新、再按 time/seq/index 正序重放；seed 路径 `:598` 重置 `lastSignature = null`。回归测试：`tests/session-evidence.test.ts:212, 228`。 |
| P0-4 结构展开栈溢出/无上限 | **已修复（含残留）** | 源码确认：`viewers/structure/canvas.tsx:25-36` 12,000 原子采样上限，`:42-49` 改为 for 循环求包围盒。**残留**：`science-viewers.tsx:386-491` 的 `stableHue/atomColour/coordinateAtoms/StructureProjection`（约 100 行）全文件内无引用，仍是死代码。 |
| P0-5 序列表格无上限 | **已修复**（ capped 而非虚拟化，可接受） | 源码确认：`science-viewers.tsx:8` `SEQUENCE_RECORD_RENDER_LIMIT = 250`，`:256` slice，`:297` `role="status"` 截断提示 + `:304` 过滤器。 |
| P0-6 主题对比度 | **部分修复** | 源码确认：`styles.ts:9` `--rr-faint` 由 `#929995` → `#6d7772`，dark `:25` 由 `#7f8a85` → `#9aa6a0`，均达到或接近 AA。**但** 7.5–8.5px 字号仍大量存在（`science-viewers.css.ts:29,48,62,95,101,104,110` 等），小字 + `--rr-muted` 的组合未逐一数值验证（未能验证）。 |
| P0-7 `.drr-ecosystem__read-only` 无 CSS | **仍存在** | 源码确认：该类仅在 `ecosystem.tsx:97-98` 使用；`styles.ts` 全文无对应规则（Grep 全仓仅 1 文件命中）。两段说明文字仍渲染为裸默认段落。 |
| P0-8 固定 DOM id | **部分修复** | 已修复：`components.tsx:372` 详情面板 `useId()`；`icons.tsx:7-9` SVG gradient `useId()`；`science-viewers.tsx` 各查看器 `sv-tabs-${useId()}`。**残留硬编码 id**：`components.tsx:275-276` `rr-session-modules-title`、`:293` `rr-project-current`、`:303` `rr-project-modules-title`；`ecosystem.tsx:72,85,95` `science-ecosystem-tab-*` 且 `selectAt` 用 `document.getElementById` 跨实例聚焦；`settings.tsx:124,127,130,165,213,215` `dsh-rosalind-module-settings-title`、`module-settings-*`。当前注册路径下每类只有一个挂载点（hero 未注册），风险降级但未消除。 |
| P1-1 首屏 Hero 仪表盘 | **部分实现（形态已变）** | `components.tsx:287-302` 为 masthead + 三格 summary（模块数/记录数/运行时状态）。无 tabular-nums、无"可复现数"统计。旧目录页 Hero 已随 hero slot 取消而移除。 |
| P1-2 卡片领域色带/模式角标 | **部分实现** | `.rr-card::before` 色带 CSS 仍在（`styles.ts:134`）但 `rr-card` 已无 TSX 引用（死 CSS）。现行入口是 `rr-project__module-strip`（无领域色带，仅图标）与 `ecosystem.tsx:99` 的 Inspect/Reproduce 按钮（替代了模式角标的意图）。 |
| P1-3 详情弹窗仪表盘化 | **部分实现** | 仍是 InfoBlock 文字列表（`components.tsx:314-359`）；无指标条、无 provenance 时间线。已补：Esc 关闭（`:406`）、预览图 `loading="lazy" decoding="async"`（`:409`）、焦点恢复 `isConnected` 检查（`:380`）。 |
| P1-4 查看器仪器化 | **部分实现** | Structure：渲染确认 HUD（`science-viewers.tsx:532`）；Slide：缩放控件 + 位置 `<output aria-live>`（`:615`）。未做：加载骨架、空状态插画、slide tile 路径无缩放（见新 P1-4）。 |
| P1-5 动效令牌 | **未做** | `styles.ts` 仍散落 `.15s/.16s/.18s ease` 硬编码；`@keyframes rr-fade/rr-rise`（`:366-367`）无引用（死）。 |
| P1-6 字体/色彩阶梯 | **未做** | 无 `tabular-nums`；字号 7/7.5/7.8/8/8.5/9/9.5/10/10.5/11/11.5/12+ 并存。 |
| P2-1 证据 store 撕裂读 | **已修复** | 源码确认：`session-evidence.ts:142-158` `useSyncExternalStore(subscribe, getSnapshotVersion)` + 模块级不可变 state；回归测试 `tests/session-evidence.test.ts:243`。 |
| P2-2 tab 切换卸载子树 | **仍存在** | `components.tsx:434-436` 仍是 `hidden={...}` 与 `{detailTab === "x" ? <…/> : null}` 并存，切 tab 即卸载，滚动位置/本地状态丢失（science-viewers 里 SequenceResult 不得不手写 scroll 位置保存 `:263-271`，侧面印证）。 |
| P2-3 焦点管理 | **已修复（一处残留）** | `components.tsx:374-382` 清理 timer + `isConnected` 检查 + Escape（`:406`）。残留：Escape 监听挂在面板 `onKeyDown` 上，焦点离开面板后 Esc 无效（可接受，但建议 document 级监听）。 |
| P2-4 数据流组件 memo | **仍存在（且更重）** | `SessionDataFlow` 未 memo（`components.tsx:130-151` 每次渲染重建 entries）；且 `session-evidence.ts:481-484` 对**每个** tool-result 节点做完整 `JSON.stringify(node)` 作为 marks，`:571-584` 每次发布前再整体 stringify 一次签名——长会话下每次 nodes 变化都是 O(会话体积) 序列化（新发现，见新 P1-7）。 |
| P2-5 内联样式 | **仍存在，且设置页更严重** | `ecosystem.tsx:39,91,96,97` 内联 `marker()` 与 `style={{ background: "var(--rr-muted)" }}`（`.drr-ecosystem__ready` 类给绿、内联覆盖为灰的三层矛盾原样保留）；`settings.tsx` 整页内联样式（PAGE/GRID/CARD/ROW/META + 约 20 处元素级 style）。 |
| P2-6 installStyles 引用计数 | **已修复** | `styles.ts:474-497` `styleUsers` 引用计数；回归测试 `tests/client-styles.test.ts`。 |
| P3 `<main>` 冲突 | **已修复** | 详情面板改 `<section role="region">`（`components.tsx:399-407`）；e2e 断言无 dialog、region 可见（`workbench.spec.ts:25,46`）。 |
| P3 `.sr-only` 改名 | **仍存在** | `styles.ts:35` 仍是全局 `.sr-only`（`science-viewers.tsx:304` 在用）；`styles.ts:471` 又新增 `.rr-visually-hidden`——两套并存，应收敛到带前缀的一套。 |
| P3 `aria-orientation` | **已修复** | `ecosystem.tsx:41-59,82` `useHorizontalTabs` 按实际布局动态切换。 |
| P3 canvas 键盘能力 | **部分修复** | Structure canvas 补齐 Arrows/+/−/Home/Escape（`canvas.tsx:98-108`）与 aria-label 一致。**Slide `LocalSlideCanvas` 仍无法用键盘创建选区**（只有 Esc/Enter，`viewers/slide/canvas.tsx:65`），`role="application"` 依旧过度声明。 |
| P3 预览图 lazy | **已修复** | `components.tsx:409`。 |
| P3 `previewFor` 丢弃 PNG | **仍存在，且根因已定位** | 源码确认双重问题：① `components.tsx:65-68` 用 `showcase.preview.path` 查 `PREVIEW_DATA_URLS`，但 `scripts/generate-catalog.mjs:9-13` 以 **showcase id** 为键——键名不匹配，该查找永远落空；② 非 SVG 预览的 `resourceUri` 是 `dsh-rosalind://…`（`showcase-data.mjs:236-240`）自定义 scheme，浏览器不可渲染，PNG 分支又显式返回 `undefined`。**净效果：所有 PNG 预览永远显示 fallback 图标；SVG 预览仅靠 resourceUri 兜底碰巧可用。** |
| P4-1 100 vs 23 数据不一致 | **已修复** | `scripts/lib/showcase-data.mjs:383` modes 由 `reproduction-routes.json` 驱动（生成目录中 `"reproduce"` 恰好 23 处）；`reproduction.ts:580-590` 运行时再以 `hasReproductionRoute` 兜底返回 `REPRODUCTION_ROUTE_UNAVAILABLE`；`tools.ts:234,242` 增加 `runnable_only` 过滤；`AGENTS.md:3-5` 已同步为 100 案例/23 路由口径。 |
| P4-2 输出 schema 违例（6 条） | **已修复** | `science-tools.ts:104` `RESULT_STATUSES` 纳入 `"unavailable"` 并为 ngs 声明 `module/moduleStatus`（`:461-466`）；`runtime.ts:69-77` 身份字段置于展开之后；`science-tools.ts:338-341` `query_viewer` 的 query/selectedHit/hits 显式类型化；`:342` slide `note` 改 oneOf string/object；`ngs.ts:841` `missingRun` 只返回已声明字段；`:545-555` `PLAN_ALREADY_CONSUMED` 分支字段均在 `execute_plan` 声明列表（`science-tools.ts:219`）内。回归套件 `tests/science-output-schema.test.ts` 存在（具体用例覆盖未逐条核对——部分未验证）。 |
| P4-3 ffmpeg 同步阻塞 / saveState / 缓存 / jsonOutput | **大部分已修复** | 全仓已无 `execFileSync`（Grep 0 命中），`ngs.ts:2` 用异步 `spawn`；`ngs.ts:707-708, 730-738` stdout/stderr 落盘改 100ms 防抖 `scheduleOutputPersistence`；`tools.ts:88-208` rosalind_* 工具改为每工具结构化 schema + `presentationMeta` 摘要。**未验证**：literature/databases TTL 缓存是否加入。 |
| P4-4 FALLBACK_SESSION / export cwd / 失败卡片 / wait_for_render / export 审批 | **大部分已修复，两处残留** | 已修复：`tools.ts:26-34` 无 agent 时返回 `DSH_SESSION_REQUIRED` 而非共享会话键；`slide.ts:703-710` `wait_for_render` 有完整 revision 语义；`tools.ts:63-74,214-223` 失败卡片带 `errorCode: errorMessage`；`tools.ts:438-447` export 增加 `approved`/`overwrite` 门槛。**残留**：`tools.ts:226,442` 仍以 `runtime.catalog.packageRoot` 为根做 `resolveInside`，而工具描述（`:429`）写的是 "under the active workspace"——契约与行为不一致。 |

---

## 4. 新问题与改进项（按优先级）

### P0 — 影响正确性/基本观感，建议先于美化处理

#### P0-1 设置页深色主题对比度确定性缺陷【源码确认】

- **位置**：`src/client/settings.tsx:41`（CARD_STYLE）+ `src/client/styles.ts:33`（`.rr-settings` 文字色）。
- **现象（推断的渲染结果，未在页面实测）**：卡片背景为 `color-mix(in srgb, var(--rr-surface, #fff) 94%, var(--rr-accent, #4c7fa4))`。`--rr-surface` 在 `styles.ts` 从未定义（Grep 全 client 仅此处命中），fallback `#fff` 永远生效——深色主题下卡片近白，而文字继承 `var(--rr-ink)`（深色主题 `#edf1ef`，近白），**白字白底，设置页在 dark 下不可读**。另外 fallback accent `#4c7fa4` 与 styles.ts 的 `#537d70` 不一致。
- **影响**：设置页是七模块启停的唯一入口，深色用户直接不可用。
- **建议实现**：把 PAGE/GRID/CARD/ROW/META 全部迁入 `styles.ts` 为 `.rr-settings__*` 类，背景用 `var(--rr-panel)`/`var(--rr-panel-solid)`；顺带完成上轮 P2-5。
- **验收**：dark 主题打开 Settings → Rosalind，七张模块卡片文字/状态色可读；`getComputedStyle` 断言卡片背景为 `--rr-panel-solid` 解析值。
- **测试建议**：`tests/client-styles.test.ts` 增加"WORKBENCH_CSS 定义了 settings.tsx 引用的全部 var()"静态断言；Playwright dark 截图一张。

#### P0-2 预览图管线键名不匹配，PNG 预览永不渲染【源码确认】

- **位置**：`scripts/generate-catalog.mjs:9-13`（键 = showcase id）vs `src/client/components.tsx:65-68`（查 = preview.path）；`scripts/lib/showcase-data.mjs:236-240`（非 SVG 预览 resourceUri 为不可渲染的 `dsh-rosalind://`）。
- **现象**：详情面板左侧预览位对 PNG 案例永远走 `.rr-preview-fallback` 图标；`PREVIEW_DATA_URLS` 整条查找路径是死的。
- **建议实现**：统一以 `showcase.id` 为键（`PREVIEW_DATA_URLS[showcase.id]`），并为 PNG 预览在生成期产出 data-URL（注意包体——可先限量宽 ≤1200px 的预览）或在 host 侧提供 resource 协议解析；若决定只支持 SVG 预览，则删除 `PREVIEW_DATA_URLS` 并在 `previewFor` 写清策略注释。
- **验收**：打开一个 PNG 预览的 showcase（如 GFP 图案例），详情头部显示真实预览而非图标。
- **测试建议**：`tests/catalog.test.ts` 断言"每个 preview 非空的 showcase 都能在 PREVIEW_DATA_URLS 以其 id 命中"；组件测试覆盖 PNG/SVG/无预览三分支。

#### P0-3 三个科学客户端模块注册仍泄漏（上轮 P0-2 未修）【源码确认】

- **位置**：`src/client/modules/sequence.tsx:12-18`、`structure.tsx:12-18`、`slide.tsx:12-18`。
- **现象**：`ctx.slots.inject` 工厂返回的 disposer 被丢弃；插件热重载/卸载后 `tool.call.toolview` 注册累积，同一工具可能叠挂多个 `ScienceToolCard`。
- **建议实现**：与 `workflow-modules.tsx:19-27` 对齐——`ctx.effect(() => { const disposers = toolNames.map(...register...); return () => disposers.reverse().forEach(d => d()); }, "dsh-rosalind: <module> client module")`。
- **验收/测试**：`tests/workflow-modules.test.ts` 增补三模块的注册-卸载-再注册用例，断言注册表无重复 key。

### P1 — 体验与一致性

#### P1-1 科学模式主题只有 light 变体，深色用户被强制翻白【源码确认】

- **位置**：`science-mode.tsx:321-338` `ROSALIND_SCIENCE_THEME` 固定 `colorScheme: "light"`。
- **现象**：启用科学模式即 `theme.setTheme("rosalind-science")`；使用 dark 主题的用户整个 Harness 被切成浅色。且 `createScienceModeController.toggle` 在启用时记录 `priorTheme`、停用时恢复——若用户在科学模式期间手动换了主题，停用会把用户的新选择覆盖回旧主题（`science-mode.tsx:185-189, 161-168`，**推断**的竞态）。
- **建议实现**：注册 `rosalind-science` 与 `rosalind-science-dark` 两个主题，启用时跟随当前 `colorScheme`；停用时仅当当前主题仍是科学主题才恢复 prior，否则跳过。
- **测试**：controller 单测覆盖"启用→用户改主题→停用不还原"。

#### P1-2 中英文案混排【源码确认】

- **位置**：`science-mode.tsx:107,114,118,122,132,160,171` 等消息为中文，`ScienceSidebar`（`:256-265`）与 `settings.tsx` 全中文，而 Workbench/详情/查看器全英文。
- **建议**：在 Cordis 架构内做最小 i18n 层：`src/client/copy.ts` 集中导出文案表（`zh-CN`/`en`），按宿主 `navigator.language` 或主题服务暴露的 locale 选择；短期可先统一为英文 + 中文 README 说明。
- **测试**：快照测试锁定两套文案的关键字符串。

#### P1-3 残留硬编码 id 与跨实例聚焦【源码确认】

- **位置**：`components.tsx:275-276,293,303`；`ecosystem.tsx:72,85,95`（+ `document.getElementById`）；`settings.tsx:124-215`。
- **建议**：全部改 `useId()` 前缀拼接；`ecosystem.tsx` 的 `selectAt` 改用 `tabsRef.current[index]?.focus()`（参照 `science-viewers.tsx:194-218` 的 TabStrip 模式），彻底去掉 `document.getElementById`。
- **测试**：同页渲染两个 `ScienceEcosystemPanel`，断言无重复 id、键盘导航不串实例。

#### P1-4 Slide 查看器双路径能力不一致 + 键盘建框缺失【源码确认】

- **位置**：`science-viewers.tsx:615`：有 tile 时渲染 `LocalSlideCanvas`（无缩放/平移/位置读数），无 tile 时渲染带控件与 `<output>` 的 SVG——**同一看查看器两种交互能力**；`viewers/slide/canvas.tsx:65` 键盘仅 Esc/Enter，无法建框却声明 `role="application"`。
- **建议**：给 `LocalSlideCanvas` 增加 viewport（zoom/pan）与 HUD 行（复用 `sv-slide-position`）；键盘建框：方向键移动准星、Space 起止框选、Enter 确认，或把 role 降为 `img` + 旁白说明。
- **测试**：Playwright 增加 tile 路径的键盘建框用例；组件测试断言两路径都暴露缩放控件。

#### P1-5 详情 tab 仍卸载子树 + notice 不消失【源码确认】

- **位置**：`components.tsx:434-436`（hidden + 条件渲染并存）；`state.ts:104-106` `showNotice` 无 TTL。
- **建议**：tabpanel 始终挂载、仅切 `hidden`（上轮方案仍适用）；`showNotice` 成功类提示 6s 后自动清除（`setResearchSubmissionState` 的 failed 保留），timer id 存 store 以便清理。
- **测试**：组件测试：切 tab 后输入框内容/滚动位置保留；notice 在 fake timers 下自动消退。

#### P1-6 科学模式停用时的状态恢复粒度【源码确认/推断】

- **位置**：`science-mode.tsx:142-173`。`prepared.clear()` 后若用户再次启用，曾经组合过的会话要重新走 `agentPresets.select`；另 `disable()` 未恢复 `session` 的 conversation view 之外的原 preset（仅当 blank 且有记录时恢复）。属设计权衡，但建议把"停用科学模式是否退出科学会话视图"做成幂等且可解释的消息（现在已有 notes 机制，补齐分支即可）。

#### P1-7 证据投影每次全量序列化【源码确认】

- **位置**：`session-evidence.ts:481-484`（每节点 `JSON.stringify(node)`）、`:571-584`（签名 stringify 整个 workbench）；`components.tsx:130-151` 未 memo。
- **建议**：marks 用 `callId:time:seq` 轻量指纹（已有 `fingerprint()`+`nodeOrder()`），签名同理只拼身份字段；`SessionDataFlow` 包 `React.memo` 并 `useMemo` `Object.entries`。
- **测试**：`tests/session-evidence.test.ts` 增加"重复发布同一 nodes 不触发 listener"与 1,000 节点基准断言（次数上限）。

### P2 — 工程质量与打磨

#### P2-1 死代码与死 CSS 规模已影响可维护性【源码确认】

- **TS 死代码**：`science-viewers.tsx:386-491` `StructureProjection` 及 `coordinateAtoms/atomColour/stableHue`（上轮已指出，仍未删）；`components.tsx:459-503` `HeroWorkspacePicker` 无注册点（仅测试引用）。
- **CSS 死代码（约占 WORKBENCH_CSS 的 40–45%）**：`.rr-portal*`（38–78）、`.rr-launch*`（101–106）、`.rr-hero-head`、`.rr-workspace-head/back/title/status`、`.rr-toolbar/.rr-search/.rr-select/.rr-count`、`.rr-grid/.rr-card*/.rr-empty`、`.rr-workspace-row`、`.rr-mode-picker/.rr-mode`、`.rr-title/.rr-subtitle`、`@keyframes rr-fade/rr-rise`——Grep 确认均无 TSX 引用（`.rr-source-note`、`.rr-brand-mark` 等仍在用，勿误删）。
- **建议**：删除死代码；给 `styles.ts` 加"类名 ↔ TSX 引用"静态检查脚本（`scripts/check-client-css.mjs`，纳入 `npm run validate`）。
- **测试**：检查脚本即测试。

#### P2-2 `prefers-reduced-motion` 块指向死类、漏活类【源码确认】

- **位置**：`styles.ts:451` 仅列 `.rr-card/.rr-card-arrow/.rr-portal-primary`（均死）；存活动效 `.drr-ecosystem__switch i::after`（`:291-293`）、`.rr-search input`（无 TSX 引用，随 P2-1 清理）、`.sv-tab` hover 等未覆盖。
- **建议**：令牌化动效（上轮 P1-5 仍适用：`--rr-ease/--rr-fast/--rr-med/--rr-slow`），reduced-motion 块统一 `transition: none` 覆盖所有活类。

#### P2-3 `.drr-ecosystem__read-only` 仍裸渲染 + `.sr-only` 未收敛【源码确认】

- 同上轮 P0-7 / P3：补 `.drr-ecosystem__read-only` 样式；`.sr-only` → `.rr-sr-only` 并与 `.rr-visually-hidden` 合并。

#### P2-4 结构场景视觉不一致【源码确认】

- **位置**：`science-viewers.css.ts:113` `.sv-scene` 硬编码深色径向渐变（任何主题都是深色仪器舱），而 `:123` `.sv-structure-canvas` 用 `var(--rr-panel-muted)`（随主题）。同一 Scene tab 内 fallback（深色）与 canvas（浅色）两套底色。
- **建议**：二选一——canvas 也用深色"仪器舱"（原子配色已有暗底色板 `canvas.tsx:24` 偏亮，需要为暗底调一版），或 `.sv-scene` 随主题。从"仪器感"角度建议统一深色舱 + `data-theme` 无关。

#### P2-5 `rosalind_export` 工作区契约不一致【源码确认】

- **位置**：`tools.ts:226,429,442`。描述称"active workspace"，实现解析到 `packageRoot`。前端若展示"已导出到工作区 X"会误导。
- **建议**：从 `exec` 拿真实工作区根（若 DSH 契约允许），否则把描述改为"插件包目录下的 exports 区"并在前端 export 卡片显示绝对路径。

### P3 — 可访问性与响应式收尾

- **P3-1** `settings.tsx:140-153` switch 按钮 `#737b84` 底 + 白字约 4.5:1 边界值；`sv-state--running #577ca7` 等小字徽章未逐一数值验证（**未能验证**，建议跑一次 axe/对比度脚本）。
- **P3-2** `ecosystem.tsx:95` tabpanel 仍无 `tabIndex={0}`（上轮 P2-2 附带项未做）。
- **P3-3** `docs/verification.md:59-63` 自述 200% 仅为 CSS zoom 测试；浏览器真实 200% 缩放与窄屏下设置页 `repeat(auto-fit, minmax(min(100%, 25rem), 1fr))` 的表现**未能验证**。
- **P3-4** `ToolHeader` 的 `sv-state` 仅靠颜色 + 8.5px 大写文字表达状态，建议加 `aria-label` 全句（现状已有文本内容，可接受，列为增强）。
- **P3-5** `state.ts` 为模块级单例：当前只有 conversation view 一个注册点所以安全，但若未来 hero 恢复注册，两个 Workbench 实例共享 `selectedCaseId` 会互相顶掉内容——在文件头补一条约束注释或把 store 改为按作用域 key。

---

## 5. 建议拆分的四个实施模块（互不冲突）

| 模块 | 范围（文件互不重叠） | 内容 |
|---|---|---|
| **A. 注册·id·预览管线** | `src/client/modules/*.tsx`、`src/client/components.tsx`（id/previewFor/notice/tab 挂载）、`src/client/ecosystem.tsx`、`scripts/generate-catalog.mjs`、`src/client/state.ts` | P0-2（修）、P0-3、P1-3、P1-5、P3-2；验收：注册卸载无泄漏、无重复 id、PNG 预览可见、Esc/焦点回归绿。 |
| **B. 设置页与主题** | `src/client/settings.tsx`、`src/client/science-mode.tsx`、`src/client/module-settings-control.ts`、`src/shared/module-settings-contract.ts`（如需） | P0-1 深色修复、内联样式清零、P1-1 双主题、P1-2 文案统一、P1-6、P3-1；验收：dark 设置页截图 + controller 单测。 |
| **C. 查看器与证据面板** | `src/client/science-viewers.tsx`、`src/client/viewers/**`、`src/client/science-viewers.css.ts`、`src/client/session-evidence.ts`、`src/client/toolview.tsx` | P1-4 slide 双路径拉平与键盘建框、P1-7 性能、P2-4 场景底色统一、指标条/provenance 时间线（上轮 P1-3 遗留的视觉增强在此落地）；验收：四查看器 e2e + 新增 tile 路径键盘用例。 |
| **D. 清理与令牌** | `src/client/styles.ts`、`scripts/check-client-css.mjs`（新增）、`package.json`（validate 挂钩） | P2-1 死代码/死 CSS 清除、P2-2 动效令牌 + reduced-motion 全覆盖、P2-3 类名收敛、字号/数字体阶梯（上轮 P1-6）；验收：`validate` 含 CSS 引用检查，全量截图对照。 |

依赖关系：A/B/C/D 两两无文件交集（B 与 D 都碰 styles 相关但 D 只动 `styles.ts`、B 只动 `settings.tsx/science-mode.tsx`——B 新增的 `.rr-settings__*` 类需写入 `styles.ts`，建议 B 先合并或 B 把样式写在自己新增的 `settings.css.ts`，即可完全并行）。

---

## 6. 建议的验收与测试基线

- `npm run validate` 全绿；`tests/science-output-schema.test.ts` 确认覆盖上轮 6 条违例路径（本轮未逐条核对，列为 Codex 核实点）。
- e2e 增补：dark 设置页截图、PNG 预览可见性、slide tile 路径键盘建框、双 `ScienceEcosystemPanel` 实例 id 唯一性。
- 性能断言：1,000 节点 `publishConversationNodes` 调用次数/耗时上限；12,000 原子结构 fixture 渲染（已有上限逻辑，补 benchmark 断言）。

---

## 7. 本轮未能验证的内容（明确清单）

1. **线上页面 `http://127.0.0.1:3188/` 的一切实际操作**：会话/科学标签切换、科学模式启停、工作区选择、新建会话、研究任务创建、七模块启停开关的真实宿主行为——本环境无法访问 loopback 且无浏览器工具，全部为源码确认或推断。
2. **视觉效果**：主题融合、间距、层级、动效的实际观感；dark/浅色下各查看器与设置页的真实渲染（P0-1 的深色缺陷为源码推断，需页面复核）。
3. **响应式**：窄屏与 200% 浏览器缩放（非 CSS zoom）下的实际布局；`docs/verification.md:61` 自述 CSS zoom 测试不覆盖浏览器缩放。
4. **性能**：序列表格 250 行上限后的滚动流畅度、12,000 原子 canvas 帧率、长会话证据投影耗时——均为源码推断。
5. **`tests/science-output-schema.test.ts` 对六条历史违例路径的逐条覆盖**（文件存在，内容未逐条核对）。
6. **literature/databases 的 TTL 缓存**是否已在 0.3.4 加入（上轮 P4-3 子项，本轮未找到证据，倾向"未做"但未确证）。
7. **DSH 宿主契约行为**：`workspaceSidebar`/`theme`/`agentPresets` 等服务在 0.1.1-rc.2 的真实可用性（`science-mode.tsx` 已做可选降级，未在真实宿主验证）。

---

*本报告由 Kimi 于 2026-08-31 在 `99-final-acceptance` 工作区以只读方式完成：未修改源码、未提交、未安装依赖、未启动服务。所有"源码确认"条目均附文件与行号，可供 Codex 独立核实后落盘。*
