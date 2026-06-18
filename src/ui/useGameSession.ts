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
import { buildSystemPrompt } from "../game/ai/prompt";
import { prepareCombatDamageRoll } from "../game/combat";
import { applyPatchToState, normalizeGameState } from "../game/engine";
import { localDm } from "../game/localdm";
import { initialGameState } from "../data";
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

function uid(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
}

export function useGameSession() {
  const savedGame = readJson<GameState>(SAVE_KEY, initialGameState);
  const initialApi = readJson<ApiConfig>(API_KEY, defaultApiConfig("openai"));

  const [game, setGame] = useState<GameState>(() => normalizeGameState(savedGame));
  const [api, setApi] = useState<ApiConfig>(() => normalizeApiConfig(initialApi));
  const [customName, setCustomName] = useState("鏃犲悕瀹?");
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
    setAbilityChoices(makeAbilityChoices());
    setSelectedChoiceIndex(0);
    setSelectedInventoryMartialId(undefined);
    setSelectedAbilityInfoKey(undefined);
    setGame(normalizeGameState(structuredClone(initialGameState)));
  }

  async function callAi(updatedGame: GameState, playerAction: string, customPrompt?: string): Promise<AiCallResult> {
    const globalUpdateDue = updatedGame.actionCount % WORLD_STEP === 0;
    const fallbackNarration = localDm(playerAction, updatedGame, globalUpdateDue).text;

    if (!api.apiUrl || !api.apiKey || !api.model) {
      return {
        text: fallbackNarration,
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
      text: visibleText || fallbackNarration,
      patch,
      proposals
    };
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

    try {
      const aiPrompt = baseGame.combat.active
        ? "Combat resolution is local. Only provide narration, pressure, and enemy intent."
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

  function queuePendingDamage(hitText: string, art: MartialArt, qiBonusSpend: number, isCritical = false) {
    const pendingDamagePatch = prepareCombatDamageRoll(art, hitText, qiBonusSpend, isCritical);

    setGame((prev) => {
      const patched = applyPatchToState(prev, pendingDamagePatch);
      if (!patched.pendingDamage) return prev;
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
    if (busy) return;

    tryPlayMusic();
    setBusy(true);
    closePanels();

    const combinedText = `${pendingDamage.hitText}\n${text}`;
    const diceMessage: Message = { id: uid("dice"), role: "dice", text: combinedText };
    const nextTime = advanceTime(game);
    const baseGame: GameState = {
      ...game,
      pendingCheck: undefined,
      combat: game.combat.active
        ? { ...game.combat, phase: "resolving_enemy_response" }
        : game.combat,
      character: {
        ...game.character,
        qi: clamp(game.character.qi - pendingDamage.qiCost, 0, game.character.maxQi)
      },
      actionCount: game.actionCount + 1,
      ...nextTime,
      messages: [...game.messages, diceMessage]
    };
    const globalUpdateDue = baseGame.actionCount % WORLD_STEP === 0;

    setGame(baseGame);
    const localCombatResolution = localDm(combinedText, baseGame, globalUpdateDue);

    try {
      const aiPrompt = baseGame.combat.active
        ? "Combat resolution is local. Only provide narration, pressure, and enemy intent."
        : globalUpdateDue
          ? "Advance the broader world a little in the narration."
          : undefined;
      const aiResult = await callAi(baseGame, combinedText, aiPrompt);
      setGame((prev) => {
        const combatPatched = applyPatchToState(prev, withSceneFallback(localCombatResolution.patch, localCombatResolution.text, combinedText));
        const aiProposalPatch = baseGame.combat.active ? {} : aiProposalsToLocalPatch(combatPatched, aiResult.proposals);
        const patched = applyPatchToState(
          combatPatched,
          baseGame.combat.active
            ? filterAiCombatPatch(aiResult.patch)
            : withSceneFallback({ ...aiResult.patch, ...aiProposalPatch }, aiResult.text, combinedText)
        );
        return {
          ...patched,
          messages: [...patched.messages, { id: uid("dm"), role: "dm", text: aiResult.text }]
        };
      });
    } catch (error) {
      setGame((prev) => {
        const patched = applyPatchToState(prev, withSceneFallback(localCombatResolution.patch, localCombatResolution.text, combinedText));
        return {
          ...patched,
          messages: [
            ...patched.messages,
            { id: uid("system"), role: "system", text: `API 璋冪敤澶辫触锛屽凡鍒囧洖鏈湴涓绘寔锛?{error instanceof Error ? error.message : ""}` },
            { id: uid("dm"), role: "dm", text: localCombatResolution.text }
          ]
        };
      });
    } finally {
      closePanels();
      setBusy(false);
    }
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
    const globalUpdateDue = baseGame.actionCount % WORLD_STEP === 0;

    setGame(baseGame);
    const localCombatResolution = localDm(text, baseGame, globalUpdateDue);

    try {
      const aiPrompt = baseGame.combat.active
        ? "Combat resolution is local. Only provide narration, pressure, and enemy intent."
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
          pendingCheck: undefined,
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
    submitAction,
    submitDiceResult,
    submitDamageResult,
    queuePendingDamage,
    importSave
  };
}

export type GameSession = ReturnType<typeof useGameSession>;
