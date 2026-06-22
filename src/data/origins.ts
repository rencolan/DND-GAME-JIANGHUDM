import type { ObjectiveHint, OriginTemplate, SceneType } from "../types";
import { defaultMartialArts } from "./martialArts";

export const originTemplates: OriginTemplate[] = [
  {
    id: "nameless-wanderer",
    name: "无名客",
    desc: "无门无派，先在大理客栈落脚，再被无量山风波一步步卷进江湖大局。",
    qiStart: 2,
    intro: "大理城里人声未歇，无量山那边的风波却已经吹到了客栈门口。你只是一个暂时落脚的无名客，本想歇一晚再走，可掌柜、双儿和往来旅人都像在等一场将至的麻烦。",
    setupHint: "起手身份中性，先从客栈、人情和无量山线索入局。",
    firstQuest: {
      title: "客栈落脚",
      text: "先在大理客栈站稳脚跟，看看掌柜、双儿和无量山的风声到底牵着哪条线。",
      location: "大理城",
      npc: "双儿"
    },
    martialArts: [...defaultMartialArts.jianghu]
  }
];

export const routeGuides: Record<string, { sceneType: SceneType; objective: ObjectiveHint; intro: string }> = {
  "nameless-wanderer": {
    sceneType: "inn",
    objective: {
      title: "教学前导",
      text: "先看清无名客的旧事，再借一场小斗熟悉战斗流程。",
      location: "旧路回闪"
    },
    intro: originTemplates[0].intro
  }
};
