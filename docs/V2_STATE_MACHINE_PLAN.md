# V2 状态机改造清单

目标不是“加更多内容”，而是让现有内容更稳。

V2 的核心目标只有一句话：

**把主线推进、任务切换、地图解锁、NPC 状态和关键事件，从 AI 自由发挥里收回本地。**

---

## 1. V2 要解决什么问题

当前版本已经能玩，但风险也很明确：

- 主线推进仍有一部分依赖文本触发
- AI 仍可能越权修改关键状态
- 某些事件触发靠关键词，后期会越来越脆
- 章节感还不够强

所以 V2 不要先扩剧情，而要先做“稳定器”。

---

## 2. V2 总体原则

### 本地必须接管

- 章节状态
- 主线任务状态
- 地点解锁
- NPC 出现/发现/加入/离队
- Boss 出场与战斗触发
- 关键奖励发放
- 章节收尾条件

### AI 保留权限

- 场景描述
- 非关键 NPC 对话
- 战斗 narration
- 同一事件的语言变化
- 支线味道与临场气氛

### AI 禁止权限

- 擅自跳章
- 擅自发关键武学
- 擅自放开地图
- 擅自完成主线任务
- 擅自改 NPC 命运

---

## 3. 建议先做的状态机层

建议新增一个清晰的“剧情进度层”，哪怕先做简版。

可以理解成：

- `chapterState`
- `storyFlags`
- `questStateMap`
- `locationUnlocks`
- `npcStateMap`

---

## 4. 章节状态

先给主线加最小章节结构。

建议结构：

```ts
type ChapterId = "wanderer_ch1" | "wanderer_ch2";

type ChapterStage =
  | "not_started"
  | "intro"
  | "investigation"
  | "combat"
  | "reveal"
  | "resolved";
```

当前 `无名客` 可以先拆成：

### 第一章：碎瓷夜痕

- `intro`
- `track_shadow`
- `black_assassin_fight`
- `tea_house_followup`
- `to_gusu`
- `dock_infiltration`
- `chapter_resolved`

这样以后任何 UI、任务、地图、NPC，都看这个状态决定，而不是靠 AI 猜。

---

## 5. 任务状态机

建议每个任务都从“文本数组”升级成更明确的数据结构。

至少包含：

- `id`
- `title`
- `status`
- `stage`
- `prerequisites`
- `completionTriggers`
- `rewards`

示意：

```ts
type QuestStatus = "locked" | "active" | "resolved" | "failed";

interface QuestNode {
  id: string;
  title: string;
  status: QuestStatus;
  stage?: string;
  prerequisites?: string[];
  completionTriggers?: string[];
  rewards?: {
    items?: string[];
    unlockLocations?: string[];
    npcDiscoveries?: string[];
  };
}
```

这样做的好处是：

- 测试时能直接看任务状态
- 存档更稳定
- 后面加第二出身时不会乱成一团

---

## 6. 地图解锁状态

当前地图已经有 `unlocked`，V2 要把“为什么解锁”也变明确。

建议给每个地点增加解锁来源概念：

- 初始开放
- 任务推进开放
- NPC 指引开放
- 物品线索开放

例如：

- `无量山`：初始开放
- `大理城`：初始开放
- `姑苏`：茶肆对证后开放，或直接作为下一步强制目标
- 后续地点：只能由明确剧情 flag 解锁

这样 AI 就算文本里提到某地点，也不能直接让它可去。

---

## 7. NPC 状态机

NPC 建议从“只有 discovered / companion”进一步细化。

最小可做成：

```ts
type NpcStoryState =
  | "hidden"
  | "rumored"
  | "revealed"
  | "available"
  | "companion"
  | "departed";
```

举例：

### 阿朱

- `hidden`
- 茶肆线触发后 -> `revealed`
- 对证完成后 -> `available`

### 王语嫣

- 到姑苏并完成前置线索后 -> `revealed`

这样“谁什么时候出现”就不再交给 AI 瞎猜。

---

## 8. 事件触发器

V2 非常建议把关键推进点改成明确触发器。

不要继续主要依赖：

- 用户输入里含某些词
- AI 返回某种模糊 patch

建议改成：

- `onFirstAction`
- `onCheckSuccess("track_shadow")`
- `onCombatWin("black-assassin")`
- `onUseClue("ledger-fragment")`
- `onArrive("gusu")`

也就是：

**关键事件要靠本地事件名推进，不靠自由文本猜。**

---

## 9. 战斗状态机

当前战斗已经比之前稳了，但 V2 可以继续收紧。

建议战斗最少包含：

- `combatId`
- `enemyId`
- `round`
- `combatPhase`
- `stakes`

其中 `combatPhase` 可分：

- `opening`
- `exchange`
- `enemy_pressure`
- `player_advantage`
- `finisher`
- `ended`

这样本地就能控制：

- 什么时候该给 `pendingCheck`
- 什么时候该退战
- 什么时候该结算掉落或任务推进

---

## 10. AI Patch 收口

V2 最重要的一步之一：

**不要让 AI 直接自由写所有 patch。**

建议改成“白名单 patch”。

比如 AI 可以建议：

- `tone`
- `sceneFlavor`
- `enemyIntent`
- `systemNote`
- `pendingCheckText`

但这些本地必须二次验证：

- `questUpdates`
- `location`
- `combatAction`
- `npcUpdates`
- `objectiveUpdate`

也就是：

**AI 可以提议，本地决定是否执行。**

---

## 11. 数据结构改造优先级

建议按这个顺序做，不要一口气全翻：

### 第一优先级

- 章节状态
- 任务状态
- 地点解锁来源

### 第二优先级

- NPC 故事状态
- 战斗阶段状态
- 关键事件触发器

### 第三优先级

- AI patch 白名单验证
- 更细的支线状态

---

## 12. V2 实施顺序

建议按下面顺序推进：

1. 给 `无名客` 第一章补完整章节 stage
2. 把当前几个主线任务改成明确 quest node
3. 把姑苏线的推进改成事件触发
4. 给关键 NPC 加状态字段
5. 给 Boss / 战斗加 `combatId` 和 `round`
6. 收紧 AI patch 权限
7. 再做第二轮测试

---

## 13. V2 完成标准

做到下面这些，就算 V2 成功：

- 主线推进不依赖 AI 临时发挥
- 任务切换清晰可追踪
- 地图不会乱解锁
- NPC 不会乱出现
- 战斗结束条件明确
- 存档恢复后状态一致
- AI 文本乱一点也不会把世界状态带崩

---

## 14. V2 之后再做什么

只有 V2 稳了，才建议开始：

- 第二出身
- 第三出身
- 多同伴路线
- 更复杂的 Boss 分支
- 多结局
- 更自由的 AI 支线

顺序不要反。

不然内容越多，后面收拾起来越痛。

---

## 15. 一句话结论

V2 不是“做得更花”，而是：

**把这个项目从“能玩原型”推进到“可维护游戏”的关键一步。**
