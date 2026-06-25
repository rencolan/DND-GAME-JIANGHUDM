import type {
  ChapterState,
  GamePatch,
  GameState,
  LocalStoryTrigger,
  NamelessWandererChapterStage,
  ObjectiveHint,
  PendingCheck,
  Quest,
  QuestStateNode
} from "../../types";
import { buildStudyRouteReward } from "./martialArtRoutes";

export const NAMELESS_WANDERER_CHAPTER_ID = "nameless-wanderer-ch1";
export const NAMELESS_WANDERER_TUTORIAL_ENEMY = "拦路泼皮";
export const QUEST_WANDERER_1 = "quest-wanderer-1";
export const QUEST_WANDERER_2 = "quest-wanderer-2";
export const QUEST_WANDERER_3 = "quest-wanderer-3";
export const QUEST_WANDERER_4 = "quest-wanderer-4";
export const QUEST_WANDERER_5 = "quest-wanderer-5";
export const QUEST_WANDERER_6 = "quest-wanderer-6";
export const QUEST_WANDERER_7 = "quest-wanderer-7";
export const QUEST_WANDERER_8 = "quest-wanderer-8";
export const QUEST_WANDERER_9 = "quest-wanderer-9";
export const QUEST_WANDERER_10 = "quest-wanderer-10";
export const QUEST_WANDERER_11 = "quest-wanderer-11";
export const QUEST_WANDERER_12 = "quest-wanderer-12";

const ROUTE_SHUANGER = "shuang-er";
const ROUTE_AZI = "a-zi";
export const CHECK_STEADY_INN = "steady_inn";
export const CHECK_TRACK_SCHOLAR = "track_scholar";
export const CHECK_SAVE_INNKEEPER = "save_innkeeper";
export const CHECK_GUSU_LEDGER = "gusu_ledger";
export const CHECK_MURONG_TRACE = "murong_trace";
export const CHECK_DOCK_INFILTRATION = "dock_infiltration";
export const CHECK_SHAOSHI_YANMEN = "shaoshi_yanmen";
export const CHECK_XINGXIU_TRAIL = "xingxiu_trail";
export const CHECK_HAN_DU = "han_du";
export const CHECK_FINAL_PREP = "final_prep";
const CHOICE_ACCEPT_SHUANGER = "accept_shuang_er";
const CHOICE_DECLINE_SHUANGER = "decline_shuang_er";
const CHOICE_TRUST_AZI = "trust_a_zi";
const CHOICE_USE_AZI = "use_a_zi";
const CHOICE_GUARD_AZI = "guard_a_zi";

const openingObjective: ObjectiveHint = {
  title: "入局引导",
  text: "先在客栈落脚，看看掌柜、双儿和无量山的风声。",
  location: "大理城"
};

type MainQuestBlueprint = {
  id: string;
  questTitle: string;
  questText: string;
  objectiveTitle: string;
  objectiveText: string;
  location: string;
  npc?: string;
  stage: NamelessWandererChapterStage;
};

export type StoryCheckId =
  | typeof CHECK_STEADY_INN
  | typeof CHECK_TRACK_SCHOLAR
  | typeof CHECK_SAVE_INNKEEPER
  | typeof CHECK_GUSU_LEDGER
  | typeof CHECK_MURONG_TRACE
  | typeof CHECK_DOCK_INFILTRATION
  | typeof CHECK_SHAOSHI_YANMEN
  | typeof CHECK_XINGXIU_TRAIL
  | typeof CHECK_HAN_DU
  | typeof CHECK_FINAL_PREP;

type StoryChoiceId =
  | typeof CHOICE_ACCEPT_SHUANGER
  | typeof CHOICE_DECLINE_SHUANGER
  | typeof CHOICE_TRUST_AZI
  | typeof CHOICE_USE_AZI
  | typeof CHOICE_GUARD_AZI;

export type NamelessStoryTrigger =
  | { kind: "first_action" }
  | { kind: "quest_resolved"; questId: string }
  | { kind: "combat_win"; enemyName?: string }
  | { kind: "use_clue"; clueId: string }
  | { kind: "story_check_requested"; checkId: StoryCheckId }
  | { kind: "story_check_passed"; checkId: StoryCheckId }
  | { kind: "story_check_failed"; checkId: StoryCheckId }
  | { kind: "story_choice"; choiceId: StoryChoiceId };

