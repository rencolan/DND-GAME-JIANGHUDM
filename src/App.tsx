import {
  Backpack,
  Dices,
  Download,
  Loader2,
  Map as MapIcon,
  Send,
  Settings,
  Sparkles,
  Upload,
  User,
  Users,
  Volume2,
  VolumeX,
  X
} from "lucide-react";
import { ChangeEvent, CSSProperties, FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { defaultMartialArts, enemyPresets, initialGameState } from "./data";
import type {
  Ability,
  ApiConfig,
  ApiProvider,
  Character,
  DrawerTab,
  GamePatch,
  GameState,
  Item,
  MartialArt,
  Message,
  Npc,
  OriginTemplate,
  PendingCheck,
  Quest,
  RollMode,
  SceneType
} from "./types";

const SAVE_KEY = "jianghu-dm-save-v3";
const API_KEY = "jianghu-dm-api-v3";
const SETUP_KEY = "jianghu-dm-has-played-v2";
const BGM_KEY = "jianghu-dm-bgm-v1";
const BGM_VOLUME_KEY = "jianghu-dm-bgm-volume-v1";
const WORLD_STEP = 4;
const QI_INVEST_LIMIT = 6;
const BGM_SRC = "./assets/bgm/Seven_Peaks_at_Twilight.mp3";

const PLAYABLE_ORIGIN_ID = "nameless-wanderer";
const QUEST_WANDERER_1 = "quest-wanderer-1";
const QUEST_WANDERER_2 = "quest-wanderer-2";
const QUEST_WANDERER_3 = "quest-wanderer-3";
const QUEST_WANDERER_4 = "quest-wanderer-4";
const QUEST_WANDERER_5 = "quest-wanderer-5";

const PROVIDER_OPTIONS: Array<{ value: ApiProvider; label: string }> = [
  { value: "openai", label: "OpenAI" },
  { value: "deepseek", label: "DeepSeek" },
  { value: "custom", label: "自定义" }
];

const PROVIDER_DEFAULTS: Record<ApiProvider, { apiUrl: string; model: string }> = {
  openai: {
    apiUrl: "https://api.openai.com/v1/chat/completions",
    model: "gpt-4.1-mini"
  },
  deepseek: {
    apiUrl: "https://api.deepseek.com/chat/completions",
    model: "deepseek-v4-flash"
  },
  custom: {
    apiUrl: "",
    model: ""
  }
};

const playableOrigins: OriginTemplate[] = [
  {
    id: PLAYABLE_ORIGIN_ID,
    name: "无名客",
    desc: "从江湖底层一路滚过来的无名刀客，信的是眼力、脚力和活下去的狠劲。",
    qiStart: 2,
    intro: "夜路上风声很碎。你在无量山脚歇脚时，看见有人把一只沾着药味的碎瓷盏踢进草里，转身就往山道深处走，像是在赶着掩掉什么痕迹。",
    setupHint: "外功起手，适合追踪、近身缠斗和从乱局里咬出一条活路。",
    firstQuest: {
      title: "夜路碎瓷",
      text: "查清无量山脚那只碎瓷盏和药味从何而来，别让丢下它的人先一步把线索抹平。",
      location: "无量山",
      npc: "木婉清"
    },
    equipmentNames: ["缺口长刀", "灰布短打", "旧酒葫芦"],
    openingItem: {
      id: "wanderer-shard",
      name: "碎瓷残片",
      desc: "边缘沾着淡淡药味，像是某种急用伤药的器皿。",
      count: 1,
      type: "quest"
    },
    martialArts: [...defaultMartialArts.jianghu]
  }
];

const playableRouteGuides: Record<string, { sceneType: SceneType; objective: GameState["objective"]; intro: string }> = {
  [PLAYABLE_ORIGIN_ID]: {
    sceneType: "inn",
    objective: {
      title: "入局引导",
      text: "先看清夜路上的碎瓷、药味和那道刚消失不久的脚印。",
      location: "无量山"
    },
    intro: playableOrigins[0].intro
  }
};

const abilityLabels: Record<string, string> = {
  str: "力道",
  dex: "身法",
  con: "根骨",
  int: "悟性",
  cha: "气运",
  wis: "心境"
};

const abilityDefinitions: Record<string, { title: string; text: string }> = {
  str: {
    title: "力道",
    text: "决定硬碰硬、持兵压制、破门制敌一类的正面爆发。外功拳脚、刀掌冲阵，多半都看这一项。"
  },
  dex: {
    title: "身法",
    text: "决定腾挪、闪避、抢身位、轻功追逐与出手快慢。想先一步占位，常要看身法够不够利落。"
  },
  con: {
    title: "根骨",
    text: "决定体魄、抗打、撑伤和久战能力。根骨高的人更扛揍，也更能熬住内伤与寒毒一类的后劲。"
  },
  int: {
    title: "悟性",
    text: "决定拆招理解、临阵应变、推演武学路数与精细内功运转。机巧型招式和高深绝学常受它影响。"
  },
  cha: {
    title: "气运",
    text: "决定临场福缘、人情走向、偶遇转机与一些说不清的顺逆。它不总是显眼，但常在关键时刻偏向一边。"
  },
  wis: {
    title: "心境",
    text: "决定定力、判断、守势、调息与克制。越乱的局面，越需要心境稳得住，才不会自己先散。"
  }
};

const sceneAssets: Record<SceneType, string> = {
  temple: "./assets/scene-temple.png",
  market: "./assets/scene-market.png",
  tavern: "./assets/scene-tavern.png",
  brothel: "./assets/scene-brothel.png",
  inn: "./assets/scene-inn.png",
  palace: "./assets/scene-palace.png"
};

const sceneLabels: Record<SceneType, string> = {
  temple: "寺院",
  market: "街市",
  tavern: "酒肆",
  brothel: "花楼",
  inn: "客栈",
  palace: "府邸"
};

const sceneKeywords: Array<{ sceneType: SceneType; keywords: string[] }> = [
  { sceneType: "brothel", keywords: ["花楼", "青楼", "勾栏", "歌姬", "乐坊"] },
  { sceneType: "tavern", keywords: ["酒", "酒馆", "酒肆", "喝酒", "掌柜"] },
  { sceneType: "inn", keywords: ["客栈", "厢房", "住店", "歇脚", "后院"] },
  { sceneType: "temple", keywords: ["寺", "庙", "佛堂", "香火", "僧人"] },
  { sceneType: "market", keywords: ["市集", "街", "摊", "商贩", "茶肆"] },
  { sceneType: "palace", keywords: ["王府", "府邸", "书房", "官邸", "厅堂"] }
];

const tabItems: Array<{ id: DrawerTab; label: string; icon: typeof User }> = [
  { id: "character", label: "状态", icon: User },
  { id: "inventory", label: "行囊", icon: Backpack },
  { id: "party", label: "同伴", icon: Users },
  { id: "map", label: "地图", icon: MapIcon },
  { id: "system", label: "系统", icon: Settings }
];

const martialLookup = new Map<string, MartialArt>();
[
  ...defaultMartialArts.dali,
  ...defaultMartialArts.jianghu,
  ...defaultMartialArts.shaolin,
  ...defaultMartialArts.enemy,
  ...defaultMartialArts.bosses,
  ...defaultMartialArts.legends
].forEach((art) => {
  martialLookup.set(art.id, art);
  martialLookup.set(art.name, art);
});

const enemyPresetLookup = new Map<string, (typeof enemyPresets)[number]>();
enemyPresets.forEach((preset) => {
  enemyPresetLookup.set(preset.id, preset);
  enemyPresetLookup.set(preset.name, preset);
});

type RollPackage = [number, number, number, number, number, number];
type ApiTestState = {
  status: "idle" | "testing" | "success" | "error";
  message?: string;
};
type RollingState = {
  label: string;
  picked: number;
  total: number;
  qiBonus: number;
  modeText: string;
};

function uid(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function abilityMod(value: number) {
  return Math.floor((value - 10) / 2);
}

function qiInvestBonus(qi: number) {
  return Math.floor(qi / 2);
}

function roll3d6() {
  return Math.ceil(Math.random() * 6) + Math.ceil(Math.random() * 6) + Math.ceil(Math.random() * 6);
}

function makeAbilityChoices(): RollPackage[] {
  return Array.from({ length: 3 }, () => [
    roll3d6(),
    roll3d6(),
    roll3d6(),
    roll3d6(),
    roll3d6(),
    roll3d6()
  ]) as RollPackage[];
}

function parseDamageDice(damageDice: string) {
  const match = damageDice.trim().toLowerCase().match(/^(\d+)d(\d+)$/);
  if (!match) return { rolls: [0], total: 0 };

  const count = Number(match[1]);
  const sides = Number(match[2]);
  const rolls = Array.from({ length: count }, () => Math.ceil(Math.random() * sides));

  return {
    rolls,
    total: rolls.reduce((sum, value) => sum + value, 0)
  };
}

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function inferProvider(apiUrl: string): ApiProvider {
  if (apiUrl.includes("deepseek")) return "deepseek";
  if (apiUrl.includes("openai")) return "openai";
  return "custom";
}

function defaultApiConfig(provider: ApiProvider): ApiConfig {
  const defaults = PROVIDER_DEFAULTS[provider];
  return {
    provider,
    apiUrl: defaults.apiUrl,
    apiKey: "",
    model: defaults.model
  };
}

function normalizeApiConfig(raw: Partial<ApiConfig> | undefined): ApiConfig {
  const provider = raw?.provider || inferProvider(raw?.apiUrl || "");
  const defaults = PROVIDER_DEFAULTS[provider];
  return {
    provider,
    apiUrl: raw?.apiUrl ?? defaults.apiUrl,
    apiKey: raw?.apiKey ?? "",
    model: raw?.model ?? defaults.model
  };
}

function currentLocation(state: GameState) {
  return state.locations.find((location) => location.current)?.name || "未知地点";
}

function advanceTime(state: GameState): Pick<GameState, "worldDay" | "timeSlot"> {
  const slots = ["清晨", "上午", "午后", "黄昏", "夜半"];
  const currentIndex = Math.max(0, slots.indexOf(state.timeSlot));
  const nextIndex = (currentIndex + 1) % slots.length;

  return {
    worldDay: nextIndex === 0 ? state.worldDay + 1 : state.worldDay,
    timeSlot: slots[nextIndex]
  };
}

function inferSceneType(text: string): SceneType | undefined {
  const source = text.toLowerCase();
  return sceneKeywords.find((entry) =>
    entry.keywords.some((keyword) => source.includes(keyword.toLowerCase()))
  )?.sceneType;
}

function stripJsonBlock(text: string) {
  const match = text.match(/```json\s*([\s\S]*?)\s*```/i);
  return {
    visibleText: match ? text.replace(match[0], "").trim() : text.trim(),
    patchText: match?.[1]
  };
}

function normalizeMartialArt(raw: Partial<MartialArt> & { name: string }): MartialArt {
  const template = martialLookup.get(raw.id || "") || martialLookup.get(raw.name);
  const category = raw.category || template?.category || "external";

  return {
    id: raw.id || template?.id || `art-${uid("martial")}`,
    name: raw.name,
    grade: raw.grade || template?.grade || "入门",
    category,
    linkedAbility: raw.linkedAbility || template?.linkedAbility || "str",
    effect: raw.effect || template?.effect || "一式既出，重在火候与拿捏。",
    damageDice: raw.damageDice || template?.damageDice || "1d4",
    damageBonus: raw.damageBonus ?? template?.damageBonus,
    baseQiCost: category === "internal" ? raw.baseQiCost ?? template?.baseQiCost ?? 1 : 0,
    risk: raw.risk || template?.risk || "贸然出手，容易被看出路数。",
    source: raw.source || template?.source || "江湖所得"
  };
}

function relabelAbilities(character: Character): Character {
  return {
    ...character,
    abilities: (character.abilities || []).map((ability) => ({
      ...ability,
      label: abilityLabels[ability.key] || ability.label
    })),
    martialArts: (character.martialArts || []).map((art) => normalizeMartialArt({ ...art, name: art.name }))
  };
}

function fallbackObjective(state: GameState) {
  const activeQuest = state.quests.find((quest) => quest.status === "active");
  if (activeQuest) {
    return {
      title: activeQuest.title,
      text: activeQuest.text,
      location: state.objective.location || currentLocation(state),
      npc: state.objective.npc
    };
  }

  return state.objective || {
    title: "江湖未定",
    text: "先看看眼前的人、事、路，再决定下一步。",
    location: currentLocation(state)
  };
}

function makePendingCheck(raw: GamePatch["pendingCheck"]): PendingCheck | undefined {
  if (!raw?.label || typeof raw.dc !== "number") return undefined;
  return {
    id: uid("check"),
    label: raw.label,
    abilityKey: raw.abilityKey,
    martialArtId: raw.martialArtId,
    dc: raw.dc,
    reason: raw.reason || "局势逼人，得给出一个清楚应对。",
    risk: raw.risk,
    enemyIntent: raw.enemyIntent,
    suggestedAction: raw.suggestedAction
  };
}

function findEnemyPreset(name: string) {
  const direct = enemyPresetLookup.get(name);
  if (direct) return direct;

  for (const preset of enemyPresets) {
    if (name.includes(preset.name) || preset.name.includes(name)) return preset;
  }

  return enemyPresetLookup.get("black-assassin") || enemyPresets[0];
}

function makeEnemyCombat(name = "黑衣刺客"): GameState["combat"] {
  const preset = findEnemyPreset(name);
  return {
    active: true,
    enemy: preset.name,
    enemyHp: preset.hp,
    enemyMaxHp: preset.maxHp,
    enemyQi: preset.qi,
    enemyMaxQi: preset.maxQi,
    enemyAc: preset.ac,
    enemyAbilities: [
      { key: "str", label: abilityLabels.str, value: preset.abilities.str },
      { key: "dex", label: abilityLabels.dex, value: preset.abilities.dex },
      { key: "con", label: abilityLabels.con, value: preset.abilities.con },
      { key: "int", label: abilityLabels.int, value: preset.abilities.int },
      { key: "cha", label: abilityLabels.cha, value: preset.abilities.cha },
      { key: "wis", label: abilityLabels.wis, value: preset.abilities.wis }
    ],
    enemyMartialArts: preset.martialArts.map((art) => normalizeMartialArt({ ...art, name: art.name })),
    enemyStatus: []
  };
}

function normalizeCombat(combat: GameState["combat"] | undefined): GameState["combat"] {
  if (!combat?.active) return { active: false };

  const normalized = makeEnemyCombat(combat.enemy || "黑衣刺客");
  return {
    ...normalized,
    ...combat,
    enemyHp: combat.enemyHp ?? normalized.enemyHp,
    enemyMaxHp: combat.enemyMaxHp ?? normalized.enemyMaxHp,
    enemyQi: combat.enemyQi ?? normalized.enemyQi,
    enemyMaxQi: combat.enemyMaxQi ?? normalized.enemyMaxQi,
    enemyAc: combat.enemyAc ?? normalized.enemyAc,
    enemyAbilities: combat.enemyAbilities || normalized.enemyAbilities,
    enemyMartialArts: (combat.enemyMartialArts || normalized.enemyMartialArts || []).map((art) =>
      normalizeMartialArt({ ...art, name: art.name })
    ),
    enemyStatus: combat.enemyStatus || []
  };
}

function normalizeGameState(raw: GameState): GameState {
  const base = structuredClone(initialGameState);
  const current = raw || base;

  const character = relabelAbilities(current.character || base.character);
  const roster = (current.roster || [character]).map(relabelAbilities);
  const locations = (current.locations || base.locations).map((location) => ({ ...location }));
  if (!locations.some((location) => location.current) && locations[0]) {
    locations[0].current = true;
  }

  return {
    ...base,
    ...current,
    setupComplete: current.setupComplete ?? Boolean(localStorage.getItem(SETUP_KEY)),
    originId: current.originId || character.originId || base.originId,
    creationMode: "origin",
    character,
    roster,
    locations,
    npcs: current.npcs || base.npcs,
    quests: current.quests || [],
    messages: current.messages || base.messages,
    combat: normalizeCombat(current.combat || base.combat),
    systemLog: current.systemLog || base.systemLog,
    sceneType: current.sceneType || base.sceneType,
    objective: fallbackObjective({
      ...base,
      ...current,
      character,
      roster,
      locations,
      quests: current.quests || [],
      messages: current.messages || base.messages,
      combat: normalizeCombat(current.combat || base.combat),
      systemLog: current.systemLog || base.systemLog,
      sceneType: current.sceneType || base.sceneType,
      npcs: current.npcs || base.npcs,
      setupComplete: current.setupComplete ?? base.setupComplete,
      creationMode: "origin",
      originId: current.originId || character.originId || base.originId
    }),
    pendingCheck: current.pendingCheck ? makePendingCheck(current.pendingCheck) : undefined,
    innerInjury: current.innerInjury || 0
  };
}

function makeCharacterFromOrigin(name: string, origin: OriginTemplate, packageValues: RollPackage): Character {
  const con = packageValues[2];
  const hp = 18 + Math.max(0, con - 10) * 2;

  return relabelAbilities({
    id: `hero-${origin.id}-${Date.now()}`,
    name: name.trim() || "无名少侠",
    title: `${origin.name}，初入江湖`,
    portrait: "./assets/portraits/duan-yu.png",
    hp,
    maxHp: hp,
    qi: origin.qiStart,
    maxQi: origin.qiStart,
    ac: 10 + abilityMod(packageValues[1]),
    abilities: [
      { key: "str", label: abilityLabels.str, value: packageValues[0] },
      { key: "dex", label: abilityLabels.dex, value: packageValues[1] },
      { key: "con", label: abilityLabels.con, value: packageValues[2] },
      { key: "int", label: abilityLabels.int, value: packageValues[3] },
      { key: "cha", label: abilityLabels.cha, value: packageValues[4] },
      { key: "wis", label: abilityLabels.wis, value: packageValues[5] }
    ],
    martialArts: origin.martialArts.map((art) => normalizeMartialArt({ ...art, name: art.name, source: origin.name })),
    equipment: {
      weapon: {
        id: uid("weapon"),
        name: origin.equipmentNames[0],
        desc: "随身兵刃。",
        count: 1,
        type: "weapon",
        equipable: true
      },
      armor: {
        id: uid("armor"),
        name: origin.equipmentNames[1],
        desc: "便于行走江湖的护具。",
        count: 1,
        type: "armor",
        equipable: true
      },
      accessory: {
        id: uid("acc"),
        name: origin.equipmentNames[2],
        desc: "带着来路与故事的随身物。",
        count: 1,
        type: "accessory",
        equipable: true
      }
    },
    inventory: [
      {
        id: "medicine",
        name: "金疮药",
        desc: "恢复 8 点生命。",
        count: 2,
        type: "consumable",
        usable: true,
        hpRestore: 8
      },
      {
        id: "qi-pill",
        name: "行气散",
        desc: "恢复 2 点内力。",
        count: 1,
        type: "consumable",
        usable: true,
        qiRestore: 2
      },
      ...(origin.openingItem ? [origin.openingItem] : [])
    ],
    originId: origin.id,
    isCustom: true
  });
}

function isVisibleNpc(npc: Npc) {
  return !npc.hidden || npc.discovered || npc.companion;
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
      goal: npc.goal,
      status: npc.status
    }));
}

