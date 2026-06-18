import { useGameSession } from "./useGameSession";
import { LegacyApp } from "./LegacyApp";

export function AppRoot() {
  const session = useGameSession();
  return <LegacyApp session={session} />;
}
