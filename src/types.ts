export type MessageRole = "dm" | "player" | "dice" | "system";
export type DrawerTab = "character" | "inventory" | "party" | "map" | "system";
export type RollMode = "normal" | "advantage" | "disadvantage";
export type CreationMode = "origin";
export type SceneType = "temple" | "market" | "tavern" | "brothel" | "inn" | "palace";
export type ApiProvider = "openai" | "deepseek" | "custom";
export type MartialCategory = "external" | "internal";

export interface Ability {
  key: string;
  label: string;
  value: number;
}

export interface MartialArt {
  id: string;
  name: string;
  grade: string;
  category: MartialCategory;
  linkedAbility: string;
  effect: string;
  damageDice: string;
  damageBonus?: number;
  baseQiCost: number;
  risk: string;
  source: string;
}

export interface Item {
  id: string;
  name: string;
  desc: string;
  count: number;
  type?: "weapon" | "armor" | "accessory" | "consumable" | "quest";
  hpRestore?: number;
  qiRestore?: number;
  equipable?: boolean;
  usable?: boolean;
}

export interface Equipment {
  weapon: Item;
  armor: Item;
  accessory: Item;
}

export interface Character {
  id: string;
  name: string;
  title: string;
  portrait: string;
  hp: number;
  maxHp: number;
  qi: number;
  maxQi: number;
  ac: number;
  abilities: Ability[];
  martialArts: MartialArt[];
  equipment: Equipment;
  inventory: Item[];
  originId?: string;
  isCustom?: boolean;
}

export interface OriginTemplate {
  id: string;
  name: string;
  desc: string;
  qiStart: number;
  intro: string;
  setupHint: string;
  firstQuest: {
    title: string;
    text: string;
    location: string;
    npc?: string;
  };
  equipmentNames: [string, string, string];
  openingItem?: Item;
  martialArts: MartialArt[];
}

export interface Npc {
  id: string;
  name: string;
  title: string;
  portrait: string;
  location: string;
  goal: string;
  attitude: string;
  relationship: number;
  lastSeen: string;
  status: string;
  tags: string[];
  companion: boolean;
  hidden?: boolean;
  discovered?: boolean;
  recruitable?: boolean;
}

export interface LocationNode {
  id: string;
  name: string;
  x: number;
  y: number;
  unlocked: boolean;
  current?: boolean;
  desc: string;
}

export interface Quest {
  id: string;
  title: string;
  text: string;
  status: "active" | "resolved" | "hidden";
}

export interface ObjectiveHint {
  title: string;
  text: string;
  location?: string;
  npc?: string;
}

export interface PendingCheck {
  id: string;
  label: string;
  abilityKey?: string;
  martialArtId?: string;
  dc: number;
  reason: string;
  risk?: string;
  enemyIntent?: string;
  suggestedAction?: string;
}

export interface Message {
  id: string;
  role: MessageRole;
  text: string;
}

export interface CombatState {
  active: boolean;
  enemy?: string;
  enemyHp?: number;
  enemyMaxHp?: number;
  enemyQi?: number;
  enemyMaxQi?: number;
  enemyAc?: number;
  enemyAbilities?: Ability[];
  enemyMartialArts?: MartialArt[];
  enemyStatus?: string[];
}

export interface ApiConfig {
  provider: ApiProvider;
  apiUrl: string;
  apiKey: string;
  model: string;
}

export interface GameState {
  setupComplete: boolean;
  originId?: string;
  creationMode?: CreationMode;
  chapter: string;
  worldDay: number;
  timeSlot: string;
  actionCount: number;
  currentCharacterId: string;
  character: Character;
  roster: Character[];
  npcs: Npc[];
  locations: LocationNode[];
  quests: Quest[];
  messages: Message[];
  combat: CombatState;
  systemLog: string[];
  sceneType: SceneType;
  objective: ObjectiveHint;
  pendingCheck?: PendingCheck;
  innerInjury?: number;
}

export interface GamePatch {
  hpChange?: number;
  qiChange?: number;
  qiMaxChange?: number;
  qiRecovery?: number;
  innerInjuryChange?: number;
  acChange?: number;
  abilityChanges?: Record<string, number>;
  location?: string;
  timeSlot?: string;
  chapter?: string;
  combatAction?: "enter" | "exit" | "none";
  enemyName?: string;
  combatUpdate?: {
    enemyHpChange?: number;
    enemyQiChange?: number;
    enemyAcChange?: number;
    enemyStatusAdd?: string[];
    enemyStatusRemove?: string[];
    enemyMartialArtUsed?: string;
    enemyQiCost?: number;
  };
  newItem?: Partial<Item>;
  removeItemId?: string;
  relationshipChanges?: Array<{ npcId?: string; name?: string; delta?: number; value?: number; attitude?: string }>;
  npcUpdates?: Array<Partial<Npc> & { id?: string; name?: string }>;
  questUpdates?: Array<Partial<Quest> & { id?: string; title?: string }>;
  systemNote?: string;
  sceneType?: SceneType;
  objectiveUpdate?: Partial<ObjectiveHint>;
  pendingCheck?: Partial<PendingCheck> & { label: string; dc: number; reason?: string };
  martialArtLearned?: Partial<MartialArt> & { name: string };
  martialArtUpdates?: Array<Partial<MartialArt> & { id?: string; name?: string }>;
}
