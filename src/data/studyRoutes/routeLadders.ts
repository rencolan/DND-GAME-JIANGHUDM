import type { StudyRouteKey, StudyTier } from "../../types";

export const routeLadders: Record<StudyRouteKey, Array<{ tier: StudyTier; label: string }>> = {
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
    { tier: "high_chance", label: "完整火焰刀 / 深化化功手段" }
  ],
  wis: [
    { tier: "starter", label: "吐纳法 / 大理心法" },
    { tier: "advanced", label: "调息法门 / 基础运气图" },
    { tier: "mid", label: "北冥残页 / 六阳掌前置" },
    { tier: "upper_prelude", label: "小无相骨架 / 生死符控劲法" },
    { tier: "high_chance", label: "完整北冥 / 完整小无相 / 生死符深层法门" }
  ]
};

export const ladderLabels = new Map<string, string>();
Object.entries(routeLadders).forEach(([routeKey, entries]) => {
  entries.forEach((entry) => {
    ladderLabels.set(`${routeKey}:${entry.tier}`, entry.label);
  });
});
