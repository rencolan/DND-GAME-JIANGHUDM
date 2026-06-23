import { enemyPresets } from "../../data";
import type { GameState, Npc, SceneType } from "../../types";

export type CombatNarrationContext = {
  stage: "player_check" | "player_escape" | "player_hit_confirmed" | "player_damage" | "enemy_turn_start" | "enemy_turn_end";
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
  enemyIntent?: string;
  nextPhase?: string;
};

const sceneLabels: Record<SceneType, string> = {
  temple: "Temple",
  market: "Market",
  tavern: "Tavern",
  brothel: "Brothel",
  inn: "Inn",
  palace: "Palace"
};

function currentLocation(state: GameState) {
  return state.locations.find((location) => location.current)?.name || "Unknown location";
}

function isVisibleNpc(npc: Npc) {
  return !npc.hidden || npc.discovered || npc.companion;
}

function abilityMod(value: number) {
  return Math.floor((value - 10) / 2);
}

function relationshipTierLabel(value: number) {
  if (value >= 80) return "devoted";
  if (value >= 65) return "confidant";
  if (value >= 50) return "trusted";
  if (value >= 35) return "familiar";
  return "stranger";
}

function buildNpcSummary(state: GameState, globalUpdate: boolean) {
  const here = currentLocation(state);
  return state.npcs
    .filter(isVisibleNpc)
    .filter((npc) => globalUpdate || npc.location === here || npc.companion)
    .map((npc) => ({
      name: npc.name,
      location: npc.location,
      attitude: npc.attitude,
      relationshipTier: relationshipTierLabel(npc.relationship),
      goal: npc.goal,
      status: npc.status
    }));
}

