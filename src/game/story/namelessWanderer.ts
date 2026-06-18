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

export const NAMELESS_WANDERER_CHAPTER_ID = "nameless-wanderer-ch1";
export const NAMELESS_WANDERER_TUTORIAL_ENEMY = "拦路泼皮";
export const QUEST_WANDERER_1 = "quest-wanderer-1";
export const QUEST_WANDERER_2 = "quest-wanderer-2";
export const QUEST_WANDERER_3 = "quest-wanderer-3";
export const QUEST_WANDERER_4 = "quest-wanderer-4";
export const QUEST_WANDERER_5 = "quest-wanderer-5";

const ROUTE_SHUANGER = "shuang-er";
const CHECK_STEADY_INN = "steady_inn";
const CHECK_TRACK_SCHOLAR = "track_scholar";
const CHECK_SAVE_INNKEEPER = "save_innkeeper";
const CHOICE_ACCEPT_SHUANGER = "accept_shuang_er";
const CHOICE_DECLINE_SHUANGER = "decline_shuang_er";

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

type StoryCheckId =
  | typeof CHECK_STEADY_INN
  | typeof CHECK_TRACK_SCHOLAR
  | typeof CHECK_SAVE_INNKEEPER;

type StoryChoiceId =
  | typeof CHOICE_ACCEPT_SHUANGER
  | typeof CHOICE_DECLINE_SHUANGER;

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
    questText: "你原本只想在大理客栈歇一晚脚，却发现掌柜、双儿和往来旅人都在盯着无量山的风声。先在客栈站稳脚跟，弄清这间客栈为何像在等一场将至的麻烦。",
    objectiveTitle: "先在客栈落脚",
    objectiveText: "和掌柜、双儿接触，看看柜台、后院与来客之间流动的消息，确认无量山的传闻究竟牵动了谁。",
    location: "大理城",
    npc: "双儿",
    stage: "first_assignment"
  },
  [QUEST_WANDERER_2]: {
    id: QUEST_WANDERER_2,
    questTitle: "无量山风声",
    questText: "客栈里传来的新消息不对劲。无量山那边似乎有一名书生和一位黑衣女子卷进追兵，你需要顺着风声赶过去，确认这场骚动和大理客栈之间到底有什么牵连。",
    objectiveTitle: "前往无量山追踪",
    objectiveText: "沿着无量山一路追查，找到那名书生与黑衣女子留下的踪迹，判断追兵的来路与目的。",
    location: "无量山",
    npc: "段誉",
    stage: "track_shadow"
  },
  [QUEST_WANDERER_3]: {
    id: QUEST_WANDERER_3,
    questTitle: "山道援手",
    questText: "无量山的局势已经从探查变成正面冲突。段誉和黑衣女子都被追兵死死咬住，你必须先替他们挡下这一轮，才能知道他们究竟惹上了谁。",
    objectiveTitle: "挡住黑衣刺客",
    objectiveText: "在无量山山道上击退追兵，保住段誉与木婉清，别让这条线索在你眼前断掉。",
    location: "无量山",
    npc: "段誉",
    stage: "black_assassin_fight"
  },
  [QUEST_WANDERER_4]: {
    id: QUEST_WANDERER_4,
    questTitle: "茶肆对证",
    questText: "黑衣刺客身上搜出的残破账页不是杂物。回到大理茶肆和客栈，对照阿朱、掌柜、双儿手里的见闻，把追兵来路、接头暗记和真正目标拼成一条完整线索。",
    objectiveTitle: "回大理核对线索",
    objectiveText: "带着残破账页回大理，去茶肆与客栈交叉对证，确认账页上的暗记究竟指向谁。",
    location: "大理城",
    npc: "阿朱",
    stage: "tea_house_followup"
  },
  [QUEST_WANDERER_5]: {
    id: QUEST_WANDERER_5,
    questTitle: "双儿去留",
    questText: "掌柜已经把双儿郑重托付到你面前。带她同路，还是让她继续留在大理客栈等你回头，这一章的尾声由你亲口定下。",
    objectiveTitle: "决定双儿去留",
    objectiveText: "和双儿、掌柜把话说定，给这一章的大理线收一个口。",
    location: "大理城",
    npc: "双儿",
    stage: "chapter_resolved"
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
  chapter_resolved: "chapter_resolved",
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

export function isNamelessTutorialStage(state: Pick<GameState, "chapterState">) {
  return state.chapterState.id === NAMELESS_WANDERER_CHAPTER_ID
    && (state.chapterState.stage === "tutorial_story" || state.chapterState.stage === "tutorial_combat");
}

export function isNamelessTutorialCombatStage(state: Pick<GameState, "chapterState">) {
  return state.chapterState.id === NAMELESS_WANDERER_CHAPTER_ID && state.chapterState.stage === "tutorial_combat";
}

export function buildNamelessTutorialBackground(name: string) {
  const hero = name.trim() || "无名客";
  return `【说书人】话说江湖之上，成名人物各有门第来历，或出王侯公卿之家，或自名山古刹之中，偏你${hero}无门无派，只带一身还算硬朗的筋骨，和几招半生不熟的江湖把式，在风尘里走南闯北。你曾在滇西旧道上替一个受伤商旅挡过一回横祸，也正是那一夜，刀光在雨里一闪，才教你真正明白：江湖饭并不是那么好吃的。那时前路泥泞，身后是翻倒的车，前头却有泼皮提棍拦路，口口声声要你留下财物和性命。偏那商旅早已伤得抬不起头，这一口气若不由你替他撑住，只怕两条命都要交代在荒山野雨之间。`;
}

export function buildNamelessTutorialCombatIntroText(name: string) {
  const hero = name.trim() || "无名客";
  return `【说书人】说时迟，那泼皮把棍梢往泥地里一顿，溅得泥水四散，冷笑道：“瞧你也不像什么豪杰，偏要来充这份好汉。”破车旁那商旅蜷作一团，连呻吟都压在喉间。${hero}心知此时再退半步，今夜便再无退路可言。既如此，便只好收住杂念，先争这一手。`;
}

export function buildNamelessTutorialObjective(step: "story" | "initiative" | "attack" | "damage" | "repeat"): ObjectiveHint {
  if (step === "story") {
    return {
      title: "旧事前缘",
      text: "先看清无名客这一段旧事。定一定神，再入眼前这场拦路小斗。",
      location: "旧路回闪"
    };
  }

  if (step === "initiative") {
    return {
      title: "教学第一步：掷先攻",
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
  return `【说书人】${prelude}\n【说书人】大理城里人声未歇，无量山那边的风波却已经吹到了客栈门口。你先歇脚，先看人，再决定自己要不要踩进这摊麻烦。`;
}

export function buildNamelessTutorialCompletionPatch(kind: "won" | "skipped"): GamePatch {
  return {
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
      ? "教学战斗已完成，正式开场接上了。"
      : "你跳过了教学战斗，正式开场已接上。"
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

function buildCheck(label: string, dc: number, abilityKey: PendingCheck["abilityKey"], reason: string, risk: string, suggestedAction: string): GamePatch {
  return {
    pendingCheck: {
      label,
      abilityKey,
      dc,
      reason,
      risk,
      suggestedAction
    }
  };
}

function resolveFirstAction(state: GameState): GamePatch | undefined {
  if (state.chapterState.id !== NAMELESS_WANDERER_CHAPTER_ID) return undefined;
  if (isNamelessTutorialStage(state)) return undefined;
  if (hasStoryFlag(state, triggerFlag("onFirstAction", QUEST_WANDERER_1))) return undefined;
  if (
    hasQuestStatus(state, QUEST_WANDERER_1) ||
    hasQuestStatus(state, QUEST_WANDERER_2) ||
    hasQuestStatus(state, QUEST_WANDERER_3) ||
    hasQuestStatus(state, QUEST_WANDERER_4) ||
    hasQuestStatus(state, QUEST_WANDERER_5)
  ) {
    return undefined;
  }

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
    systemNote: "第一条正式主线任务已派发：先在大理客栈站稳脚跟，再决定要不要卷进无量山的麻烦。"
  };
}

function resolveQuestResolved(state: GameState, questId: string): GamePatch | undefined {
  if (state.chapterState.id !== NAMELESS_WANDERER_CHAPTER_ID) return undefined;

  if (questId === QUEST_WANDERER_1) {
    const resolved = buildQuestUpdate(QUEST_WANDERER_1, "resolved");
    const nextQuest = buildQuestUpdate(QUEST_WANDERER_2, "active");
    const resolvedState = buildQuestStateUpdate(QUEST_WANDERER_1, "resolved", "first_assignment");
    const nextState = buildQuestStateUpdate(QUEST_WANDERER_2, "active");

    return {
      questUpdates: [resolved, nextQuest].filter(Boolean) as Partial<Quest>[],
      questStateUpdates: [resolvedState, nextState].filter(Boolean) as QuestStateNode[],
      objectiveUpdate: buildObjective(QUEST_WANDERER_2),
      relationshipChanges: [
        { name: "双儿", delta: 8, attitude: "信任" }
      ],
      relationshipRouteUpdates: [
        {
          npcId: ROUTE_SHUANGER,
          kind: "retainer",
          active: true,
          stage: "trust",
          note: "你替客栈稳住了场面，双儿和掌柜都开始把你当成真正靠得住的人。",
          supportUnlocked: ["care", "stash", "message"]
        }
      ],
      storyFlagsAdd: [
        "route:shuang-er:trust",
        triggerFlag("onQuestResolved", QUEST_WANDERER_1),
        stageFlag("track_shadow")
      ],
      chapterStateUpdate: setChapterStage("track_shadow"),
      systemNote: "客栈这边暂时稳住了。下一步该顺着风声去无量山，看看那场骚动和你刚落脚的地方到底有没有直接关系。"
    };
  }

  if (questId === QUEST_WANDERER_2) {
    const resolved = buildQuestUpdate(QUEST_WANDERER_2, "resolved");
    const nextQuest = buildQuestUpdate(QUEST_WANDERER_3, "active");
    const resolvedState = buildQuestStateUpdate(QUEST_WANDERER_2, "resolved", "track_shadow");
    const nextState = buildQuestStateUpdate(QUEST_WANDERER_3, "active");

    return {
      questUpdates: [resolved, nextQuest].filter(Boolean) as Partial<Quest>[],
      questStateUpdates: [resolvedState, nextState].filter(Boolean) as QuestStateNode[],
      objectiveUpdate: buildObjective(QUEST_WANDERER_3),
      npcUpdates: [
        { name: "段誉", hidden: false, discovered: true, status: "仍在慌乱中护着身边的人，不肯独自脱身" },
        { name: "木婉清", hidden: false, discovered: true, status: "压弓戒备，始终盯着追兵下一步动作" }
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
        {
          npcId: "duan-yu",
          kind: "bond",
          active: true,
          stage: "met",
          note: "你在无量山的乱局里第一次真正见到了段誉，也看出他并不是会把同伴丢下的人。",
          supportUnlocked: []
        },
        {
          npcId: "mu-wanqing",
          kind: "bond",
          active: true,
          stage: "met",
          note: "你第一次见到木婉清时，她正一身杀气顶在追兵面前，嘴上冷，动作却比谁都快。",
          supportUnlocked: []
        }
      ],
      storyFlagsAdd: [
        "npc:duan-yu:met",
        "npc:mu-wanqing:met",
        triggerFlag("onQuestResolved", QUEST_WANDERER_2),
        stageFlag("black_assassin_fight")
      ],
      chapterStateUpdate: setChapterStage("black_assassin_fight"),
      systemNote: "无量山的探查已经变成正面冲突。你正式卷进了段誉和木婉清那边的乱局，接下来只能先把追兵压住。"
    };
  }

  return undefined;
}

function resolveCombatWin(state: GameState, enemyName?: string): GamePatch | undefined {
  if (state.chapterState.id !== NAMELESS_WANDERER_CHAPTER_ID) return undefined;
  if (isNamelessTutorialCombatStage(state) && (!enemyName || enemyName.includes(NAMELESS_WANDERER_TUTORIAL_ENEMY))) {
    return buildNamelessTutorialCompletionPatch("won");
  }
  if (!hasQuestStatus(state, QUEST_WANDERER_3, "active")) return undefined;
  if (enemyName && !enemyName.includes("黑衣刺客")) return undefined;

  const resolved = buildQuestUpdate(QUEST_WANDERER_3, "resolved");
  const nextQuest = buildQuestUpdate(QUEST_WANDERER_4, "active");
  const resolvedState = buildQuestStateUpdate(QUEST_WANDERER_3, "resolved", "black_assassin_fight");
  const nextState = buildQuestStateUpdate(QUEST_WANDERER_4, "active");

  return {
    questUpdates: [resolved, nextQuest].filter(Boolean) as Partial<Quest>[],
    questStateUpdates: [resolvedState, nextState].filter(Boolean) as QuestStateNode[],
    objectiveUpdate: buildObjective(QUEST_WANDERER_4),
    rumorAdd: [
      {
        text: "段誉提过无量山深处还有石室旧迹，里面留下的步图和运气路数都不像寻常门派传承。",
        kind: "hook",
        location: "无量山",
        npc: "段誉",
        source: "local-mainline"
      },
      {
        text: "无量剑派那边已经有人放出话来，左子穆不会轻易放过今晚进过山谷的人。",
        kind: "rumor",
        location: "无量山",
        source: "local-mainline"
      }
    ],
    npcUpdates: [
      { name: "段誉", discovered: true, hidden: false, status: "被你从山道乱局里护了下来，终于有了喘息的空档" },
      { name: "木婉清", discovered: true, hidden: false, status: "仍旧冷着脸，却明显记住了你这次出手" }
    ],
    npcStoryUpdates: [
      { name: "段誉", state: "revealed" },
      { name: "木婉清", state: "revealed" }
    ],
    relationshipChanges: [
      { name: "段誉", delta: 10, attitude: "感激" },
      { name: "木婉清", delta: 8, attitude: "记下" }
    ],
    relationshipRouteUpdates: [
      {
        npcId: "duan-yu",
        kind: "bond",
        active: true,
        stage: "met",
        note: "你在无量山风波里救下了段誉。他表面还带着慌乱，心里却已经把你当成真正托得住命的人。",
        supportUnlocked: []
      },
      {
        npcId: "mu-wanqing",
        kind: "bond",
        active: true,
        stage: "met",
        note: "木婉清嘴上未必肯认，可她已经把你替她分过这一轮凶险的事记在心里。",
        supportUnlocked: []
      }
    ],
    newItem: {
      id: "ledger-fragment",
      name: "残破账页",
      desc: "从黑衣刺客身上搜出的残页，上面留着不完整的水路暗记和几处像是接头用的记号。",
      count: 1,
      type: "quest"
    },
    storyFlagsAdd: [
      "combat:wuliang-pursuers:won",
      "npc:duan-yu:saved",
      "npc:mu-wanqing:met",
      triggerFlag("onCombatWin", QUEST_WANDERER_3),
      stageFlag("tea_house_followup")
    ],
    chapterStateUpdate: setChapterStage("tea_house_followup"),
    systemNote: "无量山这场先压住了。你也拿到了黑衣刺客身上的残破账页，下一步该尽快回大理，把线索和人证对起来。"
  };
}

function resolveUseClue(state: GameState, clueId: string): GamePatch | undefined {
  if (state.chapterState.id !== NAMELESS_WANDERER_CHAPTER_ID) return undefined;

  if (clueId === "ledger-fragment" && hasQuestStatus(state, QUEST_WANDERER_4, "active") && !hasStoryFlag(state, triggerFlag("onUseClue", clueId))) {
    return {
      rumorAdd: [
        {
          text: "残页上的水路暗记不像临时涂写，更像是有人故意留给熟门熟路的人看的交接标记。它背后牵出来的，不会只是无量山这一场追杀。",
          kind: "hook",
          location: "大理城",
          npc: "阿朱",
          source: "local-mainline"
        },
        {
          text: "阿朱认得几处暗记最终都朝姑苏水路去，若想继续追下去，迟早得走这一趟。",
          kind: "location_lead",
          location: "姑苏",
          npc: "阿朱",
          source: "local-mainline"
        }
      ],
      storyFlagsAdd: [
        triggerFlag("onUseClue", clueId)
      ],
      systemNote: "你已经确认这页残账不是寻常杂物，而是一条能继续往下追的真线索。接下来要做的是把它和大理城里的人证口风对上。"
    };
  }

  return undefined;
}

function resolveStoryCheckRequested(state: GameState, checkId: StoryCheckId): GamePatch | undefined {
  if (state.chapterState.id !== NAMELESS_WANDERER_CHAPTER_ID) return undefined;

  if (checkId === CHECK_STEADY_INN && hasQuestStatus(state, QUEST_WANDERER_1, "active")) {
    return buildCheck(
      "替客栈压住前堂乱局",
      12,
      "cha",
      "前堂后院都乱成一团，你得让闹事的人闭嘴，也让店里的人重新各归其位。",
      "若失败，掌柜会看轻你，双儿也会替你担心。",
      "可以硬压场面，也可以借机说服、喝住或拆开闹事的人。"
    );
  }

  if (checkId === CHECK_TRACK_SCHOLAR && hasQuestStatus(state, QUEST_WANDERER_2, "active")) {
    return buildCheck(
      "追上山道里的书生",
      13,
      "dex",
      "山道窄得只能容两三个人并肩，再慢半步，你就只能看着他们被追进更深处。",
      "若失败，你会落后一程，只能远远看着局势更乱。",
      "先用身法追上，也可借地形抄近一步卡到他们前头。"
    );
  }

  if (
    checkId === CHECK_SAVE_INNKEEPER &&
    hasQuestStatus(state, QUEST_WANDERER_4, "active") &&
    hasRouteStage(state, "trust") &&
    !hasStoryFlag(state, "route:shuang-er:owner-saved")
  ) {
    return buildCheck(
      "救下客栈掌柜",
      14,
      "dex",
      "闹事的人来得又快又狠，你若慢半步，掌柜和客栈都会出事。",
      "若失败，掌柜会受伤，双儿也会被卷进去。",
      "可先抢身位护住掌柜，也可借桌椅门框拆掉对方的来势。"
    );
  }

  return undefined;
}

function resolveStoryCheckPassed(state: GameState, checkId: StoryCheckId): GamePatch | undefined {
  if (state.chapterState.id !== NAMELESS_WANDERER_CHAPTER_ID) return undefined;

  if (checkId === CHECK_STEADY_INN) {
    return resolveQuestResolved(state, QUEST_WANDERER_1);
  }

  if (checkId === CHECK_TRACK_SCHOLAR) {
    return resolveQuestResolved(state, QUEST_WANDERER_2);
  }

  if (
    checkId === CHECK_SAVE_INNKEEPER &&
    hasQuestStatus(state, QUEST_WANDERER_4, "active") &&
    hasRouteStage(state, "trust")
  ) {
    return {
      questUpdates: [
        { id: QUEST_WANDERER_4, status: "resolved" },
        { id: QUEST_WANDERER_5, title: "双儿去留", text: mainQuestBlueprints[QUEST_WANDERER_5].questText, status: "active" }
      ],
      objectiveUpdate: {
        title: "决定双儿去留",
        text: "掌柜已经把双儿郑重托付给你。想清楚，是带她上路，还是让她先留在大理客栈。",
        location: "大理城",
        npc: "双儿"
      },
      rumorAdd: [
        {
          text: "客栈掌柜年轻时多半不是寻常生意人，退下来后才把一身旧路数藏进了账本和茶盏里。",
          kind: "npc_lead",
          location: "大理城",
          source: "local-mainline"
        }
      ],
      relationshipChanges: [
        { name: "双儿", delta: 10, attitude: "偏心" }
      ],
      npcUpdates: [
        { name: "双儿", hidden: false, discovered: true, recruitable: true, status: "只等你一句话，便可随你同行" }
      ],
      relationshipRouteUpdates: [
        {
          npcId: ROUTE_SHUANGER,
          kind: "retainer",
          active: true,
          stage: "partiality",
          allowCompanion: true,
          note: "你救下掌柜后，双儿被正式托付给你，只等你愿不愿意带她走。",
          supportUnlocked: ["care", "stash", "message"]
        }
      ],
      storyFlagsAdd: [
        "route:shuang-er:owner-saved",
        "route:shuang-er:offered",
        "route:shuang-er:partiality",
        triggerFlag("onStoryCheckPassed", checkId)
      ],
      questStateUpdates: [
        { id: QUEST_WANDERER_4, status: "resolved", stage: "owner-saved" },
        { id: QUEST_WANDERER_5, status: "active", stage: "shuang-er-offered" }
      ],
      chapterStateUpdate: setChapterStage("tea_house_followup"),
      systemNote: "掌柜承了你的命，也把双儿郑重托付到了你面前。大理这边的第一章收口，现在落到了你的选择上。"
    };
  }

  return undefined;
}

function resolveStoryCheckFailed(state: GameState, checkId: StoryCheckId): GamePatch | undefined {
  if (state.chapterState.id !== NAMELESS_WANDERER_CHAPTER_ID) return undefined;

  if (checkId === CHECK_SAVE_INNKEEPER) {
    return {
      hpChange: -3,
      relationshipChanges: [
        { name: "双儿", delta: 4, attitude: "担忧" }
      ],
      storyFlagsAdd: [triggerFlag("onStoryCheckFailed", checkId)],
      systemNote: "掌柜受了伤，双儿把这桩事牢牢记在了心里。"
    };
  }

  return undefined;
}

function resolveStoryChoice(state: GameState, choiceId: StoryChoiceId): GamePatch | undefined {
  if (state.chapterState.id !== NAMELESS_WANDERER_CHAPTER_ID) return undefined;
  if (!hasQuestStatus(state, QUEST_WANDERER_5, "active")) return undefined;
  if (!hasStoryFlag(state, "route:shuang-er:offered")) return undefined;

  if (choiceId === CHOICE_ACCEPT_SHUANGER) {
    return {
      questUpdates: [{ id: QUEST_WANDERER_5, status: "resolved" }],
      objectiveUpdate: {
        title: "前往姑苏",
        text: "双儿已经跟上了你。残页上的水路暗记最终指向姑苏，下一程该去找阿朱、王语嫣和燕子坞那边把路数辨清。",
        location: "姑苏",
        npc: "王语嫣"
      },
      rumorAdd: [
        {
          text: "残页最后几处接头记号都压在姑苏水路一带，阿朱让你尽快过去，别让线头断在半路。",
          kind: "location_lead",
          location: "姑苏",
          npc: "阿朱",
          source: "local-mainline"
        },
        {
          text: "慕容复和王语嫣或许认得账页背后的武学路数，姑苏这一趟不只是查人，也是在查招。",
          kind: "hook",
          location: "姑苏",
          npc: "王语嫣",
          source: "local-mainline"
        },
        {
          text: "岳老三和云中鹤正在沿路找段誉，回头再走明路，十有八九会撞上他们。",
          kind: "rumor",
          location: "大理城",
          source: "local-mainline"
        },
        {
          text: "吐蕃高僧鸠摩智近日也在姑苏附近问经寻谱，这趟过去未必只会碰上地方人物。",
          kind: "hook",
          location: "姑苏",
          source: "local-mainline"
        },
        {
          text: "北边还传出一个身带寒毒的怪人四处求活路，背后多半牵着星宿海和丁春秋的手笔。",
          kind: "hook",
          location: "少室山",
          source: "local-mainline"
        }
      ],
      npcUpdates: [
        { name: "双儿", companion: true, recruitable: true, status: "奉掌柜之命，安静地跟在你身边" }
      ],
      npcStoryUpdates: [
        { name: "双儿", state: "companion" }
      ],
      relationshipChanges: [
        { name: "双儿", delta: 6, attitude: "依随" }
      ],
      relationshipRouteUpdates: [
        {
          npcId: ROUTE_SHUANGER,
          kind: "retainer",
          active: true,
          stage: "follow",
          allowCompanion: true,
          note: "掌柜把她交给了你，而她也自愿把自己放在你身边，长期追随一段。",
          supportUnlocked: ["care", "stash", "message", "escort"]
        }
      ],
      storyFlagsAdd: [
        "route:shuang-er:follow",
        "chapter:one:complete",
        stageFlag("to_gusu")
      ],
      locationUnlockUpdates: [
        { locationId: "gusu", reason: "quest" }
      ],
      questStateUpdates: [
        { id: QUEST_WANDERER_5, status: "resolved", stage: "accepted-shuang-er" }
      ],
      chapterStateUpdate: setChapterStage("to_gusu"),
      systemNote: "你收下了双儿，大理这条线也正式把你推向了姑苏。接下来不只是查残页，还得提防岳老三、云中鹤和更高一层的人物。"
    };
  }

  if (choiceId === CHOICE_DECLINE_SHUANGER) {
    return {
      questUpdates: [{ id: QUEST_WANDERER_5, status: "resolved" }],
      objectiveUpdate: {
        title: "前往姑苏",
        text: "你暂时仍是独行，但残页上的水路暗记已经把下一程指向了姑苏。先把这条线追实，再回头看大理这边的人。",
        location: "姑苏",
        npc: "王语嫣"
      },
      rumorAdd: [
        {
          text: "残页最后几处接头记号都压在姑苏水路一带，阿朱让你尽快过去，别让线头断在半路。",
          kind: "location_lead",
          location: "姑苏",
          npc: "阿朱",
          source: "local-mainline"
        },
        {
          text: "慕容复和王语嫣或许认得账页背后的武学路数，姑苏这一趟不只是查人，也是在查招。",
          kind: "hook",
          location: "姑苏",
          npc: "王语嫣",
          source: "local-mainline"
        },
        {
          text: "岳老三和云中鹤正在沿路找段誉，回头再走明路，十有八九会撞上他们。",
          kind: "rumor",
          location: "大理城",
          source: "local-mainline"
        },
        {
          text: "吐蕃高僧鸠摩智近日也在姑苏附近问经寻谱，这趟过去未必只会碰上地方人物。",
          kind: "hook",
          location: "姑苏",
          source: "local-mainline"
        },
        {
          text: "北边还传出一个身带寒毒的怪人四处求活路，背后多半牵着星宿海和丁春秋的手笔。",
          kind: "hook",
          location: "少室山",
          source: "local-mainline"
        }
      ],
      npcUpdates: [
        { name: "双儿", companion: false, recruitable: true, hidden: false, discovered: true, status: "仍在客栈等你回头叫她" }
      ],
      npcStoryUpdates: [
        { name: "双儿", state: "available" }
      ],
      relationshipRouteUpdates: [
        {
          npcId: ROUTE_SHUANGER,
          kind: "retainer",
          active: true,
          stage: "partiality",
          allowCompanion: true,
          note: "你暂时没有带她走，但她已经把自己放在一个会为你留位置的地方。",
          supportUnlocked: ["care", "stash", "message"]
        }
      ],
      storyFlagsAdd: [
        "route:shuang-er:declined",
        "chapter:one:complete",
        stageFlag("to_gusu")
      ],
      locationUnlockUpdates: [
        { locationId: "gusu", reason: "quest" }
      ],
      questStateUpdates: [
        { id: QUEST_WANDERER_5, status: "resolved", stage: "declined-for-now" }
      ],
      chapterStateUpdate: setChapterStage("to_gusu"),
      systemNote: "你暂时没有带走双儿，但主线已经被残页和水路暗记推向姑苏。下一程该去见更大的局了。"
    };
  }

  return undefined;
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

export function normalizeChapterStateForNameless(state: Partial<ChapterState> | undefined, fallback: ChapterState): ChapterState {
  const id = state?.id || fallback.id;
  if (id !== NAMELESS_WANDERER_CHAPTER_ID) {
    return {
      id,
      stage: state?.stage || fallback.stage
    };
  }

  return {
    id,
    stage: normalizeNamelessWandererStage(state?.stage || fallback.stage)
  };
}

export function onFirstAction(state: GameState): GamePatch | undefined {
  return resolveNamelessStoryTrigger(state, { kind: "first_action" });
}

export function onQuestResolved(state: GameState, questId: string): GamePatch | undefined {
  return resolveNamelessStoryTrigger(state, { kind: "quest_resolved", questId });
}

export function onCombatWin(state: GameState, enemyName?: string): GamePatch | undefined {
  return resolveNamelessStoryTrigger(state, { kind: "combat_win", enemyName });
}

export function onUseClue(state: GameState, clueId: string): GamePatch | undefined {
  return resolveNamelessStoryTrigger(state, { kind: "use_clue", clueId });
}
