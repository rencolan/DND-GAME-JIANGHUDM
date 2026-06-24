import type { Item } from "../types";
import { item } from "./shared";

export const itemCatalog: Item[] = [
  item("medicine", "金疮药", "恢复 6 点生命。战斗中使用会让出这一手。", 1, {
    type: "consumable",
    usable: true,
    hpRestore: 6,
    combatActionCost: 1,
    value: 16
  }),
  item("qi-pill", "行气散", "恢复 2 点真气。战斗中使用会让出这一手。", 1, {
    type: "consumable",
    usable: true,
    qiRestore: 2,
    combatActionCost: 1,
    value: 14
  }),
  item("yangluo-powder", "养络散", "温养经络，化散郁滞之气。使用后内伤 -12。", 1, {
    type: "consumable",
    usable: true,
    innerInjuryRestore: 12,
    combatActionCost: 1,
    value: 24
  }),
  item("smoke-pellet", "烟雾丸", "掷地起烟。战斗中使用后获得掩护，使敌人下一击更容易失准。", 1, {
    type: "consumable",
    usable: true,
    grantsStatus: ["screened"],
    combatActionCost: 1,
    value: 22
  }),
  item("heart-guard-pill", "护心丸", "护住心脉。战斗中使用后获得守势，并缓和 6 点内伤。", 1, {
    type: "consumable",
    usable: true,
    innerInjuryRestore: 6,
    grantsStatus: ["guarded"],
    combatActionCost: 1,
    value: 30
  }),
  item("antidote-pill", "解毒丸", "解去常见毒性与寒毒，不直接回血。", 1, {
    type: "consumable",
    usable: true,
    curesStatus: ["poisoned", "cold"],
    combatActionCost: 1,
    value: 26
  }),
  item("dried-meat", "腊肉干粮", "便于路上携带的干粮，顶饿耐放。", 1, { type: "goods", value: 6 }),
  item("lamp-oil", "灯油小壶", "外出常备的一小壶灯油，夜里最用得上。", 1, { type: "goods", value: 9 }),
  item("cloth-wrap", "药布包", "行路人常备的药布和包扎布，轻伤时派得上用场。", 1, { type: "goods", value: 11 }),
  item("tea-brick", "茶砖", "压得结实的茶砖，拿去换钱也算顺手。", 1, { type: "goods", value: 16 }),
  item("silk-pouch", "丝纹小囊", "做工细致的丝纹小囊，市面上颇有人肯收。", 1, { type: "goods", value: 28 }),
  item("jade-pin", "玉簪针", "小巧显眼的玉簪针，带在身上也算值钱。", 1, { type: "goods", value: 42, canSteal: true }),
  item("ledger-copy", "账页副本", "客栈账簿里夹出的誊页，能卖消息，也可能牵出掌柜背后的人。", 1, {
    type: "quest",
    value: 36,
    canSell: false,
    canSteal: true
  }),
  item("ledger-fragment", "残破账页", "从黑衣刺客身上搜出的残页，上面留着水路暗记和几处接头记号。", 1, {
    type: "quest",
    value: 0,
    canSell: false
  }),
  item("watermark-map", "水路暗记图", "阿朱替你誊出的水路暗记，几处墨点最终都压向姑苏码头。", 1, {
    type: "quest",
    value: 0,
    canSell: false
  }),
  item("hero-invitation-draft", "英雄帖伪稿", "姑苏码头搜出的伪稿，字面邀英雄赴会，背后却像是在替星宿海点名。", 1, {
    type: "quest",
    value: 0,
    canSell: false
  }),
  item("xingxiu-secret-page", "星宿密册残页", "残页上夹着毒掌、摘星手和化功大法的零碎门路，越看越觉阴寒。", 1, {
    type: "manual",
    value: 0,
    canSell: false,
    dangerous: true,
    manualArtId: "zhaixing-shou",
    studySourceKind: "manual",
    routeKey: "dex",
    accessLevel: "manual",
    requiredProgress: 4,
    tier: "upper_prelude"
  }),
  item("huagong-fragment", "化功残篇", "只露一角的化功法门，足以让人明白丁春秋如何封人内息。", 1, {
    type: "quest",
    value: 0,
    canSell: false,
    dangerous: true
  }),
  item("xiaowuxiang-commentary", "小无相批注残卷", "王语嫣指出的残卷批注，只够做高阶线索，不足以直接练成绝学。", 1, {
    type: "manual",
    value: 0,
    canSell: false,
    manualArtId: "xiaowuxiang-gong",
    studySourceKind: "manual",
    routeKey: "wis",
    accessLevel: "manual",
    requiredProgress: 5,
    tier: "high_chance",
    hidden: true
  }),
  item("final-antidote", "护心解毒散", "终战前调成的护心解毒散，可缓住化功与寒毒的余劲。", 1, {
    type: "consumable",
    usable: true,
    curesStatus: ["poisoned", "cold"],
    innerInjuryRestore: 14,
    combatActionCost: 1,
    value: 0,
    canSell: false
  }),
  item("disguise-kit", "易容小匣", "阿朱随身的小匣，里面是薄粉、胶泥和几张能改口音的纸条。", 1, {
    type: "goods",
    value: 48,
    canSteal: true
  }),
  item("martial-commentary-page", "武学批注残页", "王语嫣手边的批注残页，短短几行却能点破一门招式的破绽。", 1, {
    type: "quest",
    value: 44,
    canSell: false,
    canSteal: true
  }),
  item("wuliang-step-note", "无量步图残记", "段誉记下的石室步图残记，凌波与北冥的线索都隐在边角。", 1, {
    type: "quest",
    value: 50,
    canSell: false,
    canSteal: true
  }),
  item("sleeve-poison-powder", "袖箭毒粉", "木婉清箭囊里压着的小包毒粉，能吓人，也容易把局面闹大。", 1, {
    type: "goods",
    value: 38,
    dangerous: true,
    canSteal: true
  }),
  item("yanmen-old-token", "雁门旧案残签", "乔峰贴身收着的残签，牵着一桩他不愿随便示人的旧案。", 1, {
    type: "quest",
    value: 58,
    canSell: false,
    canSteal: true
  }),
  item("shaolin-sealed-letter", "少林封缄残信", "虚竹护着的残信，封口已旧，拆开便很难再装回原样。", 1, {
    type: "quest",
    value: 46,
    canSell: false,
    canSteal: true
  }),
  item("dali-heart-manual", "大理心法抄本", "客栈旧抄本整理出的基础心法，适合稳步打底。", 1, {
    type: "manual",
    value: 32,
    canSell: false,
    manualArtId: "dali-xinfa",
    studySourceKind: "manual",
    routeKey: "wis",
    accessLevel: "manual",
    requiredProgress: 3
  })
];
