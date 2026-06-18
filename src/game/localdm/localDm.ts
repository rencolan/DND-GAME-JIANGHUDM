import type { GameState } from "../../types";
import { resolveWorldAction } from "../world";
import { buildLocalDmNarration } from "./narration";

export function localDm(action: string, state: GameState, globalUpdate: boolean) {
  const result = resolveWorldAction(action, state, globalUpdate);
  return {
    text: buildLocalDmNarration(result),
    patch: result.patch,
    result
  };
}
