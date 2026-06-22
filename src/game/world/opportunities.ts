import type { GameState, LocationOpportunity, OpportunityCategory, OpportunityRisk } from "../../types";

type OpportunitySpec = {
  id: string;
  locationId: string;
  title: string;
  text: string;
  actionText: string;
  category: OpportunityCategory;
  risk: OpportunityRisk;
  reward: string;
  failure: string;
  checkAbility?: string;
  timeCost?: string;
  requirement?: string;
  requires?: (state: GameState) => boolean;
  disabledReason?: (state: GameState) => string | undefined;
};

function currentLocationId(state: GameState) {
  return state.locations.find((location) => location.current)?.id;
}

function hasFlag(state: GameState, flag: string) {
  return state.storyFlags.includes(flag);
}

function hasQuest(state: GameState, id: string, status = "active") {
  return state.questStateMap[id]?.status === status || state.quests.some((quest) => quest.id === id && quest.status === status);
}

function hasArt(state: GameState, artId: string) {
  return state.character.martialArts.some((art) => art.id === artId);
}

function hasStudy(state: GameState, artId: string) {
  return state.pendingStudies.some((study) => study.artId === artId)
    || state.studySources.some((source) => source.artId === artId)
    || hasArt(state, artId);
}

function routeStage(state: GameState, routeId: string) {
  return state.relationshipRoutes[routeId]?.stage;
}

function missingArt(state: GameState, artId: string, label: string) {
  return hasArt(state, artId) ? undefined : `需要先掌握 ${label}`;
}

