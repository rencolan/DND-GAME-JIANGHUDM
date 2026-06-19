import { abilityModifier } from "../../game/rules";
import type { Ability, GameState, PendingCheck, PendingDamage, RollMode } from "../../types";

type DicePanelProps = {
  diceOpen: boolean;
  pendingDamage?: PendingDamage;
  pendingDamageDice?: string;
  currentCheck?: PendingCheck;
  combatInitiative: boolean;
  combatAttack: boolean;
  pendingCheckReason?: string;
  rollMode: RollMode;
  setRollMode: (mode: RollMode) => void;
  game: GameState;
  qiInvest: number;
  setQiInvest: (value: number) => void;
  qiLimit: number;
  lowQi: boolean;
  dexAbility?: Ability;
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

export function DicePanel({
  diceOpen,
  pendingDamage,
  pendingDamageDice,
  currentCheck,
  combatInitiative,
  combatAttack,
  pendingCheckReason,
  rollMode,
  setRollMode,
  game,
  qiInvest,
  setQiInvest,
  qiLimit,
  lowQi,
  dexAbility,
  rollDice,
  rollDamageDice
}: DicePanelProps) {
  if (!diceOpen) return null;

  return (
    <section className="dice-popover">
      {pendingDamage ? (
        <>
          <article className="dice-check">
            <span>伤害结算</span>
            <b>{pendingDamage.label} · {pendingDamageDice}{pendingDamage.damageBonus ? ` +${pendingDamage.damageBonus}` : ""}</b>
            <p>命中已经确认，现在掷出真正生效的伤害骰。</p>
            {pendingDamage.isCritical && <small>暴击时只翻倍伤害骰，固定加值不翻倍。</small>}
            {!!pendingDamage.qiCost && <small>命中后耗气：{pendingDamage.qiCost}</small>}
          </article>

          <div className="dice-action-list">
            <button
              className="martial-roll recommended"
              onClick={() => rollDamageDice(pendingDamage)}
            >
              <span>
                {pendingDamage.label}
                <small>点击掷出 {pendingDamageDice}{pendingDamage.damageBonus ? ` +${pendingDamage.damageBonus}` : ""}</small>
              </span>
              <b>{pendingDamageDice}</b>
            </button>
          </div>
        </>
      ) : (
        <>
          {currentCheck && (
            <article className="dice-check">
              <span>{combatInitiative ? "先攻判定" : combatAttack ? "攻击判定" : "当前判定"}</span>
              <b>{currentCheck.label} · DC {currentCheck.dc}</b>
              <p>{pendingCheckReason}</p>
              {currentCheck.risk && <small>失败风险：{currentCheck.risk}</small>}
            </article>
          )}

          <div className="segmented">
            <button className={rollMode === "disadvantage" ? "active" : ""} onClick={() => setRollMode("disadvantage")}>劣势</button>
            <button className={rollMode === "normal" ? "active" : ""} onClick={() => setRollMode("normal")}>常规</button>
            <button className={rollMode === "advantage" ? "active" : ""} onClick={() => setRollMode("advantage")}>优势</button>
          </div>

          {!game.combat.active && (
            <section className={`qi-invest ${lowQi ? "low" : ""}`}>
              <div>
                <span>额外投入内力</span>
                <b>{qiInvest} / {qiLimit}</b>
              </div>
              <input
                type="range"
                min="0"
                max={qiLimit}
                value={qiInvest}
                onChange={(event) => setQiInvest(Number(event.target.value))}
              />
              <p>每投入 2 点内力，判定 +1。只对非战斗检定生效。</p>
            </section>
          )}

          <div className="dice-action-list">
            {combatInitiative ? (
              <button
                className="recommended"
                onClick={() => rollDice("先攻（身法）", dexAbility ? abilityModifier(dexAbility.value) : 0, currentCheck, { sendToDm: Boolean(currentCheck) })}
              >
                <span>
                  {dexAbility?.label || "身法"}
                  <small>固定用 DEX 掷 d20，决定谁先动手</small>
                </span>
                <b>{dexAbility ? `${abilityModifier(dexAbility.value) >= 0 ? "+" : ""}${abilityModifier(dexAbility.value)}` : "+0"}</b>
              </button>
            ) : combatAttack ? (
              game.character.martialArts.map((art) => {
                const ability = game.character.abilities.find((entry) => entry.key === art.linkedAbility);
                const mod = ability ? abilityModifier(ability.value) : 0;
                const costOnHit = art.category === "internal" ? art.baseQiCost : 0;
                const canUse = art.category === "external" || game.character.qi >= costOnHit;

                return (
                  <button
                    key={art.id}
                    className={`martial-roll ${currentCheck?.martialArtId === art.id || currentCheck?.abilityKey === art.linkedAbility ? "recommended" : ""}`}
                    disabled={!canUse}
                    onClick={() => rollDice(art.name, mod, currentCheck, { martialArt: art, sendToDm: Boolean(currentCheck) })}
                  >
                    <span>
                      {art.name}
                      <small>{ability?.label || "对应属性"} · 伤害 {art.damageDice}{art.damageBonus ? ` +${art.damageBonus}` : ""}</small>
                    </span>
                    <b>{mod >= 0 ? "+" : ""}{mod}{costOnHit ? ` · 耗气 ${costOnHit}` : ""}</b>
                  </button>
                );
              })
            ) : (
              <>
                {game.character.abilities.map((ability) => (
                  <button
                    key={ability.key}
                    className={currentCheck?.abilityKey === ability.key ? "recommended" : ""}
                    onClick={() => rollDice(ability.label, abilityModifier(ability.value), currentCheck, { qiBonusSpend: qiInvest, sendToDm: Boolean(currentCheck) })}
                  >
                    <span>
                      {ability.label}
                      <small>基础判定 · d20 检定</small>
                    </span>
                    <b>{abilityModifier(ability.value) >= 0 ? "+" : ""}{abilityModifier(ability.value)}</b>
                  </button>
                ))}

                {game.character.martialArts.map((art) => {
                  const ability = game.character.abilities.find((entry) => entry.key === art.linkedAbility);
                  const mod = ability ? abilityModifier(ability.value) : 0;
                  const costOnHit = art.category === "internal" ? art.baseQiCost : 0;
                  const canUse = qiInvest <= game.character.qi && (art.category === "external" || game.character.qi >= qiInvest + costOnHit);

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
                        {art.name}
                        <small>{art.category === "internal" ? "内功" : "外功"} · 伤害 {art.damageDice}{art.damageBonus ? ` +${art.damageBonus}` : ""}</small>
                      </span>
                      <b>{mod >= 0 ? "+" : ""}{mod} · 耗气 {costOnHit}</b>
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
