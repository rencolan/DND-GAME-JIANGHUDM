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
  const hasBoundResolution = Boolean(pendingDamage || currentCheck);
  const isFreeTrial = !hasBoundResolution;

  const summaryTitle = pendingDamage
    ? "伤害结算"
    : currentCheck
      ? (combatInitiative ? "先攻判定" : combatEscape ? "逃脱判定" : combatAttack ? "攻击判定" : "当前判定")
      : "试投 d20";

  const summaryHeading = pendingDamage
    ? `${pendingDamage.label} · ${pendingDamageDice}${pendingDamage.damageBonus ? ` +${pendingDamage.damageBonus}` : ""}`
    : currentCheck
      ? currentCheck.label
      : "当前没有待处理判定";

  const summaryText = pendingDamage
    ? (pendingDamage.isCritical
      ? "本次为暴击伤害，伤害骰已翻倍。掷完这一下后才会继续结算。"
      : "命中已经确认。现在只需要掷出这次真实伤害。")
    : currentCheck
      ? (combatInitiative
        ? "本轮先攻固定使用身法判定。掷完后决定谁先出手。"
        : combatEscape
          ? (pendingCheckReason || currentCheck.reason || "先完成这次逃脱判定，才能知道能否摆脱缠斗。")
          : combatAttack
            ? "先掷命中判定。命中后，系统才会进入伤害掷骰。"
            : pendingCheckReason || currentCheck.reason || `请先完成这次 ${recommendedAbility?.label || currentCheck.abilityKey} 判定，剧情才会继续推进。`)
      : "这里现在只是试投工具，不会推进剧情，也不会写入正式结果。";

  const summaryDetail = pendingDamage
    ? (pendingDamage.qiCost ? `命中后耗气 ${pendingDamage.qiCost}` : undefined)
    : currentCheck
      ? (
        targetedMartialArt
          ? `关联武学：${targetedMartialArt.name}`
          : recommendedAbility
            ? `使用属性：${recommendedAbility.label}（修正 ${recommendedMod >= 0 ? "+" : ""}${recommendedMod}）`
            : undefined
      )
      : "没有 pendingCheck / pendingDamage 时，才会显示试投。";

  const summaryNote = currentCheck?.risk || currentCheck?.suggestedAction || currentCheck?.enemyIntent;
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
              <span className="dice-badge">{currentCheck ? currentModeLabel : "试投"}</span>
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
              <p>每投入 2 点真气，判定额外 +1。是否投入由你自己决定。</p>
            </section>
          )}

          <div className="dice-action-list compact">
            {combatInitiative ? (
              <button
                className="martial-roll recommended"
                onClick={() => rollDice("先攻（身法）", recommendedMod, currentCheck, { sendToDm: true })}
              >
                <span>
                  <strong>{recommendedAbility?.label || "身法"}</strong>
                  <small>1d20 · DEX 修正 · 先攻判定</small>
                </span>
                <b>{recommendedMod >= 0 ? "+" : ""}{recommendedMod}</b>
              </button>
            ) : combatEscape ? (
              <button
                className="martial-roll recommended"
                onClick={() => rollDice(trialLabel, recommendedMod, currentCheck, { sendToDm: true })}
              >
                <span>
                  <strong>{recommendedAbility?.label || trialLabel}</strong>
                  <small>{currentModeLabel} · d20 · DC {currentCheck?.dc}</small>
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
                    onClick={() => rollDice(art.name, mod, currentCheck, { martialArt: art, sendToDm: true })}
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
            ) : currentCheck ? (
              <button
                className="martial-roll recommended"
                onClick={() => rollDice(trialLabel, recommendedMod, currentCheck, {
                  qiBonusSpend: qiInvest,
                  sendToDm: true
                })}
              >
                <span>
                  <strong>{recommendedAbility?.label || trialLabel}</strong>
                  <small>{currentModeLabel} · d20 · DC {currentCheck.dc}</small>
                </span>
                <b>{recommendedMod >= 0 ? "+" : ""}{recommendedMod}</b>
              </button>
            ) : (
              <>
                <button
                  className="martial-roll recommended"
                  onClick={() => rollDice(trialLabel, recommendedMod, undefined, {
                    qiBonusSpend: qiInvest,
                    sendToDm: false
                  })}
                >
                  <span>
                    <strong>试投 d20</strong>
                    <small>仅测试掷骰，不推进剧情</small>
                  </span>
                  <b>{recommendedMod >= 0 ? "+" : ""}{recommendedMod}</b>
                </button>

                {game.character.martialArts.length > 0 && (
                  <div className="dice-inline-note">下方这些也是试投，不会替代正式判定。</div>
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
                      className="martial-roll"
                      disabled={!canUse}
                      onClick={() => rollDice(`${art.name}（${ability?.label || "属性"}）`, mod, undefined, {
                        martialArt: art,
                        qiBonusSpend: qiInvest,
                        sendToDm: false
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
