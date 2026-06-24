export type MessageRole = "dm" | "player" | "dice" | "system";
export type DrawerTab = "character" | "inventory" | "party" | "map" | "system";
export type RollMode = "normal" | "advantage" | "disadvantage";
export type PendingCheckKind = "world" | "initiative" | "combat_attack" | "combat_escape";
export type CreationMode = "origin";
export type SceneType = "temple" | "market" | "tavern" | "brothel" | "inn" | "palace";
export type ApiProvider = "openai" | "deepseek" | "custom";
export type MartialCategory = "external" | "internal";
export type MartialRole = "starter" | "pressure" | "finisher" | "defense" | "utility" | "recovery";
export type MartialTag = "break" | "guard" | "injure" | "control" | "recover" | "pierce";
export type EnemyArchetype = "brute" | "assassin" | "internalist" | "poisoner" | "defender" | "boss";
export type StudySourceKind = "manual" | "teaching" | "onsite";
export type StudyStage = "discovered" | "studying" | "mastered";
export type StudyTier = "starter" | "advanced" | "mid" | "upper_prelude" | "high_chance";
export type StudyRouteKey = "str" | "dex" | "int" | "wis";
export type StudyAccessLevel = "hint" | "study" | "manual";
export type CombatPhase = "opening" | "awaiting_hit_check" | "awaiting_damage_roll" | "resolving_enemy_response" | "ended";
export type NpcStoryState = "hidden" | "rumored" | "revealed" | "available" | "companion" | "departed";
export type LocationUnlockReason = "initial" | "quest" | "clue" | "npc";
export type RelationshipTier = "stranger" | "familiar" | "trusted" | "confidant" | "devoted";
export type RelationshipRouteKind = "bond" | "romance" | "retainer";
export type RelationshipRouteStage = "unawakened" | "met" | "trust" | "partiality" | "follow" | "enduring";
export type ThreatTier = "weak" | "normal" | "elite" | "master";
export type ExposureTier = "private" | "watched" | "crowded";
export type EconomyActionKind = "shop_list" | "buy" | "sell" | "steal";
export type OpportunityRisk = "low" | "medium" | "high";
export type OpportunityCategory = "mainline" | "training" | "relationship" | "exploration" | "trade" | "danger";
export type NamelessWandererChapterStage =
  | "tutorial_story"
  | "tutorial_combat"
  | "intro"
  | "first_assignment"
  | "track_shadow"
  | "black_assassin_fight"
  | "tea_house_followup"
  | "to_gusu"
  | "gusu_investigation"
  | "dock_infiltration"
  | "shaoshi_yanmen_prelude"
  | "xingxiu_pursuit"
  | "final_confrontation"
  | "chapter_resolved"
  | "ending_resolved";
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
  damageDice: string;
  damageBonus?: number;
  baseQiCost: number;
  source: string;
  role?: MartialRole;
  tags?: MartialTag[];
  effectText?: string;
  effect?: MartialEffect;
}

export interface MartialEffect {
  applyEnemyStatus?: string[];
  applySelfStatus?: string[];
  requireEnemyStatus?: string[];
  bonusDamageAgainstStatus?: Record<string, number>;
  qiGainOnHit?: number;
  qiDrainOnHit?: number;
  suppressEnemyFinisher?: boolean;
}

export interface InternalStyleEntry {
  artId: string;
  name: string;
  sourceItemId?: string;
  masteryLevel: number;
  practiceCount: number;
  totalQiGrowth: number;
  riskLevel: number;
}

export interface FortuneGate {
  minChaMod?: number;
  revealBonus?: number;
  upgradeOnSuccess?: boolean;
}

export interface StudyEntry {
  id: string;
  artId: string;
  name: string;
  category: MartialCategory;
  linkedAbility: string;
  sourceKind: StudySourceKind;
  stage: StudyStage;
  progress: number;
  requiredProgress: number;
  dangerous?: boolean;
  sourceLabel?: string;
  locationId?: string;
  tier?: StudyTier;
  routeKey?: StudyRouteKey;
  accessLevel?: StudyAccessLevel;
  hidden?: boolean;
  fortuneGate?: FortuneGate;
}

