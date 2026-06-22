import type { MessageRole, RelationshipRouteState, RelationshipTier, SceneType } from "../types";

export const abilityLabels: Record<string, string> = {
  str: "力道",
  dex: "身法",
  con: "根骨",
  int: "悟性",
  cha: "气运",
  wis: "心境"
};

export const abilityDefinitions: Record<string, { title: string; text: string }> = {
  str: {
    title: "力道",
    text: "决定硬碰硬、持兵压制、破门制敌一类的正面爆发。外功拳脚、刀掌冲阵，多半都看这一项。"
  },
  dex: {
    title: "身法",
    text: "决定腾挪、闪避、抢身位、轻功追逐与出手快慢。想先一步占位，常要看身法够不够利落。"
  },
  con: {
    title: "根骨",
    text: "决定体魄、抗打、撑伤和久战能力。根骨高的人更扛揍，也更能熬住内伤与寒毒一类的后劲。"
  },
  int: {
    title: "悟性",
    text: "决定拆招理解、临阵应变、推演武学路数与精细内功运转。机巧型招式和高深绝学常受它影响。"
  },
  cha: {
    title: "气运",
    text: "决定临场福缘、人情走向、偶遇转机与一些说不清的顺逆。它不总是显眼，但常在关键时刻偏向一边。"
  },
  wis: {
    title: "心境",
    text: "决定定力、判断、守势、调息与克制。越乱的局面，越需要心境稳得住，才不会自己先散。"
  }
};

export const abilityEffectLabels: Record<string, string> = {
  str: "外功命中 / 伤害",
  dex: "先攻 / 闪避 / 护甲",
  con: "生命 / 抗打",
  int: "拆招 / 学武 / 技巧",
  cha: "奇遇 / 交涉 / 福缘",
  wis: "内力 / 定力 / 内功"
};

Object.assign(abilityLabels, {
  str: "力道",
  dex: "身法",
  con: "根骨",
  int: "悟性",
  cha: "气运",
  wis: "心境"
});

Object.assign(abilityDefinitions, {
  str: {
    title: "力道",
    text: "主打重外功、硬打、破门和正面压制。想靠刀掌拳脚强行破局，看的就是这一路。"
  },
  dex: {
    title: "身法",
    text: "主打先手、闪避、走位和轻快兵刃。抢位、贴身、绕后、快进快退，都更依赖身法。"
  },
  con: {
    title: "根骨",
    text: "主打生命、耐打、内伤抗性和久战能力。根骨厚，才扛得住硬仗、伤势与长线消耗。"
  },
  int: {
    title: "悟性",
    text: "主打拆招、认穴、推演与技法型武学。演练招式、琢磨门路、以巧破招，都靠悟性。"
  },
  cha: {
    title: "气运",
    text: "主打交涉、讲价、奇遇、关系推进与场外运势。它不直接打伤害，却会让你在江湖里更好办事。"
  },
  wis: {
    title: "心境",
    text: "主打内力、调息、疗伤、内功运转与内伤施压。心境稳，真气才稳，内家路数也才站得住。"
  }
});

Object.assign(abilityEffectLabels, {
  str: "重手外功 / 破门压制",
  dex: "先手 / 闪避 / 护甲",
  con: "生命 / 抗压 / 内伤抗性",
  int: "拆招 / 认穴 / 技法武学",
  cha: "讲价 / 交涉 / 关系收益",
  wis: "内力 / 调息 / 内功伤势"
});

export const sceneAssets: Record<SceneType, string> = {
  temple: "../assets/scene-temple.png",
  market: "../assets/scene-market.png",
  tavern: "../assets/scene-tavern.png",
  brothel: "../assets/scene-brothel.png",
  inn: "../assets/scene-inn.png",
  palace: "../assets/scene-palace.png"
};

export const sceneLabels: Record<SceneType, string> = {
  temple: "寺院",
  market: "街市",
  tavern: "酒肆",
  brothel: "花楼",
  inn: "客栈",
  palace: "府邸"
};

export function relationshipTierLabel(tier: RelationshipTier) {
  return {
    stranger: "生疏",
    familiar: "顺眼",
    trusted: "信任",
    confidant: "知己",
    devoted: "倾心"
  }[tier];
}

export function relationshipRouteStageLabel(stage: RelationshipRouteState["stage"], kind: RelationshipRouteState["kind"]) {
  if (kind === "retainer") {
    return {
      unawakened: "未起线",
      met: "初识",
      trust: "信任建立",
      partiality: "偏心显现",
      follow: "专属追随",
      enduring: "稳定维持"
    }[stage];
  }

  return {
    unawakened: "未起线",
    met: "初识",
    trust: "熟识",
    partiality: "特别在意",
    follow: "深交同行",
    enduring: "长期维系"
  }[stage];
}

export function supportLabel(label: string) {
  return {
    care: "照料",
    stash: "收物",
    message: "传话",
    escort: "追随"
  }[label] || label;
}

export function messageRoleLabel(role: MessageRole) {
  return {
    dm: "说书人",
    player: "你",
    dice: "骰子",
    system: "系统"
  }[role];
}
