import { Map as MapIcon } from "lucide-react";
import type { GameState, SceneType } from "../../types";
import { sceneLabels } from "../display";

type MapTabProps = {
  game: GameState;
  locationName: string;
  selectedLocation: GameState["locations"][number];
  visibleNpcs: GameState["npcs"];
  setSelectedLocationId: (value: string | undefined) => void;
  switchScene: (sceneType: SceneType) => void;
  travelToLocation: (name: string) => void;
};

export function MapTab({
  game,
  locationName,
  selectedLocation,
  visibleNpcs,
  setSelectedLocationId,
  switchScene,
  travelToLocation
}: MapTabProps) {
  const activeQuests = game.quests.filter((quest) => quest.status === "active");
  const resolvedQuests = game.quests.filter((quest) => quest.status === "resolved");
  const relatedNpcs = visibleNpcs.filter((npc) => npc.location === selectedLocation.name || (selectedLocation.current && npc.companion));
  const relatedQuestTitles = Array.from(new Set([
    ...(game.objective.location === selectedLocation.name && activeQuests.length > 0 ? [game.objective.title] : []),
    ...activeQuests
      .filter((quest) => quest.title.includes(selectedLocation.name) || quest.text.includes(selectedLocation.name))
      .map((quest) => quest.title)
  ]));

  return (
    <section className="map-panel">
      <header className="map-task-header">
        <span>地图与任务</span>
        <b>{game.objective.title}</b>
        <p>{game.objective.text}</p>
        <small>
          {game.objective.location || locationName}
          {game.objective.npc ? ` · ${game.objective.npc}` : ""}
        </small>
      </header>

      <div className="scene-switcher">
        {Object.entries(sceneLabels).map(([id, label]) => (
          <button
            key={id}
            type="button"
            className={game.sceneType === id ? "active" : ""}
            onClick={() => switchScene(id as SceneType)}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="map-art">
        {game.locations.map((location) => (
          <button
            key={location.id}
            type="button"
            className={`map-pin ${location.current ? "current" : ""} ${location.unlocked ? "" : "locked"}`}
            style={{ left: `${location.x}%`, top: `${location.y}%` }}
            onClick={() => setSelectedLocationId(location.id)}
          >
            <MapIcon size={14} />
            <span>{location.name}</span>
          </button>
        ))}
      </div>

      <article className={`map-location-card ${selectedLocation.unlocked ? "" : "locked"}`}>
        <span>{selectedLocation.current ? "当前位置" : selectedLocation.unlocked ? "已解锁地点" : "线索不足"}</span>
        <b>{selectedLocation.name}</b>
        <p>{selectedLocation.desc}</p>
        <small>
          {relatedNpcs.length > 0
            ? `在场/相关人物：${relatedNpcs.map((npc) => npc.name).join("、")}`
            : "暂无直接关联人物"}
        </small>
        <small>
          {relatedQuestTitles.length > 0
            ? `相关任务：${relatedQuestTitles.join("、")}`
            : "暂无直接关联任务"}
        </small>
        {selectedLocation.unlocked && !selectedLocation.current && (
          <button type="button" onClick={() => travelToLocation(selectedLocation.name)}>前往</button>
        )}
      </article>

      <div className="quest-log">
        <h3>任务日志</h3>
        {activeQuests.length === 0 ? (
          <article className="current">
            <div>
              <b>尚未接到正式任务</b>
              <p>先迈出第一步，局势才会把真正的线索送到你手里。</p>
            </div>
            <span>引导中</span>
          </article>
        ) : (
          <>
            <article className="current">
              <div>
                <b>当前目标：{game.objective.title}</b>
                <p>{game.objective.text}</p>
              </div>
              <span>{game.objective.location || locationName}</span>
            </article>
            {activeQuests.map((quest) => (
              <article key={quest.id}>
                <div>
                  <b>{quest.title}</b>
                  <p>{quest.text}</p>
                </div>
                <span>进行中</span>
              </article>
            ))}
          </>
        )}

        {resolvedQuests.map((quest) => (
          <article key={quest.id} className="resolved">
            <div>
              <b>{quest.title}</b>
              <p>{quest.text}</p>
            </div>
            <span>完成</span>
          </article>
        ))}
      </div>

      {game.rumors.length > 0 && (
        <div className="quest-log">
          <h3>江湖风声</h3>
          {game.rumors.slice(-4).reverse().map((rumor) => (
            <article key={rumor.id}>
              <div>
                <b>{rumor.location || "江湖传闻"}</b>
                <p>{rumor.text}</p>
              </div>
              <span>{rumor.npc || "风闻"}</span>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
