import type { Character, OriginTemplate } from "../types";
import { calculateAcFromDex, calculateHpFromCon, calculateMaxQi } from "../game/rules";
import { abilityLabels } from "./display";
import type { RollPackage } from "./sessionTypes";

export function buildCharacterFromOrigin(name: string, origin: OriginTemplate, packageValues: RollPackage): Character {
  const hp = calculateHpFromCon(packageValues[2]);
  const maxQi = calculateMaxQi(origin.qiStart, packageValues[5]);

  return {
    id: `hero-${origin.id}-${Date.now()}`,
    name: name.trim() || "无名少侠",
    title: `${origin.name}，初入江湖`,
    portrait: "../assets/portraits/nameless-wanderer.png",
    hp,
    maxHp: hp,
    qi: maxQi,
    maxQi,
    ac: calculateAcFromDex(packageValues[1]),
    silver: 0,
    abilities: [
      { key: "str", label: abilityLabels.str, value: packageValues[0] },
      { key: "dex", label: abilityLabels.dex, value: packageValues[1] },
      { key: "con", label: abilityLabels.con, value: packageValues[2] },
      { key: "int", label: abilityLabels.int, value: packageValues[3] },
      { key: "cha", label: abilityLabels.cha, value: packageValues[4] },
      { key: "wis", label: abilityLabels.wis, value: packageValues[5] }
    ],
    martialArts: origin.martialArts.map((art) => ({ ...art, source: origin.name })),
    inventory: [
      {
        id: "medicine",
        name: "金疮药",
        desc: "恢复 8 点生命。",
        count: 2,
        type: "consumable",
        value: 0,
        usable: true,
        hpRestore: 8
      },
      {
        id: "qi-pill",
        name: "行气散",
        desc: "恢复 2 点内力。",
        count: 1,
        type: "consumable",
        value: 0,
        usable: true,
        qiRestore: 2
      },
      ...(origin.openingItem ? [origin.openingItem] : [])
    ],
    originId: origin.id,
    isCustom: true
  };
}
