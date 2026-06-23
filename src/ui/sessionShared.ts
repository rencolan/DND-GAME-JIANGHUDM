import type { ApiConfig, ApiProvider, GameState } from "../types";
import type { RollPackage } from "./sessionTypes";

export const SAVE_KEY = "jianghu-dm-save-v3";
export const API_KEY = "jianghu-dm-api-v3";
export const SETUP_KEY = "jianghu-dm-has-played-v2";
export const BGM_KEY = "jianghu-dm-bgm-v1";
export const BGM_VOLUME_KEY = "jianghu-dm-bgm-volume-v1";
export const SFX_KEY = "jianghu-dm-sfx-v1";
export const SFX_VOLUME_KEY = "jianghu-dm-sfx-volume-v1";
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

function rollD6() {
  return Math.ceil(Math.random() * 6);
}

function rollAbilityScore() {
  const rolls = [rollD6(), rollD6(), rollD6(), rollD6()];
  const dropped = Math.min(...rolls);
  return rolls.reduce((sum, value) => sum + value, 0) - dropped;
}

export function makeAbilityChoices(): RollPackage[] {
  return [Array.from({ length: 6 }, () => rollAbilityScore()) as RollPackage];
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
