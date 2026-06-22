import type { GamePatch, GameState, Npc } from "../../types";
export { applyPatchToState, normalizeGameState } from "./state";

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
    if (patch.qiGrowthBonusChange !== undefined) {
      merged.qiGrowthBonusChange = (merged.qiGrowthBonusChange || 0) + patch.qiGrowthBonusChange;
    }
    if (patch.qiBreakthroughCapChange !== undefined) {
      merged.qiBreakthroughCapChange = (merged.qiBreakthroughCapChange || 0) + patch.qiBreakthroughCapChange;
    }
    if (patch.qiTrainingProgressChange !== undefined) {
      merged.qiTrainingProgressChange = (merged.qiTrainingProgressChange || 0) + patch.qiTrainingProgressChange;
    }
    if (patch.cultivationRankChange !== undefined) {
      merged.cultivationRankChange = (merged.cultivationRankChange || 0) + patch.cultivationRankChange;
    }
    if (patch.internalStyleUpdate !== undefined) merged.internalStyleUpdate = patch.internalStyleUpdate;
    if (patch.activeInternalArtId !== undefined) merged.activeInternalArtId = patch.activeInternalArtId;
    if (patch.qiRecovery !== undefined) merged.qiRecovery = (merged.qiRecovery || 0) + patch.qiRecovery;
    if (patch.innerInjuryChange !== undefined) merged.innerInjuryChange = (merged.innerInjuryChange || 0) + patch.innerInjuryChange;
    if (patch.acChange !== undefined) merged.acChange = (merged.acChange || 0) + patch.acChange;
    if (patch.silverChange !== undefined) merged.silverChange = (merged.silverChange || 0) + patch.silverChange;
    if (patch.abilityChanges) merged.abilityChanges = { ...(merged.abilityChanges || {}), ...patch.abilityChanges };
    if (patch.location !== undefined) merged.location = patch.location;
    if (patch.timeSlot !== undefined) merged.timeSlot = patch.timeSlot;
    if (patch.chapter !== undefined) merged.chapter = patch.chapter;
    if (patch.combatAction !== undefined) merged.combatAction = patch.combatAction;
    if (patch.enemyName !== undefined) merged.enemyName = patch.enemyName;
    if (patch.combatUpdate) {
      const previous = merged.combatUpdate || {};
      merged.combatUpdate = {
        ...previous,
        ...patch.combatUpdate,
        enemyStatusAdd: [...(previous.enemyStatusAdd || []), ...(patch.combatUpdate.enemyStatusAdd || [])],
        enemyStatusRemove: [...(previous.enemyStatusRemove || []), ...(patch.combatUpdate.enemyStatusRemove || [])],
        playerStatusAdd: [...(previous.playerStatusAdd || []), ...(patch.combatUpdate.playerStatusAdd || [])],
        playerStatusRemove: [...(previous.playerStatusRemove || []), ...(patch.combatUpdate.playerStatusRemove || [])]
      };
      if (patch.combatUpdate.enemyHpChange !== undefined) {
        merged.combatUpdate.enemyHpChange = (previous.enemyHpChange || 0) + patch.combatUpdate.enemyHpChange;
      }
      if (patch.combatUpdate.enemyQiChange !== undefined) {
        merged.combatUpdate.enemyQiChange = (previous.enemyQiChange || 0) + patch.combatUpdate.enemyQiChange;
      }
      if (patch.combatUpdate.enemyAcChange !== undefined) {
        merged.combatUpdate.enemyAcChange = (previous.enemyAcChange || 0) + patch.combatUpdate.enemyAcChange;
      }
      if (patch.combatUpdate.enemyInnerInjuryChange !== undefined) {
        merged.combatUpdate.enemyInnerInjuryChange = (previous.enemyInnerInjuryChange || 0) + patch.combatUpdate.enemyInnerInjuryChange;
      }
      if (patch.combatUpdate.enemyQiCost !== undefined) {
        merged.combatUpdate.enemyQiCost = (previous.enemyQiCost || 0) + patch.combatUpdate.enemyQiCost;
      }
      if (patch.combatUpdate.roundDelta !== undefined) {
        merged.combatUpdate.roundDelta = (previous.roundDelta || 0) + patch.combatUpdate.roundDelta;
      }
    }
    if (patch.newItem !== undefined) merged.newItem = patch.newItem;
    if (patch.removeItemId !== undefined) merged.removeItemId = patch.removeItemId;
    if (patch.itemChanges) merged.itemChanges = [...(merged.itemChanges || []), ...patch.itemChanges];
    if (patch.economyUpdate) {
      merged.economyUpdate = {
        ...(merged.economyUpdate || {}),
        ...(patch.economyUpdate || {}),
        merchantStocks: {
          ...(merged.economyUpdate?.merchantStocks || {}),
          ...(patch.economyUpdate.merchantStocks || {})
        },
        merchantBlockedUntilDay: {
          ...(merged.economyUpdate?.merchantBlockedUntilDay || {}),
          ...(patch.economyUpdate.merchantBlockedUntilDay || {})
        },
        stolenNpcState: {
          ...(merged.economyUpdate?.stolenNpcState || {}),
          ...(patch.economyUpdate.stolenNpcState || {})
        },
        pendingAction: "pendingAction" in patch.economyUpdate
          ? patch.economyUpdate.pendingAction
          : merged.economyUpdate?.pendingAction
      };
    }
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
    if (patch.studyAdd) merged.studyAdd = [...(merged.studyAdd || []), ...patch.studyAdd];
    if (patch.studyUpdate) merged.studyUpdate = [...(merged.studyUpdate || []), ...patch.studyUpdate];
    if (patch.studyRemoveIds) merged.studyRemoveIds = [...(merged.studyRemoveIds || []), ...patch.studyRemoveIds];
    if (patch.studySourceAdd) merged.studySourceAdd = [...(merged.studySourceAdd || []), ...patch.studySourceAdd];
    if (patch.studySourceUpdate) merged.studySourceUpdate = [...(merged.studySourceUpdate || []), ...patch.studySourceUpdate];
    if (patch.attributeInsightAdd) {
      merged.attributeInsightAdd = [...(merged.attributeInsightAdd || []), ...patch.attributeInsightAdd];
    }
    if (patch.attributeInsightRemoveIds) {
      merged.attributeInsightRemoveIds = [...(merged.attributeInsightRemoveIds || []), ...patch.attributeInsightRemoveIds];
    }
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
