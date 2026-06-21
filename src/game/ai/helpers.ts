import type {
  AiProposalPayload,
  ApiConfig,
  GamePatch,
  GameState,
  Npc,
  PendingCheck,
  ProposedWorldAction,
  RollMode,
  SceneType
} from "../../types";

const DEEPSEEK_BASE_URL = "https://api.deepseek.com";
const DEEPSEEK_CHAT_COMPLETIONS_URL = `${DEEPSEEK_BASE_URL}/chat/completions`;

const sceneKeywords: Array<{ sceneType: SceneType; keywords: string[] }> = [
  { sceneType: "brothel", keywords: ["brothel", "courtesan", "red lantern"] },
  { sceneType: "tavern", keywords: ["tavern", "wine", "drink", "pub"] },
  { sceneType: "inn", keywords: ["inn", "guest room", "lodge", "rest stop"] },
  { sceneType: "temple", keywords: ["temple", "shrine", "monk"] },
  { sceneType: "market", keywords: ["market", "street", "stall", "tea house"] },
  { sceneType: "palace", keywords: ["palace", "manor", "official hall"] }
];

function uid(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
}

function currentLocation(state: GameState) {
  return state.locations.find((location) => location.current)?.name || "Unknown location";
}

function isVisibleNpc(npc: Npc) {
  return !npc.hidden || npc.discovered || npc.companion;
}

function mergeUniqueStrings(...groups: Array<string[] | undefined>) {
  return [...new Set(groups.flat().filter(Boolean) as string[])];
}

function normalizeRollMode(raw: unknown): RollMode | undefined {
  return raw === "advantage" || raw === "disadvantage" || raw === "normal" ? raw : undefined;
}

function makePendingCheck(raw: GamePatch["pendingCheck"]): PendingCheck | undefined {
  if (!raw?.label || typeof raw.dc !== "number") return undefined;
  return {
    id: uid("check"),
    label: raw.label,
    abilityKey: raw.abilityKey,
    martialArtId: raw.martialArtId,
    rollMode: normalizeRollMode(raw.rollMode),
    dc: raw.dc,
    reason: raw.reason || "The situation demands a clear response.",
    risk: raw.risk,
    enemyIntent: raw.enemyIntent,
    suggestedAction: raw.suggestedAction
  };
}

function sanitizeProposedWorldAction(raw: AiProposalPayload["proposedWorldAction"] | undefined): ProposedWorldAction | undefined {
  if (!raw?.kind) return undefined;
  if (!["shop_list", "buy", "sell", "steal"].includes(raw.kind)) return undefined;
  return {
    kind: raw.kind,
    npcId: raw.npcId,
    itemId: raw.itemId,
    itemName: raw.itemName,
    quantity: typeof raw.quantity === "number" && Number.isFinite(raw.quantity) ? raw.quantity : undefined,
    abilityKey: raw.abilityKey,
    dc: typeof raw.dc === "number" && Number.isFinite(raw.dc) ? raw.dc : undefined,
    rollMode: normalizeRollMode(raw.rollMode),
    reason: raw.reason
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
    proposedCheck: proposedCheck ? { ...proposedCheck, reason: proposedCheck.reason } : undefined,
    proposedHooks: normalizeHooks(raw?.proposedHooks),
    proposedRumors: normalizeHooks(raw?.proposedRumors),
    proposedNpcReactions,
    proposedWorldAction: sanitizeProposedWorldAction(raw?.proposedWorldAction)
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

export function inferSceneType(text: string): SceneType | undefined {
  const source = text.toLowerCase();
  return sceneKeywords.find((entry) =>
    entry.keywords.some((keyword) => source.includes(keyword.toLowerCase()))
  )?.sceneType;
}

export function stripThinkingBlocks(text: string) {
  const complete = text.replace(/<think\b[^>]*>[\s\S]*?<\/think>/gi, "");
  return complete.replace(/<think\b[^>]*>[\s\S]*$/gi, "").trim();
}

export function stripJsonBlock(text: string) {
  const match = text.match(/```json\s*([\s\S]*?)\s*```/i);
  if (!match) {
    const incompleteFenceIndex = text.search(/```json\b/i);
    return {
      visibleText: (incompleteFenceIndex >= 0 ? text.slice(0, incompleteFenceIndex) : text).trim(),
      patchText: undefined
    };
  }

  return {
    visibleText: text.replace(match[0], "").trim(),
    patchText: match?.[1]
  };
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
    proposedCheck: typeof payload.proposedCheck === "object" && payload.proposedCheck
      ? payload.proposedCheck as AiProposalPayload["proposedCheck"]
      : undefined,
    proposedHooks: Array.isArray(payload.proposedHooks) ? payload.proposedHooks as AiProposalPayload["proposedHooks"] : undefined,
    proposedRumors: Array.isArray(payload.proposedRumors) ? payload.proposedRumors as AiProposalPayload["proposedRumors"] : undefined,
    proposedNpcReactions: Array.isArray(payload.proposedNpcReactions)
      ? payload.proposedNpcReactions as AiProposalPayload["proposedNpcReactions"]
      : undefined,
    proposedWorldAction: typeof payload.proposedWorldAction === "object" && payload.proposedWorldAction
      ? payload.proposedWorldAction as AiProposalPayload["proposedWorldAction"]
      : undefined
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

  if (!state.pendingCheck && !state.pendingDamage && !state.combat.active && proposals.proposedCheck && !proposals.proposedWorldAction) {
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
    acceptedNotes.push(`New leads surfaced: ${rumorSeeds.slice(0, 2).join("; ")}`);
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
    .map((item) => `${item.name}: ${item.note}`);
  if (npcNotes.length > 0) acceptedNotes.push(npcNotes.join(" "));

  if (acceptedNotes.length > 0) {
    patch.systemNote = acceptedNotes.join(" ");
  }

  return patch;
}
