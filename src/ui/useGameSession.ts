import { ChangeEvent, useEffect, useRef, useState } from "react";
import {
  aiProposalsToLocalPatch,
  filterAiCombatPatch,
  inferSceneType,
  readApiErrorSummary,
  resolveApiEndpoint,
  splitAiPayload,
  stripThinkingBlocks,
  stripJsonBlock,
  withSceneFallback
} from "../game/ai/helpers";
import { buildCombatEscapeIntentPrompt, buildCombatNarrationPrompt, buildSystemPrompt } from "../game/ai/prompt";
import { buildCombatEscapeCheck, doubleDamageDice, prepareCombatDamageRoll, startCombat } from "../game/combat";
import { applyPatchToState, normalizeGameState } from "../game/engine";
import { localDm } from "../game/localdm";
import {
  abilityModifier,
  abilityValue,
  calculateInnerInjuryPressure,
  injuryTickDamage,
  injuryTierLabel,
  resolveInnerInjuryDelta
} from "../game/rules";
import { isEconomyTextId, tryResolveEconomyAction } from "../game/world/economySystem";
import { buildCombatEscapePromptText, isEscapeCombatAction, parseCombatDamageResult, parseCombatHitResult } from "../game/world/helpers";
import { initialGameState, martialArtCatalog, originTemplates } from "../data";
import {
  buildNamelessTutorialBackground,
  buildNamelessTutorialCombatIntroText,
  buildNamelessTutorialCompletionPatch,
  buildNamelessTutorialObjective,
  buildNamelessTutorialTransitionText,
  isNamelessTutorialCombatStage,
  NAMELESS_WANDERER_CHAPTER_ID,
  NAMELESS_WANDERER_TUTORIAL_ENEMY,
  isNamelessTutorialStage
} from "../game/story/namelessWanderer";
import type {
  ApiConfig,
  AiProposalPayload,
  DrawerTab,
  GamePatch,
  GameState,
  Item,
  MartialArt,
  Message,
  PendingCheck,
  PendingDamage,
  SceneType,
  StudyEntry,
  StudySourceState
} from "../types";
import type { ApiTestState, DiceGroup, RollPackage, RollingResult, RollingState } from "./sessionTypes";
import {
  API_KEY,
  applyAllocation,
  BGM_KEY,
  BGM_VOLUME_KEY,
  EMPTY_ROLL_PACKAGE,
  PLAYABLE_ORIGIN_ID,
  SAVE_KEY,
  SFX_KEY,
  SFX_VOLUME_KEY,
  SETUP_KEY,
  WORLD_STEP,
  advanceTime,
  clamp,
  defaultApiConfig,
  makeAbilityChoices,
  normalizeApiConfig,
  readJson
} from "./sessionShared";
import { buildCharacterFromOrigin } from "./setupHelpers";

type AiCallResult = {
  text: string;
  patch: GamePatch;
  proposals: AiProposalPayload;
};

type AiNarrationOutcome = {
  text: string;
  patch: GamePatch;
  errorMessage?: string;
};

type CombatAiStep = {
  state: GameState;
  actionText: string;
  prompt: string;
  fallbackText: string;
};

type EnemyTurnSummaryDetails = {
  actionLabel: string;
  naturalRoll: number;
  total: number;
  hit: boolean;
  critical: boolean;
  damage: number;
  heroHpBefore: number;
  heroHpAfter: number;
  enemyHpBefore: number;
  enemyHpAfter: number;
  enemyInnerInjuryBefore?: number;
  enemyInnerInjuryAfter?: number;
  enemyInnerInjuryTickDamage?: number;
  playerInnerInjuryDelta?: number;
  nextPhase?: string;
};

const combatSceneLabels: Record<GameState["sceneType"], string> = {
  temple: "寺院",
  market: "市集",
  tavern: "酒肆",
  brothel: "青楼",
  inn: "客栈",
  palace: "宫苑"
};

function uid(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
}

function currentLocationName(state: GameState) {
  return state.locations.find((location) => location.current)?.name || "当前地点";
}

function buildCombatFallbackText(
  stage: "player_check" | "player_escape" | "player_hit_confirmed" | "player_damage" | "enemy_turn_start" | "enemy_turn_end",
  data: {
    actorName: string;
    targetName: string;
    actionLabel?: string;
    hit?: boolean;
    critical?: boolean;
    damage?: number;
  }
) {
  switch (stage) {
    case "player_check":
      return data.hit
        ? `${data.actorName}这一手已经占到了势头，逼得${data.targetName}不得不回身应对。`
        : `${data.actorName}这一手落了空，门户间微微一松，${data.targetName}立刻顺势逼了上来。`;
    case "player_escape":
      return data.hit
        ? `${data.actorName}借着一线空当抽身退开，终于把${data.targetName}暂时甩出了眼前。`
        : `${data.actorName}想脱身却没能退净，脚下刚一松，${data.targetName}立刻顺势压了上来。`;
    case "player_hit_confirmed":
      return `${data.actorName}这一招${data.actionLabel || "攻击"}已经打实，${data.targetName}身形一震，场上气势也随之一偏。`;
    case "player_damage":
      return data.damage
        ? `${data.actorName}这一记${data.actionLabel || "重手"}结结实实落在${data.targetName}身上，劲力已经透了进去。`
        : `${data.actorName}这一下虽已递出，余劲却还未真正压住${data.targetName}。`;
    case "enemy_turn_start":
      return `${data.targetName}脚下不停，${data.actionLabel || "一招快手"}已然接上，气势直逼${data.actorName}胸前。`;
    case "enemy_turn_end":
      return data.hit
        ? `${data.targetName}这一手${data.actionLabel || "攻击"}终于打实${data.critical ? "，且来势更狠" : ""}，这一轮的落点已经分明。`
        : `${data.targetName}这一手${data.actionLabel || "攻击"}来得虽急，却终究没能真正打实。`;
    default:
      return "战局又往前逼了一步。";
  }
}

function buildCombatSummaryMessage(title: string, lines: string[]) {
  return `【${title}】\n${lines.join("\n")}`;
}

function buildInitiativeSummary(enemyName: string, hit: ReturnType<typeof parseCombatHitResult>) {
  return buildCombatSummaryMessage("先攻结果", [
    hit.success ? `你抢到了对 ${enemyName} 的先手。` : `${enemyName} 抢到了先手。`,
    `检定 ${hit.total} / DC ${hit.dc} · d20=${hit.naturalRoll}${hit.isCritical ? " · 暴击" : ""}`
  ]);
}

function buildPlayerHitSummary(enemyName: string, hit: ReturnType<typeof parseCombatHitResult>, artName: string) {
  return buildCombatSummaryMessage("攻击结果", [
    hit.success ? `${artName} 命中 ${enemyName}。` : `${artName} 未命中 ${enemyName}。`,
    `检定 ${hit.total} / DC ${hit.dc} · d20=${hit.naturalRoll}${hit.isCritical ? " · 暴击" : ""}`,
    hit.success ? "下一步：掷伤害骰。" : "这一手落空，敌方将接续出手。"
  ]);
}

function buildEscapeSummary(enemyName: string, hit: ReturnType<typeof parseCombatHitResult>) {
  return buildCombatSummaryMessage("逃跑结果", [
    hit.success ? `你暂时摆脱了 ${enemyName}。` : `你没能从 ${enemyName} 面前彻底脱身。`,
    `检定 ${hit.total} / DC ${hit.dc} · d20=${hit.naturalRoll}`
  ]);
}

function buildPlayerDamageSummary(enemyName: string, label: string, damageTotal: number, enemyHpBefore?: number, enemyHpAfter?: number, isCritical?: boolean) {
  const hpLine = typeof enemyHpBefore === "number" && typeof enemyHpAfter === "number"
    ? `${enemyName} HP：${enemyHpBefore} → ${enemyHpAfter}`
    : undefined;
  return buildCombatSummaryMessage("伤害结果", [
    `${label} 对 ${enemyName} 造成 ${damageTotal} 点伤害${isCritical ? "（暴击）" : ""}。`,
    ...(hpLine ? [hpLine] : [])
  ]);
}

function resolvePendingRollMode(check?: PendingCheck) {
  return check?.rollMode || "normal";
}

function isEscapePendingCheck(check?: PendingCheck) {
  return check?.kind === "combat_escape";
}

function isTutorialGame(state: GameState) {
  return isNamelessTutorialStage(state);
}

function isTutorialCombatGame(state: GameState) {
  return isNamelessTutorialCombatStage(state);
}

function makeSingleAbilityChoice() {
  return [makeAbilityChoices()[0]];
}

function qiInvestBonus(qi: number) {
  return Math.floor(qi / 2);
}

function buildDiceGroups(notation: string): DiceGroup[] {
  const matches = [...notation.toLowerCase().matchAll(/(\d+)d(\d+)/g)];
  return matches.map((match) => ({
    qty: Number(match[1]),
    sides: Number(match[2])
  }));
}

function formatRollModeText(mode: PendingCheck["rollMode"], faceResults: number[], picked: number) {
  if (mode === "advantage") {
    return `优势（${faceResults.join("/")}），取 ${picked}`;
  }
  if (mode === "disadvantage") {
    return `劣势（${faceResults.join("/")}），取 ${picked}`;
  }
  return "常规";
}

