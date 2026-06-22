import type { EnemyArchetype, MartialArt } from "../types";
import { defaultMartialArts } from "./martialArts";

type EnemyPreset = {
  id: string;
  name: string;
  hp: number;
  maxHp: number;
  qi: number;
  maxQi: number;
  ac: number;
  archetype: EnemyArchetype;
  intent: string;
  abilities: Record<"str" | "dex" | "con" | "int" | "cha" | "wis", number>;
  martialArts: MartialArt[];
  tags: string[];
};

export const enemyPresets: EnemyPreset[] = [
  {
    id: "tutorial-ruffian",
    name: "拦路泼皮",
    hp: 14,
    maxHp: 14,
    qi: 0,
    maxQi: 0,
    ac: 10,
    archetype: "brute",
    intent: "正面乱打，想用蛮劲逼你后退。",
    abilities: { str: 10, dex: 10, con: 10, int: 8, cha: 8, wis: 8 },
    martialArts: [defaultMartialArts.jianghu.find((entry) => entry.id === "jianghu-daolu")!],
    tags: ["教学敌人", "杂兵", "低压"]
  },
  {
    id: "black-assassin",
    name: "黑衣刺客",
    hp: 24,
    maxHp: 24,
    qi: 3,
    maxQi: 3,
    ac: 12,
    archetype: "assassin",
    intent: "贴身抢攻，等你露出空门。",
    abilities: { str: 12, dex: 13, con: 11, int: 10, cha: 9, wis: 11 },
    martialArts: [...defaultMartialArts.enemy],
    tags: ["前期试探", "快攻"]
  },
  {
    id: "zuo-zimu",
    name: "左子穆",
    hp: 30,
    maxHp: 30,
    qi: 4,
    maxQi: 4,
    ac: 13,
    archetype: "defender",
    intent: "守住剑门，等你急躁时反刺。",
    abilities: { str: 11, dex: 14, con: 12, int: 11, cha: 10, wis: 11 },
    martialArts: defaultMartialArts.wuliang.filter((entry) => ["wuliang-jianfa", "zhuifeng-jianlu"].includes(entry.id)),
    tags: ["前期剑客", "无量剑派", "试锋"]
  },
  {
    id: "yue-laosan",
    name: "岳老三",
    hp: 36,
    maxHp: 36,
    qi: 4,
    maxQi: 4,
    ac: 13,
    archetype: "brute",
    intent: "硬冲硬砸，逼你正面接招。",
    abilities: { str: 16, dex: 11, con: 14, int: 8, cha: 9, wis: 10 },
    martialArts: defaultMartialArts.villains.filter((entry) => ["ezui-jian", "ewei-hengsao"].includes(entry.id)),
    tags: ["粗暴压制", "四大恶人", "重击"]
  },
  {
    id: "yun-zhonghe",
    name: "云中鹤",
    hp: 40,
    maxHp: 40,
    qi: 5,
    maxQi: 5,
    ac: 14,
    archetype: "assassin",
    intent: "绕身寻隙，靠快手连拿要害。",
    abilities: { str: 11, dex: 16, con: 13, int: 10, cha: 11, wis: 10 },
    martialArts: defaultMartialArts.villains.filter((entry) => ["heshe-bada", "hezhua-qinna"].includes(entry.id)),
    tags: ["高机动刺客", "四大恶人", "诡快"]
  },
  {
    id: "ding-chunqiu",
    name: "丁春秋",
    hp: 48,
    maxHp: 48,
    qi: 12,
    maxQi: 12,
    ac: 15,
    archetype: "poisoner",
    intent: "先以毒雾和化功乱你的内息，再找封脉的空门。",
    abilities: { str: 12, dex: 14, con: 14, int: 18, cha: 13, wis: 16 },
    martialArts: defaultMartialArts.bosses.filter((entry) => ["ding-huagong", "ding-sanxiao", "ding-zhaixing"].includes(entry.id)),
    tags: ["邪门宗师", "毒功", "控场"]
  },
  {
    id: "you-tanzhi",
    name: "游坦之",
    hp: 44,
    maxHp: 44,
    qi: 10,
    maxQi: 10,
    ac: 14,
    archetype: "internalist",
    intent: "靠寒毒硬缠，拖得越久，你的真气越难顺畅。",
    abilities: { str: 15, dex: 12, con: 16, int: 9, cha: 8, wis: 11 },
    martialArts: defaultMartialArts.bosses.filter((entry) => ["you-bingcan", "you-tietou", "you-shengsi"].includes(entry.id)),
    tags: ["寒毒缠斗", "重压", "内伤"]
  },
  {
    id: "jiu-mozhi",
    name: "鸠摩智",
    hp: 56,
    maxHp: 56,
    qi: 18,
    maxQi: 18,
    ac: 16,
    archetype: "boss",
    intent: "先观察你的路数，再以小无相功转势，伺机起火焰刀。",
    abilities: { str: 14, dex: 15, con: 15, int: 17, cha: 14, wis: 18 },
    martialArts: [
      ...defaultMartialArts.bosses.filter((entry) => ["jiu-huoyandao", "jiu-longzhao"].includes(entry.id)),
      defaultMartialArts.xiaoyao.find((entry) => entry.id === "xiaowuxiang-gong")!
    ],
    tags: ["终局宗师", "高内力", "爆发"]
  }
];
