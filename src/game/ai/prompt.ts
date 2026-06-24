import type { GameState, Npc, SceneType } from "../../types";

export type CombatNarrationContext = {
  stage: "player_check" | "player_escape" | "player_hit_confirmed" | "player_damage" | "enemy_turn_start" | "enemy_turn_end" | "turn_end";
  actorName: string;
  targetName: string;
  round: number;
  locationName: string;
  sceneLabel: string;
  actionText?: string;
  actionLabel?: string;
  checkLabel?: string;
  naturalRoll?: number;
  total?: number;
  dc?: number;
  hit?: boolean;
  critical?: boolean;
  damage?: number;
  damageDice?: string;
  damageBonus?: number;
  heroHpBefore?: number;
  heroHpAfter?: number;
  enemyHpBefore?: number;
  enemyHpAfter?: number;
  enemyStatusBefore?: string[];
  enemyStatusAfter?: string[];
  enemyStatusChange?: string;
  playerStatusBefore?: string[];
  playerStatusAfter?: string[];
  playerStatusChange?: string;
  enemyIntent?: string;
  nextPhase?: string;
};

const sceneLabels: Record<SceneType, string> = {
  temple: "寺院",
  market: "市集",
  tavern: "酒肆",
  brothel: "青楼",
  inn: "客栈",
  palace: "宫苑"
};

const stageLabels: Record<CombatNarrationContext["stage"], string> = {
  player_check: "玩家判定结果",
  player_escape: "玩家脱身结果",
  player_hit_confirmed: "玩家命中，等待伤害",
  player_damage: "玩家伤害结算",
  enemy_turn_start: "敌方起手",
  enemy_turn_end: "敌方结果",
  turn_end: "回合收束"
};

function currentLocation(state: GameState) {
  return state.locations.find((location) => location.current)?.name || "未知地点";
}

function abilityMod(value: number) {
  return Math.floor((value - 10) / 2);
}

function relationshipTierLabel(value: number) {
  if (value >= 80) return "生死相托";
  if (value >= 65) return "亲近";
  if (value >= 50) return "信任";
  if (value >= 35) return "熟悉";
  return "陌生";
}

function isVisibleNpc(npc: Npc) {
  return !npc.hidden || npc.discovered || npc.companion;
}

function compact(text: unknown, max = 120) {
  const value = String(text ?? "").replace(/\s+/g, " ").trim();
  return value.length > max ? `${value.slice(0, max)}...` : value;
}

function compactNpcSummary(state: GameState, globalUpdate: boolean) {
  const here = currentLocation(state);
  return state.npcs
    .filter(isVisibleNpc)
    .filter((npc) => globalUpdate || npc.location === here || npc.companion)
    .slice(0, globalUpdate ? 8 : 5)
    .map((npc) => `${npc.name}@${npc.location}${npc.companion ? "/同行" : ""}:${relationshipTierLabel(npc.relationship)}:${compact(npc.attitude || npc.status, 28)}`)
    .join("；") || "无";
}

function compactAbilities(state: GameState) {
  return state.character.abilities
    .map((ability) => `${ability.key}${abilityMod(ability.value) >= 0 ? "+" : ""}${abilityMod(ability.value)}`)
    .join(",");
}

function compactMartialArts(state: GameState) {
  return state.character.martialArts
    .slice(0, 10)
    .map((art) => {
      const tags = art.tags?.length ? `/${art.tags.join("|")}` : "";
      return `${art.name}(${art.linkedAbility},${art.damageDice},qi${art.baseQiCost}${tags})`;
    })
    .join("；") || "无";
}

function compactStudies(state: GameState) {
  const studies = state.pendingStudies
    ?.slice(0, 5)
    .map((entry) => `${entry.name}${entry.progress}/${entry.requiredProgress}`)
    .join("；");
  return studies || "无";
}

function compactInternalStyles(state: GameState) {
  const styles = state.internalStyles
    ?.slice(0, 4)
    .map((entry) => `${entry.name}Lv${entry.masteryLevel}`)
    .join("；");
  return styles || "无";
}

