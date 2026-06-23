import type { Item, MartialArt } from "../../types";
import type { MessageVisualContext } from "../visuals/types";

export type LoreEntityKind = "npc" | "location" | "martial" | "manual" | "scene";

export type LoreEntity = {
  id: string;
  kind: LoreEntityKind;
  name: string;
  aliases: string[];
  title?: string;
  subtitle?: string;
  description?: string;
  image?: string;
  fields?: Array<{ label: string; value: string }>;
  relatedArt?: MartialArt;
  relatedItem?: Item;
};

export type LoreEntityContext = MessageVisualContext;

export type LoreTextPart =
  | { kind: "text"; text: string }
  | { kind: "entity"; text: string; entity: LoreEntity };
