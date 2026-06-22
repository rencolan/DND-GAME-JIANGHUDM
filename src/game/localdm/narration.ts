import type { WorldResolution } from "../world";

function withEnemyFollowup(base: string, result: WorldResolution) {
  return result.meta?.enemyTurnSummary ? `${base}\n${result.meta.enemyTurnSummary}` : base;
}

export function buildLocalDmNarration(result: WorldResolution) {
  if (result.textOverride) return result.textOverride;

  const enemyName = result.meta?.enemyName || "对手";
  const targetName = result.meta?.targetName || "前路";
  const locationName = result.meta?.locationName || "当前地点";

  switch (result.textId) {
    case "story_check_inn_success":
      return "你一出手，客栈前堂的乱局总算被压住，局面开始朝你能掌控的方向收束。";
    case "story_check_inn_fail":
      return "你虽接住了场面，但还没能彻底压住乱局，客栈里的人心仍在晃。";
    case "story_check_mountain_success":
      return "你顺着山道硬生生追上了那条线，眼前的风波终于从传闻变成了实局。";
    case "story_check_mountain_fail":
      return "你还是慢了半步，只能看着山道深处的局势继续往前滚。";
    case "story_check_innkeeper_success":
      return "你及时把掌柜从乱局里拽了出来，这一手让客栈这边重新稳住了气口。";
    case "story_check_innkeeper_fail":
      return "你出手还是慢了，掌柜虽没倒下，但这一场已经见了血。";
    case "story_check_generic_success":
      return "这一手让局面往前推开了一层，事情开始对你有了回应。";
    case "story_check_generic_fail":
      return "这一手没能把事情做实，局面还卡在那里。";
    case "mainline_inn_check_requested":
      return "你踏进客栈这摊乱局，眼下已经不是旁观的时候了，必须先把场面压住。";
    case "mainline_mountain_check_requested":
      return "无量山这条线已经越追越紧，再慢半步，关键人就会从你眼前滑过去。";
    case "mainline_mountain_combat_started":
      return "山道上的追杀当场撞到你面前，试探已经结束，只能先打。";
    case "mainline_ledger_crosscheck":
      return "你把残页重新摊开，开始把账页上的暗记和大理城里的口风一条条对起来。";
    case "mainline_innkeeper_rescue_requested":
      return "你一回到客栈，掌柜那边的险局已经压到眼前，必须立刻出手。";
    case "mainline_shuanger_follow":
      return "你把话说定了，双儿便不再多问，只安静收拾好行囊，准备跟你上路。";
    case "mainline_shuanger_stay":
      return "你暂时没带双儿同行，她把这句话接了下来，但也把这个位置替你留住了。";
    case "mainline_shuanger_support":
      return "双儿照旧不声不响地把细处先替你补齐，等你反应过来，事情已经顺下去了。";
    case "travel_unknown":
      return `你想去“${targetName}”，但这条去向眼下还太模糊，得先把目标说得更准一些。`;
    case "travel_locked":
      return `${targetName} 这条线还没真正打开，贸然赶过去只会扑空。`;
    case "travel_depart":
      return `你定下方向，动身前往 ${targetName}。沿途风声未止，但局面已经换了新的场子。`;
    case "combat_initiative_win":
      return `你先一步看穿了 ${enemyName} 的起手，脚下先抢到半拍，眼前这一轮由你先动。`;
    case "combat_initiative_lose":
      return withEnemyFollowup(`你和 ${enemyName} 一起起动，却还是慢了半拍。对方抢下先手，攻势立刻压了上来。`, result);
    case "combat_damage_end":
      return `这一招伤害终于把 ${enemyName} 压垮了，眼前这场厮杀到这里算是收住。`;
    case "combat_damage_continue":
      return withEnemyFollowup(`这一招实打实落在 ${enemyName} 身上，但对方还没倒，下一轮很快又会接上。`, result);
    case "combat_hit_end":
      return `你这一记抢到了决定性的手，${enemyName} 再也接不住后劲，这场战斗到此为止。`;
    case "combat_hit_success":
      return `你这一手命中了 ${enemyName}，招式已经打穿对方的防线，接下来只差把伤害落定。`;
    case "combat_hit_fail":
      return withEnemyFollowup(`你这一击没能打穿 ${enemyName} 的防线，节奏立刻被对方抢了回去。`, result);
    case "combat_escape_prompt":
      return "你这一手是在设法先把身形从缠斗里拆出来。先按提示掷出逃脱判定，才能知道能不能真正脱身。";
    case "combat_escape_success":
      return `你抓住${enemyName}招式间的一线空当，身形一错，终于从这场缠斗里暂时抽了出去。`;
    case "combat_escape_fail":
      return withEnemyFollowup(`你这一退没能彻底脱开，反倒把空门露了出来，${enemyName}立刻顺势逼上。`, result);
    case "combat_named_start":
      return `你一动手，对面的 ${enemyName} 也不再藏着，战局立刻转成正面交锋。`;
    case "combat_generic_start":
      return "你这一出手，试探立刻变成了真正的交锋。";
    case "suggested_check":
      return "你这一步已经碰到关键处了，但还得掷出一个明确结果，局面才会真正落定。";
    case "economy_no_merchant":
    case "economy_merchant_blocked":
    case "economy_shop_list":
    case "economy_buy_success":
    case "economy_buy_fail":
    case "economy_sell_success":
    case "economy_sell_fail":
    case "economy_steal_prompt":
    case "economy_steal_success":
    case "economy_steal_fail":
      return result.textOverride || "眼下这笔买卖还得看你下一步怎么接。";
    case "first_action":
      return "你迈出的第一步已经把这场江湖局真正拨动起来，线头开始露出来了。";
    case "default_scene":
      return `你在 ${locationName} 推着局面往前走，眼下还没有剧烈翻面，但周围的人和事都已经被你带动了一下。`;
    default:
      return "局面继续往前推了一步。";
  }
}
