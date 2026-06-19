import { Dices, Send, User } from "lucide-react";
import { type CSSProperties, type FormEvent, useMemo } from "react";
import { doubleDamageDice } from "../../game/combat";
import { abilityModifier } from "../../game/rules";
import { currentLocationName, isVisibleNpc, primaryRouteForNpc } from "../../game/world";
import type { DrawerTab } from "../../types";
import { sceneAssets } from "../display";
import type { GameSession } from "../useGameSession";
import { AppHeader } from "./AppHeader";
import { CharacterTab } from "./CharacterTab";
import { ChatLog } from "./ChatLog";
import { CompanionsTab } from "./CompanionsTab";
import { DicePanel } from "./DicePanel";
import { DiceRollOverlay } from "./DiceRollOverlay";
import { DrawerPanel } from "./DrawerPanel";
import { EnemyCard } from "./EnemyCard";
import { InventoryTab } from "./InventoryTab";
import { MapTab } from "./MapTab";
import { ObjectiveCard } from "./ObjectiveCard";
import { PendingCheckCard } from "./PendingCheckCard";
import { SystemTab } from "./SystemTab";

const BGM_SRC = "../assets/bgm/Seven_Peaks_at_Twilight.mp3";

type GameScreenProps = {
  session: GameSession;
};

