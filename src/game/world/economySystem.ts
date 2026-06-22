import { enemyPresets, itemCatalog, merchantProfiles, stealProfiles } from "../../data";
import { startCombat } from "../combat";
import { abilityModifierFromList } from "../rules";
import type {
  ExposureTier,
  GamePatch,
  GameState,
  Item,
  MerchantProfile,
  PendingEconomyAction,
  ProposedWorldAction,
  RollMode,
  StealProfile,
  ThreatTier
} from "../../types";
import type { WorldResolution, WorldTextId } from "./resolveWorldAction";

const ECONOMY_TEXT_IDS = new Set<WorldTextId>([
  "economy_no_merchant",
  "economy_merchant_blocked",
  "economy_shop_list",
  "economy_buy_success",
  "economy_buy_fail",
  "economy_sell_success",
  "economy_sell_fail",
  "economy_steal_prompt",
  "economy_steal_success",
  "economy_steal_fail"
]);

const THREAT_MOD: Record<ThreatTier, number> = {
  weak: 1,
  normal: 3,
  elite: 5,
  master: 8
};

const EXPOSURE_MOD: Record<ExposureTier, number> = {
  private: 0,
  watched: 2,
  crowded: 3
};

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function charismaModifier(state: GameState) {
  return abilityModifierFromList(state.character.abilities, "cha");
}

function tradeModifiers(state: GameState) {
  const chaMod = charismaModifier(state);
  const clampedBuyMod = clamp(chaMod, -5, 5);
  const clampedSellMod = clamp(chaMod, -5, 5);
  return {
    buyFactor: 1 - (clampedBuyMod * 0.03),
    sellFactor: 1 + (clampedSellMod * 0.02),
    relationshipDelta: clamp(chaMod, -2, 2)
  };
}

function merchantRelationshipChange(state: GameState, npcId: string) {
  const delta = tradeModifiers(state).relationshipDelta;
  return delta === 0 ? undefined : [{ npcId, delta }];
}

function currentLocationId(state: GameState) {
  return state.locations.find((location) => location.current)?.id;
}

function currentLocationName(state: GameState) {
  return state.locations.find((location) => location.current)?.name || "当前地点";
}

function isVisibleNpc(state: GameState, npcId: string) {
  const npc = state.npcs.find((entry) => entry.id === npcId);
  return Boolean(npc && (!npc.hidden || npc.discovered || npc.companion));
}

function findItemByIdOrName(id?: string, name?: string) {
  return itemCatalog.find((entry) => entry.id === id || entry.name === name);
}

function cloneItem(item: Item, count = item.count) {
  return {
    ...item,
    count
  };
}

function visibleNpcAtLocation(state: GameState, npcId: string) {
  const npc = state.npcs.find((entry) => entry.id === npcId);
  if (!npc) return undefined;
  if (npc.location !== currentLocationName(state) && currentLocationId(state) !== merchantProfiles.find((profile) => profile.npcId === npcId)?.locationId) {
    return undefined;
  }
  if (!isVisibleNpc(state, npcId)) return undefined;
  return npc;
}

function findMerchant(state: GameState, npcId?: string) {
  const locationId = currentLocationId(state);
  if (!locationId) return undefined;
  const profiles = merchantProfiles.filter((profile) => profile.locationId === locationId);
  if (npcId) {
    const profile = profiles.find((entry) => entry.npcId === npcId);
    if (!profile || !visibleNpcAtLocation(state, profile.npcId)) return undefined;
    return profile;
  }
  return profiles.find((entry) => visibleNpcAtLocation(state, entry.npcId));
}

function findStealProfile(state: GameState, npcId?: string) {
  if (npcId) return stealProfiles.find((entry) => entry.npcId === npcId);
  const visibleHere = stealProfiles.find((entry) => visibleNpcAtLocation(state, entry.npcId));
  return visibleHere;
}