const mainQuestBlueprints: Record<string, MainQuestBlueprint> = {
  [QUEST_WANDERER_1]: {
    id: QUEST_WANDERER_1,
    questTitle: "客栈歇脚",
    questText: "你原本只想在大理客栈歇一晚脚，却发现掌柜、双儿和往来旅人都在盯着无量山的风声。",
    objectiveTitle: "先在客栈落脚",
    objectiveText: "和掌柜、双儿接触，稳住客栈前堂后院，确认无量山的传闻到底牵动了谁。",
    location: "大理城",
    npc: "双儿",
    stage: "first_assignment"
  },
  [QUEST_WANDERER_2]: {
    id: QUEST_WANDERER_2,
    questTitle: "无量山风声",
    questText: "客栈里的新消息不对劲。无量山似有书生和黑衣女子卷进追兵，你得顺着风声赶过去。",
    objectiveTitle: "前往无量山追踪",
    objectiveText: "沿无量山山道追查，找到书生与黑衣女子留下的痕迹，判断追兵来路。",
    location: "无量山",
    npc: "段誉",
    stage: "track_shadow"
  },
  [QUEST_WANDERER_3]: {
    id: QUEST_WANDERER_3,
    questTitle: "山道援手",
    questText: "无量山的局势已从探查变成正面冲突。段誉和木婉清被追兵咬住，你得先挡下这一轮。",
    objectiveTitle: "挡住黑衣刺客",
    objectiveText: "在无量山山道击退追兵，保住段誉与木婉清，别让线索断在眼前。",
    location: "无量山",
    npc: "段誉",
    stage: "black_assassin_fight"
  },
  [QUEST_WANDERER_4]: {
    id: QUEST_WANDERER_4,
    questTitle: "茶肆对证",
    questText: "黑衣刺客身上的残破账页不是杂物。你得回大理找阿朱和掌柜，把水路暗记与人证对上。",
    objectiveTitle: "回大理核对线索",
    objectiveText: "带着残破账页回大理，去茶肆与客栈交叉对证，确认水路暗记指向何处。",
    location: "大理城",
    npc: "阿朱",
    stage: "tea_house_followup"
  },
  [QUEST_WANDERER_5]: {
    id: QUEST_WANDERER_5,
    questTitle: "双儿去留",
    questText: "掌柜把双儿郑重托付到你面前。带她同路，还是让她继续留在客栈，这一章的尾声由你定下。",
    objectiveTitle: "决定双儿去留",
    objectiveText: "和双儿、掌柜把话说定，给大理线收一个口，再动身去姑苏。",
    location: "大理城",
    npc: "双儿",
    stage: "tea_house_followup"
  },
  [QUEST_WANDERER_6]: {
    id: QUEST_WANDERER_6,
    questTitle: "姑苏水路",
    questText: "残页上的水路暗记把你带到姑苏。阿朱认得接头记号，王语嫣或许能辨出背后的武学门路。",
    objectiveTitle: "核对姑苏水路暗记",
    objectiveText: "抵达姑苏后找阿朱与王语嫣，确认黑衣刺客背后不是普通买命。",
    location: "姑苏",
    npc: "王语嫣",
    stage: "gusu_investigation"
  },
  [QUEST_WANDERER_7]: {
    id: QUEST_WANDERER_7,
    questTitle: "燕子坞辨招",
    questText: "王语嫣从残页和伤痕里拆出两股痕迹：一股像星宿毒功，一股像吐蕃高僧的内劲。",
    objectiveTitle: "请王语嫣辨招",
    objectiveText: "在燕子坞水榭核对剑痕、指劲和毒功门路，理清姑苏线的真正走向。",
    location: "姑苏",
    npc: "王语嫣",
    stage: "gusu_investigation"
  },
  [QUEST_WANDERER_8]: {
    id: QUEST_WANDERER_8,
    questTitle: "夜探码头",
    questText: "姑苏码头夜里有人接头。若能潜进去，或许能拿到英雄帖伪稿和星宿密册残页。",
    objectiveTitle: "潜入姑苏码头",
    objectiveText: "夜探接头点，避开水路埋伏；若暴露，就击退码头刺客。",
    location: "姑苏",
    npc: "阿朱",
    stage: "dock_infiltration"
  },
  [QUEST_WANDERER_9]: {
    id: QUEST_WANDERER_9,
    questTitle: "少室雁门借势",
    questText: "星宿线牵得太深。虚竹能给内功线索，乔峰能判断实战破局，你得先借两处势。",
    objectiveTitle: "求少室与雁门援势",
    objectiveText: "走少室见虚竹，去雁门见乔峰，补足终章前的内功与正面破局准备。",
    location: "少室山",
    npc: "虚竹",
    stage: "shaoshi_yanmen_prelude"
  },
  [QUEST_WANDERER_10]: {
    id: QUEST_WANDERER_10,
    questTitle: "星宿海追线",
    questText: "阿紫露面了。她不可信，却知道星宿海里谁在替丁春秋收线。",
    objectiveTitle: "追入星宿海",
    objectiveText: "在星宿海追查密册残页，决定如何对待阿紫，并摸清游坦之寒毒线。",
    location: "星宿海",
    npc: "阿紫",
    stage: "xingxiu_pursuit"
  },
  [QUEST_WANDERER_11]: {
    id: QUEST_WANDERER_11,
    questTitle: "寒毒与化功",
    questText: "游坦之身上的寒毒与丁春秋的化功大法连在一处。先压住这股寒毒，才能逼出终局。",
    objectiveTitle: "破寒毒化功前局",
    objectiveText: "击退游坦之或星宿护法，拿到化功残篇和护心解毒准备。",
    location: "星宿海",
    npc: "游坦之",
    stage: "xingxiu_pursuit"
  },
  [QUEST_WANDERER_12]: {
    id: QUEST_WANDERER_12,
    questTitle: "星宿终局",
    questText: "丁春秋终于亲自下场。此战不只看武功，也看你一路留下的人心、线索和准备。",
    objectiveTitle: "迎战丁春秋",
    objectiveText: "终章决战已经避不开。整理护心解毒散、武学线索和同伴助力，正面迎战丁春秋。",
    location: "星宿海",
    npc: "丁春秋",
    stage: "final_confrontation"
  }
};

const legacyStageMap: Record<string, NamelessWandererChapterStage> = {
  tutorial_story: "tutorial_story",
  tutorial_combat: "tutorial_combat",
  intro: "intro",
  "inn-settled": "first_assignment",
  "wuliang-rumor": "track_shadow",
  "mountain-crisis": "black_assassin_fight",
  "return-inn": "tea_house_followup",
  "owner-saved": "tea_house_followup",
  "shuang-er-offered": "tea_house_followup",
  "shuang-er-choice": "tea_house_followup",
  first_assignment: "first_assignment",
  track_shadow: "track_shadow",
  black_assassin_fight: "black_assassin_fight",
  tea_house_followup: "tea_house_followup",
  to_gusu: "to_gusu",
  gusu_investigation: "gusu_investigation",
  dock_infiltration: "dock_infiltration",
  shaoshi_yanmen_prelude: "shaoshi_yanmen_prelude",
  xingxiu_pursuit: "xingxiu_pursuit",
  final_confrontation: "final_confrontation",
  chapter_resolved: "chapter_resolved",
  ending_resolved: "ending_resolved",
  "chapter-complete": "chapter_resolved"
};

function hasQuestStatus(state: GameState, questId: string, status?: Quest["status"]) {
  const inList = state.quests.some((quest) => quest.id === questId && (!status || quest.status === status));
  const inState = state.questStateMap[questId];
  return inList || Boolean(inState && (!status || inState.status === status));
}

function hasStoryFlag(state: GameState, flag: string) {
  return state.storyFlags.includes(flag);
}

function hasArt(state: GameState, artId: string) {
  return state.character.martialArts.some((art) => art.id === artId);
}

export function isNamelessTutorialStage(state: Pick<GameState, "chapterState">) {
  return state.chapterState.id === NAMELESS_WANDERER_CHAPTER_ID
    && (state.chapterState.stage === "tutorial_story" || state.chapterState.stage === "tutorial_combat");
}

export function isNamelessTutorialCombatStage(state: Pick<GameState, "chapterState">) {
  return state.chapterState.id === NAMELESS_WANDERER_CHAPTER_ID && state.chapterState.stage === "tutorial_combat";
}

export function buildNamelessTutorialBackground(name: string) {
  const hero = name.trim() || "无名客";
  return `【说书人】话说江湖之上，成名人物各有门第来历，或出王侯公卿之家，或自名山古刹之中，偏你 ${hero} 无门无派，只带一身还算硬朗的筋骨，和几招半生不熟的江湖把式，在风尘里走南闯北。你曾在滇西旧道上替一个受伤商旅挡过一回横祸。也正是那一夜，刀光在雨里一闪，才教你真正明白：江湖饭并不是那么好吃的。那时前路泥泞，身后是翻倒的车，前头却有泼皮提棍拦路，张口便要你留下财物和性命。偏那商旅早已伤得抬不起头，这一口气若不由你替他撑住，只怕两条命都要交代在荒山野雨之间。`;
}

