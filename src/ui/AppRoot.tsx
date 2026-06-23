import { useGameSession } from "./useGameSession";
import { SetupScreen } from "./components/SetupScreen";
import { GameScreen } from "./components/GameScreen";
import { DiceRollOverlay } from "./components/DiceRollOverlay";

export function AppRoot() {
  const session = useGameSession();

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