function merchantStock(state: GameState, profile: MerchantProfile, itemId: string) {
  return state.economy.merchantStocks[profile.npcId]?.[itemId] ?? profile.stock.find((entry) => entry.itemId === itemId)?.count ?? 0;
}

function visibleNpcFromAction(state: GameState, action: string, proposed?: ProposedWorldAction) {
  if (proposed?.npcId) {
    return visibleNpcAtLocation(state, proposed.npcId)
      || state.npcs.find((entry) => entry.id === proposed.npcId && isVisibleNpc(state, entry.id));
  }
  return state.npcs.find((entry) =>
    isVisibleNpc(state, entry.id)
    && (entry.location === currentLocationName(state) || currentLocationId(state) === merchantProfiles.find((profile) => profile.npcId === entry.id)?.locationId)
    && action.includes(entry.name)
  );
}

function normalizeQuantity(quantity?: number) {
  return typeof quantity === "number" && Number.isFinite(quantity) && quantity > 0 ? Math.floor(quantity) : 1;
}

function parseQuantity(action: string) {
  const match = action.match(/(\d+)/);
  return match ? normalizeQuantity(Number(match[1])) : 1;
}

function parseActionKind(action: string, proposed?: ProposedWorldAction) {
  if (proposed?.kind) return proposed.kind;
  if (/(查看货物|看看货摊|货单|货架|买什么|看货)/.test(action)) return "shop_list";
  if (/^(购买|买下?|购入)/.test(action)) return "buy";
  if (/^(出售|卖出?|脱手)/.test(action)) return "sell";
  if (/^(偷窃|偷|顺手拿|摸走)/.test(action)) return "steal";
  return undefined;
}

function parseItemQuery(action: string, proposed?: ProposedWorldAction) {
  if (proposed?.itemId || proposed?.itemName) {
    return findItemByIdOrName(proposed.itemId, proposed.itemName);
  }
  return itemCatalog.find((entry) => action.includes(entry.name));
}

function computeValueMod(value: number) {
  if (value >= 40) return 6;
  if (value >= 24) return 4;
  if (value >= 10) return 2;
  return 0;
}

function inferThreatTier(npcId: string, profile?: StealProfile): ThreatTier {
  const enemy = enemyPresets.find((entry) => entry.id === npcId || entry.name === npcId);
  if (enemy) {
    if (enemy.ac >= 16 || enemy.maxHp >= 60) return "master";
    if (enemy.ac >= 14 || enemy.maxHp >= 40) return "elite";
    if (enemy.ac >= 12 || enemy.maxHp >= 24) return "normal";
    return "weak";
  }
  return profile?.threatTier || "normal";
}

function defaultExposure(state: GameState, merchant = false): ExposureTier {
  if (merchant || state.sceneType === "market") return "crowded";
  if (state.sceneType === "inn" || state.sceneType === "tavern") return "watched";
  return "private";
}

function normalizeStealRollMode(
  state: GameState,
  npcId: string,
  exposure: ExposureTier,
  merchant: boolean,
  suggested?: RollMode
): RollMode {
  const npc = state.npcs.find((entry) => entry.id === npcId);
  const relationship = npc?.relationship || 0;
  const localAdvantage = exposure === "private" && relationship >= 60 && !merchant;
  const localDisadvantage = merchant || exposure === "crowded" || relationship <= 30;

  if (localDisadvantage) return "disadvantage";
  if (localAdvantage && suggested === "advantage") return "advantage";
  if (localAdvantage) return "advantage";
  return "normal";
}

function makeEconomyResolution(textId: WorldTextId, patch: GamePatch, textOverride: string): WorldResolution {
  return {
    textId,
    patch,
    textOverride,
    meta: {
      locationName: ""
    }
  };
}

