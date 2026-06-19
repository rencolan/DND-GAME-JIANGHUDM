import type { Character, SceneType } from "../../types";
import { sceneLabels } from "../display";

type AppHeaderProps = {
  chapter: string;
  locationName: string;
  worldDay: number;
  timeSlot: string;
  sceneType: SceneType;
  character: Character;
};

export function AppHeader({ chapter, locationName, worldDay, timeSlot, sceneType, character }: AppHeaderProps) {
  return (
    <header className="app-header">
      <div>
        <p>{chapter}</p>
        <h1>{locationName}</h1>
        <span>第 {worldDay} 日 · {timeSlot} · {sceneLabels[sceneType]}</span>
      </div>
      <img src={character.portrait} alt={`${character.name}立绘`} />
    </header>
  );
}
