import { enemyPresets, initialGameState, itemCatalog, martialArtCatalog, originTemplates } from "../../data";
import { normalizeChapterStateForNameless } from "../story/namelessWanderer";
import { abilityModifier, recalculateCharacterDerivedStats } from "../rules";
import type {
  ChapterState,
  Character,
  GamePatch,
  GameState,
  Item,
  LocationUnlockReason,
  MartialArt,
  Npc,
  NpcStoryState,
  PendingCheck,
  PendingDamage,
  Quest,
  QuestStateNode,
  RelationshipRouteState,
  RollMode,
  Rumor
} from "../../types";

const SETUP_KEY = "jianghu-dm-has-played-v2";

const abilityLabels: Record<string, string> = {
  str: "力道",
  dex: "身法",
  con: "根骨",
  int: "悟性",
  cha: "气运",
  wis: "心境"
};

const martialLookup = new Map<string, MartialArt>();
martialArtCatalog.forEach((art) => {
  martialLookup.set(art.id, art);
  martialLookup.set(art.name, art);
});

const itemLookup = new Map<string, Item>();
itemCatalog.forEach((entry) => {
  itemLookup.set(entry.id, entry);
  itemLookup.set(entry.name, entry);
});

function uid(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function currentLocation(state: GameState) {
  return state.locations.find((location) => location.current)?.name || "未知地点";
}

function mergeUniqueStrings(...groups: Array<string[] | undefined>) {
  return [...new Set(groups.flat().filter(Boolean) as string[])];
}

function normalizeRollMode(raw: unknown): RollMode | undefined {
  return raw === "advantage" || raw === "disadvantage" || raw === "normal" ? raw : undefined;
}

function normalizeStoryFlags(raw: string[] | undefined, fallback: string[] = []) {
  return mergeUniqueStrings(fallback, raw);
}

function normalizeChapterState(raw: Partial<ChapterState> | undefined, fallback: ChapterState): ChapterState {
  return normalizeChapterStateForNameless(raw, fallback);
}

function normalizeQuestStateMap(quests: Quest[], raw: GameState["questStateMap"] | undefined) {
  const next: Record<string, QuestStateNode> = {};
  for (const quest of quests) {
    const saved = raw?.[quest.id];
    next[quest.id] = {
      id: quest.id,
      status: saved?.status || quest.status,
      stage: saved?.stage
    };
  }
  return next;
}

function normalizeRumors(raw: Rumor[] | undefined) {
  return (raw || []).map((rumor) => ({
    ...rumor,
    id: rumor.id || uid("rumor"),
    kind: rumor.kind || "rumor"
  }));
}

function normalizeRelationshipRoutes(
  npcs: Npc[],
  raw: GameState["relationshipRoutes"] | undefined,
  fallback: GameState["relationshipRoutes"]
) {
  const next: Record<string, RelationshipRouteState> = structuredClone(fallback);
  Object.entries(raw || {}).forEach(([key, value]) => {
    if (!value) return;
    next[key] = {
      ...next[key],
      ...value,
      npcId: value.npcId || next[key]?.npcId || key,
      supportUnlocked: value.supportUnlocked || next[key]?.supportUnlocked || []
    };
  });

  for (const npc of npcs) {
    if (!next[npc.id]) {
      next[npc.id] = {
        npcId: npc.id,
        kind: "bond",
        active: false,
        stage: "unawakened",
        supportUnlocked: []
      };
    }
  }

  return next;
}

function normalizeLocationUnlocks(
  locations: GameState["locations"],
  raw: GameState["locationUnlocks"] | undefined,
  fallback: GameState["locationUnlocks"]
) {
  const unlocks: Record<string, LocationUnlockReason> = { ...fallback, ...(raw || {}) };
  for (const location of locations) {
    if (location.unlocked && !unlocks[location.id]) {
      unlocks[location.id] = fallback[location.id] || "quest";
    }
  }
  return unlocks;
}

function normalizeNpcs(raw: Npc[] | undefined, fallback: Npc[]) {
  const savedById = new Map((raw || []).map((npc) => [npc.id, npc]));
  const next = fallback.map((npc) => ({
    ...npc,
    ...(savedById.get(npc.id) || {})
  }));

  for (const npc of raw || []) {
    if (!fallback.some((entry) => entry.id === npc.id)) {
      next.push({ ...npc });
    }
  }

  return next;
}

function deriveNpcStoryState(npc: Npc): NpcStoryState {
  if (npc.companion) return "companion";
  if (npc.status.includes("离") || npc.status.includes("散")) return "departed";
  if (npc.discovered || !npc.hidden) return npc.recruitable ? "available" : "revealed";
  return "hidden";
}

function normalizeNpcStoryState(
  npcs: Npc[],
  raw: GameState["npcStoryState"] | undefined,
  fallback: GameState["npcStoryState"]
) {
  const next: Record<string, NpcStoryState> = { ...fallback, ...(raw || {}) };
  for (const npc of npcs) {
    next[npc.id] = next[npc.id] || deriveNpcStoryState(npc);
  }
  return next;
}

function normalizeMartialArt(raw: Partial<MartialArt> & { name: string }): MartialArt {
  const template = martialLookup.get(raw.id || "") || martialLookup.get(raw.name);
  const category = raw.category || template?.category || "external";

  return {
    id: raw.id || template?.id || `art-${uid("martial")}`,
    name: raw.name,
    grade: raw.grade || template?.grade || "入门",
    category,
    linkedAbility: raw.linkedAbility || template?.linkedAbility || "str",
    damageDice: raw.damageDice || template?.damageDice || "1d4",
    damageBonus: raw.damageBonus ?? template?.damageBonus,
    baseQiCost: category === "internal" ? raw.baseQiCost ?? template?.baseQiCost ?? 1 : 0,
    source: raw.source || template?.source || "江湖所得"
  };
}

function normalizeInventory(raw: Item[] | undefined) {
  return (raw || [])
    .filter((item) => {
      const legacyType = (item as { type?: string })?.type;
      return item && legacyType !== "weapon" && legacyType !== "armor" && legacyType !== "accessory";
    })
    .map((item) => {
      const template = itemLookup.get(item.id) || itemLookup.get(item.name);
      const legacyType = (item as { type?: string }).type;
      const inferredType: Item["type"] = legacyType === "quest"
        ? "quest"
        : legacyType === "consumable" || item.usable || typeof item.hpRestore === "number" || typeof item.qiRestore === "number"
          ? "consumable"
          : legacyType === "goods" || template?.type === "goods"
            ? "goods"
            : "quest";
      return {
        id: item.id,
        name: item.name,
        desc: item.desc,
        count: item.count,
        type: inferredType,
        value: item.value ?? template?.value ?? 0,
        hpRestore: item.hpRestore,
        qiRestore: item.qiRestore,
        usable: item.usable,
        canSell: item.canSell ?? template?.canSell,
        canSteal: item.canSteal ?? template?.canSteal
      };
    });
}

function normalizeEconomy(raw: GameState["economy"] | undefined, fallback: GameState["economy"]) {
  const merchantStocks = { ...structuredClone(fallback.merchantStocks), ...(raw?.merchantStocks || {}) };
  const merchantBlockedUntilDay = { ...(fallback.merchantBlockedUntilDay || {}), ...(raw?.merchantBlockedUntilDay || {}) };
  const stolenNpcState = { ...(fallback.stolenNpcState || {}) };

  Object.entries(raw?.stolenNpcState || {}).forEach(([npcId, entry]) => {
    stolenNpcState[npcId] = {
      silverTaken: entry?.silverTaken || 0,
      itemCounts: { ...(entry?.itemCounts || {}) }
    };
  });

  return {
    merchantStocks,
    merchantBlockedUntilDay,
    stolenNpcState,
    pendingAction: raw?.pendingAction ? structuredClone(raw.pendingAction) : undefined
  };
}

function relabelAbilities(character: Character): Character {
  const {
    inventory,
    equipment: _legacyEquipment,
    ...rest
  } = character as Character & { inventory?: Item[]; equipment?: unknown };
  const relabeled = {
    ...rest,
    abilities: (character.abilities || []).map((ability) => ({
      ...ability,
      label: abilityLabels[ability.key] || ability.label
    })),
    martialArts: (character.martialArts || []).map((art) => normalizeMartialArt({ ...art, name: art.name })),
    inventory: normalizeInventory(inventory)
  };
  const baseQi = originTemplates.find((origin) => origin.id === relabeled.originId)?.qiStart
    ?? Math.max(1, (relabeled.maxQi || relabeled.qi || 1) - abilityModifier(
      relabeled.abilities.find((ability) => ability.key === "wis")?.value ?? 10
    ));

  return recalculateCharacterDerivedStats(relabeled, baseQi);
}

function fallbackObjective(state: GameState) {
  const activeQuest = state.quests.find((quest) => quest.status === "active");
  if (activeQuest) {
    return {
      title: activeQuest.title,
      text: activeQuest.text,
      location: state.objective.location || currentLocation(state),
      npc: state.objective.npc
    };
  }

  return state.objective || {
    title: "江湖未定",
    text: "先看看眼前的人、事、路，再决定下一步。",
    location: currentLocation(state)
  };
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
    reason: raw.reason || "局势逼人，得给出一个清楚应对。",
    risk: raw.risk,
    enemyIntent: raw.enemyIntent,
    suggestedAction: raw.suggestedAction
  };
}

