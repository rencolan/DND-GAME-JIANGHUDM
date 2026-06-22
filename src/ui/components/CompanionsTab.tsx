import { primaryRouteForNpc } from "../../game/world";
import type { GameState } from "../../types";
import { relationshipRouteStageLabel, relationshipTierLabel, supportLabel } from "../display";
import { NpcCard } from "./NpcCard";

type CompanionsTabProps = {
  game: GameState;
  companions: GameState["npcs"];
  activeRelationshipNpcs: GameState["npcs"];
  onUseSupport: (npcId: string) => void;
};

function relationshipTier(relationship: number) {
  if (relationship >= 80) return "devoted";
  if (relationship >= 65) return "confidant";
  if (relationship >= 50) return "trusted";
  if (relationship >= 35) return "familiar";
  return "stranger";
}

function canUseSupport(game: GameState, npcId: string) {
  const supportIds = new Set(["shuang-er", "a-zhu", "wang-yuyan", "duan-yu", "mu-wanqing", "qiao-feng", "xu-zhu"]);
  if (!supportIds.has(npcId)) return false;

  const npc = game.npcs.find((entry) => entry.id === npcId);
  if (game.combat.active) {
    const combatFlag = `support:${npcId}:combat:${game.combat.combatId || `${game.worldDay}:${game.combat.enemy || "unknown"}`}`;
    return Boolean(npc?.companion && !game.storyFlags.includes(combatFlag));
  }

  if (game.storyFlags.includes(`support:${npcId}:used:${game.worldDay}`)) return false;
  const route = primaryRouteForNpc(game, npcId);
  return Boolean(npc?.companion || route?.active || (npc && (!npc.hidden || npc.discovered) && npc.relationship >= 45));
}

export function CompanionsTab({ game, companions, activeRelationshipNpcs, onUseSupport }: CompanionsTabProps) {
  return (
    <div className="npc-grid">
      {companions.length > 0 ? companions.map((npc) => {
        const route = primaryRouteForNpc(game, npc.id);
        return (
          <NpcCard
            key={npc.id}
            npc={npc}
            relationshipLabel={relationshipTierLabel(relationshipTier(npc.relationship))}
            routeLabel={route ? relationshipRouteStageLabel(route.stage, route.kind) : undefined}
            routeNote={route?.note}
            supportLabels={route?.supportUnlocked?.map(supportLabel)}
            onUseSupport={canUseSupport(game, npc.id) ? () => onUseSupport(npc.id) : undefined}
          />
        );
      }) : (
        <p className="empty-state">眼下无人同行。同伴会随故事自然加入，也可能因为局势离开。</p>
      )}

      {activeRelationshipNpcs.length > 0 && (
        <section className="relationship-route-panel">
          <h3>长期牵挂</h3>
          {activeRelationshipNpcs.map((npc) => {
            const route = primaryRouteForNpc(game, npc.id);
            if (!route) return null;
            return (
              <NpcCard
                key={`route-${npc.id}`}
                npc={npc}
                relationshipLabel={relationshipTierLabel(relationshipTier(npc.relationship))}
                routeLabel={relationshipRouteStageLabel(route.stage, route.kind)}
                routeNote={route.note}
                supportLabels={route.supportUnlocked?.map(supportLabel)}
                onUseSupport={canUseSupport(game, npc.id) ? () => onUseSupport(npc.id) : undefined}
              />
            );
          })}
        </section>
      )}
    </div>
  );
}