export function buildNamelessTutorialCombatIntroText(name: string) {
  const hero = name.trim() || "无名客";
  return `【说书人】说时迟，那泼皮把棍梢往泥地里一顿，溅得泥水四散，冷笑道：“瞧你也不像什么豪杰，偏要来充这份好汉。”破车旁那商旅蜷作一团，连喘息都压在喉间。${hero} 心知此时再退半步，今晚便再无退路可言。既如此，便只好收住杂念，先争这一手。`;
}

export function buildNamelessTutorialObjective(step: "story" | "initiative" | "attack" | "damage" | "repeat"): ObjectiveHint {
  if (step === "story") {
    return {
      title: "旧事前缘",
      text: "先看清无名客这一段旧事。定一定神，再进入眼前这场拦路小斗。",
      location: "旧路回闪"
    };
  }
  if (step === "initiative") {
    return {
      title: "教学第一步：抢先攻",
      text: "先点开待先攻，掷一次身法（DEX）。谁先抢到这一步，谁就先动手。",
      location: "旧路回闪"
    };
  }
  if (step === "attack") {
    return {
      title: "教学第二步：掷攻击",
      text: "轮到你出手时，先选一门武学做攻击判定。命中以后，才会进入伤害结算。",
      location: "旧路回闪"
    };
  }
  if (step === "damage") {
    return {
      title: "教学第三步：掷伤害",
      text: "命中并不等于已经造成伤害。继续掷出这招的伤害骰，才算真正打实。",
      location: "旧路回闪"
    };
  }
  return {
    title: "继续战斗",
    text: "一轮没打完也正常。照旧先掷攻击，命中后再掷伤害，直到把拦路泼皮打退。",
    location: "旧路回闪"
  };
}

export function buildNamelessTutorialTransitionText(kind: "won" | "skipped") {
  const prelude = kind === "won"
    ? "那一架打到后来，你总算护住了自己，也护住了那点不肯轻易折断的心气。自此以后，你愈发明白，江湖路上要活命，靠不得旁人，只能靠自己先把架子立稳。"
    : "那段旧事你未必愿意细想，可江湖人心里都明白，真正叫人长记性的，从来不是说书人口里的热闹，而是刀口擦身那一瞬的冷。";
  return `【说书人】${prelude}\n【说书人】大理城里人声未歇，无量山那边的风波却已经吹到了客栈门口。你先歇脚，先看人，再决定自己要不要踏进这摊麻烦。`;
}

export function buildNamelessTutorialCompletionPatch(kind: "won" | "skipped"): GamePatch {
  return {
    silverChange: kind === "won" ? 5 : undefined,
    location: "大理城",
    sceneType: "inn",
    objectiveUpdate: openingObjective,
    chapterStateUpdate: setChapterStage("intro"),
    storyFlagsAdd: [
      kind === "won" ? "tutorial:completed" : "tutorial:skipped",
      stageFlag("intro")
    ],
    storyFlagsRemove: ["tutorial:active"],
    pendingCheck: undefined,
    pendingDamage: undefined,
    combatAction: "exit",
    combatUpdate: {
      phase: "ended",
      stakes: "旧路上的凶险已经压下，眼前该先寻个安稳落脚处。"
    },
    systemNote: kind === "won"
      ? "教学战斗已完成，正式开场已经接上。"
      : "你跳过了教学战斗，正式开场已经接上。"
  };
}

function hasRouteStage(state: GameState, stage: string) {
  return state.relationshipRoutes[ROUTE_SHUANGER]?.stage === stage;
}

function stageFlag(stage: NamelessWandererChapterStage) {
  return `chapter:nameless-wanderer:${stage}`;
}

function triggerFlag(trigger: LocalStoryTrigger, detail: string) {
  return `story:${trigger}:${detail}`;
}

function buildObjective(questId: string): ObjectiveHint | undefined {
  const quest = mainQuestBlueprints[questId];
  return quest
    ? {
      title: quest.objectiveTitle,
      text: quest.objectiveText,
      location: quest.location,
      npc: quest.npc
    }
    : undefined;
}

function buildQuestStateUpdate(questId: string, status: Quest["status"], stage?: string): QuestStateNode | undefined {
  const quest = mainQuestBlueprints[questId];
  return quest
    ? {
      id: questId,
      status,
      stage: stage || quest.stage
    }
    : undefined;
}

function buildQuestUpdate(questId: string, status: Quest["status"]): Partial<Quest> | undefined {
  const quest = mainQuestBlueprints[questId];
  return quest
    ? {
      id: quest.id,
      title: quest.questTitle,
      text: quest.questText,
      status
    }
    : undefined;
}

function setChapterStage(stage: NamelessWandererChapterStage): Partial<ChapterState> {
  return {
    id: NAMELESS_WANDERER_CHAPTER_ID,
    stage
  };
}

function mergeRewardPatch(base: GamePatch, reward: GamePatch | undefined): GamePatch {
  if (!reward) return base;
  return {
    ...base,
    hpChange: (base.hpChange || 0) + (reward.hpChange || 0) || undefined,
    qiChange: (base.qiChange || 0) + (reward.qiChange || 0) || undefined,
    qiRecovery: (base.qiRecovery || 0) + (reward.qiRecovery || 0) || undefined,
    cultivationRankChange: (base.cultivationRankChange || 0) + (reward.cultivationRankChange || 0) || undefined,
    itemChanges: [...(base.itemChanges || []), ...(reward.itemChanges || [])],
    studyAdd: [...(base.studyAdd || []), ...(reward.studyAdd || [])],
    studySourceAdd: [...(base.studySourceAdd || []), ...(reward.studySourceAdd || [])],
    storyFlagsAdd: [...(base.storyFlagsAdd || []), ...(reward.storyFlagsAdd || [])],
    rumorAdd: [...(base.rumorAdd || []), ...(reward.rumorAdd || [])],
    systemNote: [base.systemNote, reward.systemNote].filter(Boolean).join(" ")
  };
}

function withStudyRewards(state: GameState, base: GamePatch, routeIds: string[], options: { force?: boolean } = {}) {
  return routeIds.reduce((patch, routeId) => mergeRewardPatch(patch, buildStudyRouteReward(state, routeId, options)), base);
}

function buildCheck(checkId: StoryCheckId, label: string, dc: number, abilityKey: PendingCheck["abilityKey"], reason: string, risk: string, suggestedAction: string): GamePatch {
  return {
    pendingCheck: {
      checkId,
      label,
      abilityKey,
      dc,
      reason,
      risk,
      suggestedAction
    }
  };
}