export function buildSystemPrompt(state: GameState, globalUpdate: boolean) {
  return `You are the narrative DM for this wuxia adventure.

[Rules]
1. A check only succeeds when total >= DC. No partial success.
2. Advantage = roll 2d20 keep the highest. Disadvantage = roll 2d20 keep the lowest.
3. AI/DM may judge non-combat checks, but any authoritative local combat result summary is binding.
4. Combat is strict turn-based. After the hero finishes the current step, the enemy acts.
5. Player attacks are two-step: hit check first, damage roll second if it hits.
6. In combat, do not rewrite dice, hit/miss, crit flags, damage totals, HP outcomes, or turn order.
7. When the player tries to escape from combat, AI may only suggest the most fitting ability and rollMode. Local code owns the escape DC and final outcome.
8. For shops and theft, AI may infer intent and suggest a structured world action, but all money, inventory, relationship, DC, and consequence changes remain locally authoritative.
9. Never output chain-of-thought, reasoning traces, self-analysis, or any <think>...</think> content.
10. Combat narration should be concise, sensory, and vivid in a Jin Yong-inspired wuxia style.
11. Inner injury is authoritative local state. It can worsen from internal-force hits, critical blows, or training failure, and it bleeds HP after formal actions.
12. AI may suggest meditation, inn rest, or dedicated medicine as recovery options, but may not directly apply numeric inner-injury changes.

[Current State]
Chapter: ${state.chapter}
Chapter state: ${state.chapterState.id} / ${state.chapterState.stage}
Time: Day ${state.worldDay}, ${state.timeSlot}
Location: ${currentLocation(state)}
Scene: ${sceneLabels[state.sceneType]}
Objective: ${state.objective.title} / ${state.objective.text}
Hero: ${state.character.name}
HP: ${state.character.hp}/${state.character.maxHp}
Qi: ${state.character.qi}/${state.character.maxQi}
AC baseline: ${state.character.ac}
Inner injury: ${state.innerInjury || 0} (meditation, inn rest, and dedicated medicine can reduce it; severe inner injury causes post-action HP loss)
Combat: ${state.combat.active ? `${state.combat.enemy} HP ${state.combat.enemyHp}/${state.combat.enemyMaxHp}, Qi ${state.combat.enemyQi}/${state.combat.enemyMaxQi}, AC baseline ${state.combat.enemyAc || "unknown"}` : "Not in combat"}
Combat phase: ${state.combat.phase || "ended"}
Combat round: ${state.combat.round || 0}
Combat stakes: ${state.combat.stakes || "None"}
Pending damage: ${state.pendingDamage ? `${state.pendingDamage.label} ${state.pendingDamage.damageDice}` : "None"}

[Authoritative Local State]
Story flags: ${JSON.stringify(state.storyFlags)}
Quest state map: ${JSON.stringify(state.questStateMap, null, 2)}
Unlocked locations: ${JSON.stringify(state.locationUnlocks, null, 2)}
NPC story state: ${JSON.stringify(state.npcStoryState, null, 2)}
Recent rumors: ${JSON.stringify(state.rumors.slice(-6), null, 2)}

[Hero Abilities]
${JSON.stringify(state.character.abilities.map((ability) => ({
    key: ability.key,
    label: ability.label,
    value: ability.value,
    mod: abilityMod(ability.value)
  })), null, 2)}

[Hero Martial Arts]
${JSON.stringify(state.character.martialArts.map((art) => ({
    name: art.name,
    grade: art.grade,
    source: art.source,
    category: art.category,
    linkedAbility: art.linkedAbility,
    damageDice: art.damageDice,
    damageBonus: art.damageBonus || 0,
    qiCost: art.baseQiCost
  })), null, 2)}

[Visible NPC Summary]
${JSON.stringify(buildNpcSummary(state, globalUpdate), null, 2)}

[Enemy Presets]
${JSON.stringify(enemyPresets.map((preset) => ({
    name: preset.name,
    hp: preset.maxHp,
    qi: preset.maxQi,
    acBaseline: preset.ac,
    martialArts: preset.martialArts.map((art) => `${art.name} ${art.damageDice}`),
    tags: preset.tags
  })), null, 2)}

[Output Contract]
Write player-facing narration first, then one JSON code block.
Keep prose economical. Usually 70-140 words outside combat, but in combat 1-3 short sentences are enough.
Allowed JSON fields only:
- systemNote
- sceneType
- proposedCheck
- proposedWorldAction
- proposedHooks
- proposedRumors
- proposedNpcReactions
If the player should roll, use proposedCheck instead of directly changing state.
Whenever you output proposedCheck, include a concrete dc and optionally rollMode.
If combat is active, narration must follow the authoritative local combat facts exactly.
For combat narration, a minimal JSON block such as {} is usually enough.

Example JSON:
\`\`\`json
{
  "systemNote": "The pressure in the scene tightens.",
  "sceneType": "inn",
  "proposedCheck": {
    "label": "Answer the opponent's opening move",
    "abilityKey": "dex",
    "rollMode": "disadvantage",
    "dc": 14,
    "reason": "The opponent closes distance first and forces an immediate response.",
    "risk": "On a failure, you take a heavy hit.",
    "enemyIntent": "Press your footing, then chain into the next move.",
    "suggestedAction": "Evade with footwork, brace with composure, or meet it head-on."
  }
}
\`\`\``;
}

