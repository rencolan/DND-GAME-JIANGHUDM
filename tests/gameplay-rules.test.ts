import { test } from "node:test";
import assert from "node:assert/strict";
import { initialGameState, martialArtCatalog } from "../src/data";
import { availableEnemyArts, adjustedArtWeight, effectiveEnemyAc, resolveCombatDamage, resolveEnemyPhase, startCombat } from "../src/game/combat";
import { applyPatchToState, normalizeGameState } from "../src/game/engine";
import { buildSuggestedCheck, normalizeWorldCheckAbility, parseCombatDamageResult } from "../src/game/world/helpers";
import { resolveWorldAction } from "../src/game/world/resolveWorldAction";
import { buildLocationOpportunities } from "../src/game/world/opportunities";
import { makeAbilityChoices } from "../src/ui/sessionShared";
import type { GameState } from "../src/types";

function cloneState(overrides: Partial<GameState> = {}) {
  return normalizeGameState({
    ...structuredClone(initialGameState),
    ...overrides
  });
}

function atLocation(state: GameState, locationId: string) {
  return normalizeGameState({
    ...state,
    locations: state.locations.map((location) => ({
      ...location,
      current: location.id === locationId
    }))
  });
}

test("location opportunities expose active mainline work", () => {
  const state = cloneState({
    quests: [{
      id: "quest-wanderer-1",
      title: "客栈歇脚",
      text: "先在客栈站稳脚跟。",
      status: "active"
    }],
    questStateMap: {
      "quest-wanderer-1": { id: "quest-wanderer-1", status: "active" }
    }
  });

  const opportunities = buildLocationOpportunities(state);

  assert.ok(opportunities.some((entry) => entry.id === "dali-settle-inn"));
});

test("opportunities show gated rewards with disabled reasons", () => {
  const state = atLocation(cloneState(), "wuliang");
  const opportunities = buildLocationOpportunities(state);
  const lingbo = opportunities.find((entry) => entry.id === "wuliang-lingbo");

  assert.ok(lingbo);
  assert.equal(lingbo?.disabledReason, "需要先掌握 追风剑路");
});

test("map travel parser accepts bracketed location names", () => {
  const result = resolveWorldAction("前往【无量山】", cloneState(), false);

  assert.equal(result.textId, "travel_depart");
  assert.equal(result.patch.location, "无量山");
});

test("origin ability rolls use one 4d6-drop-lowest package", () => {
  const choices = makeAbilityChoices();

  assert.equal(choices.length, 1);
  assert.equal(choices[0].length, 6);
  assert.ok(choices[0].every((value) => value >= 3 && value <= 18));
});

test("world perception checks use wisdom for tracks and subtle traces", () => {
  const check = buildSuggestedCheck("查看足迹，分辨那人往哪里去了");

  assert.equal(check?.abilityKey, "wis");
  assert.equal(check?.kind, "world");
});

test("world actions create a pending wisdom check for inspecting tracks", () => {
  const result = resolveWorldAction("查看足迹，分辨那人往哪里去了", cloneState(), false);

  assert.equal(result.textId, "suggested_check");
  assert.equal(result.patch.pendingCheck?.abilityKey, "wis");
  assert.ok((result.patch.pendingCheck?.dc || 0) >= 10);
  assert.ok((result.patch.pendingCheck?.dc || 0) <= 14);
});

test("generic look action creates a pending wisdom check", () => {
  const result = resolveWorldAction("查看", cloneState(), false);

  assert.equal(result.textId, "suggested_check");
  assert.equal(result.patch.pendingCheck?.abilityKey, "wis");
});

test("world check dc responds to clue quality and method", () => {
  const clear = resolveWorldAction("我蹲下细看新鲜足迹，拨开草叶沿着泥印查看", cloneState(), false);
  const faint = resolveWorldAction("我匆匆查看被雨水冲散的半枚鞋印", cloneState(), false);

  assert.equal(clear.patch.pendingCheck?.abilityKey, "wis");
  assert.equal(clear.patch.pendingCheck?.rollMode, "advantage");
  assert.ok((faint.patch.pendingCheck?.dc || 0) > (clear.patch.pendingCheck?.dc || 0));
});

test("world intellect checks stay on intelligence for ledgers and mechanisms", () => {
  assert.equal(buildSuggestedCheck("查看账本上的暗号")?.abilityKey, "int");
  assert.equal(buildSuggestedCheck("查验机关和地图")?.abilityKey, "int");
});

test("ai proposed world checks are normalized by local action intent", () => {
  const normalized = normalizeWorldCheckAbility("查看泥地里的鞋印", {
    label: "查看鞋印",
    abilityKey: "int",
    dc: 20,
    reason: "AI suggested the wrong attribute."
  });

  assert.equal(normalized?.abilityKey, "wis");
  assert.notEqual(normalized?.dc, 20);
});