function listMerchantGoods(state: GameState, profile: MerchantProfile) {
  const npc = state.npcs.find((entry) => entry.id === profile.npcId);
  const lines = profile.stock
    .map((entry) => {
      const item = findItemByIdOrName(entry.itemId);
      const stock = merchantStock(state, profile, entry.itemId);
      if (!item || stock <= 0) return undefined;
      const price = Math.max(1, Math.round(item.value * profile.sellToPlayerMultiplier * tradeModifiers(state).buyFactor));
      return `${item.name} ×${stock} · ${price} 银`;
    })
    .filter((line): line is string => Boolean(line));
  if (lines.length === 0) {
    return makeEconomyResolution("economy_shop_list", {}, `${npc?.name || "掌柜"}把手一摊，说眼下货架已经空了。`);
  }
  return makeEconomyResolution(
    "economy_shop_list",
    {},
    `${npc?.name || "掌柜"}把货色一一报给你听：\n${lines.join("\n")}`
  );
}

function buyItem(state: GameState, profile: MerchantProfile, item: Item | undefined, quantity: number) {
  const npc = state.npcs.find((entry) => entry.id === profile.npcId);
  if (!item) {
    return makeEconomyResolution("economy_buy_fail", {}, `${npc?.name || "掌柜"}皱了皱眉，说你点的货并不在架上。`);
  }
  const stock = merchantStock(state, profile, item.id);
  if (stock < quantity) {
    return makeEconomyResolution("economy_buy_fail", {}, `${npc?.name || "掌柜"}摇头道：“${item.name}眼下只剩 ${stock} 份。”`);
  }
  const price = Math.max(1, Math.round(item.value * profile.sellToPlayerMultiplier * tradeModifiers(state).buyFactor));
  const totalPrice = price * quantity;
  if (state.character.silver < totalPrice) {
    return makeEconomyResolution("economy_buy_fail", {}, `你身上的银两不够，${item.name}要 ${totalPrice} 银。`);
  }
  return makeEconomyResolution(
    "economy_buy_success",
    {
      silverChange: -totalPrice,
      itemChanges: [{ itemId: item.id, delta: quantity, item: cloneItem(item, quantity) }],
      relationshipChanges: merchantRelationshipChange(state, profile.npcId),
      economyUpdate: {
        merchantStocks: {
          [profile.npcId]: {
            ...(state.economy.merchantStocks[profile.npcId] || {}),
            [item.id]: Math.max(0, stock - quantity)
          }
        }
      },
      systemNote: `购买 ${item.name} ×${quantity}，花费 ${totalPrice} 银。`
    },
    `你买下了 ${item.name} ×${quantity}，付出 ${totalPrice} 银。`
  );
}

function sellItem(state: GameState, profile: MerchantProfile, item: Item | undefined, quantity: number) {
  const npc = state.npcs.find((entry) => entry.id === profile.npcId);
  if (!item) {
    return makeEconomyResolution("economy_sell_fail", {}, `${npc?.name || "掌柜"}听了半句，没接上你要卖什么。`);
  }
  const owned = state.character.inventory.find((entry) => entry.id === item.id || entry.name === item.name);
  if (!owned || owned.count < quantity) {
    return makeEconomyResolution("economy_sell_fail", {}, `你手里并没有足够的 ${item.name}。`);
  }
  if (owned.type === "quest" || owned.canSell === false) {
    return makeEconomyResolution("economy_sell_fail", {}, `${item.name}不是眼下能拿来脱手的东西。`);
  }
  const totalPrice = Math.max(1, Math.round(item.value * profile.buyFromPlayerMultiplier * tradeModifiers(state).sellFactor)) * quantity;
  return makeEconomyResolution(
    "economy_sell_success",
    {
      silverChange: totalPrice,
      itemChanges: [{ itemId: owned.id, delta: -quantity }],
      relationshipChanges: merchantRelationshipChange(state, profile.npcId),
      systemNote: `出售 ${item.name} ×${quantity}，得银 ${totalPrice}。`
    },
    `你把 ${item.name} ×${quantity} 脱了手，换得 ${totalPrice} 银。`
  );
}

