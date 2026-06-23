import type { GameState } from "../../types";
import type { MessageVisualContext } from "./types";

export function buildMessageVisualContext(game: GameState, currentLocationName: string): MessageVisualContext {
  return {
    npcs: game.npcs,
    locations: game.locations,
    sceneType: game.sceneType,
    currentLocationName
  };
}
