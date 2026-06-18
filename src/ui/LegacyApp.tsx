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
import { CSSProperties, FormEvent, useMemo } from "react";
import {
  enemyPresets,
  initialGameState,
  martialArtCatalog,
  originTemplates
} from "../data";
import {
  getNextEnemyPendingCheck,
  inferCombatStakes as inferCombatStakesFromModule,
  prepareCombatDamageRoll,
  resolveCombatDamage,
  resolveCombatHit,
  startCombat
} from "../game/combat";
import {
  applyPatchToState as applyPatchToStateEngine,
  advanceWorldLocally as advanceWorldLocallyEngine,
  mergeGamePatches as mergeGamePatchesEngine,
  normalizeGameState as normalizeGameStateEngine
} from "../game/engine";
import {
  CREATION_FREE_POINTS,
  calculateAcFromDex,
  calculateHpFromCon,
  calculateMaxQi
} from "../game/rules";
import {
  buildNamelessTutorialBackground,
  buildNamelessTutorialObjective,
  isNamelessTutorialCombatStage,
  isNamelessTutorialStage,
  NAMELESS_WANDERER_CHAPTER_ID,
  QUEST_WANDERER_1,
  QUEST_WANDERER_2,
  QUEST_WANDERER_3,
  QUEST_WANDERER_4,
  QUEST_WANDERER_5,
  normalizeChapterStateForNameless,
  resolveNamelessStoryTrigger
} from "../game/story/namelessWanderer";
import type {
  Ability,
  ApiConfig,
  AiProposalPayload,
  ApiProvider,
  Character,
  ChapterState,
  CombatPhase,
  DrawerTab,
  GamePatch,
  GameState,
  Item,
  LocationUnlockReason,
  MartialArt,
  Message,
  Npc,
  NpcStoryState,
  OriginTemplate,
  PendingCheck,
  PendingDamage,
  Quest,
  QuestStateNode,
  RelationshipRouteState,
  RelationshipTier,
  Rumor,
  RollMode,
  SceneType
} from "../types";
import { applyAllocation, canAdjustAllocation, remainingAllocationPoints } from "./sessionShared";
import type { GameSession } from "./useGameSession";

export const SAVE_KEY = "jianghu-dm-save-v3";
export const API_KEY = "jianghu-dm-api-v3";
export const SETUP_KEY = "jianghu-dm-has-played-v2";
export const BGM_KEY = "jianghu-dm-bgm-v1";
export const BGM_VOLUME_KEY = "jianghu-dm-bgm-volume-v1";
export const WORLD_STEP = 4;
export const QI_INVEST_LIMIT = 6;
const BGM_SRC = "../assets/bgm/Seven_Peaks_at_Twilight.mp3";
const DEEPSEEK_BASE_URL = "https://api.deepseek.com";
const DEEPSEEK_CHAT_COMPLETIONS_URL = `${DEEPSEEK_BASE_URL}/chat/completions`;
const DS_FLASH_MODEL = "deepseek-v4-flash";
const DS_PRO_MODEL = "deepseek-v4-pro";

const ROUTE_SHUANGER = "shuang-er";

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
    apiUrl: DEEPSEEK_CHAT_COMPLETIONS_URL,
    model: DS_FLASH_MODEL
  },
  custom: {
    apiUrl: "",
    model: ""
  }
};

const playableOrigins: OriginTemplate[] = originTemplates;

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

const abilityEffectLabels: Record<keyof typeof abilityLabels, string> = {
  str: "外功命中 / 伤害",
  dex: "先攻 / 闪避 / 护甲",
  con: "生命 / 抗打",
  int: "拆招 / 学武 / 技巧",
  cha: "奇遇 / 交涉 / 福缘",
  wis: "内力 / 定力 / 内功"
};