function remainingPocketSilver(state: GameState, profile: StealProfile) {
  return Math.max(0, profile.pocketSilver - (state.economy.stolenNpcState[profile.npcId]?.silverTaken || 0));
}

function remainingPocketItemCount(state: GameState, profile: StealProfile, itemId: string) {
  const base = profile.pocketItems.find((entry) => entry.itemId === itemId)?.count || 0;
  const taken = state.economy.stolenNpcState[profile.npcId]?.itemCounts?.[itemId] || 0;
  return Math.max(0, base - taken);
}

function buildStealPendingAction(
  state: GameState,
  npcId: string,
  npcName: string,
  rewardSilver: number,
  rewardItem: Item | undefined,
  quantity: number,
  fromMerchant: boolean,
  profile?: StealProfile,
  suggested?: ProposedWorldAction
): PendingEconomyAction {
  const exposure = profile?.exposure || defaultExposure(state, fromMerchant);
  const threatTier = inferThreatTier(profile?.enemyPresetId || npcId, profile);
  const valueScore = rewardItem ? rewardItem.value : rewardSilver;
  const dc = 8 + THREAT_MOD[threatTier] + computeValueMod(valueScore) + EXPOSURE_MOD[exposure];
  const rollMode = normalizeStealRollMode(state, npcId, exposure, fromMerchant, suggested?.rollMode);
  const itemName = rewardItem?.name;
  const reason = suggested?.reason || `此刻下手既要避过${npcName}的眼，也要避过旁人的耳。`;
  return {
    kind: "steal",
    npcId,
    npcName,
    targetType: rewardItem ? "item" : "silver",
    itemId: rewardItem?.id,
    itemName,
    quantity,
    rewardSilver,
    rewardItem,
    threatTier,
    exposure,
    dc,
    rollMode,
    reason,
    failureRelationshipPenalty: profile?.failureRelationshipPenalty || 10,
    failureLocksTradeUntilNextDay: profile?.failureLocksTradeUntilNextDay,
    failureCombatEnemyId: profile?.failureCombatEnemyId,
    fromMerchant
  };
}

function buildStealPrompt(action: PendingEconomyAction) {
  const modeText = action.rollMode === "advantage"
    ? "优势，掷 2d20 取高"
    : action.rollMode === "disadvantage"
      ? "劣势，掷 2d20 取低"
      : "常规，掷 1d20";
  const targetText = action.targetType === "silver"
    ? `${action.rewardSilver} 银`
    : `${action.itemName} ×${action.quantity}`;
  return `你正盯着 ${action.npcName} 身上的 ${targetText}。这一下按身法判定，DC ${action.dc}；${modeText}。请掷骰。`;
}

function promptSteal(state: GameState, targetNpcId: string, targetItem: Item | undefined, targetSilver: number, quantity: number, fromMerchant: boolean, suggested?: ProposedWorldAction) {
  const npc = state.npcs.find((entry) => entry.id === targetNpcId);
  const profile = findStealProfile(state, targetNpcId);
  const pendingAction = buildStealPendingAction(
    state,
    targetNpcId,
    npc?.name || "此人",
    targetItem ? 0 : targetSilver,
    targetItem ? cloneItem(targetItem, quantity) : undefined,
    quantity,
    fromMerchant,
    profile,
    suggested
  );

  return makeEconomyResolution(
    "economy_steal_prompt",
    {
      pendingCheck: {
        label: `偷窃 ${pendingAction.npcName}`,
        abilityKey: "dex",
        rollMode: pendingAction.rollMode,
        dc: pendingAction.dc,
        reason: pendingAction.reason,
        suggestedAction: buildStealPrompt(pendingAction)
      },
      economyUpdate: {
        pendingAction
      }
    },
    buildStealPrompt(pendingAction)
  );
}

