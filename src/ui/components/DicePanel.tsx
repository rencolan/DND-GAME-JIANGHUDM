import { abilityModifier } from "../../game/rules";
import type { GameState, MartialArt, PendingCheck, PendingDamage } from "../../types";

type DicePanelProps = {
  diceOpen: boolean;
  pendingDamage?: PendingDamage;
  pendingDamageDice?: string;
  currentCheck?: PendingCheck;
  combatInitiative: boolean;
  combatAttack: boolean;
  pendingCheckReason?: string;
  game: GameState;
  qiInvest: number;
  setQiInvest: (value: number) => void;
  qiLimit: number;
  lowQi: boolean;
  rollDice: (
    label: string,
    mod: number,
    check?: PendingCheck,
    options?: {
      martialArt?: MartialArt;
      qiBonusSpend?: number;
      sendToDm?: boolean;
    }
  ) => void;
  rollDamageDice: (pendingDamage: PendingDamage) => void;
};

const ABILITY_LABELS: Record<string, string> = {
  str: "力道",
  dex: "身法",
  con: "根骨",
  int: "悟性",
  cha: "气运",
  wis: "心境"
};

const TAG_LABELS: Record<string, string> = {
  break: "破防",
  guard: "守势",
  injure: "内伤",
  control: "控场",
  recover: "回气",
  pierce: "穿防"
};

function abilityLabel(key?: string) {
  return (key && ABILITY_LABELS[key]) || key || "对应属性";
}

function rollModeLabel(mode?: PendingCheck["rollMode"]) {
  if (mode === "advantage") return "优势判定";
  if (mode === "disadvantage") return "劣势判定";
  return "常规判定";
}

function rollModeDetail(mode?: PendingCheck["rollMode"]) {
  if (mode === "advantage") return "掷 2d20 取高";
  if (mode === "disadvantage") return "掷 2d20 取低";
  return "掷 1d20";
}

function tagLabels(art: MartialArt) {
  return (art.tags || []).map((tag) => TAG_LABELS[tag] || tag);
}

