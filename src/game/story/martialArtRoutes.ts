import { martialArtCatalog } from "../../data";
import { abilityModifierFromList } from "../rules";
import type {
  FortuneGate,
  GamePatch,
  GameState,
  StudyAccessLevel,
  StudyRouteKey,
  StudySourceKind,
  StudyTier
} from "../../types";

export type MartialArtStoryResolution = {
  text: string;
  patch: GamePatch;
};

type MartialArtRoute = {
  id: string;
  artId?: string;
  name: string;
  locationId: string;
  routeKey: StudyRouteKey;
  tier: StudyTier;
  accessLevel: StudyAccessLevel;
  sourceKind?: StudySourceKind;
  sourceLabel?: string;
  keywords: string[];
  text: string;
  systemNote: string;
  portable?: boolean;
  dangerous?: boolean;
  hidden?: boolean;
  requiredProgress?: number;
  chapterGate?: string;
  prerequisiteArts?: string[];
  prerequisiteFlags?: string[];
  fortuneGate?: FortuneGate;
  hintText?: string;
  hintNote?: string;
  requires?: (state: GameState) => boolean;
  extraPatch?: GamePatch;
};

const routeLadders: Record<StudyRouteKey, Array<{ tier: StudyTier; label: string }>> = {
  str: [
    { tier: "starter", label: "罗汉拳 / 太祖长拳" },
    { tier: "advanced", label: "莲花掌 / 韦陀杵" },
    { tier: "mid", label: "打狗棒法残路" },
    { tier: "upper_prelude", label: "降龙掌架" },
    { tier: "high_chance", label: "降龙真传线索" }
  ],
  dex: [
    { tier: "starter", label: "无量剑法 / 段家剑法" },
    { tier: "advanced", label: "追风剑路 / 五罗轻烟掌" },
    { tier: "mid", label: "慕容剑法 / 凌波步图" },
    { tier: "upper_prelude", label: "摘星残式 / 折梅拆招" },
    { tier: "high_chance", label: "完整凌波 / 折梅精髓" }
  ],
  int: [
    { tier: "starter", label: "认穴手" },
    { tier: "advanced", label: "一阳指入门用法" },
    { tier: "mid", label: "参合指 / 技法残谱" },
    { tier: "upper_prelude", label: "火焰刀运劲思路 / 化功残篇" },
    { tier: "high_chance", label: "完整火焰刀 / 深化功手段" }
  ],
  wis: [
    { tier: "starter", label: "吐纳法 / 大理心法" },
    { tier: "advanced", label: "调息法门 / 基础运气图" },
    { tier: "mid", label: "北冥残页 / 六阳掌前置" },
    { tier: "upper_prelude", label: "小无相骨架 / 生死符控劲法" },
    { tier: "high_chance", label: "完整北冥 / 完整小无相 / 生死符深层法门" }
  ]
};

const ladderLabels = new Map<string, string>();
Object.entries(routeLadders).forEach(([routeKey, entries]) => {
  entries.forEach((entry) => {
    ladderLabels.set(`${routeKey}:${entry.tier}`, entry.label);
  });
});

function currentLocationId(state: GameState) {
  return state.locations.find((location) => location.current)?.id;
}

function hasStoryFlag(state: GameState, flag: string) {
  return state.storyFlags.includes(flag);
}

function hasMartialArt(state: GameState, artId: string) {
  return state.character.martialArts.some((art) => art.id === artId);
}

function hasPendingStudy(state: GameState, artId: string) {
  return state.pendingStudies.some((entry) => entry.artId === artId);
}

function hasStudySource(state: GameState, artId: string) {
  return state.studySources.some((source) => source.artId === artId);
}

function hasQuestStatus(state: GameState, questId: string, status?: "active" | "resolved" | "hidden") {
  const inList = state.quests.some((quest) => quest.id === questId && (!status || quest.status === status));
  const inState = state.questStateMap[questId];
  return inList || Boolean(inState && (!status || inState.status === status));
}

function hasRelationshipAtLeast(state: GameState, npcId: string, value: number) {
  return (state.npcs.find((npc) => npc.id === npcId)?.relationship || 0) >= value;
}

function matchKeywords(action: string, keywords: string[]) {
  return keywords.some((keyword) => action.includes(keyword));
}

function findArtTemplate(artId: string) {
  return martialArtCatalog.find((entry) => entry.id === artId || entry.name === artId);
}

