import { originTemplates } from "../../data";
import {
  prepareCombatDamageRoll,
  resolveCombatDamage,
  resolveCombatHit,
  resolveCombatInitiative,
  resolveEnemyTurn,
  startCombat
} from "../combat";
import type { EnemyTurnResult } from "../combat";
import { advanceWorldLocally, mergeGamePatches } from "../engine";
import {
  buildNamelessTutorialObjective,
  buildNamelessTutorialTransitionText,
  isNamelessTutorialCombatStage,
  QUEST_WANDERER_1,
  QUEST_WANDERER_2,
  QUEST_WANDERER_3,
  QUEST_WANDERER_4,
  QUEST_WANDERER_5,
  resolveNamelessStoryTrigger
} from "../story/namelessWanderer";
import { resolveMartialArtStoryAction } from "../story/martialArtRoutes";
import type { GamePatch, GameState, MartialArt } from "../../types";
import {
  buildCombatActionCheck,
  buildShuangErSupportPatch,
  buildSuggestedCheck,
  currentLocationId,
  currentLocationName,
  findLocationByName,
  findNamedEnemy,
  hasQuestStatus,
  hasStoryFlag,
  includesAny,
  parseCombatDamageResult,
  parseCombatHitResult,
  routeStage
} from "./helpers";

export type WorldTextId =
  | "story_check_inn_success"
  | "story_check_inn_fail"
  | "story_check_mountain_success"
  | "story_check_mountain_fail"
  | "story_check_innkeeper_success"
  | "story_check_innkeeper_fail"
  | "story_check_generic_success"
  | "story_check_generic_fail"
  | "mainline_inn_check_requested"
  | "mainline_mountain_check_requested"
  | "mainline_mountain_combat_started"
  | "mainline_ledger_crosscheck"
  | "mainline_innkeeper_rescue_requested"
  | "mainline_shuanger_follow"
  | "mainline_shuanger_stay"
  | "mainline_shuanger_support"
  | "travel_unknown"
  | "travel_locked"
  | "travel_depart"
  | "combat_initiative_win"
  | "combat_initiative_lose"
  | "combat_damage_end"
  | "combat_damage_continue"
  | "combat_hit_end"
  | "combat_hit_success"
  | "combat_hit_fail"
  | "combat_named_start"
  | "combat_generic_start"
  | "suggested_check"
  | "first_action"
  | "default_scene";

export type WorldTextMeta = {
  enemyName?: string;
  targetName?: string;
  locationName?: string;
  enemyTurnSummary?: string;
};

export type WorldResolution = {
  textId: WorldTextId;
  patch: GamePatch;
  meta?: WorldTextMeta;
  textOverride?: string;
  combatFlow?: {
    playerPatch?: GamePatch;
    enemyTurn?: EnemyTurnResult;
  };
};

const TRAVEL_COMMAND = /^前往[“"]?(.+?)[”"]?$/;

function withWorldPatch(state: GameState, globalUpdate: boolean, ...patches: Array<GamePatch | undefined>): GamePatch {
  return mergeGamePatches(advanceWorldLocally(state, globalUpdate), ...patches);
}

function resolveStoryPatch(
  state: GameState,
  globalUpdate: boolean,
  trigger: Parameters<typeof resolveNamelessStoryTrigger>[1],
  ...patches: Array<GamePatch | undefined>
) {
  return withWorldPatch(state, globalUpdate, resolveNamelessStoryTrigger(state, trigger), ...patches);
}

function usesNamelessStory(state: GameState) {
  return state.chapterState.id === "nameless-wanderer-ch1";
}

function buildOriginOpeningPatch(state: GameState): GamePatch | undefined {
  if (usesNamelessStory(state)) return undefined;
  if (state.quests.some((quest) => quest.status === "active")) return undefined;

  const origin = originTemplates.find((entry) => entry.id === state.originId);
  if (!origin) return undefined;

  const questId = `origin-opening:${origin.id}`;
  if (state.storyFlags.includes(`quest:${origin.id}:issued`) || state.questStateMap[questId]?.status === "active") {
    return undefined;
  }

  return {
    questUpdates: [
      {
        id: questId,
        title: origin.firstQuest.title,
        text: origin.firstQuest.text,
        status: "active"
      }
    ],
    questStateUpdates: [
      {
        id: questId,
        status: "active",
        stage: "opening"
      }
    ],
    objectiveUpdate: {
      title: origin.firstQuest.title,
      text: origin.firstQuest.text,
      location: origin.firstQuest.location,
      npc: origin.firstQuest.npc
    },
    chapterStateUpdate: {
      id: state.chapterState.id || `origin:${origin.id}`,
      stage: "opening"
    },
    storyFlagsAdd: [`quest:${origin.id}:issued`],
    systemNote: `首个正式任务已派发：${origin.firstQuest.title}`
  };
}

