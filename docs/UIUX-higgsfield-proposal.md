# UI/UX 优化方案：借鉴 Higgsfield 的 Layout 规划

> 日期：2026-11-24 · 状态：提案（未改代码）
>
> **研究来源说明**：两路来源互补——
> 1. **直接浏览 higgsfield.ai** 实测（1440×900 桌面视口，读取 DOM 尺寸 + 截图）：首页 `/` 与视频生成工作台 `/ai/video` 的未登录态。
> 2. **Mobbin**（授权后补充）：Higgsfield web 端的登录态流程，见 §1.4。
>
> 移动端建议为推断，未实测。
>
> **原则：学 layout 与信息架构，不照搬视觉。** Higgsfield 的深色画布 + 荧光绿 CTA + 全大写压缩标题与本项目 `DESIGN.md`（浅色编辑风、ink pill CTA、Display 300 不加粗）直接冲突；且 `styles.css` / `docs/STYLING.md` 标注品牌色是未决事项。因此下文 P0/P1 全部用现有 token 表达，视觉风格问题单独放在 P2 作为品牌决策。

---

## 1. Higgsfield Layout 拆解

### 1.1 全局框架
| 元素 | 实测 | 要点 |
|---|---|---|
| 顶栏 | 高 52px，全宽 | 左：logo + “New drops” 徽标；中：按**产品类型**的一级导航（Image / Video / Audio / …）+ mega-menu；右：Pricing + 主 CTA “Get started”（32px 高，r=10） |
| 内容宽 | 1408px（1440 − 2×16 gutter） | 几乎满宽，靠媒体撑画面，不用窄文本列 |
| 字体 | Inter 正文；Display 为全大写压缩字 | 正文 400，标题短、口号式 |

### 1.2 首页（营销页）—— “媒体优先，文案极短”
自上而下（top 为页面 y 坐标）：

1. **Hero banner**（y=52，高 392）：一张大视觉 + 一个 CTA，无大段介绍文案（目前是季节性促销位，结构上就是“可替换的 campaign 位”）。
2. **16:9 卡片横向轮播**（高 368）：每卡 512×288 媒体（自动播放视频）+ 48px 标题/一句说明，右侧箭头。
3. **Bento 区**（高 1661）：左 640 大卡 + 右 3×2 工具 tile（icon + 标题 + 一行说明），下接社区作品 4 列网格 + “Explore all projects”。
4. **模型/功能 Showcase 块** × 多个（每块约 976 高）：`标题 + 一句说明 + View all` → masonry 作品墙。块与块之间插入 **300px 高的功能横幅**（如 “ONE CANVAS. EVERY WORKFLOW.” + 一个按钮）打节奏。
5. **Explore more**（高 400）→ **sitemap footer**（高 852，按产品分栏）。

**可复用的规律**
- 每个 section 都是同一个模板：`eyebrow/标题 + ≤1 句说明 + “View all” 链接 + 媒体网格`。
- 说服靠**作品本身**（自动播放、hover 预览），不靠 stats 和长段落。
- 节奏 = 大媒体块 ↔ 窄横幅交替，而不是多个相同的 CTA band。

### 1.3 生成工作台 `/ai/video` —— 本次最值得借鉴的部分
```
┌──────────── 顶栏 52px ─────────────────────────────────────────┐
├─────────────┬──────────────────────────────────────────────────┤
│ 左 rail 320 │ 右画布 1080                                         │
│ ┌─────────┐ │ [History] [How it works]   ← 画布内 tabs            │
│ │模式tabs │ │                                                    │
│ ├─────────┤ │  空状态：H1 + 一句说明                               │
│ │预设卡   │ │  ┌──────┐ ┌──────┐ ┌──────┐                         │
│ │302×130  │ │  │01 加图│ │02 预设│ │03 出片│  每卡 301×320        │
│ │+Change  │ │  └──────┘ └──────┘ └──────┘  (媒体 228 + 标题 + 说明)│
│ ├─────────┤ │                                                    │
│ │上传区   │ │  底部引导条：“Don’t know where to start? → Academy”  │
│ │294×160  │ │                                                    │
│ ├─────────┤ │                                                    │
│ │Prompt卡 │ │                                                    │
│ ├─────────┤ │                                                    │
│ │Model 行 │ │                                                    │
│ │302×54   │ │                                                    │
│ ├────┬────┤ │                                                    │
│ │时长│比例│ │  ← 2 列参数 tile 147×54：小 label + 当前值，点开选择  │
│ │画质│码率│ │                                                    │
│ ├────┴────┤ │                                                    │
│ │Generate │ │  ← 底部吸附，302×48，按钮内显示消耗积分 “80”        │
│ └─────────┘ │                                                    │
└─────────────┴──────────────────────────────────────────────────┘
```
关键设计决策：
1. **输入与输出分屏**：左边永远是“怎么做”，右边永远是“结果/历史”，用户不离开页面就能“生成 → 看结果 → 调参 → 再生成”。
2. **参数折叠成 tile**：只显示“当前值”，选项进 popover，rail 高度可控。
3. **Generate 吸底 + 显示成本**：任何滚动位置都能提交，且提交前知道代价。
4. **空状态即教学**：右侧首次进入展示 3 步流程，有历史后切到 History tab。
5. **“预设”是一等公民**：以带预览视频的卡片呈现，而不是一排文字 pill。

