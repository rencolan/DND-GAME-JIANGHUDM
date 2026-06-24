import type { EconomyState, LocationNode, MerchantProfile, Npc, StealProfile } from "../types";
import { portrait } from "./shared";

export const locations: LocationNode[] = [
  { id: "dali", name: "大理城", x: 18, y: 68, unlocked: true, current: true, desc: "苍山洱海之间，坊市里总比官道先传出消息。" },
  { id: "wuliang", name: "无量山", x: 34, y: 76, unlocked: true, desc: "山路深曲，草木与脚印都擅长藏话。" },
  { id: "gusu", name: "姑苏", x: 66, y: 60, unlocked: false, desc: "水路纵横，消息与人心一样绕。" },
  { id: "shaoshi", name: "少室山", x: 58, y: 30, unlocked: false, desc: "钟声入云，山门下的人未必都是香客。" },
  { id: "yanmen", name: "雁门关", x: 78, y: 20, unlocked: false, desc: "风沙极硬，旧案与血债都埋在关外。" },
  { id: "xingxiu", name: "星宿海", x: 15, y: 24, unlocked: false, desc: "毒雾与怪笑同起，远行者少有归人。" }
];

const innkeeperNpc: Npc = {
  id: "innkeeper",
  name: "掌柜",
  title: "大理客栈掌柜",
  portrait: portrait("innkeeper"),
  location: "大理城",
  goal: "稳住客栈生意，也盯紧无量山传回来的风声。",
  attitude: "老练",
  relationship: 52,
  lastSeen: "客栈前堂",
  status: "守着柜台待客",
  tags: ["客栈", "生意", "消息"],
  companion: false,
  hidden: false,
  discovered: true,
  recruitable: false
};

export const npcs: Npc[] = [
  innkeeperNpc,
  { id: "duan-yu", name: "段誉", title: "大理世子", portrait: portrait("duan-yu"), location: "无量山", goal: "误入山中乱局，还想护着身边的人", attitude: "温雅", relationship: 48, lastSeen: "无量山山道", status: "未现身", tags: ["大理", "世族"], companion: false, hidden: true, discovered: false },
  { id: "qiao-feng", name: "乔峰", title: "丐帮帮主", portrait: portrait("qiao-feng"), location: "雁门关", goal: "追查边关旧案，也留意星宿与英雄帖的动静", attitude: "敬重", relationship: 58, lastSeen: "北地酒肆", status: "远行", tags: ["丐帮", "豪侠"], companion: false },
  { id: "murong-fu", name: "慕容复", title: "姑苏公子", portrait: portrait("murong-fu"), location: "姑苏", goal: "寻找英雄帖背后的势力，也试探来客分量", attitude: "试探", relationship: 38, lastSeen: "燕子坞水榭", status: "观望", tags: ["姑苏", "世家"], companion: false },
  { id: "xu-zhu", name: "虚竹", title: "少林弟子", portrait: portrait("xu-zhu"), location: "少室山", goal: "护送寺中密信，不愿看无辜人卷入毒局", attitude: "和善", relationship: 50, lastSeen: "寺外石阶", status: "未会合", tags: ["少林"], companion: false },
  { id: "wang-yuyan", name: "王语嫣", title: "琅嬛书影", portrait: portrait("wang-yuyan"), location: "姑苏", goal: "辨认银针、刀气与毒功背后的武学门路", attitude: "谨慎", relationship: 46, lastSeen: "藏书楼", status: "可请教", tags: ["武学"], companion: false },
  { id: "a-zhu", name: "阿朱", title: "易容巧手", portrait: portrait("a-zhu"), location: "大理城", goal: "打探黑衣人的真实身份，替水路暗记找源头", attitude: "亲近", relationship: 62, lastSeen: "城南茶肆", status: "暗访", tags: ["潜入"], companion: false },
  { id: "a-zi", name: "阿紫", title: "星宿门下", portrait: portrait("a-zi"), location: "星宿海", goal: "盯住值得利用的人与物，也替自己找退路", attitude: "乖张", relationship: 24, lastSeen: "毒雾边市", status: "行踪不定", tags: ["星宿", "毒"], companion: false, hidden: true, discovered: false },
  { id: "jiu-mozhi", name: "鸠摩智", title: "吐蕃国师", portrait: portrait("jiu-mozhi"), location: "姑苏", goal: "以火焰刀与小无相功压场，试探中原武学虚实", attitude: "高压", relationship: 20, lastSeen: "姑苏水路", status: "只作高阶压力，不强制开战", tags: ["宗师", "吐蕃", "火焰刀"], companion: false, hidden: false, discovered: true },
  { id: "you-tanzhi", name: "游坦之", title: "寒毒怪客", portrait: portrait("you-tanzhi"), location: "星宿海", goal: "被寒毒与执念推着走，成了星宿局中一枚极危险的棋", attitude: "混乱", relationship: 18, lastSeen: "星宿毒雾", status: "尚未露面", tags: ["寒毒", "强敌"], companion: false, hidden: true, discovered: false },
  { id: "ding-chunqiu", name: "丁春秋", title: "星宿老怪", portrait: portrait("ding-chunqiu"), location: "星宿海", goal: "收束英雄帖伪稿与星宿密册残页，逼江湖各路替他扬名", attitude: "阴狠", relationship: 5, lastSeen: "星宿海深处", status: "终章前不亲自下场", tags: ["宗师", "星宿", "终章Boss"], companion: false, hidden: true, discovered: false },
  { id: "mu-wanqing", name: "木婉清", title: "黑衣箭影", portrait: portrait("mu-wanqing"), location: "无量山", goal: "拦着段誉突围，不让追兵靠近半步", attitude: "冷硬", relationship: 60, lastSeen: "无量山山道", status: "未现身", tags: ["追逐"], companion: false, hidden: true, discovered: false },
  { id: "shuang-er", name: "双儿", title: "温柔侍女", portrait: portrait("shuang-er"), location: "大理城", goal: "照看你和客栈，也把护主短打、针线药理和细密心思都藏在安静处", attitude: "温柔", relationship: 58, lastSeen: "客栈后院", status: "在客栈帮忙，手边常备针线药囊", tags: ["客栈", "疗伤", "细心", "护主", "短打"], companion: false, hidden: true, discovered: false, recruitable: false }
];

