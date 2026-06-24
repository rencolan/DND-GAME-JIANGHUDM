import type { GameState } from "../types";
import { originTemplates } from "./origins";
import { roster } from "./roster";
import { buildInitialEconomyState, locations, npcs } from "./world";

export const initialGameState: GameState = {
  setupComplete: false,
  originId: "nameless-wanderer",
  creationMode: "origin",
  chapter: "第一卷：无量山风波",
  chapterState: {
    id: "nameless-wanderer-ch1",
    stage: "intro"
  },
  storyFlags: [],
  worldDay: 1,
  timeSlot: "黄昏",
  actionCount: 0,
  currentCharacterId: roster[0].id,
  character: roster[0],
  roster,
  npcs,
  npcStoryState: {
    "duan-yu": "hidden",
    "qiao-feng": "rumored",
    "murong-fu": "rumored",
    "xu-zhu": "hidden",
    "wang-yuyan": "rumored",
    "a-zhu": "hidden",
    "a-zi": "hidden",
    "mu-wanqing": "hidden",
    "innkeeper": "available",
    "shuang-er": "hidden"
  },
  locations,
  locationUnlocks: {
    dali: "initial",
    wuliang: "initial"
  },
  quests: [],
  questStateMap: {},
  rumors: [],
  relationshipRoutes: {
    "duan-yu": {
      npcId: "duan-yu",
      kind: "bond",
      active: false,
      stage: "unawakened",
      supportUnlocked: []
    },
    "mu-wanqing": {
      npcId: "mu-wanqing",
      kind: "bond",
      active: false,
      stage: "unawakened",
      supportUnlocked: []
    },
    "wang-yuyan": {
      npcId: "wang-yuyan",
      kind: "romance",
      active: false,
      stage: "unawakened",
      supportUnlocked: []
    },
    "a-zhu": {
      npcId: "a-zhu",
      kind: "romance",
      active: false,
      stage: "unawakened",
      supportUnlocked: []
    },
    "mu-wanqing-romance": {
      npcId: "mu-wanqing",
      kind: "romance",
      active: false,
      stage: "unawakened",
      supportUnlocked: []
    },
    "shuang-er": {
      npcId: "shuang-er",
      kind: "retainer",
      active: false,
      stage: "unawakened",
      allowCompanion: false,
      supportUnlocked: []
    }
  },
  messages: [
    {
      id: "m0",
      role: "dm",
      text: "【说书人】大理城里人声未歇，无量山那边的风波却已经吹到了客栈门口。你先歇脚，先看人，再决定自己要不要踏进这摊麻烦。"
    }
  ],
  combat: { active: false },
  systemLog: ["系统：首轮行动后才会正式派发第一条任务。"],
  sceneType: "inn",
  pendingStudies: [],
  studySources: [],
  cultivationRank: 1,
  internalStyles: [],
  activeInternalArtId: undefined,
  qiGrowthBonus: 0,
  qiBreakthroughCap: 2,
  qiTrainingProgress: 0,
  availableAttributeInsights: [],
  economy: buildInitialEconomyState(),
  objective: {
    title: "入局引导",
    text: "先在客栈落脚，看看掌柜、客栈丫鬟和无量山的风声。",
    location: "大理城"
  }
};

export const defaultOriginTemplate = originTemplates[0];
