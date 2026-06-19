import { ChangeEvent, useEffect, useRef, useState } from "react";
import {
  aiProposalsToLocalPatch,
  filterAiCombatPatch,
  inferSceneType,
  readApiErrorSummary,
  resolveApiEndpoint,
  splitAiPayload,
  stripJsonBlock,
  withSceneFallback
} from "../game/ai/helpers";
import { buildCombatActionCheckPrompt, buildCombatNarrationPrompt, buildSystemPrompt } from "../game/ai/prompt";
import { doubleDamageDice, parseDamageDice, prepareCombatDamageRoll, startCombat } from "../game/combat";
import { applyPatchToState, normalizeGameState } from "../game/engine";
import { localDm } from "../game/localdm";
import { parseCombatDamageResult, parseCombatHitResult } from "../game/world/helpers";
import { initialGameState, originTemplates } from "../data";
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
  RollMode,
  SceneType
} from "../types";
import type { ApiTestState, RollPackage, RollingState } from "./sessionTypes";
import {
  API_KEY,
  applyAllocation,
  BGM_KEY,
  BGM_VOLUME_KEY,
  EMPTY_ROLL_PACKAGE,
  PLAYABLE_ORIGIN_ID,
  SAVE_KEY,
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
  stage: "player_check" | "player_hit_confirmed" | "player_damage" | "enemy_turn_start" | "enemy_turn_end",
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

function mergeCombatActionCheck(
  current: GameState["pendingCheck"],
  fallback: GamePatch["pendingCheck"] | undefined,
  proposed: AiProposalPayload["proposedCheck"] | undefined
): GamePatch["pendingCheck"] | undefined {
  if (!current) return fallback;
  if (!fallback && !proposed) return undefined;

  return {
    label: proposed?.label || fallback?.label || current.label,
    abilityKey: proposed?.abilityKey || fallback?.abilityKey || current.abilityKey,
    martialArtId: proposed?.martialArtId || fallback?.martialArtId || current.martialArtId,
    rollMode: proposed?.rollMode || fallback?.rollMode || current.rollMode,
    dc: proposed?.dc ?? fallback?.dc ?? current.dc,
    reason: proposed?.reason || fallback?.reason || current.reason,
    risk: proposed?.risk || fallback?.risk || current.risk,
    enemyIntent: proposed?.enemyIntent || fallback?.enemyIntent || current.enemyIntent,
    suggestedAction: proposed?.suggestedAction || fallback?.suggestedAction || current.suggestedAction
  };
}

function resolvePendingRollMode(check?: PendingCheck) {
  return check?.rollMode || "normal";
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
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [game.messages, busy]);

  function closePanels() {
    setDrawerOpen(false);
    setDiceOpen(false);
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
    if (game.pendingDamage) return;

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

    setGame(baseGame);
    const localCombatResolution = localDm(text, baseGame, globalUpdateDue);

    if (
      baseGame.combat.active &&
      baseGame.pendingCheck &&
      !baseGame.pendingDamage &&
      localCombatResolution.result.textOverride &&
      !localCombatResolution.result.combatFlow
    ) {
      try {
        const aiResult = await callAi(
          baseGame,
          text,
          buildCombatActionCheckPrompt(baseGame, text),
          localCombatResolution.text
        );
        const mergedPendingCheck = mergeCombatActionCheck(
          baseGame.pendingCheck,
          localCombatResolution.patch.pendingCheck,
          aiResult.proposals.proposedCheck
        );
        const patchedCombatPrompt: GamePatch = {
          ...localCombatResolution.patch,
          pendingCheck: mergedPendingCheck,
          ...filterAiCombatPatch(aiResult.patch)
        };

        setGame((prev) => {
          const patched = applyPatchToState(prev, withSceneFallback(patchedCombatPrompt, aiResult.text, text));
          return {
            ...patched,
            messages: [...patched.messages, { id: uid("dm"), role: "dm", text: aiResult.text }]
          };
        });
      } catch (error) {
        setGame((prev) => {
          const patched = applyPatchToState(prev, withSceneFallback(localCombatResolution.patch, localCombatResolution.text, text));
          return {
            ...patched,
            messages: [
              ...patched.messages,
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

    try {
      const aiPrompt = baseGame.combat.active
        ? "Combat state is authoritative local. Write short Jin Yong-inspired wuxia narration about pressure, movement, gaze, footing, and atmosphere. Do not alter combat results or state."
        : globalUpdateDue
          ? "Advance the broader world a little in the narration."
          : undefined;
      const aiResult = await callAi(baseGame, text, aiPrompt);
      setGame((prev) => {
        const combatPatched = applyPatchToState(prev, withSceneFallback(localCombatResolution.patch, localCombatResolution.text, text));
        const aiProposalPatch = baseGame.combat.active ? {} : aiProposalsToLocalPatch(combatPatched, aiResult.proposals);
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
        const patched = applyPatchToState(prev, withSceneFallback(localCombatResolution.patch, localCombatResolution.text, text));
        return {
          ...patched,
          messages: [
            ...patched.messages,
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

    const tutorialMode = isTutorialGame(game);
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
      text: `命中已确认，请掷 ${art.name} 的伤害骰：${art.damageDice}${art.damageBonus ? ` +${art.damageBonus}` : ""}`
    };

    tryPlayMusic();
    closePanels();

    setGame({
      ...stagedState,
      messages: [
        ...stagedState.messages,
        ...(tutorialMode
          ? [{ id: uid("dm"), role: "dm" as const, text: `这一招已经打中了。下一步别急着说别的，先掷 ${art.name} 的伤害骰，把这一下真正打实。` }]
          : []),
        systemMessage
      ]
    });

    if (tutorialMode || !stagedState.pendingDamage) return;

    setBusy(true);
    try {
      const hit = parseCombatHitResult(hitText);
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
      return {
        ...patched,
        messages: [
          ...patched.messages,
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
          return {
            ...patched,
            messages: [...patched.messages, { id: uid("dm"), role: "dm", text: aiResult.text }]
          };
        });
      } catch (error) {
        setGame((prev) => {
          const patched = applyPatchToState(prev, withSceneFallback(localCombatResolution.patch, localCombatResolution.text, text));
          return {
            ...patched,
            messages: [
              ...patched.messages,
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
    const finalState = applyPatchToState(actionState, withSceneFallback(localCombatResolution.patch, localCombatResolution.text, text));
    const playerState = localCombatResolution.result.combatFlow?.playerPatch
      ? applyPatchToState(actionState, withSceneFallback(localCombatResolution.result.combatFlow.playerPatch, localCombatResolution.text, text))
      : finalState;
    const enemyTurn = localCombatResolution.result.combatFlow?.enemyTurn;
    const narrationSteps: CombatAiStep[] = [
      {
        state: playerState,
        actionText: text,
        prompt: buildCombatNarrationPrompt(playerState, {
          stage: "player_check",
          actorName: playerState.character.name,
          targetName: playerState.combat.enemy || "对手",
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
        fallbackText: buildCombatFallbackText("player_check", {
          actorName: playerState.character.name,
          targetName: playerState.combat.enemy || "对手",
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
      return {
        ...patched,
        messages: [
          ...patched.messages,
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
    setRollMode(resolvePendingRollMode(game.pendingCheck));
    setDiceOpen(true);
  }

  function toggleDice() {
    if (uiLocked || rolling || busy) return;
    setDrawerOpen(false);
    if (!diceOpen) {
      setRollMode(resolvePendingRollMode(game.pendingCheck));
    }
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

      if (target.hpRestore) next.character.hp = clamp(next.character.hp + target.hpRestore, 0, next.character.maxHp);
      if (target.qiRestore) next.character.qi = clamp(next.character.qi + target.qiRestore, 0, next.character.maxQi);
      target.count -= 1;
      next.character.inventory = next.character.inventory.filter((entry) => entry.count > 0);
      next.systemLog.push(`使用：${item.name}`);
      return next;
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
          void queuePendingDamage(outputLines.join("\n"), options.martialArt, qiBonusSpend, isCritical);
          return;
        }
        void submitDiceResult(outputLines.join("\n"), qiBonusSpend);
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
      void submitDamageResult(damageText, pendingDamage);
    }, 1180);
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
    setApiTest,
    musicEnabled,
    setMusicEnabled,
    bgmVolume,
    setBgmVolume,
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
    applyDeepSeekPreset,
    toggleMusic,
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
