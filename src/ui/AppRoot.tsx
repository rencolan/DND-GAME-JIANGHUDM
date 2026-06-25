import { useEffect } from "react";
import { useGameSession } from "./useGameSession";
import { SetupScreen } from "./components/SetupScreen";
import { GameScreen } from "./components/GameScreen";
import { DiceRollOverlay } from "./components/DiceRollOverlay";
import { recordDiagnostic } from "./diagnostics";

export function AppRoot() {
  const session = useGameSession();

  useEffect(() => {
    const handleError = (event: ErrorEvent) => {
      recordDiagnostic("error", event.message || "window.error", event.error instanceof Error ? event.error.stack : event.filename);
    };
    const handleRejection = (event: PromiseRejectionEvent) => {
      const reason = event.reason instanceof Error ? event.reason.message : String(event.reason);
      recordDiagnostic("rejection", reason, event.reason instanceof Error ? event.reason.stack : undefined);
    };

    window.addEventListener("error", handleError);
    window.addEventListener("unhandledrejection", handleRejection);
    return () => {
      window.removeEventListener("error", handleError);
      window.removeEventListener("unhandledrejection", handleRejection);
    };
  }, []);

  if (!session.storageHydrated) {
    return (
      <section className="setup-screen">
        <div className="setup-shell">
          <header className="setup-hero">
            <div className="setup-hero-copy">
              <p className="setup-kicker">江湖 DM</p>
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