function activateNextQuest(currentQuestId: string, nextQuestId: string, nextStage: NamelessWandererChapterStage, extra: GamePatch = {}): GamePatch {
  const currentQuest = buildQuestUpdate(currentQuestId, "resolved");
  const nextQuest = buildQuestUpdate(nextQuestId, "active");
  const currentState = buildQuestStateUpdate(currentQuestId, "resolved");
  const nextState = buildQuestStateUpdate(nextQuestId, "active");
  return {
    ...extra,
    questUpdates: [
      ...(extra.questUpdates || []),
      ...([currentQuest, nextQuest].filter(Boolean) as Partial<Quest>[])
    ],
    questStateUpdates: [
      ...(extra.questStateUpdates || []),
      ...([currentState, nextState].filter(Boolean) as QuestStateNode[])
    ],
    objectiveUpdate: extra.objectiveUpdate || buildObjective(nextQuestId),
    chapterStateUpdate: setChapterStage(nextStage),
    storyFlagsAdd: [
      ...(extra.storyFlagsAdd || []),
      triggerFlag("onQuestResolved", currentQuestId),
      stageFlag(nextStage)
    ]
  };
}

function resolveFirstAction(state: GameState): GamePatch | undefined {
  if (state.chapterState.id !== NAMELESS_WANDERER_CHAPTER_ID) return undefined;
  if (isNamelessTutorialStage(state)) return undefined;
  if (hasStoryFlag(state, triggerFlag("onFirstAction", QUEST_WANDERER_1))) return undefined;
  if (Object.keys(mainQuestBlueprints).some((questId) => hasQuestStatus(state, questId))) return undefined;

  const questUpdate = buildQuestUpdate(QUEST_WANDERER_1, "active");
  const questStateUpdate = buildQuestStateUpdate(QUEST_WANDERER_1, "active");
  return {
    questUpdates: questUpdate ? [questUpdate] : undefined,
    questStateUpdates: questStateUpdate ? [questStateUpdate] : undefined,
    objectiveUpdate: buildObjective(QUEST_WANDERER_1),
    chapterStateUpdate: setChapterStage("first_assignment"),
    storyFlagsAdd: [
      triggerFlag("onFirstAction", QUEST_WANDERER_1),
      stageFlag("first_assignment")
    ],
    systemNote: "第一条正式主线任务已派发：先在大理客栈站稳脚跟，再决定要不要卷进无量山风波。"
  };
}