function isInitiativePendingCheck(check?: PendingCheck) {
  if (!check?.label) return false;
  return check.label.includes("抢先手") || check.label.includes("先攻");
}

function makePendingDamage(raw: Partial<PendingDamage> | undefined): PendingDamage | undefined {
  if (!raw?.martialArtId || !raw.label || !raw.damageDice || !raw.hitText) return undefined;
  return {
    id: raw.id || uid("damage"),
    martialArtId: raw.martialArtId,
    label: raw.label,
    damageDice: raw.damageDice,
    damageBonus: raw.damageBonus || 0,
    qiCost: raw.qiCost || 0,
    qiBonusSpend: raw.qiBonusSpend || 0,
    hitText: raw.hitText,
    isCritical: raw.isCritical || false
  };
}

function findEnemyPreset(name: string) {
  const direct = enemyPresets.find((preset) => preset.name === name || preset.id === name);
  if (direct) return direct;

  for (const preset of enemyPresets) {
    if (name.includes(preset.name) || preset.name.includes(name)) return preset;
  }

  return enemyPresets.find((preset) => preset.id === "black-assassin") || enemyPresets[0];
}

function inferCombatStakes(enemyName: string) {
  return `眼下必须先稳住${enemyName}，别让对方继续压着局势走。`;
}