function hasQuest(state: GameState, id: string, status?: Quest["status"]) {
  return state.quests.some((quest) => quest.id === id && (!status || quest.status === status));
}

function firstQuestPatchForOrigin(state: GameState): Pick<GamePatch, "questUpdates" | "objectiveUpdate" | "systemNote"> | undefined {
  if (state.quests.some((quest) => quest.status === "active")) return undefined;

  const origin = playableOrigins.find((item) => item.id === state.originId);
  if (!origin) return undefined;

  return {
    questUpdates: [
      {
        id: `quest-${origin.id}`,
        title: origin.firstQuest.title,
        text: origin.firstQuest.text,
        status: "active"
      }
    ],
    objectiveUpdate: {
      title: origin.firstQuest.title,
      text: origin.firstQuest.text,
      location: origin.firstQuest.location,
      npc: origin.firstQuest.npc
    },
    systemNote: `首个正式任务已派发：${origin.firstQuest.title}`
  };
}

function buildSystemPrompt(state: GameState, globalUpdate: boolean) {
  return `你是“江湖 DM”的叙事主持人，请继续推进这个武侠冒险。

[硬规则]
1. 判定总计 >= DC 才成功；总计 < DC 必须失败。没有险胜、部分成功档。
2. 优势 = 掷 2 个 d20 取高；劣势 = 掷 2 个 d20 取低。
3. 战斗是连续对招，不是一掷定胜负。每轮要推进局势。
4. 玩家武学只决定伤害与耗气；命中判定看属性。
5. 内力只作为资源消耗，不会自动制造“气息紊乱”。
6. 同伴是独立 NPC，不是固定加值插件，可加入也可退出。
7. 开局第一轮先铺垫，首轮行动后再派发第一条正式任务。

[当前状态]
章节：${state.chapter}
时间：第 ${state.worldDay} 日 ${state.timeSlot}
地点：${currentLocation(state)}
场景：${sceneLabels[state.sceneType]}
当前目标：${state.objective.title} / ${state.objective.text}
角色：${state.character.name}
生命：${state.character.hp}/${state.character.maxHp}
内力：${state.character.qi}/${state.character.maxQi}
内伤：${state.innerInjury || 0}
战斗：${state.combat.active ? `与 ${state.combat.enemy} 交手中，敌方 HP ${state.combat.enemyHp}/${state.combat.enemyMaxHp}，Qi ${state.combat.enemyQi}/${state.combat.enemyMaxQi}` : "当前未战斗"}

[角色属性]
${JSON.stringify(state.character.abilities.map((ability) => ({
    key: ability.key,
    label: ability.label,
    value: ability.value,
    mod: abilityMod(ability.value)
  })), null, 2)}

[角色武学]
${JSON.stringify(state.character.martialArts.map((art) => ({
    name: art.name,
    category: art.category,
    linkedAbility: art.linkedAbility,
    damageDice: art.damageDice,
    damageBonus: art.damageBonus || 0,
    qiCost: art.baseQiCost,
    effect: art.effect
  })), null, 2)}

[已见 NPC 摘要]
${JSON.stringify(buildNpcSummary(state, globalUpdate), null, 2)}

[命名敌人预设]
${JSON.stringify(enemyPresets.map((preset) => ({
    name: preset.name,
    hp: preset.maxHp,
    qi: preset.maxQi,
    ac: preset.ac,
    martialArts: preset.martialArts.map((art) => `${art.name} ${art.damageDice}`),
    tags: preset.tags
  })), null, 2)}

[输出要求]
先写 120 到 220 字左右的叙事正文，再附一个 JSON 代码块。
JSON 只写你要修改的字段，不要凭空发明无关字段。
如果当前需要玩家掷骰，请返回 pendingCheck。
如果处于战斗中，失败也要推进战局，不要原地空转。

JSON 示例：
\`\`\`json
{
  "hpChange": -3,
  "qiChange": -1,
  "qiMaxChange": 1,
  "innerInjuryChange": 1,
  "combatAction": "enter",
  "enemyName": "丁春秋",
  "combatUpdate": {
    "enemyHpChange": -6,
    "enemyQiChange": -1,
    "enemyQiCost": 1,
    "enemyMartialArtUsed": "化功大法",
    "enemyStatusAdd": ["露出破绽"]
  },
  "npcUpdates": [{ "name": "阿朱", "discovered": true }],
  "questUpdates": [{ "id": "quest-dali-heir", "title": "茶肆里的旧香", "text": "继续追查。", "status": "active" }],
  "objectiveUpdate": { "title": "茶肆里的旧香", "text": "去茶肆继续打探。", "location": "大理城", "npc": "阿朱" },
  "pendingCheck": {
    "label": "接住对方杀招",
    "abilityKey": "dex",
    "dc": 14,
    "reason": "对方抢先进身，逼你马上应对。",
    "risk": "若失败，你会吃下一记重手。",
    "enemyIntent": "先压住你的脚步，再接连追击。",
    "suggestedAction": "可用身法闪避，也可用心境或根骨硬接。"
  }
}
\`\`\``;
}