export function GameScreen({ session }: GameScreenProps) {
  const {
    game,
    api,
    setApi,
    input,
    setInput,
    rollMode,
    setRollMode,
    drawerOpen,
    setActiveTab,
    activeTab,
    diceOpen,
    qiInvest,
    setQiInvest,
    selectedLocationId,
    setSelectedLocationId,
    selectedInventoryMartialId,
    setSelectedInventoryMartialId,
    selectedAbilityInfoKey,
    setSelectedAbilityInfoKey,
    busy,
    apiTest,
    musicEnabled,
    bgmVolume,
    setBgmVolume,
    uiLocked,
    endRef,
    fileInputRef,
    audioRef,
    canContinue,
    closePanels,
    applyDeepSeekPreset,
    toggleMusic,
    runApiTest,
    continueGame,
    exportSave,
    resetGame,
    beginTutorialCombat,
    skipTutorial,
    submitAction,
    importSave,
    startOriginGame,
    openDrawer,
    openPendingCheck,
    toggleDice,
    switchScene,
    travelToLocation,
    useItem,
    rollDice,
    rollDamageDice
  } = session;

  const panelOpen = drawerOpen || diceOpen;
  const locationName = currentLocationName(game);
  const visibleNpcs = useMemo(() => game.npcs.filter(isVisibleNpc), [game.npcs]);
  const companions = useMemo(() => visibleNpcs.filter((npc) => npc.companion), [visibleNpcs]);
  const activeRelationshipNpcs = useMemo(() => visibleNpcs.filter((npc) => primaryRouteForNpc(game, npc.id)), [game, visibleNpcs]);
  const selectedLocation = game.locations.find((location) => location.id === selectedLocationId)
    || game.locations.find((location) => location.current)
    || game.locations[0];
  const sceneBackground = sceneAssets[game.sceneType] || sceneAssets.market;
  const qiLimit = Math.min(6, game.character.qi);
  const lowQi = game.character.qi <= 1;
  const tutorialActive = game.chapterState.stage === "tutorial_story" || game.chapterState.stage === "tutorial_combat";
  const tutorialCombatActive = game.chapterState.stage === "tutorial_combat";
  const tutorialStoryActive = tutorialActive && !tutorialCombatActive;
  const currentCheck = game.pendingCheck;
  const pendingDamage = game.pendingDamage;
  const combatInitiative = game.combat.active && game.combat.phase === "opening";
  const combatAttack = game.combat.active && game.combat.phase === "awaiting_hit_check";
  const awaitingDamage = Boolean(pendingDamage);
  const controlsBlocked = uiLocked || Boolean(session.rolling);
  const dexAbility = game.character.abilities.find((ability) => ability.key === "dex");
  const pendingDamageDice = pendingDamage
    ? (pendingDamage.isCritical ? doubleDamageDice(pendingDamage.damageDice) : pendingDamage.damageDice)
    : undefined;
  const pendingCheckTag = combatInitiative ? "待先攻" : combatAttack ? "待攻击" : "待判定";
  const pendingCheckReason = combatInitiative
    ? "先攻固定掷身法（DEX）。胜则你先出手，败则敌方先动。"
    : combatAttack
      ? "先做命中判定；命中后再掷伤害。d20=20 暴击，d20=1 必失手。"
      : currentCheck?.reason;
  const pendingCheckAction = combatInitiative ? "掷先攻" : combatAttack ? "掷攻击" : "进行判定";

  const effectivePendingCheckReason = currentCheck?.reason || pendingCheckReason;
  const appStyle = {
    "--scene-bg": `url("${sceneBackground}")`
  } as CSSProperties;

  let drawerContent: JSX.Element | null = null;
  if (activeTab === "character") {
    drawerContent = (
      <CharacterTab
        game={game}
        selectedAbilityInfoKey={selectedAbilityInfoKey}
        setSelectedAbilityInfoKey={setSelectedAbilityInfoKey}
        activeRelationshipNpcs={activeRelationshipNpcs}
      />
    );
  } else if (activeTab === "inventory") {
    drawerContent = (
      <InventoryTab
        game={game}
        selectedInventoryMartialId={selectedInventoryMartialId}
        setSelectedInventoryMartialId={setSelectedInventoryMartialId}
        useItem={useItem}
      />
    );
  } else if (activeTab === "party") {
    drawerContent = (
      <CompanionsTab
        game={game}
        companions={companions}
        activeRelationshipNpcs={activeRelationshipNpcs}
      />
    );
  } else if (activeTab === "map") {
    drawerContent = (
      <MapTab
        game={game}
        locationName={locationName}
        selectedLocation={selectedLocation}
        visibleNpcs={visibleNpcs}
        setSelectedLocationId={(value) => setSelectedLocationId(value)}
        switchScene={switchScene}
        travelToLocation={travelToLocation}
      />
    );
  } else {
    drawerContent = (
      <SystemTab
        api={api}
        setApi={setApi}
        applyDeepSeekPreset={applyDeepSeekPreset}
        runApiTest={runApiTest}
        apiTest={apiTest}
        exportSave={exportSave}
        resetGame={resetGame}
        importSave={importSave}
        fileInputRef={fileInputRef}
        toggleMusic={toggleMusic}
        musicEnabled={musicEnabled}
        bgmVolume={bgmVolume}
        setBgmVolume={setBgmVolume}
      />
    );
  }

  return (
    <main className={`app ${game.combat.active ? "combat" : ""}`} style={appStyle}>
      <audio ref={audioRef} src={BGM_SRC} preload="auto" loop />
      {uiLocked && <div className="ui-lock-shield" aria-hidden="true" />}

      <AppHeader
        chapter={game.chapter}
        locationName={locationName}
        worldDay={game.worldDay}
        timeSlot={game.timeSlot}
        sceneType={game.sceneType}
        character={game.character}
      />

      <ChatLog messages={game.messages} busy={busy} endRef={endRef}>
        <ObjectiveCard
          objective={game.objective}
          locationName={locationName}
          tutorialActive={tutorialActive}
          tutorialStoryActive={tutorialStoryActive}
          controlsBlocked={controlsBlocked}
          busy={busy}
          onBeginTutorialCombat={beginTutorialCombat}
          onSkipTutorial={skipTutorial}
        />
        <EnemyCard combat={game.combat} />
        <PendingCheckCard
          currentCheck={currentCheck}
          pendingDamage={pendingDamage}
          pendingDamageDice={pendingDamageDice}
          pendingCheckTag={pendingCheckTag}
          pendingCheckReason={effectivePendingCheckReason}
          pendingCheckAction={pendingCheckAction}
          onOpenPendingCheck={openPendingCheck}
          combatActive={game.combat.active}
        />
      </ChatLog>

      {session.rolling && <DiceRollOverlay rolling={session.rolling} />}

      <DicePanel
        diceOpen={diceOpen}
        pendingDamage={pendingDamage}
        pendingDamageDice={pendingDamageDice}
        currentCheck={currentCheck}
        combatInitiative={combatInitiative}
        combatAttack={combatAttack}
        pendingCheckReason={effectivePendingCheckReason}
        rollMode={rollMode}
        setRollMode={setRollMode}
        game={game}
        qiInvest={qiInvest}
        setQiInvest={setQiInvest}
        qiLimit={qiLimit}
        lowQi={lowQi}
        dexAbility={dexAbility}
        rollDice={rollDice}
        rollDamageDice={rollDamageDice}
      />

      {!controlsBlocked && (
        <form className="input-bar" onSubmit={(event: FormEvent) => {
          event.preventDefault();
          void submitAction();
        }}>
          <button type="button" onClick={() => openDrawer()} aria-label="打开面板" disabled={busy}>
            <User size={21} />
          </button>
          <input
            value={input}
            onChange={(event) => setInput(event.target.value)}
            placeholder={awaitingDamage ? "先掷完这次武学伤害..." : game.combat.active ? "描述你用什么招式、怎样出手..." : "描述你的行动..."}
            disabled={busy || awaitingDamage}
          />
          <button type="button" onClick={toggleDice} aria-label="打开骰子" disabled={busy}>
            <Dices size={21} />
          </button>
          <button type="submit" disabled={busy || awaitingDamage} aria-label="发送">
            <Send size={20} />
          </button>
        </form>
      )}

      {panelOpen && <div className="scrim" onClick={closePanels} />}

      <DrawerPanel
        drawerOpen={drawerOpen}
        activeTab={activeTab}
        onSelectTab={(tab: DrawerTab) => setActiveTab(tab)}
        onClose={closePanels}
      >
        {drawerContent}
      </DrawerPanel>
    </main>
  );
}
