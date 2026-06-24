import type { MessageVisual } from "../visuals/types";

type MessageVisualsProps = {
  visuals: MessageVisual[];
};

export function MessageVisuals({ visuals }: MessageVisualsProps) {
  if (visuals.length === 0) return null;

  return (
    <div className={`message-visuals ${visuals.length > 1 ? "multi" : ""}`}>
      {visuals.map((visual) => (
        <figure key={visual.id} className={`message-visual ${visual.kind}`}>
          <img src={visual.src} alt={visual.alt} loading="lazy" decoding="async" />
          <figcaption>
            <span>{visual.kind === "npc" ? "人物登场" : "场景"}</span>
            <b>{visual.title}</b>
            {visual.subtitle && <small>{visual.subtitle}</small>}
            {visual.caption && <p>{visual.caption}</p>}
          </figcaption>
        </figure>
      ))}
    </div>
  );
}