function tierProgressDefault(tier: StudyTier) {
  if (tier === "upper_prelude") return 4;
  if (tier === "high_chance") return 5;
  return 3;
}

function routeFlag(route: MartialArtRoute) {
  return `study-source:${route.id}:discovered`;
}

function routeHintFlag(route: MartialArtRoute) {
  return `study-hint:${route.id}`;
}

function routeLadderSummary(route: MartialArtRoute) {
  return ladderLabels.get(`${route.routeKey}:${route.tier}`) || route.name;
}

function meetsChapterGate(state: GameState, route: MartialArtRoute) {
  return !route.chapterGate || hasStoryFlag(state, route.chapterGate);
}

function meetsArtPrerequisites(state: GameState, route: MartialArtRoute) {
  return (route.prerequisiteArts || []).every((artId) => hasMartialArt(state, artId));
}

function meetsFlagPrerequisites(state: GameState, route: MartialArtRoute) {
  return (route.prerequisiteFlags || []).every((flag) => hasStoryFlag(state, flag));
}

function meetsFortuneGate(state: GameState, route: MartialArtRoute) {
  if (!route.fortuneGate?.minChaMod) return true;
  return abilityModifierFromList(state.character.abilities, "cha") >= route.fortuneGate.minChaMod;
}

function effectiveSourceKind(route: MartialArtRoute): StudySourceKind {
  if (route.accessLevel === "manual") return "manual";
  return route.sourceKind || "onsite";
}

function buildHintPatch(route: MartialArtRoute): GamePatch {
  const ladder = routeLadderSummary(route);
  return {
    storyFlagsAdd: [routeHintFlag(route)],
    rumorAdd: [
      {
        text: `${route.name} 的门径只露出了一线。你眼下只摸到了 ${ladder} 的影子，还差更深的机缘才能真正下手。`,
        kind: "hook",
        location: route.locationId,
        source: "martial-hint"
      }
    ],
    systemNote: route.hintNote || `你先记下了 ${route.name} 的线索。`,
    ...(route.extraPatch || {})
  };
}

function buildSourcePatch(route: MartialArtRoute): GamePatch {
  const sourceKind = effectiveSourceKind(route);
  const art = route.artId ? findArtTemplate(route.artId) : undefined;
  const requiredProgress = route.requiredProgress || tierProgressDefault(route.tier);

  if (!route.artId || route.accessLevel === "hint") {
    return buildHintPatch(route);
  }

  const manualName = route.portable
    ? `${route.name}${route.fortuneGate?.upgradeOnSuccess ? "注解残卷" : "秘笈"}`
    : undefined;

  return {
    ...(route.accessLevel === "study"
      ? sourceKind === "teaching"
        ? {
          studyAdd: [
            {
              id: `study:${route.artId}`,
              artId: route.artId,
              name: route.name,
              category: art?.category || "external",
              linkedAbility: art?.linkedAbility || "int",
              sourceKind: "teaching",
              stage: "discovered",
              progress: 0,
              requiredProgress,
              dangerous: route.dangerous,
              sourceLabel: route.sourceLabel || "前辈点拨",
              locationId: route.locationId,
              tier: route.tier,
              routeKey: route.routeKey,
              accessLevel: route.accessLevel,
              hidden: route.hidden,
              fortuneGate: route.fortuneGate
            }
          ]
        }
        : {
          studySourceAdd: [
            {
              id: `source:${route.artId}`,
              locationId: route.locationId,
              artId: route.artId,
              name: route.name,
              discovered: true,
              portable: route.portable ?? false,
              dangerous: route.dangerous,
              sourceLabel: route.sourceLabel || "现场参悟",
              tier: route.tier,
              routeKey: route.routeKey,
              accessLevel: route.accessLevel,
              hidden: route.hidden,
              requiredProgress,
              fortuneGate: route.fortuneGate
            }
          ]
        }
      : {
        newItem: {
          id: `manual:${route.artId}`,
          name: manualName || `${route.name}秘笈`,
          desc: `记着 ${route.name} 的门路，需要继续研读才能真正上手。`,
          count: 1,
          type: "manual",
          value: 0,
          manualArtId: route.artId,
          studySourceKind: sourceKind === "teaching" ? "teaching" : "manual",
          dangerous: route.dangerous,
          canSell: false,
          requiredProgress,
          tier: route.tier,
          routeKey: route.routeKey,
          accessLevel: route.accessLevel,
          hidden: route.hidden,
          fortuneGate: route.fortuneGate
        }
      }),
    storyFlagsAdd: [routeFlag(route)],
    systemNote: route.systemNote,
    ...(route.extraPatch || {})
  };
}

