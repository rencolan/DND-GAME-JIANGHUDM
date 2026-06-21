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

function deriveRemoteWsUrl(remoteHttpBase) {
  const url = new URL(remoteHttpBase);
  url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
  url.pathname = "/ws/bridge";
  url.search = "";
  url.hash = "";
  return url.toString();
}

export function loadBridgeConfig() {
  const remoteHttpBase = readRequiredString("REMOTE_HTTP_BASE");
  const remoteWsUrl = process.env.REMOTE_WS_URL?.trim() || deriveRemoteWsUrl(remoteHttpBase);

  return {
    remoteHttpBase,
    remoteWsUrl,
    bridgeId: process.env.BRIDGE_ID?.trim() || process.env.DEFAULT_BRIDGE_ID?.trim() || "main",
    bridgeSecret: readRequiredString("BRIDGE_SECRET"),
    koboldBaseUrl: readRequiredString("KOBOLD_BASE_URL"),
    koboldModel: readRequiredString("KOBOLD_MODEL"),
    heartbeatIntervalMs: readNumber("HEARTBEAT_INTERVAL_MS", 15000),
    reconnectDelayMs: readNumber("RECONNECT_DELAY_MS", 3000),
    localRequestTimeoutMs: readNumber("LOCAL_REQUEST_TIMEOUT_MS", 120000)
  };
}