function resolvePendingStoryCheck(state: GameState, globalUpdate: boolean, success: boolean): WorldResolution {
  const label = state.pendingCheck?.label;

  if (label === "替客栈压住前堂乱局") {
    return {
      textId: success ? "story_check_inn_success" : "story_check_inn_fail",
      patch: resolveStoryPatch(
        state,
        globalUpdate,
        success
          ? { kind: "story_check_passed", checkId: "steady_inn" }
          : { kind: "story_check_failed", checkId: "steady_inn" },
        { pendingCheck: undefined }
      )
    };
  }

  if (label === "追上山道里的书生") {
    return {
      textId: success ? "story_check_mountain_success" : "story_check_mountain_fail",
      patch: resolveStoryPatch(
        state,
        globalUpdate,
        success
          ? { kind: "story_check_passed", checkId: "track_scholar" }
          : { kind: "story_check_failed", checkId: "track_scholar" },
        { pendingCheck: undefined }
      )
    };
  }

  if (label === "救下客栈掌柜") {
    return {
      textId: success ? "story_check_innkeeper_success" : "story_check_innkeeper_fail",
      patch: resolveStoryPatch(
        state,
        globalUpdate,
        success
          ? { kind: "story_check_passed", checkId: "save_innkeeper" }
          : { kind: "story_check_failed", checkId: "save_innkeeper" },
        { pendingCheck: undefined }
      )
    };
  }

  return {
    textId: success ? "story_check_generic_success" : "story_check_generic_fail",
    patch: withWorldPatch(state, globalUpdate, { pendingCheck: undefined })
  };
}

function isAmbushAction(action: string) {
  return includesAny(action, ["偷袭", "伏击", "暗算", "突袭"]);
}

function findMartialArtFromHitLabel(state: GameState, label?: string): MartialArt | undefined {
  if (!label) return undefined;
  return state.character.martialArts.find((art) => label.includes(art.name));
}

function buildTutorialPromptText(state: GameState) {
  if (!isNamelessTutorialCombatStage(state) || !state.combat.active) return undefined;
  if (state.pendingDamage) return "这一手已经打中了。先点开“待伤害”，把这招真正的伤害骰掷出来。";
  if (state.combat.phase === "opening") return "眼下先别忙着叙述，先点开“待先攻”，掷出身法结果，看看这一轮谁先动。";
  if (state.combat.phase === "awaiting_hit_check") return "这一轮该你回手了。先点开“待攻击”，选一门武学掷攻击，命中以后再掷伤害。";
  return "先照着界面上的待判定一步步来，把这一场小斗打完再说。";
}