function compactRumors(state: GameState) {
  return state.rumors
    .slice(-3)
    .map((rumor) => compact(rumor.text, 48))
    .join("；") || "无";
}

function combatLine(state: GameState) {
  if (!state.combat.active) return "无";
  return `${state.combat.enemy} HP${state.combat.enemyHp}/${state.combat.enemyMaxHp} Qi${state.combat.enemyQi}/${state.combat.enemyMaxQi} AC${state.combat.enemyAc ?? "?"} phase=${state.combat.phase || "?"} round=${state.combat.round || 1} 状态=${(state.combat.enemyStatus || []).join("|") || "无"}`;
}

function pendingLine(state: GameState) {
  const check = state.pendingCheck
    ? `检定:${state.pendingCheck.label},${state.pendingCheck.abilityKey},DC${state.pendingCheck.dc},${state.pendingCheck.rollMode || "normal"}`
    : "";
  const damage = state.pendingDamage
    ? `伤害:${state.pendingDamage.label},${state.pendingDamage.damageDice}`
    : "";
  return [check, damage].filter(Boolean).join("；") || "无";
}

export function buildSystemPrompt(state: GameState, globalUpdate: boolean) {
  return `你是武侠文字游戏的 AIDM。目标：短叙事 + 结构化建议，不接管本地数值规则。

硬规则：
- 本地代码权威：战斗、骰子、HP/Qi、银两、背包、关系数值、内伤数值。
- 你只能建议检定/世界动作；不要直接改钱、物品、好感、伤害、内伤。
- 战斗中不得改写命中、伤害、暴击、HP、回合顺序。
- 不输出思维链，不输出<think>，不要长篇解释。
- 玩家要掷骰时，用 proposedCheck；商贸/偷窃/客栈等用 proposedWorldAction。

非战斗属性选择：
- str/力道：破门、硬闯、搬扛、擒拿、正面压制。
- dex/身法：潜行、翻窗、闪避、抢位、轻功、绕后、贴近不露声色。
- con/根骨：抗毒、忍伤、长途硬撑、熬住环境压力。
- int/悟性：账册、文字、机关、阵法、地图、暗号、武学门路、逻辑推演。
- wis/心境：观察足迹、脚印、血迹、泥土草叶、听声辨位、察觉埋伏、感知异样、稳住心神、调息疗伤。
- cha/气运：说服、套话、交涉、安抚、讲价、威吓、欺瞒、求人。
例如“查看足迹/搜索痕迹/听周围动静”应建议 wis/心境，不要建议 int/悟性。
非战斗 DC 由本地根据任务难度、时间压力、线索清晰度、对象强弱和玩家方法重算；你可以写 reason，但不要把 dc 当最终裁定。

当前摘要：
章节=${state.chapter}/${state.chapterState.stage}；时间=第${state.worldDay}天${state.timeSlot}；地点=${currentLocation(state)}；场景=${sceneLabels[state.sceneType]}
目标=${compact(`${state.objective.title}：${state.objective.text}`, 90)}
主角=${state.character.name} HP${state.character.hp}/${state.character.maxHp} Qi${state.character.qi}/${state.character.maxQi} AC${state.character.ac} 内伤${state.innerInjury || 0} 修为${state.cultivationRank || 1}
属性=${compactAbilities(state)}
武学=${compactMartialArts(state)}
功法=${compactInternalStyles(state)}；待学=${compactStudies(state)}
战斗=${combatLine(state)}
待处理=${pendingLine(state)}
NPC=${compactNpcSummary(state, globalUpdate)}
传闻=${compactRumors(state)}

输出格式：
1. 先写玩家可见中文叙事，普通场景控制在 80-160 字；战斗只写 1-2 句。
2. 然后输出一个 json 代码块。没有建议时写 {}。
3. JSON 只允许这些键：systemNote,sceneType,proposedCheck,proposedWorldAction,proposedHooks,proposedRumors,proposedNpcReactions。
示例：
\`\`\`json
{"proposedCheck":{"label":"翻窗避开巡丁","abilityKey":"dex","rollMode":"normal","dc":13,"reason":"夜色有利，但窗棂老旧易响。"}}
\`\`\``;
}