export const merchantProfiles: MerchantProfile[] = [
  {
    npcId: "innkeeper",
    locationId: "dali",
    stock: [
      { itemId: "medicine", count: 4 },
      { itemId: "qi-pill", count: 2 },
      { itemId: "yangluo-powder", count: 2 },
      { itemId: "smoke-pellet", count: 2 },
      { itemId: "heart-guard-pill", count: 1 },
      { itemId: "antidote-pill", count: 2 },
      { itemId: "dali-heart-manual", count: 1 },
      { itemId: "dried-meat", count: 5 },
      { itemId: "cloth-wrap", count: 3 },
      { itemId: "lamp-oil", count: 2 }
    ],
    buyFromPlayerMultiplier: 0.5,
    sellToPlayerMultiplier: 1.05,
    greetingText: "客栈里常用的伤药和杂货，都在这里。"
  }
];

export const stealProfiles: StealProfile[] = [
  {
    npcId: "innkeeper",
    threatTier: "normal",
    pocketSilver: 32,
    pocketItems: [
      { itemId: "cloth-wrap", count: 1 },
      { itemId: "dried-meat", count: 1 },
      { itemId: "tea-brick", count: 1 },
      { itemId: "ledger-copy", count: 1 }
    ],
    exposure: "watched",
    failureRelationshipPenalty: 16,
    failureLocksTradeUntilNextDay: true
  },
  {
    npcId: "a-zhu",
    threatTier: "elite",
    pocketSilver: 26,
    pocketItems: [
      { itemId: "jade-pin", count: 1 },
      { itemId: "silk-pouch", count: 1 },
      { itemId: "disguise-kit", count: 1 }
    ],
    exposure: "watched",
    failureRelationshipPenalty: 12
  },
  {
    npcId: "wang-yuyan",
    threatTier: "normal",
    pocketSilver: 12,
    pocketItems: [
      { itemId: "jade-pin", count: 1 },
      { itemId: "martial-commentary-page", count: 1 }
    ],
    exposure: "private",
    failureRelationshipPenalty: 10
  },
  {
    npcId: "duan-yu",
    threatTier: "normal",
    pocketSilver: 18,
    pocketItems: [
      { itemId: "wuliang-step-note", count: 1 },
      { itemId: "silk-pouch", count: 1 }
    ],
    exposure: "private",
    failureRelationshipPenalty: 14
  },
  {
    npcId: "mu-wanqing",
    threatTier: "elite",
    pocketSilver: 16,
    pocketItems: [
      { itemId: "sleeve-poison-powder", count: 1 }
    ],
    exposure: "private",
    failureRelationshipPenalty: 16,
    failureCombatEnemyId: "black-assassin"
  },
  {
    npcId: "xu-zhu",
    threatTier: "normal",
    pocketSilver: 10,
    pocketItems: [
      { itemId: "shaolin-sealed-letter", count: 1 }
    ],
    exposure: "private",
    failureRelationshipPenalty: 8
  },
  {
    npcId: "qiao-feng",
    threatTier: "master",
    pocketSilver: 22,
    pocketItems: [
      { itemId: "yanmen-old-token", count: 1 }
    ],
    exposure: "crowded",
    failureRelationshipPenalty: 24
  },
  {
    npcId: "a-zi",
    threatTier: "elite",
    pocketSilver: 18,
    pocketItems: [
      { itemId: "xingxiu-secret-page", count: 1 },
      { itemId: "antidote-pill", count: 1 }
    ],
    exposure: "watched",
    failureRelationshipPenalty: 18,
    failureCombatEnemyId: "xingxiu-guardian"
  }
];

export function buildInitialEconomyState(): EconomyState {
  return {
    merchantStocks: Object.fromEntries(
      merchantProfiles.map((profile) => [
        profile.npcId,
        Object.fromEntries(profile.stock.map((stock) => [stock.itemId, stock.count]))
      ])
    ),
    merchantBlockedUntilDay: {},
    stolenNpcState: {}
  };
}
