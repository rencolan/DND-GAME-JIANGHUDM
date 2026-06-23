import type { Message, Npc } from "../../types";
import { sceneLabels } from "../display";
import { locationSceneVisuals, npcVisualAliases, sceneTypeVisuals } from "./visualRegistry";
import type { MessageVisual, MessageVisualContext } from "./types";

const MAX_VISUALS_PER_MESSAGE = 2;

function canRenderForMessage(message: Message) {
  return message.role !== "player" && message.text.trim().length > 0;
}

function isVisibleNpc(npc: Npc) {
  return !npc.hidden || npc.discovered || npc.companion;
}

function textIncludesAny(text: string, values: string[]) {
  return values.some((value) => value && text.includes(value));
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function npcAliases(npc: Npc) {
  return [npc.name, npc.title, ...(npcVisualAliases[npc.id] || [])].filter(Boolean);
}

function npcToVisual(npc: Npc): MessageVisual {
  return {
    id: `npc:${npc.id}`,
    kind: "npc",
    title: npc.name,
    subtitle: npc.title,
    caption: npc.status || npc.goal,
    src: npc.portrait,
    alt: `${npc.name}立绘`
  };
}

function isNpcSpeech(text: string, npc: Npc) {
  return npcAliases(npc).some((alias) => {
    const name = escapeRegExp(alias);
    return new RegExp(`${name}.{0,12}(说|道|问|答|喊|叫|提醒|开口|叹道|笑道|喝道|冷声|柔声|低声|轻声|：|:)`).test(text)
      || new RegExp(`["“「『].{0,40}["”」』].{0,8}${name}(说|道|问|答)`).test(text);
  });
}

function resolveNpcVisuals(text: string, context: MessageVisualContext): MessageVisual[] {
  return context.npcs
    .filter((npc) => isVisibleNpc(npc) && Boolean(npc.portrait))
    .filter((npc) => textIncludesAny(text, npcAliases(npc)))
    .map(npcToVisual);
}

function resolveLocationVisual(text: string, context: MessageVisualContext): MessageVisual | undefined {
  const byMentionedLocation = context.locations.find((location) =>
    location.unlocked
    && textIncludesAny(text, [location.name, ...(locationSceneVisuals[location.id]?.aliases || [])])
  );
  const currentLocation = context.locations.find((location) => location.name === context.currentLocationName);
  const targetLocation = byMentionedLocation || (text.includes(context.currentLocationName) ? currentLocation : undefined);
  if (!targetLocation) return undefined;

  const visual = locationSceneVisuals[targetLocation.id] || sceneTypeVisuals[context.sceneType];
  return {
    id: `scene:${targetLocation.id}`,
    kind: "scene",
    title: visual.title || targetLocation.name,
    subtitle: visual.subtitle,
    caption: visual.caption || targetLocation.desc,
    src: visual.src,
    alt: visual.alt || `${targetLocation.name}场景`
  };
}

function resolveSceneTypeVisual(text: string, context: MessageVisualContext): MessageVisual | undefined {
  const scene = sceneTypeVisuals[context.sceneType];
  const aliases = [sceneLabels[context.sceneType], ...scene.aliases];
  if (!textIncludesAny(text, aliases)) return undefined;

  return {
    id: `scene-type:${context.sceneType}`,
    kind: "scene",
    title: scene.title,
    subtitle: scene.subtitle,
    caption: scene.caption,
    src: scene.src,
    alt: scene.alt
  };
}

export function resolveMessageVisuals(message: Message, context: MessageVisualContext): MessageVisual[] {
  if (!canRenderForMessage(message)) return [];

  const visuals: MessageVisual[] = [
    ...resolveNpcVisuals(message.text, context),
    resolveLocationVisual(message.text, context),
    resolveSceneTypeVisual(message.text, context)
  ].filter((visual): visual is MessageVisual => Boolean(visual));

  const uniqueVisuals = visuals.filter((visual, index) =>
    visuals.findIndex((candidate) => candidate.id === visual.id) === index
  );

  return uniqueVisuals.slice(0, MAX_VISUALS_PER_MESSAGE);
}

export function resolveMessageSpeakerVisual(message: Message, context: MessageVisualContext): MessageVisual | undefined {
  if (!canRenderForMessage(message)) return undefined;

  const speaker = context.npcs.find((npc) =>
    isVisibleNpc(npc)
    && Boolean(npc.portrait)
    && textIncludesAny(message.text, npcAliases(npc))
    && isNpcSpeech(message.text, npc)
  );

  return speaker ? npcToVisual(speaker) : undefined;
}
