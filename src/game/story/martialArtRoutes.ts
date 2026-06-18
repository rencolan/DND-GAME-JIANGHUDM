import type { GamePatch, GameState } from "../../types";

export type MartialArtStoryResolution = {
  text: string;
  patch: GamePatch;
};

type MartialArtRoute = {
  id: string;
  name: string;
  locationId: string;
  keywords: string[];
  requires?: (state: GameState) => boolean;
  text: string;
  systemNote: string;
  extraPatch?: GamePatch;
};

function currentLocationId(state: GameState) {
  return state.locations.find((location) => location.current)?.id;
}

function hasStoryFlag(state: GameState, flag: string) {
  return state.storyFlags.includes(flag);
}

function hasMartialArt(state: GameState, artId: string) {
  return state.character.martialArts.some((art) => art.id === artId);
}

function hasQuestStatus(state: GameState, questId: string, status?: "active" | "resolved" | "hidden") {
  const inList = state.quests.some((quest) => quest.id === questId && (!status || quest.status === status));
  const inState = state.questStateMap[questId];
  return inList || Boolean(inState && (!status || inState.status === status));
}

function matchKeywords(action: string, keywords: string[]) {
  return keywords.some((keyword) => action.includes(keyword));
}

function buildLearnPatch(route: MartialArtRoute): GamePatch {
  return {
    martialArtLearned: {
      id: route.id,
      name: route.name
    },
    storyFlagsAdd: [`learned:${route.id}`],
    systemNote: route.systemNote,
    ...(route.extraPatch || {})
  };
}

