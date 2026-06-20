# AuraSeal 设计系统

> v1.0 收口。所有视觉常量集中在 `src/styles.css` 的 `:root` token,组件只引用 token,禁止裸 hex/魔法数。

## Design Tokens

| 类别 | Token                                                                        | 说明                                                         |
| ---- | ---------------------------------------------------------------------------- | ------------------------------------------------------------ |
| 间距 | `--space-1..6`                                                               | 4px 基线(4/8/12/16/24/32)                                    |
| 圆角 | `--radius-sm/md/lg/pill`                                                     | 容器用 lg、控件用 md、内嵌用 sm、chip 用 pill,拉开层级       |
| 字号 | `--text-2xs..2xl` / `--text-hero`                                            | type scale;数字密集处加 `font-variant-numeric: tabular-nums` |
| 阴影 | `--shadow-1/2/3`                                                             | elevation 三档                                               |
| 表面 | `--bg` `--surface-video` `--glass` `--glass-strong` `--fill` `--fill-strong` |                                                              |
| 描边 | `--line` `--line-strong`                                                     |                                                              |
| 文本 | `--text` `--text-soft` `--text-secondary` `--on-accent`                      |                                                              |
| 强调 | `--accent` `--accent-strong` `--accent-soft`                                 |                                                              |
| 危险 | `--danger` `--danger-text` `--danger-bg` `--danger-border`                   |                                                              |

字体:自托管 `Inter Variable`(拉丁)+ 中文系统字体回退,`font-display: swap` + preload。

## 无障碍

- 全局 `:focus-visible` 焦点环(`outline: 2px solid var(--accent)`)。
- 交互态用 `aria-pressed`(模式切换/音效/BGM);浮层用 `role="dialog"` + `aria-modal`。
- 动画统一遵守 `prefers-reduced-motion`。

## 特效色板(VFX Palette)

每个特效有 5 层语义色(`EffectPalette`):`core / mid / rim / spark / glow`,按 element(qi/fire/lightning/ice/gold/wood/blade)分色系。皮肤(`src/play/skins.ts`)通过 HSL 色相旋转整体重染。

## 关键组件

- `HeaderBar` / `StatusBar` — 顶/底状态与控制
- `CaptureBar` — 底部拇指热区拍摄工具(截图/录制/作品)
- `ScoreHUD` — 分数/连击/评级
- `GestureHintBar` / `Onboarding` — 引导与提示
- `ScreenshotPreview` / `WorksGallery` — 成片预览与作品库
- `HitFeedback` — 命中反馈(flash/环/shake)
- `SealMark` — 品牌灵印母题
- `StatsOverlay` — 开发调试浮层(Shift+D)

## 响应式

- 桌面:浮动面板 + 顶栏控制。
- 移动(≤860px):面板转底部 sheet,拍摄控制在底部拇指热区,`100dvh` + `env(safe-area-inset-*)` 适配刘海/地址栏。

## 性能预算(CI 守护)

- 首屏 entry chunk gzip ≤ 200KB(`npm run size`,超标 CI 红)。
- `three` 经 `React.lazy` + `manualChunks` 拆分,授权后再加载。
- 识别 FPS 自适应降级(检测间隔 + actor 上限按 fps 阶梯调整)。

## 上线 / 收录

- `public/robots.txt` + `public/sitemap.xml`(部署后替换为真实域名)。
- `index.html` 含 Google / Baidu 站点验证 meta。
- 部署头:`vercel.json` / `netlify.toml` 提供 SPA fallback + 长缓存 + HTTPS。

## 隐私

- MediaPipe WASM + 模型同源自托管(`scripts/prepare-assets.mjs`),运行时不连第三方 CDN;`本地推理 · 视频不上传`可在网络面板验证。
