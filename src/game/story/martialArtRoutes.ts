import { martialArtCatalog } from "../../data";
import { ladderLabels, routeFlag, routeHintFlag, studySourceRegistry, type StudyRouteDefinition } from "../../data/studyRoutes";
import { abilityModifierFromList } from "../rules";
import type { GamePatch, GameState, StudySourceKind, StudyTier } from "../../types";

export type MartialArtStoryResolution = {
  text: string;
  patch: GamePatch;
};

function currentLocationId(state: GameState) {
  return state.locations.find((location) => location.current)?.id;
}

function hasStoryFlag(state: GameState, flag: string) {
  return state.storyFlags.includes(flag);
}

function hasMartialArt(state: GameState, artId: string) {
  return state.character.martialArts.some((art) => art.id === artId);
}

function hasPendingStudy(state: GameState, artId: string) {
  return state.pendingStudies.some((entry) => entry.artId === artId);
}

function hasStudySource(state: GameState, artId: string) {
  return state.studySources.some((source) => source.artId === artId);
}

function matchKeywords(action: string, keywords: string[]) {
  return keywords.some((keyword) => action.includes(keyword));
}

function findArtTemplate(artId: string) {
  return martialArtCatalog.find((entry) => entry.id === artId || entry.name === artId);
}

function tierProgressDefault(tier: StudyTier) {
  if (tier === "upper_prelude") return 4;
  if (tier === "high_chance") return 5;
  return 3;
}

function routeLadderSummary(route: StudyRouteDefinition) {
  return ladderLabels.get(`${route.routeKey}:${route.tier}`) || route.name;
}

function meetsChapterGate(state: GameState, route: StudyRouteDefinition) {
  return !route.chapterGate || hasStoryFlag(state, route.chapterGate);
}

function meetsArtPrerequisites(state: GameState, route: StudyRouteDefinition) {
  return (route.prerequisiteArts || []).every((artId) => hasMartialArt(state, artId));
}

function meetsFlagPrerequisites(state: GameState, route: StudyRouteDefinition) {
  return (route.prerequisiteFlags || []).every((flag) => hasStoryFlag(state, flag));
}

function meetsFortuneGate(state: GameState, route: StudyRouteDefinition) {
  if (!route.fortuneGate?.minChaMod) return true;
  return abilityModifierFromList(state.character.abilities, "cha") >= route.fortuneGate.minChaMod;
}

function effectiveSourceKind(route: StudyRouteDefinition): StudySourceKind {
  if (route.accessLevel === "manual") return "manual";
  return route.sourceKind || "onsite";
}

function buildHintPatch(route: StudyRouteDefinition): GamePatch {
  const ladder = routeLadderSummary(route);
  return {
    storyFlagsAdd: [routeHintFlag(route.id)],
    rumorAdd: [
      {
        text: `${route.name} 的门径只露出了一线。你眼下只摸到了 ${ladder} 的影子，还差更深的机缘才能真正下手。`,
        kind: "hook",
        location: route.locationId,
        source: "martial-hint"
      }
    ],
    systemNote: route.hintNote || `你先记下了 ${route.name} 的线索。`,
    ...(route.extraPatch || {})
  };
}

