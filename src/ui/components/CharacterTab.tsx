import { abilityModifier } from "../../game/rules";
import { primaryRouteForNpc } from "../../game/world";
import type { GameState } from "../../types";
import { abilityDefinitions, relationshipRouteStageLabel, relationshipTierLabel } from "../display";

type CharacterTabProps = {
  game: GameState;
  selectedAbilityInfoKey?: string;
  setSelectedAbilityInfoKey: (value: string | undefined | ((current: string | undefined) => string | undefined)) => void;
  activeRelationshipNpcs: GameState["npcs"];
};

function relationshipTier(relationship: number) {
  if (relationship >= 80) return "devoted";
  if (relationship >= 65) return "confidant";
  if (relationship >= 50) return "trusted";
  if (relationship >= 35) return "familiar";
  return "stranger";
}

export function CharacterTab({
  game,
  selectedAbilityInfoKey,
  setSelectedAbilityInfoKey,
  activeRelationshipNpcs
}: CharacterTabProps) {
  return (
    <div className="drawer-grid">
      <section className="hero-card">
        <img src={game.character.portrait} alt={`${game.character.name}立绘`} />
        <div>
          <h2>{game.character.name}</h2>
          <p>{game.character.title}</p>
          <div className="bar-label"><span>生命</span><b>{game.character.hp}/{game.character.maxHp}</b></div>
          <div className="bar"><span className="hp" style={{ width: `${(game.character.hp / Math.max(1, game.character.maxHp)) * 100}%` }} /></div>
          <div className="bar-label"><span>内力</span><b>{game.character.qi}/{game.character.maxQi}</b></div>
          <div className="bar"><span className="qi" style={{ width: `${game.character.maxQi ? (game.character.qi / game.character.maxQi) * 100 : 0}%` }} /></div>
          <p className="inner-state">银两 {game.character.silver}</p>
          <p className="inner-state">内伤 {game.innerInjury || 0}</p>
        </div>
      </section>

      <section className="stat-grid">
        {game.character.abilities.map((ability) => (
          <button
            key={ability.key}
            type="button"
            onClick={() => setSelectedAbilityInfoKey((current) => current === ability.key ? undefined : ability.key)}
          >
            <span>{ability.label}</span>
            <b>{ability.value}</b>
            <em>{abilityModifier(ability.value) >= 0 ? "+" : ""}{abilityModifier(ability.value)}</em>
          </button>
        ))}
      </section>

      {selectedAbilityInfoKey && (
        <article className="origin-hook">
          <b>{abilityDefinitions[selectedAbilityInfoKey].title}</b>
          <span>{abilityDefinitions[selectedAbilityInfoKey].text}</span>
        </article>
      )}

      {activeRelationshipNpcs.length > 0 && (
        <section className="relationship-route-panel">
          <h3>特别的人</h3>
          {activeRelationshipNpcs.slice(0, 3).map((npc) => {
            const route = primaryRouteForNpc(game, npc.id);
            return (
              <article key={npc.id}>
                <b>{npc.name}</b>
                <span>{relationshipTierLabel(relationshipTier(npc.relationship))} · {route ? relationshipRouteStageLabel(route.stage, route.kind) : "未起线"}</span>
                <p>{route?.note || npc.goal}</p>
              </article>
            );
          })}
        </section>
      )}
    </div>
  );
}
