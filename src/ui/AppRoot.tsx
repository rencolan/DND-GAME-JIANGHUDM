import { useGameSession } from "./useGameSession";
import { SetupScreen } from "./components/SetupScreen";
import { GameScreen } from "./components/GameScreen";

export function AppRoot() {
  const session = useGameSession();

  if (!session.game.setupComplete) {
    return (
      <SetupScreen
        customName={session.customName}
        setCustomName={session.setCustomName}
        selectedOrigin={session.selectedOrigin}
        abilityChoices={session.abilityChoices}
        onRollAbilities={session.rollStartingAbilities}
        onStart={session.startOriginGame}
        onContinue={session.canContinue ? session.continueGame : undefined}
      />
    );
  }

  return <GameScreen session={session} />;
}