function resolveQuestResolved(state: GameState, questId: string): GamePatch | undefined {
  if (state.chapterState.id !== NAMELESS_WANDERER_CHAPTER_ID) return undefined;

  if (questId === QUEST_WANDERER_1) {
    const patch = activateNextQuest(QUEST_WANDERER_1, QUEST_WANDERER_2, "track_shadow", {
      relationshipChanges: [
        { name: "双儿", delta: 8, attitude: "信任" },
        { name: "掌柜", delta: 4, attitude: "看重" }
      ],
      npcUpdates: [
        { name: "双儿", hidden: false, discovered: true, status: "在客栈帮忙，手边常备针线药囊" }
      ],
      npcStoryUpdates: [
        { name: "双儿", state: "revealed" }
      ],
      relationshipRouteUpdates: [
        {
          npcId: ROUTE_SHUANGER,
          kind: "retainer",
          active: true,
          stage: "trust",
          note: "你替客栈稳住了场面，双儿和掌柜都开始把你当成靠得住的人。",
          supportUnlocked: ["care", "medicine", "stash", "message", "practice"]
        }
      ],
      storyFlagsAdd: ["route:shuang-er:trust"],
      systemNote: "客栈暂时稳住。掌柜这才把后院安静做事的丫鬟介绍给你：她叫双儿。下一步该顺着风声去无量山。"
    });
    return withStudyRewards(state, patch, ["dali-heart-manual", "renxue-shou-inn", "jianghu-daolu-inn"], { force: true });
  }

  if (questId === QUEST_WANDERER_2) {
    const patch = activateNextQuest(QUEST_WANDERER_2, QUEST_WANDERER_3, "black_assassin_fight", {
      npcUpdates: [
        { name: "段誉", hidden: false, discovered: true, status: "在慌乱中护着身边的人，不肯独自脱身" },
        { name: "木婉清", hidden: false, discovered: true, status: "压弩戒备，始终盯着追兵下一步动作" }
      ],
      npcStoryUpdates: [
        { name: "段誉", state: "revealed" },
        { name: "木婉清", state: "revealed" }
      ],
      relationshipChanges: [
        { name: "段誉", delta: 6, attitude: "感激" },
        { name: "木婉清", delta: 4, attitude: "戒备" }
      ],
      relationshipRouteUpdates: [
        { npcId: "duan-yu", kind: "bond", active: true, stage: "met", note: "你在无量山乱局里第一次见到段誉，也看出他不是会丢下同伴的人。", supportUnlocked: [] },
        { npcId: "mu-wanqing", kind: "bond", active: true, stage: "met", note: "木婉清嘴冷手快，已把你这次伸手记在心里。", supportUnlocked: [] }
      ],
      storyFlagsAdd: ["npc:duan-yu:met", "npc:mu-wanqing:met"],
      systemNote: "无量山的探查已变成正面冲突。你正式卷进段誉和木婉清那边的乱局。"
    });
    return withStudyRewards(state, patch, ["duanjia-jianfa", "wuliang-jianfa"], { force: true });
  }

  if (questId === QUEST_WANDERER_4) {
    return resolveStoryCheckPassed(state, CHECK_SAVE_INNKEEPER);
  }

  if (questId === QUEST_WANDERER_6) {
    const patch = activateNextQuest(QUEST_WANDERER_6, QUEST_WANDERER_7, "gusu_investigation", {
      npcUpdates: [
        { name: "阿朱", hidden: false, discovered: true, status: "在姑苏水路替你查暗记来历" },
        { name: "王语嫣", hidden: false, discovered: true, status: "愿意替你辨认账页背后的武学门路" },
        { name: "慕容复", hidden: false, discovered: true, status: "在燕子坞观望来客分量" }
      ],
      npcStoryUpdates: [
        { name: "阿朱", state: "revealed" },
        { name: "王语嫣", state: "revealed" },
        { name: "慕容复", state: "revealed" }
      ],
      relationshipChanges: [
        { name: "阿朱", delta: 6, attitude: "亲近" },
        { name: "王语嫣", delta: 4, attitude: "谨慎" }
      ],
      itemChanges: [
        { itemId: "watermark-map", delta: 1, item: { name: "水路暗记图", type: "quest", desc: "阿朱替你誊出的水路暗记，几处墨点最终都压向姑苏码头。", count: 1, canSell: false } }
      ],
      systemNote: "姑苏水路暗记已被对上。阿朱确认接头点在夜里的码头，王语嫣则看出账页背后藏着星宿毒功和吐蕃内劲两条影子。"
    });
    return withStudyRewards(state, patch, ["murong-jianfa", "canhe-zhi", "xiaowuxiang-hint"], { force: true });
  }

  if (questId === QUEST_WANDERER_7) {
    const patch = activateNextQuest(QUEST_WANDERER_7, QUEST_WANDERER_8, "dock_infiltration", {
      storyFlagsAdd: ["gusu:martial-trace-confirmed", "boss:jiu-mozhi:rumored"],
      rumorAdd: [
        { text: "吐蕃高僧鸠摩智近日在姑苏附近问经寻谱，火焰刀的压迫感已经让燕子坞也不敢掉以轻心。", kind: "hook", location: "姑苏", npc: "鸠摩智", source: "local-mainline" },
        { text: "王语嫣从伤痕里拆出星宿毒功的影子，真正的线头很可能已经伸向星宿海。", kind: "hook", location: "姑苏", npc: "王语嫣", source: "local-mainline" }
      ],
      systemNote: "王语嫣已替你辨清两条高阶痕迹：鸠摩智只是压场，真正收线的人更像来自星宿海。"
    });
    return withStudyRewards(state, patch, ["jiu-huoyandao-hint"], { force: true });
  }

  if (questId === QUEST_WANDERER_8) {
    const patch = activateNextQuest(QUEST_WANDERER_8, QUEST_WANDERER_9, "shaoshi_yanmen_prelude", {
      locationUnlockUpdates: [
        { locationId: "shaoshi", reason: "quest" },
        { locationId: "yanmen", reason: "quest" }
      ],
      itemChanges: [
        { itemId: "hero-invitation-draft", delta: 1, item: { name: "英雄帖伪稿", type: "quest", desc: "姑苏码头搜出的伪稿，背后像是在替星宿海点名。", count: 1, canSell: false } },
        { itemId: "xingxiu-secret-page", delta: 1, item: { name: "星宿密册残页", type: "manual", desc: "残页上夹着毒掌、摘星手和化功大法的零碎门路。", count: 1, canSell: false, dangerous: true, manualArtId: "zhaixing-shou", studySourceKind: "manual", routeKey: "dex", accessLevel: "manual", requiredProgress: 4, tier: "upper_prelude" } }
      ],
      npcUpdates: [
        { name: "虚竹", hidden: false, discovered: true, status: "在少室山外护送密信" },
        { name: "乔峰", discovered: true, status: "在雁门一带追查旧案，也留意星宿动向" }
      ],
      npcStoryUpdates: [
        { name: "虚竹", state: "revealed" },
        { name: "乔峰", state: "available" }
      ],
      systemNote: "姑苏码头线已破。英雄帖伪稿和星宿密册残页把局面推向少室、雁门与星宿海。"
    });
    return withStudyRewards(state, patch, ["zhaixing-can"], { force: true });
  }

  if (questId === QUEST_WANDERER_9) {
    const patch = activateNextQuest(QUEST_WANDERER_9, QUEST_WANDERER_10, "xingxiu_pursuit", {
      locationUnlockUpdates: [
        { locationId: "xingxiu", reason: "quest" }
      ],
      relationshipChanges: [
        { name: "虚竹", delta: 6, attitude: "相助" },
        { name: "乔峰", delta: 6, attitude: "认可" }
      ],
      storyFlagsAdd: ["prep:shaoshi-yanmen-complete"],
      systemNote: "少室与雁门两处势已借到。虚竹给你稳内息的法门，乔峰替你看明正面破局的关键。星宿海该去了。"
    });
    return withStudyRewards(state, patch, ["luohan-quan", "weituo-chu", "taizu-changquan", "lianhua-zhang", "xianglong-prelude"], { force: true });
  }

  if (questId === QUEST_WANDERER_10) {
    const patch = activateNextQuest(QUEST_WANDERER_10, QUEST_WANDERER_11, "xingxiu_pursuit", {
      npcUpdates: [
        { name: "阿紫", hidden: false, discovered: true, status: "在星宿海边缘替自己找退路，也盯着你能不能活下来" },
        { name: "游坦之", hidden: false, discovered: true, status: "寒毒缠身，正被星宿门人当作一枚狠棋" }
      ],
      npcStoryUpdates: [
        { name: "阿紫", state: "revealed" },
        { name: "游坦之", state: "revealed" }
      ],
      relationshipRouteUpdates: [
        { npcId: ROUTE_AZI, kind: "bond", active: true, stage: "met", note: "阿紫不可信，却知道星宿海里许多别人不敢说的话。", supportUnlocked: [] }
      ],
      storyFlagsAdd: ["npc:a-zi:met", "npc:you-tanzhi:met"],
      systemNote: "阿紫已经露面。你得决定是信她、利用她，还是一路防着她。无论如何，游坦之身上的寒毒都指向丁春秋。"
    });
    return withStudyRewards(state, patch, ["xingxiu-duzhang", "sanyin-wugong-zhua"], { force: true });
  }

  if (questId === QUEST_WANDERER_11) {
    const patch = activateNextQuest(QUEST_WANDERER_11, QUEST_WANDERER_12, "final_confrontation", {
      itemChanges: [
        { itemId: "huagong-fragment", delta: 1, item: { name: "化功残篇", type: "quest", desc: "只露一角的化功法门，足以让人明白丁春秋如何封人内息。", count: 1, canSell: false, dangerous: true } },
        { itemId: "final-antidote", delta: 1, item: { name: "护心解毒散", type: "consumable", desc: "终战前调成的护心解毒散，可缓住化功与寒毒的余劲。", count: 1, usable: true, curesStatus: ["poisoned", "cold"], innerInjuryRestore: 14, combatActionCost: 1, canSell: false } }
      ],
      storyFlagsAdd: ["prep:final-antidote", "boss:ding-chunqiu:revealed"],
      npcUpdates: [
        { name: "丁春秋", hidden: false, discovered: true, status: "终于亲自下场，毒雾已压到眼前" }
      ],
      systemNote: "寒毒前局已破，你拿到护心解毒散和化功残篇。丁春秋终于被逼到明面上。"
    });
    return withStudyRewards(state, patch, ["huagong-hint"], { force: true });
  }

  return undefined;
}