function attemptSteal(state: GameState, action: string, proposed?: ProposedWorldAction) {
  const npc = visibleNpcFromAction(state, action, proposed);
  const merchant = findMerchant(state, npc?.id || proposed?.npcId);
  const stealProfile = findStealProfile(state, npc?.id || proposed?.npcId);
  const targetNpc = npc || (merchant ? state.npcs.find((entry) => entry.id === merchant.npcId) : undefined) || (stealProfile ? state.npcs.find((entry) => entry.id === stealProfile.npcId) : undefined);

  if (!targetNpc) {
    return makeEconomyResolution("economy_buy_fail", {}, "眼前没有合适的下手对象。");
  }

  const item = parseItemQuery(action, proposed);
  const quantity = normalizeQuantity(proposed?.quantity) || parseQuantity(action);

  if (item && merchant && merchant.npcId === targetNpc.id) {
    const stock = merchantStock(state, merchant, item.id);
    if (stock < quantity) {
      return makeEconomyResolution("economy_buy_fail", {}, `${targetNpc.name}手边已经没有那么多 ${item.name} 可供你顺走。`);
    }
    return promptSteal(state, targetNpc.id, item, 0, quantity, true, proposed);
  }

  if (item && stealProfile) {
    const remaining = remainingPocketItemCount(state, stealProfile, item.id);
    if (remaining < quantity) {
      return makeEconomyResolution("economy_buy_fail", {}, `${targetNpc.name}身上并没有你要摸走的那样东西。`);
    }
    return promptSteal(state, targetNpc.id, item, 0, quantity, false, proposed);
  }

  const wantsSilver = /银|钱|荷包/.test(action) || (!item && (!proposed?.itemId && !proposed?.itemName));
  if (wantsSilver && stealProfile) {
    const remainingSilver = remainingPocketSilver(state, stealProfile);
    if (remainingSilver <= 0) {
      return makeEconomyResolution("economy_buy_fail", {}, `${targetNpc.name}身上的零碎银钱，似乎早已空了。`);
    }
    const rewardSilver = Math.min(remainingSilver, quantity <= 1 ? remainingSilver : quantity);
    return promptSteal(state, targetNpc.id, undefined, rewardSilver, 1, false, proposed);
  }

  return makeEconomyResolution("economy_buy_fail", {}, "你这一手想顺走什么，还不够明确。");
}

export function isEconomyTextId(textId: string): textId is WorldTextId {
  return ECONOMY_TEXT_IDS.has(textId as WorldTextId);
}

export function tryResolveEconomyAction(
  action: string,
  state: GameState,
  _globalUpdate: boolean,
  proposedWorldAction?: ProposedWorldAction
): WorldResolution | undefined {
  if (state.combat.active) return undefined;

  const kind = parseActionKind(action, proposedWorldAction);
  if (!kind) return undefined;

  const merchant = findMerchant(state, proposedWorldAction?.npcId || visibleNpcFromAction(state, action, proposedWorldAction)?.id);

  if ((kind === "shop_list" || kind === "buy" || kind === "sell") && !merchant) {
    return makeEconomyResolution("economy_no_merchant", {}, "眼下附近并没有愿意与你做买卖的商人。");
  }

  if (merchant) {
    const blockedUntil = state.economy.merchantBlockedUntilDay[merchant.npcId] || 0;
    if (blockedUntil >= state.worldDay && kind !== "steal") {
      const npc = state.npcs.find((entry) => entry.id === merchant.npcId);
      return makeEconomyResolution("economy_merchant_blocked", {}, `${npc?.name || "掌柜"}神色冷了下来，今日不肯再与你交易。`);
    }
  }

  switch (kind) {
    case "shop_list":
      return merchant ? listMerchantGoods(state, merchant) : undefined;
    case "buy":
      return merchant ? buyItem(state, merchant, parseItemQuery(action, proposedWorldAction), normalizeQuantity(proposedWorldAction?.quantity) || parseQuantity(action)) : undefined;
    case "sell":
      return merchant ? sellItem(state, merchant, parseItemQuery(action, proposedWorldAction), normalizeQuantity(proposedWorldAction?.quantity) || parseQuantity(action)) : undefined;
    case "steal":
      return attemptSteal(state, action, proposedWorldAction);
    default:
      return undefined;
  }
}