export function buildCombatNarrationSystemPrompt() {
  return `你只写最终战斗播报，不分析请求，不列 Role/Task/Constraints/Fact，不解释规则。严格按用户给出的事实写，不改命中、伤害、HP、状态、回合。中文 1-2 句，外在动作和气势为主，不提 d20/DC/计算，不替玩家决定。末尾必须输出：
\`\`\`json
{}
\`\`\``;
}

export function buildCombatIntentSystemPrompt() {
  return `你只负责把玩家战斗意图转成一个 proposedCheck 建议。不要结算命中/伤害/逃跑，不改状态。输出一句中文提示，然后给 json 代码块。`;
}

export function buildCombatNarrationPrompt(_state: GameState, context: CombatNarrationContext) {
  return `写战斗播报。
阶段=${stageLabels[context.stage]}；地点=${context.locationName}/${context.sceneLabel}；回合=${context.round}
行动=${context.actorName}->${context.targetName}；招式=${context.actionLabel || "未注明"}；描述=${compact(context.actionText, 120)}
事实：命中=${typeof context.hit === "boolean" ? (context.hit ? "是" : "否") : "未给"}；暴击=${context.critical ? "是" : "否"}；伤害=${context.damage ?? "未给"}；伤害骰=${context.damageDice || "未给"}；加值=${context.damageBonus ?? "未给"}
HP：主角 ${context.heroHpBefore ?? "?"}->${context.heroHpAfter ?? "?"}；敌人 ${context.enemyHpBefore ?? "?"}->${context.enemyHpAfter ?? "?"}
状态：敌方 ${context.enemyStatusChange || "无"}；玩家 ${context.playerStatusChange || "无"}；敌方意图=${compact(context.enemyIntent || "未给", 60)}；后续=${context.nextPhase || "未给"}
限制：未命中不能写打实；敌方起手不能提前写最终伤害；不要新增判定。`;
}

export function buildCombatActionCheckPrompt(state: GameState, action: string) {
  const martialSummary = state.character.martialArts
    .slice(0, 12)
    .map((art) => `${art.id}:${art.name}(${art.linkedAbility},${art.damageDice},qi${art.baseQiCost})`)
    .join("；") || "无";

  return `判断这次战斗动作应掷什么检定，只给建议，不结算。
敌人=${state.combat.enemy || "对手"}；阶段=${state.combat.phase || "awaiting_hit_check"}；敌AC参考=${state.combat.enemyAc ?? "未知"}；敌意图=${compact(state.pendingCheck?.enemyIntent || "无", 80)}
属性修正=${compactAbilities(state)}
可用武学=${martialSummary}
玩家动作=${compact(action, 180)}

规则：
- 点名武学时优先用该武学 linkedAbility。
- 未点名时按动作选 str/dex/con/int/wis/cha。
- rollMode 只能是 advantage/normal/disadvantage。
- DC 给具体数值，通常 11-16。
- 只输出 proposedCheck，可带 martialArtId。

输出：一句中文提示 + json。`;
}

export function buildCombatEscapeIntentPrompt(state: GameState, action: string) {
  return `判断玩家如何从战斗中脱身，只建议属性和形势，不决定是否成功。
敌人=${state.combat.enemy || "对手"}；阶段=${state.combat.phase || "awaiting_hit_check"}；主角HP=${state.character.hp}/${state.character.maxHp}；敌HP=${state.combat.enemyHp ?? "?"}/${state.combat.enemyMaxHp ?? "?"}；敌意图=${compact(state.pendingCheck?.enemyIntent || "无", 80)}
属性修正=${compactAbilities(state)}
玩家动作=${compact(action, 180)}

规则：
- 借地形、障眼、错步、混入人群：多用 dex/int/wis。
- 硬冲、撞开空隙、扛住压迫：可用 str/con。
- 只输出 proposedCheck；label 写“逃跑 ${state.combat.enemy || "对手"}”；dc 只是占位，填 12。
- suggestedAction 写清“掷 d20 + 属性”或“2d20 取高/取低”。`;
}

export function buildCombatActionIntentPrompt(state: GameState, action: string) {
  return buildCombatActionCheckPrompt(state, action);
}
