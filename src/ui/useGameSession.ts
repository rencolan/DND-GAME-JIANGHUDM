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
import { buildCombatActionIntentPrompt, buildCombatNarrationPrompt, buildSystemPrompt } from "../game/ai/prompt";
import { prepareCombatDamageRoll, startCombat } from "../game/combat";
import { applyPatchToState, normalizeGameState } from "../game/engine";
import { localDm } from "../game/localdm";
import { parseCombatDamageResult, parseCombatHitResult } from "../game/world/helpers";
import { initialGameState } from "../data";
import {
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
  MartialArt,
  Message,
  PendingDamage,
  RollMode
} from "../types";
import type { ApiTestState, RollPackage, RollingState } from "./sessionTypes";
import {
  API_KEY,
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
    dc: proposed?.dc ?? fallback?.dc ?? current.dc,
    reason: proposed?.reason || fallback?.reason || current.reason,
    risk: proposed?.risk || fallback?.risk || current.risk,
    enemyIntent: proposed?.enemyIntent || fallback?.enemyIntent || current.enemyIntent,
    suggestedAction: proposed?.suggestedAction || fallback?.suggestedAction || current.suggestedAction
  };
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

export function useGameSession() {
  const savedGame = readJson<GameState>(SAVE_KEY, initialGameState);
  const initialApi = readJson<ApiConfig>(API_KEY, defaultApiConfig("openai"));

  const [game, setGame] = useState<GameState>(() => normalizeGameState(savedGame));
  const [api, setApi] = useState<ApiConfig>(() => normalizeApiConfig(initialApi));
  const [customName, setCustomName] = useState("鏃犲悕瀹?");
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
          buildCombatActionIntentPrompt(baseGame, text),
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
    submitAction,
    submitDiceResult,
    submitDamageResult,
    queuePendingDamage,
    importSave
  };
}

export type GameSession = ReturnType<typeof useGameSession>;