export function buildCombatNarrationPrompt(state: GameState, context: CombatNarrationContext) {
  const enemyTurnStage = context.stage === "enemy_turn_start" || context.stage === "enemy_turn_end";
  const stageLabelMap: Record<CombatNarrationContext["stage"], string> = {
    player_check: "玩家本步判定结果",
    player_escape: "玩家脱身判定结果",
    player_hit_confirmed: "玩家攻击命中，等待伤害",
    player_damage: "玩家伤害已经结算",
    enemy_turn_start: "敌方回合起手",
    enemy_turn_end: "敌方回合结果"
  };

  return `你现在只负责战斗播报，不负责裁定。
[播报要求]
1. 用中文写 2-4 句短促而有画面的武侠叙事，笔触尽量贴近金庸式气质。
2. 重点写动作、神态、步法、呼吸、兵刃、风声、尘土、灯影和压迫感。
3. 不要复述 d20、DC、数值计算等桌面规则术语。
4. 不要改写下面给定的战斗事实，不要追加相反结果。
5. 敌方起手阶段只能写将要如何出手与压力如何逼来，不能提前泄露最终命中或伤害。
6. 不要替玩家决定动作，也不要命令玩家接下来做什么。
7. 只写外在可见的动作、架势、受击、闪避、环境和气势，不要代写玩家心理。
8. 若当前阶段是“玩家脱身判定结果”，成功时只写如何抽身拉开，失败时只写脱身未成与空门外露。
9. 结尾仍给一个极简 JSON 代码块，通常只写 {} 或 {"systemNote":"..."}。

[当前战斗阶段]
阶段: ${stageLabelMap[context.stage]}
地点: ${context.locationName}
场景: ${context.sceneLabel}
回合: ${context.round}
行动者: ${context.actorName}
目标: ${context.targetName}

[权威战斗事实]
动作描述: ${context.actionText || "无"}
招式/动作名: ${context.actionLabel || "未注明"}
判定标签: ${context.checkLabel || "未注明"}
d20: ${context.naturalRoll ?? "未提供"}
总值: ${context.total ?? "未提供"}
目标值: ${context.dc ?? "未提供"}
是否成功/命中: ${typeof context.hit === "boolean" ? (context.hit ? "是" : "否") : "未提供"}
是否暴击: ${typeof context.critical === "boolean" ? (context.critical ? "是" : "否") : "未提供"}
伤害: ${context.damage ?? "未提供"}
伤害骰: ${context.damageDice || "未提供"}
固定伤害加值: ${context.damageBonus ?? "未提供"}
主角 HP: ${context.heroHpBefore ?? "未提供"} -> ${context.heroHpAfter ?? "未提供"}
敌人 HP: ${context.enemyHpBefore ?? "未提供"} -> ${context.enemyHpAfter ?? "未提供"}
敌方意图: ${context.enemyIntent || "未提供"}
后续阶段: ${context.nextPhase || state.combat.phase || "未提供"}

[硬性限制]
- 如果“是否成功/命中”为否，就不能写成打实。
- 如果“是否暴击”为是，可以写势头更狠，但不要改动伤害事实。
- 如果阶段是“敌方回合起手”，不要提前写命中和掉血结果。
- 不要替系统推进状态，不要发明新的判定要求。${enemyTurnStage ? "\n- 当前是敌方回合播报，只能写敌方动作、局面变化，以及玩家外在可见的结果。" : ""}

\`\`\`json
{}
\`\`\``;
}

