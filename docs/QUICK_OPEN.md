# 快捷打开

项目根目录新增了一个 Windows 启动器：

- [打开游戏.bat](/E:/Documents/DND/打开游戏.bat)

作用：

- 自动检查 `node_modules`
- 如果没装依赖，会先执行 `npm install --cache .npm-cache`
- 自动启动本地 Vite 开发服务
- 自动打开默认浏览器到 `http://127.0.0.1:5173/`

适用场景：

- 本机快速试玩
- 接本地 LLM
- 调整数据后立刻刷新查看效果

说明：

- 这个启动器面向 Windows
- 会额外打开一个命令行窗口来跑 `npm run dev`
- 关闭那个命令行窗口，本地游戏服务也会停止