function maybeStartMainlineChecks(state: GameState, action: string, globalUpdate: boolean, firstActionPatch?: GamePatch): WorldResolution | undefined {
  const atDali = currentLocationId(state) === "dali";
  const atWuliang = currentLocationId(state) === "wuliang";
  const q1Active = hasQuestStatus(state, QUEST_WANDERER_1, "active");
  const q2Active = hasQuestStatus(state, QUEST_WANDERER_2, "active");
  const q3Active = hasQuestStatus(state, QUEST_WANDERER_3, "active");
  const q4Active = hasQuestStatus(state, QUEST_WANDERER_4, "active");
  const q5Active = hasQuestStatus(state, QUEST_WANDERER_5, "active");
  const shuangErStage = routeStage(state, "shuang-er") || "unawakened";

  if (
    atDali &&
    q1Active &&
    includesAny(action, ["客栈", "落脚", "双儿", "掌柜", "帮忙", "安顿", "前堂", "后院"])
  ) {
    return {
      textId: "mainline_inn_check_requested",
      patch: resolveStoryPatch(state, globalUpdate, { kind: "story_check_requested", checkId: "steady_inn" }, firstActionPatch)
    };
  }

  if (
    atWuliang &&
    q2Active &&
    !state.combat.active &&
    includesAny(action, ["无量山", "山道", "追", "书生", "段誉", "木婉清", "风波"])
  ) {
    return {
      textId: "mainline_mountain_check_requested",
      patch: resolveStoryPatch(state, globalUpdate, { kind: "story_check_requested", checkId: "track_scholar" }, firstActionPatch)
    };
  }

  if (
    atWuliang &&
    q3Active &&
    !state.combat.active &&
    includesAny(action, ["出手", "动手", "迎战", "救人", "拦住", "刺客", "追兵"])
  ) {
    return {
      textId: "mainline_mountain_combat_started",
      patch: withWorldPatch(
        state,
        globalUpdate,
        startCombat(state, "black-assassin"),
        firstActionPatch
      )
    };
  }

  if (
    atDali &&
    q4Active &&
    includesAny(action, ["账页", "残页", "账本", "线索", "核对", "茶肆", "阿朱"]) &&
    !hasStoryFlag(state, "story:onUseClue:ledger-fragment")
  ) {
    return {
      textId: "mainline_ledger_crosscheck",
      patch: resolveStoryPatch(state, globalUpdate, { kind: "use_clue", clueId: "ledger-fragment" }, firstActionPatch)
    };
  }

  if (
    atDali &&
    q4Active &&
    shuangErStage === "trust" &&
    !hasStoryFlag(state, "route:shuang-er:owner-saved") &&
    includesAny(action, ["掌柜", "救下", "保护", "客栈", "前堂", "闹事", "回客栈"])
  ) {
    return {
      textId: "mainline_innkeeper_rescue_requested",
      patch: resolveStoryPatch(state, globalUpdate, { kind: "story_check_requested", checkId: "save_innkeeper" }, firstActionPatch)
    };
  }

  if (
    q5Active &&
    hasStoryFlag(state, "route:shuang-er:offered") &&
    includesAny(action, ["带上双儿", "一起走", "跟我走", "同行", "跟着我"])
  ) {
    return {
      textId: "mainline_shuanger_follow",
      patch: resolveStoryPatch(state, globalUpdate, { kind: "story_choice", choiceId: "accept_shuang_er" }, firstActionPatch)
    };
  }

  if (
    q5Active &&
    hasStoryFlag(state, "route:shuang-er:offered") &&
    includesAny(action, ["先留着", "留在客栈", "暂时不带", "不必同行", "以后再说"])
  ) {
    return {
      textId: "mainline_shuanger_stay",
      patch: resolveStoryPatch(state, globalUpdate, { kind: "story_choice", choiceId: "decline_shuang_er" }, firstActionPatch)
    };
  }

  if (
    atDali &&
    (q1Active || q4Active) &&
    (shuangErStage === "trust" || shuangErStage === "partiality") &&
    includesAny(action, ["双儿", "传话", "留意", "打探", "托她", "替我看着", "送药"])
  ) {
    return {
      textId: "mainline_shuanger_support",
      patch: withWorldPatch(state, globalUpdate, buildShuangErSupportPatch(state), firstActionPatch)
    };
  }

  return undefined;
}

function maybeTravel(state: GameState, action: string, globalUpdate: boolean, firstActionPatch?: GamePatch): WorldResolution | undefined {
  const match = action.match(TRAVEL_COMMAND);
  if (!match) return undefined;

  const targetName = match[1].trim();
  const target = findLocationByName(state, targetName);
  if (!target) {
    return {
      textId: "travel_unknown",
      patch: withWorldPatch(state, globalUpdate, firstActionPatch),
      meta: { targetName }
    };
  }

  if (!target.unlocked) {
    return {
      textId: "travel_locked",
      patch: withWorldPatch(state, globalUpdate, firstActionPatch),
      meta: { targetName: target.name }
    };
  }

  return {
    textId: "travel_depart",
    patch: withWorldPatch(
      state,
      globalUpdate,
      firstActionPatch,
      {
        location: target.name,
        objectiveUpdate: {
          location: target.name
        },
        pendingCheck: undefined
      }
    ),
    meta: { targetName: target.name }
  };
}

function maybeEnterGenericCombat(state: GameState, action: string, globalUpdate: boolean, firstActionPatch?: GamePatch): WorldResolution | undefined {
  if (state.combat.active) return undefined;

  const namedEnemy = findNamedEnemy(action);
  const genericCombat = includesAny(action, ["出手", "动手", "迎战", "交手", "攻击", "开打"]);
  if (!namedEnemy && !genericCombat) return undefined;

  const enemyName = namedEnemy?.name || "black-assassin";
  return {
    textId: namedEnemy ? "combat_named_start" : "combat_generic_start",
    patch: withWorldPatch(
      state,
      globalUpdate,
      startCombat(state, enemyName, { skipInitiative: isAmbushAction(action) }),
      firstActionPatch
    ),
    meta: { enemyName: namedEnemy?.name }
  };
}

