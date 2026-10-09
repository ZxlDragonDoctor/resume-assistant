# 前端设计系统

本文档说明「晓龙简历」前端的视觉规范与工程约定。所有 UI 代码都应遵循这里的规则，避免样式散落。

---

## 1. 设计令牌（Design Tokens）

**唯一来源**：`src/styles/tokens.ts`

任何颜色、间距、圆角、阴影都必须从这里取值。组件内**不允许**出现魔法色值。

```ts
import { brand, neutral, radius, shadow, transition } from '../styles/tokens';
```

| 令牌组 | 说明 | 常用值 |
|---|---|---|
| `brand` | 品牌色 | `primary #4F46E5`、`gradient` 主按钮渐变 |
| `semantic` | 语义色 | `success #10B981`、`warning #F59E0B`、`danger #EF4444`，另有 `warningStrong` / `dangerStrong` 供浅底正文保证对比度、`highlight` 供荧光笔 |
| `neutral` | 中性色阶（Slate） | `0` ~ `950`，另有 `25` / `150` 两个补充档 |
| `text` | 文字色 | `primary` = `neutral[900]`，`secondary` = `neutral[600]` |
| `space` | 间距（4px 基准） | `xs 4` → `giant 56` |
| `radius` | 圆角 | `xs 4` → `pill 999` |
| `shadow` | 阴影 | 含专用的 `shadow.paper`（A4 纸张投影） |
| `fontSize` | 字号 | `xs 11` → `hero 44` |
| `layout` | 布局常量 | 见下方「A4 尺寸」 |
| `resumePalette` | 简历主题色板 | 14 个配色 |
| `textPalette` | 简历正文色板 | 5 档灰/黑，`StylePanel` 的正文颜色预设 |
| `fontOptions` | 简历字体选项 | 9 个，含 `value` 与 `stack` |

> **关于 `resumePalette` / `textPalette` 里的 hex 字面值**：这两个是「用户可选的颜色预设」，
> 其值会被直接写进简历数据（`resume_sections.data._config`），必须保持真实的 hex，
> 不能替换为令牌引用。它们是全站**唯一**允许出现颜色字面值的、且在 `tokens.ts` 内部的位置。

**当前状态（已核查）**：`src/pages`、`src/components`、`src/utils`、`src/constants` 下
硬编码六位色值数量为 **0**。新增组件请保持该约束。

**CSS 变量**：`src/styles/global.css` 把同一套令牌映射为 `--brand-primary`、`--n-700`、`--r-lg` 等变量，供原生 CSS 与 antd 覆盖使用。两处必须保持同步。

---

## 2. A4 尺寸约定

简历纸张是产品的核心尺度，所有相关代码必须使用同一组常量：

```ts
layout.pageWidth     // 794  —— A4 @96dpi
layout.pageMinHeight // 1123
```

`.resume-paper`（定义于 `global.css`）固定为 `794 × 1123`。

**缩放原则**：缩放只作用于 `transform: scale()`，**绝不改变纸张的真实尺寸**。因此导出 PDF 时完全不受编辑期缩放影响。

```tsx
// 正确：外层容器承担缩放后的布局尺寸，内层做 transform
<div style={{ width: pageWidth * scale, height: pageMinHeight * scale }}>
  <div style={{ width: pageWidth, transform: `scale(${scale})`, transformOrigin: 'top left' }}>
    <ResumePreviewEngine ... />
  </div>
</div>
```

---

## 3. 三级样式覆盖

简历排版采用三级优先级，**后者覆盖前者**：

```
模板默认 (TemplateConfig)  <  全局布局 (resume.layoutConfig)  <  模块级 (section.data._config)
```

- **模板默认**：`Template.config` —— 主色、标题样式、推荐版式
- **全局布局**：`resume.layoutConfig`（JSON）—— 字体、页面边距、模块间距
- **模块级**：`section.data._config`（`SectionConfig`）—— 单个模块的标题样式、字号、颜色、对齐

模块级配置的读写统一走 `src/components/editor/sectionData.ts`：

