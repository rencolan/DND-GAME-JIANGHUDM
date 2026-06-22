import type { Character } from "../types";
import { originTemplates } from "./origins";
import { makeCharacter } from "./shared";

export const roster: Character[] = [
  makeCharacter(
    "placeholder-dali",
    "无名少侠",
    "无名客，初入江湖",
    [10, 10, 10, 10, 10, 10],
    2,
    originTemplates[0].martialArts,
    { originId: originTemplates[0].id, isCustom: true }
  )
];
