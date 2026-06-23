import type { LocationNode, Message, Npc, SceneType } from "../../types";

export type MessageVisualKind = "npc" | "scene";

export type MessageVisual = {
  id: string;
  kind: MessageVisualKind;
  title: string;
  subtitle?: string;
  caption?: string;
  src: string;
  alt: string;
};

export type MessageVisualContext = {
  npcs: Npc[];
  locations: LocationNode[];
  sceneType: SceneType;
  currentLocationName: string;
};

export type MessageVisualResolver = (message: Message, context: MessageVisualContext) => MessageVisual[];
