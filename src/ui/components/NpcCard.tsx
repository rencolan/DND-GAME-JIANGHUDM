import type { Npc } from "../../types";

type NpcCardProps = {
  npc: Npc;
  relationshipLabel?: string;
  routeLabel?: string;
  routeNote?: string;
  supportLabels?: string[];
  onUseSupport?: () => void;
};

export function NpcCard({
  npc,
  relationshipLabel,
  routeLabel,
  routeNote,
  supportLabels,
  onUseSupport
}: NpcCardProps) {
  return (
    <article className="npc-card">
      <img src={npc.portrait} alt={`${npc.name}立绘`} />
      <div>
        <header>
          <b>{npc.name}</b>
          <span>{routeLabel || relationshipLabel || npc.attitude}</span>
        </header>
        <p>{npc.title} · {npc.location}</p>
        <small>{routeNote || npc.goal}</small>
        <div className="npc-meta">
          {relationshipLabel && <em>{relationshipLabel}</em>}
          {supportLabels?.length ? <em>{supportLabels.join(" · ")}</em> : null}
        </div>
        {onUseSupport && (
          <button type="button" className="npc-support-action" onClick={onUseSupport}>
            请求支援
          </button>
        )}
      </div>
    </article>
  );
}