function resolveCombatWin(state: GameState, enemyName?: string): GamePatch | undefined {
  if (state.chapterState.id !== NAMELESS_WANDERER_CHAPTER_ID) return undefined;
  if (isNamelessTutorialCombatStage(state) && (!enemyName || enemyName.includes(NAMELESS_WANDERER_TUTORIAL_ENEMY))) {
    return buildNamelessTutorialCompletionPatch("won");
  }
  if (hasQuestStatus(state, QUEST_WANDERER_3, "active") && (!enemyName || enemyName.includes("黑衣刺客"))) {
    const resolved = buildQuestUpdate(QUEST_WANDERER_3, "resolved");
    const nextQuest = buildQuestUpdate(QUEST_WANDERER_4, "active");
    const patch: GamePatch = {
      questUpdates: [resolved, nextQuest].filter(Boolean) as Partial<Quest>[],
      questStateUpdates: [
        { id: QUEST_WANDERER_3, status: "resolved", stage: "black_assassin_fight" },
        { id: QUEST_WANDERER_4, status: "active", stage: "tea_house_followup" }
      ],
      objectiveUpdate: buildObjective(QUEST_WANDERER_4),
      newItem: { id: "ledger-fragment", name: "残破账页", desc: "从黑衣刺客身上搜出的残页，上面留着水路暗记和几处接头记号。", count: 1, type: "quest" },
      storyFlagsAdd: ["combat:wuliang-pursuers:won", "npc:duan-yu:saved", "npc:mu-wanqing:met", triggerFlag("onCombatWin", QUEST_WANDERER_3), stageFlag("tea_house_followup")],
      cultivationRankChange: 1,
      chapterStateUpdate: setChapterStage("tea_house_followup"),
      systemNote: "无量山这一场先压住了。你也拿到了黑衣刺客身上的残破账页，下一步该尽快回大理，把线索和人证对起来。"
    };
    return withStudyRewards(state, patch, ["zhuifeng-jianlu", "beiming-prelude"], { force: true });
  }
  if (hasQuestStatus(state, QUEST_WANDERER_8, "active") && enemyName?.includes("姑苏码头刺客")) {
    return resolveQuestResolved(state, QUEST_WANDERER_8);
  }
  if (hasQuestStatus(state, QUEST_WANDERER_11, "active") && (enemyName?.includes("游坦之") || enemyName?.includes("星宿护法"))) {
    return resolveQuestResolved(state, QUEST_WANDERER_11);
  }
  if (hasQuestStatus(state, QUEST_WANDERER_12, "active") && enemyName?.includes("丁春秋")) {
    return buildEndingPatch(state, "won");
  }
  return undefined;
}

function resolveUseClue(state: GameState, clueId: string): GamePatch | undefined {
  if (state.chapterState.id !== NAMELESS_WANDERER_CHAPTER_ID) return undefined;
  if (clueId === "ledger-fragment" && hasQuestStatus(state, QUEST_WANDERER_4, "active") && !hasStoryFlag(state, triggerFlag("onUseClue", clueId))) {
    return {
      rumorAdd: [
        { text: "残页上的水路暗记不像临时涂写，更像有人故意留给熟门熟路的人看的接头标记。", kind: "hook", location: "大理城", npc: "阿朱", source: "local-mainline" },
        { text: "阿朱认得几处暗记最终都朝姑苏水路去。若想继续追下去，迟早得走这一趟。", kind: "location_lead", location: "姑苏", npc: "阿朱", source: "local-mainline" }
      ],
      storyFlagsAdd: [triggerFlag("onUseClue", clueId)],
      systemNote: "你已确认这页残账不是寻常杂物，而是一条能继续往下追的真线索。"
    };
  }
  return undefined;
}

function resolveStoryCheckRequested(state: GameState, checkId: StoryCheckId): GamePatch | undefined {
  if (state.chapterState.id !== NAMELESS_WANDERER_CHAPTER_ID) return undefined;
  const checks: Record<StoryCheckId, GamePatch> = {
    [CHECK_STEADY_INN]: buildCheck(CHECK_STEADY_INN, "替客栈压住前堂乱局", 12, "cha", "前堂后院都有人心浮动，你得让闹事的人闭嘴，也让店里的人重新各归其位。", "若失败，掌柜会看轻你，双儿也会替你担心。", "可以硬压场面，也可借机说服、喝住或拆开闹事的人。"),
    [CHECK_TRACK_SCHOLAR]: buildCheck(CHECK_TRACK_SCHOLAR, "追上山道里的书生", 13, "dex", "山道窄得只能容两三人并肩，再慢半步，就只剩凌乱脚印。", "若失败，你会落后一程，下一场冲突更被动。", "先用身法追上，也可借地形抄近一步。"),
    [CHECK_SAVE_INNKEEPER]: buildCheck(CHECK_SAVE_INNKEEPER, "救下客栈掌柜", 14, "dex", "闹事的人来得又快又狠，你若慢半步，掌柜和客栈都会出事。", "若失败，掌柜会受伤，双儿也会被卷进去。", "先抢身位护住掌柜，也可借桌椅门框拆掉对方来势。"),
    [CHECK_GUSU_LEDGER]: buildCheck(CHECK_GUSU_LEDGER, "核对姑苏水路暗记", 13, "int", "水路暗记故意写得半明半暗，需要把阿朱的见闻和账页一处处对上。", "若失败，线索仍会推进，但会给对方更多反应时间。", "请阿朱辨记号，再请王语嫣看招式门路。"),
    [CHECK_MURONG_TRACE]: buildCheck(CHECK_MURONG_TRACE, "燕子坞辨招", 14, "int", "剑痕、指劲、毒功和刀气夹在一处，得拆清哪条是真线。", "若失败，你会误判一部分威胁，终章压力提高。", "请王语嫣拆招，也可自己按武学痕迹推演。"),
    [CHECK_DOCK_INFILTRATION]: buildCheck(CHECK_DOCK_INFILTRATION, "夜探姑苏码头", 15, "dex", "水雾里有人接头，潜得越近，越能拿到真东西。", "若失败，会直接惊动码头刺客。", "用身法潜入，或借阿朱易容绕过眼线。"),
    [CHECK_SHAOSHI_YANMEN]: buildCheck(CHECK_SHAOSHI_YANMEN, "少室雁门借势", 14, "cha", "虚竹和乔峰都不是随便会被说动的人，你得把来龙去脉讲明。", "若失败，仍能得到线索，但少一分人心助力。", "先讲星宿毒功，再讲英雄帖伪稿。"),
    [CHECK_XINGXIU_TRAIL]: buildCheck(CHECK_XINGXIU_TRAIL, "追入星宿海", 15, "wis", "星宿海风向、毒雾和人心都不正，最怕自己先乱。", "若失败，你会带着毒伤进入下一阶段。", "稳住心神，辨毒雾方向，再判断阿紫话里真假。"),
    [CHECK_HAN_DU]: buildCheck(CHECK_HAN_DU, "压住寒毒前局", 15, "con", "游坦之身上的寒毒硬缠，不能被他拖到真气乱流。", "若失败，终战会带着更重内伤。", "以根骨硬撑，或用护心调息先压毒。"),
    [CHECK_FINAL_PREP]: buildCheck(CHECK_FINAL_PREP, "终战前整备", 14, "wis", "丁春秋要打的是你的内息和心神，终战前必须把护心解毒散与武学线索理清。", "若失败，也能开战，但会少一层防护。", "整理护心解毒散、化功残篇和可用同伴助力。")
  };
  return checks[checkId];
}

