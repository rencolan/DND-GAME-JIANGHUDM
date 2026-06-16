# 江湖 DM

移动端武侠 DND AI DM 原型，使用 React + TypeScript + Vite 构建。

## 运行

```bash
npm install --cache .npm-cache
npm run dev
```

同一局域网内，打开终端输出的 Network 地址后，可在 iPhone Safari 中访问并添加到主屏幕。

## 远程游玩

电脑和手机不在同一局域网时，把项目部署成 HTTPS 静态网页即可远程游玩。游戏存档和 API Key 都保存在手机浏览器本地，导出存档不会包含 API Key。

推荐方式：

1. Netlify：把整个项目目录上传或连接仓库，构建命令填 `npm run build`，发布目录填 `dist`。项目已包含 `netlify.toml`。
2. Vercel：导入项目后使用默认配置即可，项目已包含 `vercel.json`。
3. 任意静态空间：本地运行 `npm run build`，上传 `dist/` 目录里的全部文件。

发布后，用 iPhone Safari 打开公网地址，在设置里填写兼容 OpenAI Chat Completions 的 `API 地址`、`模型`、`API Key`，即可让 AI 做 DM。

## 已实现

- 主聊天区、底部输入栏、骰子弹层、人物状态抽屉。
- 开局界面：继续存档、选择天龙人物、自创角色。
- 自创角色：出身模板 + 自由点数分配。
- 人物、背包、同伴、地图、关系、API 设置、存档导入导出。
- 8 名重点人物原创本地 SVG 立绘：段誉、乔峰、慕容复、虚竹、王语嫣、阿朱、木婉清、双儿。
- 本地水墨背景、纸纹、地图资源，无外链素材依赖；双儿与地图已加入国风二次元/游戏素材测试版。
- OpenAI 兼容接口配置。
- AI 回复末尾 JSON 指令块解析，自动同步生命、内力、经验、背包、地点、任务、关系、战斗状态和 NPC 动向。
- NPC 混合推进：普通行动只推进相关人物，每 4 步触发一次世界推进。
- 无 API Key 或 API 失败时自动切回本地演示 DM。
- 二期测试中双儿开局可见，便于测试同伴、关系与立绘流程；正式版可恢复隐藏伙伴规则。

## 构建

```bash
npm run build
```

构建产物在 `dist/`。

## API JSON 示例

```json
{
  "hpChange": -3,
  "qiChange": -2,
  "xpGain": 20,
  "location": "姑苏",
  "combatAction": "enter",
  "enemyName": "黑衣刺客",
  "newItem": { "id": "needle", "name": "银针", "desc": "刻有云纹", "count": 1, "type": "quest" },
  "relationshipChanges": [{ "name": "乔峰", "delta": 3, "attitude": "敬重" }],
  "npcUpdates": [{ "name": "慕容复", "location": "姑苏", "goal": "追查英雄帖", "lastSeen": "燕子坞" }],
  "systemNote": "远方人物开始行动。"
}
```

导出的存档不会包含 API Key。