```ts
readConfig(data)                    // 读取 _config
writeConfig(data, patch)            // 写入 _config（保留业务字段）
clearConfigKeys(data, keys)         // 重置指定键
```

**关键约束**：内容编辑器任何时候都不得丢弃 `_config`。`SectionContentEditor` 的所有
`onChange` 都是在完整 `data` 上展开，因此样式设置不会被内容编辑覆盖。

---

## 4. 渲染契约（重要）

简历有**两个**渲染器，二者必须遵守同一套规则：

| 渲染器 | 位置 | 用途 |
|---|---|---|
| React 引擎 | `src/components/viewer/ResumePreviewEngine.tsx` | 编辑器实时预览、分享页 |
| Node 渲染器 | `export-service/src/renderer.js` | PDF 导出 |

**为什么不用同一份代码**：React 引擎在浏览器里跑，导出服务在 Node 里用 Puppeteer 跑，
无法共享组件。因此约定：

1. **全内联样式** —— 两个渲染器都不依赖外部 CSS 文件，确保导出时样式不丢
2. **规则镜像** —— 任一侧修改渲染规则，必须同步另一侧
3. **可验证** —— 用契约测试锁住行为：

```bash
cd export-service && npm run test:contract
```

该测试覆盖 21 项断言：模块配置生效、隐藏模块过滤、`hideTitle` 语义、
富文本、A4 容器尺寸、双栏容量分配、手动栏位优先级、首屏页眉占高与多页续排。

> 修改任一渲染器后，务必运行此测试。

---

## 5. 版式、模块分栏与分页

全局版式保存在 `resume.layoutConfig.layout`，优先级高于模板推荐版式。样式面板提供单栏、双栏和侧边栏：

- **单栏**：模块按排序顺序纵向排列。
- **双栏**：自动模块按阅读顺序先填左栏，放不下再进入右栏；两栏都满后，在下一页从左栏继续。首屏会扣除姓名与联系信息页眉占用的高度。
- **侧边栏**：技能、奖项、证书和自定义模块默认进入窄栏，其余进入主栏。

选中模块后可在「模块栏位」设置 **自动 / 左栏 / 右栏**。固定栏位优先于自动流排；侧边栏模式下对应「自动 / 侧边栏 / 主内容区」。这些选择写入模块的 `layout`，不会改变模块排序。

双栏预览先以内容估算栏高，再用浏览器实际测量校准；PDF 导出端镜像同样的容量分配规则。修改分页或分栏逻辑时，需同时检查 `ResumePreviewEngine.tsx` 与 `export-service/src/renderer.js`，并运行 21 项渲染契约测试。当前明确的自动多页续排规则针对双栏模式。

---

## 6. 富文本三态处理

`src/components/viewer/RichText.tsx` 统一处理三种输入形态，保证「用户怎么填，预览/导出就怎么显示」：