const opportunitySpecs: OpportunitySpec[] = [
  {
    id: "dali-settle-inn",
    locationId: "dali",
    title: "压住客栈乱局",
    text: "前堂后院都有人心浮动，先替掌柜稳住场面，能打开双儿和客栈旧路数。",
    actionText: "我去客栈前堂帮掌柜压住乱局，安顿双儿和后院",
    category: "mainline",
    risk: "medium",
    reward: "主线推进 / 双儿信任 / 客栈修行来源",
    failure: "掌柜和双儿仍会记住你出手，但客栈局势会变得更乱。",
    checkAbility: "气运",
    timeCost: "推进 1 次正式行动",
    requires: (state) => hasQuest(state, "quest-wanderer-1")
  },
  {
    id: "dali-knife-frame",
    locationId: "dali",
    title: "护院旧刀架",
    text: "后院墙边还留着护院旧刀架，适合把正面逼位练成可用招式。",
    actionText: "我去客栈后院照着护院旧刀架练江湖刀路",
    category: "training",
    risk: "low",
    reward: "江湖刀路研习来源",
    failure: "不会受重伤，但会浪费一次行动机会。",
    checkAbility: "力道",
    timeCost: "推进 1 次正式行动",
    requirement: "双儿路线达到熟识",
    requires: (state) => hasFlag(state, "route:shuang-er:trust") && !hasStudy(state, "jianghu-daolu")
  },
  {
    id: "dali-innkeeper-acupoint",
    locationId: "dali",
    title: "请教掌柜旧路数",
    text: "掌柜年轻时显然不是普通生意人，若得他点破几处筋络，能走上认穴手。",
    actionText: "我请教掌柜认穴手和点穴手法",
    category: "relationship",
    risk: "low",
    reward: "认穴手研习来源",
    failure: "掌柜不会翻脸，但可能只给你一句模糊提醒。",
    checkAbility: "悟性",
    timeCost: "推进 1 次正式行动",
    requirement: "双儿路线达到熟识",
    requires: (state) => hasFlag(state, "route:shuang-er:trust") && !hasStudy(state, "renxue-shou")
  },
  {
    id: "dali-ledger",
    locationId: "dali",
    title: "核对残破账页",
    text: "黑衣刺客身上的账页藏着水路暗记，阿朱也许能把线索接到姑苏。",
    actionText: "我带着残破账页去茶肆找阿朱核对线索",
    category: "mainline",
    risk: "low",
    reward: "姑苏线索 / 地点推进",
    failure: "线索不会丢，但会让对方多一点反应时间。",
    checkAbility: "悟性",
    timeCost: "推进 1 次正式行动",
    requires: (state) => hasQuest(state, "quest-wanderer-4") && !hasFlag(state, "story:onUseClue:ledger-fragment")
  },
  {
    id: "dali-save-innkeeper",
    locationId: "dali",
    title: "保护客栈掌柜",
    text: "若掌柜被盯上，这一手会决定双儿是否真正把自己托付给你。",
    actionText: "我回客栈前堂救下掌柜，保护双儿",
    category: "relationship",
    risk: "medium",
    reward: "双儿随行资格 / 五罗轻烟掌线索",
    failure: "掌柜会受伤，你会损失气血，但双儿仍会更在意你。",
    checkAbility: "身法",
    timeCost: "推进 1 次正式行动",
    requirement: "双儿路线达到熟识",
    requires: (state) => hasQuest(state, "quest-wanderer-4") && routeStage(state, "shuang-er") === "trust" && !hasFlag(state, "route:shuang-er:owner-saved")
  },
  {
    id: "wuliang-track",
    locationId: "wuliang",
    title: "追上山道书生",
    text: "山路越往里越乱，先追上段誉和木婉清，才能知道追兵从何而来。",
    actionText: "我沿着无量山山道追上段誉和木婉清",
    category: "mainline",
    risk: "medium",
    reward: "段誉/木婉清登场 / 主线战斗",
    failure: "你会落后一程，下一场冲突更混乱。",
    checkAbility: "身法",
    timeCost: "推进 1 次正式行动",
    requires: (state) => hasQuest(state, "quest-wanderer-2")
  },
  {
    id: "wuliang-fight",
    locationId: "wuliang",
    title: "挡住黑衣刺客",
    text: "追兵已经压近，出手挡下这一轮，才能保住段誉与木婉清。",
    actionText: "我出手迎战黑衣刺客，拦住追兵救人",
    category: "danger",
    risk: "high",
    reward: "残破账页 / 修为提升 / 北冥线索",
    failure: "进入实战，失败会损失气血或被迫脱身。",
    checkAbility: "所选武学",
    timeCost: "进入战斗",
    requires: (state) => hasQuest(state, "quest-wanderer-3") && !state.combat.active
  },
  {
    id: "wuliang-sword-wall",
    locationId: "wuliang",
    title: "观摩无量剑壁",
    text: "旧剑痕里藏着轻灵剑路，适合补足身法路线的早期输出。",
    actionText: "我在无量山观摩剑壁，拆无量剑法",
    category: "training",
    risk: "low",
    reward: "无量剑法研习来源",
    failure: "参悟失败只会冷却这处来源几步行动。",
    checkAbility: "悟性",
    timeCost: "推进 1 次正式行动",
    requires: (state) => (hasFlag(state, "npc:duan-yu:met") || hasQuest(state, "quest-wanderer-3", "resolved")) && !hasStudy(state, "wuliang-jianfa")
  },
  {
    id: "wuliang-lingbo",
    locationId: "wuliang",
    title: "寻找石室步图",
    text: "凌波微步不是伤害招，而是改变脱身、闪避和反击节奏的身法核心。",
    actionText: "我寻找石室步图，参悟凌波微步",
    category: "exploration",
    risk: "medium",
    reward: "凌波微步秘笈",
    failure: "看不懂步图时不会丢失机会，但会提示身法基础不足。",
    checkAbility: "身法",
    timeCost: "推进 1 次正式行动",
    requirement: "掌握追风剑路",
    requires: (state) => !hasStudy(state, "lingbo-weibu"),
    disabledReason: (state) => missingArt(state, "zhuifeng-jianlu", "追风剑路")
  },
  {
    id: "wuliang-beiming",
    locationId: "wuliang",
    title: "强悟北冥残页",
    text: "逆旋归流的气机很诱人，也很危险。失败会伤经脉，但成功会打开真气循环路线。",
    actionText: "我在石室里查看北冥残页，尝试理解逆旋真气",
    category: "danger",
    risk: "high",
    reward: "北冥线索 / 后续北冥神功资格",
    failure: "强行参悟可能导致内伤和真气损耗。",
    checkAbility: "心境",
    timeCost: "推进 1 次正式行动",
    requirement: "第一章完成，最好先有基础心法",
    requires: (state) => hasFlag(state, "chapter:one:complete") && !hasStudy(state, "beiming-shengong")
  },
  {
    id: "gusu-murong-sword",
    locationId: "gusu",
    title: "水榭剑痕",
    text: "燕子坞水榭留下细密剑痕，可把段家剑法一路推进到姑苏剑路。",
    actionText: "我在姑苏水榭观摩剑痕，拆慕容剑法",
    category: "training",
    risk: "low",
    reward: "慕容剑法研习来源",
    failure: "只会暂时看不透剑痕，不会结仇。",
    checkAbility: "悟性",
    timeCost: "推进 1 次正式行动",
    requirement: "掌握段家剑法",
    requires: (state) => !hasStudy(state, "murong-jianfa"),
    disabledReason: (state) => missingArt(state, "duanjia-jianfa", "段家剑法")
  },
  {
    id: "gusu-wang-canhe",
    locationId: "gusu",
    title: "请王语嫣辨指劲",
    text: "她能看出指法里的细枝末节，适合把认穴手推进成参合指路线。",
    actionText: "我请王语嫣指点参合指和姑苏指法",
    category: "relationship",
    risk: "low",
    reward: "参合指研习来源",
    failure: "她仍会给出提示，但你可能暂时记不住关键落点。",
    checkAbility: "悟性",
    timeCost: "推进 1 次正式行动",
    requirement: "掌握认穴手",
    requires: (state) => !hasStudy(state, "canhe-zhi"),
    disabledReason: (state) => missingArt(state, "renxue-shou", "认穴手")
  },
  {
    id: "gusu-jiu-hint",
    locationId: "gusu",
    title: "远观鸠摩智出手",
    text: "现在不该正面对上宗师，但可以记下火焰刀运劲思路，为后期破法埋线。",
    actionText: "我远观鸠摩智刀气，记下火焰刀思路",
    category: "danger",
    risk: "high",
    reward: "火焰刀线索 / 宗师压力",
    failure: "被宗师察觉会提高后续姑苏线压力。",
    checkAbility: "悟性",
    timeCost: "推进 1 次正式行动",
    requirement: "掌握参合指",
    requires: (state) => hasArt(state, "canhe-zhi") && !hasFlag(state, "boss:jiu-mozhi:observed")
  },
  {
    id: "shaoshi-luohan",
    locationId: "shaoshi",
    title: "演武坪练罗汉拳",
    text: "少林基础拳路能让力道路线有稳定正面压迫。",
    actionText: "我在少室山演武坪练罗汉拳",
    category: "training",
    risk: "low",
    reward: "罗汉拳研习来源",
    failure: "只是多练几趟空架，不会有严重后果。",
    checkAbility: "力道",
    timeCost: "推进 1 次正式行动",
    requires: (state) => !hasStudy(state, "luohan-quan")
  },
  {
    id: "shaoshi-xuzhu",
    locationId: "shaoshi",
    title: "请虚竹演掌",
    text: "虚竹不擅言辞，但他能把六阳掌前置的运劲拆给你看。",
    actionText: "我请虚竹演示天山六阳掌前置运劲",
    category: "relationship",
    risk: "medium",
    reward: "天山六阳掌前置",
    failure: "运劲走岔可能带来轻微内伤。",
    checkAbility: "心境",
    timeCost: "推进 1 次正式行动",
    requirement: "掌握大理心法",
    requires: (state) => !hasStudy(state, "tianshan-liuyang-zhang"),
    disabledReason: (state) => missingArt(state, "dali-xinfa", "大理心法")
  },
  {
    id: "yanmen-qiaofeng",
    locationId: "yanmen",
    title: "乔峰喂招余势",
    text: "若和乔峰关系足够，他的掌势能让你摸到降龙掌架。",
    actionText: "我请乔峰喂招，观察降龙掌路",
    category: "relationship",
    risk: "high",
    reward: "降龙掌架线索",
    failure: "喂招压力很重，失败也可能换来一段实战心得。",
    checkAbility: "力道",
    timeCost: "推进 1 次正式行动",
    requirement: "掌握打狗棒法，乔峰关系 60",
    requires: (state) => !hasFlag(state, "study-hint:xianglong-prelude"),
    disabledReason: (state) => {
      const artMissing = missingArt(state, "dagou-bangfa", "打狗棒法");
      if (artMissing) return artMissing;
      const qiaoFeng = state.npcs.find((npc) => npc.id === "qiao-feng");
      return (qiaoFeng?.relationship || 0) >= 60 ? undefined : "乔峰关系需要达到 60";
    }
  },
  {
    id: "xingxiu-poison",
    locationId: "xingxiu",
    title: "毒潭掌印",
    text: "星宿掌法危险但能打开毒与内伤路线，失败代价也更重。",
    actionText: "我在星宿毒潭掌印前参悟星宿毒掌",
    category: "danger",
    risk: "high",
    reward: "星宿毒掌研习来源",
    failure: "毒气入体，可能中毒或增加内伤。",
    checkAbility: "心境",
    timeCost: "推进 1 次正式行动",
    requires: (state) => !hasStudy(state, "xingxiu-duzhang")
  },
  {
    id: "xingxiu-huagong",
    locationId: "xingxiu",
    title: "翻看化功残篇",
    text: "化功残篇只露一线，足够让你明白敌人如何封住内息。",
    actionText: "我翻看化功残篇，试着理解化功门路",
    category: "danger",
    risk: "high",
    reward: "化功线索",
    failure: "走偏会封住自身内息，短时间内内功更吃力。",
    checkAbility: "悟性",
    timeCost: "推进 1 次正式行动",
    requirement: "掌握星宿毒掌",
    requires: (state) => !hasFlag(state, "study-hint:huagong-hint"),
    disabledReason: (state) => missingArt(state, "xingxiu-duzhang", "星宿毒掌")
  }
];

export function buildLocationOpportunities(state: GameState): LocationOpportunity[] {
  const locationId = currentLocationId(state);
  if (!locationId || state.combat.active) return [];

  return opportunitySpecs
    .filter((spec) => spec.locationId === locationId)
    .filter((spec) => !spec.requires || spec.requires(state))
    .slice(0, 5)
    .map((spec) => ({
      id: spec.id,
      title: spec.title,
      text: spec.text,
      actionText: spec.actionText,
      category: spec.category,
      risk: spec.risk,
      reward: spec.reward,
      failure: spec.failure,
      checkAbility: spec.checkAbility,
      timeCost: spec.timeCost,
      requirement: spec.requirement,
      disabledReason: spec.disabledReason?.(state)
    }));
}