function withSceneFallback(patch: GamePatch, ...texts: string[]): GamePatch {
  if (patch.sceneType) return patch;
  const sceneType = inferSceneType(texts.filter(Boolean).join("\n"));
  return sceneType ? { ...patch, sceneType } : patch;
}

function applyPatchToState(prev: GameState, patch: GamePatch): GameState {
  const next = normalizeGameState(structuredClone(prev));
  const hero = next.character;

  if (patch.hpChange) hero.hp = clamp(hero.hp + patch.hpChange, 0, hero.maxHp);
  if (patch.qiChange) hero.qi = clamp(hero.qi + patch.qiChange, 0, hero.maxQi);
  if (patch.qiRecovery) hero.qi = clamp(hero.qi + patch.qiRecovery, 0, hero.maxQi);
  if (patch.qiMaxChange) {
    hero.maxQi = clamp(hero.maxQi + patch.qiMaxChange, 0, 99);
    hero.qi = clamp(hero.qi, 0, hero.maxQi);
  }
  if (patch.innerInjuryChange) {
    next.innerInjury = clamp((next.innerInjury || 0) + patch.innerInjuryChange, 0, 100);
  }
  if (patch.acChange) hero.ac = Math.max(0, hero.ac + patch.acChange);

  if (patch.abilityChanges) {
    hero.abilities = hero.abilities.map((ability) => ({
      ...ability,
      value: patch.abilityChanges?.[ability.key] ?? patch.abilityChanges?.[ability.label] ?? ability.value
    }));
  }

  if (patch.newItem?.name) {
    const newItem: Item = {
      id: patch.newItem.id || uid("item"),
      name: patch.newItem.name,
      desc: patch.newItem.desc || "新得之物，尚待派上用场。",
      count: patch.newItem.count || 1,
      type: patch.newItem.type,
      equipable: patch.newItem.equipable,
      usable: patch.newItem.usable,
      hpRestore: patch.newItem.hpRestore,
      qiRestore: patch.newItem.qiRestore
    };
    const existing = hero.inventory.find((item) => item.name === newItem.name);
    if (existing) existing.count += newItem.count;
    else hero.inventory.push(newItem);
  }

  if (patch.removeItemId) {
    hero.inventory = hero.inventory.filter((item) => item.id !== patch.removeItemId);
  }

  if (patch.location) {
    next.locations = next.locations.map((location) => ({
      ...location,
      current: location.name === patch.location,
      unlocked: location.unlocked || location.name === patch.location
    }));
  }

  if (patch.timeSlot) next.timeSlot = patch.timeSlot;
  if (patch.chapter) next.chapter = patch.chapter;
  if (patch.sceneType) next.sceneType = patch.sceneType;

  if (patch.combatAction === "enter") {
    next.combat = makeEnemyCombat(patch.enemyName || "黑衣刺客");
  }

  if (patch.combatUpdate && next.combat.active) {
    const combat = normalizeCombat(next.combat);
    const enemyQiCost = patch.combatUpdate.enemyQiCost || 0;
    combat.enemyHp = clamp((combat.enemyHp || 0) + (patch.combatUpdate.enemyHpChange || 0), 0, combat.enemyMaxHp || 1);
    combat.enemyQi = clamp((combat.enemyQi || 0) + (patch.combatUpdate.enemyQiChange || 0) - enemyQiCost, 0, combat.enemyMaxQi || 1);
    combat.enemyAc = Math.max(0, (combat.enemyAc || 0) + (patch.combatUpdate.enemyAcChange || 0));
    const status = new Set(combat.enemyStatus || []);
    patch.combatUpdate.enemyStatusAdd?.forEach((item) => status.add(item));
    patch.combatUpdate.enemyStatusRemove?.forEach((item) => status.delete(item));
    combat.enemyStatus = [...status];
    next.combat = combat;

    if (patch.combatUpdate.enemyMartialArtUsed) {
      next.systemLog.push(`敌人使出武学：${patch.combatUpdate.enemyMartialArtUsed}`);
    }

    if ((combat.enemyHp || 0) <= 0) {
      next.combat = { ...combat, active: false };
      next.systemLog.push(`${combat.enemy} 已失去再战之力。`);
    }
  }

  if (patch.combatAction === "exit") {
    next.combat = { ...next.combat, active: false };
  }

  if (patch.relationshipChanges) {
    next.npcs = next.npcs.map((npc) => {
      const change = patch.relationshipChanges?.find((item) => item.npcId === npc.id || item.name === npc.name);
      if (!change) return npc;
      return {
        ...npc,
        relationship: clamp(change.value ?? npc.relationship + (change.delta || 0), 0, 100),
        attitude: change.attitude || npc.attitude
      };
    });
  }

  if (patch.npcUpdates) {
    next.npcs = next.npcs.map((npc) => {
      const update = patch.npcUpdates?.find((item) => item.id === npc.id || item.name === npc.name);
      if (!update) return npc;
      return { ...npc, ...update, id: npc.id, name: npc.name };
    });
  }

  if (patch.questUpdates) {
    for (const update of patch.questUpdates) {
      const index = next.quests.findIndex((quest) => quest.id === update.id || quest.title === update.title);
      if (index >= 0) {
        next.quests[index] = { ...next.quests[index], ...update };
      } else if (update.title && update.text) {
        next.quests.push({
          id: update.id || uid("quest"),
          title: update.title,
          text: update.text,
          status: update.status || "active"
        });
      }
    }
  }

  if (patch.martialArtLearned?.name) {
    const learned = normalizeMartialArt({ ...patch.martialArtLearned, name: patch.martialArtLearned.name });
    const existing = hero.martialArts.find((art) => art.id === learned.id || art.name === learned.name);
    if (existing) Object.assign(existing, learned);
    else hero.martialArts.push(learned);
    next.systemLog.push(`习得武学：${learned.name}`);
  }

  if (patch.martialArtUpdates) {
    for (const update of patch.martialArtUpdates) {
      const index = hero.martialArts.findIndex((art) => art.id === update.id || art.name === update.name);
      if (index >= 0 && update.name) {
        hero.martialArts[index] = normalizeMartialArt({ ...hero.martialArts[index], ...update, name: update.name });
      } else if (update.name) {
        hero.martialArts.push(normalizeMartialArt({ ...update, name: update.name }));
      }
    }
  }

  if (patch.systemNote) next.systemLog.push(patch.systemNote);
  if (patch.objectiveUpdate) next.objective = { ...next.objective, ...patch.objectiveUpdate };
  next.pendingCheck = patch.pendingCheck ? makePendingCheck(patch.pendingCheck) : undefined;
  next.character = relabelAbilities(hero);

  return normalizeGameState(next);
}

function advanceWorldLocally(state: GameState, globalUpdate: boolean): GamePatch {
  const current = currentLocation(state);
  const visible = state.npcs.filter(isVisibleNpc);
  const updates = visible
    .filter((npc) => globalUpdate || npc.location === current || npc.companion)
    .slice(0, globalUpdate ? 4 : 2)
    .map((npc) => ({
      name: npc.name,
      lastSeen: globalUpdate ? `${npc.location}一带似乎又有人提起过他。` : `${current}附近有过${npc.name}的消息。`
    }));

  return {
    npcUpdates: updates,
    systemNote: globalUpdate ? "江湖各处也在悄悄变化。" : "局势仍在顺着你的行动往前走。"
  };
}

function nextCombatPendingCheck(state: GameState): GamePatch["pendingCheck"] | undefined {
  if (!state.combat.active) return undefined;

  const martialArts = state.combat.enemyMartialArts || [];
  const nextArt = martialArts[Math.floor(Math.random() * Math.max(1, martialArts.length))];
  const linkedAbility = nextArt?.linkedAbility || "dex";
  const intent = nextArt
    ? `${state.combat.enemy}正想以${nextArt.name}继续压上来。`
    : `${state.combat.enemy}还在逼近，想再抢一轮先手。`;

  return {
    label: `应对${state.combat.enemy}的下一轮对招`,
    abilityKey: linkedAbility,
    martialArtId: nextArt?.id,
    dc: clamp((state.combat.enemyAc || 12) + 2, 11, 18),
    reason: intent,
    risk: "若失败，你会受伤，或被对方抢走身位。",
    enemyIntent: intent,
    suggestedAction: "可正面硬接，也可转身法、守势或别的办法拆局。"
  };
}

function buildDamageText(art: MartialArt) {
  const { rolls, total } = parseDamageDice(art.damageDice);
  const bonus = art.damageBonus || 0;
  const final = total + bonus;
  return `【伤害】${art.name} ${art.damageDice} => [${rolls.join(" + ")}]${bonus ? ` + ${bonus}` : ""} = ${final}`;
}

function parseHitResult(text: string) {
  const label = text.match(/【判定】(.+)/)?.[1]?.trim();
  const total = Number(text.match(/总计：(\d+)/)?.[1] || NaN);
  const dc = Number(text.match(/DC (\d+)/)?.[1] || NaN);
  const result = text.match(/结果：(成功|失败)/)?.[1];
  const damageTotal = Number(text.match(/= (\d+)\s*$/m)?.[1] || 0);

  return {
    label,
    total,
    dc,
    success: result ? result === "成功" : total >= dc,
    damageTotal
  };
}

function findLocationByName(state: GameState, name: string) {
  return state.locations.find((location) => location.name === name);
}

function findAbilityByKeyword(action: string): { abilityKey?: string; dc: number; label?: string; reason?: string; risk?: string } | undefined {
  if (/查看|调查|搜|打探|辨认|查验/.test(action)) {
    return {
      abilityKey: "int",
      dc: 12,
      label: "看出线索真伪",
      reason: "眼前线索杂乱，得分辨哪些能接着追。",
      risk: "若失败，你会看漏关键处，或惊动旁人。"
    };
  }

  if (/潜行|摸近|闪避|躲|轻功/.test(action)) {
    return {
      abilityKey: "dex",
      dc: 13,
      label: "不露声色地占位",
      reason: "局面紧，想悄悄抢到有利位置并不容易。",
      risk: "若失败，你会先暴露自己。"
    };
  }

  if (/说服|交涉|劝|安抚|套话/.test(action)) {
    return {
      abilityKey: "cha",
      dc: 12,
      label: "让对方松口",
      reason: "对方心里有防备，不会轻易把话说透。",
      risk: "若失败，对方会更警惕。"
    };
  }

  return undefined;
}