export function resolveWorldAction(action: string, state: GameState, globalUpdate: boolean): WorldResolution {
  const hit = parseCombatHitResult(action);
  const damage = parseCombatDamageResult(action);
  const namelessStory = usesNamelessStory(state);
  const tutorialStage = isNamelessTutorialCombatStage(state);
  const firstActionPatch = namelessStory
    ? resolveNamelessStoryTrigger(state, { kind: "first_action" })
    : buildOriginOpeningPatch(state);

  if (
    state.combat.active &&
    state.pendingCheck &&
    Number.isNaN(hit.total) &&
    Number.isNaN(damage.total)
  ) {
    const combatCheck = buildCombatActionCheck(state, action);
    if (combatCheck) {
      return {
        textId: "default_scene",
        patch: withWorldPatch(state, globalUpdate, { pendingCheck: combatCheck.pendingCheck }),
        meta: { enemyName: state.combat.enemy, locationName: currentLocationName(state) },
        textOverride: combatCheck.promptText
      };
    }
  }

  if (state.combat.active && state.pendingDamage && !Number.isNaN(damage.total)) {
    const playerPatch = resolveCombatDamage(state, damage);
    if (playerPatch.combatAction === "exit") {
      const storyPatch = namelessStory
        ? resolveNamelessStoryTrigger(state, { kind: "combat_win", enemyName: state.combat.enemy })
        : undefined;
      return {
        textId: tutorialStage ? "default_scene" : "combat_damage_end",
        patch: withWorldPatch(state, globalUpdate, playerPatch, storyPatch),
        meta: { enemyName: state.combat.enemy, locationName: currentLocationName(state) },
        textOverride: tutorialStage ? buildNamelessTutorialTransitionText("won") : undefined
      };
    }

    const enemyTurn = resolveEnemyTurn(state);
      return {
        textId: tutorialStage ? "default_scene" : "combat_damage_continue",
        patch: withWorldPatch(
          state,
          globalUpdate,
        playerPatch,
        enemyTurn.patch,
        tutorialStage ? { objectiveUpdate: buildNamelessTutorialObjective("repeat") } : undefined
      ),
        meta: {
          enemyName: state.combat.enemy,
          enemyTurnSummary: enemyTurn.summary,
          locationName: currentLocationName(state)
        },
        combatFlow: {
          playerPatch,
          enemyTurn
        },
        textOverride: tutorialStage
          ? `这一击已经落了实，可对方还没倒。别急着乱，等他这一轮回过手，你仍照旧先选武学、再掷攻击，命中后再掷伤害。`
          : undefined
      };
    }

  if (state.combat.active && !Number.isNaN(hit.total) && !Number.isNaN(hit.dc) && state.combat.phase === "opening") {
    const initiativePatch = resolveCombatInitiative(state, hit);
    if (hit.success) {
      return {
        textId: tutorialStage ? "default_scene" : "combat_initiative_win",
        patch: withWorldPatch(
          state,
          globalUpdate,
          initiativePatch,
          tutorialStage ? { objectiveUpdate: buildNamelessTutorialObjective("attack") } : undefined
        ),
        meta: { enemyName: state.combat.enemy, locationName: currentLocationName(state) },
        textOverride: tutorialStage
          ? "先手在你手里。看清楚了：战斗不是一口气掷完，接下来要先选一门武学掷攻击。命中之后，才轮到掷伤害。"
          : undefined
      };
    }

    const enemyTurn = resolveEnemyTurn(state, false);
    return {
      textId: tutorialStage ? "default_scene" : "combat_initiative_lose",
      patch: withWorldPatch(
        state,
        globalUpdate,
        initiativePatch,
        enemyTurn.patch,
        tutorialStage ? { objectiveUpdate: buildNamelessTutorialObjective("attack") } : undefined
      ),
      meta: {
        enemyName: state.combat.enemy,
        enemyTurnSummary: enemyTurn.summary,
        locationName: currentLocationName(state)
      },
      combatFlow: {
        playerPatch: initiativePatch,
        enemyTurn
      },
      textOverride: tutorialStage
        ? "这一轮先手被对方抢去了，也不要慌。等他这一手过去，立刻轮到你回手：先选武学掷攻击，中了再掷伤害。"
        : undefined
    };
  }

  if (state.combat.active && !Number.isNaN(hit.total) && !Number.isNaN(hit.dc) && state.combat.phase === "awaiting_hit_check") {
    const matchedArt = findMartialArtFromHitLabel(state, hit.label);
    if (hit.success && matchedArt) {
      return {
        textId: tutorialStage ? "default_scene" : "combat_hit_success",
        patch: withWorldPatch(
          state,
          globalUpdate,
          prepareCombatDamageRoll(matchedArt, action, 0, Boolean(hit.isCritical), state.character),
          tutorialStage ? { objectiveUpdate: buildNamelessTutorialObjective("damage") } : undefined,
          {
            systemNote: hit.isCritical ? `${matchedArt.name}打出了暴击。` : `${matchedArt.name}这一招命中了。`
          }
        ),
        meta: { enemyName: state.combat.enemy, locationName: currentLocationName(state) },
        textOverride: tutorialStage
          ? `这一招已经打中了。记住，命中还不算完，下一步要掷 ${matchedArt.name} 的伤害骰，把这一击真正落到实处。`
          : undefined
      };
    }

    const attackPatch = resolveCombatHit(state, hit);
    const enemyTurn = resolveEnemyTurn(state);
    return {
      textId: tutorialStage ? "default_scene" : hit.success ? "combat_hit_success" : "combat_hit_fail",
      patch: withWorldPatch(
        state,
        globalUpdate,
        attackPatch,
        enemyTurn.patch,
        tutorialStage ? { objectiveUpdate: buildNamelessTutorialObjective("repeat") } : undefined
      ),
      meta: {
        enemyName: state.combat.enemy,
        enemyTurnSummary: enemyTurn.summary,
        locationName: currentLocationName(state)
      },
      combatFlow: {
        playerPatch: attackPatch,
        enemyTurn
      },
      textOverride: tutorialStage
        ? "这一击没有打实。战斗里失手原也寻常，先稳住，等这一轮过去，再照旧选武学掷攻击，命中后再掷伤害。"
        : undefined
    };
  }

  if (state.pendingCheck && !state.combat.active && !Number.isNaN(hit.total) && !Number.isNaN(hit.dc)) {
    return resolvePendingStoryCheck(state, globalUpdate, hit.success);
  }

  if (tutorialStage && state.combat.active && state.pendingCheck && Number.isNaN(hit.total) && Number.isNaN(damage.total)) {
    return {
      textId: "default_scene",
      patch: withWorldPatch(state, globalUpdate),
      meta: { locationName: currentLocationName(state) },
      textOverride: buildTutorialPromptText(state)
    };
  }

  const mainline = namelessStory
    ? maybeStartMainlineChecks(state, action, globalUpdate, firstActionPatch)
    : undefined;
  if (mainline) return mainline;

  if (tutorialStage && state.combat.active) {
    return {
      textId: "default_scene",
      patch: withWorldPatch(state, globalUpdate),
      meta: { locationName: currentLocationName(state) },
      textOverride: buildTutorialPromptText(state)
    };
  }

  const martialArtStory = resolveMartialArtStoryAction(state, action);
  if (martialArtStory) {
    return {
      textId: "default_scene",
      patch: withWorldPatch(state, globalUpdate, firstActionPatch, martialArtStory.patch),
      meta: { locationName: currentLocationName(state) },
      textOverride: martialArtStory.text
    };
  }

  const travel = maybeTravel(state, action, globalUpdate, firstActionPatch);
  if (travel) return travel;

  const genericCombat = maybeEnterGenericCombat(state, action, globalUpdate, firstActionPatch);
  if (genericCombat) return genericCombat;

  const suggestedCheck = buildSuggestedCheck(action);
  if (suggestedCheck) {
    return {
      textId: "suggested_check",
      patch: withWorldPatch(state, globalUpdate, firstActionPatch, { pendingCheck: suggestedCheck })
    };
  }

  if (firstActionPatch) {
    return {
      textId: "first_action",
      patch: withWorldPatch(state, globalUpdate, firstActionPatch, { pendingCheck: undefined })
    };
  }

  return {
    textId: "default_scene",
    patch: withWorldPatch(state, globalUpdate, { pendingCheck: undefined }),
    meta: { locationName: currentLocationName(state) }
  };
}