export interface StudySourceState {
  id: string;
  locationId: string;
  artId: string;
  name: string;
  discovered: boolean;
  portable: boolean;
  dangerous?: boolean;
  sourceLabel?: string;
  cooldownUntilActionCount?: number;
  requiresSceneRefresh?: boolean;
  refreshedSinceFailure?: boolean;
  tier?: StudyTier;
  routeKey?: StudyRouteKey;
  accessLevel?: StudyAccessLevel;
  hidden?: boolean;
  requiredProgress?: number;
  fortuneGate?: FortuneGate;
}

export interface AttributeInsight {
  id: string;
  choices: string[];
  reason?: string;
}

export interface Item {
  id: string;
  name: string;
  desc: string;
  count: number;
  type: "consumable" | "quest" | "goods" | "manual";
  value: number;
  hpRestore?: number;
  qiRestore?: number;
  innerInjuryRestore?: number;
  usable?: boolean;
  combatActionCost?: 0 | 1;
  grantsStatus?: string[];
  curesStatus?: string[];
  canSell?: boolean;
  canSteal?: boolean;
  manualArtId?: string;
  studySourceKind?: StudySourceKind;
  dangerous?: boolean;
  tier?: StudyTier;
  routeKey?: StudyRouteKey;
  accessLevel?: StudyAccessLevel;
  hidden?: boolean;
  requiredProgress?: number;
  fortuneGate?: FortuneGate;
}

export interface LocationOpportunity {
  id: string;
  title: string;
  text: string;
  actionText: string;
  category: OpportunityCategory;
  risk: OpportunityRisk;
  reward: string;
  failure: string;
  checkAbility?: string;
  timeCost?: string;
  requirement?: string;
  disabledReason?: string;
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
  silver: number;
  abilities: Ability[];
  martialArts: MartialArt[];
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
  kind?: PendingCheckKind;
  label: string;
  abilityKey?: string;
  martialArtId?: string;
  rollMode?: RollMode;
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
  isCritical?: boolean;
}

