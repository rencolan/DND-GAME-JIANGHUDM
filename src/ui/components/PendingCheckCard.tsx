import type { PendingCheck, PendingDamage } from "../../types";

function rollModeLabel(mode?: PendingCheck["rollMode"]) {
  if (mode === "advantage") return "优势";
  if (mode === "disadvantage") return "劣势";
  return "常规";
}

type PendingCheckCardProps = {
  currentCheck?: PendingCheck;
  pendingDamage?: PendingDamage;
  pendingDamageDice?: string;
  pendingCheckTag: string;
  pendingCheckReason?: string;
  pendingCheckAction: string;
  onOpenPendingCheck: () => void;
  combatActive: boolean;
};

export function PendingCheckCard({
  currentCheck,
  pendingDamage,
  pendingDamageDice,
  pendingCheckTag,
  pendingCheckReason,
  pendingCheckAction,
  onOpenPendingCheck,
  combatActive
}: PendingCheckCardProps) {
  if (pendingDamage) {
    return (
      <section className="pending-check">
        <span>待伤害</span>
        <b>{pendingDamage.label} · {pendingDamageDice}{pendingDamage.damageBonus ? ` +${pendingDamage.damageBonus}` : ""}</b>
        <p>命中已经确认，现在只差掷出这招的伤害骰。</p>
        {pendingDamage.isCritical && <small>暴击已触发：本次只翻倍伤害骰，不翻倍固定加值。</small>}
        {!!pendingDamage.qiCost && <small>命中后耗气：{pendingDamage.qiCost}</small>}
        <button type="button" onClick={onOpenPendingCheck}>掷伤害</button>
      </section>
    );
  }

  if (!currentCheck) return null;

  return (
    <section className="pending-check">
      <span>{pendingCheckTag}</span>
      <b>{currentCheck.label} · DC {currentCheck.dc}</b>
      <p>{pendingCheckReason}</p>
      <small>当前势：{rollModeLabel(currentCheck.rollMode)}</small>
      {currentCheck.enemyIntent && <small>敌人意图：{currentCheck.enemyIntent}</small>}
      {currentCheck.risk && <small>失败风险：{currentCheck.risk}</small>}
      {currentCheck.suggestedAction && !combatActive && <small>可尝试：{currentCheck.suggestedAction}</small>}
      {currentCheck.suggestedAction && combatActive && <small>请按此判定：{currentCheck.suggestedAction}</small>}
      <button type="button" onClick={onOpenPendingCheck}>{pendingCheckAction}</button>
    </section>
  );
}
