import type { MartialArt } from "../types";
import { art } from "./shared";

export const defaultMartialArts = {
  dali: [
    art("yiyang-zhi", "一阳指", "internal", "int", "1d8", "凝气一点，隔空伤敌。", 1, {
      grade: "家传",
      source: "大理段氏",
      role: "utility",
      tags: ["pierce", "injure"],
      effectText: "穿防，并提高内伤压力。"
    }),
    art("dali-xinfa", "大理心法", "internal", "wis", "1d4", "以内息调匀经脉，适合稳守回气。", 1, {
      grade: "家传",
      source: "大理段氏",
      role: "recovery",
      tags: ["recover", "guard"],
      effectText: "命中后回气，主运时调息更稳。"
    }),
    art("duanjia-jianfa", "段家剑法", "external", "dex", "1d6", "剑路规整轻灵，讲究快进快收。", 0, {
      grade: "入门",
      source: "大理段氏",
      role: "starter",
      tags: ["pierce"],
      effectText: "对高护甲目标更容易找到空隙。"
    }),
    art("wuluo-qingyan-zhang", "五罗轻烟掌", "external", "dex", "1d6", "掌影轻快，适合贴身连出。", 0, {
      grade: "熟练",
      source: "大理段氏",
      role: "utility",
      tags: ["control"],
      effectText: "命中后扰乱敌人下次出手。"
    })
  ],
  jianghu: [
    art("jianghu-daolu", "江湖刀路", "external", "str", "1d6", "刀法直接，适合抢身位与逼退对手。", 0, {
      grade: "粗浅",
      source: "江湖旧路",
      role: "pressure",
      tags: ["break"],
      effectText: "命中后容易打出破绽。"
    }),
    art("kuaidao-xiaojia", "快刀小架", "external", "dex", "1d6", "短刀小架简洁利落，专为近身抢位开门。", 0, {
      grade: "入门",
      source: "江湖旧路",
      role: "utility",
      tags: ["control"],
      effectText: "压住敌人节奏，使其下次攻击不稳。"
    }),
    art("tuna-fa", "吐纳法", "internal", "wis", "1d4", "吐纳导气，稳住周天运转。", 0, {
      grade: "入门",
      source: "江湖吐纳旧本",
      role: "recovery",
      tags: ["recover"],
      effectText: "命中或运转成功后回 1 点真气。"
    }),
    art("renxue-shou", "认穴手", "external", "int", "1d4", "先认经脉落点，再以巧劲点穴制敌。", 0, {
      grade: "入门",
      source: "江湖点穴散手",
      role: "utility",
      tags: ["break", "injure"],
      effectText: "伤害低，但容易制造破绽并伤及气脉。"
    })
  ],
  shaolin: [
    art("shaolin-changquan", "少林长拳", "external", "str", "1d4", "拳架平正，适合稳步压近。", 0, {
      grade: "正宗",
      source: "少林",
      role: "starter",
      tags: ["guard"],
      effectText: "架势稳，出手后保留守势。"
    }),
    art("shaolin-neigong", "少林内功", "internal", "wis", "1d6", "调息护体，适合以内劲硬接。", 1, {
      grade: "正宗",
      source: "少林",
      role: "defense",
      tags: ["guard", "recover"],
      effectText: "守势强，兼具稳定回气。"
    }),
    art("luohan-quan", "罗汉拳", "external", "str", "1d6", "拳势沉稳厚实，适合正面交手。", 0, {
      grade: "入门",
      source: "少林",
      role: "pressure",
      tags: ["break"],
      effectText: "正面压制，命中后破防。"
    }),
    art("weituo-chu", "韦陀杵", "external", "str", "1d8", "劲力直贯，讲究一击压人。", 0, {
      grade: "熟练",
      source: "少林",
      role: "pressure",
      tags: ["break", "guard"],
      effectText: "破防同时稳住自身架势。"
    })
  ],
  wuliang: [
    art("wuliang-jianfa", "无量剑法", "external", "dex", "1d6", "剑法轻快多变，擅长早期试锋。", 0, {
      grade: "入门",
      source: "无量剑派",
      role: "starter",
      tags: ["pierce"],
      effectText: "灵动穿防，对高 AC 敌人更稳。"
    }),
    art("zhuifeng-jianlu", "追风剑路", "external", "dex", "1d8", "剑路紧追不放，连刺连封。", 0, {
      grade: "熟练",
      source: "无量剑派",
      role: "pressure",
      tags: ["pierce", "control"],
      effectText: "穿防并扰乱敌方下一击。"
    })
  ],
  beggar: [
    art("taizu-changquan", "太祖长拳", "external", "str", "1d6", "拳法朴实狠辣，一招一式都能打人。", 0, {
      grade: "入门",
      source: "丐帮旧传",
      role: "pressure",
      tags: ["break"],
      effectText: "命中后压出破绽。"
    }),
    art("lianhua-zhang", "莲花掌", "external", "str", "1d8", "掌势连续，出手稳而不断。", 0, {
      grade: "熟练",
      source: "丐帮旧传",
      role: "pressure",
      tags: ["break", "control"],
      effectText: "连续压制，破防并扰乱节奏。"
    }),
    art("dagou-bangfa", "打狗棒法残路", "external", "str", "2d6", "棒影起落，专打正面空隙。", 0, {
      grade: "中段",
      source: "丐帮绝传残路",
      role: "finisher",
      tags: ["break", "control"],
      effectText: "强破防，命中后敌人难以稳住。"
    }),
    art("xianglong-shibazhang", "降龙十八掌真传线索", "external", "str", "2d6", "掌力雄浑刚猛，讲究正面压垮对手。", 1, {
      grade: "绝学",
      source: "乔峰所传线索",
      role: "finisher",
      tags: ["break", "injure"],
      effectText: "重压破防；若敌人已有破绽，这一掌更像收束战局的终结手。"
    })
  ],
  gusu: [
    art("murong-jianfa", "慕容剑法", "external", "dex", "1d8", "剑势秀雅细密，步步紧跟。", 0, {
      grade: "熟练",
      source: "姑苏慕容",
      role: "utility",
      tags: ["pierce", "control"],
      effectText: "以快制乱，穿防并控场。"
    }),
    art("canhe-zhi", "参合指", "internal", "int", "1d8", "指劲聚于一点，阴柔中带狠压。", 1, {
      grade: "上乘前置",
      source: "姑苏慕容",
      role: "utility",
      tags: ["break", "injure"],
      effectText: "认穴破防，并提高内伤压力。"
    })
  ],
  xingxiu: [
    art("xingxiu-duzhang", "星宿毒掌", "internal", "con", "1d8", "掌风夹杂邪气，贴身最是阴损。", 1, {
      grade: "熟练",
      source: "星宿海",
      role: "pressure",
      tags: ["injure", "control"],
      effectText: "内伤压力强，但路数阴毒。"
    }),
    art("sanyin-wugong-zhua", "三阴蜈蚣爪", "external", "dex", "1d8", "爪法刁钻歹毒，专取近身要害。", 0, {
      grade: "熟练",
      source: "星宿海",
      role: "utility",
      tags: ["control", "injure"],
      effectText: "控场并提高内伤压力。"
    }),
    art("zhaixing-shou", "摘星手残式", "external", "dex", "1d10", "从残式里拆出最险的一路探拿锁扣。", 1, {
      grade: "上乘前置",
      source: "星宿秘册残页",
      role: "finisher",
      tags: ["pierce", "control"],
      effectText: "刁钻穿防，命中后压住敌方出手。"
    })
  ],
  xiaoyao: [
    art("xiaoyao-zhang", "逍遥掌", "internal", "wis", "1d8", "掌力绵里藏针，看似轻缓却能透劲。", 1, {
      grade: "熟练",
      source: "逍遥派",
      role: "utility",
      tags: ["injure", "recover"],
      effectText: "透劲伤脉，并能回气。"
    }),
    art("beiming-shengong", "北冥神功残页", "internal", "wis", "1d8", "真气回旋流转，出手后仍余劲不断。", 2, {
      grade: "高阶",
      source: "逍遥派残页",
      role: "recovery",
      tags: ["recover", "injure"],
      effectText: "伤害不高，核心是命中后回气并叠内伤压力，修炼失败风险高。"
    }),
    art("lingbo-weibu", "凌波微步步图", "external", "dex", "1d4", "步法飘忽，出手如在空隙间穿行。", 1, {
      grade: "高阶",
      source: "逍遥派步图",
      role: "defense",
      tags: ["guard", "pierce"],
      effectText: "不是杀招，而是守势、脱身和穿防的身法核心。"
    }),
    art("tianshan-liuyang-zhang", "天山六阳掌前置", "internal", "wis", "2d6", "掌力堂皇正大，层层递进。", 2, {
      grade: "高阶",
      source: "逍遥派",
      role: "pressure",
      tags: ["break", "injure"],
      effectText: "正面破防并提高内伤压力。"
    }),
    art("tianshan-zhemei-shou", "天山折梅手拆招", "external", "dex", "2d6", "近身连变，以巧劲破门而入。", 1, {
      grade: "高阶",
      source: "逍遥派",
      role: "utility",
      tags: ["control", "pierce"],
      effectText: "拆招控场，兼具穿防。"
    }),
    art("shengsi-fu", "生死符控劲法", "internal", "wis", "2d6", "寒劲灌入经脉，出手便叫人变色。", 2, {
      grade: "高阶",
      source: "逍遥派",
      role: "finisher",
      tags: ["injure", "control"],
      effectText: "强内伤与控场。"
    }),
    art("xiaowuxiang-gong", "小无相功骨架", "internal", "wis", "2d6", "劲力无声无相，运转时最显深厚。", 2, {
      grade: "绝学",
      source: "逍遥派",
      role: "utility",
      tags: ["recover", "pierce"],
      effectText: "兼容多路武学，回气并穿防。"
    })
  ],
  villains: [
    art("ezui-jian", "鳄嘴剪", "external", "str", "1d10", "怪兵一合而下，狠劲十足。", 0, {
      grade: "上乘前置",
      source: "四大恶人",
      role: "finisher",
      tags: ["break"],
      effectText: "重手破防。"
    }),
    art("ewei-hengsao", "鳄尾横扫", "external", "str", "1d8", "横扫硬砸，最适合压身抢位。", 0, {
      grade: "熟练",
      source: "四大恶人",
      role: "pressure",
      tags: ["control"],
      effectText: "扫乱步伐，削弱下次攻击。"
    }),
    art("heshe-bada", "鹤蛇八打", "external", "dex", "1d8", "招式细碎凌厉，连击极快。", 0, {
      grade: "上乘前置",
      source: "四大恶人",
      role: "utility",
      tags: ["control", "pierce"],
      effectText: "快攻穿防并扰乱对手。"
    }),
    art("hezhua-qinna", "鹤爪擒拿", "external", "dex", "1d10", "手法阴毒迅急，专拿关节与咽喉。", 0, {
      grade: "上乘前置",
      source: "四大恶人",
      role: "finisher",
      tags: ["pierce", "injure"],
      effectText: "刁钻穿防并伤脉。"
    })
  ],
  enemy: [
    art("enemy-dagger", "黑衣短刺", "external", "dex", "1d6", "贴身抢攻，专取空门。", 0, {
      grade: "敌招",
      source: "黑衣刺客",
      role: "starter",
      tags: ["pierce"],
      effectText: "贴身穿防。"
    }),
    art("enemy-cuijin", "催劲突袭", "internal", "dex", "1d8", "催动内劲猛扑，凶狠而冒进。", 1, {
      grade: "敌招",
      source: "黑衣刺客",
      role: "pressure",
      tags: ["injure", "control"],
      effectText: "内劲突袭，可能伤脉。"
    })
  ],
  bosses: [
    art("ding-huagong", "化功大法", "internal", "int", "2d6", "掌风阴柔狠毒，专破内息与经脉。", 2, {
      grade: "宗师",
      source: "丁春秋",
      role: "finisher",
      tags: ["injure", "control"],
      effectText: "命中后封脉，迫使对手内功额外耗气。"
    }),
    art("ding-sanxiao", "三笑逍遥散", "internal", "int", "2d6", "毒雾先行，逼人乱神失位。", 1, {
      grade: "邪门",
      source: "丁春秋",
      role: "utility",
      tags: ["control", "injure"],
      effectText: "削弱对手出手并伤脉。"
    }),
    art("ding-zhaixing", "摘星手", "external", "dex", "1d10", "忽探忽拿，专取兵刃与咽喉。", 0, {
      grade: "狠招",
      source: "丁春秋",
      role: "utility",
      tags: ["pierce", "control"],
      effectText: "穿防控场。"
    }),
    art("you-bingcan", "冰蚕毒掌", "internal", "con", "2d6", "寒毒透体，掌劲带着黏滞阴寒。", 2, {
      grade: "异门",
      source: "游坦之",
      role: "pressure",
      tags: ["injure", "guard"],
      effectText: "寒毒伤脉，同时守势坚韧；拖久会压住真气。"
    }),
    art("you-tietou", "铁头硬撞", "external", "str", "1d10", "蛮横冲阵，靠一口狠劲硬撞开门户。", 0, {
      grade: "凶招",
      source: "游坦之",
      role: "pressure",
      tags: ["break", "guard"],
      effectText: "硬撞破防并保持守势。"
    }),
    art("you-shengsi", "生死符反劲", "internal", "wis", "2d6", "内劲乱窜时反扑而出，寒意缠身。", 1, {
      grade: "旁门",
      source: "游坦之",
      role: "utility",
      tags: ["control", "injure"],
      effectText: "控场并伤脉。"
    }),
    art("jiu-huoyandao", "火焰刀", "internal", "int", "2d8", "无形刀气横空劈落，炽烈霸道。", 3, {
      grade: "绝学",
      source: "鸠摩智",
      role: "finisher",
      tags: ["pierce", "injure"],
      damageBonus: 2,
      effectText: "无形刀气穿防，适合作为读招后的爆发，而不是每轮平推。"
    }),
    art("jiu-longzhao", "龙爪擒拿", "external", "str", "2d8", "擒、锁、抓一气呵成，逼人近身崩盘。", 0, {
      grade: "上乘",
      source: "鸠摩智",
      role: "pressure",
      tags: ["break", "control"],
      effectText: "破防并控住节奏。"
    })
  ],
  legends: [
    art("liumai-shenjian", "六脉神剑", "internal", "int", "3d6", "以内力化作剑气，一线穿空。", 3, {
      grade: "绝学",
      source: "剧情习得",
      role: "finisher",
      tags: ["pierce", "injure"],
      damageBonus: 2,
      effectText: "顶级穿防与内伤压力；真正强处在破防和连段资格。"
    })
  ]
} as const;

export const martialArtCatalog: MartialArt[] = Object.values(defaultMartialArts).flatMap((entries) => [...entries]);
