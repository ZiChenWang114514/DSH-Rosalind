<div align="center">
  <img src="assets/readme-hero.svg" alt="DSH-Rosalind 可复现科学工作台" width="100%" />

  <p><strong>在 DSH Web 中浏览、讲解、回放并复现 100 个生命科学研究案例。</strong></p>
  <p><a href="README.md">English</a> · <a href="docs/showcases.md">案例目录</a> · <a href="docs/verification.md">验证记录</a> · <a href="docs/release-notes-v0.3.3.md">v0.3.3 更新</a></p>
</div>

## 项目简介

DSH-Rosalind 是面向 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) `0.1.1-rc.2` 的原生科学工作台扩展。它把经过检查的研究案例带入 DSH Web，使任何人都能在一个会话中学习研究问题、查看历史结果，并在本机或已配置的服务上准备新的运行。

每个案例提供三种方式：

- **Lesson**：依次呈现来源观察、计算结果、科学解释、限制与引用。
- **Replay**：打开随版本发布且已经检查的文件和预览。
- **Reproduce**：检查数据、软件、凭据与计算资源，生成步骤清楚的运行计划。

本版本包含七个科学类别、100 个已完成教学与回放检查的案例，以及 1,224 个经过验证的目录与案例文件。Reproduce 会先生成新的计划，并只在输入与确认齐备时调用现有适配器；本地分析会在适配器已支持时产生新结果，依赖原始来源、远程服务或付费计算的流程则会说明具体条件，或保持等待确认。案例内容固定到经过审阅的提交 `f8c2ea83ac3b3b9258b160b80039dc3db37d76c4`。

## DSH Web 实际界面

以下是 DSH-Rosalind 生成的候选版本参考图。自动浏览器基准运行在组件预览页；隔离 DSH 配置中的宿主注册另有检查。准确范围见[验证记录](docs/verification.md)。

| 浅色项目目录 | 深色 PD-L1 详情 |
|---|---|
| ![DSH 浅色主题中的 DSH-Rosalind 项目目录](docs/screenshots/dsh-light-catalogue-1280x720.png) | ![DSH 深色主题中的 PD-L1 纳米抗体证据详情](docs/screenshots/dsh-dark-pdl1-detail-1280x720.png) |

组件预览页包含 720 像素宽的专用参考图和溢出检查；提供运行中的全新 DSH 配置后，才会执行真实页面浏览器检查。

<p align="center"><img src="docs/screenshots/dsh-light-narrow-720x900.png" alt="窄屏 DSH Web 中的 DSH-Rosalind" width="420" /></p>

## 十分钟开始使用

准备 Node.js 20 或更新版本，并安装准确的 DSH 版本：

```powershell
npm install --global @deepseek-ai/dsh@0.1.1-rc.2 pnpm
dsh --version
```

从 GitHub Releases 下载 `zichenwang114514-dsh-rosalind-0.3.3.tgz`，也可以在同名标签执行 `npm run pack:bundle` 构建。将安装包加入 DSH Web：

```powershell
dsh plugin --profile web add C:\Downloads\zichenwang114514-dsh-rosalind-0.3.3.tgz
dsh web --no-open
```

打开 DSH 输出的地址。Harness 原生会话视图继续保留，左侧的**科学**视图用于管理 Rosalind 的七个模块。开启科学工作台模式后，会应用科研主题和能力组合，再创建或继续研究会话。Showcase 会出现在模块详情和研究流程中，不会替换 Harness 首页。

从源码构建也很直接：

```powershell
git clone https://github.com/ZiChenWang114514/DSH-Rosalind.git
cd DSH-Rosalind
npm ci
npm run pack:bundle
dsh plugin --profile web add .\zichenwang114514-dsh-rosalind-0.3.3.tgz
```

## 100 个案例

| 类别 | 数量 | 内容 |
|---|---:|---|
| 文献 | 6 | TREM2、KRAS G12C、纳米抗体实验文献与开放获取记录 |
| 数据库 | 7 | IL6R、PD-L1、PETase、气道 RNA-seq 与变异解释 |
| 序列 | 12 | Lambda 注释、RAS 比对、序列编辑、会话恢复与导出 |
| NGS | 15 | 工作流准备、版本、执行、观察、摘要与取消记录 |
| 分子结构 | 15 | 接触、比对、密度图、组装体、质量评估与轨迹 |
| 病理与空间组学 | 15 | DICOM、OME、测量、科学图层与研究包 |
| Workbench | 30 | 分子设计、科学计算、实验规划与跨工具研究 |

完整 ID、历史结果和运行要求见[案例目录](docs/showcases.md)。

## 运行与服务

历史教学和回放不需要凭据。新的运行可以使用本地算法、公共数据库、容器、SSH/HPC，以及可选的 Boltz、Biohub ESM、Modal 或 Runpod。具体案例能否产生新结果取决于其适配器、输入来源和计算环境；涉及付费服务、GPU、远程计算或外部文件写入时，界面会列出服务、资源与费用估计，并等待用户确认。服务失败后会保留原先的选择并给出诊断信息。

运行模型可选择 DeepSeek V4 Flash 或 V4 Pro；这项选择影响会话中的讲解方式，不会改变已发布的科学文件。配置说明见[服务与计算资源](docs/providers.md)。

## 科学与工程验证

```powershell
npm run validate:showcases
npm run typecheck
npm test
npm run build
npm run check:bundle
npm run test:e2e
```

发布验证会从保留文件重新计算 RAS 比对、FASTQ 质量、结构接触、空间组学导出和 PD-L1 候选统计。历史文件回放不会产生新的科学计算结果。详细数值、浏览器基准和 DSH 安装检查见[验证记录](docs/verification.md)。

## 许可

源代码采用 [Apache-2.0](LICENSE)。项目编写的文档与视觉资源采用 [CC BY 4.0](LICENSE-DOCS)。公共科学数据继续遵循原始来源的许可和引用要求，详见 [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) 与各案例的 provenance 文件。
