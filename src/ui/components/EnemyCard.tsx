import { injuryTickDamage, injuryTierLabel, martialTagLabels } from "../../game/rules";
import type { CombatState, EnemyArchetype } from "../../types";

const archetypeLabels: Record<EnemyArchetype, string> = {
  brute: "重压莽夫",
  assassin: "快攻刺客",
  internalist: "内功手",
  poisoner: "毒手",
  defender: "守势高手",
  boss: "宗师强敌"
};

const statusLabels: Record<string, string> = {
  exposed: "破防",
  controlled: "受扰",
  guarded: "守势",
  screened: "掩护",
  poisoned: "中毒",
  cold: "寒毒",
  sealed: "封脉"
};

export function EnemyCard({ combat }: { combat: CombatState }) {
  if (!combat.active) return null;

  const hpPercent = ((combat.enemyHp || 0) / Math.max(1, combat.enemyMaxHp || 1)) * 100;
  const qiPercent = ((combat.enemyQi || 0) / Math.max(1, combat.enemyMaxQi || 1)) * 100;
  const injury = combat.enemyInnerInjury || 0;
  const injuryTick = injuryTickDamage(injury);
  const archetype = combat.enemyArchetype ? archetypeLabels[combat.enemyArchetype] : "普通敌人";
  const statuses = (combat.enemyStatus || []).map((status) => statusLabels[status] || status);
  const playerStatuses = (combat.playerStatus || []).map((status) => statusLabels[status] || status);

  return (
    <article className="enemy-card">
      <span>正在交手 · {archetype}</span>
      <b>{combat.enemy}</b>
      <small>回合 {combat.round || 1} · {combat.phase || "awaiting_hit_check"}</small>
      {combat.stakes && <small>{combat.stakes}</small>}
      {combat.enemyIntent && <small>意图：{combat.enemyIntent}</small>}
      <div className="enemy-bars">
        <label><span>生命</span><em>{combat.enemyHp}/{combat.enemyMaxHp}</em></label>
        <div className="bar"><span className="hp" style={{ width: `${hpPercent}%` }} /></div>
        <label><span>真气</span><em>{combat.enemyQi}/{combat.enemyMaxQi}</em></label>
        <div className="bar"><span className="qi" style={{ width: `${qiPercent}%` }} /></div>
      </div>
      {injury > 0 && (
        <small>内伤：{injury} · {injuryTierLabel(injury)}{injuryTick ? ` · 每轮先损 ${injuryTick}` : ""}</small>
      )}
      {!!combat.enemyMartialArts?.length && (
        <p>
          {combat.enemyMartialArts.map((art) => {
            const tags = martialTagLabels(art);
            return `${art.name} ${art.damageDice}${tags.length ? `（${tags.join(" / ")}）` : ""}`;
          }).join(" / ")}
        </p>
      )}
      {!!statuses.length && <small>状态：{statuses.join("、")}</small>}
      {!!playerStatuses.length && <small>你身上：{playerStatuses.join("、")}</small>}
      {combat.lastCombatEvent && <small>最近：{combat.lastCombatEvent}</small>}
    </article>
  );
}