### 1.4 Mobbin 补充：登录态的关键状态
来源：[Creating a video（11 屏流程）](https://mobbin.com/flows/d52f6d7a-66ba-4ed9-a637-0a3e9d9979c7)、[Creating a video (vibe motion)](https://mobbin.com/flows/6e075a62-3974-40f1-90e4-9e1c1e7085c6)、[Marketing studio](https://mobbin.com/flows/939f6ace-19e9-4a9d-8403-6ad67f24a77e)，以及单屏 [Image 生成页](https://mobbin.com/screens/fba5fbef-3e3c-41f5-acb9-4706ce9f706c)、[Video 预设网格](https://mobbin.com/screens/dc7524c2-a1eb-4cf4-b524-eb3a2fb4c8cb)。

| 状态 | Higgsfield 做法 | 对本项目的启发 |
|---|---|---|
| **选预设** | 点 rail 顶部预设卡的 “Change” → **右侧画布**变成预设网格（顶部模型 tabs + 搜索，卡片为带大图的竖版卡），不弹 modal | 风格选择放在右画布的样图网格里，rail 不变长 |
| **选比例** | 选项少时直接做成 **3 个图标 tile**（16:9 / 1:1 / 9:16，图标画出比例形状） | 我们正好 3 个比例 + 3 档分辨率，可直接照搬 |
| **上传** | 上传区点开是 popover，分 **Uploads / Image Generations** 两个 tab，可复用历史素材 | 可复用 `/library` 或过往任务里的照片，免重复上传 |
| **生成中** | 结果网格里先出现带 “Generating” 标签的占位卡 | 提交后在右画布插入占位卡，而不是立刻跳页 |
| **History** | **List 视图**：左边大视频，右边元数据列（模型、输入图缩略、720p / 7.0s / 16:9 chips、日期）；可切 Grid，有缩放滑杆 | 我们的任务卡可显示：源照片缩略、风格、比例、分辨率、状态 |
| **成本提示** | Generate 按钮内显示积分；另一处写 “Estimated cost: 8–60 credits” | 显示“n 张照片 · 预计 X 分钟” |
| **另一种布局** | Image / Marketing Studio 用**底部浮动输入条**（prompt + 参数 chips + 预设缩略 + Generate）压在全幅作品墙上 | 适合单 prompt 工具；我们是多图 + 每图备注，**左 rail 更合适**，不建议用这种 |
| **起始页** | Vibe Motion：“How would you like to get started?” + 5 张模板卡 + “Your projects” 空状态 | 可做“按用途开始”：房源 listing / 社媒短视频 / 作品集 |

---

## 2. 本项目现状诊断

| 区域 | 现状（文件） | 问题 |
|---|---|---|
| 登录后首页 | `AuthenticatedHome.tsx`：居中 hero 文案（badge + H1 + lede）+ 单张 `UploadCard` | 已登录用户每次都要越过营销式 hero 才到工具；首屏有效操作区小 |
| 参数控制 | `UploadCard.tsx` + `ControlRow.tsx`：上传后才 reveal 3 组全宽 pill（Style 有 11 个选项） | 上传前看不到可调什么；11 个 pill 换行拉高卡片；风格只有文字名，没有视觉预览 |
| 提交 | “Generate Video →” 在卡片最底部 | 照片多、textarea 多时需滚动才能提交；无预计耗时/成本提示 |
| 结果 | 提交后跳 `/jobs/[id]`（`JobClient.tsx`：状态 4 宫格 → 帧审核 → 下载） | 创作与结果在两个路由，回到首页参数就丢了；“改一下再来一版”路径长 |
| 历史 | 独立 `/history` 页（卡片网格） | 与创作上下文分离 |
| 营销首页 | `LandingPage.tsx`：Hero → Why stats → 3 步 → Stats+Gallery → … → Testimonials → Controls → CTA band → FAQ → Final CTA | 文字驱动；真实 before/after（`GallerySlider`）在第 4 屏左右才出现；CTA band 与 Final CTA 重复 |

---

## 3. 优化方案（按优先级）

### P0 —— 登录后首页改为「双栏工作台」（收益最大）
对应 `AuthenticatedHome` / `UploadCard` / `ControlRow`。

**布局**
- 桌面 ≥1024px：`grid-template-columns: 360px 1fr`，左 rail、右画布，高度 `calc(100vh - 顶栏)`，各自独立滚动。
- 去掉登录态的大 hero 文案；只在 rail 顶部保留一行标题（如 “New video”）。

**左 rail（自上而下）**
1. **照片上传区**：空态为虚线 dropzone；有图后变为 3 列缩略图网格 + “+”。每张图的“修改说明” textarea 从缩略图下方移到**点击缩略图后的 popover / 抽屉**里（缩略图角标显示 ✎ 表示已写说明），避免 rail 被 textarea 撑长。
2. **风格预设卡**：替代 11 个文字 pill —— 一张带样图的当前风格卡 + “Change”；点 Change 后**右侧画布切换为风格样图网格**（Higgsfield 预设网格做法），选完画布恢复。
3. **比例 / 分辨率用图标 tile**：各 3 个选项，直接做成一行 3 个 tile（比例 tile 画出形状，自动检测出的比例加 “auto” 小标）。**上传前就可见**（取消 `controls-reveal` 的隐藏逻辑，改为 disabled 态）。
4. **上传复用**：上传区增加“从 Library / 过往任务选择”的 popover tab，避免重复上传。
5. **吸底 Generate 按钮**：`position: sticky; bottom: 0`，全宽 ink pill；按钮内或下方显示“{n} 张照片 · 约 X 分钟”（若有积分体系则显示消耗）。Cancel 降级为文字按钮。

**右画布（tabs：How it works / History）**
- 首次使用：3 步空状态（上传 → 选风格 → 出片），每步一张真实样例图，复用 landing 的 step 素材。
- 有历史后默认 History tab：采用 Higgsfield 的 **List 视图**——左侧成片/首帧大图，右侧元数据列（源照片缩略、风格、比例、分辨率、状态、日期），可切 Grid。复用 `/history` 的数据，点击进入 `/jobs/[id]`。
- 提交后：右画布顶部立即插入一张“Generating”占位卡（显示当前阶段），而不是马上跳页。
- 可选（后续）：把任务进度/帧审核直接嵌入右画布，实现“不离页”。`JobClient.tsx` 有 682 行、含审核与评分逻辑，**本提案不展开**，建议先做 History 内嵌、保留跳转。

**响应式（推断，未实测）**
- <1024px：单列，rail 在上、画布在下；Generate 改为底部固定条（safe-area 内边距）。

### P1 —— 营销首页改为「作品优先」
对应 `LandingPage.tsx` 及 `landingData.ts`。

1. **Hero**：保留一句标题 + 一个 CTA，但背景换为**自动播放的成片视频**（或 before→after 循环），删减副标题长度。
2. **紧接 hero 放作品轮播**：把 `GallerySlider`（before/after）提到第 2 屏，采用 16:9 卡片横向滚动（卡宽约 1/3 内容宽，下方 1 行标题+1 行说明）。
3. **统一 section 模板**：`lp-label + lp-display-lg 标题 + 1 句说明 + “查看全部”链接 + 媒体网格`，所有 section 套用，减少每段自定义结构。
4. **压缩文字段**：Why stats 缩成 hero 下方的一条数据带（3 个数字一行）；Controls 4 卡改为 bento（1 大 3 小，大卡放风格网格样图）。
5. **CTA 去重**：保留 hero CTA + 页尾一个 final CTA，中间的 `lp-cta-band` 改为 300px 级的窄横幅（类似 Higgsfield “ONE CANVAS” 条），或直接删除。
6. **建议顺序**：Hero → 作品轮播 → 3 步（带真实素材）→ 风格 bento → Testimonials → Pricing/Comparison → FAQ → Final CTA。

### P2 —— 视觉风格（品牌决策，需要你拍板，不建议默认执行）
Higgsfield 的“深色画布 + 荧光 CTA + 大写压缩标题”适合创作者工具调性，但与 `DESIGN.md` 的编辑风规范冲突。可选：
- **A. 维持现状**：浅色编辑风，只做 P0/P1 布局改造（推荐，风险最低）。
- **B. 工作台局部深色**：仅登录后工作台用深色画布突出媒体，营销页保持浅色。需在 `DESIGN.md` 增补 dark surface token。
- **C. 全站转深色创作者风**：需重写 `DESIGN.md` 和 color token，工作量大。

---

## 4. 实施约束与顺序
- 新组件/页面使用同目录 `*.module.css`，不扩展全局 `app/styles.css`；间距/圆角用 `var(--space-*)`、`var(--radius-*)`，颜色用现有变量（见 `docs/STYLING.md`）。提交前跑 `npm run lint:css`、`npm test`、`npm run typecheck`，并在浏览器验证。
- 建议拆分：
  1. `WorkspaceLayout`（双栏骨架 + sticky Generate）
  2. `SettingTile` + popover（替换 `ControlRow`）
  3. `StylePresetPicker`（带缩略图）
  4. 右画布 `HowItWorks` 空状态 + `RecentJobs`（复用 history 数据）
  5. Landing 重排（P1）

## 5. 待补充
- 用 Mobbin 横向对照同类产品（Runway、Pika、Krea）的生成中 / 结果页状态。
- 移动端实测（390px）`/ai/video` 的 rail 折叠方式。