function makeEnemyCombat(name = "黑衣刺客"): GameState["combat"] {
  const preset = findEnemyPreset(name);
  return {
    active: true,
    combatId: uid("combat"),
    round: 1,
    phase: "awaiting_hit_check",
    stakes: inferCombatStakes(preset.name),
    enemy: preset.name,
    enemyHp: preset.hp,
    enemyMaxHp: preset.maxHp,
    enemyQi: preset.qi,
    enemyMaxQi: preset.maxQi,
    enemyAc: preset.ac,
    enemyAbilities: [
      { key: "str", label: abilityLabels.str, value: preset.abilities.str },
      { key: "dex", label: abilityLabels.dex, value: preset.abilities.dex },
      { key: "con", label: abilityLabels.con, value: preset.abilities.con },
      { key: "int", label: abilityLabels.int, value: preset.abilities.int },
      { key: "cha", label: abilityLabels.cha, value: preset.abilities.cha },
      { key: "wis", label: abilityLabels.wis, value: preset.abilities.wis }
    ],
    enemyMartialArts: preset.martialArts.map((art) => normalizeMartialArt({ ...art, name: art.name })),
    enemyStatus: []
  };
}

function normalizeCombat(combat: GameState["combat"] | undefined): GameState["combat"] {
  if (!combat?.active) return { active: false, round: 0, phase: "ended", stakes: "" };

  const normalized = makeEnemyCombat(combat.enemy || "姒涙垼銆傞崚鍝勵吂");
  return {
    ...normalized,
    ...combat,
    enemyHp: combat.enemyHp ?? normalized.enemyHp,
    enemyMaxHp: combat.enemyMaxHp ?? normalized.enemyMaxHp,
    enemyQi: combat.enemyQi ?? normalized.enemyQi,
    enemyMaxQi: combat.enemyMaxQi ?? normalized.enemyMaxQi,
    enemyAc: combat.enemyAc ?? normalized.enemyAc,
    enemyAbilities: combat.enemyAbilities || normalized.enemyAbilities,
    enemyMartialArts: (combat.enemyMartialArts || normalized.enemyMartialArts || []).map((art) =>
      normalizeMartialArt({ ...art, name: art.name })
    ),
    enemyStatus: combat.enemyStatus || [],
    combatId: combat.combatId || normalized.combatId,
    round: combat.round ?? normalized.round,
    phase: combat.phase || normalized.phase,
    stakes: combat.stakes || normalized.stakes
  };
}

