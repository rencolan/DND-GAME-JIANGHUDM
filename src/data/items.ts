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
  item("yangluo-powder", "养络散", "温养经络、化散郁滞之气。使用后内伤 -12。战斗中使用会让出这一手。", 1, {
    type: "consumable",
    usable: true,
    innerInjuryRestore: 12,
    combatActionCost: 1,
    value: 24
  }),
  item("smoke-pellet", "烟雾丸", "掷地起烟，战斗中使用后获得掩护，使敌人下一击明显失准。", 1, {
    type: "consumable",
    usable: true,
    grantsStatus: ["screened"],
    combatActionCost: 1,
    value: 22
  }),
  item("heart-guard-pill", "护心丹", "护住心脉，战斗中使用后获得守势，并缓和 6 点内伤。", 1, {
    type: "consumable",
    usable: true,
    innerInjuryRestore: 6,
    grantsStatus: ["guarded"],
    combatActionCost: 1,
    value: 30
  }),
  item("antidote-pill", "解毒丹", "解去常见毒性与寒毒，不直接回血。", 1, {
    type: "consumable",
    usable: true,
    curesStatus: ["poisoned", "cold"],
    combatActionCost: 1,
    value: 26
  }),
  item("dried-meat", "腊肉干粮", "便于路上携带的干粮，顶饿耐放。", 1, { type: "goods", value: 6 }),
  item("lamp-oil", "灯油小壶", "外出常备的一小壶灯油，夜里最用得上。", 1, { type: "goods", value: 9 }),
  item("cloth-wrap", "药布卷", "行路人常备的药布和包扎布，轻伤时派得上用场。", 1, { type: "goods", value: 11 }),
  item("tea-brick", "茶砖", "压得结实的茶砖，拿去换钱也算顺手。", 1, { type: "goods", value: 16 }),
  item("silk-pouch", "丝纹小囊", "做工还算细的丝纹小囊，市面上颇有人肯收。", 1, { type: "goods", value: 28 }),
  item("jade-pin", "玉簪钗", "小巧显眼的玉簪钗，带在身上也算值钱。", 1, { type: "goods", value: 42, canSteal: true }),
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
