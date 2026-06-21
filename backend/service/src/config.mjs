import { loadEnvFile } from "../../shared/env.mjs";

loadEnvFile(new URL("../../.env", import.meta.url));

function readNumber(name, fallback) {
  const raw = process.env[name];
  if (!raw) return fallback;
  const value = Number(raw);
  return Number.isFinite(value) ? value : fallback;
}

function readRequiredString(name) {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export function loadServiceConfig() {
  return {
    port: readNumber("PORT", 8787),
    clientApiKey: readRequiredString("CLIENT_API_KEY"),
    bridgeSecret: readRequiredString("BRIDGE_SECRET"),
    defaultBridgeId: process.env.DEFAULT_BRIDGE_ID?.trim() || "main",
    requestTimeoutMs: readNumber("REQUEST_TIMEOUT_MS", 120000)
  };
}