function updateLocationUnlockReason(
  next: GameState,
  update: { locationId?: string; name?: string; reason: LocationUnlockReason }
) {
  const target = next.locations.find((location) => location.id === update.locationId || location.name === update.name);
  if (!target) return;
  target.unlocked = true;
  next.locationUnlocks[target.id] = update.reason;
}

function updateNpcStory(next: GameState, update: { npcId?: string; name?: string; state: NpcStoryState }) {
  const target = next.npcs.find((npc) => npc.id === update.npcId || npc.name === update.name);
  if (!target) return;

  next.npcStoryState[target.id] = update.state;
  if (update.state === "hidden" || update.state === "rumored") {
    target.hidden = true;
    target.discovered = false;
    target.companion = false;
  } else if (update.state === "revealed") {
    target.hidden = false;
    target.discovered = true;
    target.companion = false;
  } else if (update.state === "available") {
    target.hidden = false;
    target.discovered = true;
    target.recruitable = true;
    target.companion = false;
  } else if (update.state === "companion") {
    target.hidden = false;
    target.discovered = true;
    target.recruitable = true;
    target.companion = true;
  } else if (update.state === "departed") {
    target.hidden = false;
    target.discovered = true;
    target.companion = false;
  }
}

function updateRelationshipRoute(next: GameState, update: Partial<RelationshipRouteState> & { npcId?: string; name?: string }) {
  const npc = next.npcs.find((entry) => entry.id === update.npcId || entry.name === update.name);
  const routeKey = update.npcId && next.relationshipRoutes[update.npcId]
    ? update.npcId
    : update.name
      ? Object.keys(next.relationshipRoutes).find((key) => {
        const route = next.relationshipRoutes[key];
        return route?.npcId === npc?.id;
      }) || npc?.id
      : update.npcId;

  if (!routeKey) return;
  const existing = next.relationshipRoutes[routeKey] || {
    npcId: npc?.id || update.npcId || routeKey,
    kind: "bond" as const,
    active: false,
    stage: "unawakened" as const,
    supportUnlocked: []
  };

  next.relationshipRoutes[routeKey] = {
    ...existing,
    ...update,
    npcId: existing.npcId,
    supportUnlocked: update.supportUnlocked
      ? [...new Set([...(existing.supportUnlocked || []), ...update.supportUnlocked])]
      : existing.supportUnlocked || []
  };
}

