import type { Character, Item, MartialArt } from "../types";
import { calculateAcFromDex, calculateHpFromCon, calculateMaxQi } from "../game/rules";

const rasterPortraitIds = new Set([
  "a-zhu",
  "a-zi",
  "duan-yu",
  "innkeeper",
  "mu-wanqing",
  "murong-fu",
  "qiao-feng",
  "shuang-er",
  "wang-yuyan",
  "xu-zhu"
]);

export const portrait = (id: string) => rasterPortraitIds.has(id)
  ? `./assets/portraits/${id}${id === "shuang-er" ? "-v3" : id === "innkeeper" ? "-v2" : ""}.png`
  : `./assets/portraits/${id}.svg`;

export const item = (id: string, name: string, desc: string, count = 1, extra: Partial<Item> = {}): Item => ({
  id,
  name,
  desc,
  count,
  value: extra.value ?? 0,
  ...extra,
  type: extra.type || "quest"
});

export const art = (
  id: string,
  name: string,
  category: MartialArt["category"],
  linkedAbility: string,
  damageDice: string,
  _summary: string,
  baseQiCost: number,
  extra: Partial<MartialArt> = {}
): MartialArt => ({
  id,
  name,
  grade: "入门",
  category,
  linkedAbility,
  damageDice,
  baseQiCost,
  source: "开局所学",
  ...extra
});

export const defaultInventory = () => ([
  item("medicine", "金疮药", "恢复 6 点生命。战斗中使用会让出这一手。", 2, {
    type: "consumable",
    usable: true,
    hpRestore: 6,
    combatActionCost: 1
  }),
  item("qi-pill", "行气散", "恢复 2 点真气。战斗中使用会让出这一手。", 1, {
    type: "consumable",
    usable: true,
    qiRestore: 2,
    combatActionCost: 1
  }),
  item("smoke-pellet", "烟雾丸", "掷地起烟，战斗中使用后获得掩护，使敌人下一击明显失准。", 1, {
    type: "consumable",
    usable: true,
    grantsStatus: ["screened"],
    combatActionCost: 1
  })
]);

export const makeCharacter = (
  id: string,
  name: string,
  title: string,
  focus: [number, number, number, number, number, number],
  qi: number,
  martialArts: MartialArt[],
  extra: Partial<Character> = {}
): Character => {
  const hp = calculateHpFromCon(focus[2]);
  const maxQi = calculateMaxQi(qi, focus[5]);

  return {
    id,
    name,
    title,
    portrait: portrait(id),
    hp,
    maxHp: hp,
    qi: maxQi,
    maxQi,
    ac: calculateAcFromDex(focus[1]),
    silver: 36,
    abilities: [
      { key: "str", label: "力道", value: focus[0] },
      { key: "dex", label: "身法", value: focus[1] },
      { key: "con", label: "根骨", value: focus[2] },
      { key: "int", label: "悟性", value: focus[3] },
      { key: "cha", label: "气运", value: focus[4] },
      { key: "wis", label: "心境", value: focus[5] }
    ],
    martialArts,
    inventory: defaultInventory(),
    ...extra
  };
};
