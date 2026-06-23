import { abilityModifier, martialTagLabels } from "../../game/rules";
import type { GameState, PendingCheck, PendingDamage } from "../../types";

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
      martialArt?: GameState["character"]["martialArts"][number];
      qiBonusSpend?: number;
      sendToDm?: boolean;
    }
  ) => void;
  rollDamageDice: (pendingDamage: PendingDamage) => void;
};

function rollModeLabel(mode?: PendingCheck["rollMode"]) {
  switch (mode) {
    case "advantage":
      return "优势判定";
    case "disadvantage":
      return "劣势判定";
    default:
      return "常规判定";
  }
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
  const currentModeLabel = rollModeLabel(currentCheck?.rollMode);
  const summaryTitle = pendingDamage
    ? "伤害结算"
    : currentCheck
      ? (combatInitiative ? "先攻判定" : combatEscape ? "逃脱判定" : combatAttack ? "攻击判定" : "当前判定")
      : "试掷 d20";
  const summaryHeading = pendingDamage
    ? `${pendingDamage.label} · ${pendingDamageDice}${pendingDamage?.damageBonus ? ` +${pendingDamage.damageBonus}` : ""}`
    : currentCheck
      ? currentCheck.label
      : "没有待处理判定";
  const summaryText = pendingDamage
    ? (pendingDamage.isCritical ? "暴击伤害已按翻倍骰计算，现在直接掷真实伤害。" : "命中已经确认，现在直接掷真实伤害。")
    : currentCheck
      ? (combatInitiative
        ? "本轮先攻固定使用身法判定。"
        : combatEscape
          ? (pendingCheckReason || currentCheck.reason)
          : combatAttack
            ? "先做命中判定，命中后再进入伤害结算。"
            : pendingCheckReason || currentCheck.reason)
      : "这里只做一次普通 d20 试掷，不推进状态，也不会写入结果。";
  const summaryDetail = pendingDamage
    ? (pendingDamage.qiCost ? `命中后耗气 ${pendingDamage.qiCost}` : undefined)
    : currentCheck
      ? (
        combatEscape
          ? (recommendedAbility ? `当前属性：${recommendedAbility.label}` : undefined)
          : targetedMartialArt
            ? `当前挂钩武学：${targetedMartialArt.name}`
            : recommendedAbility
              ? `当前属性：${recommendedAbility.label}`
              : undefined
      )
      : "默认只做常规判定";
  const summaryNote = currentCheck?.suggestedAction || currentCheck?.risk || currentCheck?.enemyIntent;
  const trialLabel = currentCheck?.label || recommendedAbility?.label || "通用判定";

  return (
    <section className="dice-popover dice-popover-minimal">
      {pendingDamage ? (
        <>
          <article className="dice-summary">
            <div className="dice-summary-top">
              <span className="dice-kicker">{summaryTitle}</span>
              <span className="dice-badge">立即掷伤害</span>
            </div>
            <b>{summaryHeading}</b>
            <p>{summaryText}</p>
            {summaryDetail && <small>{summaryDetail}</small>}
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
        </>
      ) : (
        <>
          <article className="dice-summary">
            <div className="dice-summary-top">
              <span className="dice-kicker">{summaryTitle}</span>
              <span className="dice-badge">{currentModeLabel}</span>
            </div>
            {currentCheck && (
              <div className="dice-dc-banner">
                <span>目标难度</span>
                <strong>DC {currentCheck.dc}</strong>
              </div>
            )}
            <b>{summaryHeading}</b>
            <p>{summaryText}</p>
            {(summaryDetail || summaryNote) && (
              <div className="dice-summary-meta">
                {summaryDetail && <small>{summaryDetail}</small>}
                {summaryNote && <small>{summaryNote}</small>}
              </div>
            )}
          </article>

          {!game.combat.active && (
            <section className={`qi-invest compact ${lowQi ? "low" : ""}`}>
              <div>
                <span>内力投入</span>
                <b>{qiInvest} / {qiLimit}</b>
              </div>
              <input
                type="range"
                min="0"
                max={qiLimit}
                value={qiInvest}
                onChange={(event) => setQiInvest(Number(event.target.value))}
              />
              <p>每投入 2 点内力，判定额外 +1。</p>
            </section>
          )}

          <div className="dice-action-list compact">
            {combatInitiative ? (
              <button
                className="martial-roll recommended"
                onClick={() => rollDice("先攻（身法）", recommendedMod, currentCheck, { sendToDm: Boolean(currentCheck) })}
              >
                <span>
                  <strong>{recommendedAbility?.label || "身法"}</strong>
                  <small>d20 + DEX</small>
                </span>
                <b>{recommendedMod >= 0 ? "+" : ""}{recommendedMod}</b>
              </button>
            ) : combatEscape ? (
              <button
                className="martial-roll recommended"
                onClick={() => rollDice(trialLabel, recommendedMod, currentCheck, { sendToDm: Boolean(currentCheck) })}
              >
                <span>
                  <strong>{recommendedAbility?.label || trialLabel}</strong>
                  <small>{currentCheck ? `${currentModeLabel} · d20 检定` : "试掷 · 1d20"}</small>
                </span>
                <b>{recommendedMod >= 0 ? "+" : ""}{recommendedMod}</b>
              </button>
            ) : combatAttack ? (
              game.character.martialArts.map((art) => {
                const ability = game.character.abilities.find((entry) => entry.key === art.linkedAbility);
                const mod = ability ? abilityModifier(ability.value) : 0;
                const costOnHit = art.category === "internal" ? art.baseQiCost + sealedQiSurcharge : 0;
                const canUse = art.category === "external" || game.character.qi >= costOnHit;
                const tags = martialTagLabels(art);

                return (
                  <button
                    key={art.id}
                    className={`martial-roll ${currentCheck?.martialArtId === art.id || currentCheck?.abilityKey === art.linkedAbility ? "recommended" : ""}`}
                    disabled={!canUse}
                    onClick={() => rollDice(art.name, mod, currentCheck, { martialArt: art, sendToDm: Boolean(currentCheck) })}
                  >
                    <span>
                      <strong>{art.name}</strong>
                      <small>{ability?.label || "对应属性"} · 伤害 {art.damageDice}{art.damageBonus ? ` +${art.damageBonus}` : ""}{tags.length ? ` · ${tags.join(" / ")}` : ""}</small>
                      {art.effectText && <small>{art.effectText}</small>}
                    </span>
                    <b>{mod >= 0 ? "+" : ""}{mod}{costOnHit ? ` · 耗气 ${costOnHit}` : ""}</b>
                  </button>
                );
              })
            ) : (
              <>
                <button
                  className="martial-roll recommended"
                  onClick={() => rollDice(trialLabel, recommendedMod, currentCheck, {
                    qiBonusSpend: qiInvest,
                    sendToDm: Boolean(currentCheck)
                  })}
                >
                  <span>
                    <strong>{recommendedAbility?.label || trialLabel}</strong>
                    <small>{currentCheck ? `${currentModeLabel} · d20 检定` : "试掷 · 1d20"}</small>
                  </span>
                  <b>{recommendedMod >= 0 ? "+" : ""}{recommendedMod}</b>
                </button>

                {game.character.martialArts.length > 0 && (
                  <div className="dice-inline-note">也可以直接按招式试掷</div>
                )}

                {game.character.martialArts.map((art) => {
                  const ability = game.character.abilities.find((entry) => entry.key === art.linkedAbility);
                  const mod = ability ? abilityModifier(ability.value) : 0;
                const costOnHit = art.category === "internal" ? art.baseQiCost + sealedQiSurcharge : 0;
                  const canUse = qiInvest <= game.character.qi && (art.category === "external" || game.character.qi >= qiInvest + costOnHit);
                  const tags = martialTagLabels(art);

                  return (
                    <button
                      key={art.id}
                      className={`martial-roll ${currentCheck?.martialArtId === art.id || currentCheck?.abilityKey === art.linkedAbility ? "recommended" : ""}`}
                      disabled={!canUse}
                      onClick={() => rollDice(`${art.name}（${ability?.label || "属性"}）`, mod, currentCheck, {
                        martialArt: art,
                        qiBonusSpend: qiInvest,
                        sendToDm: Boolean(currentCheck)
                      })}
                    >
                      <span>
                        <strong>{art.name}</strong>
                        <small>{art.category === "internal" ? "内功" : "外功"} · 伤害 {art.damageDice}{art.damageBonus ? ` +${art.damageBonus}` : ""}{tags.length ? ` · ${tags.join(" / ")}` : ""}</small>
                        {art.effectText && <small>{art.effectText}</small>}
                      </span>
                      <b>{mod >= 0 ? "+" : ""}{mod}{costOnHit ? ` · 耗气 ${costOnHit}` : ""}</b>
                    </button>
                  );
                })}
              </>
            )}
          </div>
        </>
      )}
    </section>
  );
}