export function normalizeGameState(raw: GameState): GameState {
  const base = structuredClone(initialGameState);
  const current = raw || base;

  const character = relabelAbilities(current.character || base.character);
  const roster = (current.roster || [character]).map(relabelAbilities);
  const locations = (current.locations || base.locations).map((location) => ({ ...location }));
  const combat = normalizeCombat(current.combat || base.combat);
  const pendingCheck = current.pendingCheck ? makePendingCheck(current.pendingCheck) : undefined;
  const pendingDamage = current.pendingDamage ? makePendingDamage(current.pendingDamage) : undefined;
  if (!locations.some((location) => location.current) && locations[0]) {
    locations[0].current = true;
  }

  const locationUnlocks = normalizeLocationUnlocks(locations, current.locationUnlocks, base.locationUnlocks);
  const locationsWithAuthority = locations.map((location) => ({
    ...location,
    unlocked: location.unlocked || Boolean(locationUnlocks[location.id])
  }));
  const npcs = normalizeNpcs(current.npcs, base.npcs);
  const npcStoryState = normalizeNpcStoryState(npcs, current.npcStoryState, base.npcStoryState);
  const quests = current.quests || [];
  const questStateMap = normalizeQuestStateMap(quests, current.questStateMap);
  const chapterState = normalizeChapterState(current.chapterState, base.chapterState);
  const storyFlags = normalizeStoryFlags(current.storyFlags, base.storyFlags);
  const rumors = normalizeRumors(current.rumors);
  const relationshipRoutes = normalizeRelationshipRoutes(npcs, current.relationshipRoutes, base.relationshipRoutes);
  const economy = normalizeEconomy(current.economy, base.economy);

  if (combat.active) {
    if (pendingDamage) combat.phase = "awaiting_damage_roll";
    else if (pendingCheck) combat.phase = isInitiativePendingCheck(pendingCheck) ? "opening" : "awaiting_hit_check";
  }

  return {
    ...base,
    ...current,
    setupComplete: current.setupComplete ?? Boolean(localStorage.getItem(SETUP_KEY)),
    originId: current.originId || character.originId || base.originId,
    creationMode: "origin",
    chapterState,
    storyFlags,
    character,
    roster,
    locations: locationsWithAuthority,
    locationUnlocks,
    npcs,
    npcStoryState,
    quests,
    questStateMap,
    rumors,
    relationshipRoutes,
    economy,
    messages: current.messages || base.messages,
    combat,
    systemLog: current.systemLog || base.systemLog,
    sceneType: current.sceneType || base.sceneType,
    objective: fallbackObjective({
      ...base,
      ...current,
      character,
      roster,
      locations,
      quests: current.quests || [],
      messages: current.messages || base.messages,
      combat,
      systemLog: current.systemLog || base.systemLog,
      sceneType: current.sceneType || base.sceneType,
      npcs: current.npcs || base.npcs,
      setupComplete: current.setupComplete ?? base.setupComplete,
      creationMode: "origin",
      originId: current.originId || character.originId || base.originId,
      chapterState,
      storyFlags,
      locationUnlocks,
      npcStoryState,
      questStateMap,
      rumors,
      relationshipRoutes,
      economy
    }),
    pendingCheck,
    pendingDamage,
    innerInjury: current.innerInjury || 0
  };
}

function normalizePatchedItem(raw: Partial<Item> & { name: string }): Item {
  const template = itemLookup.get(raw.id || "") || itemLookup.get(raw.name);
  const inferredType: Item["type"] = raw.type
    || template?.type
    || (raw.usable || typeof raw.hpRestore === "number" || typeof raw.qiRestore === "number"
      ? "consumable"
      : "quest");

  return {
    id: raw.id || template?.id || uid("item"),
    name: raw.name,
    desc: raw.desc || template?.desc || "江湖里常见的一件旧物。",
    count: raw.count || 1,
    type: inferredType,
    value: raw.value ?? template?.value ?? 0,
    usable: raw.usable ?? template?.usable,
    hpRestore: raw.hpRestore ?? template?.hpRestore,
    qiRestore: raw.qiRestore ?? template?.qiRestore,
    canSell: raw.canSell ?? template?.canSell,
    canSteal: raw.canSteal ?? template?.canSteal
  };
}

