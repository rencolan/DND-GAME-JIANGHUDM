import { Dices, Send, User } from "lucide-react";
import { type CSSProperties, type FormEvent, useEffect, useMemo, useState } from "react";
import { doubleDamageDice } from "../../game/combat";
import { buildLocationOpportunities, currentLocationName, isVisibleNpc, primaryRouteForNpc } from "../../game/world";
import type { DrawerTab, Message, PendingCheck } from "../../types";
import { sceneAssets } from "../display";
import type { GameSession } from "../useGameSession";
import { buildMessageVisualContext } from "../visuals/context";
import { AppHeader } from "./AppHeader";
import { CharacterTab } from "./CharacterTab";
import { ChatLog } from "./ChatLog";
import { CompanionsTab } from "./CompanionsTab";
import { DicePanel } from "./DicePanel";
import { DrawerPanel } from "./DrawerPanel";
import { EnemyCard } from "./EnemyCard";
import { InventoryTab } from "./InventoryTab";
import { MapTab } from "./MapTab";
import { ObjectiveCard } from "./ObjectiveCard";
import { OpportunityBoard } from "./OpportunityBoard";
import { PendingCheckCard } from "./PendingCheckCard";
import { SystemTab } from "./SystemTab";

const BGM_SRC = "../assets/bgm/Seven_Peaks_at_Twilight.mp3";
const COMBAT_SUMMARY_RE = /^【(先攻|先攻结果|命中|攻击结果|伤害|伤害结果|敌方回合|敌方结果|脱身|逃跑结果|内伤|状态)】/;

type GameScreenProps = {
  session: GameSession;
};

type CombatHudSummary = {
  id: string;
  title: string;
  headline: string;
  detail?: string;
};

function readLatestCombatSummary(messages: Message[]): CombatHudSummary | undefined {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    if (message.role !== "system" || !COMBAT_SUMMARY_RE.test(message.text)) continue;

    const lines = message.text.split("\n").filter(Boolean);
    const title = lines[0]?.replace(/[【】]/g, "") || "战斗结果";
    return {
      id: message.id,
      title,
      headline: lines[1] || "战斗结果已更新。",
      detail: lines.slice(2).join(" · ") || undefined
    };
  }

  return undefined;
}

function rollModeLabel(mode?: PendingCheck["rollMode"]) {
  switch (mode) {
    case "advantage":
      return "优势判定";
    case "disadvantage":
      return "劣势判定";
    default:
      return "常规判定";
  }
}