export function buildCombatActionCheckPrompt(state: GameState, action: string) {
  const currentCheck = state.pendingCheck;
  const enemyName = state.combat.enemy || "对手";
  const phase = state.combat.phase || "awaiting_hit_check";
  const abilitySummary = state.character.abilities.map((ability) => ({
    key: ability.key,
    label: ability.label,
    mod: abilityMod(ability.value)
  }));
  const martialSummary = state.character.martialArts.map((art) => ({
    id: art.id,
    name: art.name,
    linkedAbility: art.linkedAbility,
    damageDice: art.damageDice,
    damageBonus: art.damageBonus || 0,
    qiCost: art.baseQiCost
  }));

  return `你现在只负责判断玩家这句动作在战斗中该用什么属性进行检定，并给出一个 AI 主观判断的 DC。
[任务]
1. 根据玩家动作、距离、抢位、压制、失衡、敌我气势来判断这一步的真实难度。
2. 如果玩家明确点名某门武学，优先按那门武学的 linkedAbility 判定。
3. 如果玩家没点名武学，就按动作意图推断最贴近的属性和招式。
4. 你只负责提出检定要求，不负责结算命中、伤害、回合推进或敌人行动。
5. 你必须给出具体 dc，不要复用旧 dc 当硬规则。
6. 敌人的 ac 只是参考基线，不是必须直接对齐的固定目标值。
7. 你还要判断此刻的“势”：
   - advantage：玩家明显占先、抢到有利身位、抓到破绽、借环境压住对手
   - disadvantage：玩家被逼在下风、身形受制、仓促变招、立足不稳、明显吃亏
   - normal：双方气势未明显倾斜
8. 只在 proposedCheck.rollMode 里输出 advantage / normal / disadvantage 之一，不要自掷骰。

[当前战斗]
敌人: ${enemyName}
阶段: ${phase}
当前待判定: ${currentCheck?.label || "无"}
当前本地 fallback DC: ${currentCheck?.dc ?? "无"}
当前敌方意图: ${currentCheck?.enemyIntent || "无"}
敌方 AC 参考基线: ${state.combat.enemyAc ?? "未知"}

[可用属性]
${JSON.stringify(abilitySummary, null, 2)}

[可用武学]
${JSON.stringify(martialSummary, null, 2)}

[玩家动作]
${action}

[输出要求]
- 先写 1-2 句中文 DM 提示，明确说这一步该掷什么属性。
- 然后输出一个 JSON 代码块。
- JSON 只允许使用 proposedCheck，可选 systemNote。
- proposedCheck 必须包含 label, abilityKey, rollMode, dc, reason。
- 如果能判断出具体武学，可附带 martialArtId。
- suggestedAction 里直接写“请掷 d20 + 某属性”；若是优势或劣势，要直接说清楚“2d20 取高”或“2d20 取低”。`;
}

export function buildCombatEscapeIntentPrompt(state: GameState, action: string) {
  const currentCheck = state.pendingCheck;
  const enemyName = state.combat.enemy || "对手";
  const abilitySummary = state.character.abilities.map((ability) => ({
    key: ability.key,
    label: ability.label,
    mod: abilityMod(ability.value)
  }));

  return `你现在只负责理解玩家在战斗中如何尝试脱身。
[任务]
1. 玩家明确是在逃跑/撤退/脱身，不是在攻击。
2. 你只判断这次脱身最适合用什么属性，以及局面更像 advantage / normal / disadvantage。
3. 你不能裁定是否逃掉，不能决定 DC，不能改写战斗状态，不能让敌人先后手变化。
4. 只允许建议以下属性之一：str / dex / con / int / wis / cha。
5. 若动作明显是借地形、障眼、混入人群、借势错步，优先考虑 dex / int / wis 之类的脱身手段。
6. 若动作明显是硬顶、强冲、撞开空隙，也可以考虑 str / con。

[当前战斗]
敌人: ${enemyName}
阶段: ${state.combat.phase || "awaiting_hit_check"}
当前待判定: ${currentCheck?.label || "无"}
敌方意图: ${currentCheck?.enemyIntent || "无"}
主角 HP: ${state.character.hp}/${state.character.maxHp}
敌人 HP: ${state.combat.enemyHp ?? "未知"}/${state.combat.enemyMaxHp ?? "未知"}
敌人状态: ${JSON.stringify(state.combat.enemyStatus || [])}

[主角属性]
${JSON.stringify(abilitySummary, null, 2)}

[玩家动作]
${action}

[输出要求]
- 先写 1-2 句中文 DM 提示，明确这次脱身该掷什么属性。
- 然后输出一个 JSON 代码块。
- JSON 只允许使用 proposedCheck，可选 systemNote。
- proposedCheck 必须包含:
  - label
  - abilityKey
  - rollMode
  - dc
  - reason
  - suggestedAction
- 其中 dc 只是占位值，本地不会采用；你仍然必须填一个具体数字，建议填 12。
- label 统一写“逃跑 ${enemyName}”。
- suggestedAction 必须直接写清是“请掷 d20 + 某属性”、还是“请掷 2d20 取高/取低，再加某属性”。`;
}

export function buildCombatActionIntentPrompt(state: GameState, action: string) {
  return buildCombatActionCheckPrompt(state, action);
}
