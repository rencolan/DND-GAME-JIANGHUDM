export type MessageRole = "dm" | "player" | "dice" | "system";
export type DrawerTab = "character" | "inventory" | "party" | "map" | "system";
export type RollMode = "normal" | "advantage" | "disadvantage";
export type CreationMode = "origin";
export type SceneType = "temple" | "market" | "tavern" | "brothel" | "inn" | "palace";
export type ApiProvider = "openai" | "deepseek" | "custom";
export type MartialCategory = "external" | "internal";
export type CombatPhase = "opening" | "awaiting_hit_check" | "awaiting_damage_roll" | "resolving_enemy_response" | "ended";
export type NpcStoryState = "hidden" | "rumored" | "revealed" | "available" | "companion" | "departed";
export type LocationUnlockReason = "initial" | "quest" | "clue" | "npc";
export type RelationshipTier = "stranger" | "familiar" | "trusted" | "confidant" | "devoted";
export type RelationshipRouteKind = "bond" | "romance" | "retainer";
export type RelationshipRouteStage = "unawakened" | "met" | "trust" | "partiality" | "follow" | "enduring";
export type NamelessWandererChapterStage =
  | "intro"
  | "first_assignment"
  | "track_shadow"
  | "black_assassin_fight"
  | "tea_house_followup"
  | "to_gusu"
  | "gusu_investigation"
  | "dock_infiltration"
  | "chapter_resolved";
export type LocalStoryTrigger =
  | "onFirstAction"
  | "onQuestResolved"
  | "onCombatWin"
  | "onArrive"
  | "onUseClue"
  | "onStoryCheckPassed"
  | "onStoryCheckFailed";

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

export interface ChapterState {
  id: string;
  stage: string;
}

export interface QuestStateNode {
  id: string;
  status: Quest["status"];
  stage?: string;
}

export interface Rumor {
  id: string;
  text: string;
  kind?: "rumor" | "hook" | "npc_lead" | "location_lead";
  location?: string;
  npc?: string;
  source?: string;
  discoveredDay?: number;
  consumed?: boolean;
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

export interface PendingDamage {
  id: string;
  martialArtId: string;
  label: string;
  damageDice: string;
  damageBonus?: number;
  qiCost: number;
  qiBonusSpend: number;
  hitText: string;
}

export interface Message {
  id: string;
  role: MessageRole;
  text: string;
}

export interface CombatState {
  active: boolean;
  combatId?: string;
  round?: number;
  phase?: CombatPhase;
  stakes?: string;
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

export interface AiProposalHook {
  id?: string;
  text: string;
  kind?: Rumor["kind"];
  location?: string;
  npc?: string;
}

export interface AiProposalNpcReaction {
  name: string;
  attitude?: string;
  status?: string;
  note?: string;
}

export interface AiProposalPayload {
  systemNote?: string;
  sceneType?: SceneType;
  proposedCheck?: Partial<PendingCheck> & { label: string; dc: number; reason?: string };
  proposedHooks?: AiProposalHook[];
  proposedRumors?: AiProposalHook[];
  proposedNpcReactions?: AiProposalNpcReaction[];
}

export interface RelationshipRouteState {
  npcId: string;
  kind: RelationshipRouteKind;
  active: boolean;
  stage: RelationshipRouteStage;
  allowCompanion?: boolean;
  supportUnlocked?: string[];
  note?: string;
}

export interface GameState {
  setupComplete: boolean;
  originId?: string;
  creationMode?: CreationMode;
  chapter: string;
  chapterState: ChapterState;
  storyFlags: string[];
  worldDay: number;
  timeSlot: string;
  actionCount: number;
  currentCharacterId: string;
  character: Character;
  roster: Character[];
  npcs: Npc[];
  npcStoryState: Record<string, NpcStoryState>;
  locations: LocationNode[];
  locationUnlocks: Record<string, LocationUnlockReason>;
  quests: Quest[];
  questStateMap: Record<string, QuestStateNode>;
  rumors: Rumor[];
  messages: Message[];
  combat: CombatState;
  systemLog: string[];
  sceneType: SceneType;
  objective: ObjectiveHint;
  pendingCheck?: PendingCheck;
  pendingDamage?: PendingDamage;
  innerInjury?: number;
  relationshipRoutes: Record<string, RelationshipRouteState>;
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
    phase?: CombatPhase;
    roundDelta?: number;
    stakes?: string;
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
  chapterStateUpdate?: Partial<ChapterState>;
  storyFlagsAdd?: string[];
  storyFlagsRemove?: string[];
  questStateUpdates?: QuestStateNode[];
  locationUnlockUpdates?: Array<{ locationId?: string; name?: string; reason: LocationUnlockReason }>;
  npcStoryUpdates?: Array<{ npcId?: string; name?: string; state: NpcStoryState }>;
  rumorAdd?: Array<Partial<Rumor> & { text: string }>;
  relationshipRouteUpdates?: Array<Partial<RelationshipRouteState> & { npcId?: string; name?: string }>;
}
