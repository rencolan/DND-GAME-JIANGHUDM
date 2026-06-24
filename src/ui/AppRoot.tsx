import { useGameSession } from "./useGameSession";
import { SetupScreen } from "./components/SetupScreen";
import { GameScreen } from "./components/GameScreen";
import { DiceRollOverlay } from "./components/DiceRollOverlay";

export function AppRoot() {
  const session = useGameSession();

  if (!session.storageHydrated) {
    return (
      <section className="setup-screen">
        <div className="setup-shell">
          <header className="setup-hero">
            <div className="setup-hero-copy">
              <p className="setup-kicker">姹熸箹 DM</p>
              <h1>读取存档中</h1>
              <p className="setup-summary">正在从本地存储恢复江湖进度。</p>
            </div>
          </header>
        </div>
      </section>
    );
  }

  return (
    <>
      {!session.game.setupComplete ? (
        <SetupScreen
          customName={session.customName}
          setCustomName={session.setCustomName}
          selectedOrigin={session.selectedOrigin}
          abilityChoices={session.abilityChoices}
          rollingActive={Boolean(session.rolling)}
          onRollAbility={session.rollStartingAbility}
          onStart={session.startOriginGame}
          onContinue={session.canContinue ? session.continueGame : undefined}
        />
      ) : (
        <GameScreen session={session} />
      )}
      <DiceRollOverlay
        rolling={session.rolling}
        onComplete={session.completeRolling}
        sfxEnabled={session.sfxEnabled}
        sfxVolume={session.sfxVolume}
      />
    </>
  );
}
