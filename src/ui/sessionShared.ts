import type { ApiConfig, ApiProvider, GameState } from "../types";
import {
  CREATION_BASE_TOTAL,
  CREATION_FREE_POINTS,
  CREATION_RANDOM_CAP,
  CREATION_STAT_MAX,
  CREATION_STAT_MIN
} from "../game/rules";
import type { RollPackage } from "./sessionTypes";

export const SAVE_KEY = "jianghu-dm-save-v3";
export const API_KEY = "jianghu-dm-api-v3";
export const SETUP_KEY = "jianghu-dm-has-played-v2";
export const BGM_KEY = "jianghu-dm-bgm-v1";
export const BGM_VOLUME_KEY = "jianghu-dm-bgm-volume-v1";
export const WORLD_STEP = 4;
export const QI_INVEST_LIMIT = 6;
export const PLAYABLE_ORIGIN_ID = "nameless-wanderer";

const DEEPSEEK_BASE_URL = "https://api.deepseek.com";
export const DEEPSEEK_CHAT_COMPLETIONS_URL = `${DEEPSEEK_BASE_URL}/chat/completions`;
export const DS_FLASH_MODEL = "deepseek-v4-flash";
export const DS_PRO_MODEL = "deepseek-v4-pro";

export const PROVIDER_DEFAULTS: Record<ApiProvider, { apiUrl: string; model: string }> = {
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

export const PROVIDER_OPTIONS: Array<{ value: ApiProvider; label: string }> = [
  { value: "openai", label: "OpenAI" },
  { value: "deepseek", label: "DeepSeek" },
  { value: "custom", label: "自定义" }
];

export function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

export const EMPTY_ROLL_PACKAGE: RollPackage = [0, 0, 0, 0, 0, 0];

function makeRandomAbilityBase(): RollPackage {
  const values = [CREATION_STAT_MIN, CREATION_STAT_MIN, CREATION_STAT_MIN, CREATION_STAT_MIN, CREATION_STAT_MIN, CREATION_STAT_MIN];
  let remaining = CREATION_BASE_TOTAL - (CREATION_STAT_MIN * values.length);

  while (remaining > 0) {
    const availableIndexes = values
      .map((value, index) => value < CREATION_RANDOM_CAP ? index : -1)
      .filter((index) => index >= 0);

    if (!availableIndexes.length) break;

    const pickedIndex = availableIndexes[Math.floor(Math.random() * availableIndexes.length)];
    values[pickedIndex] += 1;
    remaining -= 1;
  }

  return values as RollPackage;
}

export function makeAbilityChoices(): RollPackage[] {
  return Array.from({ length: 3 }, () => makeRandomAbilityBase());
}

export function sumRollPackage(values: RollPackage) {
  return values.reduce((total, value) => total + value, 0);
}

export function remainingAllocationPoints(allocation: RollPackage) {
  return CREATION_FREE_POINTS - sumRollPackage(allocation);
}

export function applyAllocation(base: RollPackage, allocation: RollPackage): RollPackage {
  return base.map((value, index) => value + allocation[index]) as RollPackage;
}

export function canAdjustAllocation(
  base: RollPackage,
  allocation: RollPackage,
  abilityIndex: number,
  delta: -1 | 1
) {
  const nextValue = allocation[abilityIndex] + delta;
  if (delta < 0) return nextValue >= 0;
  if (remainingAllocationPoints(allocation) <= 0) return false;
  return base[abilityIndex] + nextValue <= CREATION_STAT_MAX;
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

export function advanceTime(state: GameState): Pick<GameState, "worldDay" | "timeSlot"> {
  const slots = ["清晨", "上午", "午后", "黄昏", "夜半"];
  const currentIndex = Math.max(0, slots.indexOf(state.timeSlot));
  const nextIndex = (currentIndex + 1) % slots.length;

  return {
    worldDay: nextIndex === 0 ? state.worldDay + 1 : state.worldDay,
    timeSlot: slots[nextIndex]
  };
}