function resolveStoryCheckPassed(state: GameState, checkId: StoryCheckId): GamePatch | undefined {
  if (state.chapterState.id !== NAMELESS_WANDERER_CHAPTER_ID) return undefined;
  if (checkId === CHECK_STEADY_INN) return resolveQuestResolved(state, QUEST_WANDERER_1);
  if (checkId === CHECK_TRACK_SCHOLAR) return resolveQuestResolved(state, QUEST_WANDERER_2);
  if (checkId === CHECK_SAVE_INNKEEPER && hasQuestStatus(state, QUEST_WANDERER_4, "active")) {
    return offerShuangErPatch(state, false);
  }
  if (checkId === CHECK_GUSU_LEDGER) return resolveQuestResolved(state, QUEST_WANDERER_6);
  if (checkId === CHECK_MURONG_TRACE) return resolveQuestResolved(state, QUEST_WANDERER_7);
  if (checkId === CHECK_DOCK_INFILTRATION) return resolveQuestResolved(state, QUEST_WANDERER_8);
  if (checkId === CHECK_SHAOSHI_YANMEN) return resolveQuestResolved(state, QUEST_WANDERER_9);
  if (checkId === CHECK_XINGXIU_TRAIL) return resolveQuestResolved(state, QUEST_WANDERER_10);
  if (checkId === CHECK_HAN_DU) return resolveQuestResolved(state, QUEST_WANDERER_11);
  if (checkId === CHECK_FINAL_PREP) {
    return {
      storyFlagsAdd: ["prep:final-ready"],
      systemNote: "终战前准备完成。你可以正面迎战丁春秋了。"
    };
  }
  return undefined;
}

function resolveStoryCheckFailed(state: GameState, checkId: StoryCheckId): GamePatch | undefined {
  if (state.chapterState.id !== NAMELESS_WANDERER_CHAPTER_ID) return undefined;
  const progress = resolveStoryCheckPassed(state, checkId);
  if (!progress) return undefined;
  const complication = `complication:${checkId}`;
  return {
    ...progress,
    hpChange: (progress.hpChange || 0) - 2,
    innerInjuryChange: (progress.innerInjuryChange || 0) + (["han_du", "xingxiu_trail", "final_prep"].includes(checkId) ? 6 : 0),
    storyFlagsAdd: [...(progress.storyFlagsAdd || []), complication, triggerFlag("onStoryCheckFailed", checkId)],
    systemNote: `${progress.systemNote || "主线继续推进。"} 这一步没走得干净，后续会多一层压力。`
  };
}

function offerShuangErPatch(_state: GameState, ownerWounded: boolean): GamePatch {
  return {
    questUpdates: [
      { id: QUEST_WANDERER_4, status: "resolved" },
      { id: QUEST_WANDERER_5, title: mainQuestBlueprints[QUEST_WANDERER_5].questTitle, text: mainQuestBlueprints[QUEST_WANDERER_5].questText, status: "active" }
    ],
    questStateUpdates: [
      { id: QUEST_WANDERER_4, status: "resolved", stage: ownerWounded ? "owner-wounded" : "owner-saved" },
      { id: QUEST_WANDERER_5, status: "active", stage: ownerWounded ? "shuang-er-offered-wounded" : "shuang-er-offered" }
    ],
    objectiveUpdate: buildObjective(QUEST_WANDERER_5),
    relationshipChanges: [
      { name: "双儿", delta: ownerWounded ? 6 : 10, attitude: ownerWounded ? "担心" : "偏心" },
      { name: "掌柜", delta: ownerWounded ? 2 : 6, attitude: "托付" }
    ],
    npcUpdates: [
      { name: "双儿", hidden: false, discovered: true, recruitable: true, status: ownerWounded ? "一边照看掌柜，一边等你把去留说定" : "只等你一句话，便可随你同行" }
    ],
    relationshipRouteUpdates: [
      {
        npcId: ROUTE_SHUANGER,
        kind: "retainer",
        active: true,
        stage: "partiality",
        allowCompanion: true,
        note: ownerWounded ? "掌柜受了伤，双儿对你更担心，也更难把自己从客栈里拔出来。" : "你救下掌柜后，双儿被正式托付给你，只等你愿不愿带她走。",
        supportUnlocked: ownerWounded ? ["care", "medicine", "message", "guard"] : ["care", "medicine", "stash", "message", "practice", "guard"]
      }
    ],
    storyFlagsAdd: [
      ownerWounded ? "route:shuang-er:owner-wounded" : "route:shuang-er:owner-saved",
      "route:shuang-er:offered",
      "route:shuang-er:partiality",
      triggerFlag("onStoryCheckPassed", CHECK_SAVE_INNKEEPER)
    ],
    cultivationRankChange: ownerWounded ? undefined : 1,
    chapterStateUpdate: setChapterStage("tea_house_followup"),
    systemNote: ownerWounded
      ? "掌柜受了伤，双儿把这桩事牢牢记在心里。主线继续推进，但她的随行会带着客栈后患。"
      : "掌柜承了你的命，也把双儿郑重托付到你面前。大理这边的第一章收口，现在落到你的选择上。"
  };
}

