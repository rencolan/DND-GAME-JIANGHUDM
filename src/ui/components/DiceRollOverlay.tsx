import { useEffect, useMemo, useRef, useState } from "react";
import type DiceBox from "@3d-dice/dice-box";
import "@3d-dice/dice-box/dist/style.css";
import type { DiceGroup, RollingResult, RollingState } from "../sessionTypes";

type DiceRollOverlayProps = {
  rolling: RollingState | null;
  onComplete: (result: RollingResult) => void;
  sfxEnabled: boolean;
  sfxVolume: number;
};

type OverlayMode =
  | "idle"
  | "loading"
  | "rolling"
  | "revealed"
  | "fallbackRolling"
  | "fallbackRevealed";

type DiceBoxRollEntry = {
  value?: number | string;
  rolls?: Array<{ value?: number | string }>;
};

const DICE_THEME = "default";
const DICE_THEME_COLOR = "#c6923d";
const REVEAL_LINGER_MS = 1100;
const FALLBACK_ROLL_MS = 900;
const ENGINE_TIMEOUT_MS = 4500;
const ROLL_SFX_SRC = "/assets/sfx/dice-roll.wav";
const IMPACT_SFX_SRC = "/assets/sfx/dice-stop.wav";
const DICE_BOX_CONTAINER_ID = "dice-box-overlay-stage";

function formatFaceResults(faceResults: number[]) {
  return faceResults.join(" / ");
}

function resolveRollValue(faceResults: number[], mode: RollingState["resolution"]["mode"]) {
  if (!faceResults.length) return 0;

  switch (mode) {
    case "sum":
      return faceResults.reduce((sum, value) => sum + value, 0);
    case "highest":
      return Math.max(...faceResults);
    case "lowest":
      return Math.min(...faceResults);
    default:
      return faceResults[0];
  }
}

function randomFaceResults(diceGroups: DiceGroup[]) {
  return diceGroups.flatMap((group) =>
    Array.from({ length: group.qty }, () => Math.max(1, Math.ceil(Math.random() * Math.max(1, group.sides))))
  );
}

function toNumber(value: number | string | undefined) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function extractFaceResults(results: unknown) {
  if (!Array.isArray(results)) return [];

  return results.flatMap((entry) => {
    if (!entry || typeof entry !== "object") return [];

    const rollEntry = entry as DiceBoxRollEntry;
    if (Array.isArray(rollEntry.rolls)) {
      return rollEntry.rolls
        .map((roll) => toNumber(roll.value))
        .filter((value): value is number => typeof value === "number");
    }

    const directValue = toNumber(rollEntry.value);
    return typeof directValue === "number" ? [directValue] : [];
  });
}

function buildRollingResult(rolling: RollingState, faceResults: number[], fallback: boolean): RollingResult {
  const diceTotal = faceResults.reduce((sum, value) => sum + value, 0);
  const resolvedValue = resolveRollValue(faceResults, rolling.resolution.mode);
  const total = resolvedValue + (rolling.resolution.bonus || 0);

  return {
    notation: rolling.notation,
    diceGroups: rolling.diceGroups,
    faceResults,
    diceTotal,
    resolvedValue,
    total,
    fallback
  };
}

function describeRollingResult(rolling: RollingState, result: RollingResult) {
  const base = rolling.resolution.mode === "highest"
    ? `优势判定 · 取 ${result.resolvedValue}`
    : rolling.resolution.mode === "lowest"
      ? `劣势判定 · 取 ${result.resolvedValue}`
      : rolling.resolution.mode === "sum"
        ? `${rolling.notation.toUpperCase()} · 骰值合计 ${result.diceTotal}`
        : `常规判定 · 取 ${result.resolvedValue}`;

  return rolling.resolution.bonusLabel ? `${base} · ${rolling.resolution.bonusLabel}` : base;
}

