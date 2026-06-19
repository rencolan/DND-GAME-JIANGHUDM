import type { CombatState } from "../../types";

export function EnemyCard({ combat }: { combat: CombatState }) {
  if (!combat.active) return null;

  return (
    <article className="enemy-card">
      <span>正在交手</span>
      <b>{combat.enemy}</b>
      <small>回合 {combat.round || 1} · {combat.phase || "awaiting_hit_check"}</small>
      {combat.stakes && <small>{combat.stakes}</small>}
      <div className="enemy-bars">
        <label><span>生命</span><em>{combat.enemyHp}/{combat.enemyMaxHp}</em></label>
        <div className="bar"><span className="hp" style={{ width: `${((combat.enemyHp || 0) / Math.max(1, combat.enemyMaxHp || 1)) * 100}%` }} /></div>
        <label><span>内力</span><em>{combat.enemyQi}/{combat.enemyMaxQi}</em></label>
        <div className="bar"><span className="qi" style={{ width: `${((combat.enemyQi || 0) / Math.max(1, combat.enemyMaxQi || 1)) * 100}%` }} /></div>
      </div>
      {!!combat.enemyMartialArts?.length && (
        <p>{combat.enemyMartialArts.map((art) => `${art.name} ${art.damageDice}`).join(" / ")}</p>
      )}
      {!!combat.enemyStatus?.length && <small>状态：{combat.enemyStatus.join("、")}</small>}
    </article>
  );
}
