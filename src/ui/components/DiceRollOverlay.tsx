import type { CSSProperties } from "react";
import type { RollingState } from "../sessionTypes";

type DiceRollOverlayProps = {
  rolling: RollingState;
};

const standardDice = [4, 6, 8, 10, 12, 20] as const;

function normalizeSides(sides: number) {
  if (standardDice.includes(sides as (typeof standardDice)[number])) return sides;
  if (sides <= 4) return 4;
  if (sides <= 6) return 6;
  if (sides <= 8) return 8;
  if (sides <= 10) return 10;
  if (sides <= 12) return 12;
  return 20;
}

function inferDiceSpec(rolling: RollingState) {
  const source = `${rolling.notation || ""} ${rolling.detail || ""}`.trim();
  const notationMatch = source.match(/(\d+)d(\d+)/i);
  const sides = normalizeSides(rolling.sides || (notationMatch ? Number(notationMatch[2]) : 20));

  const d20Face = source.match(/d20=(\d+)/i);
  const firstRoll = source.match(/=\s*(\d+)/);
  const face = Math.max(
    1,
    Math.min(
      sides,
      rolling.face
        || (d20Face ? Number(d20Face[1]) : 0)
        || (firstRoll ? Number(firstRoll[1]) : 1)
    )
  );

  return {
    sides,
    face,
    notation: rolling.notation || (notationMatch ? notationMatch[0].toLowerCase() : `d${sides}`)
  };
}

function buildDiceStyle(sides: number, face: number) {
  const rotateX = 520 + sides * 11 + face * 17;
  const rotateY = 430 + sides * 7 + face * 23;
  const rotateZ = 80 + sides * 3;

  return {
    "--die-rotate-x": `${rotateX}deg`,
    "--die-rotate-y": `${rotateY}deg`,
    "--die-rotate-z": `${rotateZ}deg`
  } as CSSProperties;
}

export function DiceRollOverlay({ rolling }: DiceRollOverlayProps) {
  const { sides, face, notation } = inferDiceSpec(rolling);
  const dieStyle = buildDiceStyle(sides, face);
  const dieClassName = `dice-3d dice-3d-d${sides}`;

  return (
    <section className="roll-overlay">
      <div className="roll-overlay-card">
        <div className="roll-die-stage">
          <div className="roll-die-shadow" aria-hidden="true" />
          <div className={dieClassName} style={dieStyle} aria-label={`d${sides}`}>
            <span className="dice-face face-front">
              <small>{notation}</small>
              <b>{face}</b>
            </span>
            <span className="dice-face face-back" aria-hidden="true" />
            <span className="dice-face face-top" aria-hidden="true" />
            <span className="dice-face face-bottom" aria-hidden="true" />
            <span className="dice-face face-left" aria-hidden="true" />
            <span className="dice-face face-right" aria-hidden="true" />
          </div>
        </div>

        <div className="roll-overlay-copy">
          <span className="roll-overline">{notation.toUpperCase()} 掷骰</span>
          <b>{rolling.label}</b>
          <strong>{rolling.total}</strong>
          <p>{rolling.detail}</p>
        </div>
      </div>
    </section>
  );
}
