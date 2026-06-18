import type { GamePatch, GameState, Npc } from "../../types";

function currentLocationName(state: GameState) {
  return state.locations.find((location) => location.current)?.name || "Unknown location";
}

function isVisibleNpc(npc: Npc) {
  return !npc.hidden || npc.discovered || npc.companion;
}

export function mergeGamePatches(...patches: Array<GamePatch | undefined>): GamePatch {
  const merged: GamePatch = {};

  for (const patch of patches) {
    if (!patch) continue;

    if (patch.hpChange !== undefined) merged.hpChange = (merged.hpChange || 0) + patch.hpChange;
    if (patch.qiChange !== undefined) merged.qiChange = (merged.qiChange || 0) + patch.qiChange;
    if (patch.qiMaxChange !== undefined) merged.qiMaxChange = (merged.qiMaxChange || 0) + patch.qiMaxChange;
    if (patch.qiRecovery !== undefined) merged.qiRecovery = (merged.qiRecovery || 0) + patch.qiRecovery;
    if (patch.innerInjuryChange !== undefined) merged.innerInjuryChange = (merged.innerInjuryChange || 0) + patch.innerInjuryChange;
    if (patch.acChange !== undefined) merged.acChange = (merged.acChange || 0) + patch.acChange;
    if (patch.abilityChanges) merged.abilityChanges = { ...(merged.abilityChanges || {}), ...patch.abilityChanges };
    if (patch.location !== undefined) merged.location = patch.location;
    if (patch.timeSlot !== undefined) merged.timeSlot = patch.timeSlot;
    if (patch.chapter !== undefined) merged.chapter = patch.chapter;
    if (patch.combatAction !== undefined) merged.combatAction = patch.combatAction;
    if (patch.enemyName !== undefined) merged.enemyName = patch.enemyName;
    if (patch.combatUpdate) merged.combatUpdate = { ...(merged.combatUpdate || {}), ...patch.combatUpdate };
    if (patch.newItem !== undefined) merged.newItem = patch.newItem;
    if (patch.removeItemId !== undefined) merged.removeItemId = patch.removeItemId;
    if (patch.relationshipChanges) merged.relationshipChanges = [...(merged.relationshipChanges || []), ...patch.relationshipChanges];
    if (patch.npcUpdates) merged.npcUpdates = [...(merged.npcUpdates || []), ...patch.npcUpdates];
    if (patch.questUpdates) merged.questUpdates = [...(merged.questUpdates || []), ...patch.questUpdates];
    if (patch.systemNote !== undefined) merged.systemNote = patch.systemNote;
    if (patch.sceneType !== undefined) merged.sceneType = patch.sceneType;
    if (patch.objectiveUpdate) merged.objectiveUpdate = { ...(merged.objectiveUpdate || {}), ...patch.objectiveUpdate };
    if ("pendingCheck" in patch) merged.pendingCheck = patch.pendingCheck;
    if ("pendingDamage" in patch) merged.pendingDamage = patch.pendingDamage;
    if (patch.martialArtLearned !== undefined) merged.martialArtLearned = patch.martialArtLearned;
    if (patch.martialArtUpdates) merged.martialArtUpdates = [...(merged.martialArtUpdates || []), ...patch.martialArtUpdates];
    if (patch.chapterStateUpdate) merged.chapterStateUpdate = { ...(merged.chapterStateUpdate || {}), ...patch.chapterStateUpdate };
    if (patch.storyFlagsAdd) merged.storyFlagsAdd = [...(merged.storyFlagsAdd || []), ...patch.storyFlagsAdd];
    if (patch.storyFlagsRemove) merged.storyFlagsRemove = [...(merged.storyFlagsRemove || []), ...patch.storyFlagsRemove];
    if (patch.questStateUpdates) merged.questStateUpdates = [...(merged.questStateUpdates || []), ...patch.questStateUpdates];
    if (patch.locationUnlockUpdates) merged.locationUnlockUpdates = [...(merged.locationUnlockUpdates || []), ...patch.locationUnlockUpdates];
    if (patch.npcStoryUpdates) merged.npcStoryUpdates = [...(merged.npcStoryUpdates || []), ...patch.npcStoryUpdates];
    if (patch.rumorAdd) merged.rumorAdd = [...(merged.rumorAdd || []), ...patch.rumorAdd];
    if (patch.relationshipRouteUpdates) merged.relationshipRouteUpdates = [...(merged.relationshipRouteUpdates || []), ...patch.relationshipRouteUpdates];
  }

  return merged;
}

export function advanceWorldLocally(state: GameState, globalUpdate: boolean): GamePatch {
  const current = currentLocationName(state);
  const visible = state.npcs.filter(isVisibleNpc);
  const updates = visible
    .filter((npc) => globalUpdate || npc.location === current || npc.companion)
    .slice(0, globalUpdate ? 4 : 2)
    .map((npc) => ({
      name: npc.name,
      lastSeen: globalUpdate
        ? `${npc.location} has fresh movement around ${npc.name}.`
        : `${current} has recent news of ${npc.name}.`
    }));

  return {
    npcUpdates: updates,
    storyFlagsAdd: [`turn:${state.actionCount + 1}`],
    systemNote: globalUpdate
      ? "The broader world keeps moving."
      : "The local scene advances with your action."
  };
}