function localDm(action: string, state: GameState, globalUpdate: boolean): { text: string; patch: GamePatch } {
  const firstQuestPatch = firstQuestPatchForOrigin(state);
  const hit = parseHitResult(action);
  const atWuliang = currentLocation(state) === "无量山";
  const atDali = currentLocation(state) === "大理城";
  const atGusu = currentLocation(state) === "姑苏";
  const q1Active = hasQuest(state, QUEST_WANDERER_1, "active");
  const q2Active = hasQuest(state, QUEST_WANDERER_2, "active");
  const q3Active = hasQuest(state, QUEST_WANDERER_3, "active");
  const q4Active = hasQuest(state, QUEST_WANDERER_4, "active");
  const q5Active = hasQuest(state, QUEST_WANDERER_5, "active");

  if (!Number.isNaN(hit.total) && !Number.isNaN(hit.dc)) {
    if (state.combat.active) {
      const enemyName = state.combat.enemy || "对手";
      const enemyAfter = clamp((state.combat.enemyHp || 0) - hit.damageTotal, 0, state.combat.enemyMaxHp || 1);
      const nextCheck = enemyAfter > 0 ? nextCombatPendingCheck(state) : undefined;
      const enemyArt = (state.combat.enemyMartialArts || [])[0];
      const enemyDamage = enemyArt ? Math.max(2, Math.ceil(parseDamageDice(enemyArt.damageDice).total / 2)) : 4;

      const patch: GamePatch = {
        ...advanceWorldLocally(state, globalUpdate),
        ...(firstQuestPatch || {}),
        hpChange: hit.success ? 0 : -enemyDamage,
        combatUpdate: {
          enemyHpChange: hit.success ? -hit.damageTotal : 0,
          enemyStatusAdd: hit.success ? (hit.total - hit.dc >= 5 ? ["露出破绽"] : []) : [],
          enemyMartialArtUsed: hit.success ? hit.label : undefined
        },
        combatAction: hit.success && enemyAfter <= 0 ? "exit" : "none",
        pendingCheck: nextCheck
      };

      if (hit.success && enemyAfter <= 0 && q2Active) {
        patch.questUpdates = [
          { id: QUEST_WANDERER_2, status: "resolved" },
          {
            id: QUEST_WANDERER_3,
            title: "茶肆旧账",
            text: "从黑衣人身上的残页与药味回到大理城南茶肆，对上那条旧线。",
            status: "active"
          }
        ];
        patch.objectiveUpdate = {
          title: "茶肆旧账",
          text: "带着搜出的残页回大理城，找阿朱或茶肆掌柜对证。",
          location: "大理城",
          npc: "阿朱"
        };
        patch.newItem = {
          id: "ledger-fragment",
          name: "账册残页",
          desc: "墨迹里夹着药材名与一笔去向不明的江南脚费。",
          count: 1,
          type: "quest"
        };
        patch.npcUpdates = [
          { name: "阿朱", discovered: true, hidden: false }
        ];
        patch.systemNote = "黑衣人的来路已经有了第一条硬线索。";
      }

      const text = hit.success
        ? enemyAfter > 0
          ? `你这一招已经打实，${enemyName}被逼得退开半步，但还没彻底失势。对方随即稳住架子，准备再换一手压回来，战局仍在滚着往前。`
          : q2Active
            ? `这一记终于把${enemyName}的架子彻底打散。你在对方身上搜出一页沾药味的残账，顺着字迹一看，线索竟又指回了大理城。`
            : `这一记终于把${enemyName}的架子彻底打散。对方再难把气续上，只能退败，眼前这一场对招算是分出了高下。`
        : `${enemyName}抓住你这一瞬的失手反逼上来，你没能把局面按住，反倒被对方打乱脚步，身上结结实实吃下了后手。`;

      return { text, patch };
    }

    if (q1Active && hit.label?.includes("山道上的黑影")) {
      if (hit.success) {
        const enemyName = "黑衣刺客";
        return {
          text: "你终于没再让那团黑影滑走。山道尽头的人影被你逼得回身出手，先前那点试探一下子变成了真刀真枪的灭口。",
          patch: {
            ...advanceWorldLocally(state, globalUpdate),
            questUpdates: [
              { id: QUEST_WANDERER_1, status: "resolved" },
              {
                id: QUEST_WANDERER_2,
                title: "截住灭口之人",
                text: "黑衣人已经现身，别让他带着线索逃下山去。",
                status: "active"
              }
            ],
            objectiveUpdate: {
              title: "截住灭口之人",
              text: "拿下黑衣人，再看看他身上藏着什么。",
              location: "无量山"
            },
            combatAction: "enter",
            enemyName,
            pendingCheck: {
              label: `接下${enemyName}的起手`,
              abilityKey: "dex",
              dc: 14,
              reason: `${enemyName}被你追住后立刻反扑，想强行撕开退路。`,
              risk: "若失败，你会先吃一记暗手。",
              enemyIntent: `${enemyName}想逼退你，再跳下山道脱身。`,
              suggestedAction: "可用身法抢位，也可直接用刀路硬接。"
            },
            systemNote: "碎瓷夜痕已经从暗线变成了正面交锋。"
          }
        };
      }

      return {
        text: "那道黑影还是从你视线边缘滑了过去。你没完全跟丢，但也被迫慢了半步，只能顺着更险的山道继续咬上去。",
        patch: {
          ...advanceWorldLocally(state, globalUpdate),
          hpChange: -1,
          pendingCheck: {
            label: "追住山道上的黑影",
            abilityKey: "dex",
            dc: 13,
            reason: "山道狭窄，脚印忽明忽暗，想继续咬住对方并不轻松。",
            risk: "若再次失手，对方会把痕迹抹得更干净。"
          }
        }
      };
    }

    if (q3Active && hit.label?.includes("茶肆里的人情口风")) {
      if (hit.success) {
        return {
          text: "你从闲话和旧账里把线头一根根抽了出来。药材、脚费和江南水路被悄悄串成一线，买主显然已经把尾巴伸向了姑苏。",
          patch: {
            ...advanceWorldLocally(state, globalUpdate),
            questUpdates: [
              { id: QUEST_WANDERER_3, status: "resolved" },
              {
                id: QUEST_WANDERER_4,
                title: "江南买主",
                text: "顺着账册残页的去向，去姑苏查那位藏在水路后的买主。",
                status: "active"
              }
            ],
            objectiveUpdate: {
              title: "江南买主",
              text: "前往姑苏，从水路与旧账里继续把买主挖出来。",
              location: "姑苏",
              npc: "王语嫣"
            },
            systemNote: "这条无名客的线，已经从山道追到了江南。"
          }
        };
      }

      return {
        text: "茶肆里的人都精得很，你这次没能让谁真正松口。药味和旧账还在，但最关键的那层话始终没被翻出来。",
        patch: {
          ...advanceWorldLocally(state, globalUpdate),
          pendingCheck: undefined
        }
      };
    }

    if (q4Active && hit.label?.includes("辨认姑苏水路暗记")) {
      if (hit.success) {
        return {
          text: "你把账页、水路标记和船家的旧口供一一对上，终于看出这条线不是普通走私，而是在替更大的买主转运人手与药材。线头再往上，已经直指燕子坞附近的一处藏船点。",
          patch: {
            ...advanceWorldLocally(state, globalUpdate),
            objectiveUpdate: {
              title: "逼近藏船点",
              text: "找到燕子坞外那处藏船点，看看是谁在背后收人收货。",
              location: "姑苏",
              npc: "王语嫣"
            },
            pendingCheck: {
              label: "潜近藏船点",
              abilityKey: "dex",
              dc: 14,
              reason: "藏船点周围有人巡看，你得先摸进去，才有资格看更深的账。",
              risk: "若失败，会被对方先一步发觉。",
              suggestedAction: "可用身法潜近，也可先想办法引开看守。"
            },
            systemNote: "姑苏这条线终于不再只停在账面上。"
          }
        };
      }

      return {
        text: "你把那些暗记看了一遍又一遍，终究还是差了半层意思。线索没有断，却还没够硬，暂时只能继续从人情和地头消息里兜回去。",
        patch: {
          ...advanceWorldLocally(state, globalUpdate),
          pendingCheck: undefined
        }
      };
    }

    if (q4Active && hit.label?.includes("潜近藏船点")) {
      if (hit.success) {
        return {
          text: "你贴着水岸和断墙摸了进去，守夜的人直到你掀开油布才意识到有人已经进来了。船底压着的不只是药材，还有一封写着交货时辰与接头名号的短札。",
          patch: {
            ...advanceWorldLocally(state, globalUpdate),
            questUpdates: [
              { id: QUEST_WANDERER_4, status: "resolved" },
              {
                id: QUEST_WANDERER_5,
                title: "藏船夜斗",
                text: "有人已经发现你摸到了藏船点，拿着短札杀出去，或者当场压住对方。",
                status: "active"
              }
            ],
            objectiveUpdate: {
              title: "藏船夜斗",
              text: "守住短札，查出接头人的真实身份。",
              location: "姑苏",
              npc: "慕容复"
            },
            newItem: {
              id: "night-note",
              name: "接头短札",
              desc: "写着交货时辰、燕子坞外水路和一枚模糊的慕容家印。",
              count: 1,
              type: "quest"
            },
            pendingCheck: {
              label: "接下藏船点的灭口反扑",
              abilityKey: "str",
              dc: 14,
              reason: "你已经拿到短札，对方不会再讲理，只想把你当场压死在岸边。",
              risk: "若失败，你会受伤，短札也可能被抢回去。",
              suggestedAction: "可以硬拼，也可以借地形把对方卡在船岸之间。"
            },
            systemNote: "无名客这条线，终于摸到背后那只真正伸出来的手。"
          }
        };
      }

      return {
        text: "你刚想贴近，岸边那盏灯就偏了过来。对方虽然没彻底看清你是谁，但藏船点已经起了防备，接下来再想摸进去就难多了。",
        patch: {
          ...advanceWorldLocally(state, globalUpdate),
          hpChange: -1,
          pendingCheck: undefined
        }
      };
    }

    if (q5Active && hit.label?.includes("接下藏船点的灭口反扑")) {
      if (hit.success) {
        return {
          text: "你没让对方把气势压实，反倒借着船岸狭窄一刀逼开去路。短札保住了，背后那点若有若无的燕子坞影子，也终于从猜测变成了可以继续追的实线。",
          patch: {
            ...advanceWorldLocally(state, globalUpdate),
            questUpdates: [{ id: QUEST_WANDERER_5, status: "resolved" }],
            objectiveUpdate: {
              title: "燕子坞疑云",
              text: "带着短札继续往燕子坞方向深挖，这条线已经够资格进入下一章。",
              location: "姑苏",
              npc: "王语嫣"
            },
            chapter: "第二卷：姑苏水影",
            systemNote: "无名客主线的第一章已经跑通，下一步可以顺着燕子坞继续展开。"
          }
        };
      }

      return {
        text: "对方这一轮反扑来得太狠，你虽然没把短札当场丢掉，却也被逼得先退了半步。线索还在，可局面已经更险。",
        patch: {
          ...advanceWorldLocally(state, globalUpdate),
          hpChange: -3,
          pendingCheck: undefined
        }
      };
    }

    return {
      text: hit.success
        ? "这一判定过了，你的动作没有白费，局势顺着你的判断往前松开了一截。"
        : "这一判定没过，事情没有按你预想那样展开，反而留下了点后手和麻烦。",
      patch: {
        ...advanceWorldLocally(state, globalUpdate),
        ...(firstQuestPatch || {}),
        pendingCheck: undefined
      }
    };
  }

  const travelMatch = action.match(/^前往[【\[]?(.+?)[】\]]?$/);
  if (travelMatch) {
    const targetName = travelMatch[1].trim();
    const target = findLocationByName(state, targetName);

    if (!target) {
      return {
        text: "你想去的地方眼下还叫不准，先把去向再认清些。",
        patch: {
          ...advanceWorldLocally(state, globalUpdate),
          ...(firstQuestPatch || {})
        }
      };
    }

    if (!target.unlocked) {
      return {
        text: `${targetName}这一路线索还不够，贸然赶过去只会扑空。`,
        patch: {
          ...advanceWorldLocally(state, globalUpdate),
          ...(firstQuestPatch || {})
        }
      };
    }

    return {
      text: `你把方向定向${targetName}，一路赶去。沿途风尘未歇，但周围的人和消息，已经换成了新的局面。`,
      patch: {
        ...advanceWorldLocally(state, globalUpdate),
        ...(firstQuestPatch || {}),
        location: targetName,
        objectiveUpdate: {
          location: targetName
        },
        pendingCheck: undefined
      }
    };
  }

  if (q1Active && atWuliang && /碎瓷|脚印|药味|追踪|山道|跟上|盯住/.test(action) && !state.combat.active) {
    return {
      text: "山风一卷，草里的碎瓷味更明显了。你顺着那点药味和刚刚压断的草痕往上摸，前头果然有一道走得极快的黑影。",
      patch: {
        ...advanceWorldLocally(state, globalUpdate),
        pendingCheck: {
          label: "追住山道上的黑影",
          abilityKey: "dex",
          dc: 13,
          reason: "对方轻功不差，山道又窄，稍一慢就会把人彻底放掉。",
          risk: "若失败，对方会先一步找地方灭口或抹掉痕迹。",
          suggestedAction: "优先用身法咬住，也可以靠悟性判断对方会往哪一折。"
        }
      }
    };
  }

  if (q3Active && atDali && /阿朱|茶肆|账页|药味|对证|掌柜|打探/.test(action)) {
    return {
      text: "城南茶肆里的人都不愿把话说满，但你已经把账页、药味和无量山那场追杀连在了一起。接下来，得逼出一句能落地的实话。",
      patch: {
        ...advanceWorldLocally(state, globalUpdate),
        pendingCheck: {
          label: "茶肆里的人情口风",
          abilityKey: "cha",
          dc: 12,
          reason: "你得让对方觉得，继续含糊下去反而更危险。",
          risk: "若失败，消息会暂时闷回水里。",
          suggestedAction: "可用话术试压，也可用悟性拆穿其中漏洞。"
        }
      }
    };
  }

  if (q4Active && atGusu && /王语嫣|水路|账页|暗记|船|码头|辨认|查账/.test(action)) {
    return {
      text: "姑苏的水路消息不在明面上，账页上的字、船身上的暗记、甚至谁在夜里多看了你一眼，都是要拼起来看的东西。",
      patch: {
        ...advanceWorldLocally(state, globalUpdate),
        pendingCheck: {
          label: "辨认姑苏水路暗记",
          abilityKey: "int",
          dc: 13,
          reason: "这条线不是靠蛮闯就能看明白的，你得先读懂它。",
          risk: "若失败，你会错过真正的藏船方向。",
          suggestedAction: "可向王语嫣求证，也可自己对着账页慢慢拆。"
        }
      }
    };
  }

  if (q4Active && atGusu && /潜入|摸进去|藏船|岸边|夜探|跟船|靠近/.test(action)) {
    return {
      text: "你把呼吸压低，沿着水岸和断墙一点点试着贴过去。燕子坞外这片水道看似安静，实则每一盏灯都像在替谁看路。",
      patch: {
        ...advanceWorldLocally(state, globalUpdate),
        pendingCheck: {
          label: "潜近藏船点",
          abilityKey: "dex",
          dc: 14,
          reason: "藏船点外还有人巡看，贴得太慢会被看见，贴得太快又容易踩出声。",
          risk: "若失败，对方会提前起疑。",
          suggestedAction: "用身法贴近，或先想办法做个响动把人引开。"
        }
      }
    };
  }

  if (q5Active && /出手|动手|迎战|拔刀|硬接|反扑|灭口/.test(action) && !state.combat.active) {
    return {
      text: "你刚把短札握稳，岸边的人已经翻脸扑了上来。对方很清楚，只要让你把这纸东西带出去，后面的人就再也藏不住了。",
      patch: {
        ...advanceWorldLocally(state, globalUpdate),
        pendingCheck: {
          label: "接下藏船点的灭口反扑",
          abilityKey: "str",
          dc: 14,
          reason: "对方仗着人熟地熟，想把你死死压在船岸之间。",
          risk: "若失败，你会受伤，线索也会有失手风险。",
          suggestedAction: "可以正面硬接，也可以借船身和木桩卡住对方的步子。"
        }
      }
    };
  }

  const namedEnemy = enemyPresets.find((preset) => action.includes(preset.name));
  const enterCombat = namedEnemy || (/出手|动手|交手|迎战|比武|开打|拼斗|杀过去|攻击/.test(action) && !state.combat.active);
  if (enterCombat && !state.combat.active) {
    const enemyName = namedEnemy?.name || "黑衣刺客";
    const preset = findEnemyPreset(enemyName);
    return {
      text: namedEnemy
        ? `你这一动，${enemyName}果然不再藏着，气势一下压了过来。对方不是寻常杂兵，招路、内息、眼神都透着成名人物的分量。`
        : "你这一动，暗处的人也不再忍了，刀风一下子就逼到了眼前。眼前这局，已经从试探变成了真正交手。",
      patch: {
        ...advanceWorldLocally(state, globalUpdate),
        ...(firstQuestPatch || {}),
        combatAction: "enter",
        enemyName: preset.name,
        pendingCheck: {
          label: `接下${preset.name}的起手`,
          abilityKey: preset.martialArts[0]?.linkedAbility || "dex",
          martialArtId: preset.martialArts[0]?.id,
          dc: clamp(preset.ac + 2, 12, 18),
          reason: `${preset.name}已经抢先出招，你必须立刻应对。`,
          risk: "若失败，你会受伤，甚至被对方压住节奏。",
          enemyIntent: `${preset.name}想先抢住身位，再把你逼进死角。`,
          suggestedAction: "可以硬接、拆招、闪躲，或直接拿武学回敬。"
        }
      }
    };
  }

  const suggestedCheck = findAbilityByKeyword(action);
  if (suggestedCheck) {
    return {
      text: "你这一手已经碰到了关键处，但还得给出一个更明确的判断，才能看清接下来是顺是逆。",
      patch: {
        ...advanceWorldLocally(state, globalUpdate),
        ...(firstQuestPatch || {}),
        pendingCheck: {
          label: suggestedCheck.label || "给出判断",
          abilityKey: suggestedCheck.abilityKey,
          dc: suggestedCheck.dc,
          reason: suggestedCheck.reason,
          risk: suggestedCheck.risk
        }
      }
    };
  }

  if (firstQuestPatch) {
    return {
      text: "你迈出的第一步已经让局势真正动了起来。原本还只是气味、脚印和旁人的只言片语，此刻终于慢慢拢成了一条像样的线索。",
      patch: {
        ...advanceWorldLocally(state, globalUpdate),
        ...firstQuestPatch,
        pendingCheck: undefined
      }
    };
  }

  return {
    text: `你照着“${action}”去做，局势没有立刻翻脸，却也确实被你拨动了一下。消息、人心和脚步都在慢慢往下一层推。`,
    patch: {
      ...advanceWorldLocally(state, globalUpdate),
      pendingCheck: undefined
    }
  };
}