function includesAny(text: string, keywords: string[]) {
  return keywords.some((keyword) => text.includes(keyword));
}

const martialArtTemplateLookup = new Map<string, MartialArt>();
martialArtCatalog.forEach((art) => {
  martialArtTemplateLookup.set(art.id, art);
  martialArtTemplateLookup.set(art.name, art);
});

const TRAINING_ACTION_KEYWORDS = ["练功", "打坐", "运功", "冲关", "强练"];
const MEDITATION_ACTION_KEYWORDS = ["调息", "运气疗伤", "静坐疗伤"];
const INN_REST_ACTION_KEYWORDS = ["休息", "住店", "歇一晚"];

const STUDY_SUCCESS_TARGET = 3;
const QI_GROWTH_HARD_CAP = 6;

function currentLocationId(state: GameState) {
  return state.locations.find((location) => location.current)?.id;
}

function findArtTemplate(artId?: string, fallbackName?: string) {
  if (!artId && !fallbackName) return undefined;
  return martialArtTemplateLookup.get(artId || "") || martialArtTemplateLookup.get(fallbackName || "");
}

function buildStudyEntryFromArt(
  art: MartialArt,
  sourceKind: StudyEntry["sourceKind"],
  options: {
    sourceLabel?: string;
    locationId?: string;
    dangerous?: boolean;
    requiredProgress?: number;
    tier?: StudyEntry["tier"];
    routeKey?: StudyEntry["routeKey"];
    accessLevel?: StudyEntry["accessLevel"];
    hidden?: boolean;
    fortuneGate?: StudyEntry["fortuneGate"];
  } = {}
): StudyEntry {
  return {
    id: `study:${art.id}`,
    artId: art.id,
    name: art.name,
    category: art.category,
    linkedAbility: art.linkedAbility,
    sourceKind,
    stage: "discovered",
    progress: 0,
    requiredProgress: options.requiredProgress || STUDY_SUCCESS_TARGET,
    dangerous: options.dangerous,
    sourceLabel: options.sourceLabel,
    locationId: options.locationId,
    tier: options.tier,
    routeKey: options.routeKey,
    accessLevel: options.accessLevel,
    hidden: options.hidden,
    fortuneGate: options.fortuneGate
  };
}

function buildEnemyTurnSummary(enemyName: string, details: EnemyTurnSummaryDetails) {
  const lines = [];
  if (details.enemyInnerInjuryTickDamage) {
    lines.push(`${enemyName}内伤发作，先失去 ${details.enemyInnerInjuryTickDamage} 点气血。`);
  }
  lines.push(
    details.hit
      ? `${enemyName} 的 ${details.actionLabel} 命中了你，造成 ${details.damage} 点伤害${details.critical ? "（暴击）" : ""}。`
      : `${enemyName} 的 ${details.actionLabel} 没有打中你。`
  );
  lines.push(`检定 ${details.total} · d20=${details.naturalRoll}`);
  lines.push(`你的 HP：${details.heroHpBefore} → ${details.heroHpAfter}`);
  return buildCombatSummaryMessage("敌方结果", lines);
}