test("exposed and guarded change effective enemy AC", () => {
  const base = applyPatchToState(cloneState(), startCombat(cloneState(), "black-assassin", { skipInitiative: true }));
  const exposed = normalizeGameState({
    ...base,
    combat: { ...base.combat, enemyStatus: ["exposed"] }
  });
  const guarded = normalizeGameState({
    ...base,
    combat: { ...base.combat, enemyStatus: ["guarded"] }
  });

  assert.equal(effectiveEnemyAc(exposed), (base.combat.enemyAc || 0) - 2);
  assert.equal(effectiveEnemyAc(guarded), (base.combat.enemyAc || 0) + 1);
});

test("enemy internal arts are unavailable when qi is insufficient", () => {
  const combatState = applyPatchToState(cloneState(), startCombat(cloneState(), "jiu-mozhi", { skipInitiative: true }));
  const exhausted = normalizeGameState({
    ...combatState,
    combat: { ...combatState.combat, enemyQi: 0 }
  });

  assert.ok(availableEnemyArts(exhausted).every((art) => art.category === "external"));
});

test("controlled enemies are discouraged from finisher moves", () => {
  const combatState = applyPatchToState(cloneState(), startCombat(cloneState(), "jiu-mozhi", { skipInitiative: true }));
  const fireBlade = martialArtCatalog.find((art) => art.id === "jiu-huoyandao");
  assert.ok(fireBlade);

  const normal = adjustedArtWeight(combatState, fireBlade!);
  const controlled = adjustedArtWeight({
    ...combatState,
    combat: { ...combatState.combat, enemyStatus: ["controlled"] }
  }, fireBlade!);

  assert.ok(controlled < normal);
});

test("martial effects apply bonus damage against statuses", () => {
  const canhe = martialArtCatalog.find((art) => art.id === "canhe-zhi");
  assert.ok(canhe);
  const combatState = applyPatchToState(cloneState(), startCombat(cloneState(), "black-assassin", { skipInitiative: true }));
  const ready = normalizeGameState({
    ...combatState,
    character: {
      ...combatState.character,
      martialArts: [canhe!]
    },
    pendingDamage: {
      id: "damage-test",
      martialArtId: "canhe-zhi",
      label: "参合指",
      damageDice: "1d8",
      damageBonus: 0,
      qiCost: 1,
      qiBonusSpend: 0,
      hitText: "test"
    },
    combat: {
      ...combatState.combat,
      enemyStatus: ["sealed"]
    }
  });

  const patch = resolveCombatDamage(ready, { label: "参合指", total: 5 });

  assert.equal(patch.combatUpdate?.enemyHpChange, -8);
});

test("combat damage parsing ignores the prior hit roll d20 line", () => {
  const combinedText = [
    "【判定】罗汉拳",
    "模式：常规",
    "d20=16",
    "加值：+2",
    "总计：18 / DC 12",
    "结果：成功",
    "阶段：攻击",
    "【伤害】罗汉拳 1d6 => [3] + 2 = 5"
  ].join("\n");

  const damage = parseCombatDamageResult(combinedText);

  assert.equal(damage.label, "罗汉拳");
  assert.equal(damage.total, 5);
});

test("combat damage parsing returns NaN without an explicit damage line", () => {
  const hitOnlyText = [
    "【判定】罗汉拳",
    "模式：常规",
    "d20=16",
    "加值：+2",
    "总计：18 / DC 12",
    "结果：成功",
    "阶段：攻击"
  ].join("\n");

  const damage = parseCombatDamageResult(hitOnlyText);

  assert.equal(Number.isNaN(damage.total), true);
});

test("sample bosses expose phase profiles", () => {
  const combatState = applyPatchToState(cloneState(), startCombat(cloneState(), "yue-laosan", { skipInitiative: true }));
  const bloodied = normalizeGameState({
    ...combatState,
    combat: {
      ...combatState.combat,
      enemyHp: 10
    }
  });

  assert.equal(resolveEnemyPhase(bloodied).label, "鳄剪夺命");
});

test("npc support can be requested from world actions", () => {
  const combatState = applyPatchToState(cloneState(), startCombat(cloneState(), "black-assassin", { skipInitiative: true }));
  const withWangYuyan = normalizeGameState({
    ...combatState,
    npcs: combatState.npcs.map((npc) => npc.id === "wang-yuyan"
      ? { ...npc, hidden: false, discovered: true, companion: true }
      : npc)
  });
  const result = resolveWorldAction("请求支援：请王语嫣帮我看破招式", withWangYuyan, false);

  assert.equal(result.textId, "default_scene");
  assert.deepEqual(result.patch.combatUpdate?.enemyStatusAdd, ["exposed"]);
  assert.equal(result.patch.pendingCheck, undefined);
});

test("non-companion npcs cannot provide combat support", () => {
  const combatState = applyPatchToState(cloneState(), startCombat(cloneState(), "black-assassin", { skipInitiative: true }));
  const visibleWangYuyan = normalizeGameState({
    ...combatState,
    npcs: combatState.npcs.map((npc) => npc.id === "wang-yuyan"
      ? { ...npc, hidden: false, discovered: true, companion: false }
      : npc)
  });
  const result = resolveWorldAction("请求支援：请王语嫣帮我看破招式", visibleWangYuyan, false);

  assert.equal(result.patch.combatUpdate?.enemyStatusAdd, undefined);
});