const sourceRegistry: MartialArtRoute[] = [
  {
    id: "dali-heart-manual",
    artId: "dali-xinfa",
    name: "大理心法",
    locationId: "dali",
    routeKey: "wis",
    tier: "starter",
    accessLevel: "manual",
    sourceKind: "manual",
    sourceLabel: "客栈旧抄本",
    keywords: ["大理心法", "心法抄本", "旧抄本", "翻看心法"],
    text: "你从旧抄本里理出一条稳气归经的路子，虽然只是浅近门径，却足够作为日后修行的地基。",
    systemNote: "你得到了大理心法的基础抄本。"
  },
  {
    id: "duanjia-jianfa",
    artId: "duanjia-jianfa",
    name: "段家剑法",
    locationId: "dali",
    routeKey: "dex",
    tier: "starter",
    accessLevel: "study",
    sourceKind: "onsite",
    sourceLabel: "段氏演武碑",
    keywords: ["段家剑法", "段氏剑碑", "演武碑", "观摩段氏剑路"],
    text: "你沿着碑上留下的起手、进身与收剑次序重新推演，摸到了段家剑法的规整骨架。",
    systemNote: "你从段氏演武碑里摸到了段家剑法的门路。",
    requires: (state) => hasStoryFlag(state, "npc:duan-yu:saved")
  },
  {
    id: "wuluo-qingyan-zhang",
    artId: "wuluo-qingyan-zhang",
    name: "五罗轻烟掌",
    locationId: "dali",
    routeKey: "dex",
    tier: "advanced",
    accessLevel: "study",
    sourceKind: "teaching",
    sourceLabel: "木婉清喂招",
    keywords: ["五罗轻烟掌", "轻烟掌", "请木婉清指点", "贴身掌路"],
    text: "木婉清不肯多说，只让你贴身进退了几轮。你在她冷硬的节奏里，反而摸清了轻烟掌真正讲究的贴、让、转、再进。",
    systemNote: "你从木婉清的喂招里记下了五罗轻烟掌的门路。",
    prerequisiteFlags: ["npc:duan-yu:saved"],
    requires: (state) => hasQuestStatus(state, "quest-wanderer-4", "resolved") || hasStoryFlag(state, "chapter:one:complete")
  },
  {
    id: "yiyang-prelude",
    name: "一阳指入门用法",
    locationId: "dali",
    routeKey: "int",
    tier: "advanced",
    accessLevel: "hint",
    sourceLabel: "段誉口述残诀",
    keywords: ["请教一阳指", "一阳指门路", "段氏指法", "问段誉指法"],
    text: "段誉说不出一篇完整法门，只能把最浅近的一层运气落指之法讲给你听。你记下的是一条线索，不是现成绝技。",
    systemNote: "你先记下了一阳指最外层的运劲思路。",
    hintNote: "一阳指眼下只露出最浅的一层指劲门径。",
    chapterGate: "chapter:one:complete",
    prerequisiteArts: ["duanjia-jianfa"],
    requires: (state) => hasStoryFlag(state, "chapter:one:complete") && hasMartialArt(state, "duanjia-jianfa")
  },
  {
    id: "wuliang-jianfa",
    artId: "wuliang-jianfa",
    name: "无量剑法",
    locationId: "wuliang",
    routeKey: "dex",
    tier: "starter",
    accessLevel: "study",
    sourceKind: "onsite",
    sourceLabel: "无量剑壁",
    keywords: ["无量剑法", "剑壁", "无量剑派", "观摩剑路"],
    text: "旧战痕和石壁残招拼起来，恰好让你看清这套剑法为何轻灵而不虚浮。",
    systemNote: "你从无量山旧剑壁里摸到了无量剑法的起手。 ",
    requires: (state) => hasStoryFlag(state, "npc:duan-yu:met") || hasQuestStatus(state, "quest-wanderer-3", "resolved")
  },
  {
    id: "zhuifeng-jianlu",
    artId: "zhuifeng-jianlu",
    name: "追风剑路",
    locationId: "wuliang",
    routeKey: "dex",
    tier: "advanced",
    accessLevel: "study",
    sourceKind: "onsite",
    sourceLabel: "左子穆旧谱残抄",
    keywords: ["追风剑路", "快剑残抄", "左子穆旧谱", "追风"],
    text: "你顺着残抄里最狠、最快的那一路追拆下去，才看出追风剑路真正厉害的是连逼三步，不给人喘息。",
    systemNote: "你从左子穆留下的残抄里理出了追风剑路。",
    prerequisiteArts: ["wuliang-jianfa"],
    requires: (state) => hasMartialArt(state, "wuliang-jianfa") || hasStoryFlag(state, "npc:duan-yu:saved")
  },
  {
    id: "lingbo-weibu",
    artId: "lingbo-weibu",
    name: "凌波微步",
    locationId: "wuliang",
    routeKey: "dex",
    tier: "mid",
    accessLevel: "manual",
    sourceKind: "manual",
    sourceLabel: "石室步图",
    portable: true,
    requiredProgress: 4,
    keywords: ["凌波微步", "步图", "石室步图", "脚印"],
    text: "步图和足痕都只露了半截，可恰恰是这半截，逼得你去明白它并非走路，而是让人永远踩不准你的落脚。",
    systemNote: "你带走了凌波微步的步图门径。",
    prerequisiteArts: ["zhuifeng-jianlu"],
    requires: (state) => hasStoryFlag(state, "npc:duan-yu:saved") && hasMartialArt(state, "zhuifeng-jianlu")
  },
  {
    id: "beiming-prelude",
    name: "北冥残页",
    locationId: "wuliang",
    routeKey: "wis",
    tier: "mid",
    accessLevel: "hint",
    hidden: true,
    fortuneGate: { minChaMod: 1, revealBonus: 1 },
    sourceLabel: "石室运气残图",
    keywords: ["北冥残页", "石室内功", "残图", "运气回转"],
    text: "石室里那一缕逆旋归流的意思只让你看懂了开头。你知道这不是普通内功，但此刻还远没到真能硬练的时候。",
    systemNote: "你在石室里摸到了一线北冥残页的气机。",
    hintNote: "你只瞥见了北冥的一角，还差更大的机缘才敢真正下手。",
    chapterGate: "chapter:one:complete",
    prerequisiteArts: ["dali-xinfa"],
    requires: (state) => hasStoryFlag(state, "npc:duan-yu:saved") && hasMartialArt(state, "dali-xinfa")
  },
  {
    id: "beiming-shengong",
    artId: "beiming-shengong",
    name: "北冥神功",
    locationId: "wuliang",
    routeKey: "wis",
    tier: "upper_prelude",
    accessLevel: "study",
    sourceKind: "onsite",
    sourceLabel: "石室运功骨架",
    dangerous: true,
    hidden: true,
    requiredProgress: 5,
    fortuneGate: { minChaMod: 2, revealBonus: 1 },
    keywords: ["北冥神功", "北冥", "石室运功骨架", "逆旋真气"],
    text: "你这次不敢贪多，只照着那股倒旋回流的骨架缓缓一试。气机刚一转顺，你便知道自己摸到的只是骨架，不是完整神功。",
    systemNote: "你把北冥神功最危险也最关键的骨架记下了一层。",
    chapterGate: "chapter:one:complete",
    prerequisiteArts: ["dali-xinfa"],
    prerequisiteFlags: [routeHintFlag({
      id: "beiming-prelude",
      name: "北冥残页",
      locationId: "wuliang",
      routeKey: "wis",
      tier: "mid",
      accessLevel: "hint",
      keywords: [],
      text: "",
      systemNote: ""
    } as MartialArtRoute)],
    requires: (state) =>
      hasStoryFlag(state, routeHintFlag({
        id: "beiming-prelude",
        name: "北冥残页",
        locationId: "wuliang",
        routeKey: "wis",
        tier: "mid",
        accessLevel: "hint",
        keywords: [],
        text: "",
        systemNote: ""
      } as MartialArtRoute))
      && hasMartialArt(state, "dali-xinfa")
      && hasStoryFlag(state, "chapter:one:complete")
  },
  {
    id: "murong-jianfa",
    artId: "murong-jianfa",
    name: "慕容剑法",
    locationId: "gusu",
    routeKey: "dex",
    tier: "mid",
    accessLevel: "study",
    sourceKind: "onsite",
    sourceLabel: "水榭剑痕",
    requiredProgress: 4,
    keywords: ["慕容剑法", "燕子坞剑路", "姑苏剑痕", "水榭剑痕"],
    text: "你沿着水榭栏影和舟身晃动间收住的细剑路一路拆下去，越看越明白慕容家讲究的是紧、细、净。",
    systemNote: "你从姑苏水榭剑痕里摸到了慕容剑法的精细门路。",
    chapterGate: "chapter:one:complete",
    prerequisiteArts: ["duanjia-jianfa"],
    requires: (state) => hasStoryFlag(state, "chapter:one:complete") && hasMartialArt(state, "duanjia-jianfa")
  },
  {
    id: "canhe-zhi",
    artId: "canhe-zhi",
    name: "参合指",
    locationId: "gusu",
    routeKey: "int",
    tier: "mid",
    accessLevel: "study",
    sourceKind: "teaching",
    sourceLabel: "王语嫣点拨",
    requiredProgress: 4,
    keywords: ["参合指", "请王语嫣指点", "姑苏指法", "指劲"],
    text: "王语嫣替你点破了几处最容易走偏的运劲细节，你这才看清参合指最要紧的是一线之准，而不是花哨。",
    systemNote: "你从王语嫣的指点里记下了参合指的门路。",
    chapterGate: "chapter:one:complete",
    prerequisiteArts: ["renxue-shou"],
    requires: (state) => hasStoryFlag(state, "chapter:one:complete") && hasMartialArt(state, "renxue-shou")
  },
  {
    id: "xiaowuxiang-hint",
    name: "小无相骨架",
    locationId: "gusu",
    routeKey: "wis",
    tier: "upper_prelude",
    accessLevel: "hint",
    hidden: true,
    dangerous: true,
    fortuneGate: { minChaMod: 2, revealBonus: 1 },
    sourceLabel: "琅嬛残迹",
    keywords: ["小无相功", "琅嬛残迹", "无相", "残迹"],
    text: "你能看出那卷残迹不是在写一招一式，而是在写一副能承载别家武学的运劲骨架。可此刻它离真正可练，还差得远。",
    systemNote: "你只看到了小无相功的骨架线索。",
    hintNote: "琅嬛残迹只给了你一层骨架，还没到能真正下手的时候。",
    chapterGate: "chapter:one:complete",
    prerequisiteArts: ["canhe-zhi", "dali-xinfa"],
    requires: (state) => hasStoryFlag(state, "chapter:one:complete") && hasMartialArt(state, "canhe-zhi")
  },
  {
    id: "xiaowuxiang-gong",
    artId: "xiaowuxiang-gong",
    name: "小无相功",
    locationId: "gusu",
    routeKey: "wis",
    tier: "high_chance",
    accessLevel: "manual",
    sourceKind: "manual",
    sourceLabel: "琅嬛注解残卷",
    portable: true,
    dangerous: true,
    hidden: true,
    requiredProgress: 5,
    fortuneGate: { minChaMod: 3, revealBonus: 1, upgradeOnSuccess: true },
    keywords: ["小无相功残卷", "琅嬛注解", "无相残卷", "请王语嫣看残卷"],
    text: "这一次你拿到的不再只是骨架，而是一卷带批注的残卷。它依旧残缺，但终于够得上真正的待研习门径。",
    systemNote: "你得到了带批注的小无相功残卷，只能算接触资格，不算学成。",
    chapterGate: "chapter:one:complete",
    prerequisiteFlags: [routeHintFlag({
      id: "xiaowuxiang-hint",
      name: "小无相骨架",
      locationId: "gusu",
      routeKey: "wis",
      tier: "upper_prelude",
      accessLevel: "hint",
      keywords: [],
      text: "",
      systemNote: ""
    } as MartialArtRoute)],
    prerequisiteArts: ["canhe-zhi", "dali-xinfa"],
    requires: (state) =>
      hasStoryFlag(state, routeHintFlag({
        id: "xiaowuxiang-hint",
        name: "小无相骨架",
        locationId: "gusu",
        routeKey: "wis",
        tier: "upper_prelude",
        accessLevel: "hint",
        keywords: [],
        text: "",
        systemNote: ""
      } as MartialArtRoute))
      && hasMartialArt(state, "canhe-zhi")
      && hasMartialArt(state, "dali-xinfa")
  },
  {
    id: "jiu-huoyandao-hint",
    name: "火焰刀运劲思路",
    locationId: "gusu",
    routeKey: "int",
    tier: "upper_prelude",
    accessLevel: "hint",
    hidden: true,
    dangerous: true,
    fortuneGate: { minChaMod: 1, revealBonus: 1 },
    sourceLabel: "远观鸠摩智出手",
    keywords: ["观摩火焰刀", "鸠摩智刀气", "火焰刀思路", "远观鸠摩智"],
    text: "你不敢真去招惹鸠摩智，只敢隔着一段距离记下他以内力生刀意的那道起势。你得到的是思路，不是现成杀招。",
    systemNote: "你远远记下了火焰刀的运劲思路。",
    hintNote: "火焰刀眼下只是一道运劲线索，距离真正下手还很远。",
    chapterGate: "chapter:one:complete",
    prerequisiteArts: ["canhe-zhi"],
    extraPatch: {
      storyFlagsAdd: ["boss:jiu-mozhi:observed"]
    },
    requires: (state) => hasStoryFlag(state, "chapter:one:complete") && hasMartialArt(state, "canhe-zhi")
  },
  {
    id: "luohan-quan",
    artId: "luohan-quan",
    name: "罗汉拳",
    locationId: "shaoshi",
    routeKey: "str",
    tier: "starter",
    accessLevel: "study",
    sourceKind: "onsite",
    sourceLabel: "演武坪",
    keywords: ["罗汉拳", "少林拳路", "演武坪", "基础拳路"],
    text: "你一招一式照着演武坪旧架子打下去，才懂罗汉拳真正的压迫感并不浮在表面。",
    systemNote: "你在少室山演武坪里摸到了罗汉拳的正劲。",
    chapterGate: "chapter:one:complete",
    requires: (state) => hasStoryFlag(state, "chapter:one:complete")
  },
  {
    id: "weituo-chu",
    artId: "weituo-chu",
    name: "韦陀杵",
    locationId: "shaoshi",
    routeKey: "str",
    tier: "advanced",
    accessLevel: "manual",
    sourceKind: "manual",
    sourceLabel: "寺外杖法抄录",
    portable: true,
    keywords: ["韦陀杵", "杖法抄录", "少林杵法", "观杖路"],
    text: "抄录里只留了最重最直的一路，可对你来说反而够了。借着罗汉拳的正架，韦陀杵终于能被你一点点搬上身。",
    systemNote: "你得到了寺外流出的韦陀杵抄录。",
    chapterGate: "chapter:one:complete",
    prerequisiteArts: ["luohan-quan"],
    requires: (state) => hasMartialArt(state, "luohan-quan")
  },
  {
    id: "tianshan-liuyang-zhang",
    artId: "tianshan-liuyang-zhang",
    name: "天山六阳掌",
    locationId: "shaoshi",
    routeKey: "wis",
    tier: "mid",
    accessLevel: "study",
    sourceKind: "teaching",
    sourceLabel: "虚竹运劲",
    requiredProgress: 4,
    keywords: ["天山六阳掌", "请虚竹演掌", "六阳掌前置", "虚竹运劲"],
    text: "虚竹不讲漂亮话，只把最稳的一段运掌劲路拆给你看。你学到的是前置法门，不是完整名家压箱底。",
    systemNote: "你从虚竹的运劲里记下了天山六阳掌的前置门路。",
    chapterGate: "chapter:one:complete",
    prerequisiteArts: ["dali-xinfa"],
    requires: (state) => hasStoryFlag(state, "chapter:one:complete") && hasMartialArt(state, "dali-xinfa")
  },
  {
    id: "zhemei-prelude",
    name: "折梅手拆招思路",
    locationId: "shaoshi",
    routeKey: "dex",
    tier: "upper_prelude",
    accessLevel: "hint",
    hidden: true,
    fortuneGate: { minChaMod: 1, revealBonus: 1 },
    sourceLabel: "虚竹拆招",
    keywords: ["折梅手思路", "请虚竹拆招", "拆招思路", "折梅手"],
    text: "你先学到的不是招，而是怎么借着对手原本的势，替自己打开一只手进去。这是折梅手的思路，不是现成成套招法。",
    systemNote: "你先记下了折梅手最关键的一层拆招思路。",
    hintNote: "折梅手只给你留下了拆招思路，真正上手还差得远。",
    chapterGate: "chapter:one:complete",
    prerequisiteArts: ["murong-jianfa"],
    requires: (state) => hasStoryFlag(state, "chapter:one:complete") && hasMartialArt(state, "murong-jianfa")
  },
  {
    id: "taizu-changquan",
    artId: "taizu-changquan",
    name: "太祖长拳",
    locationId: "yanmen",
    routeKey: "str",
    tier: "starter",
    accessLevel: "study",
    sourceKind: "onsite",
    sourceLabel: "丐帮旧练场",
    keywords: ["太祖长拳", "长拳旧架", "丐帮旧练场", "旧拳路"],
    text: "北地旧拳路不花巧，却极硬。你照着旧架子一遍遍压下去，太祖长拳的朴直狠劲也就慢慢长到了身上。",
    systemNote: "你在丐帮旧练场里练成了太祖长拳的底子。",
    chapterGate: "chapter:one:complete",
    requires: (state) => hasStoryFlag(state, "chapter:one:complete")
  },
  {
    id: "lianhua-zhang",
    artId: "lianhua-zhang",
    name: "莲花掌",
    locationId: "yanmen",
    routeKey: "str",
    tier: "advanced",
    accessLevel: "study",
    sourceKind: "teaching",
    sourceLabel: "乔峰喂招",
    keywords: ["莲花掌", "请乔峰喂招", "连掌", "丐帮掌法"],
    text: "乔峰喂招不留情面，却恰好让你看清连掌真正压人的地方，是一手接一手不让人喘息。",
    systemNote: "你在乔峰的喂招里摸到了莲花掌的节奏。",
    chapterGate: "chapter:one:complete",
    prerequisiteArts: ["taizu-changquan"],
    requires: (state) => hasMartialArt(state, "taizu-changquan")
  },
  {
    id: "dagou-bangfa",
    artId: "dagou-bangfa",
    name: "打狗棒法",
    locationId: "yanmen",
    routeKey: "str",
    tier: "mid",
    accessLevel: "manual",
    sourceKind: "manual",
    sourceLabel: "丐帮旧谱残卷",
    portable: true,
    dangerous: false,
    requiredProgress: 4,
    keywords: ["打狗棒法", "旧谱残卷", "丐帮残卷", "棒法残路"],
    text: "这卷残谱不够完整，却把最狠的几手都留了下来。它不足以让你平地登堂，却足够把你推到中段门外。",
    systemNote: "你得到了打狗棒法的残卷。",
    chapterGate: "chapter:one:complete",
    prerequisiteArts: ["lianhua-zhang"],
    requires: (state) => hasMartialArt(state, "lianhua-zhang")
  },
  {
    id: "xianglong-prelude",
    name: "降龙掌架",
    locationId: "yanmen",
    routeKey: "str",
    tier: "upper_prelude",
    accessLevel: "hint",
    hidden: true,
    fortuneGate: { minChaMod: 2, revealBonus: 1 },
    sourceLabel: "乔峰喂招余势",
    keywords: ["降龙掌架", "看乔峰出掌", "降龙掌路", "乔峰掌势"],
    text: "你原本以为这只是刚猛，可真看进去才知道最难的是每一掌都要又正又满。你眼下记下的是掌架，不是真传。",
    systemNote: "你记下了降龙掌路最外层的一副掌架。",
    hintNote: "你只摸到了降龙掌架，还远远不到真传门槛。",
    chapterGate: "chapter:one:complete",
    prerequisiteArts: ["dagou-bangfa"],
    requires: (state) => hasMartialArt(state, "dagou-bangfa") && hasRelationshipAtLeast(state, "qiao-feng", 60)
  },
  {
    id: "xingxiu-duzhang",
    artId: "xingxiu-duzhang",
    name: "星宿毒掌",
    locationId: "xingxiu",
    routeKey: "wis",
    tier: "mid",
    accessLevel: "study",
    sourceKind: "onsite",
    sourceLabel: "毒潭掌印",
    requiredProgress: 4,
    dangerous: true,
    keywords: ["星宿毒掌", "毒潭掌印", "毒掌", "星宿掌法"],
    text: "你先见过毒，再回头看这路掌法，才知道它不是单纯阴狠，而是每一掌都在逼人乱气。",
    systemNote: "你在毒潭掌印里摸到了星宿毒掌的外层门路。",
    chapterGate: "chapter:one:complete",
    requires: (state) => hasStoryFlag(state, "chapter:one:complete")
  },
  {
    id: "sanyin-wugong-zhua",
    artId: "sanyin-wugong-zhua",
    name: "三阴蜈蚣爪",
    locationId: "xingxiu",
    routeKey: "dex",
    tier: "mid",
    accessLevel: "study",
    sourceKind: "teaching",
    sourceLabel: "阿紫示毒",
    requiredProgress: 4,
    dangerous: true,
    keywords: ["三阴蜈蚣爪", "请阿紫示毒", "蜈蚣爪", "阴爪"],
    text: "阿紫只肯示你最外层那一下贴身拿捏。你在她的阴狠里看清了这门爪法为何叫人忌惮。",
    systemNote: "你从阿紫的示毒里记下了三阴蜈蚣爪的路数。",
    chapterGate: "chapter:one:complete",
    prerequisiteArts: ["xingxiu-duzhang"],
    requires: (state) => hasMartialArt(state, "xingxiu-duzhang")
  },
  {
    id: "zhaixing-can",
    artId: "zhaixing-shou",
    name: "摘星手残式",
    locationId: "xingxiu",
    routeKey: "dex",
    tier: "upper_prelude",
    accessLevel: "manual",
    sourceKind: "manual",
    sourceLabel: "星宿密册残页",
    portable: true,
    dangerous: true,
    hidden: true,
    requiredProgress: 4,
    fortuneGate: { minChaMod: 1, revealBonus: 1, upgradeOnSuccess: true },
    keywords: ["摘星手残式", "星宿残页", "摘星残式", "密册残页"],
    text: "这几页残册只记最险的那几下探、拿、锁。它危险，却正好把你推向摘星手的门外。",
    systemNote: "你得到了摘星手的残式密页。",
    chapterGate: "chapter:one:complete",
    prerequisiteArts: ["sanyin-wugong-zhua"],
    requires: (state) => hasMartialArt(state, "sanyin-wugong-zhua")
  },
  {
    id: "huagong-hint",
    name: "化功残篇",
    locationId: "xingxiu",
    routeKey: "int",
    tier: "high_chance",
    accessLevel: "hint",
    hidden: true,
    dangerous: true,
    fortuneGate: { minChaMod: 2, revealBonus: 1 },
    sourceLabel: "化功残篇",
    keywords: ["化功残篇", "化功", "化功门路", "翻看化功残篇"],
    text: "残篇里那股阴柔狠辣的劲路只让你看懂了一层。你知道它很危险，也知道自己眼下还没资格硬学。",
    systemNote: "你先看到了一层化功残篇的线索。",
    hintNote: "化功残篇只露出一线，离真正可学还差资格和胆量。",
    chapterGate: "chapter:one:complete",
    prerequisiteArts: ["xingxiu-duzhang"],
    requires: (state) => hasMartialArt(state, "xingxiu-duzhang")
  }
];

export function resolveMartialArtStoryAction(state: GameState, action: string): MartialArtStoryResolution | undefined {
  const locationId = currentLocationId(state);
  if (!locationId) return undefined;

  for (const route of sourceRegistry) {
    if (route.locationId !== locationId) continue;
    if (route.artId && hasMartialArt(state, route.artId)) continue;
    if (route.artId && (hasPendingStudy(state, route.artId) || hasStudySource(state, route.artId))) continue;
    if (hasStoryFlag(state, routeFlag(route))) continue;
    if (route.accessLevel === "hint" && hasStoryFlag(state, routeHintFlag(route))) continue;
    if (!matchKeywords(action, route.keywords)) continue;
    if (!meetsChapterGate(state, route)) continue;
    if (!meetsArtPrerequisites(state, route)) continue;
    if (!meetsFlagPrerequisites(state, route)) continue;
    if (route.requires && !route.requires(state)) continue;

    if (route.hidden && !meetsFortuneGate(state, route)) {
      if (hasStoryFlag(state, routeHintFlag(route))) continue;
      return {
        text: route.hintText || route.text,
        patch: buildHintPatch(route)
      };
    }

    return {
      text: route.text,
      patch: buildSourcePatch(route)
    };
  }

  return undefined;
}
