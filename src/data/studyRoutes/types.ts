import type {
  FortuneGate,
  GamePatch,
  GameState,
  StudyAccessLevel,
  StudyRouteKey,
  StudySourceKind,
  StudyTier
} from "../../types";

export type StudyRouteDefinition = {
  id: string;
  artId?: string;
  name: string;
  locationId: string;
  routeKey: StudyRouteKey;
  tier: StudyTier;
  accessLevel: StudyAccessLevel;
  sourceKind?: StudySourceKind;
  sourceLabel?: string;
  keywords: string[];
  text: string;
  systemNote: string;
  portable?: boolean;
  dangerous?: boolean;
  hidden?: boolean;
  requiredProgress?: number;
  chapterGate?: string;
  prerequisiteArts?: string[];
  prerequisiteFlags?: string[];
  fortuneGate?: FortuneGate;
  hintText?: string;
  hintNote?: string;
  requires?: (state: GameState) => boolean;
  extraPatch?: GamePatch;
};
