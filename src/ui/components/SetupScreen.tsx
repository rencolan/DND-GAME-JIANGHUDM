import {
  CREATION_FREE_POINTS,
  calculateAcFromDex,
  calculateHpFromCon,
  calculateMaxQi
} from "../../game/rules";
import type { OriginTemplate } from "../../types";
import { abilityDefinitions, abilityEffectLabels, abilityLabels } from "../display";
import { applyAllocation, canAdjustAllocation, remainingAllocationPoints } from "../sessionShared";
import type { RollPackage } from "../sessionTypes";

type SetupScreenProps = {
  customName: string;
  setCustomName: (value: string) => void;
  selectedOrigin: OriginTemplate;
  abilityChoices: RollPackage[];
  abilityAllocation: RollPackage;
  setAbilityAllocation: (value: RollPackage) => void;
  onStart: () => void;
  onContinue?: () => void;
};

const abilityOrder: Array<keyof typeof abilityLabels> = ["str", "dex", "con", "int", "cha", "wis"];

function abilityMod(value: number) {
  return Math.floor((value - 10) / 2);
}

export function SetupScreen({
  customName,
  setCustomName,
  selectedOrigin,
  abilityChoices,
  abilityAllocation,
  setAbilityAllocation,
  onStart,
  onContinue
}: SetupScreenProps) {
  const baseChoice = abilityChoices[0] || ([0, 0, 0, 0, 0, 0] as RollPackage);
  const finalChoice = applyAllocation(baseChoice, abilityAllocation);
  const pointsLeft = remainingAllocationPoints(abilityAllocation);
  const startingArt = selectedOrigin.martialArts[0];
  const previewStats = {
    hp: calculateHpFromCon(finalChoice[2]),
    ac: calculateAcFromDex(finalChoice[1]),
    qi: calculateMaxQi(selectedOrigin.qiStart, finalChoice[5]),
    extBonus: Math.max(0, abilityMod(finalChoice[0])),
    intBonus: Math.max(0, abilityMod(finalChoice[5]))
  };

  function adjustAllocation(index: number, delta: -1 | 1) {
    if (!canAdjustAllocation(baseChoice, abilityAllocation, index, delta)) return;
    const next = [...abilityAllocation] as RollPackage;
    next[index] += delta;
    setAbilityAllocation(next);
  }

  return (
    <section className="setup-screen">
      <div className="setup-shell">
        <header className="setup-hero">
          <div className="setup-hero-copy">
            <p className="setup-kicker">江湖 DM · 开局</p>
            <h1>入局之前</h1>
            <p className="setup-summary">
              无门无派，先在大理客栈落脚。今夜风声已起，给自己定个名字，再入江湖。
            </p>
          </div>

          {onContinue && (
            <button className="setup-continue" type="button" onClick={onContinue}>
              继续上次存档
            </button>
          )}
        </header>

        <section className="setup-top-grid">
          <article className="setup-card setup-identity-card">
            <div className="setup-card-header">
              <span>身份起点</span>
              <b>{selectedOrigin.name}</b>
            </div>

            <label className="name-field">
              角色姓名
              <input value={customName} onChange={(event) => setCustomName(event.target.value)} maxLength={8} />
            </label>

            <p className="setup-origin-copy">{selectedOrigin.desc}</p>

            <div className="setup-bullet-grid">
              <article>
                <span>起手任务</span>
                <b>{selectedOrigin.firstQuest.title}</b>
                <small>{selectedOrigin.firstQuest.location}</small>
              </article>
              <article>
                <span>起手武学</span>
                <b>{startingArt?.name || "江湖刀路"}</b>
                <small>{startingArt ? `${startingArt.damageDice} · ${startingArt.category === "internal" ? "内功" : "外功"}` : "基础招式"}</small>
              </article>
            </div>

            <div className="origin-hook">
              <b>入局提示</b>
              <span>{selectedOrigin.setupHint}</span>
            </div>
          </article>
        </section>

        <section className="setup-main-grid">
          <article className="setup-card setup-build-card">
            <div className="setup-card-header">
              <span>属性分配</span>
              <b>剩余 {pointsLeft} / {CREATION_FREE_POINTS}</b>
            </div>

            <div className="setup-build-summary">
              <span>生命 {previewStats.hp}</span>
              <span>护甲 {previewStats.ac}</span>
              <span>内力 {previewStats.qi}</span>
              <span>外功 +{previewStats.extBonus}</span>
              <span>内功 +{previewStats.intBonus}</span>
              <span>{startingArt?.name || "江湖刀路"}</span>
            </div>

            <div className="allocator allocator-compact">
              {abilityOrder.map((key, index) => (
                <article key={key}>
                  <div className="allocator-controls">
                    <button
                      type="button"
                      onClick={() => adjustAllocation(index, -1)}
                      disabled={!canAdjustAllocation(baseChoice, abilityAllocation, index, -1)}
                    >
                      -
                    </button>

                    <strong>{abilityLabels[key]} {finalChoice[index]}</strong>

                    <button
                      type="button"
                      onClick={() => adjustAllocation(index, 1)}
                      disabled={!canAdjustAllocation(baseChoice, abilityAllocation, index, 1)}
                    >
                      +
                    </button>
                  </div>

                  <div className="allocator-meta">
                    <small>底 {baseChoice[index]} · {abilityEffectLabels[key]}</small>
                    <span>修正 {abilityMod(finalChoice[index]) >= 0 ? "+" : ""}{abilityMod(finalChoice[index])}</span>
                  </div>
                </article>
              ))}
            </div>
          </article>
        </section>

        <section className="setup-card setup-guide-section">
          <div className="setup-card-header">
            <span>属性用途</span>
            <b>开局先看重点</b>
          </div>

          <div className="setup-guide-grid">
            {abilityOrder.map((key) => (
              <article key={key} className="setup-guide-card">
                <div>
                  <b>{abilityLabels[key]}</b>
                  <span>{abilityEffectLabels[key]}</span>
                </div>
                <p>{abilityDefinitions[key].text}</p>
              </article>
            ))}
          </div>
        </section>

        <button className="primary-action" type="button" onClick={onStart}>
          以此命数入局
        </button>
      </div>
    </section>
  );
}
