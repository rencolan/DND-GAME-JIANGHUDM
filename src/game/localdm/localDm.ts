import { startCombat, resolveCombatDamage, resolveCombatHit } from "../combat";
import { advanceWorldLocally, mergeGamePatches } from "../engine";
import {
  QUEST_WANDERER_1,
  QUEST_WANDERER_2,
  QUEST_WANDERER_3,
  QUEST_WANDERER_4,
  QUEST_WANDERER_5,
  resolveNamelessStoryTrigger
} from "../story/namelessWanderer";
import type { GamePatch, GameState } from "../../types";
import {
  buildShuangErSupportPatch,
  buildSuggestedCheck,
  currentLocationId,
  currentLocationName,
  findLocationByName,
  findNamedEnemy,
  hasQuestStatus,
  hasStoryFlag,
  includesAny,
  parseDamageResult,
  parseHitResult,
  routeStage
} from "./helpers";

type LocalDmResult = {
  text: string;
  patch: GamePatch;
};

const TRAVEL_COMMAND = /^前往[「\[（(]?(.+?)[」\]）)]?$/;

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

function resolvePendingStoryCheck(state: GameState, globalUpdate: boolean, success: boolean): LocalDmResult | undefined {
  const label = state.pendingCheck?.label;
  if (!label) return undefined;

  if (label === "替客栈压住前堂乱局") {
    return {
      text: success ? "The inn settles under your hand." : "The inn is still unstable.",
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
      text: success ? "You close the distance on the mountain trail." : "You are still half a step behind.",
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
      text: success ? "You pull the innkeeper clear." : "The rescue falls short.",
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
    text: success ? "The roll carries the scene forward." : "The roll leaves the scene unresolved.",
    patch: withWorldPatch(state, globalUpdate, { pendingCheck: undefined })
  };
}

function maybeStartMainlineChecks(state: GameState, action: string, globalUpdate: boolean, firstActionPatch?: GamePatch): LocalDmResult | undefined {
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
      text: "You step into the inn's unrest and force the scene to clarify.",
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
      text: "The mountain trail tightens and the chase becomes immediate.",
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
      text: "The pursuit turns into open combat on the mountain path.",
      patch: withWorldPatch(
        state,
        globalUpdate,
        startCombat(state, "black-assassin", {
          label: "接下黑衣刺客的起手",
          abilityKey: "dex",
          martialArtId: "enemy-dagger",
          dc: 14,
          reason: "追兵已经压到面前，必须先把起手挡住。",
          risk: "如果失败，你会先吃下一记狠手并失去位置。",
          enemyIntent: "刺客想先打穿你，再把后面的人拖走。",
          suggestedAction: "可以抢身位拆招，也可以直接迎上去。",
          systemNote: "无量山山道上的追杀已经正面撞上来了。"
        }),
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
      text: "You begin cross-checking the ledger clue back in Dali.",
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
      text: "The rescue window opens in the inn before the scene collapses.",
      patch: resolveStoryPatch(state, globalUpdate, { kind: "story_check_requested", checkId: "save_innkeeper" }, firstActionPatch)
    };
  }

  if (
    q5Active &&
    hasStoryFlag(state, "route:shuang-er:offered") &&
    includesAny(action, ["带上双儿", "一起走", "跟我走", "同行", "跟着我"])
  ) {
    return {
      text: "You choose to let Shuang'er follow you onward.",
      patch: resolveStoryPatch(state, globalUpdate, { kind: "story_choice", choiceId: "accept_shuang_er" }, firstActionPatch)
    };
  }

  if (
    q5Active &&
    hasStoryFlag(state, "route:shuang-er:offered") &&
    includesAny(action, ["先留下", "留在客栈", "暂时不带", "不必同行", "以后再说"])
  ) {
    return {
      text: "You leave Shuang'er at the inn for now.",
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
      text: "Shuang'er quietly handles the loose ends before you need to ask twice.",
      patch: withWorldPatch(state, globalUpdate, buildShuangErSupportPatch(state), firstActionPatch)
    };
  }

  return undefined;
}