| 输入 | 判定 | 渲染 |
|---|---|---|
| HTML | 含 `<tag>` | 直接注入（来自 TipTap） |
| Markdown | 有 `#`、`-`、`**`、`` ` `` 等语法特征 | ReactMarkdown |
| 纯文本 | 其他 | 转义 + 保留换行 |

辅助函数 `plainText()` / `stripHtml()`（`src/utils/thumbnail.ts`）用于提取纯文本，
供字数统计与 AI 输入使用。

---

## 7. 编辑器布局

三栏工作台（`src/pages/Editor.tsx`）：

```
┌──────────┬────────────────────┬──────────┬──────────────┐
│ 模块管理  │  内容编辑           │  预览     │ 样式/AI/版本  │
│ 232px    │  flex 1             │  flex 1  │ 320px        │
└──────────┴────────────────────┴──────────┴──────────────┘
```

窄屏（`< 1280px`）由 `global.css` 中的 `.editor-workspace` 媒体查询改为上下堆叠。

**状态编排**：`Editor.tsx` 是唯一的状态编排者。子面板（`SectionSidebar`、`SectionContentEditor`、
`SectionStylePanel` 等）都是**完全受控**的——它们只上报意图，不直接调用 store。

**保存策略**：

| 操作 | 策略 |
|---|---|
| 内容编辑 | 本地乐观更新 → 800ms 防抖落库 |
| 样式调整 | 本地更新 → 400ms 防抖落库（改动明确） |
| 模块增删改 | 立即落库 |
| `Ctrl+S` | 立即 flush 全部草稿 |

---

## 8. 全局 CSS 类

`src/styles/components.css` 只放**无法用内联样式表达**的规则（伪元素、hover、媒体查询）：

| 类名 | 用途 |
|---|---|
| `.section-item` | 模块栏条目（`:hover`、`.is-active`、`.is-dragging`） |
| `.section-toolbar` | 悬浮才显现的操作条 |
| `.template-card` | 模板卡片悬浮上浮 |
| `.resume-card` | 简历卡片悬浮 + 遮罩淡入 |
| `.color-swatch` | 色板方块（`.is-selected` 双环） |
| `.score-ring` | ATS 评分环的描边动画 |
| `.toolbar-divider` | 工具栏竖分隔线 |
| `.thin-scroll` | 紧凑区域细滚动条 |

**注意**：`.resume-paper` 与 `.resume-rich` 的定义同时出现在 `global.css` 与
`RichText.tsx` 的内联 `<style>` 中。前者供分享页/打印使用，后者保证导出时样式内联。
修改时需同时检查。

---

## 9. 组件分层

```
components/
├── common/       通用原子组件（SectionIcon, AuthGuard）
├── layout/       全局外壳（AppLayout, Logo）
├── editor/       编辑器专用
│   ├── SectionSidebar         模块管理（拖拽排序）
│   ├── SectionContentEditor   按模块类型分发的表单
│   ├── EditorControls         通用控件（Field/SliderField/ColorPicker）
│   ├── sectionData.ts         data 不可变更新助手（纯函数）
│   ├── StylePanel             模块级 + 全局样式面板
│   ├── AiPanel                AI 助手（含 AiOptimizeModal）
│   ├── VersionPanel           版本时间线
│   ├── PreviewPanel           A4 预览 + 缩放控制
│   ├── ExportDialog           导出 PDF
│   └── ShareDialog            分享链接
├── viewer/       渲染引擎（ResumePreviewEngine, RichText）
├── templates/    模板预览（TemplatePreview）
├── dashboard/    仪表盘组件（StatCards, ResumeThumbnail）
└── home/         首页组件（HeroPreview）
```

**约定**：`editor/` 下的组件一律不直接读写 store，全部通过 props 上报。

---

## 10. 路由与代码分割

`src/App.tsx`：首页与登录页**静态导入**（首屏必需），其余页面 **懒加载**：

```tsx
const Editor = lazy(() => import('./pages/Editor'));
```

编辑器 chunk 最大（含 TipTap + dnd-kit + 预览引擎），单独拆分后首屏显著变轻。

`FULLSCREEN_ROUTES = ['/editor/', '/share/']` 绕过 `AppLayout` 外壳。

---

## 11. 新增页面检查清单

- [ ] 颜色/间距从 `tokens.ts` 取值，无硬编码
- [ ] 需要登录 → 用 `<AuthGuard>` 包裹
- [ ] 是重型页面 → 在 `App.tsx` 里用 `lazy()` 导入
- [ ] 需要全屏 → 加入 `FULLSCREEN_ROUTES`
- [ ] 用 antd 组件时检查 `theme.ts` 是否已定制
- [ ] 运行 `npm run build`，确认零 TS 错误

## 12. 新增简历模块检查清单

- [ ] 在 `types/resume.ts` 的 `SectionType` 中加入类型
- [ ] 在 `constants/sections.ts` 的 `SECTION_META` 中补充元数据（label/icon/hint/listLike）
- [ ] 在 `stores/resumeStore.ts` 的 `EMPTY_SECTION_DATA` 中加入空数据结构
- [ ] 列表型模块 → 同时补 `NEW_ITEM_TEMPLATE`
- [ ] 在 `SectionContentEditor.tsx` 中实现编辑表单
- [ ] **在 `ResumePreviewEngine.tsx` 与 `export-service/src/renderer.js` 中同步渲染规则**
- [ ] 运行 `npm run test:contract`（export-service）验证