const routes: MartialArtRoute[] = [
  {
    id: "wuliang-jianfa",
    name: "无量剑法",
    locationId: "wuliang",
    keywords: ["无量剑法", "剑壁", "无量剑派", "观摩剑路"],
    requires: (state) => hasStoryFlag(state, "npc:duan-yu:met") || hasQuestStatus(state, "quest-wanderer-3", "resolved"),
    text: "你沿着无量山留下的剑痕与步位慢慢推敲，发现这套剑法看似轻灵，其实极重抢先与压步。山风穿谷而过时，几处旧招路竟像在眼前重新活了一遍，你顺着这条脉络把无量剑法的起手与转锋硬记进了身上。",
    systemNote: "你从无量山旧战痕里摸出了无量剑法的门路。"
  },
  {
    id: "zhuifeng-jianlu",
    name: "追风剑路",
    locationId: "wuliang",
    keywords: ["追风剑路", "追风", "快剑", "急剑"],
    requires: (state) => hasMartialArt(state, "wuliang-jianfa") || hasStoryFlag(state, "npc:duan-yu:saved"),
    text: "你顺着无量剑法里最狠最快的那一路继续拆下去，越拆越看出它真正厉害的不在花巧，而在一口气连追三四步、逼得对手没空换势。等你把这股紧追不放的劲理顺，追风剑路也就算真正摸到了手。",
    systemNote: "你把无量剑派的快剑一路继续往深处拆开，习得了追风剑路。"
  },
  {
    id: "beiming-shengong",
    name: "北冥神功",
    locationId: "wuliang",
    keywords: ["北冥神功", "北冥", "石室内功", "化气回转"],
    requires: (state) => hasStoryFlag(state, "npc:duan-yu:saved"),
    text: "段誉提过的石室痕迹与残留下来的运气路数，和你先前见过的正经内功全不一样。你不敢强行贪多，只先照着那股回旋归流的意思缓缓一试，体内真气竟真像被牵引着倒转回来。你知道自己只摸到皮毛，但北冥神功的门已经开了一线。",
    systemNote: "你借无量山石室遗痕参出了一线北冥神功。"
  },
  {
    id: "lingbo-weibu",
    name: "凌波微步",
    locationId: "wuliang",
    keywords: ["凌波微步", "步法", "轻功", "石室步图", "脚印"],
    requires: (state) => hasStoryFlag(state, "npc:duan-yu:saved"),
    text: "你照着石室步图和山道上留下的细碎痕迹反复试走，起初只觉得别扭，走到第三遍时却忽然明白这步法不是拿来赶路，而是拿来让人永远踩不到你真正要落脚的地方。那一瞬你身形一轻，凌波微步的门径也跟着豁开了。",
    systemNote: "你顺着无量山石室步图悟出了凌波微步的门径。"
  },
  {
    id: "duanjia-jianfa",
    name: "段家剑法",
    locationId: "dali",
    keywords: ["段家剑法", "大理剑法", "段家练剑", "段氏剑路"],
    requires: (state) => hasStoryFlag(state, "npc:duan-yu:saved"),
    text: "回到大理后，你把这一路对敌时的发力与身位重新校正，照着段氏一脉讲究的规整剑路一式式捋过去。它不求怪，不求险，真正难的是每一步都稳，每一剑都正。你把这层意思吃透后，段家剑法也就能正式拿来用了。",
    systemNote: "你在大理城里把段氏家传的规整剑路练成了自己能用的本事。"
  },
  {
    id: "wuluo-qingyan-zhang",
    name: "五罗轻烟掌",
    locationId: "dali",
    keywords: ["五罗轻烟掌", "轻烟掌", "烟掌", "掌路轻灵"],
    requires: (state) => hasQuestStatus(state, "quest-wanderer-4", "resolved") || hasStoryFlag(state, "chapter:one:complete"),
    text: "你把大理城里几次贴身短斗的节奏重新捡出来，慢慢摸到这路掌法的关键并不在重，而在贴、让、转、再进。掌影一旦连起来，就像一缕轻烟贴着人走，五罗轻烟掌也便顺势落进了你的手里。",
    systemNote: "你把大理一系偏轻灵的掌路练顺了，习得五罗轻烟掌。"
  },
  {
    id: "yiyang-zhi",
    name: "一阳指",
    locationId: "dali",
    keywords: ["一阳指", "指法", "段氏指法"],
    requires: (state) => hasStoryFlag(state, "chapter:one:complete") && hasMartialArt(state, "duanjia-jianfa"),
    text: "你先把段氏运劲的稳字吃住，再一点点把那口真气压到指尖。等到气机真的聚成一线时，你才明白这一指最难的不是发，而是凝。那缕细而不散的劲终于稳稳立住时，一阳指也算让你摸到了门槛。",
    systemNote: "你在大理段氏的运劲法门里摸到了一阳指的门槛。"
  },
  {
    id: "murong-jianfa",
    name: "慕容剑法",
    locationId: "gusu",
    keywords: ["慕容剑法", "燕子坞剑法", "姑苏剑路", "水榭剑痕"],
    requires: (state) => hasStoryFlag(state, "chapter:one:complete"),
    text: "姑苏水榭与寻常练武场不同，步位、栏影、船身晃动都在逼人随时改招。你沿着那些被刻意收住的精细剑路一路拆下去，越拆越明白慕容家的剑讲究的是紧、细、净。等你把这层气韵接上，慕容剑法也便有了样子。",
    systemNote: "你在姑苏水榭间摸出了慕容剑法的精细门路。"
  },
  {
    id: "canhe-zhi",
    name: "参合指",
    locationId: "gusu",
    keywords: ["参合指", "指劲", "姑苏指法"],
    requires: (state) => hasMartialArt(state, "murong-jianfa"),
    text: "王语嫣替你点破了几处最容易走偏的指上运劲，你再回过头看那些细密路数，才明白参合指真正狠处不在大开大合，而在一点狠、一点准。等这股力真的聚成一线时，你也就算把参合指学进身上了。",
    systemNote: "你借姑苏藏谱和指点摸清了参合指的用劲法门。"
  },
  {
    id: "xiaowuxiang-gong",
    name: "小无相功",
    locationId: "gusu",
    keywords: ["小无相功", "无相", "琅嬛", "王语嫣", "残谱"],
    requires: (state) => hasStoryFlag(state, "chapter:one:complete"),
    text: "琅嬛残谱记得不全，偏偏越是不全，越逼得你去体会那股“似有似无”的运转意味。再想到姑苏一带最近流传的鸠摩智试武手段，你渐渐意识到这门内功厉害的不是一招一式，而是能把别家武学运得像模像样。你没敢深贪，但小无相功的骨架已经让你搭起来了。",
    systemNote: "你借琅嬛残谱与姑苏见闻参出了小无相功的骨架。",
    extraPatch: {
      storyFlagsAdd: ["boss:jiu-mozhi:observed"],
      rumorAdd: [
        {
          text: "鸠摩智在姑苏试武寻谱的手段，和小无相功的运劲路数隐约对得上。",
          kind: "hook",
          location: "姑苏",
          source: "local-martial"
        }
      ]
    }
  },
  {
    id: "jiu-huoyandao",
    name: "火焰刀",
    locationId: "gusu",
    keywords: ["火焰刀", "鸠摩智", "刀气", "观摩火焰刀"],
    requires: (state) => hasStoryFlag(state, "chapter:one:complete"),
    text: "你不敢真去招惹鸠摩智，只敢隔着一段距离去看那道无形刀气怎样逼开灯焰、截断水汽。它不是寻常刀法，而是以内力生刀意。你把那股发劲轨迹硬记下来，回来反复拆练，终究还是从中偷到了一缕火焰刀的神意。",
    systemNote: "你在不敢近身的前提下，靠远观鸠摩智出手摸到了火焰刀的发劲轮廓。",
    extraPatch: {
      storyFlagsAdd: ["boss:jiu-mozhi:observed"]
    }
  },
  {
    id: "luohan-quan",
    name: "罗汉拳",
    locationId: "shaoshi",
    keywords: ["罗汉拳", "少林拳", "基础拳路"],
    requires: (state) => hasStoryFlag(state, "chapter:one:complete"),
    text: "少室山下最不缺的就是最朴正的拳路。你一招一式照着练时，起初只觉得平直，等气息和步架都稳下来后，才懂得罗汉拳真正厉害的是四平八稳里藏着的压迫。等你把这股正劲练住，这门拳也就真进身了。",
    systemNote: "你在少室山演武里练成了罗汉拳的正劲。"
  },
  {
    id: "weituo-chu",
    name: "韦陀杵",
    locationId: "shaoshi",
    keywords: ["韦陀杵", "杵法", "少林杵路"],
    requires: (state) => hasMartialArt(state, "luohan-quan"),
    text: "有了罗汉拳的根基，再看韦陀杵就不是一味硬砸，而是借正架催劲，一击到底。你照着寺外练场留下的几段重劲轨迹反复试过，终于把那股直贯出去的力道打顺，韦陀杵也就能真正上手了。",
    systemNote: "你把少林一路的重劲催到底，练成了韦陀杵。"
  },
  {
    id: "tianshan-liuyang-zhang",
    name: "天山六阳掌",
    locationId: "shaoshi",
    keywords: ["天山六阳掌", "六阳掌", "虚竹掌法"],
    requires: (state) => hasStoryFlag(state, "chapter:one:complete"),
    text: "虚竹讲不出多少漂亮话，可一掌递出时那股堂皇而不失变化的掌劲，却比任何解释都清楚。你照着他替你拆开的两三层劲路慢慢试推，越推越觉得这门掌法阳刚里藏着极深的转折。等到掌劲能自己续上时，天山六阳掌便算入门了。",
    systemNote: "你在虚竹一路掌劲的拆解里学到了天山六阳掌。"
  },
  {
    id: "tianshan-zhemei-shou",
    name: "天山折梅手",
    locationId: "shaoshi",
    keywords: ["天山折梅手", "折梅手", "拆招", "逍遥拆手"],
    requires: (state) => hasStoryFlag(state, "chapter:one:complete"),
    text: "这门手法最可怕的不是快，而是对面越讲究招数，它越容易顺着空隙钻进去。你和虚竹过了几轮手，吃了亏又重来，才慢慢学会怎样借对手的劲改自己的手。等这股应变真的稳下来，天山折梅手也就学到身上了。",
    systemNote: "你在过手拆招里把天山折梅手的应变法门练了出来。"
  },
  {
    id: "shengsi-fu",
    name: "生死符",
    locationId: "shaoshi",
    keywords: ["生死符", "符劲", "寒劲控穴"],
    requires: (state) => hasMartialArt(state, "tianshan-zhemei-shou"),
    text: "你先学的不是伤人，而是怎么把那股细碎寒劲收得住、送得准。等你能让劲气沿经脉一点点钉进去又不至于失控时，才真正明白生死符可怕的从来不是花样，而是控制。你这一下学到的仍是节制版，但已经够让它成为真正的手段。",
    systemNote: "你先从控劲和解劲入手，学会了能真正使用的生死符。"
  },
  {
    id: "taizu-changquan",
    name: "太祖长拳",
    locationId: "yanmen",
    keywords: ["太祖长拳", "长拳", "丐帮旧拳"],
    requires: (state) => hasStoryFlag(state, "chapter:one:complete"),
    text: "北地拳路少花巧，多半就是一口气往前压。你沿着丐帮旧传的练法把架子一遍遍打实，终于把太祖长拳那股既朴又狠的劲练到了身上。它不惊人，却最适合拿来打根底。",
    systemNote: "你在丐帮旧传拳路里练成了太祖长拳。"
  },
  {
    id: "lianhua-zhang",
    name: "莲花掌",
    locationId: "yanmen",
    keywords: ["莲花掌", "丐帮掌法", "连掌"],
    requires: (state) => hasMartialArt(state, "taizu-changquan"),
    text: "有了太祖长拳的根底，再转进莲花掌便顺得多。你把几路连掌的节奏慢慢接上，发现它真正强处在于出手不断，压得人换不过气。等那股连绵不绝的劲一成形，莲花掌也就学到手了。",
    systemNote: "你把丐帮一路连掌的节奏练顺，习得莲花掌。"
  },
  {
    id: "dagou-bangfa",
    name: "打狗棒法",
    locationId: "yanmen",
    keywords: ["打狗棒法", "棒法", "丐帮绝传"],
    requires: (state) => hasMartialArt(state, "lianhua-zhang"),
    text: "这套棒法的狠不在蛮力，而在每一击都冲着对手最难受的位置去。你照着乔峰一系留下的要诀拆练，越练越明白什么叫专打空门、专破招路。等你把这股精狠练顺，打狗棒法便真正算你学会了。",
    systemNote: "你沿着丐帮绝传的路数，习得了打狗棒法。"
  },
  {
    id: "xianglong-shibazhang",
    name: "降龙十八掌",
    locationId: "yanmen",
    keywords: ["降龙十八掌", "降龙掌", "乔峰掌法"],
    requires: (state) => hasMartialArt(state, "dagou-bangfa"),
    text: "你本以为这门掌法只靠霸道，真照着一路练下来才发现它最难的地方恰恰是每一掌都要打得又正又满，不能虚半分。你把劲、步、气一层层咬住，等到那股正面压人的掌力终于立起来时，降龙十八掌才真正落到了你身上。",
    systemNote: "你顺着乔峰一脉的掌路，把降龙十八掌的刚猛正劲练了出来。"
  },
  {
    id: "xingxiu-duzhang",
    name: "星宿毒掌",
    locationId: "xingxiu",
    keywords: ["星宿毒掌", "毒掌", "星宿掌法"],
    requires: (state) => hasStoryFlag(state, "chapter:one:complete"),
    text: "你先见过毒，再去学毒掌，才知道这门掌法并不是单纯阴狠，而是每一掌都在逼对手乱气。你只敢学它最外层的运劲法，不敢妄碰太深的毒理，但即便如此，星宿毒掌也已经足够成为一门危险本事。",
    systemNote: "你在星宿海边只学了最外层的毒掌运劲，仍足够算得上习得星宿毒掌。"
  },
  {
    id: "sanyin-wugong-zhua",
    name: "三阴蜈蚣爪",
    locationId: "xingxiu",
    keywords: ["三阴蜈蚣爪", "蜈蚣爪", "阴爪"],
    requires: (state) => hasMartialArt(state, "xingxiu-duzhang"),
    text: "这门爪法最讲究贴近之后那一下阴狠拿捏。你把身法、扣拿和指上发力一点点合起来后，才终于明白为什么它会让人忌惮。等那股阴劲能顺着关节往里钻时，三阴蜈蚣爪也便算学成了。",
    systemNote: "你把星宿一路的阴狠拿法练成了三阴蜈蚣爪。"
  },
  {
    id: "liumai-shenjian",
    name: "六脉神剑",
    locationId: "dali",
    keywords: ["六脉神剑", "六脉", "以气化剑"],
    requires: (state) => hasMartialArt(state, "yiyang-zhi") && hasMartialArt(state, "beiming-shengong") && hasStoryFlag(state, "chapter:one:complete"),
    text: "你并非一步登天，而是在一阳指与北冥回转都站住之后，才终于有资格去碰这门以气化剑的绝学。那一道剑气真正从指端逼出去时，你自己都先怔了一下。六脉神剑此刻仍只是开端，但这门绝学确实已经被你推开了门。",
    systemNote: "你以一阳指和北冥神功为根，正式推开了六脉神剑的门。"
  }
];

export function resolveMartialArtStoryAction(state: GameState, action: string): MartialArtStoryResolution | undefined {
  const locationId = currentLocationId(state);
  if (!locationId) return undefined;

  for (const route of routes) {
    if (route.locationId !== locationId) continue;
    if (hasMartialArt(state, route.id) || hasStoryFlag(state, `learned:${route.id}`)) continue;
    if (!matchKeywords(action, route.keywords)) continue;
    if (route.requires && !route.requires(state)) continue;

    return {
      text: route.text,
      patch: buildLearnPatch(route)
    };
  }

  return undefined;
}