export function resolveEconomyCheckResult(
  state: GameState,
  _globalUpdate: boolean,
  success: boolean
): WorldResolution | undefined {
  const pending = state.economy.pendingAction;
  if (!pending) return undefined;

  if (success) {
    if (pending.targetType === "silver") {
      return makeEconomyResolution(
        "economy_steal_success",
        {
          silverChange: pending.rewardSilver,
          pendingCheck: undefined,
          economyUpdate: {
            pendingAction: null,
            stolenNpcState: {
              [pending.npcId]: {
                silverTaken: (state.economy.stolenNpcState[pending.npcId]?.silverTaken || 0) + pending.rewardSilver,
                itemCounts: { ...(state.economy.stolenNpcState[pending.npcId]?.itemCounts || {}) }
              }
            }
          },
          systemNote: `偷得 ${pending.rewardSilver} 银。`
        },
        `你指尖一滑，${pending.rewardSilver} 银便已悄无声息地转到了自己手里。`
      );
    }

    const item = pending.rewardItem;
    if (!item) return undefined;
    const merchantStocks = pending.fromMerchant
      ? {
          [pending.npcId]: {
            ...(state.economy.merchantStocks[pending.npcId] || {}),
            [item.id]: Math.max(0, (state.economy.merchantStocks[pending.npcId]?.[item.id] || 0) - pending.quantity)
          }
        }
      : undefined;
    const stolenNpcState = pending.fromMerchant
      ? undefined
      : {
          [pending.npcId]: {
            silverTaken: state.economy.stolenNpcState[pending.npcId]?.silverTaken || 0,
            itemCounts: {
              ...(state.economy.stolenNpcState[pending.npcId]?.itemCounts || {}),
              [item.id]: (state.economy.stolenNpcState[pending.npcId]?.itemCounts?.[item.id] || 0) + pending.quantity
            }
          }
        };
    return makeEconomyResolution(
      "economy_steal_success",
      {
        itemChanges: [{ itemId: item.id, delta: pending.quantity, item: cloneItem(item, pending.quantity) }],
        pendingCheck: undefined,
        economyUpdate: {
          pendingAction: null,
          ...(merchantStocks ? { merchantStocks } : {}),
          ...(stolenNpcState ? { stolenNpcState } : {})
        },
        systemNote: `偷得 ${item.name} ×${pending.quantity}。`
      },
      `你手腕一翻，${item.name} ×${pending.quantity} 已被你悄悄收入怀中。`
    );
  }

  const relationshipChanges = [{ npcId: pending.npcId, delta: -pending.failureRelationshipPenalty }];
  const extraPatch = pending.failureCombatEnemyId ? startCombat(state, pending.failureCombatEnemyId) : undefined;
  return makeEconomyResolution(
    "economy_steal_fail",
    {
      ...extraPatch,
      relationshipChanges,
      pendingCheck: undefined,
      economyUpdate: {
        pendingAction: null,
        ...(pending.failureLocksTradeUntilNextDay
          ? { merchantBlockedUntilDay: { [pending.npcId]: state.worldDay + 1 } }
          : {})
      },
      systemNote: pending.failureCombatEnemyId
        ? `${pending.npcName}当场发觉了你的手脚，局面已经翻成正面对撞。`
        : `${pending.npcName}已对你起了疑心。`
    },
    pending.failureCombatEnemyId
      ? `${pending.npcName}目光陡然一厉，手上已不再留情，这一下子当场翻了脸。`
      : `你这一手没能藏住，${pending.npcName}神色已然变了，对你的提防一下子深了许多。`
  );
}