export interface Message {
  id: string;
  role: MessageRole;
  text: string;
  kind?: "story" | "combat" | "system";
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
  enemyInnerInjury?: number;
  enemyStatus?: string[];
  playerStatus?: string[];
  enemySuppressedFinisherUntilRound?: number;
  enemyPhase?: string;
  enemyIntent?: string;
  enemyArchetype?: EnemyArchetype;
  enemyPortrait?: string;
  lastCombatEvent?: string;
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

export interface MerchantStockEntry {
  itemId: string;
  count: number;
}

export interface MerchantProfile {
  npcId: string;
  locationId: string;
  stock: MerchantStockEntry[];
  buyFromPlayerMultiplier: number;
  sellToPlayerMultiplier: number;
  greetingText?: string;
}

export interface StealPocketEntry {
  itemId: string;
  count: number;
}

export interface StealProfile {
  npcId: string;
  threatTier: ThreatTier;
  pocketSilver: number;
  pocketItems: StealPocketEntry[];
  exposure?: ExposureTier;
  failureRelationshipPenalty: number;
  failureLocksTradeUntilNextDay?: boolean;
  failureCombatEnemyId?: string;
  enemyPresetId?: string;
}

export interface ProposedWorldAction {
  kind: EconomyActionKind;
  npcId?: string;
  itemId?: string;
  itemName?: string;
  quantity?: number;
  abilityKey?: string;
  dc?: number;
  rollMode?: RollMode;
  reason?: string;
}

export interface PendingEconomyAction {
  kind: "steal";
  npcId: string;
  npcName: string;
  targetType: "silver" | "item";
  itemId?: string;
  itemName?: string;
  quantity: number;
  rewardSilver: number;
  rewardItem?: Item;
  threatTier: ThreatTier;
  exposure: ExposureTier;
  dc: number;
  rollMode: RollMode;
  reason: string;
  failureRelationshipPenalty: number;
  failureLocksTradeUntilNextDay?: boolean;
  failureCombatEnemyId?: string;
  fromMerchant?: boolean;
}

export interface StolenNpcStateEntry {
  silverTaken: number;
  itemCounts: Record<string, number>;
}

export interface EconomyState {
  merchantStocks: Record<string, Record<string, number>>;
  merchantBlockedUntilDay: Record<string, number>;
  stolenNpcState: Record<string, StolenNpcStateEntry>;
  pendingAction?: PendingEconomyAction;
}

export interface AiProposalPayload {
  systemNote?: string;
  sceneType?: SceneType;
  proposedCheck?: Partial<PendingCheck> & { label: string; dc: number; reason?: string };
  proposedHooks?: AiProposalHook[];
  proposedRumors?: AiProposalHook[];
  proposedNpcReactions?: AiProposalNpcReaction[];
  proposedWorldAction?: ProposedWorldAction;
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
  pendingStudies: StudyEntry[];
  studySources: StudySourceState[];
  cultivationRank: number;
  internalStyles: InternalStyleEntry[];
  activeInternalArtId?: string;
  qiGrowthBonus: number;
  qiBreakthroughCap: number;
  qiTrainingProgress: number;
  availableAttributeInsights: AttributeInsight[];
  relationshipRoutes: Record<string, RelationshipRouteState>;
  economy: EconomyState;
}

export interface GamePatch {
  hpChange?: number;
  qiChange?: number;
  qiMaxChange?: number;
  qiGrowthBonusChange?: number;
  qiBreakthroughCapChange?: number;
  qiTrainingProgressChange?: number;
  cultivationRankChange?: number;
  internalStyleUpdate?: InternalStyleEntry;
  activeInternalArtId?: string;
  qiRecovery?: number;
  innerInjuryChange?: number;
  acChange?: number;
  silverChange?: number;
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
    enemyInnerInjuryChange?: number;
    enemyStatusAdd?: string[];
    enemyStatusRemove?: string[];
    playerStatusAdd?: string[];
    playerStatusRemove?: string[];
    enemySuppressedFinisherUntilRound?: number;
    enemyPhase?: string;
    enemyIntent?: string;
    lastCombatEvent?: string;
    enemyMartialArtUsed?: string;
    enemyQiCost?: number;
    phase?: CombatPhase;
    roundDelta?: number;
    stakes?: string;
  };
  newItem?: Partial<Item>;
  removeItemId?: string;
  itemChanges?: Array<{
    itemId?: string;
    name?: string;
    delta: number;
    item?: Partial<Item> & { name: string };
  }>;
  economyUpdate?: {
    merchantStocks?: Record<string, Record<string, number>>;
    merchantBlockedUntilDay?: Record<string, number>;
    stolenNpcState?: Record<string, StolenNpcStateEntry>;
    pendingAction?: PendingEconomyAction | null;
  };
  relationshipChanges?: Array<{ npcId?: string; name?: string; delta?: number; value?: number; attitude?: string }>;
  npcUpdates?: Array<Partial<Npc> & { id?: string; name?: string }>;
  questUpdates?: Array<Partial<Quest> & { id?: string; title?: string }>;
  systemNote?: string;
  sceneType?: SceneType;
  objectiveUpdate?: Partial<ObjectiveHint>;
  pendingCheck?: Partial<PendingCheck> & { label: string; dc: number; reason?: string };
  pendingDamage?: Partial<PendingDamage> & { martialArtId: string; label: string; damageDice: string; hitText: string };
  martialArtLearned?: Partial<MartialArt> & { name: string };
  martialArtUpdates?: Array<Partial<MartialArt> & { id?: string; name?: string }>;
  studyAdd?: StudyEntry[];
  studyUpdate?: Array<Partial<StudyEntry> & { id: string }>;
  studyRemoveIds?: string[];
  studySourceAdd?: StudySourceState[];
  studySourceUpdate?: Array<Partial<StudySourceState> & { id: string }>;
  attributeInsightAdd?: AttributeInsight[];
  attributeInsightRemoveIds?: string[];
  chapterStateUpdate?: Partial<ChapterState>;
  storyFlagsAdd?: string[];
  storyFlagsRemove?: string[];
  questStateUpdates?: QuestStateNode[];
  locationUnlockUpdates?: Array<{ locationId?: string; name?: string; reason: LocationUnlockReason }>;
  npcStoryUpdates?: Array<{ npcId?: string; name?: string; state: NpcStoryState }>;
  rumorAdd?: Array<Partial<Rumor> & { text: string }>;
  relationshipRouteUpdates?: Array<Partial<RelationshipRouteState> & { npcId?: string; name?: string }>;
}
