import type { GamePatch, GameState, Npc } from "../../types";
import { currentLocationName, includesAny } from "./helpers";

type InteractionKind = "chat" | "kind" | "supportive" | "gift" | "negative";

type RelationshipInteractionResolution = {
  patch: GamePatch;
  textOverride: string;
  targetName: string;
};

const CHAT_KEYWORDS = ["聊天", "闲聊", "说话", "谈谈", "谈话", "寒暄", "问候", "陪聊"];
const KIND_KEYWORDS = ["关心", "安慰", "道谢", "感谢", "夸奖", "称赞", "赔礼", "道歉", "请教"];
const SUPPORTIVE_KEYWORDS = ["帮忙", "帮他", "帮她", "照顾", "保护", "护送", "分担", "解围", "救"];
const GIFT_KEYWORDS = ["送礼", "赠送", "送给", "给他", "给她", "请客", "请喝酒", "请吃饭"];
const NEGATIVE_KEYWORDS = ["辱骂", "威胁", "恐吓", "呵斥", "欺负", "嘲讽", "出卖", "骗", "赶走", "伤害"];

function isVisibleNpc(npc: Npc) {
  return !npc.hidden || npc.discovered || npc.companion;
}

function isPresentForInteraction(state: GameState, npc: Npc) {
  return npc.companion || npc.location === currentLocationName(state);
}

function mentionedNpc(state: GameState, action: string) {
  return state.npcs.find((npc) =>
    isVisibleNpc(npc)
    && isPresentForInteraction(state, npc)
    && (action.includes(npc.name) || action.includes(npc.title))
  );
}

function interactionKind(action: string): InteractionKind | undefined {
  if (includesAny(action, NEGATIVE_KEYWORDS)) return "negative";
  if (includesAny(action, GIFT_KEYWORDS)) return "gift";
  if (includesAny(action, SUPPORTIVE_KEYWORDS)) return "supportive";
  if (includesAny(action, KIND_KEYWORDS)) return "kind";
  if (includesAny(action, CHAT_KEYWORDS)) return "chat";
  return undefined;
}

function relationshipDelta(kind: InteractionKind) {
  if (kind === "negative") return -3;
  if (kind === "gift" || kind === "supportive" || kind === "kind") return 2;
  return 1;
}

function attitudeFor(kind: InteractionKind, currentRelationship: number) {
  if (kind === "negative") return currentRelationship <= 30 ? "戒备" : "不悦";
  if (kind === "gift") return currentRelationship >= 60 ? "亲近" : "受用";
  if (kind === "supportive") return currentRelationship >= 60 ? "信赖" : "感激";
  if (kind === "kind") return currentRelationship >= 60 ? "温和" : "留意";
  return currentRelationship >= 60 ? "熟络" : "留意";
}

function textFor(npc: Npc, kind: InteractionKind, alreadyRewarded: boolean) {
  if (alreadyRewarded) {
    return `你又和${npc.name}说了几句。今日这份人情已经记下了，再多寒暄只算维持交情，不再额外提升好感。`;
  }

  if (kind === "negative") {
    return `你对${npc.name}说了重话。${npc.name}面色一沉，这份不快会留在心里。`;
  }

  if (kind === "gift") {
    return `你给${npc.name}备了一份心意。礼物贵贱还在其次，对方更记得你愿意把这份人情放在心上。`;
  }

  if (kind === "supportive") {
    return `你主动替${npc.name}分担了一件事。江湖路远，这种可靠比漂亮话更有分量。`;
  }

  if (kind === "kind") {
    return `你认真听${npc.name}说完，又把自己的意思说得妥帖。对方看你的眼神缓和了些。`;
  }

  return `你和${npc.name}闲谈片刻。话不算重，却让彼此比先前更熟一点。`;
}

export function resolveNpcRelationshipInteraction(
  state: GameState,
  action: string
): RelationshipInteractionResolution | undefined {
  if (state.combat.active || state.pendingCheck || state.pendingDamage) return undefined;

  const npc = mentionedNpc(state, action);
  if (!npc) return undefined;

  const kind = interactionKind(action);
  if (!kind) return undefined;

  const flag = `interaction:${npc.id}:generic:${kind}:${state.worldDay}`;
  const alreadyRewarded = state.storyFlags.includes(flag);
  const note = textFor(npc, kind, alreadyRewarded);
  const patch: GamePatch = alreadyRewarded
    ? {
      pendingCheck: undefined,
      systemNote: note
    }
    : {
      pendingCheck: undefined,
      relationshipChanges: [{
        npcId: npc.id,
        delta: relationshipDelta(kind),
        attitude: attitudeFor(kind, npc.relationship)
      }],
      storyFlagsAdd: [flag],
      systemNote: note
    };

  return {
    patch,
    textOverride: note,
    targetName: npc.name
  };
}