function SetupScreen(props: {
  customName: string;
  setCustomName: (value: string) => void;
  selectedOrigin: OriginTemplate;
  selectedOriginId: string;
  setSelectedOriginId: (value: string) => void;
  abilityChoices: RollPackage[];
  selectedChoiceIndex: number;
  setSelectedChoiceIndex: (value: number) => void;
  onStart: () => void;
  onContinue?: () => void;
}) {
  const {
    customName,
    setCustomName,
    selectedOrigin,
    selectedOriginId,
    setSelectedOriginId,
    abilityChoices,
    selectedChoiceIndex,
    setSelectedChoiceIndex,
    onStart,
    onContinue
  } = props;

  const abilityOrder: Array<keyof typeof abilityLabels> = ["str", "dex", "con", "int", "cha", "wis"];

  return (
    <section className="setup-screen">
      <div className="setup-shell">
        <header className="setup-title">
          <p>江湖 DM 新版开局</p>
          <h1>入局之前</h1>
          <span>这一版先只做一条能跑通的“无名客”主线。挑一组命数，直接进江湖。</span>
        </header>

        {onContinue && (
          <div className="setup-actions">
            <button type="button" onClick={onContinue}>继续上次存档</button>
          </div>
        )}

        <div className="setup-panel">
          <label className="name-field">
            姓名
            <input value={customName} onChange={(event) => setCustomName(event.target.value)} maxLength={8} />
          </label>

          <div className="origin-grid">
            {playableOrigins.map((origin) => (
              <button
                key={origin.id}
                type="button"
                className={selectedOriginId === origin.id ? "selected" : ""}
                onClick={() => setSelectedOriginId(origin.id)}
              >
                <b>{origin.name}</b>
                <span>{origin.desc}</span>
              </button>
            ))}
          </div>

          <article className="origin-hook">
            <b>{selectedOrigin.name}</b>
            <span>{selectedOrigin.setupHint}</span>
          </article>

          <section className="roll-packages">
            <header>
              <b>roll3选1</b>
              <span>每组属性都按 3d6 掷出</span>
            </header>

            {abilityChoices.map((choice, index) => (
              <button
                key={`${selectedOrigin.id}-${index}`}
                type="button"
                className={selectedChoiceIndex === index ? "selected" : ""}
                onClick={() => setSelectedChoiceIndex(index)}
              >
                <strong>命数 {index + 1}</strong>
                <div>
                  {choice.map((value, abilityIndex) => {
                    const key = abilityOrder[abilityIndex];
                    return <span key={key}>{abilityLabels[key]} {value}</span>;
                  })}
                </div>
              </button>
            ))}
          </section>

          <button className="primary-action" type="button" onClick={onStart}>
            以此命数入局
          </button>
        </div>
      </div>
    </section>
  );
}

function NpcCard({ npc }: { npc: Npc }) {
  return (
    <article className="npc-card">
      <img src={npc.portrait} alt={`${npc.name}立绘`} />
      <div>
        <header>
          <b>{npc.name}</b>
          <span>{npc.attitude}</span>
        </header>
        <p>{npc.title} · {npc.location}</p>
        <small>{npc.goal}</small>
      </div>
    </article>
  );
}

function DiceFace({ value }: { value: number }) {
  return (
    <div
      className="dice-canvas"
      style={{
        display: "grid",
        placeItems: "center",
        borderRadius: 18,
        border: "2px solid rgba(242, 212, 141, .7)",
        background: "linear-gradient(180deg, #4a2d18, #1c120c)",
        color: "#f2d48d",
        fontSize: 48,
        fontWeight: 800,
        boxShadow: "0 18px 48px rgba(0,0,0,.45)"
      }}
    >
      {value}
    </div>
  );
}

function MessageBubble({ message }: { message: Message }) {
  const label = message.role === "dm"
    ? "说书人"
    : message.role === "player"
      ? "你"
      : message.role === "dice"
        ? "骰子"
        : "系统";

  return (
    <article className={`message ${message.role}`}>
      <span>{label}</span>
      <p>{message.text}</p>
    </article>
  );
}