test("shuang-er support protects the player in combat", () => {
  const combatState = applyPatchToState(cloneState(), startCombat(cloneState(), "black-assassin", { skipInitiative: true }));
  const withShuangEr = normalizeGameState({
    ...combatState,
    npcs: combatState.npcs.map((npc) => npc.id === "shuang-er"
      ? { ...npc, hidden: false, discovered: true, companion: true }
      : npc),
    relationshipRoutes: {
      ...combatState.relationshipRoutes,
      "shuang-er": {
        npcId: "shuang-er",
        kind: "retainer",
        active: true,
        stage: "follow",
        allowCompanion: true,
        supportUnlocked: ["care", "guard", "practice"]
      }
    }
  });

  const result = resolveWorldAction("请求支援：请双儿帮我护住身侧", withShuangEr, false);

  assert.deepEqual(result.patch.combatUpdate?.playerStatusAdd, ["guarded"]);
  assert.deepEqual(result.patch.combatUpdate?.enemyStatusAdd, ["controlled"]);
  assert.equal(result.patch.qiRecovery, 1);
  assert.ok(result.patch.storyFlagsAdd?.includes(`support:shuang-er:combat:${withShuangEr.combat.combatId}`));
});

test("companion combat support is limited to once per fight", () => {
  const combatState = applyPatchToState(cloneState(), startCombat(cloneState(), "black-assassin", { skipInitiative: true }));
  const withUsedSupport = normalizeGameState({
    ...combatState,
    storyFlags: [`support:shuang-er:combat:${combatState.combat.combatId}`],
    npcs: combatState.npcs.map((npc) => npc.id === "shuang-er"
      ? { ...npc, hidden: false, discovered: true, companion: true }
      : npc),
    relationshipRoutes: {
      ...combatState.relationshipRoutes,
      "shuang-er": {
        npcId: "shuang-er",
        kind: "retainer",
        active: true,
        stage: "follow",
        allowCompanion: true,
        supportUnlocked: ["care", "guard", "practice"]
      }
    }
  });

  const result = resolveWorldAction("请求支援：请双儿帮我护住身侧", withUsedSupport, false);

  assert.equal(result.patch.combatUpdate?.playerStatusAdd, undefined);
  assert.ok(/这场战斗已经帮过/.test(result.textOverride || ""));
});

test("boss fights reduce companion finisher suppression", () => {
  const combatState = applyPatchToState(cloneState(), startCombat(cloneState(), "jiu-mozhi", { skipInitiative: true }));
  const withShuangEr = normalizeGameState({
    ...combatState,
    npcs: combatState.npcs.map((npc) => npc.id === "shuang-er"
      ? { ...npc, hidden: false, discovered: true, companion: true }
      : npc),
    relationshipRoutes: {
      ...combatState.relationshipRoutes,
      "shuang-er": {
        npcId: "shuang-er",
        kind: "retainer",
        active: true,
        stage: "follow",
        allowCompanion: true,
        supportUnlocked: ["care", "guard", "practice"]
      }
    }
  });

  const result = resolveWorldAction("请求支援：请双儿帮我护住身侧", withShuangEr, false);

  assert.equal(result.patch.combatUpdate?.enemySuppressedFinisherUntilRound, undefined);
  assert.ok(/没有被完全截断攻势/.test(result.textOverride || ""));
});

test("shuang-er daily practice creates companion interaction rewards", () => {
  const state = cloneState({
    storyFlags: ["story:onFirstAction:quest-wanderer-1", "route:shuang-er:trust"],
    npcs: initialGameState.npcs.map((npc) => npc.id === "shuang-er"
      ? { ...npc, hidden: false, discovered: true }
      : npc),
    relationshipRoutes: {
      ...initialGameState.relationshipRoutes,
      "shuang-er": {
        npcId: "shuang-er",
        kind: "retainer",
        active: true,
        stage: "trust",
        allowCompanion: true,
        supportUnlocked: ["care", "practice"]
      }
    }
  });

  const result = resolveWorldAction("我和双儿练武切磋护身短打", state, false);

  assert.deepEqual(result.patch.attributeInsightAdd?.[0]?.choices, ["dex", "wis"]);
  assert.ok(result.patch.storyFlagsAdd?.includes("interaction:shuang-er:practice:1"));
});

test("expanded steal targets create tempting item checks", () => {
  const result = resolveWorldAction("偷", cloneState(), false, {
    kind: "steal",
    npcId: "a-zhu",
    itemId: "disguise-kit"
  });

  assert.equal(result.textId, "economy_steal_prompt");
  assert.equal(result.patch.economyUpdate?.pendingAction?.itemId, "disguise-kit");
  assert.equal(result.patch.economyUpdate?.pendingAction?.targetType, "item");
  assert.ok((result.patch.pendingCheck?.dc || 0) >= 19);
});