function maybeTravel(state: GameState, action: string, globalUpdate: boolean, firstActionPatch?: GamePatch): LocalDmResult | undefined {
  const match = action.match(TRAVEL_COMMAND);
  if (!match) return undefined;

  const targetName = match[1].trim();
  const target = findLocationByName(state, targetName);
  if (!target) {
    return {
      text: "That destination is still too vague. Clarify where you want to go.",
      patch: withWorldPatch(state, globalUpdate, firstActionPatch)
    };
  }

  if (!target.unlocked) {
    return {
      text: `${target.name} is not meaningfully unlocked yet.`,
      patch: withWorldPatch(state, globalUpdate, firstActionPatch)
    };
  }

  return {
    text: `You set out for ${target.name}.`,
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
    )
  };
}

function maybeEnterGenericCombat(state: GameState, action: string, globalUpdate: boolean, firstActionPatch?: GamePatch): LocalDmResult | undefined {
  if (state.combat.active) return undefined;

  const namedEnemy = findNamedEnemy(action);
  const genericCombat = includesAny(action, ["出手", "动手", "迎战", "交手", "攻击", "开打"]);
  if (!namedEnemy && !genericCombat) return undefined;

  const enemyName = namedEnemy?.name || "black-assassin";
  return {
    text: namedEnemy ? `Combat begins against ${namedEnemy.name}.` : "Combat begins.",
    patch: withWorldPatch(state, globalUpdate, startCombat(state, enemyName), firstActionPatch)
  };
}

export function localDm(action: string, state: GameState, globalUpdate: boolean): LocalDmResult {
  const hit = parseHitResult(action);
  const damage = parseDamageResult(action);
  const firstActionPatch = resolveNamelessStoryTrigger(state, { kind: "first_action" });

  if (state.combat.active && state.pendingDamage && !Number.isNaN(damage.total)) {
    const combatPatch = resolveCombatDamage(state, damage);
    const storyPatch = combatPatch.combatAction === "exit"
      ? resolveNamelessStoryTrigger(state, { kind: "combat_win", enemyName: state.combat.enemy })
      : undefined;

    return {
      text: combatPatch.combatAction === "exit"
        ? "The fight breaks in your favor and the immediate danger is over."
        : "The strike lands, but the fight is still live.",
      patch: withWorldPatch(state, globalUpdate, combatPatch, storyPatch)
    };
  }

  if (state.combat.active && !Number.isNaN(hit.total) && !Number.isNaN(hit.dc)) {
    const combatPatch = resolveCombatHit(state, hit);
    const storyPatch = combatPatch.combatAction === "exit"
      ? resolveNamelessStoryTrigger(state, { kind: "combat_win", enemyName: state.combat.enemy })
      : undefined;

    return {
      text: combatPatch.combatAction === "exit"
        ? "You finish the exchange and end the fight."
        : hit.success
          ? "Your strike lands, but the enemy is still pressuring you."
          : "You fail to seize the exchange and the enemy answers back.",
      patch: withWorldPatch(state, globalUpdate, combatPatch, storyPatch)
    };
  }

  if (state.pendingCheck && !state.combat.active && !Number.isNaN(hit.total) && !Number.isNaN(hit.dc)) {
    const pendingResult = resolvePendingStoryCheck(state, globalUpdate, hit.success);
    if (pendingResult) return pendingResult;
  }

  const mainline = maybeStartMainlineChecks(state, action, globalUpdate, firstActionPatch);
  if (mainline) return mainline;

  const travel = maybeTravel(state, action, globalUpdate, firstActionPatch);
  if (travel) return travel;

  const genericCombat = maybeEnterGenericCombat(state, action, globalUpdate, firstActionPatch);
  if (genericCombat) return genericCombat;

  const suggestedCheck = buildSuggestedCheck(action);
  if (suggestedCheck) {
    return {
      text: "This move needs a clean roll before the scene can settle.",
      patch: withWorldPatch(state, globalUpdate, firstActionPatch, { pendingCheck: suggestedCheck })
    };
  }

  if (firstActionPatch) {
    return {
      text: "Your first move turns the opening scene into a real thread to follow.",
      patch: withWorldPatch(state, globalUpdate, firstActionPatch, { pendingCheck: undefined })
    };
  }

  return {
    text: `You push the local scene forward from ${currentLocationName(state)}.`,
    patch: withWorldPatch(state, globalUpdate, { pendingCheck: undefined })
  };
}
