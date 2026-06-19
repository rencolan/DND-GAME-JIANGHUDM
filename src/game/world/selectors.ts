import type { GameState, Npc, RelationshipRouteState } from "../../types";

export function currentLocation(state: GameState) {
  return state.locations.find((location) => location.current);
}

export function currentLocationName(state: GameState) {
  return currentLocation(state)?.name || "Unknown location";
}

export function isVisibleNpc(npc: Npc) {
  return !npc.hidden || npc.discovered || npc.companion;
}

export function primaryRouteForNpc(state: GameState, npcId: string) {
  const routes = Object.values(state.relationshipRoutes).filter((route) => route.npcId === npcId && route.active);
  const weight: RelationshipRouteState["stage"][] = ["unawakened", "met", "trust", "partiality", "follow", "enduring"];
  return routes.sort((a, b) => weight.indexOf(b.stage) - weight.indexOf(a.stage))[0];
}