export function App() {
  const savedGame = readJson<GameState>(SAVE_KEY, initialGameState);
  const initialApi = readJson<ApiConfig>(API_KEY, defaultApiConfig("openai"));

  const [game, setGame] = useState<GameState>(() => normalizeGameState(savedGame));
  const [api, setApi] = useState<ApiConfig>(() => normalizeApiConfig(initialApi));
  const [customName, setCustomName] = useState("无名客");
  const [selectedOriginId, setSelectedOriginId] = useState(PLAYABLE_ORIGIN_ID);
  const [abilityChoices, setAbilityChoices] = useState<RollPackage[]>(() => makeAbilityChoices());
  const [selectedChoiceIndex, setSelectedChoiceIndex] = useState(0);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<DrawerTab>("character");
  const [input, setInput] = useState("");
  const [rollMode, setRollMode] = useState<RollMode>("normal");
  const [diceOpen, setDiceOpen] = useState(false);
  const [qiInvest, setQiInvest] = useState(0);
  const [selectedLocationId, setSelectedLocationId] = useState<string | undefined>(undefined);
  const [selectedInventoryMartialId, setSelectedInventoryMartialId] = useState<string | undefined>(undefined);
  const [selectedAbilityInfoKey, setSelectedAbilityInfoKey] = useState<string | undefined>(undefined);
  const [rolling, setRolling] = useState<RollingState | null>(null);
  const [busy, setBusy] = useState(false);
  const [apiTest, setApiTest] = useState<ApiTestState>({ status: "idle" });
  const [musicEnabled, setMusicEnabled] = useState(() => readJson<boolean>(BGM_KEY, true));
  const [bgmVolume, setBgmVolume] = useState(() => clamp(readJson<number>(BGM_VOLUME_KEY, 34), 0, 100));
  const endRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const fadeTimerRef = useRef<number | null>(null);

  const globalUpdateDue = (game.actionCount + 1) % WORLD_STEP === 0;
  const panelOpen = drawerOpen || diceOpen;
  const locationName = currentLocation(game);
  const visibleNpcs = useMemo(() => game.npcs.filter(isVisibleNpc), [game]);
  const companions = visibleNpcs.filter((npc) => npc.companion);
  const selectedOrigin = playableOrigins.find((origin) => origin.id === selectedOriginId) || playableOrigins[0];
  const sceneBackground = sceneAssets[game.sceneType] || sceneAssets.market;
  const qiLimit = Math.min(QI_INVEST_LIMIT, game.character.qi);
  const lowQi = game.character.qi <= 1;
  const selectedLocation = game.locations.find((location) => location.id === selectedLocationId)
    || game.locations.find((location) => location.current)
    || game.locations[0];
  const selectedInventoryMartial = game.character.martialArts.find((art) => art.id === selectedInventoryMartialId);
  const canContinue = Boolean(readJson<GameState>(SAVE_KEY, initialGameState).setupComplete);

  useEffect(() => {
    setAbilityChoices(makeAbilityChoices());
    setSelectedChoiceIndex(0);
  }, [selectedOriginId]);

  useEffect(() => {
    localStorage.setItem(SAVE_KEY, JSON.stringify(game));
  }, [game]);

  useEffect(() => {
    localStorage.setItem(API_KEY, JSON.stringify(api));
  }, [api]);

  useEffect(() => {
    localStorage.setItem(BGM_KEY, JSON.stringify(musicEnabled));
  }, [musicEnabled]);

  useEffect(() => {
    localStorage.setItem(BGM_VOLUME_KEY, JSON.stringify(bgmVolume));
  }, [bgmVolume]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [game.messages, busy]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    audio.loop = true;

    if (!game.setupComplete || !musicEnabled) {
      if (fadeTimerRef.current !== null) {
        window.clearInterval(fadeTimerRef.current);
        fadeTimerRef.current = null;
      }
      audio.pause();
      return;
    }

    startMusicWithFade();

    return () => {
      if (fadeTimerRef.current !== null) {
        window.clearInterval(fadeTimerRef.current);
        fadeTimerRef.current = null;
      }
    };
  }, [game.setupComplete, musicEnabled, bgmVolume]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !musicEnabled || audio.paused) return;
    audio.volume = bgmVolume / 100;
  }, [bgmVolume, musicEnabled]);

  function startMusicWithFade() {
    const audio = audioRef.current;
    if (!audio) return;

    if (fadeTimerRef.current !== null) {
      window.clearInterval(fadeTimerRef.current);
      fadeTimerRef.current = null;
    }

    const targetVolume = bgmVolume / 100;
    audio.loop = true;
    audio.volume = 0;
    void audio.play().then(() => {
      const steps = 12;
      let currentStep = 0;
      fadeTimerRef.current = window.setInterval(() => {
        currentStep += 1;
        audio.volume = Math.min(targetVolume, (targetVolume / steps) * currentStep);
        if (currentStep >= steps && fadeTimerRef.current !== null) {
          window.clearInterval(fadeTimerRef.current);
          fadeTimerRef.current = null;
        }
      }, 120);
    }).catch(() => undefined);
  }

  function tryPlayMusic() {
    const audio = audioRef.current;
    if (!audio || !musicEnabled) return;
    if (!audio.paused) return;
    startMusicWithFade();
  }

  function toggleMusic() {
    const next = !musicEnabled;
    setMusicEnabled(next);
    const audio = audioRef.current;
    if (!audio) return;

    if (next) {
      startMusicWithFade();
    } else {
      if (fadeTimerRef.current !== null) {
        window.clearInterval(fadeTimerRef.current);
        fadeTimerRef.current = null;
      }
      audio.pause();
    }
  }

  async function callAi(updatedGame: GameState, playerAction: string, customPrompt?: string) {
    if (!api.apiUrl || !api.apiKey || !api.model) {
      return localDm(playerAction, updatedGame, globalUpdateDue);
    }

    const messages = [
      { role: "system", content: buildSystemPrompt(updatedGame, globalUpdateDue) },
      ...updatedGame.messages.slice(-10).map((message) => ({
        role: message.role === "player" ? "user" : "assistant",
        content: message.text
      })),
      ...(customPrompt ? [{ role: "user", content: customPrompt }] : []),
      { role: "user", content: playerAction }
    ];

    const response = await fetch(api.apiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${api.apiKey}`
      },
      body: JSON.stringify({
        model: api.model,
        messages,
        temperature: 0.8,
        max_tokens: 450
      })
    });

    if (!response.ok) {
      throw new Error(`API 返回 HTTP ${response.status}`);
    }

    const data = await response.json();
    const raw = data.choices?.[0]?.message?.content || "";
    const { visibleText, patchText } = stripJsonBlock(raw);
    let patch: GamePatch = {};
    if (patchText) patch = JSON.parse(patchText) as GamePatch;
    return {
      text: visibleText || "说书人沉吟了一瞬，局势暂时没有再往前翻出新变化。",
      patch
    };
  }

  async function runApiTest() {
    if (!api.apiUrl || !api.apiKey || !api.model) {
      setApiTest({ status: "error", message: "请先填写 API URL、Model 和 API Key。" });
      return;
    }

    setApiTest({ status: "testing", message: "测试中..." });

    try {
      const response = await fetch(api.apiUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${api.apiKey}`
        },
        body: JSON.stringify({
          model: api.model,
          messages: [
            { role: "system", content: "You are a connectivity probe." },
            { role: "user", content: "Reply with OK." }
          ],
          max_tokens: 8,
          temperature: 0
        })
      });

      if (!response.ok) {
        setApiTest({ status: "error", message: `连通失败：HTTP ${response.status}` });
        return;
      }

      setApiTest({ status: "success", message: "连通成功，可以正常请求模型。" });
    } catch (error) {
      setApiTest({
        status: "error",
        message: `连通失败：${error instanceof Error ? error.message : "未知错误"}`
      });
    }
  }

  async function submitAction(textOverride?: string) {
    const text = (textOverride || input).trim();
    if (!text || busy) return;

    tryPlayMusic();
    setBusy(true);
    setDrawerOpen(false);
    setDiceOpen(false);
    setInput("");

    const playerMessage: Message = { id: uid("player"), role: "player", text };
    const nextTime = advanceTime(game);
    const baseGame: GameState = {
      ...game,
      actionCount: game.actionCount + 1,
      sceneType: inferSceneType(text) || game.sceneType,
      ...nextTime,
      messages: [...game.messages, playerMessage]
    };

    setGame(baseGame);

    try {
      const aiResult = await callAi(baseGame, text, globalUpdateDue ? "顺手让江湖其他人也往前动一动。" : undefined);
      setGame((prev) => {
        const patched = applyPatchToState(prev, withSceneFallback(aiResult.patch, aiResult.text, text));
        return {
          ...patched,
          messages: [...patched.messages, { id: uid("dm"), role: "dm", text: aiResult.text }]
        };
      });
    } catch (error) {
      const fallback = localDm(text, baseGame, globalUpdateDue);
      setGame((prev) => {
        const patched = applyPatchToState(prev, withSceneFallback(fallback.patch, fallback.text, text));
        return {
          ...patched,
          messages: [
            ...patched.messages,
            { id: uid("system"), role: "system", text: `API 调用失败，已切回本地主持：${error instanceof Error ? error.message : ""}` },
            { id: uid("dm"), role: "dm", text: fallback.text }
          ]
        };
      });
    } finally {
      setBusy(false);
    }
  }

  async function submitDiceResult(text: string, qiSpent = 0) {
    if (busy) return;

    tryPlayMusic();
    setBusy(true);
    setDrawerOpen(false);
    setDiceOpen(false);

    const diceMessage: Message = { id: uid("dice"), role: "dice", text };
    const nextTime = advanceTime(game);
    const baseGame: GameState = {
      ...game,
      pendingCheck: undefined,
      character: {
        ...game.character,
        qi: clamp(game.character.qi - qiSpent, 0, game.character.maxQi)
      },
      actionCount: game.actionCount + 1,
      ...nextTime,
      messages: [...game.messages, diceMessage]
    };

    setGame(baseGame);

    try {
      const aiResult = await callAi(baseGame, text, globalUpdateDue ? "顺手让江湖其他人也往前动一动。" : undefined);
      setGame((prev) => {
        const patched = applyPatchToState(prev, withSceneFallback(aiResult.patch, aiResult.text, text));
        return {
          ...patched,
          messages: [...patched.messages, { id: uid("dm"), role: "dm", text: aiResult.text }]
        };
      });
    } catch (error) {
      const fallback = localDm(text, baseGame, globalUpdateDue);
      setGame((prev) => {
        const patched = applyPatchToState(prev, withSceneFallback(fallback.patch, fallback.text, text));
        return {
          ...patched,
          pendingCheck: undefined,
          messages: [
            ...patched.messages,
            { id: uid("system"), role: "system", text: `API 调用失败，已切回本地主持：${error instanceof Error ? error.message : ""}` },
            { id: uid("dm"), role: "dm", text: fallback.text }
          ]
        };
      });
    } finally {
      setBusy(false);
    }
  }

  function rollDice(
    label: string,
    mod: number,
    check?: PendingCheck,
    options: {
      martialArt?: MartialArt;
      qiBonusSpend?: number;
      sendToDm?: boolean;
    } = {}
  ) {
    if (rolling || busy) return;

    const sendToDm = options.sendToDm ?? Boolean(check);
    const qiBonusSpend = clamp(options.qiBonusSpend ?? qiInvest, 0, game.character.qi);
    const qiBonus = qiInvestBonus(qiBonusSpend);
    const first = Math.ceil(Math.random() * 20);
    const second = Math.ceil(Math.random() * 20);
    const picked = rollMode === "advantage"
      ? Math.max(first, second)
      : rollMode === "disadvantage"
        ? Math.min(first, second)
        : first;
    const total = picked + mod + qiBonus;
    const success = check ? total >= check.dc : undefined;
    const modeText = rollMode === "advantage"
      ? `优势(${first}/${second})`
      : rollMode === "disadvantage"
        ? `劣势(${first}/${second})`
        : "常规";

    const lines = [
      `【判定】${label}`,
      `模式：${modeText}`,
      `d20：${picked}`,
      `加值：${mod >= 0 ? "+" : ""}${mod}`,
      `内力：${qiBonusSpend}（判定 +${qiBonus}）`,
      check ? `总计：${total} / DC ${check.dc}` : `总计：${total}`,
      check ? `结果：${success ? "成功" : "失败"}` : "结果：仅记录本次掷骰"
    ];

    setRolling({ label, picked, total, qiBonus, modeText });
    setQiInvest(0);
    setDiceOpen(false);
    setDrawerOpen(false);

    window.setTimeout(() => {
      setRollMode("normal");
      setRolling(null);

      const martialCostOnHit = options.martialArt?.category === "internal" && success
        ? options.martialArt.baseQiCost
        : 0;
      const totalQiSpent = qiBonusSpend + martialCostOnHit;

      if (sendToDm) {
        let payload = lines.join("\n");
        if (check && success && options.martialArt) {
          payload = `${payload}\n${buildDamageText(options.martialArt)}`;
        }
        void submitDiceResult(payload, totalQiSpent);
        return;
      }

      setGame((prev) => ({
        ...prev,
        character: {
          ...prev.character,
          qi: clamp(prev.character.qi - qiBonusSpend, 0, prev.character.maxQi)
        },
        messages: [...prev.messages, { id: uid("dice"), role: "dice", text: lines.join("\n") }]
      }));
    }, 1180);
  }

  function useItem(item: Item) {
    setGame((prev) => {
      const next = structuredClone(prev);
      const target = next.character.inventory.find((entry) => entry.id === item.id);
      if (!target) return prev;

      if (target.hpRestore) next.character.hp = clamp(next.character.hp + target.hpRestore, 0, next.character.maxHp);
      if (target.qiRestore) next.character.qi = clamp(next.character.qi + target.qiRestore, 0, next.character.maxQi);
      target.count -= 1;
      next.character.inventory = next.character.inventory.filter((entry) => entry.count > 0);
      next.systemLog.push(`使用：${item.name}`);
      return next;
    });
  }

  function startOriginGame() {
    const choice = abilityChoices[selectedChoiceIndex] || abilityChoices[0];
    const hero = makeCharacterFromOrigin(customName, selectedOrigin, choice);
    const guide = playableRouteGuides[selectedOrigin.id];
    const startLocation = guide?.objective.location || currentLocation(initialGameState);

    setGame(normalizeGameState({
      ...structuredClone(initialGameState),
      setupComplete: true,
      originId: PLAYABLE_ORIGIN_ID,
      creationMode: "origin",
      sceneType: guide?.sceneType || "market",
      currentCharacterId: hero.id,
      character: hero,
      roster: [hero],
      locations: initialGameState.locations.map((location) => ({
        ...location,
        current: location.name === startLocation,
        unlocked: location.unlocked || location.name === startLocation
      })),
      messages: [
        { id: "m0", role: "dm", text: guide?.intro || selectedOrigin.intro },
        { id: uid("system"), role: "system", text: `${hero.name}以“${selectedOrigin.name}”的身份入局。` }
      ],
      objective: guide?.objective || initialGameState.objective,
      systemLog: ["入局引导已开始，首轮行动后才会正式派发任务。"]
    }));

    localStorage.setItem(SETUP_KEY, "1");
    tryPlayMusic();
  }

  function continueGame() {
    setGame((prev) => normalizeGameState({ ...prev, setupComplete: true }));
    localStorage.setItem(SETUP_KEY, "1");
    tryPlayMusic();
  }

  function openDrawer(tab: DrawerTab = activeTab) {
    setActiveTab(tab);
    setDiceOpen(false);
    setDrawerOpen(true);
  }

  function openPendingCheck() {
    setDrawerOpen(false);
    setDiceOpen(true);
  }

  function toggleDice() {
    setDrawerOpen(false);
    setDiceOpen((open) => !open);
  }

  function switchScene(sceneType: SceneType) {
    setGame((prev) => ({ ...prev, sceneType }));
  }

  function travelToLocation(name: string) {
    setDrawerOpen(false);
    setDiceOpen(false);
    void submitAction(`前往【${name}】`);
  }

  function exportSave() {
    const save = JSON.stringify(game, null, 2);
    const blob = new Blob([save], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `jianghu-dm-save-day-${game.worldDay}.json`;
    link.click();
    URL.revokeObjectURL(url);
  }

  function importSave(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      try {
        const imported = JSON.parse(String(reader.result)) as GameState;
        setGame(normalizeGameState(imported));
        localStorage.setItem(SETUP_KEY, "1");
      } catch {
        setGame((prev) => ({
          ...prev,
          messages: [...prev.messages, { id: uid("system"), role: "system", text: "导入失败，这份存档读不出来。" }]
        }));
      }
    };
    reader.readAsText(file);
    event.target.value = "";
  }

  function resetGame() {
    localStorage.removeItem(SETUP_KEY);
    setAbilityChoices(makeAbilityChoices());
    setSelectedChoiceIndex(0);
    setSelectedInventoryMartialId(undefined);
    setSelectedAbilityInfoKey(undefined);
    setGame(normalizeGameState(structuredClone(initialGameState)));
  }

  function renderDrawerContent() {
    if (activeTab === "character") {
      return (
        <div className="drawer-grid">
          <section className="hero-card">
            <img src={game.character.portrait} alt={`${game.character.name}立绘`} />
            <div>
              <h2>{game.character.name}</h2>
              <p>{game.character.title}</p>
              <div className="bar-label"><span>生命</span><b>{game.character.hp}/{game.character.maxHp}</b></div>
              <div className="bar"><span className="hp" style={{ width: `${(game.character.hp / Math.max(1, game.character.maxHp)) * 100}%` }} /></div>
              <div className="bar-label"><span>内力</span><b>{game.character.qi}/{game.character.maxQi}</b></div>
              <div className="bar"><span className="qi" style={{ width: `${game.character.maxQi ? (game.character.qi / game.character.maxQi) * 100 : 0}%` }} /></div>
              <p className="inner-state">内伤 {game.innerInjury || 0}</p>
            </div>
          </section>

          <section className="stat-grid">
            {game.character.abilities.map((ability) => (
              <button
                key={ability.key}
                type="button"
                onClick={() => setSelectedAbilityInfoKey((current) => current === ability.key ? undefined : ability.key)}
              >
                <span>{ability.label}</span>
                <b>{ability.value}</b>
                <em>{abilityMod(ability.value) >= 0 ? "+" : ""}{abilityMod(ability.value)}</em>
              </button>
            ))}
          </section>

          {selectedAbilityInfoKey && (
            <article className="origin-hook">
              <b>{abilityDefinitions[selectedAbilityInfoKey].title}</b>
              <span>{abilityDefinitions[selectedAbilityInfoKey].text}</span>
            </article>
          )}
        </div>
      );
    }

    if (activeTab === "inventory") {
      return (
        <div className="drawer-grid">
          <section className="list">
            {game.character.inventory.length > 0 ? (
              game.character.inventory.map((item) => (
                <article key={item.id}>
                  <div>
                    <b>{item.name}</b>
                    <p>{item.desc}</p>
                  </div>
                  <span>x{item.count}</span>
                  {item.usable && (
                    <button type="button" onClick={() => useItem(item)}>使用</button>
                  )}
                </article>
              ))
            ) : (
              <p className="empty-state">眼下行囊空空，只剩几分风尘味。</p>
            )}
          </section>

          <section className="martial-list">
            <h3>武学</h3>
            {game.character.martialArts.map((art) => (
              <article key={art.id}>
                <button
                  type="button"
                  className="martial-detail-toggle"
                  onClick={() => setSelectedInventoryMartialId((current) => current === art.id ? undefined : art.id)}
                >
                  <div>
                    <b>{art.name}</b>
                    <span>{art.category === "internal" ? "内功" : "外功"}</span>
                  </div>
                  <small>{art.damageDice}{art.damageBonus ? ` +${art.damageBonus}` : ""}</small>
                </button>

                {selectedInventoryMartial?.id === art.id && (
                  <div className="martial-detail-card">
                    <p>{art.effect}</p>
                    <small>类别：{art.category === "internal" ? "内功" : "外功"}</small>
                    <small>伤害：{art.damageDice}{art.damageBonus ? ` +${art.damageBonus}` : ""}</small>
                    <small>耗气：{art.category === "internal" ? art.baseQiCost : 0}</small>
                    <small>来源：{art.source}</small>
                  </div>
                )}
              </article>
            ))}
          </section>
        </div>
      );
    }

    if (activeTab === "party") {
      return (
        <div className="npc-grid">
          {companions.length > 0 ? companions.map((npc) => <NpcCard key={npc.id} npc={npc} />) : (
            <p className="empty-state">眼下无人同行。同伴会随故事自然加入，也可能因为局势离开。</p>
          )}
        </div>
      );
    }

    if (activeTab === "map" && selectedLocation) {
      const activeQuests = game.quests.filter((quest) => quest.status === "active");
      const resolvedQuests = game.quests.filter((quest) => quest.status === "resolved");
      const relatedNpcs = visibleNpcs.filter((npc) => npc.location === selectedLocation.name || (selectedLocation.current && npc.companion));
      const relatedQuestTitles = Array.from(new Set([
        ...(game.objective.location === selectedLocation.name && activeQuests.length > 0 ? [game.objective.title] : []),
        ...activeQuests
          .filter((quest) => quest.title.includes(selectedLocation.name) || quest.text.includes(selectedLocation.name))
          .map((quest) => quest.title)
      ]));

      return (
        <section className="map-panel">
          <header className="map-task-header">
            <span>地图与任务</span>
            <b>{game.objective.title}</b>
            <p>{game.objective.text}</p>
            <small>
              {game.objective.location || locationName}
              {game.objective.npc ? ` · ${game.objective.npc}` : ""}
            </small>
          </header>

          <div className="scene-switcher">
            {Object.entries(sceneLabels).map(([id, label]) => (
              <button
                key={id}
                type="button"
                className={game.sceneType === id ? "active" : ""}
                onClick={() => switchScene(id as SceneType)}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="map-art">
            {game.locations.map((location) => (
              <button
                key={location.id}
                type="button"
                className={`map-pin ${location.current ? "current" : ""} ${location.unlocked ? "" : "locked"}`}
                style={{ left: `${location.x}%`, top: `${location.y}%` }}
                onClick={() => setSelectedLocationId(location.id)}
              >
                <MapIcon size={14} />
                <span>{location.name}</span>
              </button>
            ))}
          </div>

          <article className={`map-location-card ${selectedLocation.unlocked ? "" : "locked"}`}>
            <span>{selectedLocation.current ? "当前位置" : selectedLocation.unlocked ? "已解锁地点" : "线索不足"}</span>
            <b>{selectedLocation.name}</b>
            <p>{selectedLocation.desc}</p>
            <small>
              {relatedNpcs.length > 0
                ? `在场/相关人物：${relatedNpcs.map((npc) => npc.name).join("、")}`
                : "暂无直接关联人物"}
            </small>
            <small>
              {relatedQuestTitles.length > 0
                ? `相关任务：${relatedQuestTitles.join("、")}`
                : "暂无直接关联任务"}
            </small>
            {selectedLocation.unlocked && !selectedLocation.current && (
              <button type="button" onClick={() => travelToLocation(selectedLocation.name)}>前往</button>
            )}
          </article>

          <div className="quest-log">
            <h3>任务日志</h3>
            {activeQuests.length === 0 ? (
              <article className="current">
                <div>
                  <b>尚未接到正式任务</b>
                  <p>先迈出第一步，局势才会把真正的线索送到你手里。</p>
                </div>
                <span>引导中</span>
              </article>
            ) : (
              <>
                <article className="current">
                  <div>
                    <b>当前目标：{game.objective.title}</b>
                    <p>{game.objective.text}</p>
                  </div>
                  <span>{game.objective.location || locationName}</span>
                </article>
                {activeQuests.map((quest) => (
                  <article key={quest.id}>
                    <div>
                      <b>{quest.title}</b>
                      <p>{quest.text}</p>
                    </div>
                    <span>进行中</span>
                  </article>
                ))}
              </>
            )}

            {resolvedQuests.map((quest) => (
              <article key={quest.id} className="resolved">
                <div>
                  <b>{quest.title}</b>
                  <p>{quest.text}</p>
                </div>
                <span>完成</span>
              </article>
            ))}
          </div>
        </section>
      );
    }

    return (
      <section className="system-panel">
        <article className="system-section">
          <header>
            <b>接口设置</b>
            <span>Provider 只做分类参考，API URL 和 Model 由你手动填写。</span>
          </header>

          <label>
            Provider
            <select value={api.provider} onChange={(event) => setApi((prev) => ({ ...prev, provider: event.target.value as ApiProvider }))}>
              {PROVIDER_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </label>

          <label>
            API URL
            <input
              value={api.apiUrl}
              placeholder={PROVIDER_DEFAULTS[api.provider].apiUrl || "https://your-api.example/v1/chat/completions"}
              onChange={(event) => setApi((prev) => ({ ...prev, apiUrl: event.target.value }))}
            />
          </label>

          <label>
            Model
            <input
              value={api.model}
              placeholder={PROVIDER_DEFAULTS[api.provider].model || "输入模型名"}
              onChange={(event) => setApi((prev) => ({ ...prev, model: event.target.value }))}
            />
          </label>

          <label>
            API Key
            <input
              type="password"
              value={api.apiKey}
              onChange={(event) => setApi((prev) => ({ ...prev, apiKey: event.target.value }))}
            />
          </label>

          <button
            type="button"
            className="system-primary"
            onClick={() => void runApiTest()}
            disabled={apiTest.status === "testing"}
          >
            {apiTest.status === "testing" ? "测试中..." : "测试连通"}
          </button>

          {apiTest.status !== "idle" && <p>{apiTest.message}</p>}
        </article>

        <article className="system-section">
          <header>
            <b>存档管理</b>
            <span>导入、导出或重新开局都放在这里。</span>
          </header>

          <section className="save-panel">
            <button type="button" onClick={exportSave}>
              <Download size={18} />
              导出存档
            </button>
            <button type="button" onClick={() => fileInputRef.current?.click()}>
              <Upload size={18} />
              导入存档
            </button>
            <button type="button" onClick={resetGame}>
              <Sparkles size={18} />
              重新开局
            </button>
            <input ref={fileInputRef} type="file" accept="application/json" onChange={importSave} hidden />
            <p>当前人物与世界状态会自动保存在本地浏览器里。</p>
          </section>
        </article>

        <article className="system-section">
          <header>
            <b>江湖配乐</b>
            <span>已接入你放进 `sucai` 里的曲子，进游戏后会尝试自动播放。</span>
          </header>

          <section className="save-panel">
            <button type="button" onClick={toggleMusic}>
              {musicEnabled ? <Volume2 size={18} /> : <VolumeX size={18} />}
              {musicEnabled ? "关闭 BGM" : "开启 BGM"}
            </button>
            <label className="volume-control">
              <span>音量</span>
              <b>{bgmVolume}%</b>
              <input
                type="range"
                min="0"
                max="100"
                step="1"
                value={bgmVolume}
                onChange={(event) => setBgmVolume(Number(event.target.value))}
              />
            </label>
            <p>当前曲目：Seven Peaks at Twilight</p>
            <p>重新开启时会做一个短淡入，不会一下子糊你一脸。</p>
          </section>
        </article>
      </section>
    );
  }

  if (!game.setupComplete) {
    return (
      <SetupScreen
        customName={customName}
        setCustomName={setCustomName}
        selectedOrigin={selectedOrigin}
        selectedOriginId={selectedOriginId}
        setSelectedOriginId={setSelectedOriginId}
        abilityChoices={abilityChoices}
        selectedChoiceIndex={selectedChoiceIndex}
        setSelectedChoiceIndex={setSelectedChoiceIndex}
        onStart={startOriginGame}
        onContinue={canContinue ? continueGame : undefined}
      />
    );
  }

  const appStyle = {
    "--scene-bg": `url("${sceneBackground}")`
  } as CSSProperties;

  const currentCheck = game.pendingCheck;

  return (
    <main className={`app ${game.combat.active ? "combat" : ""}`} style={appStyle}>
      <audio ref={audioRef} src={BGM_SRC} preload="auto" />
      <header className="app-header">
        <div>
          <p>{game.chapter}</p>
          <h1>{locationName}</h1>
          <span>第 {game.worldDay} 日 · {game.timeSlot} · {sceneLabels[game.sceneType]}</span>
        </div>
        <img src={game.character.portrait} alt={`${game.character.name}立绘`} />
      </header>

      <section className="chat">
        <article className="objective-card">
          <span>当前目标</span>
          <b>{game.objective.title}</b>
          <p>{game.objective.text}</p>
          <small>{game.objective.location || locationName}{game.objective.npc ? ` · ${game.objective.npc}` : ""}</small>
        </article>

        {game.combat.active && (
          <article className="enemy-card">
            <span>正在交手</span>
            <b>{game.combat.enemy}</b>
            <div className="enemy-bars">
              <label><span>生命</span><em>{game.combat.enemyHp}/{game.combat.enemyMaxHp}</em></label>
              <div className="bar"><span className="hp" style={{ width: `${((game.combat.enemyHp || 0) / Math.max(1, game.combat.enemyMaxHp || 1)) * 100}%` }} /></div>
              <label><span>内力</span><em>{game.combat.enemyQi}/{game.combat.enemyMaxQi}</em></label>
              <div className="bar"><span className="qi" style={{ width: `${((game.combat.enemyQi || 0) / Math.max(1, game.combat.enemyMaxQi || 1)) * 100}%` }} /></div>
            </div>
            {!!game.combat.enemyMartialArts?.length && (
              <p>{game.combat.enemyMartialArts.map((art) => `${art.name} ${art.damageDice}`).join(" / ")}</p>
            )}
            {!!game.combat.enemyStatus?.length && <small>状态：{game.combat.enemyStatus.join("、")}</small>}
          </article>
        )}

        {game.pendingCheck && (
          <section className="pending-check">
            <span>待判定</span>
            <b>{game.pendingCheck.label} · DC {game.pendingCheck.dc}</b>
            <p>{game.pendingCheck.reason}</p>
            {game.pendingCheck.enemyIntent && <small>敌人意图：{game.pendingCheck.enemyIntent}</small>}
            {game.pendingCheck.risk && <small>失败风险：{game.pendingCheck.risk}</small>}
            {game.pendingCheck.suggestedAction && <small>可尝试：{game.pendingCheck.suggestedAction}</small>}
            <button type="button" onClick={openPendingCheck}>进行判定</button>
          </section>
        )}

        {game.messages.map((message) => <MessageBubble key={message.id} message={message} />)}

        {busy && (
          <article className="message dm loading">
            <Loader2 className="spin" size={16} />
            <p>说书人正在接下一手...</p>
          </article>
        )}

        <div ref={endRef} />
      </section>

      {rolling && (
        <section className="roll-overlay">
          <DiceFace value={rolling.picked} />
          <b>{rolling.label}</b>
          <span>{rolling.modeText} · d20={rolling.picked} · 内力 +{rolling.qiBonus} · 总计 {rolling.total}</span>
        </section>
      )}

      {diceOpen && (
        <section className="dice-popover">
          {currentCheck && (
            <article className="dice-check">
              <span>当前判定</span>
              <b>{currentCheck.label} · DC {currentCheck.dc}</b>
              <p>{currentCheck.reason}</p>
              {currentCheck.risk && <small>失败风险：{currentCheck.risk}</small>}
            </article>
          )}

          <div className="segmented">
            <button className={rollMode === "disadvantage" ? "active" : ""} onClick={() => setRollMode("disadvantage")}>劣势</button>
            <button className={rollMode === "normal" ? "active" : ""} onClick={() => setRollMode("normal")}>常规</button>
            <button className={rollMode === "advantage" ? "active" : ""} onClick={() => setRollMode("advantage")}>优势</button>
          </div>

          <section className={`qi-invest ${lowQi ? "low" : ""}`}>
            <div>
              <span>额外投入内力</span>
              <b>{qiInvest} / {qiLimit}</b>
            </div>
            <input
              type="range"
              min="0"
              max={qiLimit}
              value={qiInvest}
              onChange={(event) => setQiInvest(Number(event.target.value))}
            />
            <p>每投入 2 点内力，判定 +1。内功只在命中后扣除招式耗气，外功不扣基础内力。</p>
          </section>

          <b className="dice-section-title">属性判定</b>
          {game.character.abilities.map((ability) => (
            <button
              key={ability.key}
              className={currentCheck?.abilityKey === ability.key ? "recommended" : ""}
              onClick={() => rollDice(
                ability.label,
                abilityMod(ability.value),
                currentCheck,
                { qiBonusSpend: qiInvest, sendToDm: Boolean(currentCheck) }
              )}
            >
              <span>{ability.label}</span>
              <b>{abilityMod(ability.value) >= 0 ? "+" : ""}{abilityMod(ability.value)}</b>
            </button>
          ))}

          <b className="dice-section-title">武学攻击</b>
          {game.character.martialArts.map((art) => {
            const ability = game.character.abilities.find((entry) => entry.key === art.linkedAbility);
            const mod = ability ? abilityMod(ability.value) : 0;
            const costOnHit = art.category === "internal" ? art.baseQiCost : 0;
            const canUse = qiInvest <= game.character.qi && (art.category === "external" || game.character.qi >= qiInvest + costOnHit);

            return (
              <button
                key={art.id}
                className={`martial-roll ${currentCheck?.martialArtId === art.id || currentCheck?.abilityKey === art.linkedAbility ? "recommended" : ""}`}
                disabled={!canUse}
                onClick={() => rollDice(
                  `${art.name}（${ability?.label || "属性"}）`,
                  mod,
                  currentCheck,
                  { martialArt: art, qiBonusSpend: qiInvest, sendToDm: Boolean(currentCheck) }
                )}
              >
                <span>
                  {art.name}
                  <small>{art.category === "internal" ? "内功" : "外功"} · 伤害 {art.damageDice}{art.damageBonus ? ` +${art.damageBonus}` : ""}</small>
                </span>
                <b>{mod >= 0 ? "+" : ""}{mod} · 耗{costOnHit}</b>
              </button>
            );
          })}
        </section>
      )}

      <form className="input-bar" onSubmit={(event: FormEvent) => {
        event.preventDefault();
        void submitAction();
      }}>
        <button type="button" onClick={() => openDrawer()} aria-label="打开面板">
          <User size={21} />
        </button>
        <input
          value={input}
          onChange={(event) => setInput(event.target.value)}
          placeholder={game.combat.active ? "描述你用什么招式、怎样出手..." : "描述你的行动..."}
          disabled={busy}
        />
        <button type="button" onClick={toggleDice} aria-label="打开骰子">
          <Dices size={21} />
        </button>
        <button type="submit" disabled={busy} aria-label="发送">
          <Send size={20} />
        </button>
      </form>

      {panelOpen && <div className="scrim" onClick={() => { setDrawerOpen(false); setDiceOpen(false); }} />}

      <aside className={`drawer ${drawerOpen ? "open" : ""}`}>
        <div className="drawer-handle" />
        <div className="drawer-tabs">
          {tabItems.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                className={activeTab === item.id ? "active" : ""}
                onClick={() => setActiveTab(item.id)}
              >
                <Icon size={18} />
                <span>{item.label}</span>
              </button>
            );
          })}
          <button className="close" onClick={() => setDrawerOpen(false)}>
            <X size={18} />
          </button>
        </div>
        <div className="drawer-content">{renderDrawerContent()}</div>
      </aside>
    </main>
  );
}