export function DiceRollOverlay({ rolling, onComplete, sfxEnabled, sfxVolume }: DiceRollOverlayProps) {
  const diceBoxRef = useRef<DiceBox | null>(null);
  const initPromiseRef = useRef<Promise<void> | null>(null);
  const stageTimerRef = useRef<number | null>(null);
  const timeoutTimerRef = useRef<number | null>(null);
  const rollAudioRef = useRef<HTMLAudioElement | null>(null);
  const impactAudioRef = useRef<HTMLAudioElement | null>(null);
  const settledRef = useRef(false);
  const onCompleteRef = useRef(onComplete);
  const [mode, setMode] = useState<OverlayMode>("idle");
  const [revealedResult, setRevealedResult] = useState<RollingResult | null>(null);

  const faceSummary = useMemo(
    () => (revealedResult ? formatFaceResults(revealedResult.faceResults) : null),
    [revealedResult]
  );
  const detailText = useMemo(
    () => (rolling && revealedResult ? describeRollingResult(rolling, revealedResult) : null),
    [revealedResult, rolling]
  );

  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  useEffect(() => {
    return () => {
      if (stageTimerRef.current !== null) {
        window.clearTimeout(stageTimerRef.current);
      }
      if (timeoutTimerRef.current !== null) {
        window.clearTimeout(timeoutTimerRef.current);
      }
    };
  }, []);

  function ensureSfx() {
    if (!rollAudioRef.current) {
      rollAudioRef.current = new Audio(ROLL_SFX_SRC);
      rollAudioRef.current.preload = "auto";
    }
    if (!impactAudioRef.current) {
      impactAudioRef.current = new Audio(IMPACT_SFX_SRC);
      impactAudioRef.current.preload = "auto";
    }
  }

  async function playSound(kind: "roll" | "impact") {
    if (!sfxEnabled || sfxVolume <= 0) return;

    ensureSfx();
    const audio = kind === "roll" ? rollAudioRef.current : impactAudioRef.current;
    if (!audio) return;

    audio.currentTime = 0;
    audio.volume = Math.max(0, Math.min(1, sfxVolume / 100));

    try {
      await audio.play();
    } catch {
      return;
    }
  }

  useEffect(() => {
    if (!rolling) {
      settledRef.current = false;
      setRevealedResult(null);
      setMode("idle");
      return;
    }

    let cancelled = false;

    const clearTimers = () => {
      if (stageTimerRef.current !== null) {
        window.clearTimeout(stageTimerRef.current);
        stageTimerRef.current = null;
      }
      if (timeoutTimerRef.current !== null) {
        window.clearTimeout(timeoutTimerRef.current);
        timeoutTimerRef.current = null;
      }
    };

    const finish = (result: RollingResult) => {
      if (cancelled || settledRef.current) return;
      settledRef.current = true;
      clearTimers();
      onCompleteRef.current(result);
    };

    const reveal = (result: RollingResult, nextMode: "revealed" | "fallbackRevealed") => {
      if (cancelled || settledRef.current) return;
      setRevealedResult(result);
      setMode(nextMode);
      void playSound("impact");
      stageTimerRef.current = window.setTimeout(() => {
        finish(result);
      }, REVEAL_LINGER_MS);
    };

    const startFallback = () => {
      if (cancelled || settledRef.current) return;
      clearTimers();
      setMode("fallbackRolling");
      void playSound("roll");
      stageTimerRef.current = window.setTimeout(() => {
        if (cancelled || settledRef.current) return;
        const fallbackResult = buildRollingResult(rolling, randomFaceResults(rolling.diceGroups), true);
        reveal(fallbackResult, "fallbackRevealed");
      }, FALLBACK_ROLL_MS);
    };

    const ensureDiceBox = async () => {
      if (diceBoxRef.current) return diceBoxRef.current;

      if (!initPromiseRef.current) {
        initPromiseRef.current = (async () => {
          const module = await import("@3d-dice/dice-box");
          const DiceBoxClass = module.default;
          const instance = new DiceBoxClass({
            container: `#${DICE_BOX_CONTAINER_ID}`,
            assetPath: "/assets/",
            theme: DICE_THEME,
            themeColor: DICE_THEME_COLOR,
            scale: 6.4,
            lightIntensity: 1.15,
            enableShadows: true,
            offscreen: false
          });
          diceBoxRef.current = instance;
          await instance.init();
        })().catch((error) => {
          diceBoxRef.current = null;
          initPromiseRef.current = null;
          throw error;
        });
      }

      await initPromiseRef.current;
      if (!diceBoxRef.current) throw new Error("Dice Box did not initialize.");
      return diceBoxRef.current;
    };

    settledRef.current = false;
    setRevealedResult(null);
    setMode("loading");

    void (async () => {
      try {
        const diceBox = await ensureDiceBox();
        if (cancelled) return;

        setMode("rolling");
        void playSound("roll");
        timeoutTimerRef.current = window.setTimeout(() => {
          startFallback();
        }, ENGINE_TIMEOUT_MS);

        const engineResults = await diceBox.roll(rolling.notation, {
          theme: DICE_THEME,
          themeColor: DICE_THEME_COLOR,
          newStartPoint: true
        });

        if (cancelled || settledRef.current) return;
        if (timeoutTimerRef.current !== null) {
          window.clearTimeout(timeoutTimerRef.current);
          timeoutTimerRef.current = null;
        }

        const faceResults = extractFaceResults(engineResults);
        if (!faceResults.length) {
          throw new Error("Dice Box returned no face values.");
        }

        reveal(buildRollingResult(rolling, faceResults, false), "revealed");
      } catch (error) {
        console.error("3D dice overlay failed, using numeric fallback.", error);
        startFallback();
      }
    })();

    return () => {
      cancelled = true;
      clearTimers();
    };
  }, [rolling, sfxEnabled, sfxVolume]);

  const showEngine = Boolean(rolling) && (mode === "rolling" || mode === "revealed");
  const showStageLoading = Boolean(rolling) && mode === "loading";
  const showFallbackSpinner = Boolean(rolling) && mode === "fallbackRolling";
  const showResult = Boolean(rolling) && (mode === "revealed" || mode === "fallbackRevealed");
  const showRollingHint = Boolean(rolling) && (mode === "rolling" || mode === "fallbackRolling");
  const showFallbackResult = Boolean(rolling) && mode === "fallbackRevealed" && revealedResult;

  return (
    <section className={`roll-overlay ${rolling ? "visible" : "hidden"}`} aria-hidden={!rolling}>
      <div className="roll-overlay-card">
        <div className="roll-overlay-stage">
          <div
            id={DICE_BOX_CONTAINER_ID}
            className={`roll-engine-canvas ${showEngine ? "active" : ""}`}
            aria-hidden={!showEngine}
          />

          {showStageLoading && <div className="roll-overlay-loading">ROLLING</div>}

          {showRollingHint && (
            <div className="roll-overlay-status">
              <span>骰子滚动中</span>
            </div>
          )}

          {showFallbackSpinner && (
            <div className="roll-fallback-card" aria-label="dice fallback rolling">
              <span>ROLLING</span>
              <i aria-hidden="true" />
            </div>
          )}

          {showFallbackResult && (
            <div className="roll-fallback-card result" aria-label={`${revealedResult.notation} numeric result`}>
              <span>{revealedResult.notation.toUpperCase()}</span>
              {faceSummary && <strong>{faceSummary}</strong>}
              <b>{revealedResult.total}</b>
            </div>
          )}
        </div>

        {rolling && (
          <div className={`roll-overlay-copy ${showResult ? "revealed" : "pending"}`}>
            <span className="roll-overline">{rolling.notation.toUpperCase()}</span>
            <b>{rolling.label}</b>
            {showResult && revealedResult ? (
              <>
                {faceSummary && <small>{faceSummary}</small>}
                <strong>{revealedResult.total}</strong>
                {detailText && <p>{detailText}</p>}
              </>
            ) : (
              <p>等待骰子停稳后揭示结果</p>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