function buildSourcePatch(route: StudyRouteDefinition): GamePatch {
  const sourceKind = effectiveSourceKind(route);
  const art = route.artId ? findArtTemplate(route.artId) : undefined;
  const requiredProgress = route.requiredProgress || tierProgressDefault(route.tier);

  if (!route.artId || route.accessLevel === "hint") {
    return buildHintPatch(route);
  }

  const manualName = route.portable
    ? `${route.name}${route.fortuneGate?.upgradeOnSuccess ? "注解残卷" : "秘笈"}`
    : undefined;

  return {
    ...(route.accessLevel === "study"
      ? sourceKind === "teaching"
        ? {
          studyAdd: [
            {
              id: `study:${route.artId}`,
              artId: route.artId,
              name: route.name,
              category: art?.category || "external",
              linkedAbility: art?.linkedAbility || "int",
              sourceKind: "teaching",
              stage: "discovered",
              progress: 0,
              requiredProgress,
              dangerous: route.dangerous,
              sourceLabel: route.sourceLabel || "前辈点拨",
              locationId: route.locationId,
              tier: route.tier,
              routeKey: route.routeKey,
              accessLevel: route.accessLevel,
              hidden: route.hidden,
              fortuneGate: route.fortuneGate
            }
          ]
        }
        : {
          studySourceAdd: [
            {
              id: `source:${route.artId}`,
              locationId: route.locationId,
              artId: route.artId,
              name: route.name,
              discovered: true,
              portable: route.portable ?? false,
              dangerous: route.dangerous,
              sourceLabel: route.sourceLabel || "现场参悟",
              tier: route.tier,
              routeKey: route.routeKey,
              accessLevel: route.accessLevel,
              hidden: route.hidden,
              requiredProgress,
              fortuneGate: route.fortuneGate
            }
          ]
        }
      : {
        itemChanges: [
          {
            itemId: `manual:${route.artId}`,
            delta: 1,
            item: {
              id: `manual:${route.artId}`,
              name: manualName || `${route.name}秘笈`,
              desc: `记着 ${route.name} 的门路，需要继续研读才能真正上手。`,
              count: 1,
              type: "manual",
              value: 0,
              manualArtId: route.artId,
              studySourceKind: sourceKind === "teaching" ? "teaching" : "manual",
              dangerous: route.dangerous,
              canSell: false,
              requiredProgress,
              tier: route.tier,
              routeKey: route.routeKey,
              accessLevel: route.accessLevel,
              hidden: route.hidden,
              fortuneGate: route.fortuneGate
            }
          }
        ]
      }),
    storyFlagsAdd: [routeFlag(route.id)],
    systemNote: route.systemNote,
    ...(route.extraPatch || {})
  };
}

export function buildStudyRouteReward(state: GameState, routeId: string, options: { force?: boolean } = {}): GamePatch | undefined {
  const route = studySourceRegistry.find((entry) => entry.id === routeId);
  if (!route) return undefined;
  if (route.artId && hasMartialArt(state, route.artId)) return undefined;
  if (route.artId && (hasPendingStudy(state, route.artId) || hasStudySource(state, route.artId))) return undefined;
  if (hasStoryFlag(state, routeFlag(route.id))) return undefined;
  if (route.accessLevel === "hint" && hasStoryFlag(state, routeHintFlag(route.id))) return undefined;

  if (!options.force) {
    if (!meetsChapterGate(state, route)) return undefined;
    if (!meetsArtPrerequisites(state, route)) return undefined;
    if (!meetsFlagPrerequisites(state, route)) return undefined;
    if (route.requires && !route.requires(state)) return undefined;
    if (route.hidden && !meetsFortuneGate(state, route)) return buildHintPatch(route);
  }

  return buildSourcePatch(route);
}

export function resolveMartialArtStoryAction(state: GameState, action: string): MartialArtStoryResolution | undefined {
  const locationId = currentLocationId(state);
  if (!locationId) return undefined;

  for (const route of studySourceRegistry) {
    if (route.locationId !== locationId) continue;
    if (route.artId && hasMartialArt(state, route.artId)) continue;
    if (route.artId && (hasPendingStudy(state, route.artId) || hasStudySource(state, route.artId))) continue;
    if (hasStoryFlag(state, routeFlag(route.id))) continue;
    if (route.accessLevel === "hint" && hasStoryFlag(state, routeHintFlag(route.id))) continue;
    if (!matchKeywords(action, route.keywords)) continue;
    if (!meetsChapterGate(state, route)) continue;
    if (!meetsArtPrerequisites(state, route)) continue;
    if (!meetsFlagPrerequisites(state, route)) continue;
    if (route.requires && !route.requires(state)) continue;

    if (route.hidden && !meetsFortuneGate(state, route)) {
      if (hasStoryFlag(state, routeHintFlag(route.id))) continue;
      return {
        text: route.hintText || route.text,
        patch: buildHintPatch(route)
      };
    }

    return {
      text: route.text,
      patch: buildSourcePatch(route)
    };
  }

  return undefined;
}