const sceneAssets: Record<SceneType, string> = {
  temple: "../assets/scene-temple.png",
  market: "../assets/scene-market.png",
  tavern: "../assets/scene-tavern.png",
  brothel: "../assets/scene-brothel.png",
  inn: "../assets/scene-inn.png",
  palace: "../assets/scene-palace.png"
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
martialArtCatalog.forEach((art) => {
  martialLookup.set(art.id, art);
  martialLookup.set(art.name, art);
});

const enemyPresetLookup = new Map<string, (typeof enemyPresets)[number]>();
enemyPresets.forEach((preset) => {
  enemyPresetLookup.set(preset.id, preset);
  enemyPresetLookup.set(preset.name, preset);
});

export type RollPackage = [number, number, number, number, number, number];
export type ApiTestState = {
  status: "idle" | "testing" | "success" | "error";
  message?: string;
};
export type RollingState = {
  label: string;
  total: number;
  detail: string;
};
type AiCallResult = {
  text: string;
  patch: GamePatch;
  proposals: AiProposalPayload;
};

function uid(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
}

export function clamp(value: number, min: number, max: number) {
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

export function makeAbilityChoices(): RollPackage[] {
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

function doubleDamageDice(damageDice: string) {
  const match = damageDice.trim().toLowerCase().match(/^(\d+)d(\d+)$/);
  if (!match) return damageDice;

  return `${Number(match[1]) * 2}d${match[2]}`;
}

export function readJson<T>(key: string, fallback: T): T {
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

export function defaultApiConfig(provider: ApiProvider): ApiConfig {
  const defaults = PROVIDER_DEFAULTS[provider];
  return {
    provider,
    apiUrl: defaults.apiUrl,
    apiKey: "",
    model: defaults.model
  };
}

export function normalizeApiConfig(raw: Partial<ApiConfig> | undefined): ApiConfig {
  const provider = raw?.provider || inferProvider(raw?.apiUrl || "");
  const defaults = PROVIDER_DEFAULTS[provider];
  return {
    provider,
    apiUrl: raw?.apiUrl ?? defaults.apiUrl,
    apiKey: raw?.apiKey ?? "",
    model: raw?.model ?? defaults.model
  };
}

export function resolveApiEndpoint(config: ApiConfig) {
  const trimmed = config.apiUrl.trim().replace(/\/+$/, "");
  const deepseekBase = DEEPSEEK_BASE_URL.replace(/\/+$/, "");
  const autoCompleted = trimmed === deepseekBase;

  return {
    url: autoCompleted ? DEEPSEEK_CHAT_COMPLETIONS_URL : trimmed,
    autoCompleted
  };
}

export async function readApiErrorSummary(response: Response) {
  try {
    const data = await response.json();
    return data?.error?.message || data?.message || `HTTP ${response.status}`;
  } catch {
    return `HTTP ${response.status}`;
  }
}

export function currentLocation(state: GameState) {
  return state.locations.find((location) => location.current)?.name || "未知地点";
}

export function advanceTime(state: GameState): Pick<GameState, "worldDay" | "timeSlot"> {
  const slots = ["清晨", "上午", "午后", "黄昏", "夜半"];
  const currentIndex = Math.max(0, slots.indexOf(state.timeSlot));
  const nextIndex = (currentIndex + 1) % slots.length;

  return {
    worldDay: nextIndex === 0 ? state.worldDay + 1 : state.worldDay,
    timeSlot: slots[nextIndex]
  };
}

export function inferSceneType(text: string): SceneType | undefined {
  const source = text.toLowerCase();
  return sceneKeywords.find((entry) =>
    entry.keywords.some((keyword) => source.includes(keyword.toLowerCase()))
  )?.sceneType;
}

export function stripJsonBlock(text: string) {
  const match = text.match(/```json\s*([\s\S]*?)\s*```/i);
  return {
    visibleText: match ? text.replace(match[0], "").trim() : text.trim(),
    patchText: match?.[1]
  };
}

function mergeUniqueStrings(...groups: Array<string[] | undefined>) {
  return [...new Set(groups.flat().filter(Boolean) as string[])];
}

function normalizeStoryFlags(raw: string[] | undefined, fallback: string[] = []) {
  return mergeUniqueStrings(fallback, raw);
}

function normalizeChapterState(raw: Partial<ChapterState> | undefined, fallback: ChapterState): ChapterState {
  return normalizeChapterStateForNameless(raw, fallback);
}

function normalizeQuestStateMap(quests: Quest[], raw: GameState["questStateMap"] | undefined) {
  const next: Record<string, QuestStateNode> = {};
  for (const quest of quests) {
    const saved = raw?.[quest.id];
    next[quest.id] = {
      id: quest.id,
      status: saved?.status || quest.status,
      stage: saved?.stage
    };
  }
  return next;
}

function normalizeRumors(raw: Rumor[] | undefined) {
  return (raw || []).map((rumor) => ({
    ...rumor,
    id: rumor.id || uid("rumor"),
    kind: rumor.kind || "rumor"
  }));
}

function mergeGamePatches(...patches: Array<GamePatch | undefined>): GamePatch {
  return mergeGamePatchesEngine(...patches);
}

function normalizeRelationshipRoutes(npcs: Npc[], raw: GameState["relationshipRoutes"] | undefined, fallback: GameState["relationshipRoutes"]) {
  const next: Record<string, RelationshipRouteState> = structuredClone(fallback);
  Object.entries(raw || {}).forEach(([key, value]) => {
    if (!value) return;
    next[key] = {
      ...next[key],
      ...value,
      npcId: value.npcId || next[key]?.npcId || key,
      supportUnlocked: value.supportUnlocked || next[key]?.supportUnlocked || []
    };
  });

  for (const npc of npcs) {
    if (!next[npc.id]) {
      next[npc.id] = {
        npcId: npc.id,
        kind: "bond",
        active: false,
        stage: "unawakened",
        supportUnlocked: []
      };
    }
  }

  return next;
}

function relationshipTier(relationship: number): RelationshipTier {
  if (relationship >= 80) return "devoted";
  if (relationship >= 65) return "confidant";
  if (relationship >= 50) return "trusted";
  if (relationship >= 35) return "familiar";
  return "stranger";
}

function relationshipTierLabel(tier: RelationshipTier) {
  return {
    stranger: "生疏",
    familiar: "顺眼",
    trusted: "信任",
    confidant: "知己",
    devoted: "倾心"
  }[tier];
}

function relationshipRouteStageLabel(stage: RelationshipRouteState["stage"], kind: RelationshipRouteState["kind"]) {
  if (kind === "retainer") {
    return {
      unawakened: "未起线",
      met: "初识",
      trust: "信任建立",
      partiality: "偏心显现",
      follow: "专属追随",
      enduring: "稳定维持"
    }[stage];
  }

  return {
    unawakened: "未起线",
    met: "初识",
    trust: "熟识",
    partiality: "特别在意",
    follow: "深交同行",
    enduring: "长期维系"
  }[stage];
}

export function primaryRouteForNpc(state: GameState, npcId: string) {
  const routes = Object.values(state.relationshipRoutes).filter((route) => route.npcId === npcId && route.active);
  const weight = ["unawakened", "met", "trust", "partiality", "follow", "enduring"];
  return routes.sort((a, b) => weight.indexOf(b.stage) - weight.indexOf(a.stage))[0];
}

function supportLabel(label: string) {
  return {
    care: "照料",
    stash: "收物",
    message: "传话",
    escort: "追随"
  }[label] || label;
}

function normalizeLocationUnlocks(locations: GameState["locations"], raw: GameState["locationUnlocks"] | undefined, fallback: GameState["locationUnlocks"]) {
  const unlocks: Record<string, LocationUnlockReason> = { ...fallback, ...(raw || {}) };
  for (const location of locations) {
    if (location.unlocked && !unlocks[location.id]) {
      unlocks[location.id] = fallback[location.id] || "quest";
    }
  }
  return unlocks;
}

function deriveNpcStoryState(npc: Npc): NpcStoryState {
  if (npc.companion) return "companion";
  if (npc.status.includes("离") || npc.status.includes("失散")) return "departed";
  if (npc.discovered || !npc.hidden) return npc.recruitable ? "available" : "revealed";
  return "hidden";
}

function normalizeNpcStoryState(npcs: Npc[], raw: GameState["npcStoryState"] | undefined, fallback: GameState["npcStoryState"]) {
  const next: Record<string, NpcStoryState> = { ...fallback, ...(raw || {}) };
  for (const npc of npcs) {
    next[npc.id] = next[npc.id] || deriveNpcStoryState(npc);
  }
  return next;
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
    damageDice: raw.damageDice || template?.damageDice || "1d4",
    damageBonus: raw.damageBonus ?? template?.damageBonus,
    baseQiCost: category === "internal" ? raw.baseQiCost ?? template?.baseQiCost ?? 1 : 0,
    source: raw.source || template?.source || "江湖所得"
  };
}

function normalizeInventory(raw: Item[] | undefined) {
  return (raw || [])
    .filter((item) => {
      const legacyType = (item as { type?: string })?.type;
      return item && legacyType !== "weapon" && legacyType !== "armor" && legacyType !== "accessory";
    })
    .map((item) => {
      const legacyType = (item as { type?: string }).type;
      const inferredType: Item["type"] = legacyType === "quest"
        ? "quest"
        : legacyType === "consumable" || item.usable || typeof item.hpRestore === "number" || typeof item.qiRestore === "number"
          ? "consumable"
          : "quest";
      return {
        id: item.id,
        name: item.name,
        desc: item.desc,
        count: item.count,
        type: inferredType,
        hpRestore: item.hpRestore,
        qiRestore: item.qiRestore,
        usable: item.usable
      };
    });
}

function relabelAbilities(character: Character): Character {
  const {
    inventory,
    equipment: _legacyEquipment,
    ...rest
  } = character as Character & { inventory?: Item[]; equipment?: unknown };
  return {
    ...rest,
    abilities: (character.abilities || []).map((ability) => ({
      ...ability,
      label: abilityLabels[ability.key] || ability.label
    })),
    martialArts: (character.martialArts || []).map((art) => normalizeMartialArt({ ...art, name: art.name })),
    inventory: normalizeInventory(inventory)
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

function makePendingDamage(raw: Partial<PendingDamage> | undefined): PendingDamage | undefined {
  if (!raw?.martialArtId || !raw.label || !raw.damageDice || !raw.hitText) return undefined;
  return {
    id: raw.id || uid("damage"),
    martialArtId: raw.martialArtId,
    label: raw.label,
    damageDice: raw.damageDice,
    damageBonus: raw.damageBonus || 0,
    qiCost: raw.qiCost || 0,
    qiBonusSpend: raw.qiBonusSpend || 0,
    hitText: raw.hitText
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

function inferCombatStakes(enemyName: string) {
  return `眼下必须先稳住 ${enemyName}，别让对方继续压着局势走。`;
}

function makeEnemyCombat(name = "黑衣刺客"): GameState["combat"] {
  const preset = findEnemyPreset(name);
  return {
    active: true,
    combatId: uid("combat"),
    round: 1,
    phase: "awaiting_hit_check",
    stakes: inferCombatStakes(preset.name),
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
  if (!combat?.active) return { active: false, round: 0, phase: "ended", stakes: "" };

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
    enemyStatus: combat.enemyStatus || [],
    combatId: combat.combatId || normalized.combatId,
    round: combat.round ?? normalized.round,
    phase: combat.phase || normalized.phase,
    stakes: combat.stakes || normalized.stakes
  };
}

export const normalizeGameState = normalizeGameStateEngine;

function makeCharacterFromOrigin(name: string, origin: OriginTemplate, packageValues: RollPackage): Character {
  const hp = calculateHpFromCon(packageValues[2]);
  const maxQi = calculateMaxQi(origin.qiStart, packageValues[5]);

  return relabelAbilities({
    id: `hero-${origin.id}-${Date.now()}`,
    name: name.trim() || "无名少侠",
    title: `${origin.name}，初入江湖`,
    portrait: "../assets/portraits/nameless-wanderer.png",
    hp,
    maxHp: hp,
    qi: maxQi,
    maxQi,
    ac: calculateAcFromDex(packageValues[1]),
    abilities: [
      { key: "str", label: abilityLabels.str, value: packageValues[0] },
      { key: "dex", label: abilityLabels.dex, value: packageValues[1] },
      { key: "con", label: abilityLabels.con, value: packageValues[2] },
      { key: "int", label: abilityLabels.int, value: packageValues[3] },
      { key: "cha", label: abilityLabels.cha, value: packageValues[4] },
      { key: "wis", label: abilityLabels.wis, value: packageValues[5] }
    ],
    martialArts: origin.martialArts.map((art) => normalizeMartialArt({ ...art, name: art.name, source: origin.name })),
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

export function isVisibleNpc(npc: Npc) {
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

function firstQuestPatchForOrigin(state: GameState): Pick<GamePatch, "questUpdates" | "objectiveUpdate" | "systemNote" | "storyFlagsAdd" | "chapterStateUpdate" | "questStateUpdates"> | undefined {
  if (state.quests.some((quest) => quest.status === "active")) return undefined;

  const origin = playableOrigins.find((item) => item.id === state.originId) || playableOrigins[0];
  if (!origin) return undefined;

  return {
    questUpdates: [
      {
        id: QUEST_WANDERER_1,
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
    systemNote: `首个正式任务已派发：${origin.firstQuest.title}`,
    storyFlagsAdd: ["trigger:first_action", `quest:${origin.id}:issued`],
    chapterStateUpdate: {
      id: "nameless-wanderer-ch1",
      stage: "inn-settled"
    },
    questStateUpdates: [
      {
        id: QUEST_WANDERER_1,
        status: "active",
        stage: "inn-settled"
      }
    ]
  };
}

export function buildSystemPrompt(state: GameState, globalUpdate: boolean) {
  return `你是“江湖 DM”的叙事主持人，请继续推进这个武侠冒险。

[硬规则]
1. 判定总计 >= DC 才成功；总计 < DC 必须失败。没有险胜、部分成功档。
2. 优势 = 掷 2 个 d20 取高；劣势 = 掷 2 个 d20 取低。
3. 战斗是连续对招，不是一掷定胜负。每轮要推进局势。
4. 玩家武学只决定伤害与耗气；命中判定看属性。
4.5. 玩家武学攻击分两段：先做命中判定；若命中，再等待玩家实际掷出伤害骰，例如 6d6 要真的掷 6 个 d6。
5. 内力只作为资源消耗，不会自动制造“气息紊乱”。
6. 同伴是独立 NPC，不是固定加值插件，可加入也可退出。
7. 开局第一轮先铺垫，首轮行动后再派发第一条正式任务。

[当前状态]
章节：${state.chapter}
章节状态：${state.chapterState.id} / ${state.chapterState.stage}
时间：第 ${state.worldDay} 日 ${state.timeSlot}
地点：${currentLocation(state)}
场景：${sceneLabels[state.sceneType]}
当前目标：${state.objective.title} / ${state.objective.text}
角色：${state.character.name}
生命：${state.character.hp}/${state.character.maxHp}
内力：${state.character.qi}/${state.character.maxQi}
内伤：${state.innerInjury || 0}
战斗：${state.combat.active ? `与 ${state.combat.enemy} 交手中，敌方 HP ${state.combat.enemyHp}/${state.combat.enemyMaxHp}，Qi ${state.combat.enemyQi}/${state.combat.enemyMaxQi}` : "当前未战斗"}
战斗阶段：${state.combat.phase || "ended"}
战斗回合：${state.combat.round || 0}
战斗目标：${state.combat.stakes || "无"}
待伤害：${state.pendingDamage ? `${state.pendingDamage.label} ${state.pendingDamage.damageDice}` : "无"}

[本地权威状态]
故事旗标：${JSON.stringify(state.storyFlags)}
任务状态图：${JSON.stringify(state.questStateMap, null, 2)}
地图解锁：${JSON.stringify(state.locationUnlocks, null, 2)}
NPC 剧情态：${JSON.stringify(state.npcStoryState, null, 2)}
已记录传闻：${JSON.stringify(state.rumors.slice(-6), null, 2)}

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
    grade: art.grade,
    source: art.source,
    category: art.category,
    linkedAbility: art.linkedAbility,
    damageDice: art.damageDice,
    damageBonus: art.damageBonus || 0,
    qiCost: art.baseQiCost
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
AI 不直接改硬状态。不要直接返回任务变更、地图解锁、NPC 出场/离队、角色资源变化、章节跳转、战斗胜负。
JSON 只允许使用这些字段：
- systemNote
- sceneType
- proposedCheck
- proposedHooks
- proposedRumors
- proposedNpcReactions
如果当前需要玩家掷骰，请用 proposedCheck 提议，而不是直接修改世界状态。
如果处于战斗中，你只负责叙述气氛、敌意和压迫感，不要决定命中、伤害、回合推进或敌人死亡。

JSON 示例：
\`\`\`json
{
  "systemNote": "山道上的杀气一下收紧了。",
  "sceneType": "inn",
  "proposedCheck": {
    "label": "接住对方杀招",
    "abilityKey": "dex",
    "dc": 14,
    "reason": "对方抢先进身，逼你马上应对。",
    "risk": "若失败，你会吃下一记重手。",
    "enemyIntent": "先压住你的脚步，再接连追击。",
    "suggestedAction": "可用身法闪避，也可用心境或根骨硬接。"
  },
  "proposedRumors": [
    {
      "text": "客栈里有人在低声谈无量山那边追得很紧。",
      "kind": "rumor",
      "location": "大理城",
      "npc": "双儿"
    }
  ],
  "proposedNpcReactions": [
    {
      "name": "阿朱",
      "attitude": "留意",
      "note": "她像是故意在等你继续把话追深。"
    }
  ]
}
\`\`\``;
}

export function withSceneFallback(patch: GamePatch, ...texts: string[]): GamePatch {
  if (patch.sceneType) return patch;
  const sceneType = inferSceneType(texts.filter(Boolean).join("\n"));
  return sceneType ? { ...patch, sceneType } : patch;
}

export function filterAiCombatPatch(patch: GamePatch): GamePatch {
  return {
    systemNote: patch.systemNote
  };
}

function sanitizeAiProposals(raw: Partial<AiProposalPayload> | undefined): AiProposalPayload {
  const proposedCheck = raw?.proposedCheck ? makePendingCheck(raw.proposedCheck) : undefined;
  const normalizeHooks = (items: AiProposalPayload["proposedHooks"] | AiProposalPayload["proposedRumors"]) =>
    Array.isArray(items)
      ? items
        .filter((item): item is NonNullable<typeof item> & { text: string } => Boolean(item?.text))
        .map((item) => ({
          id: item.id,
          text: item.text,
          kind: item.kind || "rumor",
          location: item.location,
          npc: item.npc
        }))
      : [];

  const proposedNpcReactions = Array.isArray(raw?.proposedNpcReactions)
    ? raw.proposedNpcReactions
      .filter((item): item is NonNullable<typeof item> & { name: string } => Boolean(item?.name))
      .map((item) => ({
        name: item.name,
        attitude: item.attitude,
        status: item.status,
        note: item.note
      }))
    : [];

  return {
    systemNote: raw?.systemNote,
    sceneType: raw?.sceneType,
    proposedCheck: proposedCheck
      ? { ...proposedCheck, reason: proposedCheck.reason }
      : undefined,
    proposedHooks: normalizeHooks(raw?.proposedHooks),
    proposedRumors: normalizeHooks(raw?.proposedRumors),
    proposedNpcReactions
  };
}

export function splitAiPayload(raw: unknown) {
  if (!raw || typeof raw !== "object") {
    return {
      patch: {} as GamePatch,
      proposals: {} as AiProposalPayload
    };
  }

  const payload = raw as Record<string, unknown>;
  const proposals = sanitizeAiProposals({
    systemNote: typeof payload.systemNote === "string" ? payload.systemNote : undefined,
    sceneType: typeof payload.sceneType === "string" ? payload.sceneType as SceneType : undefined,
    proposedCheck: typeof payload.proposedCheck === "object" && payload.proposedCheck ? payload.proposedCheck as AiProposalPayload["proposedCheck"] : undefined,
    proposedHooks: Array.isArray(payload.proposedHooks) ? payload.proposedHooks as AiProposalPayload["proposedHooks"] : undefined,
    proposedRumors: Array.isArray(payload.proposedRumors) ? payload.proposedRumors as AiProposalPayload["proposedRumors"] : undefined,
    proposedNpcReactions: Array.isArray(payload.proposedNpcReactions) ? payload.proposedNpcReactions as AiProposalPayload["proposedNpcReactions"] : undefined
  });

  if ("pendingCheck" in payload && !proposals.proposedCheck) {
    proposals.proposedCheck = makePendingCheck(payload.pendingCheck as GamePatch["pendingCheck"]);
  }

  const patch: GamePatch = {
    systemNote: typeof payload.systemNote === "string" ? payload.systemNote : undefined,
    sceneType: typeof payload.sceneType === "string" ? payload.sceneType as SceneType : undefined
  };

  return { patch, proposals };
}

export function aiProposalsToLocalPatch(state: GameState, proposals: AiProposalPayload): GamePatch {
  const patch: GamePatch = {};
  const acceptedNotes: string[] = [];

  if (proposals.sceneType) patch.sceneType = proposals.sceneType;
  if (proposals.systemNote) acceptedNotes.push(proposals.systemNote);

  if (!state.pendingCheck && !state.pendingDamage && !state.combat.active && proposals.proposedCheck) {
    patch.pendingCheck = proposals.proposedCheck;
  }

  const rumorSeeds = mergeUniqueStrings(
    proposals.proposedHooks?.map((item) => item.text),
    proposals.proposedRumors?.map((item) => item.text)
  );
  if (rumorSeeds.length > 0) {
    patch.rumorAdd = [
      ...(proposals.proposedHooks || []),
      ...(proposals.proposedRumors || [])
    ].map((item) => ({
      text: item.text,
      kind: item.kind || "rumor",
      location: item.location || currentLocation(state),
      npc: item.npc,
      source: "ai-proposal",
      discoveredDay: state.worldDay
    }));
    acceptedNotes.push(`江湖上传来新的风声：${rumorSeeds.slice(0, 2).join("；")}`);
  }

  const visibleNames = new Set(state.npcs.filter(isVisibleNpc).map((npc) => npc.name));
  const npcUpdates = (proposals.proposedNpcReactions || [])
    .filter((item) => visibleNames.has(item.name))
    .map((item) => ({
      name: item.name,
      attitude: item.attitude,
      status: item.status
    }))
    .filter((item) => item.attitude || item.status);
  if (npcUpdates.length > 0) patch.npcUpdates = npcUpdates;

  const npcNotes = (proposals.proposedNpcReactions || [])
    .filter((item) => visibleNames.has(item.name) && item.note)
    .map((item) => `${item.name}：${item.note}`);
  if (npcNotes.length > 0) acceptedNotes.push(npcNotes.join("；"));

  if (acceptedNotes.length > 0) {
    patch.systemNote = acceptedNotes.join(" ");
  }

  return patch;
}

function updateLocationUnlockReason(next: GameState, update: { locationId?: string; name?: string; reason: LocationUnlockReason }) {
  const target = next.locations.find((location) => location.id === update.locationId || location.name === update.name);
  if (!target) return;
  target.unlocked = true;
  next.locationUnlocks[target.id] = update.reason;
}

function updateNpcStory(next: GameState, update: { npcId?: string; name?: string; state: NpcStoryState }) {
  const target = next.npcs.find((npc) => npc.id === update.npcId || npc.name === update.name);
  if (!target) return;

  next.npcStoryState[target.id] = update.state;
  if (update.state === "hidden") {
    target.hidden = true;
    target.discovered = false;
    target.companion = false;
  } else if (update.state === "rumored") {
    target.hidden = true;
    target.discovered = false;
    target.companion = false;
  } else if (update.state === "revealed") {
    target.hidden = false;
    target.discovered = true;
    target.companion = false;
  } else if (update.state === "available") {
    target.hidden = false;
    target.discovered = true;
    target.recruitable = true;
    target.companion = false;
  } else if (update.state === "companion") {
    target.hidden = false;
    target.discovered = true;
    target.recruitable = true;
    target.companion = true;
  } else if (update.state === "departed") {
    target.hidden = false;
    target.discovered = true;
    target.companion = false;
  }
}

function updateRelationshipRoute(next: GameState, update: Partial<RelationshipRouteState> & { npcId?: string; name?: string }) {
  const npc = next.npcs.find((entry) => entry.id === update.npcId || entry.name === update.name);
  const routeKey = update.npcId && next.relationshipRoutes[update.npcId]
    ? update.npcId
    : update.name
      ? Object.keys(next.relationshipRoutes).find((key) => {
        const route = next.relationshipRoutes[key];
        return route?.npcId === npc?.id;
      }) || npc?.id
      : update.npcId;

  if (!routeKey) return;
  const existing = next.relationshipRoutes[routeKey] || {
    npcId: npc?.id || update.npcId || routeKey,
    kind: "bond" as const,
    active: false,
    stage: "unawakened" as const,
    supportUnlocked: []
  };

  next.relationshipRoutes[routeKey] = {
    ...existing,
    ...update,
    npcId: existing.npcId,
    supportUnlocked: update.supportUnlocked
      ? [...new Set([...(existing.supportUnlocked || []), ...update.supportUnlocked])]
      : existing.supportUnlocked || []
  };
}

function applyPatchToState(prev: GameState, patch: GamePatch): GameState {
  return applyPatchToStateEngine(prev, patch);
  /*
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
    const currentStop = next.locations.find((location) => location.name === patch.location);
    if (currentStop) {
      next.locationUnlocks[currentStop.id] = next.locationUnlocks[currentStop.id] || "quest";
      next.storyFlags = mergeUniqueStrings(next.storyFlags, [`arrive:${currentStop.id}`]);
    }
  }

  if (patch.timeSlot) next.timeSlot = patch.timeSlot;
  if (patch.chapter) next.chapter = patch.chapter;
  if (patch.sceneType) next.sceneType = patch.sceneType;
  if (patch.chapterStateUpdate) {
    next.chapterState = normalizeChapterState({ ...next.chapterState, ...patch.chapterStateUpdate }, next.chapterState);
  }
  if (patch.storyFlagsAdd || patch.storyFlagsRemove) {
    const removed = new Set(patch.storyFlagsRemove || []);
    next.storyFlags = mergeUniqueStrings(next.storyFlags, patch.storyFlagsAdd).filter((flag) => !removed.has(flag));
  }

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
    if (typeof patch.combatUpdate.roundDelta === "number") {
      combat.round = Math.max(1, (combat.round || 1) + patch.combatUpdate.roundDelta);
    }
    if (patch.combatUpdate.phase) {
      combat.phase = patch.combatUpdate.phase;
    }
    if (patch.combatUpdate.stakes) {
      combat.stakes = patch.combatUpdate.stakes;
    }
    next.combat = combat;

    if (patch.combatUpdate.enemyMartialArtUsed) {
      next.systemLog.push(`敌人使出武学：${patch.combatUpdate.enemyMartialArtUsed}`);
    }

    if ((combat.enemyHp || 0) <= 0) {
      next.combat = { ...combat, active: false, phase: "ended" };
      next.systemLog.push(`${combat.enemy} 已失去再战之力。`);
    }
  }

  if (patch.combatAction === "exit") {
    next.combat = { ...next.combat, active: false, phase: "ended" };
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
  patch.npcStoryUpdates?.forEach((update) => updateNpcStory(next, update));

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
  patch.questStateUpdates?.forEach((update) => {
    next.questStateMap[update.id] = {
      ...(next.questStateMap[update.id] || { id: update.id, status: update.status }),
      ...update
    };
  });

  patch.locationUnlockUpdates?.forEach((update) => updateLocationUnlockReason(next, update));
  patch.relationshipRouteUpdates?.forEach((update) => updateRelationshipRoute(next, update));

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

  if (patch.rumorAdd) {
    for (const rumor of patch.rumorAdd) {
      const normalized: Rumor = {
        id: rumor.id || uid("rumor"),
        text: rumor.text,
        kind: rumor.kind || "rumor",
        location: rumor.location,
        npc: rumor.npc,
        source: rumor.source || "ai-proposal",
        discoveredDay: rumor.discoveredDay || next.worldDay,
        consumed: rumor.consumed || false
      };
      const exists = next.rumors.some((entry) => entry.text === normalized.text && entry.location === normalized.location && entry.npc === normalized.npc);
      if (!exists) next.rumors.push(normalized);
    }
  }

  if (patch.systemNote) next.systemLog.push(patch.systemNote);
  if (patch.objectiveUpdate) next.objective = { ...next.objective, ...patch.objectiveUpdate };
  if ("pendingCheck" in patch) {
    next.pendingCheck = patch.pendingCheck ? makePendingCheck(patch.pendingCheck) : undefined;
  }
  if ("pendingDamage" in patch) {
    next.pendingDamage = patch.pendingDamage ? makePendingDamage(patch.pendingDamage) : undefined;
  }
  if (next.pendingDamage && next.combat.active) {
    next.combat.phase = "awaiting_damage_roll";
  } else if (next.pendingCheck && next.combat.active) {
    next.combat.phase = "awaiting_hit_check";
  }
  if (!next.combat.active) {
    next.pendingDamage = undefined;
    next.pendingCheck = undefined;
    next.combat.phase = "ended";
  }
  next.questStateMap = normalizeQuestStateMap(next.quests, next.questStateMap);
  next.locationUnlocks = normalizeLocationUnlocks(next.locations, next.locationUnlocks, initialGameState.locationUnlocks);
  next.npcStoryState = normalizeNpcStoryState(next.npcs, next.npcStoryState, initialGameState.npcStoryState);
  next.relationshipRoutes = normalizeRelationshipRoutes(next.npcs, next.relationshipRoutes, initialGameState.relationshipRoutes);
  next.character = relabelAbilities(hero);

  return normalizeGameState(next);
  */
}

function advanceWorldLocally(state: GameState, globalUpdate: boolean): GamePatch {
  return advanceWorldLocallyEngine(state, globalUpdate);
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
    storyFlagsAdd: [`turn:${state.actionCount + 1}`],
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

function parseDamageResult(text: string) {
  const label = text.match(/【伤害】(.+?)\s+\d+d\d+/)?.[1]?.trim();
  const total = Number(text.match(/= (\d+)\s*$/m)?.[1] || NaN);

  return {
    label,
    total
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

function routeState(state: GameState, key: string) {
  return state.relationshipRoutes[key];
}

function hasStoryFlag(state: GameState, flag: string) {
  return state.storyFlags.includes(flag);
}

function buildShuangErSupportPatch(state: GameState): GamePatch | undefined {
  const route = routeState(state, ROUTE_SHUANGER);
  if (!route?.active) return undefined;
  if (route.stage === "trust" && !hasStoryFlag(state, "support:shuang-er:medicine")) {
    return {
      newItem: {
        id: "shuang-er-medicine",
        name: "双儿包好的药囊",
        desc: "双儿把止血与行气的药仔细分开包好，叮嘱你别再乱撑。",
        count: 1,
        type: "consumable",
        usable: true,
        hpRestore: 6
      },
      storyFlagsAdd: ["support:shuang-er:medicine"],
      systemNote: "双儿悄悄替你备下了一只药囊。"
    };
  }
  if (route.stage === "partiality" && !hasStoryFlag(state, "support:shuang-er:travel")) {
    return {
      qiRecovery: 1,
      storyFlagsAdd: ["support:shuang-er:travel"],
      systemNote: "双儿替你把沿路零碎都收拾妥了，你终于能喘过一口稳气。"
    };
  }
  return undefined;
}

export function localDm(action: string, state: GameState, globalUpdate: boolean): { text: string; patch: GamePatch } {
  const firstQuestPatch = firstQuestPatchForOrigin(state);
  const hit = parseHitResult(action);
  const damage = parseDamageResult(action);
  const atWuliang = currentLocation(state) === "无量山";
  const atDali = currentLocation(state) === "大理城";
  const atGusu = currentLocation(state) === "姑苏";
  const q1Active = hasQuest(state, QUEST_WANDERER_1, "active");
  const q2Active = hasQuest(state, QUEST_WANDERER_2, "active");
  const q3Active = hasQuest(state, QUEST_WANDERER_3, "active");
  const q4Active = hasQuest(state, QUEST_WANDERER_4, "active");
  const q5Active = hasQuest(state, QUEST_WANDERER_5, "active");
  const shuangErRoute = routeState(state, ROUTE_SHUANGER);
  const shuangErStage = shuangErRoute?.stage || "unawakened";
  const withWorldPatch = (...patches: Array<GamePatch | undefined>) =>
    mergeGamePatches(advanceWorldLocally(state, globalUpdate), ...patches);
  const resolveStoryPatch = (trigger: Parameters<typeof resolveNamelessStoryTrigger>[1], ...patches: Array<GamePatch | undefined>) =>
    withWorldPatch(resolveNamelessStoryTrigger(state, trigger), ...patches);
  const mergeCombatStoryPatch = (combatPatch: GamePatch) =>
    withWorldPatch(
      combatPatch,
      combatPatch.combatAction === "exit" && q3Active
        ? resolveNamelessStoryTrigger(state, { kind: "combat_win", enemyName: state.combat.enemy })
        : undefined
    );

  if (state.combat.active && state.pendingDamage && !Number.isNaN(damage.total)) {
    const combatPatch = resolveCombatDamage(state, damage);
    return {
      text: combatPatch.combatAction === "exit"
        ? "Combat resolved. The fight is over."
        : "Combat continues into the next exchange.",
      patch: mergeCombatStoryPatch(combatPatch)
    };
  }

  if (!Number.isNaN(hit.total) && !Number.isNaN(hit.dc) && state.combat.active) {
    const combatPatch = resolveCombatHit(state, hit);
    return {
      text: combatPatch.combatAction === "exit"
        ? "Combat resolved. The fight is over."
        : hit.success
          ? "Your strike lands, but the enemy is still in the fight."
          : "You fail to stabilize the exchange and take the enemy response.",
      patch: mergeCombatStoryPatch(combatPatch)
    };
  }

  if (state.combat.active && state.pendingDamage && !Number.isNaN(damage.total) && q3Active) {
    const enemyName = state.combat.enemy || "Opponent";
    const enemyAfter = clamp((state.combat.enemyHp || 0) - damage.total, 0, state.combat.enemyMaxHp || 1);
    if (enemyAfter <= 0) {
      return {
        text: "Combat resolved. The mountain fight is over.",
        patch: withWorldPatch(
          {
            combatUpdate: {
              enemyHpChange: -damage.total,
              enemyStatusAdd: damage.total >= 10 ? ["闇插嚭鐮寸唤"] : [],
              enemyMartialArtUsed: damage.label || state.pendingDamage.label,
              phase: "ended",
              roundDelta: 0,
              stakes: inferCombatStakes(enemyName)
            },
            combatAction: "exit",
            pendingCheck: undefined
          },
          resolveNamelessStoryTrigger(state, { kind: "combat_win", enemyName })
        )
      };
    }
  }

  if (!Number.isNaN(hit.total) && !Number.isNaN(hit.dc) && state.combat.active && hit.success && q3Active) {
    const enemyName = state.combat.enemy || "Opponent";
    const enemyAfter = clamp((state.combat.enemyHp || 0) - hit.damageTotal, 0, state.combat.enemyMaxHp || 1);
    if (enemyAfter <= 0) {
      return {
        text: "Combat resolved. The mountain fight is over.",
        patch: withWorldPatch(
          {
            combatUpdate: {
              enemyHpChange: -hit.damageTotal,
              enemyStatusAdd: hit.total - hit.dc >= 5 ? ["闇插嚭鐮寸唤"] : [],
              enemyMartialArtUsed: hit.label,
              phase: "ended",
              roundDelta: 0,
              stakes: inferCombatStakes(enemyName)
            },
            combatAction: "exit",
            pendingCheck: undefined
          },
          resolveNamelessStoryTrigger(state, { kind: "combat_win", enemyName })
        )
      };
    }
  }

  if (!Number.isNaN(hit.total) && !Number.isNaN(hit.dc) && !state.combat.active) {
    if (q1Active && hit.label?.includes("鏇垮鏍堝帇浣忓墠鍫備贡灞€")) {
      if (hit.success) {
        return {
          text: "Quest advanced from the inn scene.",
          patch: resolveStoryPatch({ kind: "story_check_passed", checkId: "steady_inn" }, { pendingCheck: undefined })
        };
      }

      return {
        text: "The inn scene is not fully stabilized yet.",
        patch: withWorldPatch({
          hpChange: -1,
          relationshipChanges: [{ name: "鍙屽効", delta: 3, attitude: "鎷呭績" }],
          pendingCheck: undefined
        })
      };
    }

    if (q2Active && hit.label?.includes("杩戒笂灞遍亾閲岀殑涔︾敓")) {
      if (hit.success) {
        return {
          text: "Quest advanced on the mountain trail.",
          patch: resolveStoryPatch({ kind: "story_check_passed", checkId: "track_scholar" }, { pendingCheck: undefined })
        };
      }

      return {
        text: "You are still one step behind on the mountain trail.",
        patch: withWorldPatch({
          hpChange: -1,
          pendingCheck: undefined
        })
      };
    }

    if (hit.label?.includes("鏁戜笅瀹㈡爤鎺屾煖")) {
      return {
        text: hit.success ? "The innkeeper is saved." : "The rescue attempt falls short.",
        patch: resolveStoryPatch(
          hit.success
            ? { kind: "story_check_passed", checkId: "save_innkeeper" }
            : { kind: "story_check_failed", checkId: "save_innkeeper" },
          { pendingCheck: undefined }
        )
      };
    }
  }

  if (
    atDali &&
    q1Active &&
    shuangErStage === "met" &&
    /鎺屾煖|瀹㈡爤|甯繖|璺戣吙|鐪嬪簵|閫佽嵂|閫佷俊|鎼揣|鎶ら櫌|鏉傛椿/.test(action)
  ) {
    return {
      text: "Preparing the inn stability check.",
      patch: resolveStoryPatch({ kind: "story_check_requested", checkId: "steady_inn" })
    };
  }

  if (
    q2Active &&
    atWuliang &&
    /鏃犻噺灞眧灞遍亾|杩戒笂|涔︾敓|娈佃獕|鏈ㄥ娓厊鐪嬬湅鍔ㄩ潤|椋庢尝|杩藉幓/.test(action) &&
    !state.combat.active
  ) {
    return {
      text: "Preparing the mountain trail check.",
      patch: resolveStoryPatch({ kind: "story_check_requested", checkId: "track_scholar" })
    };
  }

  if (
    state.chapterState.id === NAMELESS_WANDERER_CHAPTER_ID &&
    atDali &&
    q4Active &&
    /娈嬬牬璐﹂〉|璐﹂〉|鍙傜収璐︽湰|鏍稿璐﹂〉|鏍稿娈嬮〉|鏌ョ湅娈嬮〉/.test(action)
  ) {
    const cluePatch = resolveNamelessStoryTrigger(state, { kind: "use_clue", clueId: "ledger-fragment" });
    if (cluePatch) {
      return {
        text: "The ledger clue is being cross-checked.",
        patch: withWorldPatch(cluePatch)
      };
    }
  }

  if (
    atDali &&
    q4Active &&
    shuangErStage === "trust" &&
    /鎺屾煖|瀹㈡爤涓讳汉|鎶や綇|鏁戜笅|鏁戞帉鏌渱鎸′綇|鏈変汉闂逛簨|鏈変汉鏉ョ牳搴梶淇濅綇瀹㈡爤|鍓嶅爞|鍥炲鏍坾鍥炲幓|鍙屽効/.test(action) &&
    !hasStoryFlag(state, "route:shuang-er:owner-saved")
  ) {
    return {
      text: "Preparing the innkeeper rescue check.",
      patch: resolveStoryPatch({ kind: "story_check_requested", checkId: "save_innkeeper" })
    };
  }

  if (
    q5Active &&
    hasStoryFlag(state, "route:shuang-er:offered") &&
    shuangErStage === "partiality" &&
    /鍙屽効|鍚岃|璺熸垜璧皘涓€璧疯蛋|甯︿笂鍙屽効|鎴戞効鎰弢璁╁ス璺熺潃鎴?/.test(action)
  ) {
    return {
      text: "Shuang'er chooses to follow.",
      patch: resolveStoryPatch({ kind: "story_choice", choiceId: "accept_shuang_er" })
    };
  }

  if (
    q5Active &&
    hasStoryFlag(state, "route:shuang-er:offered") &&
    /鍏堜笉甯涓嶅甫濂箌璁╁ス鐣欏湪瀹㈡爤|璁╁ス鍏堢暀|鎴戣嚜宸辫蛋|涓嶅繀璺熺潃|鏆傛椂涓嶇敤鍚岃/.test(action)
  ) {
    return {
      text: "Shuang'er stays at the inn for now.",
      patch: resolveStoryPatch({ kind: "story_choice", choiceId: "decline_shuang_er" })
    };
  }

  if (atDali && q1Active && shuangErStage === "unawakened" && /客栈|落脚|疗伤|包扎|歇脚|休息|后院/.test(action)) {
    const supportPatch = buildShuangErSupportPatch(state);
    return {
      text: "你刚在客栈后院坐下，就见一个穿着素净的丫鬟已经把热水、药布和灯火都悄悄备齐。她自称双儿，说话轻，却极稳当，替你理伤时既不慌乱，也不肯让你继续硬撑。等你回过神来，连散落的小东西都被她分门别类收好了，倒像是早把照料人当成了本分。",
      patch: {
        ...advanceWorldLocally(state, globalUpdate),
        hpChange: 4,
        innerInjuryChange: -1,
        npcUpdates: [
          { name: "双儿", hidden: false, discovered: true, attitude: "温柔", status: "在客栈后院静静照应你" }
        ],
        npcStoryUpdates: [
          { name: "双儿", state: "revealed" }
        ],
        relationshipChanges: [
          { name: "双儿", delta: 8, attitude: "温柔" }
        ],
        relationshipRouteUpdates: [
          {
            npcId: ROUTE_SHUANGER,
            kind: "retainer",
            active: true,
            stage: "met",
            note: "她以客栈丫鬟的身份先把你的伤势与行囊都照看妥帖了。",
            supportUnlocked: ["care"]
          }
        ],
        storyFlagsAdd: ["route:shuang-er:met"],
        systemNote: "你在客栈后院结识了双儿。她看着只是个丫鬟，做事却比寻常人更稳。 ",
        ...(supportPatch || {})
      }
    };
  }

  if (atDali && q1Active && shuangErStage === "met" && /掌柜|客栈|帮忙|跑腿|看店|送药|送信|搬货|护院|杂活/.test(action)) {
    return {
      text: "掌柜让你去前堂和后院搭把手，话不多，眼神却一直在看你到底靠不靠得住。双儿抱着药盘在一旁静静看着，像是也在等你把这第一步站稳。若真把这摊杂乱压住，你在这家客栈就不再只是个借住的过路客。",
      patch: {
        ...advanceWorldLocally(state, globalUpdate),
        pendingCheck: {
          label: "替客栈压住前堂乱局",
          abilityKey: "cha",
          dc: 12,
          reason: "前堂后院都乱成一团，你得让闹事的人闭嘴，也让店里的人重新各归其位。",
          risk: "若失败，掌柜会看轻你，双儿也会替你担心。",
          suggestedAction: "可以硬压场面，也可以借机说服、喝住或拆开闹事的人。"
        }
      }
    };
  }

  if (atDali && (q1Active || q4Active) && (shuangErStage === "trust" || shuangErStage === "partiality") && /双儿|传话|留意|打探|托她|替我看着|替我送药|替我递话/.test(action)) {
    const supportPatch = buildShuangErSupportPatch(state);
    return {
      text: "双儿听完你的话，只轻轻点了点头，先把最细的地方替你补全了：该递去的话、该带上的药、该避开的眼线，她像是早替你想过一遍。等你回神时，她已经把事情办得妥妥帖帖，只留下脸上一点压不住的薄红。",
      patch: {
        ...advanceWorldLocally(state, globalUpdate),
        rumorAdd: [
          {
            text: "双儿顺手替你摸到了客栈与茶肆之间那条最安静的递话路。",
            kind: "npc_lead",
            location: "大理城",
            npc: "双儿",
            source: "local-route"
          }
        ],
        relationshipChanges: [
          { name: "双儿", delta: 5, attitude: "偏向" }
        ],
        relationshipRouteUpdates: [
          {
            npcId: ROUTE_SHUANGER,
            kind: "retainer",
            active: true,
            stage: shuangErStage,
            note: "她已经会不动声色地把你的麻烦先一步理顺。",
            supportUnlocked: ["care", "stash", "message"]
          }
        ],
        systemNote: "双儿不声不响，却已经明显开始偏着你了。",
        ...(supportPatch || {})
      }
    };
  }

  if (atDali && q4Active && shuangErStage === "trust" && /掌柜|客栈主人|护住|救下|救掌柜|挡住|有人闹事|有人来砸店|保住客栈|前堂|回客栈|回去|双儿/.test(action) && !hasStoryFlag(state, "route:shuang-er:owner-saved")) {
    return {
      text: "你刚踏进前堂，就看见来闹事的人已经把刀口逼到掌柜面前。那掌柜平日里只像个会算账、会招呼客人的老生意人，可这会儿仍稳坐不乱，手边茶盏都没晃出半滴，像是年轻时见过比这更凶的局。双儿脸色一白，却还是先把后院的人往里护住，只来得及抬头望你一眼。",
      patch: {
        ...advanceWorldLocally(state, globalUpdate),
        pendingCheck: {
          label: "救下客栈掌柜",
          abilityKey: "dex",
          dc: 14,
          reason: "闹事的人来得又快又狠，你若慢半步，掌柜和客栈都会出事。",
          risk: "若失败，掌柜会受伤，双儿也会被卷进去。",
          suggestedAction: "可先抢身位护住掌柜，也可借桌椅门框拆掉对方的来势。"
        }
      }
    };
  }

  if (q5Active && hasStoryFlag(state, "route:shuang-er:offered") && shuangErStage === "partiality" && /双儿|同行|跟我走|一起走|带上双儿|我愿意|让她跟着我/.test(action)) {
    return {
      text: "掌柜把话说开后，双儿先是低下头应了一声，转身却仍把你的药囊、换洗和路上要用的零碎一一理好。等她再站到你面前时，眼神安静得很，像是早已经替自己拿定了主意，只等你这一句愿不愿带她走。",
      patch: {
        ...advanceWorldLocally(state, globalUpdate),
        questUpdates: [{ id: QUEST_WANDERER_5, status: "resolved" }],
        objectiveUpdate: {
          title: "第一章暂歇",
          text: "双儿已经跟上了你。眼下江湖路真正开了，先带着她看看下一步往哪边走。",
          location: currentLocation(state),
          npc: "双儿"
        },
        npcUpdates: [
          { name: "双儿", companion: true, recruitable: true, status: "奉掌柜之命，安静地跟在你身边" }
        ],
        npcStoryUpdates: [
          { name: "双儿", state: "companion" }
        ],
        relationshipChanges: [
          { name: "双儿", delta: 6, attitude: "依随" }
        ],
        relationshipRouteUpdates: [
          {
            npcId: ROUTE_SHUANGER,
            kind: "retainer",
            active: true,
            stage: "follow",
            allowCompanion: true,
            note: "掌柜把她交给了你，而她也自愿把自己放在你身边，长期追随一段。",
            supportUnlocked: ["care", "stash", "message", "escort"]
          }
        ],
        storyFlagsAdd: ["route:shuang-er:follow", "chapter:one:complete"],
        questStateUpdates: [
          { id: QUEST_WANDERER_5, status: "resolved", stage: "accepted-shuang-er" }
        ],
        chapterStateUpdate: {
          id: "nameless-wanderer-ch1",
          stage: "chapter-complete"
        },
        systemNote: "你收下了双儿，她开始以自己的方式长期追随你。"
      }
    };
  }

  if (q5Active && hasStoryFlag(state, "route:shuang-er:offered") && /先不带|不带她|让她留在客栈|让她先留|我自己走|不必跟着|暂时不用同行/.test(action)) {
    return {
      text: "你把话说得很平，掌柜也没有勉强，只点了点头。双儿先是轻轻应声，把已经替你理好的药囊又重新收稳，眼里那点失落一闪而过，却还是温温静静地说，等你什么时候想带她上路，再回来叫她便是。",
      patch: {
        ...advanceWorldLocally(state, globalUpdate),
        questUpdates: [{ id: QUEST_WANDERER_5, status: "resolved" }],
        objectiveUpdate: {
          title: "第一章暂歇",
          text: "你暂时仍是独行。客栈这边留下了一个稳稳的落脚点，下一步可以继续闯江湖。",
          location: "大理城",
          npc: "双儿"
        },
        npcUpdates: [
          { name: "双儿", companion: false, recruitable: true, hidden: false, discovered: true, status: "仍在客栈等你回头叫她" }
        ],
        npcStoryUpdates: [
          { name: "双儿", state: "available" }
        ],
        relationshipRouteUpdates: [
          {
            npcId: ROUTE_SHUANGER,
            kind: "retainer",
            active: true,
            stage: "partiality",
            allowCompanion: true,
            note: "你暂时没有带她走，但她已经把自己放在一个会为你留位置的地方。",
            supportUnlocked: ["care", "stash", "message"]
          }
        ],
        storyFlagsAdd: ["route:shuang-er:declined", "chapter:one:complete"],
        questStateUpdates: [
          { id: QUEST_WANDERER_5, status: "resolved", stage: "declined-for-now" }
        ],
        chapterStateUpdate: {
          id: "nameless-wanderer-ch1",
          stage: "chapter-complete"
        },
        systemNote: "你暂时没有带走双儿，但这条线没有断。"
      }
    };
  }

  if (atDali && ["trust", "partiality", "follow", "enduring"].includes(shuangErStage) && /双儿|休息|疗伤|包扎|歇一歇|静养/.test(action)) {
    const careFlag = `support:shuang-er:care:${state.worldDay}`;
    if (!hasStoryFlag(state, careFlag)) {
      return {
        text: "双儿见你终于肯停下来，先把水和药都换成了温热的，再一点点替你把伤口和气息都理顺。她做这些事时向来不声张，只在替你掖好药布后才低着头轻声催你别再逞强。",
        patch: {
          ...advanceWorldLocally(state, globalUpdate),
          hpChange: 6,
          qiRecovery: 1,
          innerInjuryChange: -1,
          storyFlagsAdd: [careFlag],
          systemNote: "双儿替你好生收拾了一回伤势。"
        }
      };
    }
  }

  if (["partiality", "follow", "enduring"].includes(shuangErStage) && /双儿|传话|打探|递话|探看|替我留意/.test(action)) {
    const messageFlag = `support:shuang-er:message:${state.worldDay}`;
    if (!hasStoryFlag(state, messageFlag)) {
      return {
        text: "双儿听完便把细处记在心里，转身时仍是一副温温静静的模样，可该避的人、该探的话、该绕开的眼线，她比谁都分得更清。你还没来得及多想，她已经把最要紧的消息轻轻带回来了。",
        patch: {
          ...advanceWorldLocally(state, globalUpdate),
          rumorAdd: [
            {
              text: "双儿替你摸到了一条更安稳的消息路子，往后在这一带打听风声会顺手许多。",
              kind: "hook",
              location: currentLocation(state),
              npc: "双儿",
              source: "local-route"
            }
          ],
          storyFlagsAdd: [messageFlag],
          systemNote: "双儿替你把风声和眼线都先理了一遍。"
        }
      };
    }
  }

  if (state.combat.active && state.pendingDamage && !Number.isNaN(damage.total)) {
    const enemyName = state.combat.enemy || "对手";
    const enemyAfter = clamp((state.combat.enemyHp || 0) - damage.total, 0, state.combat.enemyMaxHp || 1);
    const nextCheck = enemyAfter > 0 ? nextCombatPendingCheck(state) : undefined;
    const patch: GamePatch = {
      ...advanceWorldLocally(state, globalUpdate),
      ...(firstQuestPatch || {}),
      combatUpdate: {
        enemyHpChange: -damage.total,
        enemyStatusAdd: damage.total >= 10 ? ["露出破绽"] : [],
        enemyMartialArtUsed: damage.label || state.pendingDamage.label,
        phase: enemyAfter > 0 ? "awaiting_hit_check" : "ended",
        roundDelta: enemyAfter > 0 ? 1 : 0,
        stakes: inferCombatStakes(enemyName)
      },
      combatAction: enemyAfter <= 0 ? "exit" : "none",
      pendingCheck: nextCheck
    };

    if (enemyAfter <= 0 && q3Active) {
      patch.questUpdates = [
        { id: QUEST_WANDERER_3, status: "resolved" },
        {
          id: QUEST_WANDERER_4,
          title: "回客栈看看",
          text: "无量山这一阵暂时压住了，但追兵临退前提到了大理那间客栈。立刻回去看看掌柜和双儿。",
          status: "active"
        }
      ];
      patch.objectiveUpdate = {
        title: "回客栈看看",
        text: "尽快赶回大理客栈，别让追兵把后手落到掌柜和双儿头上。",
        location: "大理城",
        npc: "双儿"
      };
      patch.npcUpdates = [
        { name: "段誉", discovered: true, hidden: false, status: "被你从山道乱局里护了下来" },
        { name: "木婉清", discovered: true, hidden: false, status: "仍冷着脸，却记下了你这次援手" }
      ];
      patch.npcStoryUpdates = [
        { name: "段誉", state: "revealed" },
        { name: "木婉清", state: "revealed" }
      ];
      patch.relationshipChanges = [
        { name: "段誉", delta: 10, attitude: "感激" },
        { name: "木婉清", delta: 8, attitude: "记下" }
      ];
      patch.relationshipRouteUpdates = [
        {
          npcId: "duan-yu",
          kind: "bond",
          active: true,
          stage: "met",
          note: "你在无量山风波里救下了段誉，他把你当成了真正能托命的人。",
          supportUnlocked: []
        },
        {
          npcId: "mu-wanqing",
          kind: "bond",
          active: true,
          stage: "met",
          note: "木婉清嘴上不软，心里却已经记住了你替她分过这一轮凶险。",
          supportUnlocked: []
        }
      ];
      patch.questStateUpdates = [
        { id: QUEST_WANDERER_3, status: "resolved", stage: "mountain-cleared" },
        { id: QUEST_WANDERER_4, status: "active", stage: "return-inn" }
      ];
      patch.storyFlagsAdd = ["combat:wuliang-pursuers:won", "npc:duan-yu:saved", "npc:mu-wanqing:met", "trigger:return-inn"];
      patch.chapterStateUpdate = {
        stage: "return-inn"
      };
      patch.systemNote = "无量山这一场先压住了，你也和段誉、木婉清真正结上了线。";
    }

    const text = enemyAfter > 0
      ? `这一式伤害结结实实落在${enemyName}身上，对方被你逼得乱了半拍，只能咬牙再稳架势。下一轮对招已经接上，战局还没停。`
      : q3Active
        ? `这一击终于把${enemyName}彻底打垮。追兵散去前还放了句狠话，说城里那家客栈也跑不了。你心里一沉，立刻知道该回大理了。`
        : `这一击把${enemyName}最后那口气也打散了。对方再难续招，这一场对招算是被你真正拿下。`;

    return { text, patch };
  }

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
          enemyMartialArtUsed: hit.success ? hit.label : undefined,
          phase: nextCheck ? "awaiting_hit_check" : "ended",
          roundDelta: nextCheck ? 1 : 0,
          stakes: inferCombatStakes(enemyName)
        },
        combatAction: hit.success && enemyAfter <= 0 ? "exit" : "none",
        pendingCheck: nextCheck
      };

      if (hit.success && enemyAfter <= 0 && q3Active) {
        patch.questUpdates = [
          { id: QUEST_WANDERER_3, status: "resolved" },
          {
            id: QUEST_WANDERER_4,
            title: "回客栈看看",
            text: "无量山这一阵暂时压住了，但追兵临退前提到了大理那间客栈。立刻回去看看掌柜和双儿。",
            status: "active"
          }
        ];
        patch.objectiveUpdate = {
          title: "回客栈看看",
          text: "尽快赶回大理客栈，别让追兵把后手落到掌柜和双儿头上。",
          location: "大理城",
          npc: "双儿"
        };
        patch.npcUpdates = [
          { name: "段誉", discovered: true, hidden: false, status: "被你从山道乱局里护了下来" },
          { name: "木婉清", discovered: true, hidden: false, status: "仍冷着脸，却记下了你这次援手" }
        ];
        patch.npcStoryUpdates = [
          { name: "段誉", state: "revealed" },
          { name: "木婉清", state: "revealed" }
        ];
        patch.relationshipChanges = [
          { name: "段誉", delta: 10, attitude: "感激" },
          { name: "木婉清", delta: 8, attitude: "记下" }
        ];
        patch.relationshipRouteUpdates = [
          {
            npcId: "duan-yu",
            kind: "bond",
            active: true,
            stage: "met",
            note: "你在无量山风波里救下了段誉，他把你当成了真正能托命的人。",
            supportUnlocked: []
          },
          {
            npcId: "mu-wanqing",
            kind: "bond",
            active: true,
            stage: "met",
            note: "木婉清嘴上不软，心里却已经记住了你替她分过这一轮凶险。",
            supportUnlocked: []
          }
        ];
        patch.questStateUpdates = [
          { id: QUEST_WANDERER_3, status: "resolved", stage: "mountain-cleared" },
          { id: QUEST_WANDERER_4, status: "active", stage: "return-inn" }
        ];
        patch.storyFlagsAdd = ["combat:wuliang-pursuers:won", "npc:duan-yu:saved", "npc:mu-wanqing:met", "trigger:return-inn"];
        patch.chapterStateUpdate = {
          stage: "return-inn"
        };
        patch.systemNote = "无量山这一场先压住了，你也和段誉、木婉清真正结上了线。";
      }

      const text = hit.success
        ? enemyAfter > 0
          ? `你这一招已经打实，${enemyName}被逼得退开半步，但还没彻底失势。对方随即稳住架子，准备再换一手压回来，战局仍在滚着往前。`
          : q3Active
            ? `这一记终于把${enemyName}的架子彻底打散。追兵散去前还放了句狠话，说城里那家客栈也跑不了。你心里一沉，立刻知道该回大理了。`
            : `这一记终于把${enemyName}的架子彻底打散。对方再难把气续上，只能退败，眼前这一场对招算是分出了高下。`
        : `${enemyName}抓住你这一瞬的失手反逼上来，你没能把局面按住，反倒被对方打乱脚步，身上结结实实吃下了后手。`;

      return { text, patch };
    }

    if (hit.label?.includes("救下客栈掌柜")) {
      if (hit.success) {
        return {
          text: "你这一手抢得极快，硬是把来人的刀势拆偏了半寸，顺势把掌柜护了下来。那掌柜表面仍旧像个寻常生意人，收刀定神后却只用一句话就压得闹事的人不敢再放肆。你这才看明白，他不是只会守着柜台的人，多半是年轻时在江湖里滚过一身风浪，后来才把锋芒都收进了这间客栈。等人散去，他才把双儿唤到身边，平静地说：这丫头跟着你，或许比留在这里更合适。",
          patch: {
            ...advanceWorldLocally(state, globalUpdate),
            questUpdates: [
              { id: QUEST_WANDERER_4, status: "resolved" },
              {
                id: QUEST_WANDERER_5,
                title: "双儿去留",
                text: "掌柜已经把双儿郑重托付到你面前。要不要带她同行，由你一句话定下。",
                status: "active"
              }
            ],
            objectiveUpdate: {
              title: "双儿去留",
              text: "掌柜要把双儿交给你。想清楚，是带她上路，还是先让她留在客栈。",
              location: "大理城",
              npc: "双儿"
            },
            rumorAdd: [
              {
                text: "客栈掌柜年轻时多半不是寻常生意人，退下来后才把一身旧路数藏进了账本和茶盏里。",
                kind: "npc_lead",
                location: "大理城",
                source: "local-route"
              }
            ],
            relationshipChanges: [
              { name: "双儿", delta: 10, attitude: "偏心" }
            ],
            npcUpdates: [
              { name: "双儿", hidden: false, discovered: true, recruitable: true, status: "只等你一句话，便可随你同行" }
            ],
            relationshipRouteUpdates: [
              {
                npcId: ROUTE_SHUANGER,
                kind: "retainer",
                active: true,
                stage: "partiality",
                allowCompanion: true,
                note: "你救下掌柜后，双儿被正式托付给你，只等你愿不愿带她走。",
                supportUnlocked: ["care", "stash", "message"]
              }
            ],
            storyFlagsAdd: ["route:shuang-er:owner-saved", "route:shuang-er:offered", "route:shuang-er:partiality"],
            questStateUpdates: [
              { id: QUEST_WANDERER_4, status: "resolved", stage: "owner-saved" },
              { id: QUEST_WANDERER_5, status: "active", stage: "shuang-er-offered" }
            ],
            chapterStateUpdate: {
              stage: "shuang-er-choice"
            },
            systemNote: "客栈掌柜承了你的命，也把双儿郑重托付到了你面前。"
          }
        };
      }

      return {
        text: "你还是慢了半步，掌柜虽未当场丢命，却也被闹事的人逼得见了血。双儿脸色发白，却先把掌柜和后院的人都稳住了；她没有怪你，只是眼里的紧张再也藏不住。眼下这局还没算过去。",
        patch: {
          ...advanceWorldLocally(state, globalUpdate),
          hpChange: -3,
          relationshipChanges: [
            { name: "双儿", delta: 4, attitude: "担忧" }
          ],
          systemNote: "掌柜受了伤，双儿把这桩事牢牢记在了心上。"
        }
      };
    }

    if (q1Active && hit.label?.includes("替客栈压住前堂乱局")) {
      if (hit.success) {
        return {
          text: "你把前堂后院这一摊乱局硬生生按了下来。闹事的人被你喝住，店里的伙计也重新有了章法。掌柜终于认真看了你一眼，只说了句“还能用”。双儿站在一旁，明显松了口气。紧接着，前门又传来消息，说无量山那边正有人追着一个文弱书生和黑衣女子往深处赶。",
          patch: {
            ...advanceWorldLocally(state, globalUpdate),
            questUpdates: [
              { id: QUEST_WANDERER_1, status: "resolved" },
              {
                id: QUEST_WANDERER_2,
                title: "无量山风波",
                text: "客栈里传来的新消息不对劲。去无量山看看那名书生和黑衣女子到底卷进了什么麻烦。",
                status: "active"
              }
            ],
            objectiveUpdate: {
              title: "无量山风波",
              text: "赶去无量山山道，追上那名书生和黑衣女子，先弄清这摊乱子。",
              location: "无量山",
              npc: "段誉"
            },
            relationshipChanges: [
              { name: "双儿", delta: 8, attitude: "信任" }
            ],
            relationshipRouteUpdates: [
              {
                npcId: ROUTE_SHUANGER,
                kind: "retainer",
                active: true,
                stage: "trust",
                note: "你先替客栈稳住了场面，双儿和掌柜都真正把你当成了能靠得住的人。",
                supportUnlocked: ["care", "stash", "message"]
              }
            ],
            storyFlagsAdd: ["route:shuang-er:trust", "trigger:wuliang-rumor"],
            chapterStateUpdate: {
              stage: "wuliang-rumor"
            },
            questStateUpdates: [
              { id: QUEST_WANDERER_1, status: "resolved", stage: "inn-helped" },
              { id: QUEST_WANDERER_2, status: "active", stage: "wuliang-rumor" }
            ],
            systemNote: "你先在客栈站稳了脚，接下来该去无量山接那场真风波了。"
          }
        };
      }

      return {
        text: "你虽然没把场面彻底按死，却也总算没让客栈当场散架。掌柜对你还在观望，双儿替你把后头的烂摊子先接了过去。这一关不算站稳，只能说勉强没砸。",
        patch: {
          ...advanceWorldLocally(state, globalUpdate),
          hpChange: -1,
          relationshipChanges: [
            { name: "双儿", delta: 3, attitude: "担心" }
          ],
          pendingCheck: undefined
        }
      };
    }

    if (q2Active && hit.label?.includes("追上山道里的书生")) {
      if (hit.success) {
        return {
          text: "你沿着乱石和断枝追进山坳，终于看清局面。那文弱书生正被黑衣女子半护半挟着往前退，后头几名追兵已经咬了上来。书生自称段誉，女子则冷冷横了你一眼，虽未报全名，手中短弩却已说明她绝不是寻常人。眼下再多问一句都嫌慢，你得先替他们挡下这一轮。",
          patch: {
            ...advanceWorldLocally(state, globalUpdate),
            questUpdates: [
              { id: QUEST_WANDERER_2, status: "resolved" },
              {
                id: QUEST_WANDERER_3,
                title: "山道援手",
                text: "段誉和那名黑衣女子都被追兵咬住了。先替他们挡下这一轮，再说别的。",
                status: "active"
              }
            ],
            objectiveUpdate: {
              title: "山道援手",
              text: "先在无量山护住段誉和木婉清，别让追兵把人带走。",
              location: "无量山",
              npc: "段誉"
            },
            npcUpdates: [
              { name: "段誉", hidden: false, discovered: true, status: "慌乱中仍努力护着身边的人" },
              { name: "木婉清", hidden: false, discovered: true, status: "持弩压后，仍在死死盯着追兵" }
            ],
            npcStoryUpdates: [
              { name: "段誉", state: "revealed" },
              { name: "木婉清", state: "revealed" }
            ],
            relationshipChanges: [
              { name: "段誉", delta: 6, attitude: "感激" },
              { name: "木婉清", delta: 4, attitude: "戒备" }
            ],
            relationshipRouteUpdates: [
              {
                npcId: "duan-yu",
                kind: "bond",
                active: true,
                stage: "met",
                note: "你在无量山乱局里第一次见到了段誉。",
                supportUnlocked: []
              },
              {
                npcId: "mu-wanqing",
                kind: "bond",
                active: true,
                stage: "met",
                note: "你第一次见到木婉清时，她正带着一身杀气顶在追兵前头。",
                supportUnlocked: []
              }
            ],
            questStateUpdates: [
              { id: QUEST_WANDERER_2, status: "resolved", stage: "duan-yu-found" },
              { id: QUEST_WANDERER_3, status: "active", stage: "mountain-crisis" }
            ],
            storyFlagsAdd: ["npc:duan-yu:met", "npc:mu-wanqing:met", "trigger:mountain-crisis"],
            chapterStateUpdate: {
              stage: "mountain-crisis"
            },
            systemNote: "无量山的正戏到了，你已经正式卷进段誉和木婉清那边的乱局。"
          }
        };
      }

      return {
        text: "你追是追上去了，可还是差了半步，只远远看见那书生和黑衣女子被逼进更窄的山道。局势已经摆在眼前，只是你还没真正插进这局里。",
        patch: {
          ...advanceWorldLocally(state, globalUpdate),
          hpChange: -1,
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

  if (q2Active && atWuliang && /无量山|山道|追上|书生|段誉|木婉清|看看动静|风波|追去/.test(action) && !state.combat.active) {
    return {
      text: "无量山的山道越往里越乱，断枝、脚印、慌乱的说话声都往一个方向聚。你已经追到能看见人影的地步，再快一步，就能看清那书生和黑衣女子到底落在谁手里。",
      patch: {
        ...advanceWorldLocally(state, globalUpdate),
        pendingCheck: {
          label: "追上山道里的书生",
          abilityKey: "dex",
          dc: 13,
          reason: "山道窄得只能容两三个人并肩，再慢半步，你就只能看着他们被追进更深处。",
          risk: "若失败，你会落后一步，只能远远看着局势更乱。",
          suggestedAction: "先用身法追上，也可借地形抄近一步卡到他们前头。"
        }
      }
    };
  }

  if (q3Active && atWuliang && /段誉|木婉清|追兵|帮忙|出手|挡住|迎战|救人|掩护|动手/.test(action) && !state.combat.active) {
    return {
      text: "你这一插手，后头追兵立刻把注意力全压到了你身上。段誉被木婉清一把拽到后头，山道上的局面也瞬间从追逐变成了真正交手。眼前这一轮，只能先打。",
      patch: {
        ...advanceWorldLocally(state, globalUpdate),
        combatAction: "enter",
        enemyName: "黑衣刺客",
        pendingCheck: {
          label: "接下黑衣刺客的起手",
          abilityKey: "dex",
          martialArtId: "enemy-dagger",
          dc: 14,
          reason: "追兵头一个扑上来的就是黑衣刺客，你若接不住，段誉和木婉清立刻还得再退。",
          risk: "若失败，你会先吃下对方一记狠手，山道也会被压得更窄。",
          enemyIntent: "追兵想先打崩你，再顺势把段誉拖走。",
          suggestedAction: "可先抢身位拆招，也可直接以刀路或拳脚顶回去。"
        },
        systemNote: "无量山山道上的追兵已经正面撞上来了。"
      }
    };
  }

  if (q3Active && atWuliang && /娈佃獕|鏈ㄥ娓厊杩藉叺|甯繖|鍑烘墜|鎸′綇|杩庢垬|鏁戜汉|鎺╂姢|鍔ㄦ墜/.test(action) && !state.combat.active) {
    return {
      text: "Combat begins on the mountain trail.",
      patch: withWorldPatch(
        startCombat(state, "黑衣刺客", {
          label: "Respond to the assassin's opening move",
          abilityKey: "dex",
          martialArtId: "enemy-dagger",
          dc: 14,
          reason: "The pursuer is already closing in. You need to stop the opening pressure now.",
          risk: "If you fail, you take the first heavy blow and lose room on the mountain path.",
          enemyIntent: "The pursuer wants to break you first, then drag the others away.",
          suggestedAction: "Brace, intercept, or counter before the enemy takes full control.",
          systemNote: "The chase on the mountain path has become an open fight."
        })
      )
    };
  }

  const namedEnemy = enemyPresets.find((preset) => action.includes(preset.name));
  const enterCombatPatch = namedEnemy || (/鍑烘墜|鍔ㄦ墜|浜ゆ墜|杩庢垬|姣旀|寮€鎵搢鎷兼枟|鏉€杩囧幓|鏀诲嚮/.test(action) && !state.combat.active)
    ? withWorldPatch(startCombat(state, namedEnemy?.name || "榛戣。鍒哄"), firstQuestPatch)
    : undefined;
  if (enterCombatPatch && !state.combat.active) {
    return {
      text: namedEnemy ? `Combat begins against ${namedEnemy.name}.` : "Combat begins.",
      patch: enterCombatPatch
    };
  }
  const enterCombat = namedEnemy || (/出手|动手|交手|迎战|比武|开打|拼斗|杀过去|攻击/.test(action) && !state.combat.active);
  if (enterCombat && !state.combat.active) {
    const enemyName = namedEnemy?.name || "榛戣。鍒哄";
    return {
      text: namedEnemy ? `Combat begins against ${enemyName}.` : "Combat begins.",
      patch: withWorldPatch(startCombat(state, enemyName), firstQuestPatch)
    };
  }

  if (false && enterCombat && !state.combat.active) {
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
  abilityChoices: RollPackage[];
  abilityAllocation: RollPackage;
  setAbilityAllocation: (value: RollPackage) => void;
  onStart: () => void;
  onContinue?: () => void;
}) {
  const {
    customName,
    setCustomName,
    selectedOrigin,
    abilityChoices,
    abilityAllocation,
    setAbilityAllocation,
    onStart,
    onContinue
  } = props;

  const abilityOrder: Array<keyof typeof abilityLabels> = ["str", "dex", "con", "int", "cha", "wis"];
  const baseChoice = abilityChoices[0] || ([0, 0, 0, 0, 0, 0] as RollPackage);
  const finalChoice = applyAllocation(baseChoice, abilityAllocation);
  const pointsLeft = remainingAllocationPoints(abilityAllocation);
  const previewStats = {
    hp: calculateHpFromCon(finalChoice[2]),
    ac: calculateAcFromDex(finalChoice[1]),
    qi: calculateMaxQi(selectedOrigin.qiStart, finalChoice[5]),
    extBonus: Math.max(0, abilityMod(finalChoice[0])),
    intBonus: Math.max(0, abilityMod(finalChoice[5]))
  };

  function adjustAllocation(index: number, delta: -1 | 1) {
    if (!canAdjustAllocation(baseChoice, abilityAllocation, index, delta)) return;
    const next = [...abilityAllocation] as RollPackage;
    next[index] += delta;
    setAbilityAllocation(next);
  }

  return (
    <section className="setup-screen">
      <div className="setup-shell">
        <header className="setup-title">
          <p>江湖 DM 新版开局</p>
          <h1>入局之前</h1>
          <span>无名客只有一张随机底盘，再给你 {CREATION_FREE_POINTS} 点自由分配。页面尽量压成一屏，开局信息在这里一次看完。</span>
        </header>

        {onContinue && (
          <div className="setup-actions">
            <button type="button" onClick={onContinue}>继续上次存档</button>
          </div>
        )}

        <div className="setup-panel compact">
          <label className="name-field">
            姓名
            <input value={customName} onChange={(event) => setCustomName(event.target.value)} maxLength={8} />
          </label>

          <article className="origin-hook">
            <b>{selectedOrigin.name}</b>
            <span>{selectedOrigin.setupHint} 入局后会先看到无名客旧事，再顺势切进一场教学战斗，结束后才接回正式开场。</span>
          </article>

          <section className="roll-packages setup-base-card">
            <header>
              <b>随机底盘</b>
              <span>固定 1 组</span>
            </header>

            <button type="button">
              <strong>本局底盘</strong>
              <div>
                {baseChoice.map((value, abilityIndex) => {
                  const key = abilityOrder[abilityIndex];
                  return <span key={key}>{abilityLabels[key]} {value}</span>;
                })}
              </div>
            </button>
          </section>

          <section className="roll-packages">
            <header className="points-header">
              <b>自由加点</b>
              <span>剩余 <b>{pointsLeft}</b> / {CREATION_FREE_POINTS}</span>
            </header>

            <div className="allocator">
              {abilityOrder.map((key, index) => (
                <article key={key}>
                  <div>
                    <strong>{abilityLabels[key]}</strong>
                    <small>底 {baseChoice[index]} + {abilityAllocation[index]}</small>
                  </div>
                  <button
                    type="button"
                    onClick={() => adjustAllocation(index, -1)}
                    disabled={!canAdjustAllocation(baseChoice, abilityAllocation, index, -1)}
                  >
                    -
                  </button>
                  <b>{finalChoice[index]}</b>
                  <button
                    type="button"
                    onClick={() => adjustAllocation(index, 1)}
                    disabled={!canAdjustAllocation(baseChoice, abilityAllocation, index, 1)}
                  >
                    +
                  </button>
                </article>
              ))}
            </div>
          </section>

          <section className="setup-guides">
            <header>
              <b>属性作用</b>
              <span>加点前先看一眼。这里只写最直接的用途，避免第一次入局不知道该往哪项堆。</span>
            </header>

            <div className="setup-derived-preview">
              <b>当前预览</b>
              <div>
                <span>生命 {previewStats.hp}</span>
                <span>护甲 {previewStats.ac}</span>
                <span>内力 {previewStats.qi}</span>
                <span>外功加伤 +{previewStats.extBonus}</span>
                <span>内功加伤 +{previewStats.intBonus}</span>
                <span>起手武学 {selectedOrigin.martialArts[0]?.name || "江湖把式"}</span>
              </div>
            </div>

            <div className="setup-guide-grid">
              {abilityOrder.map((key) => (
                <article key={key} className="setup-guide-card">
                  <div>
                    <b>{abilityLabels[key]}</b>
                    <span>{abilityEffectLabels[key]}</span>
                  </div>
                  <p>{abilityDefinitions[key].text}</p>
                </article>
              ))}
            </div>
          </section>

          <button className="primary-action" type="button" onClick={onStart}>
            以此命数入局
          </button>
        </div>
      </div>
    </section>
  );
}

function NpcCard({
  npc,
  relationshipLabel,
  routeLabel,
  routeNote,
  supportLabels
}: {
  npc: Npc;
  relationshipLabel?: string;
  routeLabel?: string;
  routeNote?: string;
  supportLabels?: string[];
}) {
  return (
    <article className="npc-card">
      <img src={npc.portrait} alt={`${npc.name}立绘`} />
      <div>
        <header>
          <b>{npc.name}</b>
          <span>{routeLabel || relationshipLabel || npc.attitude}</span>
        </header>
        <p>{npc.title} · {npc.location}</p>
        <small>{routeNote || npc.goal}</small>
        <div className="npc-meta">
          {relationshipLabel && <em>{relationshipLabel}</em>}
          {supportLabels?.length ? <em>{supportLabels.join(" · ")}</em> : null}
        </div>
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

export function LegacyApp({ session }: { session: GameSession }) {
  const {
    game,
    setGame,
    api,
    setApi,
    customName,
    setCustomName,
    selectedOriginId,
    abilityChoices,
    abilityAllocation,
    setAbilityAllocation,
    drawerOpen,
    setDrawerOpen,
    activeTab,
    setActiveTab,
    input,
    setInput,
    rollMode,
    setRollMode,
    diceOpen,
    setDiceOpen,
    qiInvest,
    setQiInvest,
    selectedLocationId,
    setSelectedLocationId,
    selectedInventoryMartialId,
    setSelectedInventoryMartialId,
    selectedAbilityInfoKey,
    setSelectedAbilityInfoKey,
    rolling,
    setRolling,
    busy,
    setBusy,
    apiTest,
    musicEnabled,
    bgmVolume,
    setBgmVolume,
    uiLocked,
    endRef,
    fileInputRef,
    audioRef,
    closePanels,
    tryPlayMusic,
    lockUi,
    applyDeepSeekPreset,
    toggleMusic,
    runApiTest: runApiTestSession,
    canContinue,
    continueGame,
    exportSave,
    resetGame,
    beginTutorialCombat,
    skipTutorial: skipTutorialSession,
    submitAction: submitActionSession,
    submitDiceResult: submitDiceResultSession,
    submitDamageResult: submitDamageResultSession,
    queuePendingDamage: queuePendingDamageSession,
    importSave: importSaveSession
  } = session;

  /*
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
  const [uiLocked, setUiLocked] = useState(false);
  const endRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const fadeTimerRef = useRef<number | null>(null);
  const uiLockTimerRef = useRef<number | null>(null);
  */

  const globalUpdateDue = (game.actionCount + 1) % WORLD_STEP === 0;
  const panelOpen = drawerOpen || diceOpen;
  const locationName = currentLocation(game);
  const visibleNpcs = useMemo(() => game.npcs.filter(isVisibleNpc), [game]);
  const companions = visibleNpcs.filter((npc) => npc.companion);
  const activeRelationshipNpcs = useMemo(() => visibleNpcs.filter((npc) => primaryRouteForNpc(game, npc.id)), [game, visibleNpcs]);
  const selectedOrigin = playableOrigins.find((origin) => origin.id === selectedOriginId) || playableOrigins[0];
  const sceneBackground = sceneAssets[game.sceneType] || sceneAssets.market;
  const qiLimit = Math.min(QI_INVEST_LIMIT, game.character.qi);
  const lowQi = game.character.qi <= 1;
  const tutorialActive = isNamelessTutorialStage(game);
  const tutorialCombatActive = isNamelessTutorialCombatStage(game);
  const tutorialStoryActive = tutorialActive && !tutorialCombatActive;
  const selectedLocation = game.locations.find((location) => location.id === selectedLocationId)
    || game.locations.find((location) => location.current)
    || game.locations[0];
  const selectedInventoryMartial = game.character.martialArts.find((art) => art.id === selectedInventoryMartialId);
  // Session hook owns save availability state.

  /*
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
    if (game.setupComplete) closePanels();
  }, [game.setupComplete]);

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

  function lockUi(duration = 900) {
    setUiLocked(true);
    if (uiLockTimerRef.current !== null) {
      window.clearTimeout(uiLockTimerRef.current);
    }
    uiLockTimerRef.current = window.setTimeout(() => {
      setUiLocked(false);
      uiLockTimerRef.current = null;
    }, duration);
  }

  function closePanels() {
    setDrawerOpen(false);
    setDiceOpen(false);
  }

  function applyDeepSeekPreset(model: string) {
    setApi((prev) => ({
      ...prev,
      provider: "deepseek",
      apiUrl: DEEPSEEK_CHAT_COMPLETIONS_URL,
      model
    }));
    setApiTest({ status: "idle" });
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

  */
  /*
  async function callAi(updatedGame: GameState, playerAction: string, customPrompt?: string): Promise<AiCallResult> {
    if (!api.apiUrl || !api.apiKey || !api.model) {
      const fallback = localDm(playerAction, updatedGame, globalUpdateDue);
      return {
        text: fallback.text,
        patch: {},
        proposals: {}
      };
    }
    const endpoint = resolveApiEndpoint(api);

    const messages = [
      { role: "system", content: buildSystemPrompt(updatedGame, globalUpdateDue) },
      ...updatedGame.messages.slice(-10).map((message) => ({
        role: message.role === "player" ? "user" : "assistant",
        content: message.text
      })),
      ...(customPrompt ? [{ role: "user", content: customPrompt }] : []),
      { role: "user", content: playerAction }
    ];
    const outputLines = [
      `【判定】${label}`,
      `模式：${rollMode === "advantage" ? `优势(${first}/${second})` : rollMode === "disadvantage" ? `劣势(${first}/${second})` : "常规"}`,
      `d20：${picked}`,
      `加值：${mod >= 0 ? "+" : ""}${mod}`,
      ...(!game.combat.active ? [`内力：${qiBonusSpend}（判定 +${qiBonus}）`] : []),
      check ? `总计：${total} / DC ${check.dc}` : `总计：${total}`,
      check ? `结果：${success ? "成功" : "失败"}` : "结果：仅记录本次掷骰",
      ...(combatAttack && picked === 20 ? ["暴击：是"] : [])
    ];
    const outputLines = [
      `【判定】${label}`,
      `模式：${rollMode === "advantage" ? `优势(${first}/${second})` : rollMode === "disadvantage" ? `劣势(${first}/${second})` : "常规"}`,
      `d20：${picked}`,
      `加值：${mod >= 0 ? "+" : ""}${mod}`,
      ...(!game.combat.active ? [`内力：${qiBonusSpend}（判定 +${qiBonus}）`] : []),
      check ? `总计：${total} / DC ${check.dc}` : `总计：${total}`,
      check ? `结果：${success ? "成功" : "失败"}` : "结果：仅记录本次掷骰",
      ...(combatAttack && picked === 20 ? ["暴击：是"] : [])
    ];

    const response = await fetch(endpoint.url, {
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
      throw new Error(await readApiErrorSummary(response));
    }

    const data = await response.json();
    const raw = data.choices?.[0]?.message?.content || "";
    const { visibleText, patchText } = stripJsonBlock(raw);
    let patch: GamePatch = {};
    let proposals: AiProposalPayload = {};
    if (patchText) {
      const parsed = JSON.parse(patchText) as unknown;
      const split = splitAiPayload(parsed);
      patch = split.patch;
      proposals = split.proposals;
    }
    return {
      text: visibleText || "说书人沉吟了一瞬，局势暂时没有再往前翻出新变化。",
      patch,
      proposals
    };
  }

  */
  /*
  async function runApiTest() {
    if (!api.apiUrl || !api.apiKey || !api.model) {
      setApiTest({ status: "error", message: "请先填写 API URL、Model 和 API Key。" });
      return;
    }

    setApiTest({ status: "testing", message: "测试中..." });

    try {
      const endpoint = resolveApiEndpoint(api);
      const response = await fetch(endpoint.url, {
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
        const summary = await readApiErrorSummary(response);
        setApiTest({ status: "error", message: `连通失败：${summary}` });
        return;
      }

      setApiTest({
        status: "success",
        message: `连通成功：${api.model} · ${endpoint.url}${endpoint.autoCompleted ? "（已按 DeepSeek 官方格式补全地址）" : ""}`
      });
    } catch (error) {
      setApiTest({
        status: "error",
        message: `连通失败：${error instanceof Error ? error.message : "未知错误"}`
      });
    }
  }

  */
  /*
  async function submitAction(textOverride?: string) {
    const text = (textOverride || input).trim();
    if (!text || busy) return;
    if (game.pendingDamage) return;

    tryPlayMusic();
    setBusy(true);
    closePanels();
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
    const localCombatResolution = localDm(text, baseGame, globalUpdateDue);

    try {
      const aiPrompt = baseGame.combat.active
        ? "战斗状态由本地结算。只输出叙述正文，不要推进敌我 HP、回合、pendingCheck、pendingDamage 或 combatAction。"
        : globalUpdateDue
          ? "顺手让江湖其他人也往前动一动。"
          : undefined;
      const aiResult = await callAi(baseGame, text, aiPrompt);
      setGame((prev) => {
        const combatPatched = applyPatchToState(prev, withSceneFallback(localCombatResolution.patch, localCombatResolution.text, text));
        const aiProposalPatch = baseGame.combat.active
          ? {}
          : aiProposalsToLocalPatch(combatPatched, aiResult.proposals);
        const patched = applyPatchToState(
          combatPatched,
          baseGame.combat.active
            ? filterAiCombatPatch(aiResult.patch)
            : withSceneFallback({ ...aiResult.patch, ...aiProposalPatch }, aiResult.text, text)
        );
        return {
          ...patched,
          messages: [...patched.messages, { id: uid("dm"), role: "dm", text: aiResult.text }]
        };
      });
    } catch (error) {
      setGame((prev) => {
        const fallback = localCombatResolution;
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
      closePanels();
      setBusy(false);
    }
  }

  function queuePendingDamage(hitText: string, art: MartialArt, qiBonusSpend: number) {
    const pendingDamagePatch = prepareCombatDamageRoll(art, hitText, qiBonusSpend);
    const pendingDamage = pendingDamagePatch.pendingDamage ? makePendingDamage(pendingDamagePatch.pendingDamage) : undefined;

    if (!pendingDamage) return;

    setGame((prev) => {
      const patched = applyPatchToState(prev, pendingDamagePatch);
      return {
        ...patched,
        messages: [
          ...patched.messages,
          { id: uid("dice"), role: "dice", text: hitText },
        { id: uid("system"), role: "system", text: `命中已确认，请掷 ${art.name} 的伤害骰：${art.damageDice}${art.damageBonus ? ` +${art.damageBonus}` : ""}` }
        ]
      };
    });
  }

  async function submitDamageResult(text: string, pendingDamage: PendingDamage) {
    const combinedText = `${pendingDamage.hitText}\n${text}`;
    await submitDiceResult(combinedText, pendingDamage.qiCost);
  }

  async function submitDiceResult(text: string, qiSpent = 0) {
    if (busy) return;

    tryPlayMusic();
    setBusy(true);
    closePanels();

    const diceMessage: Message = { id: uid("dice"), role: "dice", text };
    const nextTime = advanceTime(game);
    const baseGame: GameState = {
      ...game,
      pendingCheck: undefined,
      pendingDamage: undefined,
      combat: game.combat.active
        ? { ...game.combat, phase: "resolving_enemy_response" }
        : game.combat,
      character: {
        ...game.character,
        qi: clamp(game.character.qi - qiSpent, 0, game.character.maxQi)
      },
      actionCount: game.actionCount + 1,
      ...nextTime,
      messages: [...game.messages, diceMessage]
    };

    setGame(baseGame);
    const localCombatResolution = localDm(text, baseGame, globalUpdateDue);

    try {
      const aiPrompt = baseGame.combat.active
        ? "战斗状态由本地结算。只输出叙述正文，不要推进敌我 HP、回合、pendingCheck、pendingDamage 或 combatAction。"
        : globalUpdateDue
          ? "顺手让江湖其他人也往前动一动。"
          : undefined;
      const aiResult = await callAi(baseGame, text, aiPrompt);
      setGame((prev) => {
        const combatPatched = applyPatchToState(prev, withSceneFallback(localCombatResolution.patch, localCombatResolution.text, text));
        const aiProposalPatch = baseGame.combat.active
          ? {}
          : aiProposalsToLocalPatch(combatPatched, aiResult.proposals);
        const patched = applyPatchToState(
          combatPatched,
          baseGame.combat.active
            ? filterAiCombatPatch(aiResult.patch)
            : withSceneFallback({ ...aiResult.patch, ...aiProposalPatch }, aiResult.text, text)
        );
        return {
          ...patched,
          messages: [...patched.messages, { id: uid("dm"), role: "dm", text: aiResult.text }]
        };
      });
    } catch (error) {
      setGame((prev) => {
        const fallback = localCombatResolution;
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
      closePanels();
      setBusy(false);
    }
  }

  */
  function legacyRollDice(
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
    const combatAttack = game.combat.active && game.combat.phase === "awaiting_hit_check";
    const qiBonusSpend = game.combat.active ? 0 : clamp(options.qiBonusSpend ?? qiInvest, 0, game.character.qi);
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

    const outputLines = lines;
    lockUi(1400);
    setRolling({ label, total, detail: `${modeText} · d20=${picked} · 内力 +${qiBonus}` });
    setQiInvest(0);
    closePanels();

    window.setTimeout(() => {
      setRollMode("normal");
      setRolling(null);
      closePanels();

      if (sendToDm) {
        if (check && success && options.martialArt && combatAttack) {
          queuePendingDamageSession(outputLines.join("\n"), options.martialArt, qiBonusSpend, picked === 20);
          return;
        }
        void submitDiceResultSession(outputLines.join("\n"), qiBonusSpend);
        return;
      }

      setGame((prev) => ({
        ...prev,
        character: {
          ...prev.character,
          qi: clamp(prev.character.qi - qiBonusSpend, 0, prev.character.maxQi)
        },
        messages: [...prev.messages, { id: uid("dice"), role: "dice", text: outputLines.join("\n") }]
      }));
    }, 1180);
  }

  function legacyRollDamageDice(pendingDamage: PendingDamage) {
    if (rolling || busy) return;

    const actualDamageDice = pendingDamage.isCritical ? doubleDamageDice(pendingDamage.damageDice) : pendingDamage.damageDice;
    const { rolls, total } = parseDamageDice(actualDamageDice);
    const bonus = pendingDamage.damageBonus || 0;
    const final = total + bonus;
    const damageText = `【伤害】${pendingDamage.label} ${actualDamageDice} => [${rolls.join(" + ")}]${bonus ? ` + ${bonus}` : ""} = ${final}${pendingDamage.isCritical ? "\n暴击：是" : ""}`;
    const text = `【伤害】${pendingDamage.label} ${pendingDamage.damageDice} => [${rolls.join(" + ")}]${bonus ? ` + ${bonus}` : ""} = ${final}`;

    lockUi(1400);
    setRolling({
      label: `${pendingDamage.label}伤害`,
      total: final,
      detail: `${pendingDamage.damageDice} = ${rolls.join(" + ")}${bonus ? ` + ${bonus}` : ""}`
    });
    closePanels();

    window.setTimeout(() => {
      setRollMode("normal");
      setRolling(null);
      closePanels();
      void submitDamageResultSession(damageText, pendingDamage);
    }, 1180);
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
    const combatInitiativeRoll = game.combat.active && game.combat.phase === "opening";
    const combatAttack = game.combat.active && game.combat.phase === "awaiting_hit_check";
    const qiBonusSpend = game.combat.active ? 0 : clamp(options.qiBonusSpend ?? qiInvest, 0, game.character.qi);
    const qiBonus = qiInvestBonus(qiBonusSpend);
    const first = Math.ceil(Math.random() * 20);
    const second = Math.ceil(Math.random() * 20);
    const picked = rollMode === "advantage"
      ? Math.max(first, second)
      : rollMode === "disadvantage"
        ? Math.min(first, second)
        : first;
    const total = picked + mod + qiBonus;
    const isCritical = combatAttack && picked === 20;
    const isAutoFail = Boolean(check) && picked === 1;
    const success = check
      ? (isAutoFail ? false : (isCritical ? true : total >= check.dc))
      : undefined;
    const modeText = rollMode === "advantage"
      ? `优势（${first}/${second}）`
      : rollMode === "disadvantage"
        ? `劣势（${first}/${second}）`
        : "常规";
    const outputLines = [
      `【判定】${label}`,
      `模式：${modeText}`,
      `d20=${picked}`,
      `加值：${mod >= 0 ? "+" : ""}${mod}`,
      ...(!game.combat.active ? [`内力：${qiBonusSpend}（判定 +${qiBonus}）`] : []),
      check ? `总计：${total} / DC ${check.dc}` : `总计：${total}`,
      check ? `结果：${success ? "成功" : "失败"}` : "结果：仅记录本次掷骰",
      ...(isCritical ? ["暴击：是"] : []),
      ...(isAutoFail ? ["大失败：d20=1"] : []),
      ...(combatInitiativeRoll ? ["阶段：先攻"] : []),
      ...(combatAttack ? ["阶段：攻击"] : [])
    ];

    lockUi(1400);
    setRolling({
      label,
      total,
      detail: `${modeText} · d20=${picked}${game.combat.active ? "" : ` · 内力 +${qiBonus}`}`
    });
    setQiInvest(0);
    closePanels();

    window.setTimeout(() => {
      setRollMode("normal");
      setRolling(null);
      closePanels();

      if (sendToDm) {
        if (check && success && options.martialArt && combatAttack) {
          queuePendingDamageSession(outputLines.join("\n"), options.martialArt, qiBonusSpend, isCritical);
          return;
        }
        void submitDiceResultSession(outputLines.join("\n"), qiBonusSpend);
        return;
      }

      setGame((prev) => ({
        ...prev,
        character: {
          ...prev.character,
          qi: clamp(prev.character.qi - qiBonusSpend, 0, prev.character.maxQi)
        },
        messages: [...prev.messages, { id: uid("dice"), role: "dice", text: outputLines.join("\n") }]
      }));
    }, 1180);
  }

  function rollDamageDice(pendingDamage: PendingDamage) {
    if (rolling || busy) return;

    const actualDamageDice = pendingDamage.isCritical ? doubleDamageDice(pendingDamage.damageDice) : pendingDamage.damageDice;
    const { rolls, total } = parseDamageDice(actualDamageDice);
    const bonus = pendingDamage.damageBonus || 0;
    const final = total + bonus;
    const damageText = `【伤害】${pendingDamage.label} ${actualDamageDice} => [${rolls.join(" + ")}]${bonus ? ` + ${bonus}` : ""} = ${final}${pendingDamage.isCritical ? "\n暴击：是" : ""}`;

    lockUi(1400);
    setRolling({
      label: `${pendingDamage.label}伤害`,
      total: final,
      detail: `${actualDamageDice} = ${rolls.join(" + ")}${bonus ? ` + ${bonus}` : ""}`
    });
    closePanels();

    window.setTimeout(() => {
      setRollMode("normal");
      setRolling(null);
      closePanels();
      void submitDamageResultSession(damageText, pendingDamage);
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
    const baseChoice = abilityChoices[0] || ([0, 0, 0, 0, 0, 0] as RollPackage);
    const hero = makeCharacterFromOrigin(customName, selectedOrigin, applyAllocation(baseChoice, abilityAllocation));

    lockUi(1400);
    closePanels();
    setGame(normalizeGameStateEngine({
      ...structuredClone(initialGameState),
      setupComplete: true,
      originId: selectedOrigin.id,
      creationMode: "origin",
      sceneType: "market",
      currentCharacterId: hero.id,
      character: hero,
      roster: [hero],
      locations: initialGameState.locations.map((location) => ({ ...location })),
      messages: [
        { id: "m0", role: "dm", text: buildNamelessTutorialBackground(hero.name) },
        { id: uid("system"), role: "system", text: `${hero.name}以“${selectedOrigin.name}”的身份入局，旧事先起，正篇稍后再开。` }
      ],
      chapterState: {
        id: NAMELESS_WANDERER_CHAPTER_ID,
        stage: "tutorial_story"
      },
      objective: buildNamelessTutorialObjective("story"),
      storyFlags: ["tutorial:active"],
      systemLog: ["无名客旧事已展开，进入教学战斗后才会接回正式开场。"]
    }));

    localStorage.setItem(SETUP_KEY, "1");
    tryPlayMusic();
  }

  /*
  function continueGame() {
    lockUi(1400);
    closePanels();
    setGame((prev) => normalizeGameState({ ...prev, setupComplete: true }));
    localStorage.setItem(SETUP_KEY, "1");
    tryPlayMusic();
  }

  */
  function openDrawer(tab: DrawerTab = activeTab) {
    if (uiLocked || rolling || busy) return;
    setActiveTab(tab);
    setDiceOpen(false);
    setDrawerOpen(true);
  }

  function openPendingCheck() {
    if (uiLocked || rolling || busy) return;
    setDrawerOpen(false);
    setDiceOpen(true);
  }

  function toggleDice() {
    if (uiLocked || rolling || busy) return;
    setDrawerOpen(false);
    setDiceOpen((open) => !open);
  }

  function switchScene(sceneType: SceneType) {
    setGame((prev) => ({ ...prev, sceneType }));
  }

  function travelToLocation(name: string) {
    closePanels();
    void submitActionSession(`前往【${name}】`);
  }

  /*
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

  */
  /*
  function importSave(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      try {
        const imported = JSON.parse(String(reader.result)) as GameState;
        closePanels();
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

  */
  /*
  function resetGame() {
    localStorage.removeItem(SETUP_KEY);
    setAbilityChoices(makeAbilityChoices());
    setSelectedChoiceIndex(0);
    setSelectedInventoryMartialId(undefined);
    setSelectedAbilityInfoKey(undefined);
    setGame(normalizeGameState(structuredClone(initialGameState)));
  }

  */
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

          {activeRelationshipNpcs.length > 0 && (
            <section className="relationship-route-panel">
              <h3>特别的人</h3>
              {activeRelationshipNpcs.slice(0, 3).map((npc) => {
                const route = primaryRouteForNpc(game, npc.id);
                return (
                  <article key={npc.id}>
                    <b>{npc.name}</b>
                    <span>{relationshipTierLabel(relationshipTier(npc.relationship))} · {route ? relationshipRouteStageLabel(route.stage, route.kind) : "未起线"}</span>
                    <p>{route?.note || npc.goal}</p>
                  </article>
                );
              })}
            </section>
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
                    <small>类别：{art.category === "internal" ? "内功" : "外功"}</small>
                    <small>等级：{art.grade}</small>
                    <small>来源：{art.source}</small>
                    <small>对应属性：{art.linkedAbility.toUpperCase()}</small>
                    <small>伤害：{art.damageDice}{art.damageBonus ? ` +${art.damageBonus}` : ""}</small>
                    <small>耗气：{art.category === "internal" ? art.baseQiCost : 0}</small>
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
          {companions.length > 0 ? companions.map((npc) => {
            const route = primaryRouteForNpc(game, npc.id);
            return (
              <NpcCard
                key={npc.id}
                npc={npc}
                relationshipLabel={relationshipTierLabel(relationshipTier(npc.relationship))}
                routeLabel={route ? relationshipRouteStageLabel(route.stage, route.kind) : undefined}
                routeNote={route?.note}
                supportLabels={route?.supportUnlocked?.map(supportLabel)}
              />
            );
          }) : (
            <p className="empty-state">眼下无人同行。同伴会随故事自然加入，也可能因为局势离开。</p>
          )}

          {activeRelationshipNpcs.length > 0 && (
            <section className="relationship-route-panel">
              <h3>长期牵挂</h3>
              {activeRelationshipNpcs.map((npc) => {
                const route = primaryRouteForNpc(game, npc.id);
                if (!route) return null;
                return (
                  <NpcCard
                    key={`route-${npc.id}`}
                    npc={npc}
                    relationshipLabel={relationshipTierLabel(relationshipTier(npc.relationship))}
                    routeLabel={relationshipRouteStageLabel(route.stage, route.kind)}
                    routeNote={route.note}
                    supportLabels={route.supportUnlocked?.map(supportLabel)}
                  />
                );
              })}
            </section>
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

          {game.rumors.length > 0 && (
            <div className="quest-log">
              <h3>江湖风声</h3>
              {game.rumors.slice(-4).reverse().map((rumor) => (
                <article key={rumor.id}>
                  <div>
                    <b>{rumor.location || "江湖传闻"}</b>
                    <p>{rumor.text}</p>
                  </div>
                  <span>{rumor.npc || "风闻"}</span>
                </article>
              ))}
            </div>
          )}
        </section>
      );
    }

    return (
      <section className="system-panel">
        <article className="system-section">
          <header>
            <b>接口设置</b>
          </header>

          <label>
            Provider
            <select value={api.provider} onChange={(event) => setApi((prev) => ({ ...prev, provider: event.target.value as ApiProvider }))}>
              {PROVIDER_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </label>

          <div className="api-presets">
            <button type="button" onClick={() => applyDeepSeekPreset(DS_FLASH_MODEL)}>
              DS Flash
            </button>
            <button type="button" onClick={() => applyDeepSeekPreset(DS_PRO_MODEL)}>
              DS Pro
            </button>
          </div>

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
            onClick={() => void runApiTestSession()}
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
            <input ref={fileInputRef} type="file" accept="application/json" onChange={importSaveSession} hidden />
            <p>当前人物与世界状态会自动保存在本地浏览器里。</p>
          </section>
        </article>

        <article className="system-section">
          <header>
            <b>江湖配乐</b>
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
        abilityChoices={abilityChoices}
        abilityAllocation={abilityAllocation}
        setAbilityAllocation={setAbilityAllocation}
        onStart={startOriginGame}
        onContinue={canContinue ? continueGame : undefined}
      />
    );
  }

  const appStyle = {
    "--scene-bg": `url("${sceneBackground}")`
  } as CSSProperties;

  const currentCheck = game.pendingCheck;
  const pendingDamage = game.pendingDamage;
  const combatInitiative = game.combat.active && game.combat.phase === "opening";
  const combatAttack = game.combat.active && game.combat.phase === "awaiting_hit_check";
  const awaitingDamage = Boolean(pendingDamage);
  const controlsBlocked = uiLocked || Boolean(rolling);
  const dexAbility = game.character.abilities.find((ability) => ability.key === "dex");
  const dexMod = dexAbility ? abilityMod(dexAbility.value) : 0;
  const pendingDamageDice = pendingDamage
    ? (pendingDamage.isCritical ? doubleDamageDice(pendingDamage.damageDice) : pendingDamage.damageDice)
    : undefined;
  const pendingCheckTag = combatInitiative ? "待先攻" : combatAttack ? "待攻击" : "待判定";
  const pendingCheckReason = combatInitiative
    ? "先攻固定掷身法（DEX）。胜则你先出手，败则敌方先动。"
    : combatAttack
      ? "先做命中判定；命中后再掷伤害。d20=20 暴击，d20=1 必失手。"
      : currentCheck?.reason;
  const pendingCheckAction = combatInitiative ? "掷先攻" : combatAttack ? "掷攻击" : "进行判定";

  return (
    <main className={`app ${game.combat.active ? "combat" : ""}`} style={appStyle}>
      <audio ref={audioRef} src={BGM_SRC} preload="auto" loop />
      {uiLocked && <div className="ui-lock-shield" aria-hidden="true" />}
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
          {tutorialActive && (
            <div className="objective-actions">
              {tutorialStoryActive && (
                <button
                  type="button"
                  className="primary-inline"
                  onClick={beginTutorialCombat}
                  disabled={controlsBlocked || busy}
                >
                  进入这一战
                </button>
              )}
              <button
                type="button"
                className="secondary-inline"
                onClick={skipTutorialSession}
                disabled={controlsBlocked || busy}
              >
                跳过教学
              </button>
            </div>
          )}
        </article>

        {game.combat.active && (
          <article className="enemy-card">
            <span>正在交手</span>
            <b>{game.combat.enemy}</b>
            <small>回合 {game.combat.round || 1} · {game.combat.phase || "awaiting_hit_check"}</small>
            {game.combat.stakes && <small>{game.combat.stakes}</small>}
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

        {pendingDamage && (
          <section className="pending-check">
            <span>待伤害</span>
            <b>{pendingDamage.label} · {pendingDamageDice}{pendingDamage.damageBonus ? ` +${pendingDamage.damageBonus}` : ""}</b>
            <p>命中已经确认，现在只差掷出这招的伤害骰。</p>
            {pendingDamage.isCritical && <small>暴击已触发：本次只翻倍伤害骰，不翻倍固定加值。</small>}
            {!!pendingDamage.qiCost && <small>命中后耗气：{pendingDamage.qiCost}</small>}
            <button type="button" onClick={openPendingCheck}>掷伤害</button>
          </section>
        )}

        {currentCheck && !pendingDamage && (
          <section className="pending-check">
            <span>{pendingCheckTag}</span>
            <b>{currentCheck.label} · DC {currentCheck.dc}</b>
            <p>{pendingCheckReason}</p>
            {currentCheck.enemyIntent && <small>敌人意图：{currentCheck.enemyIntent}</small>}
            {currentCheck.risk && <small>失败风险：{currentCheck.risk}</small>}
            {currentCheck.suggestedAction && !game.combat.active && <small>可尝试：{currentCheck.suggestedAction}</small>}
            <button type="button" onClick={openPendingCheck}>{pendingCheckAction}</button>
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
          <b>{rolling.label}</b>
          <strong>{rolling.total}</strong>
          <span>{rolling.detail}</span>
        </section>
      )}

      {diceOpen && (
        <section className="dice-popover">
          {pendingDamage ? (
            <>
              <article className="dice-check">
                <span>伤害结算</span>
                <b>{pendingDamage.label} · {pendingDamageDice}{pendingDamage.damageBonus ? ` +${pendingDamage.damageBonus}` : ""}</b>
                <p>命中已经确认，现在掷出真正生效的伤害骰。</p>
                {pendingDamage.isCritical && <small>暴击：伤害骰翻倍，固定加值不翻倍。</small>}
                {!!pendingDamage.qiCost && <small>命中后耗气：{pendingDamage.qiCost}</small>}
              </article>

              <b className="dice-section-title">伤害骰</b>
              <button
                className="martial-roll recommended"
                onClick={() => rollDamageDice(pendingDamage)}
              >
                <span>
                  {pendingDamage.label}
                  <small>点击掷出 {pendingDamageDice}{pendingDamage.damageBonus ? ` +${pendingDamage.damageBonus}` : ""}</small>
                </span>
                <b>{pendingDamageDice}</b>
              </button>
            </>
          ) : (
            <>
              {currentCheck && (
                <article className="dice-check">
                  <span>{combatInitiative ? "先攻判定" : combatAttack ? "攻击判定" : "当前判定"}</span>
                  <b>{currentCheck.label} · DC {currentCheck.dc}</b>
                  <p>{pendingCheckReason}</p>
                  {currentCheck.risk && <small>失败风险：{currentCheck.risk}</small>}
                </article>
              )}

              <div className="segmented">
                <button className={rollMode === "disadvantage" ? "active" : ""} onClick={() => setRollMode("disadvantage")}>劣势</button>
                <button className={rollMode === "normal" ? "active" : ""} onClick={() => setRollMode("normal")}>常规</button>
                <button className={rollMode === "advantage" ? "active" : ""} onClick={() => setRollMode("advantage")}>优势</button>
              </div>

              {!game.combat.active && (
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
                  <p>每投入 2 点内力，判定 +1。只有非战斗检定会使用这部分加成。</p>
                </section>
              )}

              {combatInitiative ? (
                <>
                  <b className="dice-section-title">先攻</b>
                  <button
                    className="recommended"
                    onClick={() => rollDice("先攻（身法）", dexMod, currentCheck, { sendToDm: Boolean(currentCheck) })}
                  >
                    <span>
                      {dexAbility?.label || "身法"}
                      <small>固定用 DEX 掷 d20 决定谁先动</small>
                    </span>
                    <b>{dexMod >= 0 ? "+" : ""}{dexMod}</b>
                  </button>
                </>
              ) : combatAttack ? (
                <>
                  <b className="dice-section-title">武学攻击</b>
                  {game.character.martialArts.map((art) => {
                    const ability = game.character.abilities.find((entry) => entry.key === art.linkedAbility);
                    const mod = ability ? abilityMod(ability.value) : 0;
                    const costOnHit = art.category === "internal" ? art.baseQiCost : 0;
                    const canUse = art.category === "external" || game.character.qi >= costOnHit;

                    return (
                      <button
                        key={art.id}
                        className={`martial-roll ${currentCheck?.martialArtId === art.id || currentCheck?.abilityKey === art.linkedAbility ? "recommended" : ""}`}
                        disabled={!canUse}
                        onClick={() => rollDice(
                          art.name,
                          mod,
                          currentCheck,
                          { martialArt: art, sendToDm: Boolean(currentCheck) }
                        )}
                      >
                        <span>
                          {art.name}
                          <small>{ability?.label || "对应属性"} · 伤害 {art.damageDice}{art.damageBonus ? ` +${art.damageBonus}` : ""}</small>
                        </span>
                        <b>{mod >= 0 ? "+" : ""}{mod}{costOnHit ? ` · 耗气 ${costOnHit}` : ""}</b>
                      </button>
                    );
                  })}
                </>
              ) : (
                <>
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
                        <b>{mod >= 0 ? "+" : ""}{mod} · 耗气 {costOnHit}</b>
                      </button>
                    );
                  })}
                </>
              )}
            </>
          )}
        </section>
      )}

      {!controlsBlocked && (
        <form className="input-bar" onSubmit={(event: FormEvent) => {
          event.preventDefault();
          void submitActionSession();
        }}>
          <button type="button" onClick={() => openDrawer()} aria-label="打开面板" disabled={busy}>
            <User size={21} />
          </button>
          <input
            value={input}
            onChange={(event) => setInput(event.target.value)}
            placeholder={awaitingDamage ? "先掷完这次武学伤害..." : game.combat.active ? "描述你用什么招式、怎样出手..." : "描述你的行动..."}
            disabled={busy || awaitingDamage}
          />
          <button type="button" onClick={toggleDice} aria-label="打开骰子" disabled={busy}>
            <Dices size={21} />
          </button>
          <button type="submit" disabled={busy || awaitingDamage} aria-label="发送">
            <Send size={20} />
          </button>
        </form>
      )}

      {panelOpen && <div className="scrim" onClick={closePanels} />}

      {drawerOpen && (
        <aside className="drawer open">
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
            <button className="close" onClick={closePanels}>
              <X size={18} />
            </button>
          </div>
          <div className="drawer-content">{renderDrawerContent()}</div>
        </aside>
      )}
    </main>
  );
}