export function GameScreen({ session }: GameScreenProps) {
  const {
    game,
    api,
    setApi,
    input,
    setInput,
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
    sfxEnabled,
    sfxVolume,
    setSfxVolume,
    uiLocked,
    canRestoreCombatCheckpoint,
    canRestoreActionCheckpoint,
    endRef,
    fileInputRef,
    audioRef,
    closePanels,
    applyDeepSeekPreset,
    toggleMusic,
    toggleSfx,
    runApiTest,
    exportSave,
    resetGame,
    beginTutorialCombat,
    skipTutorial,
    submitAction,
    importSave,
    openDrawer,
    openPendingCheck,
    toggleDice,
    switchScene,
    travelToLocation,
    useItem,
    studyManual,
    practicePendingArt,
    practiceOnsiteSource,
    cultivateFromManual,
    claimAttributeInsight,
    devStartCombat,
    devEndCombat,
    devRecoverHero,
    devGrantMartialArt,
    devGrantInternalManual,
    devRaiseCultivationRank,
    rollDice,
    rollDamageDice,
    restoreCombatCheckpoint,
    restoreActionCheckpoint
  } = session;

  const panelOpen = drawerOpen || diceOpen;
  const locationName = currentLocationName(game);
  const visibleNpcs = useMemo(() => game.npcs.filter(isVisibleNpc), [game.npcs]);
  const companions = useMemo(() => visibleNpcs.filter((npc) => npc.companion), [visibleNpcs]);
  const activeRelationshipNpcs = useMemo(() => visibleNpcs.filter((npc) => primaryRouteForNpc(game, npc.id)), [game, visibleNpcs]);
  const opportunities = useMemo(() => buildLocationOpportunities(game), [game]);
  const selectedLocation = game.locations.find((location) => location.id === selectedLocationId)
    || game.locations.find((location) => location.current)
    || game.locations[0];
  const sceneBackground = sceneAssets[game.sceneType] || sceneAssets.market;
  const messageVisualContext = useMemo(
    () => buildMessageVisualContext(game, locationName),
    [game.npcs, game.locations, game.sceneType, locationName]
  );
  const qiLimit = Math.min(6, game.character.qi);
  const lowQi = game.character.qi <= 1;
  const tutorialActive = game.chapterState.stage === "tutorial_story" || game.chapterState.stage === "tutorial_combat";
  const tutorialCombatActive = game.chapterState.stage === "tutorial_combat";
  const tutorialStoryActive = tutorialActive && !tutorialCombatActive;
  const currentCheck = game.pendingCheck;
  const pendingDamage = game.pendingDamage;
  const isDead = game.character.hp <= 0;
  const combatEscape = game.combat.active && currentCheck?.kind === "combat_escape";
  const combatInitiative = game.combat.active && game.combat.phase === "opening";
  const combatAttack = game.combat.active && game.combat.phase === "awaiting_hit_check" && !combatEscape;
  const awaitingDamage = Boolean(pendingDamage);
  const controlsBlocked = isDead || uiLocked || Boolean(session.rolling);
  const pendingDamageDice = pendingDamage
    ? (pendingDamage.isCritical ? doubleDamageDice(pendingDamage.damageDice) : pendingDamage.damageDice)
    : undefined;
  const pendingCheckTag = combatInitiative ? "待先攻" : combatAttack ? "待攻击" : "待判定";
  const pendingCheckReason = combatInitiative
    ? "本轮先攻固定使用身法判定。"
    : combatAttack
      ? "先命中，后伤害。"
      : currentCheck?.reason;
  const pendingCheckAction = combatInitiative ? "掷先攻" : combatAttack ? "掷攻击" : "进行判定";
  const effectivePendingCheckReason = pendingCheckReason || currentCheck?.reason;
  const displayPendingCheckTag = combatInitiative ? "待先攻" : combatEscape ? "待逃脱" : combatAttack ? "待攻击" : "待判定";
  const displayPendingCheckReason = combatInitiative
    ? "本轮先攻固定使用身法判定。"
    : combatEscape
      ? currentCheck?.reason
      : combatAttack
        ? "先命中，后伤害。"
        : effectivePendingCheckReason;
  const displayPendingCheckAction = combatInitiative ? "掷先攻" : combatEscape ? "掷逃跑" : combatAttack ? "掷攻击" : "进行判定";
  const latestCombatSummary = useMemo(() => readLatestCombatSummary(game.messages), [game.messages]);
  const [visibleCombatSummary, setVisibleCombatSummary] = useState<CombatHudSummary | undefined>(undefined);

  useEffect(() => {
    if (!game.combat.active) {
      setVisibleCombatSummary(undefined);
      return;
    }
    if (!latestCombatSummary) return;

    setVisibleCombatSummary(latestCombatSummary);
    const timer = window.setTimeout(() => {
      setVisibleCombatSummary((current) => current?.id === latestCombatSummary.id ? undefined : current);
    }, 2600);

    return () => window.clearTimeout(timer);
  }, [game.combat.active, latestCombatSummary]);

  const enemySummary = game.combat.active
    ? `${game.combat.enemy || "敌人"}`
    : undefined;
  const actionSummary = pendingDamage
    ? `${pendingDamage.label} · ${pendingDamageDice}${pendingDamage.damageBonus ? ` +${pendingDamage.damageBonus}` : ""}`
    : currentCheck
      ? `DC ${currentCheck.dc} · ${currentCheck.label}`
      : undefined;
  const actionHint = pendingDamage
    ? "命中已确认，下一步直接掷伤害。"
    : currentCheck
      ? `${rollModeLabel(currentCheck.rollMode)} · ${displayPendingCheckReason}`
      : undefined;
  const hudButton = pendingDamage
    ? { label: "掷伤害", onClick: openPendingCheck }
    : currentCheck
      ? { label: "去掷骰", onClick: openPendingCheck }
      : undefined;
  const hudState = visibleCombatSummary
    ? {
      kind: "result" as const,
      kicker: visibleCombatSummary.title,
      headline: visibleCombatSummary.headline,
      detail: visibleCombatSummary.detail
    }
    : actionSummary
      ? {
        kind: "prompt" as const,
        kicker: pendingDamage ? "待伤害" : displayPendingCheckTag,
        headline: actionSummary,
        detail: actionHint
      }
      : enemySummary
        ? {
          kind: "idle" as const,
          kicker: "战斗中",
          headline: enemySummary,
          detail: "等待下一次交锋。"
        }
        : undefined;
  const hudBadges = [
    game.combat.active ? `HP ${game.combat.enemyHp}/${game.combat.enemyMaxHp}` : undefined,
    game.combat.active && game.combat.round ? `回合 ${game.combat.round}` : undefined
  ].filter(Boolean) as string[];
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
        studyManual={studyManual}
        cultivateFromManual={cultivateFromManual}
        practicePendingArt={practicePendingArt}
        practiceOnsiteSource={practiceOnsiteSource}
        claimAttributeInsight={claimAttributeInsight}
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
          onUseSupport={(npcId) => {
            const npcName = game.npcs.find((npc) => npc.id === npcId)?.name || npcId;
            void submitAction(`请求支援：请${npcName}帮我补上这一手`);
          }}
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
        game={game}
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
        toggleSfx={toggleSfx}
        sfxEnabled={sfxEnabled}
        sfxVolume={sfxVolume}
        setSfxVolume={setSfxVolume}
        devStartCombat={devStartCombat}
        devEndCombat={devEndCombat}
        devRecoverHero={devRecoverHero}
        devGrantMartialArt={devGrantMartialArt}
        devGrantInternalManual={devGrantInternalManual}
        devRaiseCultivationRank={devRaiseCultivationRank}
      />
    );
  }

  return (
    <main className={`app ${game.combat.active ? "combat" : ""} ${isDead ? "dead" : ""}`} style={appStyle}>
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

      <ChatLog messages={game.messages} busy={busy} endRef={endRef} visualContext={messageVisualContext}>
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
        {isDead && (
          <article className="death-card">
            <span>死亡结算</span>
            <b>你已死亡</b>
            <p>气血已经归零，本次流程结束。可回到最近的战前或行动前检查点，也可以重新开始或导入旧存档。</p>
            <div className="death-actions">
              {canRestoreCombatCheckpoint && (
                <button type="button" className="primary-inline" onClick={restoreCombatCheckpoint} disabled={busy}>
                  回到战前
                </button>
              )}
              {canRestoreActionCheckpoint && (
                <button type="button" className="secondary-inline" onClick={restoreActionCheckpoint} disabled={busy}>
                  回到行动前
                </button>
              )}
              <button type="button" className="secondary-inline" onClick={resetGame} disabled={busy}>
                重新开始
              </button>
              <button
                type="button"
                className="secondary-inline"
                onClick={() => {
                  setActiveTab("system");
                  openDrawer();
                }}
                disabled={busy}
              >
                打开系统面板
              </button>
            </div>
          </article>
        )}
        {!isDead && !game.combat.active && (
          <OpportunityBoard
            opportunities={opportunities}
            controlsBlocked={controlsBlocked}
            busy={busy}
            onChoose={(actionText) => {
              void submitAction(actionText);
            }}
          />
        )}
        {!isDead && game.combat.active && <EnemyCard combat={game.combat} />}
        {!isDead && !game.combat.active && (
          <PendingCheckCard
            currentCheck={currentCheck}
            pendingDamage={pendingDamage}
            pendingDamageDice={pendingDamageDice}
            pendingCheckTag={displayPendingCheckTag}
            pendingCheckReason={displayPendingCheckReason}
            pendingCheckAction={displayPendingCheckAction}
            onOpenPendingCheck={openPendingCheck}
            combatActive={false}
          />
        )}
      </ChatLog>

      {isDead && (
        <section className="death-hud">
          <div className="death-hud-card">
            <div>
              <span>死亡结算</span>
              <b>你已死亡</b>
              <small>普通行动已锁定。请选择回退、重开，或打开系统面板导入旧档。</small>
            </div>
            <div className="death-hud-actions">
              <button type="button" onClick={restoreCombatCheckpoint} disabled={busy || !canRestoreCombatCheckpoint}>
                回到战前
              </button>
              <button type="button" onClick={restoreActionCheckpoint} disabled={busy || !canRestoreActionCheckpoint}>
                回到行动前
              </button>
              <button type="button" onClick={resetGame} disabled={busy}>
                重开
              </button>
              <button
                type="button"
                onClick={() => {
                  setActiveTab("system");
                  openDrawer();
                }}
                disabled={busy}
              >
                系统
              </button>
            </div>
          </div>
        </section>
      )}

      {!isDead && hudState && (
        <section className="action-hud">
          <div className={`action-hud-card ${hudState.kind}`}>
            <div className="action-hud-main">
              <div className="action-hud-topline">
                <span className="action-hud-kicker">{hudState.kicker}</span>
                {hudBadges.length > 0 && (
                  <div className="action-hud-badges">
                    {hudBadges.map((badge) => <i key={badge} className="action-hud-badge">{badge}</i>)}
                  </div>
                )}
              </div>
              <b>{hudState.headline}</b>
              {hudState.detail && <small>{hudState.detail}</small>}
            </div>
            {hudButton && (
              <button type="button" onClick={hudButton.onClick} className="action-hud-button">
                {hudButton.label}
              </button>
            )}
          </div>
        </section>
      )}

      {!isDead && (
        <DicePanel
          diceOpen={diceOpen}
          pendingDamage={pendingDamage}
          pendingDamageDice={pendingDamageDice}
          currentCheck={currentCheck}
          combatInitiative={combatInitiative}
          combatAttack={combatAttack}
          pendingCheckReason={displayPendingCheckReason}
          game={game}
          qiInvest={qiInvest}
          setQiInvest={setQiInvest}
          qiLimit={qiLimit}
          lowQi={lowQi}
          rollDice={rollDice}
          rollDamageDice={rollDamageDice}
        />
      )}

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
            placeholder={
              awaitingDamage
                ? "先掷完这次武学伤害..."
                : game.combat.active
                  ? "描述你用什么招式、怎样出手..."
                  : "描述你的行动..."
            }
            disabled={busy || awaitingDamage}
          />
          <button type="button" onClick={toggleDice} aria-label="打开骰子面板" disabled={busy}>
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
