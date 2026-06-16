# 清理候选清单

这份清单按“删掉后会不会影响现在这版可玩测试”来分。

## A. 可直接删除，不影响当前试玩

这些都是构建缓存、旧发布尝试或历史打包产物，删掉后不会影响当前源码运行：

- `.npm-cache/`
- `vite-dev.log`
- `vite-dev.err.log`
- `netlify-one-html-blob/`
- `netlify-one-html-eval/`
- `netlify-single-file-safe/`
- `old-deploy-files-to-delete/`
- `jianghu-dm-one-html-eval.zip`

## B. 可删除，但之后需要时可重新生成

- `dist/`

说明：
- 这是当前打包输出目录。
- 如果你准备继续用 `npm run dev` 做第一轮测试，可以删。
- 如果你想直接拿静态产物去部署或备份，先留着。

## C. 当前已完成转存，原始素材可按需删除

- `sucai/Seven_Peaks_at_Twilight.mp3`

说明：
- 游戏当前实际使用的是 `public/assets/bgm/Seven_Peaks_at_Twilight.mp3`
- 所以 `sucai/` 里的这份已经不是运行必需品
- 如果你想保留“原始素材箱”，也可以继续留着

## D. 可选清理：旧立绘回退资源 / 预览资源

下面这些文件当前这版基本没有运行依赖，属于可选保留项：

- `public/assets/portraits/a-zhu.svg`
- `public/assets/portraits/duan-yu.svg`
- `public/assets/portraits/mu-wanqing.svg`
- `public/assets/portraits/murong-fu.svg`
- `public/assets/portraits/qiao-feng.svg`
- `public/assets/portraits/shuang-er.svg`
- `public/assets/portraits/wang-yuyan.svg`
- `public/assets/portraits/xu-zhu.svg`
- `public/assets/portraits/shuang-er-hk-preview.png`

说明：
- 当前代码优先使用对应 PNG 立绘
- `shuang-er-hk-preview.png` 是预览稿，不是当前正式绑定图
- 如果你还想保留“备选图”和“回退图”，就先别删

## E. 暂时建议保留

这些是当前工程运行、构建或部署描述会直接用到的：

- `src/`
- `public/`
- `index.html`
- `package.json`
- `package-lock.json`
- `tsconfig.json`
- `vite.config.ts`
- `README.md`
- `netlify.toml`
- `vercel.json`

## F. 一个容易混淆的文件

- `manifest.webmanifest`（项目根目录）

这个文件看起来像和 `public/manifest.webmanifest` 重复。
当前这版建议先保留，等第一轮测试稳定后，再统一处理 manifest 来源，避免误删后影响 PWA/图标行为。
