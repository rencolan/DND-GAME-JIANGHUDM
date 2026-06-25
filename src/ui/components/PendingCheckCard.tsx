import type { PendingCheck, PendingDamage } from "../../types";

const ABILITY_LABELS: Record<string, string> = {
  str: "力道",
  dex: "身法",
  con: "根骨",
  int: "悟性",
  cha: "气运",
  wis: "心境"
};

function abilityLabel(key?: string) {
  return (key && ABILITY_LABELS[key]) || key || "对应属性";
}

function rollModeLabel(mode?: PendingCheck["rollMode"]) {
  if (mode === "advantage") return "优势，掷 2d20 取高";
  if (mode === "disadvantage") return "劣势，掷 2d20 取低";
  return "常规，掷 1d20";
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
        <p>命中已经确认。请掷这次伤害，结算后流程才会继续。</p>
        {pendingDamage.isCritical && <small>暴击：本次只翻倍伤害骰，不翻倍固定加值。</small>}
        {!!pendingDamage.qiCost && <small>命中后耗气：{pendingDamage.qiCost}</small>}
        <button type="button" onClick={onOpenPendingCheck}>掷伤害</button>
      </section>
    );
  }

  if (!currentCheck) return null;

  return (
    <section className="pending-check">
      <span>{pendingCheckTag}</span>
      <div className="pending-check-title">
        <b>{currentCheck.label}</b>
        <strong className="dc-chip">DC {currentCheck.dc}</strong>
      </div>
      <p>{pendingCheckReason || currentCheck.reason}</p>
      <small>要求：{abilityLabel(currentCheck.abilityKey)} · {rollModeLabel(currentCheck.rollMode)}</small>
      {currentCheck.enemyIntent && <small>敌方意图：{currentCheck.enemyIntent}</small>}
      {currentCheck.risk && <small>失败风险：{currentCheck.risk}</small>}
      {currentCheck.suggestedAction && !combatActive && <small>可尝试：{currentCheck.suggestedAction}</small>}
      {currentCheck.suggestedAction && combatActive && <small>请按此判定：{currentCheck.suggestedAction}</small>}
      <button type="button" onClick={onOpenPendingCheck}>{pendingCheckAction}</button>
    </section>
  );
}