export function DicePanel({
  diceOpen,
  pendingDamage,
  pendingDamageDice,
  currentCheck,
  combatInitiative,
  combatAttack,
  pendingCheckReason,
  game,
  qiInvest,
  setQiInvest,
  qiLimit,
  lowQi,
  rollDice,
  rollDamageDice
}: DicePanelProps) {
  if (!diceOpen) return null;

  const combatEscape = game.combat.active && currentCheck?.kind === "combat_escape";
  const sealedQiSurcharge = game.combat.active && game.combat.playerStatus?.includes("sealed") ? 1 : 0;
  const recommendedAbilityKey = combatInitiative ? "dex" : currentCheck?.abilityKey;
  const recommendedAbility = game.character.abilities.find((ability) => ability.key === recommendedAbilityKey);
  const recommendedMod = recommendedAbility ? abilityModifier(recommendedAbility.value) : 0;
  const targetedMartialArt = currentCheck?.martialArtId
    ? game.character.martialArts.find((art) => art.id === currentCheck.martialArtId)
    : undefined;
  const trialLabel = currentCheck?.label || abilityLabel(recommendedAbilityKey);

  if (pendingDamage) {
    return (
      <section className="dice-popover dice-popover-minimal">
        <article className="dice-summary">
          <div className="dice-summary-top">
            <span className="dice-kicker">伤害结算</span>
            <span className="dice-badge">正式掷骰</span>
          </div>
          <b>{pendingDamage.label} · {pendingDamageDice}{pendingDamage.damageBonus ? ` +${pendingDamage.damageBonus}` : ""}</b>
          <p>{pendingDamage.isCritical ? "本次为暴击伤害，伤害骰已翻倍。掷完后才会继续结算。" : "命中已经确认。请掷出这次真实伤害。"}</p>
          {!!pendingDamage.qiCost && <small>命中后耗气 {pendingDamage.qiCost}</small>}
        </article>

        <div className="dice-action-list compact">
          <button className="martial-roll recommended" onClick={() => rollDamageDice(pendingDamage)}>
            <span>
              <strong>{pendingDamage.label}</strong>
              <small>{pendingDamageDice}{pendingDamage.damageBonus ? ` +${pendingDamage.damageBonus}` : ""}</small>
            </span>
            <b>{pendingDamageDice}</b>
          </button>
        </div>
      </section>
    );
  }

  const title = currentCheck
    ? (combatInitiative ? "先攻判定" : combatEscape ? "逃脱判定" : combatAttack ? "攻击判定" : "当前判定")
    : "试投 d20";
  const reason = currentCheck
    ? (pendingCheckReason || currentCheck.reason || `请先完成这次${abilityLabel(recommendedAbilityKey)}判定。`)
    : "当前没有待处理判定。这里仅用于试投，不会推进剧情，也不会写入正式结果。";
  const detail = currentCheck
    ? targetedMartialArt
      ? `关联武学：${targetedMartialArt.name}`
      : `使用属性：${abilityLabel(recommendedAbilityKey)}（修正 ${recommendedMod >= 0 ? "+" : ""}${recommendedMod}）`
    : "只有底部出现“待判定/待攻击/待伤害”时，掷骰才会结算剧情。";
  const note = currentCheck?.risk || currentCheck?.suggestedAction || currentCheck?.enemyIntent;

  return (
    <section className="dice-popover dice-popover-minimal">
      <article className="dice-summary">
        <div className="dice-summary-top">
          <span className="dice-kicker">{title}</span>
          <span className="dice-badge">{currentCheck ? rollModeLabel(currentCheck.rollMode) : "试投"}</span>
        </div>
        {currentCheck && (
          <div className="dice-dc-banner">
            <span>目标难度</span>
            <strong>DC {currentCheck.dc}</strong>
          </div>
        )}
        <b>{currentCheck ? currentCheck.label : "没有待判定"}</b>
        <p>{reason}</p>
        <div className="dice-summary-meta">
          <small>{detail}</small>
          {currentCheck && <small>{rollModeDetail(currentCheck.rollMode)}</small>}
          {note && <small>{note}</small>}
        </div>
      </article>

      {!game.combat.active && currentCheck && (
        <section className={`qi-invest compact ${lowQi ? "low" : ""}`}>
          <div>
            <span>内力加成</span>
            <b>{qiInvest} / {qiLimit}</b>
          </div>
          <input
            type="range"
            min="0"
            max={qiLimit}
            value={qiInvest}
            onChange={(event) => setQiInvest(Number(event.target.value))}
          />
          <p>每投入 2 点真气，判定额外 +1。是否投入由你决定。</p>
        </section>
      )}

      <div className="dice-action-list compact">
        {combatInitiative ? (
          <button
            className="martial-roll recommended"
            onClick={() => rollDice("先攻（身法）", recommendedMod, currentCheck, { sendToDm: true })}
          >
            <span>
              <strong>身法</strong>
              <small>1d20 · 先攻判定</small>
            </span>
            <b>{recommendedMod >= 0 ? "+" : ""}{recommendedMod}</b>
          </button>
        ) : combatEscape ? (
          <button
            className="martial-roll recommended"
            onClick={() => rollDice(trialLabel, recommendedMod, currentCheck, { sendToDm: true })}
          >
            <span>
              <strong>{abilityLabel(recommendedAbilityKey)}</strong>
              <small>{rollModeDetail(currentCheck?.rollMode)} · DC {currentCheck?.dc}</small>
            </span>
            <b>{recommendedMod >= 0 ? "+" : ""}{recommendedMod}</b>
          </button>
        ) : combatAttack ? (
          game.character.martialArts.map((art) => {
            const ability = game.character.abilities.find((entry) => entry.key === art.linkedAbility);
            const mod = ability ? abilityModifier(ability.value) : 0;
            const costOnHit = art.category === "internal" ? art.baseQiCost + sealedQiSurcharge : 0;
            const canUse = art.category === "external" || game.character.qi >= costOnHit;
            const tags = tagLabels(art);

            return (
              <button
                key={art.id}
                className={`martial-roll ${currentCheck?.martialArtId === art.id || currentCheck?.abilityKey === art.linkedAbility ? "recommended" : ""}`}
                disabled={!canUse}
                onClick={() => rollDice(art.name, mod, currentCheck, { martialArt: art, sendToDm: true })}
              >
                <span>
                  <strong>{art.name}</strong>
                  <small>{abilityLabel(art.linkedAbility)} · 伤害 {art.damageDice}{art.damageBonus ? ` +${art.damageBonus}` : ""}{tags.length ? ` · ${tags.join(" / ")}` : ""}</small>
                  {art.effectText && <small>{art.effectText}</small>}
                </span>
                <b>{mod >= 0 ? "+" : ""}{mod}{costOnHit ? ` · 耗气 ${costOnHit}` : ""}</b>
              </button>
            );
          })
        ) : currentCheck ? (
          <button
            className="martial-roll recommended"
            onClick={() => rollDice(trialLabel, recommendedMod, currentCheck, {
              qiBonusSpend: qiInvest,
              sendToDm: true
            })}
          >
            <span>
              <strong>{abilityLabel(recommendedAbilityKey)}</strong>
              <small>{rollModeDetail(currentCheck.rollMode)} · DC {currentCheck.dc}</small>
            </span>
            <b>{recommendedMod >= 0 ? "+" : ""}{recommendedMod}</b>
          </button>
        ) : (
          <>
            <button
              className="martial-roll recommended"
              onClick={() => rollDice("试投 d20", 0, undefined, {
                qiBonusSpend: 0,
                sendToDm: false
              })}
            >
              <span>
                <strong>试投 d20</strong>
                <small>只测试骰子，不推进剧情。</small>
              </span>
              <b>+0</b>
            </button>
            <div className="dice-inline-note">没有待判定时，这里所有掷骰都只是试投。</div>
          </>
        )}
      </div>
    </section>
  );
}