function resolveStoryChoice(state: GameState, choiceId: StoryChoiceId): GamePatch | undefined {
  if (state.chapterState.id !== NAMELESS_WANDERER_CHAPTER_ID) return undefined;

  if ((choiceId === CHOICE_ACCEPT_SHUANGER || choiceId === CHOICE_DECLINE_SHUANGER) && hasQuestStatus(state, QUEST_WANDERER_5, "active")) {
    const follow = choiceId === CHOICE_ACCEPT_SHUANGER;
    return {
      questUpdates: [
        { id: QUEST_WANDERER_5, status: "resolved" },
        buildQuestUpdate(QUEST_WANDERER_6, "active")!
      ],
      objectiveUpdate: buildObjective(QUEST_WANDERER_6),
      rumorAdd: [
        { text: "残页最后几处接头记号都压在姑苏水路一带，阿朱让你尽快过去，别让线头断在半路。", kind: "location_lead", location: "姑苏", npc: "阿朱", source: "local-mainline" },
        { text: "慕容复和王语嫣或许认得账页背后的武学路数，姑苏这一趟不只是查人，也是在查招。", kind: "hook", location: "姑苏", npc: "王语嫣", source: "local-mainline" }
      ],
      npcUpdates: [
        { name: "双儿", companion: follow, recruitable: true, hidden: false, discovered: true, status: follow ? "奉掌柜之命，安静地跟在你身边" : "仍在客栈等你回头叫她" }
      ],
      npcStoryUpdates: [
        { name: "双儿", state: follow ? "companion" : "available" }
      ],
      relationshipChanges: follow ? [{ name: "双儿", delta: 6, attitude: "依随" }] : undefined,
      relationshipRouteUpdates: [
        {
          npcId: ROUTE_SHUANGER,
          kind: "retainer",
          active: true,
          stage: follow ? "follow" : "partiality",
          allowCompanion: true,
          note: follow ? "掌柜把她交给你，而她也自愿把自己放在你身边。" : "你暂时没有带她走，但她已经为你留了位置。",
          supportUnlocked: follow ? ["care", "medicine", "stash", "message", "practice", "guard", "housekeeping", "escort"] : ["care", "medicine", "stash", "message", "practice", "housekeeping"]
        }
      ],
      storyFlagsAdd: [
        follow ? "route:shuang-er:follow" : "route:shuang-er:declined",
        "chapter:one:complete",
        stageFlag("to_gusu")
      ],
      locationUnlockUpdates: [
        { locationId: "gusu", reason: "quest" }
      ],
      questStateUpdates: [
        { id: QUEST_WANDERER_5, status: "resolved", stage: follow ? "accepted-shuang-er" : "declined-for-now" },
        { id: QUEST_WANDERER_6, status: "active", stage: "to_gusu" }
      ],
      chapterStateUpdate: setChapterStage("to_gusu"),
      systemNote: follow
        ? "你收下了双儿，大理这条线正式把你推向姑苏。"
        : "你暂时没有带走双儿，但残页和水路暗记已经把下一程推向姑苏。"
    };
  }

  if ([CHOICE_TRUST_AZI, CHOICE_USE_AZI, CHOICE_GUARD_AZI].includes(choiceId) && hasQuestStatus(state, QUEST_WANDERER_10, "active")) {
    const trust = choiceId === CHOICE_TRUST_AZI;
    const use = choiceId === CHOICE_USE_AZI;
    return {
      storyFlagsAdd: [trust ? "route:a-zi:trusted" : use ? "route:a-zi:used" : "route:a-zi:guarded"],
      relationshipChanges: [{ name: "阿紫", delta: trust ? 8 : use ? 3 : -2, attitude: trust ? "好奇" : use ? "互相利用" : "防备" }],
      relationshipRouteUpdates: [
        { npcId: ROUTE_AZI, kind: "bond", active: true, stage: trust ? "trust" : "met", note: trust ? "你选择先信阿紫一回，她未必感激，却开始认真看你。" : use ? "你和阿紫都知道彼此不可靠，但此刻目标暂时一致。" : "你防着阿紫，她也笑着防你。", supportUnlocked: trust ? ["poison_hint"] : [] }
      ],
      systemNote: trust ? "你暂且信了阿紫一回，她指出了星宿护法巡路的缺口。" : use ? "你决定利用阿紫的消息，同时不把后背交给她。" : "你一路防着阿紫，少了捷径，却也少一分被她牵着走的风险。"
    };
  }
  return undefined;
}

function endingText(state: GameState) {
  const shuangErFollow = hasStoryFlag(state, "route:shuang-er:follow");
  const aZiTrusted = hasStoryFlag(state, "route:a-zi:trusted");
  const observedJiu = hasStoryFlag(state, "boss:jiu-mozhi:observed");
  const strongPrep = hasStoryFlag(state, "prep:final-ready") || hasStoryFlag(state, "prep:final-antidote");
  const hasHighHint = hasArt(state, "canhe-zhi") || hasArt(state, "dali-xinfa") || hasArt(state, "xingxiu-duzhang");
  const ending = shuangErFollow && aZiTrusted && strongPrep
    ? "双儿替你收住余毒，阿紫难得没有转身就跑。星宿海风停时，你身边仍有人。"
    : shuangErFollow
      ? "双儿一言不发替你包好伤口。江湖仍大，但你不再只是孤身上路。"
      : aZiTrusted
        ? "阿紫远远笑了一声，像是嘲你命硬，又像是终于把你当成一个能活到下回的人。"
        : observedJiu || hasHighHint
          ? "你赢得不轻松，却也借这一战看清宗师之间真正的门槛。"
          : "你终于胜了，身上伤痕却也明白告诉你：这一路是险胜，不是传奇。";
  return `【说书人】丁春秋倒退半步，毒雾被夜风撕开。星宿弟子终于不敢再笑，远处水泽一片死寂。\n【说书人】${ending}\n【说书人】无名客入江湖，未必能留下多响亮的名号；可你走过大理、无量、姑苏、少室、雁门与星宿，终究把一条本该吞人的线，硬生生扯断在自己手里。`;
}

function buildEndingPatch(state: GameState, kind: "won" | "survived"): GamePatch {
  return {
    questUpdates: [{ id: QUEST_WANDERER_12, status: "resolved" }],
    questStateUpdates: [{ id: QUEST_WANDERER_12, status: "resolved", stage: kind }],
    objectiveUpdate: {
      title: "终局已定",
      text: "丁春秋已败，星宿线暂告收束。你可以整理余波，也可以继续在江湖中行走。",
      location: "星宿海"
    },
    chapterStateUpdate: setChapterStage("ending_resolved"),
    storyFlagsAdd: ["ending:nameless-wanderer:resolved", kind === "won" ? "ending:ding-chunqiu-defeated" : "ending:survived"],
    pendingCheck: undefined,
    pendingDamage: undefined,
    combatAction: "exit",
    cultivationRankChange: 2,
    rumorAdd: [
      { text: "星宿海那一夜之后，丁春秋门下笑声收敛了许多，江湖上也开始有人追问那个无名客究竟是谁。", kind: "rumor", location: "星宿海", source: "ending" }
    ],
    systemNote: endingText(state)
  };
}

export function resolveNamelessStoryTrigger(state: GameState, trigger: NamelessStoryTrigger): GamePatch | undefined {
  switch (trigger.kind) {
    case "first_action":
      return resolveFirstAction(state);
    case "quest_resolved":
      return resolveQuestResolved(state, trigger.questId);
    case "combat_win":
      return resolveCombatWin(state, trigger.enemyName);
    case "use_clue":
      return resolveUseClue(state, trigger.clueId);
    case "story_check_requested":
      return resolveStoryCheckRequested(state, trigger.checkId);
    case "story_check_passed":
      return resolveStoryCheckPassed(state, trigger.checkId);
    case "story_check_failed":
      return resolveStoryCheckFailed(state, trigger.checkId);
    case "story_choice":
      return resolveStoryChoice(state, trigger.choiceId);
    default:
      return undefined;
  }
}

export function normalizeNamelessWandererStage(stage: string | undefined): NamelessWandererChapterStage {
  if (!stage) return "intro";
  return legacyStageMap[stage] || "intro";
}

export function normalizeChapterStateForNameless(state: ChapterState | undefined): ChapterState {
  if (!state || state.id !== NAMELESS_WANDERER_CHAPTER_ID) {
    return {
      id: NAMELESS_WANDERER_CHAPTER_ID,
      stage: "intro"
    };
  }
  return {
    ...state,
    stage: normalizeNamelessWandererStage(String(state.stage))
  };
}