function applyInventoryDelta(hero: Character, change: NonNullable<GamePatch["itemChanges"]>[number]) {
  const target = hero.inventory.find((item) => item.id === change.itemId || item.name === change.name);
  if (change.delta > 0) {
    const rawItem = change.item
      ? { ...change.item, id: change.item.id || change.itemId, name: change.item.name }
      : target
        ? { ...target }
        : change.itemId
          ? { ...(itemLookup.get(change.itemId) || {}), id: change.itemId, name: change.name || itemLookup.get(change.itemId)?.name || change.itemId }
          : undefined;
    if (!rawItem?.name) return;
    const normalized = normalizePatchedItem({ ...rawItem, count: change.delta, name: rawItem.name });
    if (target) target.count += change.delta;
    else hero.inventory.push(normalized);
    return;
  }

  if (!target) return;
  target.count = Math.max(0, target.count + change.delta);
  hero.inventory = hero.inventory.filter((item) => item.count > 0);
}

export function applyPatchToState(prev: GameState, patch: GamePatch): GameState {
  const next = normalizeGameState(structuredClone(prev));
  const hero = next.character;

  if (patch.hpChange) hero.hp = clamp(hero.hp + patch.hpChange, 0, hero.maxHp);
  if (patch.qiChange) hero.qi = clamp(hero.qi + patch.qiChange, 0, hero.maxQi);
  if (patch.qiRecovery) hero.qi = clamp(hero.qi + patch.qiRecovery, 0, hero.maxQi);
  if (patch.qiMaxChange) {
    hero.maxQi = clamp(hero.maxQi + patch.qiMaxChange, 0, 99);
    hero.qi = clamp(hero.qi, 0, hero.maxQi);
  }
  if (patch.innerInjuryChange) {
    next.innerInjury = clamp((next.innerInjury || 0) + patch.innerInjuryChange, 0, 100);
  }
  if (patch.acChange) hero.ac = Math.max(0, hero.ac + patch.acChange);
  if (patch.silverChange) hero.silver = Math.max(0, hero.silver + patch.silverChange);

  if (patch.abilityChanges) {
    hero.abilities = hero.abilities.map((ability) => ({
      ...ability,
      value: patch.abilityChanges?.[ability.key] ?? patch.abilityChanges?.[ability.label] ?? ability.value
    }));
  }

  if (patch.newItem?.name) {
    const newItem: Item = {
      id: patch.newItem.id || uid("item"),
      name: patch.newItem.name,
      desc: patch.newItem.desc || "新得之物，尚待派上用场。",
      count: patch.newItem.count || 1,
      type: patch.newItem.type
        || (patch.newItem.usable || typeof patch.newItem.hpRestore === "number" || typeof patch.newItem.qiRestore === "number"
          ? "consumable"
          : "quest"),
      value: patch.newItem.value ?? 0,
      usable: patch.newItem.usable,
      hpRestore: patch.newItem.hpRestore,
      qiRestore: patch.newItem.qiRestore,
      canSell: patch.newItem.canSell,
      canSteal: patch.newItem.canSteal
    };
  }

  if (patch.removeItemId) {
    hero.inventory = hero.inventory.filter((item) => item.id !== patch.removeItemId);
  }

  if (patch.itemChanges) {
    patch.itemChanges.forEach((change) => applyInventoryDelta(hero, change));
  }

  if (patch.economyUpdate) {
    if (patch.economyUpdate.merchantStocks) {
      next.economy.merchantStocks = {
        ...next.economy.merchantStocks,
        ...structuredClone(patch.economyUpdate.merchantStocks)
      };
    }
    if (patch.economyUpdate.merchantBlockedUntilDay) {
      next.economy.merchantBlockedUntilDay = {
        ...next.economy.merchantBlockedUntilDay,
        ...patch.economyUpdate.merchantBlockedUntilDay
      };
    }
    if (patch.economyUpdate.stolenNpcState) {
      Object.entries(patch.economyUpdate.stolenNpcState).forEach(([npcId, entry]) => {
        next.economy.stolenNpcState[npcId] = {
          silverTaken: entry.silverTaken,
          itemCounts: { ...(entry.itemCounts || {}) }
        };
      });
    }
    if ("pendingAction" in patch.economyUpdate) {
      next.economy.pendingAction = patch.economyUpdate.pendingAction || undefined;
    }
  }

  if (patch.location) {
    next.locations = next.locations.map((location) => ({
      ...location,
      current: location.name === patch.location,
      unlocked: location.unlocked || location.name === patch.location
    }));
    const currentStop = next.locations.find((location) => location.name === patch.location);
    if (currentStop) {
      next.locationUnlocks[currentStop.id] = next.locationUnlocks[currentStop.id] || "quest";
      next.storyFlags = mergeUniqueStrings(next.storyFlags, [`arrive:${currentStop.id}`]);
    }
  }

  if (patch.timeSlot) next.timeSlot = patch.timeSlot;
  if (patch.chapter) next.chapter = patch.chapter;
  if (patch.sceneType) next.sceneType = patch.sceneType;
  if (patch.chapterStateUpdate) {
    next.chapterState = normalizeChapterState({ ...next.chapterState, ...patch.chapterStateUpdate }, next.chapterState);
  }
  if (patch.storyFlagsAdd || patch.storyFlagsRemove) {
    const removed = new Set(patch.storyFlagsRemove || []);
    next.storyFlags = mergeUniqueStrings(next.storyFlags, patch.storyFlagsAdd).filter((flag) => !removed.has(flag));
  }

  if (patch.combatAction === "enter") {
    next.combat = makeEnemyCombat(patch.enemyName || "黑衣刺客");
  }

  if (patch.combatUpdate && next.combat.active) {
    const combat = normalizeCombat(next.combat);
    const enemyQiCost = patch.combatUpdate.enemyQiCost || 0;
    combat.enemyHp = clamp((combat.enemyHp || 0) + (patch.combatUpdate.enemyHpChange || 0), 0, combat.enemyMaxHp || 1);
    combat.enemyQi = clamp((combat.enemyQi || 0) + (patch.combatUpdate.enemyQiChange || 0) - enemyQiCost, 0, combat.enemyMaxQi || 1);
    combat.enemyAc = Math.max(0, (combat.enemyAc || 0) + (patch.combatUpdate.enemyAcChange || 0));
    const status = new Set(combat.enemyStatus || []);
    patch.combatUpdate.enemyStatusAdd?.forEach((item) => status.add(item));
    patch.combatUpdate.enemyStatusRemove?.forEach((item) => status.delete(item));
    combat.enemyStatus = [...status];
    if (typeof patch.combatUpdate.roundDelta === "number") {
      combat.round = Math.max(1, (combat.round || 1) + patch.combatUpdate.roundDelta);
    }
    if (patch.combatUpdate.phase) {
      combat.phase = patch.combatUpdate.phase;
    }
    if (patch.combatUpdate.stakes) {
      combat.stakes = patch.combatUpdate.stakes;
    }
    next.combat = combat;

    if (patch.combatUpdate.enemyMartialArtUsed) {
      next.systemLog.push(`敌人使出武学：${patch.combatUpdate.enemyMartialArtUsed}`);
    }

    if ((combat.enemyHp || 0) <= 0) {
      next.combat = { ...combat, active: false, phase: "ended" };
      next.systemLog.push(`${combat.enemy} 已失去再战之力。`);
    }
  }

  if (patch.combatAction === "exit") {
    next.combat = { ...next.combat, active: false, phase: "ended" };
  }

  if (patch.relationshipChanges) {
    next.npcs = next.npcs.map((npc) => {
      const change = patch.relationshipChanges?.find((item) => item.npcId === npc.id || item.name === npc.name);
      if (!change) return npc;
      return {
        ...npc,
        relationship: clamp(change.value ?? npc.relationship + (change.delta || 0), 0, 100),
        attitude: change.attitude || npc.attitude
      };
    });
  }

  if (patch.npcUpdates) {
    next.npcs = next.npcs.map((npc) => {
      const update = patch.npcUpdates?.find((item) => item.id === npc.id || item.name === npc.name);
      if (!update) return npc;
      return { ...npc, ...update, id: npc.id, name: npc.name };
    });
  }
  patch.npcStoryUpdates?.forEach((update) => updateNpcStory(next, update));

  if (patch.questUpdates) {
    for (const update of patch.questUpdates) {
      const index = next.quests.findIndex((quest) => quest.id === update.id || quest.title === update.title);
      if (index >= 0) {
        next.quests[index] = { ...next.quests[index], ...update };
      } else if (update.title && update.text) {
        next.quests.push({
          id: update.id || uid("quest"),
          title: update.title,
          text: update.text,
          status: update.status || "active"
        });
      }
    }
  }
  patch.questStateUpdates?.forEach((update) => {
    next.questStateMap[update.id] = {
      ...(next.questStateMap[update.id] || { id: update.id, status: update.status }),
      ...update
    };
  });

  patch.locationUnlockUpdates?.forEach((update) => updateLocationUnlockReason(next, update));
  patch.relationshipRouteUpdates?.forEach((update) => updateRelationshipRoute(next, update));

  if (patch.martialArtLearned?.name) {
    const learned = normalizeMartialArt({ ...patch.martialArtLearned, name: patch.martialArtLearned.name });
    const existing = hero.martialArts.find((art) => art.id === learned.id || art.name === learned.name);
    if (existing) Object.assign(existing, learned);
    else hero.martialArts.push(learned);
    next.systemLog.push(`习得武学：${learned.name}`);
  }

  if (patch.martialArtUpdates) {
    for (const update of patch.martialArtUpdates) {
      const index = hero.martialArts.findIndex((art) => art.id === update.id || art.name === update.name);
      if (index >= 0 && update.name) {
        hero.martialArts[index] = normalizeMartialArt({ ...hero.martialArts[index], ...update, name: update.name });
      } else if (update.name) {
        hero.martialArts.push(normalizeMartialArt({ ...update, name: update.name }));
      }
    }
  }

  if (patch.rumorAdd) {
    for (const rumor of patch.rumorAdd) {
      const normalized: Rumor = {
        id: rumor.id || uid("rumor"),
        text: rumor.text,
        kind: rumor.kind || "rumor",
        location: rumor.location,
        npc: rumor.npc,
        source: rumor.source || "ai-proposal",
        discoveredDay: rumor.discoveredDay || next.worldDay,
        consumed: rumor.consumed || false
      };
      const exists = next.rumors.some((entry) =>
        entry.text === normalized.text && entry.location === normalized.location && entry.npc === normalized.npc
      );
      if (!exists) next.rumors.push(normalized);
    }
  }

  if (patch.systemNote) next.systemLog.push(patch.systemNote);
  if (patch.objectiveUpdate) next.objective = { ...next.objective, ...patch.objectiveUpdate };
  if ("pendingCheck" in patch) {
    next.pendingCheck = patch.pendingCheck ? makePendingCheck(patch.pendingCheck) : undefined;
  }
  if ("pendingDamage" in patch) {
    next.pendingDamage = patch.pendingDamage ? makePendingDamage(patch.pendingDamage) : undefined;
  }
  if (next.pendingDamage && next.combat.active) {
    next.combat.phase = "awaiting_damage_roll";
  } else if (next.pendingCheck && next.combat.active) {
    next.combat.phase = isInitiativePendingCheck(next.pendingCheck) ? "opening" : "awaiting_hit_check";
  }
  if (!next.combat.active) {
    next.pendingDamage = undefined;
    next.pendingCheck = undefined;
    next.combat.phase = "ended";
  }
  next.questStateMap = normalizeQuestStateMap(next.quests, next.questStateMap);
  next.locationUnlocks = normalizeLocationUnlocks(next.locations, next.locationUnlocks, initialGameState.locationUnlocks);
  next.npcStoryState = normalizeNpcStoryState(next.npcs, next.npcStoryState, initialGameState.npcStoryState);
  next.relationshipRoutes = normalizeRelationshipRoutes(next.npcs, next.relationshipRoutes, initialGameState.relationshipRoutes);
  next.character = relabelAbilities(hero);
  next.roster = (next.roster || []).map((member) =>
    member.id === next.currentCharacterId ? structuredClone(next.character) : relabelAbilities(member)
  );

  return normalizeGameState(next);
}