export function useGameSession() {
  const savedGame = readJson<GameState>(SAVE_KEY, initialGameState);
  const initialApi = readJson<ApiConfig>(API_KEY, defaultApiConfig("openai"));

  const [game, setGame] = useState<GameState>(() => normalizeGameState(savedGame));
  const [api, setApi] = useState<ApiConfig>(() => normalizeApiConfig(initialApi));
  const [customName, setCustomName] = useState("无名客");
  const [selectedOriginId, setSelectedOriginId] = useState(PLAYABLE_ORIGIN_ID);
  const [abilityChoices, setAbilityChoices] = useState<RollPackage[]>(() => makeSingleAbilityChoice());
  const [selectedChoiceIndex, setSelectedChoiceIndex] = useState(0);
  const [abilityAllocation, setAbilityAllocation] = useState<RollPackage>(EMPTY_ROLL_PACKAGE);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<DrawerTab>("character");
  const [input, setInput] = useState("");
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
  const [sfxEnabled, setSfxEnabled] = useState(() => readJson<boolean>(SFX_KEY, true));
  const [sfxVolume, setSfxVolume] = useState(() => clamp(readJson<number>(SFX_VOLUME_KEY, 56), 0, 100));
  const [uiLocked, setUiLocked] = useState(false);

  const endRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const fadeTimerRef = useRef<number | null>(null);
  const uiLockTimerRef = useRef<number | null>(null);
  const rollCompletionRef = useRef<((result: RollingResult) => void) | null>(null);

  const canContinue = Boolean(readJson<GameState>(SAVE_KEY, initialGameState).setupComplete);
  const selectedOrigin = originTemplates.find((origin) => origin.id === selectedOriginId) || originTemplates[0];

  useEffect(() => {
    setAbilityChoices(makeSingleAbilityChoice());
    setSelectedChoiceIndex(0);
  }, [selectedOriginId]);

  useEffect(() => {
    setAbilityAllocation(EMPTY_ROLL_PACKAGE);
  }, [selectedChoiceIndex, selectedOriginId]);

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
    localStorage.setItem(SFX_KEY, JSON.stringify(sfxEnabled));
  }, [sfxEnabled]);

  useEffect(() => {
    localStorage.setItem(SFX_VOLUME_KEY, JSON.stringify(sfxVolume));
  }, [sfxVolume]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [game.messages, busy]);

  function closePanels() {
    setDrawerOpen(false);
    setDiceOpen(false);
  }

  function applyFormalActionFollowups(
    baseState: GameState,
    patchedState: GameState,
    actionText: string,
    options: { skipTick?: boolean } = {}
  ) {
    const messages: Message[] = [];
    const playerInnerBefore = baseState.innerInjury || 0;
    const playerInnerAfter = patchedState.innerInjury || 0;
    const enemyInnerBefore = baseState.combat.enemyInnerInjury || 0;
    const enemyInnerAfter = patchedState.combat.enemyInnerInjury || 0;

    if (playerInnerAfter > playerInnerBefore) {
      const delta = playerInnerAfter - playerInnerBefore;
      const reason = baseState.combat.active || patchedState.combat.active
        ? "对手劲力透体，经脉受创"
        : includesAny(actionText, TRAINING_ACTION_KEYWORDS)
          ? "行功岔气，逆冲伤脉"
          : "气血逆乱，伤及经脉";
      messages.push({
        id: uid("system"),
        role: "system",
        text: `【内伤】${reason}，内伤 +${delta}。`
      });
    } else if (playerInnerAfter < playerInnerBefore) {
      const delta = playerInnerBefore - playerInnerAfter;
      const reason = includesAny(actionText, MEDITATION_ACTION_KEYWORDS)
        ? "调息见效"
        : includesAny(actionText, INN_REST_ACTION_KEYWORDS)
          ? "静养见效"
          : "伤势缓和";
      messages.push({
        id: uid("system"),
        role: "system",
        text: `【内伤】${reason}，内伤 -${delta}。`
      });
    }

    if (enemyInnerAfter > enemyInnerBefore && patchedState.combat.enemy) {
      messages.push({
        id: uid("system"),
        role: "system",
        text: `【内伤】${patchedState.combat.enemy}气脉受损，内伤 +${enemyInnerAfter - enemyInnerBefore}。`
      });
    }

    let finalState = patchedState;
    const tick = injuryTickDamage(playerInnerAfter);
    if (!options.skipTick && tick > 0 && patchedState.character.hp > 0) {
      finalState = applyPatchToState(patchedState, { hpChange: -tick });
      messages.push({
        id: uid("system"),
        role: "system",
        text: `【内伤发作】${injuryTierLabel(playerInnerAfter)}，本次行动后掉落 ${tick} 点气血。当前内伤 ${playerInnerAfter}。`
      });
    }

    return { state: finalState, messages };
  }

  function advanceFormalState(baseState: GameState) {
    const time = advanceTime(baseState);
    return normalizeGameState({
      ...baseState,
      actionCount: baseState.actionCount + 1,
      worldDay: time.worldDay,
      timeSlot: time.timeSlot,
      studySources: (baseState.studySources || []).map((source) =>
        source.requiresSceneRefresh
          ? { ...source, refreshedSinceFailure: true }
          : source
      )
    });
  }

  function resolveSelfStudyInjuryDelta(
    state: GameState,
    trigger: "internal_study_failure" | "cultivation_failure"
  ) {
    return resolveInnerInjuryDelta(
      calculateInnerInjuryPressure(
        abilityValue(state.character.abilities, "wis"),
        abilityValue(state.character.abilities, "con"),
        trigger
      )
    );
  }

  function shouldTriggerInternalFailureInjury(naturalRoll: number, margin: number, chanceNear: number, chanceFar: number) {
    if (naturalRoll === 1) return true;
    if (margin >= 5) return Math.random() < chanceFar;
    if (margin >= 1) return Math.random() < chanceNear;
    return false;
  }

  function pushSystemMessage(text: string) {
    setGame((prev) => ({
      ...prev,
      messages: [...prev.messages, { id: uid("system"), role: "system", text }]
    }));
  }

  useEffect(() => {
    if (game.setupComplete) closePanels();
  }, [game.setupComplete]);

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

  function completeRolling(result: RollingResult) {
    const complete = rollCompletionRef.current;
    if (!complete) return;

    rollCompletionRef.current = null;
    setRolling(null);
    closePanels();
    complete(result);
  }

  function beginRolling(nextRolling: RollingState, onComplete: (result: RollingResult) => void) {
    rollCompletionRef.current = onComplete;
    setRolling(nextRolling);
  }

  function applyDeepSeekPreset(model: string) {
    setApi((prev) => ({
      ...prev,
      provider: "deepseek",
      apiUrl: "https://api.deepseek.com/chat/completions",
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

  function toggleSfx() {
    setSfxEnabled((enabled) => !enabled);
  }

  function continueGame() {
    lockUi(1400);
    closePanels();
    setGame((prev) => normalizeGameState({ ...prev, setupComplete: true }));
    localStorage.setItem(SETUP_KEY, "1");
    tryPlayMusic();
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

  function resetGame() {
    localStorage.removeItem(SETUP_KEY);
    setAbilityChoices(makeSingleAbilityChoice());
    setSelectedChoiceIndex(0);
    setAbilityAllocation(EMPTY_ROLL_PACKAGE);
    setSelectedInventoryMartialId(undefined);
    setSelectedAbilityInfoKey(undefined);
    setGame(normalizeGameState(structuredClone(initialGameState)));
  }

  async function callAi(
    updatedGame: GameState,
    playerAction: string,
    customPrompt?: string,
    fallbackText?: string
  ): Promise<AiCallResult> {
    const globalUpdateDue = updatedGame.actionCount % WORLD_STEP === 0;
    const fallbackNarration = localDm(playerAction, updatedGame, globalUpdateDue).text;

    if (!api.apiUrl || !api.apiKey || !api.model) {
      return {
        text: fallbackText || fallbackNarration,
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
        max_tokens: 700
      })
    });

    if (!response.ok) {
      throw new Error(await readApiErrorSummary(response));
    }

    const data = await response.json();
    const raw = data.choices?.[0]?.message?.content || "";
    const cleaned = stripThinkingBlocks(raw);
    const { visibleText, patchText } = stripJsonBlock(cleaned);
    let patch: GamePatch = {};
    let proposals: AiProposalPayload = {};

    if (patchText) {
      const parsed = JSON.parse(patchText) as unknown;
      const split = splitAiPayload(parsed);
      patch = split.patch;
      proposals = split.proposals;
    }

    return {
      text: visibleText || fallbackText || fallbackNarration,
      patch,
      proposals
    };
  }

  async function callNarrationStep(step: CombatAiStep): Promise<AiNarrationOutcome> {
    try {
      const aiResult = await callAi(step.state, step.actionText, step.prompt, step.fallbackText);
      return {
        text: aiResult.text || step.fallbackText,
        patch: filterAiCombatPatch(aiResult.patch)
      };
    } catch (error) {
      return {
        text: step.fallbackText,
        patch: {},
        errorMessage: error instanceof Error ? error.message : "未知错误"
      };
    }
  }

  async function runCombatNarrationSequence(steps: CombatAiStep[]) {
    const results: AiNarrationOutcome[] = [];
    for (const step of steps) {
      results.push(await callNarrationStep(step));
    }
    return results;
  }

  function collectAiErrorMessage(results: AiNarrationOutcome[]) {
    const message = results.find((result) => result.errorMessage)?.errorMessage;
    return message ? `API 调用失败，已切回本地战斗播报：${message}` : undefined;
  }

  async function promptCombatEscapeCheck(actionState: GameState, text: string) {
    const fallbackCheck = buildCombatEscapeCheck(actionState, text);
    if (!fallbackCheck) return;

    const fallbackText = buildCombatEscapePromptText(actionState, fallbackCheck);
    setGame(actionState);

    try {
      const aiResult = await callAi(actionState, text, buildCombatEscapeIntentPrompt(actionState, text), fallbackText);
      const resolvedCheck = buildCombatEscapeCheck(actionState, text, aiResult.proposals.proposedCheck) || fallbackCheck;
      setGame((prev) => {
        const patched = applyPatchToState(
          prev,
          withSceneFallback({ pendingCheck: resolvedCheck, ...filterAiCombatPatch(aiResult.patch) }, aiResult.text, text)
        );
        return {
          ...patched,
          messages: [...patched.messages, { id: uid("dm"), role: "dm", text: aiResult.text || fallbackText }]
        };
      });
    } catch (error) {
      setGame((prev) => {
        const patched = applyPatchToState(prev, withSceneFallback({ pendingCheck: fallbackCheck }, fallbackText, text));
        return {
          ...patched,
          messages: [
            ...patched.messages,
            { id: uid("system"), role: "system", text: `API 调用失败，已切回本地主持：${error instanceof Error ? error.message : ""}` },
            { id: uid("dm"), role: "dm", text: fallbackText }
          ]
        };
      });
    } finally {
      closePanels();
      setBusy(false);
    }
  }

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

  async function submitAction(textOverride?: string) {
    const text = (textOverride || input).trim();
    if (!text || busy) return;
    if (game.pendingDamage) {
      closePanels();
      setInput("");
      setGame((prev) => ({
        ...prev,
        messages: [
          ...prev.messages,
          { id: uid("player"), role: "player", text },
          {
            id: uid("dm"),
            role: "dm",
            text: "这一招已经递出，眼下先把伤害骰掷完，再谈别的动作。"
          }
        ]
      }));
      return;
    }

    if (isTutorialGame(game) && !isTutorialCombatGame(game)) {
      tryPlayMusic();
      closePanels();
      setInput("");
      setGame((prev) => ({
        ...prev,
        messages: [
          ...prev.messages,
          { id: uid("player"), role: "player", text },
          {
            id: uid("dm"),
            role: "dm",
            text: "这段旧事还未转入动手。先按“进入这一战”，顺着前缘接上那场拦路小斗；若不想体验教学，也可直接跳过。"
          }
        ]
      }));
      return;
    }

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
    const globalUpdateDue = baseGame.actionCount % WORLD_STEP === 0;
    const wantsEscape = baseGame.combat.active && isEscapeCombatAction(text);

    setGame(baseGame);

    if (wantsEscape && baseGame.combat.phase === "opening") {
      setGame((prev) => ({
        ...prev,
        messages: [
          ...prev.messages,
          {
            id: uid("dm"),
            role: "dm",
            text: "先攻还没分出来，眼下还谈不上转身脱战。先把先攻掷出来，再看能不能抽身。"
          }
        ]
      }));
      closePanels();
      setBusy(false);
      return;
    }

    if (wantsEscape && baseGame.combat.phase === "awaiting_hit_check" && !isEscapePendingCheck(baseGame.pendingCheck)) {
      await promptCombatEscapeCheck(baseGame, text);
      return;
    }

    const localCombatResolution = localDm(text, baseGame, globalUpdateDue);

    if (!baseGame.combat.active && isEconomyTextId(localCombatResolution.result.textId)) {
      setGame((prev) => {
        const patched = applyPatchToState(prev, withSceneFallback(localCombatResolution.patch, localCombatResolution.text, text));
        const outcome = applyFormalActionFollowups(baseGame, patched, text, {
          skipTick: Boolean(patched.pendingCheck)
        });
        return {
          ...outcome.state,
          messages: [...outcome.state.messages, ...outcome.messages, { id: uid("dm"), role: "dm", text: localCombatResolution.text }]
        };
      });
      closePanels();
      setBusy(false);
      return;
    }

    if (
      baseGame.combat.active &&
      baseGame.pendingCheck &&
      !baseGame.pendingDamage &&
      localCombatResolution.result.textOverride &&
      !localCombatResolution.result.combatFlow
    ) {
      setGame((prev) => {
        const patched = applyPatchToState(prev, withSceneFallback(localCombatResolution.patch, localCombatResolution.text, text));
        const outcome = applyFormalActionFollowups(baseGame, patched, text, {
          skipTick: Boolean(patched.pendingCheck)
        });
        return {
          ...outcome.state,
          messages: [...outcome.state.messages, ...outcome.messages, { id: uid("dm"), role: "dm", text: localCombatResolution.text }]
        };
      });
      closePanels();
      setBusy(false);
      return;
    }

    try {
      const aiPrompt = baseGame.combat.active
        ? "Combat state is authoritative local. Write short Jin Yong-inspired wuxia narration about pressure, movement, gaze, footing, and atmosphere. Do not alter combat results or state."
        : globalUpdateDue
          ? "Advance the broader world a little in the narration."
          : undefined;
      const aiResult = await callAi(baseGame, text, aiPrompt);
      setGame((prev) => {
        const combatPatched = applyPatchToState(prev, withSceneFallback(localCombatResolution.patch, localCombatResolution.text, text));
        const economyResolution = baseGame.combat.active
          ? undefined
          : aiResult.proposals.proposedWorldAction
            ? tryResolveEconomyAction(text, combatPatched, globalUpdateDue, aiResult.proposals.proposedWorldAction)
            : undefined;
        const aiProposalPatch = baseGame.combat.active ? {} : aiProposalsToLocalPatch(combatPatched, aiResult.proposals);
        const aiNarrationPatch = baseGame.combat.active
          ? filterAiCombatPatch(aiResult.patch)
          : withSceneFallback({ ...aiResult.patch, ...aiProposalPatch }, aiResult.text, text);
        const withEconomy = economyResolution
          ? applyPatchToState(combatPatched, withSceneFallback(economyResolution.patch, economyResolution.textOverride || aiResult.text, text))
          : combatPatched;
        const patched = applyPatchToState(withEconomy, aiNarrationPatch);
        const outcome = applyFormalActionFollowups(baseGame, patched, text, {
          skipTick: Boolean(patched.pendingCheck)
        });
        const dmText = economyResolution?.textOverride || aiResult.text;
        return {
          ...outcome.state,
          messages: [...outcome.state.messages, ...outcome.messages, { id: uid("dm"), role: "dm", text: dmText }]
        };
      });
    } catch (error) {
      setGame((prev) => {
        const patched = applyPatchToState(prev, withSceneFallback(localCombatResolution.patch, localCombatResolution.text, text));
        const outcome = applyFormalActionFollowups(baseGame, patched, text, {
          skipTick: Boolean(patched.pendingCheck)
        });
        return {
          ...outcome.state,
          messages: [
            ...outcome.state.messages,
            ...outcome.messages,
            { id: uid("system"), role: "system", text: `API 调用失败，已切回本地主持：${error instanceof Error ? error.message : ""}` },
            { id: uid("dm"), role: "dm", text: localCombatResolution.text }
          ]
        };
      });
    } finally {
      closePanels();
      setBusy(false);
    }
  }

  async function queuePendingDamage(hitText: string, art: MartialArt, qiBonusSpend: number, isCritical = false) {
    if (busy) return;

    const tutorialMode = isTutorialCombatGame(game);
    const hit = parseCombatHitResult(hitText);
    const pendingDamagePatch = prepareCombatDamageRoll(art, hitText, qiBonusSpend, isCritical, game.character);
    const stagedPatch = tutorialMode
      ? {
        ...pendingDamagePatch,
        objectiveUpdate: buildNamelessTutorialObjective("damage")
      }
      : pendingDamagePatch;
    const diceMessage: Message = { id: uid("dice"), role: "dice", text: hitText };
    const actionState: GameState = {
      ...game,
      messages: [...game.messages, diceMessage]
    };
    const stagedState = applyPatchToState(actionState, stagedPatch);
    const systemMessage: Message = {
      id: uid("system"),
      role: "system",
      text: buildPlayerHitSummary(stagedState.combat.enemy || "对手", hit, art.name)
    };
    const nextStepMessage: Message = {
      id: uid("system"),
      role: "system",
      text: `命中已确认，请掷 ${art.name} 的伤害骰：${art.damageDice}${art.damageBonus ? ` +${art.damageBonus}` : ""}`
    };

    tryPlayMusic();
    closePanels();

    setGame({
      ...stagedState,
      messages: [
        ...stagedState.messages,
        systemMessage,
        nextStepMessage
      ]
    });

    if (!stagedState.pendingDamage) return;

    setBusy(true);
    try {
      const narrationResults = await runCombatNarrationSequence([
        {
          state: stagedState,
          actionText: hitText,
          prompt: buildCombatNarrationPrompt(stagedState, {
            stage: "player_hit_confirmed",
            actorName: stagedState.character.name,
            targetName: stagedState.combat.enemy || "对手",
            round: stagedState.combat.round || 1,
            locationName: currentLocationName(stagedState),
            sceneLabel: combatSceneLabels[stagedState.sceneType],
            actionText: hitText,
            actionLabel: art.name,
            checkLabel: hit.label,
            naturalRoll: hit.naturalRoll,
            total: hit.total,
            dc: hit.dc,
            hit: hit.success,
            critical: hit.isCritical,
            enemyHpBefore: stagedState.combat.enemyHp,
            enemyHpAfter: stagedState.combat.enemyHp,
            heroHpBefore: stagedState.character.hp,
            heroHpAfter: stagedState.character.hp,
            nextPhase: stagedState.combat.phase
          }),
          fallbackText: buildCombatFallbackText("player_hit_confirmed", {
            actorName: stagedState.character.name,
            targetName: stagedState.combat.enemy || "对手",
            actionLabel: art.name,
            hit: true,
            critical: Boolean(hit.isCritical)
          })
        }
      ]);
      const errorMessage = collectAiErrorMessage(narrationResults);

      setGame((prev) => {
        let patched = prev;
        for (const result of narrationResults) {
          patched = applyPatchToState(patched, result.patch);
        }
        return {
          ...patched,
          messages: [
            ...patched.messages,
            ...(errorMessage ? [{ id: uid("system"), role: "system" as const, text: errorMessage }] : []),
            ...narrationResults.map((result) => ({ id: uid("dm"), role: "dm" as const, text: result.text }))
          ]
        };
      });
    } finally {
      setBusy(false);
    }
  }

  async function submitDamageResult(text: string, pendingDamage: PendingDamage) {
    if (busy) return;

    tryPlayMusic();
    setBusy(true);
    closePanels();

    const combinedText = `${pendingDamage.hitText}\n${text}`;
    const diceMessage: Message = { id: uid("dice"), role: "dice", text: combinedText };
    const nextTime = advanceTime(game);
    const actionState: GameState = {
      ...game,
      character: {
        ...game.character,
        qi: clamp(game.character.qi - pendingDamage.qiCost, 0, game.character.maxQi)
      },
      actionCount: game.actionCount + 1,
      ...nextTime,
      messages: [...game.messages, diceMessage]
    };
    const globalUpdateDue = actionState.actionCount % WORLD_STEP === 0;

    setGame(actionState);
    const localCombatResolution = localDm(combinedText, actionState, globalUpdateDue);

    const finalState = applyPatchToState(actionState, withSceneFallback(localCombatResolution.patch, localCombatResolution.text, combinedText));
    const damage = parseCombatDamageResult(combinedText);
    const playerState = localCombatResolution.result.combatFlow?.playerPatch
      ? applyPatchToState(actionState, withSceneFallback(localCombatResolution.result.combatFlow.playerPatch, localCombatResolution.text, combinedText))
      : finalState;
    const enemyTurn = localCombatResolution.result.combatFlow?.enemyTurn;
    const combatSummaryMessages: Message[] = [
      {
        id: uid("system"),
        role: "system",
        text: buildPlayerDamageSummary(
          actionState.combat.enemy || "对手",
          pendingDamage.label,
          damage.total,
          actionState.combat.enemyHp,
          playerState.combat.enemyHp,
          Boolean(pendingDamage.isCritical)
        )
      }
    ];
    if (enemyTurn) {
      combatSummaryMessages.push({
        id: uid("system"),
        role: "system",
        text: buildEnemyTurnSummary(finalState.combat.enemy || "对手", enemyTurn.details)
      });
    }
    const narrationSteps: CombatAiStep[] = [
      {
        state: playerState,
        actionText: combinedText,
        prompt: buildCombatNarrationPrompt(playerState, {
          stage: "player_damage",
          actorName: playerState.character.name,
          targetName: playerState.combat.enemy || "对手",
          round: playerState.combat.round || 1,
          locationName: currentLocationName(playerState),
          sceneLabel: combatSceneLabels[playerState.sceneType],
          actionText: combinedText,
          actionLabel: pendingDamage.label,
          critical: pendingDamage.isCritical,
          damage: damage.total,
          damageDice: pendingDamage.isCritical
            ? `${pendingDamage.damageDice}（暴击翻倍）`
            : pendingDamage.damageDice,
          damageBonus: pendingDamage.damageBonus,
          heroHpBefore: actionState.character.hp,
          heroHpAfter: playerState.character.hp,
          enemyHpBefore: actionState.combat.enemyHp,
          enemyHpAfter: playerState.combat.enemyHp,
          nextPhase: playerState.combat.phase
        }),
        fallbackText: buildCombatFallbackText("player_damage", {
          actorName: playerState.character.name,
          targetName: playerState.combat.enemy || "对手",
          actionLabel: pendingDamage.label,
          damage: damage.total,
          critical: Boolean(pendingDamage.isCritical)
        })
      }
    ];

    if (enemyTurn) {
      narrationSteps.push({
        state: playerState,
        actionText: combinedText,
        prompt: buildCombatNarrationPrompt(playerState, {
          stage: "enemy_turn_start",
          actorName: enemyTurn.details.actionLabel ? (playerState.combat.enemy || "对手") : (playerState.combat.enemy || "对手"),
          targetName: playerState.character.name,
          round: playerState.combat.round || 1,
          locationName: currentLocationName(playerState),
          sceneLabel: combatSceneLabels[playerState.sceneType],
          actionText: combinedText,
          actionLabel: enemyTurn.details.actionLabel,
          enemyIntent: playerState.pendingCheck?.enemyIntent || game.pendingCheck?.enemyIntent,
          heroHpBefore: enemyTurn.details.heroHpBefore,
          heroHpAfter: enemyTurn.details.heroHpBefore,
          enemyHpBefore: enemyTurn.details.enemyHpBefore,
          enemyHpAfter: enemyTurn.details.enemyHpAfter,
          nextPhase: enemyTurn.details.nextPhase
        }),
        fallbackText: buildCombatFallbackText("enemy_turn_start", {
          actorName: playerState.character.name,
          targetName: playerState.combat.enemy || "对手",
          actionLabel: enemyTurn.details.actionLabel
        })
      });
      narrationSteps.push({
        state: finalState,
        actionText: combinedText,
        prompt: buildCombatNarrationPrompt(finalState, {
          stage: "enemy_turn_end",
          actorName: finalState.combat.enemy || "对手",
          targetName: finalState.character.name,
          round: finalState.combat.round || 1,
          locationName: currentLocationName(finalState),
          sceneLabel: combatSceneLabels[finalState.sceneType],
          actionText: combinedText,
          actionLabel: enemyTurn.details.actionLabel,
          naturalRoll: enemyTurn.details.naturalRoll,
          total: enemyTurn.details.total,
          hit: enemyTurn.details.hit,
          critical: enemyTurn.details.critical,
          damage: enemyTurn.details.damage,
          damageDice: enemyTurn.details.damageDice,
          damageBonus: enemyTurn.details.damageBonus,
          heroHpBefore: enemyTurn.details.heroHpBefore,
          heroHpAfter: enemyTurn.details.heroHpAfter,
          enemyHpBefore: enemyTurn.details.enemyHpBefore,
          enemyHpAfter: enemyTurn.details.enemyHpAfter,
          nextPhase: enemyTurn.details.nextPhase
        }),
        fallbackText: buildCombatFallbackText("enemy_turn_end", {
          actorName: finalState.character.name,
          targetName: finalState.combat.enemy || "对手",
          actionLabel: enemyTurn.details.actionLabel,
          hit: enemyTurn.details.hit,
          critical: enemyTurn.details.critical,
          damage: enemyTurn.details.damage
        })
      });
    }

    const narrationResults = await runCombatNarrationSequence(narrationSteps);
    const errorMessage = collectAiErrorMessage(narrationResults);

    setGame((prev) => {
      let patched = applyPatchToState(prev, withSceneFallback(localCombatResolution.patch, localCombatResolution.text, combinedText));
      for (const result of narrationResults) {
        patched = applyPatchToState(patched, result.patch);
      }
      const outcome = applyFormalActionFollowups(actionState, patched, combinedText);
      return {
        ...outcome.state,
        messages: [
          ...outcome.state.messages,
          ...combatSummaryMessages,
          ...outcome.messages,
          ...(errorMessage ? [{ id: uid("system"), role: "system" as const, text: errorMessage }] : []),
          ...narrationResults.map((result) => ({ id: uid("dm"), role: "dm" as const, text: result.text }))
        ]
      };
    });

    closePanels();
    setBusy(false);
  }

  async function submitDiceResult(text: string, qiSpent = 0) {
    if (busy) return;

    tryPlayMusic();
    setBusy(true);
    closePanels();

    const diceMessage: Message = { id: uid("dice"), role: "dice", text };
    const nextTime = advanceTime(game);
    const actionState: GameState = {
      ...game,
      character: {
        ...game.character,
        qi: clamp(game.character.qi - qiSpent, 0, game.character.maxQi)
      },
      actionCount: game.actionCount + 1,
      ...nextTime,
      messages: [...game.messages, diceMessage]
    };
    const globalUpdateDue = actionState.actionCount % WORLD_STEP === 0;

    setGame(actionState);
    const localCombatResolution = localDm(text, actionState, globalUpdateDue);

    if (!actionState.combat.active) {
      if (isEconomyTextId(localCombatResolution.result.textId)) {
        setGame((prev) => {
          const patched = applyPatchToState(prev, withSceneFallback(localCombatResolution.patch, localCombatResolution.text, text));
          const outcome = applyFormalActionFollowups(actionState, patched, text);
          return {
            ...outcome.state,
            messages: [...outcome.state.messages, ...outcome.messages, { id: uid("dm"), role: "dm", text: localCombatResolution.text }]
          };
        });
        closePanels();
        setBusy(false);
        return;
      }
      try {
        const aiPrompt = globalUpdateDue ? "Advance the broader world a little in the narration." : undefined;
        const aiResult = await callAi(actionState, text, aiPrompt);
        setGame((prev) => {
          const combatPatched = applyPatchToState(prev, withSceneFallback(localCombatResolution.patch, localCombatResolution.text, text));
          const aiProposalPatch = aiProposalsToLocalPatch(combatPatched, aiResult.proposals);
          const patched = applyPatchToState(
            combatPatched,
            withSceneFallback({ ...aiResult.patch, ...aiProposalPatch }, aiResult.text, text)
          );
          const outcome = applyFormalActionFollowups(actionState, patched, text);
          return {
            ...outcome.state,
            messages: [...outcome.state.messages, ...outcome.messages, { id: uid("dm"), role: "dm", text: aiResult.text }]
          };
        });
      } catch (error) {
        setGame((prev) => {
          const patched = applyPatchToState(prev, withSceneFallback(localCombatResolution.patch, localCombatResolution.text, text));
          const outcome = applyFormalActionFollowups(actionState, patched, text);
          return {
            ...outcome.state,
            messages: [
              ...outcome.state.messages,
              ...outcome.messages,
              { id: uid("system"), role: "system", text: `API 调用失败，已切回本地主持：${error instanceof Error ? error.message : ""}` },
              { id: uid("dm"), role: "dm", text: localCombatResolution.text }
            ]
          };
        });
      } finally {
        closePanels();
        setBusy(false);
      }
      return;
    }

    const hit = parseCombatHitResult(text);
    const isInitiativeCheck = actionState.combat.phase === "opening";
    const isEscapeCheck = isEscapePendingCheck(actionState.pendingCheck);
    const combatSummaryMessages: Message[] = [];
    if (isInitiativeCheck) {
      combatSummaryMessages.push({
        id: uid("system"),
        role: "system",
        text: buildInitiativeSummary(actionState.combat.enemy || "对手", hit)
      });
    } else if (isEscapeCheck) {
      combatSummaryMessages.push({
        id: uid("system"),
        role: "system",
        text: buildEscapeSummary(actionState.combat.enemy || "对手", hit)
      });
    } else {
      combatSummaryMessages.push({
        id: uid("system"),
        role: "system",
        text: buildPlayerHitSummary(actionState.combat.enemy || "对手", hit, hit.label || "这一击")
      });
    }
    const finalState = applyPatchToState(actionState, withSceneFallback(localCombatResolution.patch, localCombatResolution.text, text));
    const playerState = localCombatResolution.result.combatFlow?.playerPatch
      ? applyPatchToState(actionState, withSceneFallback(localCombatResolution.result.combatFlow.playerPatch, localCombatResolution.text, text))
      : finalState;
    const enemyTurn = localCombatResolution.result.combatFlow?.enemyTurn;
    if (enemyTurn) {
      combatSummaryMessages.push({
        id: uid("system"),
        role: "system",
        text: buildEnemyTurnSummary(finalState.combat.enemy || "对手", enemyTurn.details)
      });
    }
    const narrationSteps: CombatAiStep[] = [
      {
        state: playerState,
        actionText: text,
        prompt: buildCombatNarrationPrompt(playerState, {
          stage: isEscapeCheck ? "player_escape" : "player_check",
          actorName: playerState.character.name,
          targetName: actionState.combat.enemy || playerState.combat.enemy || "对手",
          round: playerState.combat.round || 1,
          locationName: currentLocationName(playerState),
          sceneLabel: combatSceneLabels[playerState.sceneType],
          actionText: text,
          actionLabel: hit.label,
          checkLabel: game.pendingCheck?.label,
          naturalRoll: hit.naturalRoll,
          total: hit.total,
          dc: hit.dc,
          hit: hit.success,
          critical: hit.isCritical,
          heroHpBefore: actionState.character.hp,
          heroHpAfter: playerState.character.hp,
          enemyHpBefore: actionState.combat.enemyHp,
          enemyHpAfter: playerState.combat.enemyHp,
          enemyIntent: game.pendingCheck?.enemyIntent,
          nextPhase: playerState.combat.phase
        }),
        fallbackText: buildCombatFallbackText(isEscapeCheck ? "player_escape" : "player_check", {
          actorName: playerState.character.name,
          targetName: actionState.combat.enemy || playerState.combat.enemy || "对手",
          actionLabel: hit.label,
          hit: hit.success,
          critical: Boolean(hit.isCritical)
        })
      }
    ];

    if (enemyTurn) {
      narrationSteps.push({
        state: playerState,
        actionText: text,
        prompt: buildCombatNarrationPrompt(playerState, {
          stage: "enemy_turn_start",
          actorName: playerState.combat.enemy || "对手",
          targetName: playerState.character.name,
          round: playerState.combat.round || 1,
          locationName: currentLocationName(playerState),
          sceneLabel: combatSceneLabels[playerState.sceneType],
          actionText: text,
          actionLabel: enemyTurn.details.actionLabel,
          enemyIntent: game.pendingCheck?.enemyIntent,
          heroHpBefore: enemyTurn.details.heroHpBefore,
          heroHpAfter: enemyTurn.details.heroHpBefore,
          enemyHpBefore: enemyTurn.details.enemyHpBefore,
          enemyHpAfter: enemyTurn.details.enemyHpAfter,
          nextPhase: enemyTurn.details.nextPhase
        }),
        fallbackText: buildCombatFallbackText("enemy_turn_start", {
          actorName: playerState.character.name,
          targetName: playerState.combat.enemy || "对手",
          actionLabel: enemyTurn.details.actionLabel
        })
      });
      narrationSteps.push({
        state: finalState,
        actionText: text,
        prompt: buildCombatNarrationPrompt(finalState, {
          stage: "enemy_turn_end",
          actorName: finalState.combat.enemy || "对手",
          targetName: finalState.character.name,
          round: finalState.combat.round || 1,
          locationName: currentLocationName(finalState),
          sceneLabel: combatSceneLabels[finalState.sceneType],
          actionText: text,
          actionLabel: enemyTurn.details.actionLabel,
          naturalRoll: enemyTurn.details.naturalRoll,
          total: enemyTurn.details.total,
          hit: enemyTurn.details.hit,
          critical: enemyTurn.details.critical,
          damage: enemyTurn.details.damage,
          damageDice: enemyTurn.details.damageDice,
          damageBonus: enemyTurn.details.damageBonus,
          heroHpBefore: enemyTurn.details.heroHpBefore,
          heroHpAfter: enemyTurn.details.heroHpAfter,
          enemyHpBefore: enemyTurn.details.enemyHpBefore,
          enemyHpAfter: enemyTurn.details.enemyHpAfter,
          nextPhase: enemyTurn.details.nextPhase
        }),
        fallbackText: buildCombatFallbackText("enemy_turn_end", {
          actorName: finalState.character.name,
          targetName: finalState.combat.enemy || "对手",
          actionLabel: enemyTurn.details.actionLabel,
          hit: enemyTurn.details.hit,
          critical: enemyTurn.details.critical,
          damage: enemyTurn.details.damage
        })
      });
    }

    const narrationResults = await runCombatNarrationSequence(narrationSteps);
    const errorMessage = collectAiErrorMessage(narrationResults);

    setGame((prev) => {
      let patched = applyPatchToState(prev, withSceneFallback(localCombatResolution.patch, localCombatResolution.text, text));
      for (const result of narrationResults) {
        patched = applyPatchToState(patched, result.patch);
      }
      const outcome = applyFormalActionFollowups(actionState, patched, text, {
        skipTick: Boolean(patched.pendingDamage)
      });
      return {
        ...outcome.state,
        messages: [
          ...outcome.state.messages,
          ...combatSummaryMessages,
          ...outcome.messages,
          ...(errorMessage ? [{ id: uid("system"), role: "system" as const, text: errorMessage }] : []),
          ...narrationResults.map((result) => ({ id: uid("dm"), role: "dm" as const, text: result.text }))
        ]
      };
    });

    closePanels();
    setBusy(false);
  }

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
          messages: [...prev.messages, { id: uid("system"), role: "system", text: "导入失败，这份存档读取不出来。" }]
        }));
      }
    };
    reader.readAsText(file);
    event.target.value = "";
  }

  function skipTutorial() {
    if (!isTutorialGame(game)) return;

    lockUi(900);
    closePanels();
    setGame((prev) => {
      const patched = applyPatchToState(prev, buildNamelessTutorialCompletionPatch("skipped"));
      return {
        ...patched,
        messages: [...patched.messages, { id: uid("dm"), role: "dm" as const, text: buildNamelessTutorialTransitionText("skipped") }]
      };
    });
  }

  function beginTutorialCombat() {
    if (!isTutorialGame(game) || isTutorialCombatGame(game)) return;

    lockUi(900);
    closePanels();
    setGame((prev) => {
      if (!isTutorialGame(prev) || isTutorialCombatGame(prev)) return prev;

      const staged = applyPatchToState(prev, {
        chapterStateUpdate: {
          id: NAMELESS_WANDERER_CHAPTER_ID,
          stage: "tutorial_combat"
        },
        objectiveUpdate: buildNamelessTutorialObjective("initiative"),
        pendingCheck: undefined,
        pendingDamage: undefined
      });
      const combatState = applyPatchToState(staged, startCombat(staged, NAMELESS_WANDERER_TUTORIAL_ENEMY));
      return {
        ...combatState,
        messages: [
          ...combatState.messages,
          { id: uid("dm"), role: "dm" as const, text: buildNamelessTutorialCombatIntroText(prev.character.name) }
        ]
      };
    });
  }

  function startOriginGame() {
    const baseChoice = abilityChoices[0] || ([0, 0, 0, 0, 0, 0] as RollPackage);
    const hero = buildCharacterFromOrigin(customName, selectedOrigin, applyAllocation(baseChoice, abilityAllocation));

    lockUi(1400);
    closePanels();
    setGame(normalizeGameState({
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
    void submitAction(`前往【${name}】`);
  }

  function useItem(item: Item) {
    setGame((prev) => {
      const next = structuredClone(prev);
      const target = next.character.inventory.find((entry) => entry.id === item.id);
      if (!target) return prev;

      const hpBefore = next.character.hp;
      const qiBefore = next.character.qi;
      const innerBefore = next.innerInjury || 0;
      if (target.hpRestore) next.character.hp = clamp(next.character.hp + target.hpRestore, 0, next.character.maxHp);
      if (target.qiRestore) next.character.qi = clamp(next.character.qi + target.qiRestore, 0, next.character.maxQi);
      if (target.innerInjuryRestore) next.innerInjury = clamp((next.innerInjury || 0) - target.innerInjuryRestore, 0, 100);
      target.count -= 1;
      next.character.inventory = next.character.inventory.filter((entry) => entry.count > 0);
      next.systemLog.push(`使用：${item.name}`);
      const summary = [
        `【使用物品】${item.name}`,
        ...(next.character.hp !== hpBefore ? [`HP：${hpBefore} → ${next.character.hp}`] : []),
        ...(next.character.qi !== qiBefore ? [`Qi：${qiBefore} → ${next.character.qi}`] : []),
        ...((next.innerInjury || 0) !== innerBefore ? [`内伤：${innerBefore} → ${next.innerInjury || 0}`] : [])
      ].join("\n");
      next.messages.push({ id: uid("system"), role: "system", text: summary });
      return next;
    });
  }

  function studyManual(itemId: string) {
    if (uiLocked || rolling || busy) return;

    setGame((prev) => {
      const manual = prev.character.inventory.find((entry) => entry.id === itemId && entry.type === "manual");
      if (!manual?.manualArtId) return prev;

      const art = findArtTemplate(manual.manualArtId, manual.name.replace("秘笈", ""));
      if (!art) {
        return {
          ...prev,
          messages: [...prev.messages, { id: uid("system"), role: "system", text: "这本秘笈残缺得太厉害，暂时理不出可练的门路。" }]
        };
      }

      if (prev.character.martialArts.some((entry) => entry.id === art.id) || prev.pendingStudies.some((entry) => entry.artId === art.id)) {
        return {
          ...prev,
          messages: [...prev.messages, { id: uid("system"), role: "system", text: `${art.name} 已在你的掌握或研习之中，不必再重复研读。` }]
        };
      }

      const patched = applyPatchToState(prev, {
        itemChanges: [{ itemId: manual.id, delta: -1 }],
        studyAdd: [
          buildStudyEntryFromArt(
            art,
            manual.studySourceKind || "manual",
            {
              sourceLabel: manual.name,
              locationId: currentLocationId(prev),
              dangerous: manual.dangerous,
              requiredProgress: manual.requiredProgress,
              tier: manual.tier,
              routeKey: manual.routeKey,
              accessLevel: manual.accessLevel,
              hidden: manual.hidden,
              fortuneGate: manual.fortuneGate
            }
          )
        ]
      });

      return {
        ...patched,
        messages: [...patched.messages, { id: uid("system"), role: "system", text: `【研读秘笈】你把 ${manual.name} 中的门路拆开记下，${art.name} 已进入待掌握招式。` }]
      };
    });
  }

  function practicePendingArt(studyId: string) {
    if (uiLocked || rolling || busy) return;

    const study = game.pendingStudies.find((entry) => entry.id === studyId);
    if (!study) return;

    const abilityKey = study.category === "internal" ? "wis" : "int";
    const dc = study.category === "internal" ? 13 : 12;
    const mod = abilityModifier(abilityValue(game.character.abilities, abilityKey));
    const abilityLabel = game.character.abilities.find((entry) => entry.key === abilityKey)?.label || abilityKey.toUpperCase();

    lockUi(1800);
    beginRolling({
      label: `演练 ${study.name}`,
      notation: "1d20",
      diceGroups: buildDiceGroups("1d20"),
      animationKey: uid("roll"),
      resolution: {
        mode: "first",
        bonus: mod,
        bonusLabel: `${abilityLabel} ${mod >= 0 ? "+" : ""}${mod}`
      },
      settleMode: "engine"
    }, (result) => {
      const naturalRoll = result.resolvedValue;
      const total = result.total;
      const success = naturalRoll !== 1 && total >= dc;

      setGame((prev) => {
        const currentStudy = prev.pendingStudies.find((entry) => entry.id === studyId);
        if (!currentStudy) return prev;

        const actionState = advanceFormalState(prev);
        const art = findArtTemplate(currentStudy.artId, currentStudy.name);
        const nextProgress = Math.min(currentStudy.requiredProgress, currentStudy.progress + (success ? 1 : 0));
        const mastered = success && nextProgress >= currentStudy.requiredProgress;
        const margin = Math.max(0, dc - total);
        const riskyFailure = currentStudy.category === "internal" || Boolean(currentStudy.dangerous);
        const triggerInjury = riskyFailure
          && shouldTriggerInternalFailureInjury(naturalRoll, margin, 0.2, 0.5);
        const injuryDelta = triggerInjury ? resolveSelfStudyInjuryDelta(prev, "internal_study_failure") : 0;
        const qiPenalty = !success && riskyFailure ? -1 : 0;

        const patch: GamePatch = success
          ? mastered
            ? {
              martialArtLearned: art ? { ...art, name: art.name } : { id: currentStudy.artId, name: currentStudy.name },
              studyRemoveIds: [currentStudy.id]
            }
            : {
              studyUpdate: [{ id: currentStudy.id, progress: nextProgress, stage: "studying" }]
            }
          : {
            qiChange: qiPenalty,
            innerInjuryChange: injuryDelta || undefined
          };

        const patched = applyPatchToState(actionState, patch);
        const outcome = applyFormalActionFollowups(actionState, patched, `演练${currentStudy.name}`);
        const summaryLines = [
          `【演练】${currentStudy.name}`,
          `d20=${naturalRoll} · 总计 ${total} / DC ${dc}`,
          `结果：${success ? "成功" : "失败"}`,
          success
            ? mastered
              ? `你已正式掌握 ${currentStudy.name}。`
              : `进度 ${nextProgress}/${currentStudy.requiredProgress}`
            : riskyFailure
              ? `经脉负担偏重${injuryDelta ? `，内伤 +${injuryDelta}` : "，但这次侥幸没有伤到经脉"}。`
              : "这次只是白费工夫，还没伤到经脉。"
        ];

        return {
          ...outcome.state,
          messages: [...outcome.state.messages, ...outcome.messages, { id: uid("system"), role: "system", text: summaryLines.join("\n") }]
        };
      });
    });
    closePanels();
  }

  function practiceOnsiteSource(sourceId: string) {
    if (uiLocked || rolling || busy) return;

    const source = game.studySources.find((entry) => entry.id === sourceId);
    if (!source) return;
    if (source.locationId !== currentLocationId(game)) {
      pushSystemMessage("这里没有你刚才那处可参悟的遗刻，得回到对应地点才行。");
      return;
    }
    if ((source.cooldownUntilActionCount || 0) > game.actionCount || (source.requiresSceneRefresh && !source.refreshedSinceFailure)) {
      pushSystemMessage("你刚才已经试过一次，这处遗刻暂时还参不透，先去经历几步江湖动静再回来。");
      return;
    }

    const art = findArtTemplate(source.artId, source.name);
    if (!art) {
      pushSystemMessage("这处遗刻的门路还不完整，眼下无法继续参悟。");
      return;
    }

    const abilityKey = art.category === "internal" ? "wis" : "int";
    const dc = art.category === "internal" ? 13 : 12;
    const mod = abilityModifier(abilityValue(game.character.abilities, abilityKey));
    const abilityLabel = game.character.abilities.find((entry) => entry.key === abilityKey)?.label || abilityKey.toUpperCase();

    lockUi(1800);
    beginRolling({
      label: `参悟 ${art.name}`,
      notation: "1d20",
      diceGroups: buildDiceGroups("1d20"),
      animationKey: uid("roll"),
      resolution: {
        mode: "first",
        bonus: mod,
        bonusLabel: `${abilityLabel} ${mod >= 0 ? "+" : ""}${mod}`
      },
      settleMode: "engine"
    }, (result) => {
      const naturalRoll = result.resolvedValue;
      const total = result.total;
      const success = naturalRoll !== 1 && total >= dc;

      setGame((prev) => {
        const currentSource = prev.studySources.find((entry) => entry.id === sourceId);
        if (!currentSource) return prev;

        const actionState = advanceFormalState(prev);
        const currentStudy = prev.pendingStudies.find((entry) => entry.artId === currentSource.artId);
        const baseStudy = currentStudy || buildStudyEntryFromArt(
          art,
          "onsite",
          {
            sourceLabel: currentSource.sourceLabel || "现场参悟",
            locationId: currentSource.locationId,
            dangerous: currentSource.dangerous,
            requiredProgress: currentSource.requiredProgress,
            tier: currentSource.tier,
            routeKey: currentSource.routeKey,
            accessLevel: currentSource.accessLevel,
            hidden: currentSource.hidden,
            fortuneGate: currentSource.fortuneGate
          }
        );
        const nextProgress = Math.min(baseStudy.requiredProgress, baseStudy.progress + (success ? 1 : 0));
        const mastered = success && nextProgress >= baseStudy.requiredProgress;
        const margin = Math.max(0, dc - total);
        const riskyFailure = art.category === "internal" || Boolean(currentSource.dangerous);
        const triggerInjury = riskyFailure
          && shouldTriggerInternalFailureInjury(naturalRoll, margin, 0.2, 0.5);
        const injuryDelta = triggerInjury ? resolveSelfStudyInjuryDelta(prev, "internal_study_failure") : 0;
        const qiPenalty = !success && riskyFailure ? -1 : 0;

        const patch: GamePatch = success
          ? mastered
            ? {
              martialArtLearned: { ...art, name: art.name },
              ...(currentStudy ? { studyRemoveIds: [currentStudy.id] } : {})
            }
            : currentStudy
              ? { studyUpdate: [{ id: currentStudy.id, progress: nextProgress, stage: "studying" }] }
              : {
                studyAdd: [{ ...baseStudy, progress: nextProgress, stage: "studying" }]
              }
          : {
            qiChange: qiPenalty,
            innerInjuryChange: injuryDelta || undefined,
            studySourceUpdate: [{
              id: currentSource.id,
              cooldownUntilActionCount: actionState.actionCount + 2,
              requiresSceneRefresh: true,
              refreshedSinceFailure: false
            }]
          };

        const patched = applyPatchToState(actionState, patch);
        const outcome = applyFormalActionFollowups(actionState, patched, `参悟${art.name}`);
        const summaryLines = [
          `【现场参悟】${art.name}`,
          `d20=${naturalRoll} · 总计 ${total} / DC ${dc}`,
          `结果：${success ? "成功" : "失败"}`,
          success
            ? mastered
              ? `你已彻底悟通 ${art.name}。`
              : `进度 ${nextProgress}/${baseStudy.requiredProgress}`
            : riskyFailure
              ? `这次强行参悟过猛${injuryDelta ? `，内伤 +${injuryDelta}` : "，但还没真正伤到经脉"}。`
              : "这次只算白忙一场，得换个时机再来。"
        ];

        return {
          ...outcome.state,
          messages: [...outcome.state.messages, ...outcome.messages, { id: uid("system"), role: "system", text: summaryLines.join("\n") }]
        };
      });
    });
    closePanels();
  }

  function cultivateQi() {
    if (uiLocked || rolling || busy) return;

    const dc = 13;
    const mod = abilityModifier(abilityValue(game.character.abilities, "wis"));
    const abilityLabel = game.character.abilities.find((entry) => entry.key === "wis")?.label || "WIS";

    lockUi(1800);
    beginRolling({
      label: "内功修炼",
      notation: "1d20",
      diceGroups: buildDiceGroups("1d20"),
      animationKey: uid("roll"),
      resolution: {
        mode: "first",
        bonus: mod,
        bonusLabel: `${abilityLabel} ${mod >= 0 ? "+" : ""}${mod}`
      },
      settleMode: "engine"
    }, (result) => {
      const naturalRoll = result.resolvedValue;
      const total = result.total;
      const success = naturalRoll !== 1 && total >= dc;

      setGame((prev) => {
        const actionState = advanceFormalState(prev);
        const cap = Math.min(prev.qiBreakthroughCap, QI_GROWTH_HARD_CAP);
        const canGrow = prev.qiGrowthBonus < cap;
        const strongSuccess = total >= dc + 5;
        const gainedProgress = success && canGrow ? 1 : 0;
        const progressAfterGain = prev.qiTrainingProgress + gainedProgress;
        const growthGain = success && canGrow && progressAfterGain >= 3 ? 1 : 0;
        const progressDelta = growthGain ? -2 : gainedProgress;
        const margin = Math.max(0, dc - total);
        const triggerInjury = shouldTriggerInternalFailureInjury(naturalRoll, margin, 0.35, 0.7);
        const injuryDelta = !success && triggerInjury ? resolveSelfStudyInjuryDelta(prev, "cultivation_failure") : 0;
        const qiLoss = !success && (naturalRoll === 1 || margin >= 5) ? -1 : 0;

        const patch: GamePatch = success
          ? {
            qiRecovery: strongSuccess ? 2 : 1,
            qiTrainingProgressChange: progressDelta || undefined,
            qiGrowthBonusChange: growthGain || undefined
          }
          : {
            qiChange: qiLoss || undefined,
            innerInjuryChange: injuryDelta || undefined
          };

        const patched = applyPatchToState(actionState, patch);
        const outcome = applyFormalActionFollowups(actionState, patched, "练功修炼");
        const summaryLines = [
          "【内功修炼】",
          `d20=${naturalRoll} · 总计 ${total} / DC ${dc}`,
          `结果：${success ? "成功" : "失败"}`,
          success
            ? growthGain
              ? `Qi 上限成长 +1，当前成长 ${patched.qiGrowthBonus}/${patched.qiBreakthroughCap}。`
              : canGrow
                ? `修炼进度 ${patched.qiTrainingProgress}/3，当前成长 ${patched.qiGrowthBonus}/${patched.qiBreakthroughCap}。`
                : `当前境界上限已满，先去寻突破契机。`
            : injuryDelta
              ? `行功岔气，内伤 +${injuryDelta}。`
              : "这次没能把气机转顺。"
        ];

        return {
          ...outcome.state,
          messages: [...outcome.state.messages, ...outcome.messages, { id: uid("system"), role: "system", text: summaryLines.join("\n") }]
        };
      });
    });
    closePanels();
  }

  function meditateRecovery() {
    if (uiLocked || rolling || busy) return;

    const dc = 11;
    const mod = abilityModifier(abilityValue(game.character.abilities, "wis"));
    const abilityLabel = game.character.abilities.find((entry) => entry.key === "wis")?.label || "WIS";

    lockUi(1800);
    beginRolling({
      label: "调息疗伤",
      notation: "1d20",
      diceGroups: buildDiceGroups("1d20"),
      animationKey: uid("roll"),
      resolution: {
        mode: "first",
        bonus: mod,
        bonusLabel: `${abilityLabel} ${mod >= 0 ? "+" : ""}${mod}`
      },
      settleMode: "engine"
    }, (result) => {
      const naturalRoll = result.resolvedValue;
      const total = result.total;
      const success = naturalRoll !== 1 && total >= dc;

      setGame((prev) => {
        const actionState = advanceFormalState(prev);
        const strongSuccess = total >= dc + 5;
        const patch: GamePatch = success
          ? {
            qiRecovery: strongSuccess ? 2 : 1,
            innerInjuryChange: strongSuccess ? -12 : -8
          }
          : {
            qiRecovery: 1
          };

        const patched = applyPatchToState(actionState, patch);
        const outcome = applyFormalActionFollowups(actionState, patched, "调息");
        const summaryLines = [
          "【调息疗伤】",
          `d20=${naturalRoll} · 总计 ${total} / DC ${dc}`,
          `结果：${success ? "成功" : "失败"}`,
          success
            ? `内伤缓和，当前内伤 ${patched.innerInjury || 0}。`
            : "这次只是勉强稳住了气息。"
        ];

        return {
          ...outcome.state,
          messages: [...outcome.state.messages, ...outcome.messages, { id: uid("system"), role: "system", text: summaryLines.join("\n") }]
        };
      });
    });
    closePanels();
  }

  function claimAttributeInsight(abilityKey: string) {
    if (uiLocked || rolling || busy) return;

    setGame((prev) => {
      const insight = prev.availableAttributeInsights.find((entry) => entry.choices.includes(abilityKey));
      const ability = prev.character.abilities.find((entry) => entry.key === abilityKey);
      if (!insight || !ability || ability.value >= 17) return prev;

      const patched = applyPatchToState(prev, {
        abilityChanges: {
          [abilityKey]: Math.min(17, ability.value + 1)
        },
        attributeInsightRemoveIds: [insight.id]
      });

      return {
        ...patched,
        messages: [...patched.messages, { id: uid("system"), role: "system", text: `【心得融会】你把这次领悟落到了 ${ability.label} 上，数值提升为 ${Math.min(17, ability.value + 1)}。` }]
      };
    });
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
    const hasActivePrompt = Boolean(check);
    const combatInitiativeRoll = game.combat.active && game.combat.phase === "opening";
    const combatEscape = isEscapePendingCheck(check);
    const combatAttack = game.combat.active && game.combat.phase === "awaiting_hit_check" && !combatEscape;
    const qiBonusSpend = game.combat.active ? 0 : clamp(options.qiBonusSpend ?? qiInvest, 0, game.character.qi);
    const qiBonus = qiInvestBonus(qiBonusSpend);
    const effectiveRollMode = resolvePendingRollMode(check);
    const notation = effectiveRollMode === "normal" ? "1d20" : "2d20";
    const resolutionMode = effectiveRollMode === "advantage"
      ? "highest"
      : effectiveRollMode === "disadvantage"
        ? "lowest"
        : "first";
    const bonus = mod + qiBonus;
    const bonusLabel = [
      `加值 ${mod >= 0 ? "+" : ""}${mod}`,
      ...(!game.combat.active ? [`内力 +${qiBonus}`] : [])
    ].join(" · ");

    lockUi(1800);
    beginRolling({
      label,
      notation,
      diceGroups: buildDiceGroups(notation),
      animationKey: uid("roll"),
      resolution: {
        mode: resolutionMode,
        bonus,
        bonusLabel
      },
      settleMode: "engine"
    }, (result) => {
      const picked = result.resolvedValue;
      const total = result.total;
      const isCritical = combatAttack && picked === 20;
      const isAutoFail = Boolean(check) && picked === 1;
      const success = check
        ? (isAutoFail ? false : (isCritical ? true : total >= check.dc))
        : undefined;
      const modeText = formatRollModeText(effectiveRollMode, result.faceResults, picked);
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
        ...(combatAttack ? ["阶段：攻击"] : []),
        ...(combatEscape ? ["阶段：逃跑"] : [])
      ];

      if (sendToDm) {
        if (check && success && options.martialArt && combatAttack) {
          void queuePendingDamage(outputLines.join("\n"), options.martialArt, qiBonusSpend, isCritical);
          return;
        }
        void submitDiceResult(outputLines.join("\n"), qiBonusSpend);
        return;
      }

      if (!hasActivePrompt) return;
    });
    setQiInvest(0);
    closePanels();
  }

  function rollDamageDice(pendingDamage: PendingDamage) {
    if (rolling || busy) return;

    const actualDamageDice = pendingDamage.isCritical ? doubleDamageDice(pendingDamage.damageDice) : pendingDamage.damageDice;
    const bonus = pendingDamage.damageBonus || 0;

    lockUi(1800);
    beginRolling({
      label: `${pendingDamage.label}伤害`,
      notation: actualDamageDice,
      diceGroups: buildDiceGroups(actualDamageDice),
      animationKey: uid("roll"),
      resolution: {
        mode: "sum",
        bonus,
        bonusLabel: bonus ? `伤害加值 +${bonus}` : undefined
      },
      settleMode: "engine"
    }, (result) => {
      const rolls = result.faceResults;
      const damageText = `【伤害】${pendingDamage.label} ${actualDamageDice} => [${rolls.join(" + ")}]${bonus ? ` + ${bonus}` : ""} = ${result.total}${pendingDamage.isCritical ? "\n暴击：是" : ""}`;
      void submitDamageResult(damageText, pendingDamage);
    });
    closePanels();
  }

  return {
    game,
    setGame,
    api,
    setApi,
    customName,
    setCustomName,
    selectedOriginId,
    setSelectedOriginId,
    abilityChoices,
    setAbilityChoices,
    selectedChoiceIndex,
    setSelectedChoiceIndex,
    abilityAllocation,
    setAbilityAllocation,
    drawerOpen,
    setDrawerOpen,
    activeTab,
    setActiveTab,
    input,
    setInput,
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
    setApiTest,
    musicEnabled,
    setMusicEnabled,
    bgmVolume,
    setBgmVolume,
    sfxEnabled,
    setSfxEnabled,
    sfxVolume,
    setSfxVolume,
    uiLocked,
    setUiLocked,
    endRef,
    fileInputRef,
    audioRef,
    fadeTimerRef,
    uiLockTimerRef,
    canContinue,
    closePanels,
    tryPlayMusic,
    lockUi,
    completeRolling,
    applyDeepSeekPreset,
    toggleMusic,
    toggleSfx,
    runApiTest,
    continueGame,
    exportSave,
    resetGame,
    beginTutorialCombat,
    skipTutorial,
    selectedOrigin,
    startOriginGame,
    openDrawer,
    openPendingCheck,
    toggleDice,
    switchScene,
    travelToLocation,
    useItem,
    studyManual,
    practicePendingArt,
    practiceOnsiteSource,
    cultivateQi,
    meditateRecovery,
    claimAttributeInsight,
    rollDice,
    rollDamageDice,
    submitAction,
    submitDiceResult,
    submitDamageResult,
    queuePendingDamage,
    importSave
  };
}

export type GameSession = ReturnType<typeof useGameSession>;
