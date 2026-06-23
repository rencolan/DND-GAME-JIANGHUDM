import { X } from "lucide-react";
import type { LoreEntity } from "../lore/types";

type LoreEntityModalProps = {
  entity?: LoreEntity;
  onClose: () => void;
};

const kindLabels: Record<LoreEntity["kind"], string> = {
  npc: "人物",
  location: "地点",
  martial: "武学 / 功法",
  manual: "秘笈",
  scene: "场景"
};

export function LoreEntityModal({ entity, onClose }: LoreEntityModalProps) {
  if (!entity) return null;

  return (
    <div className="lore-modal-backdrop" role="presentation" onClick={onClose}>
      <article className={`lore-modal ${entity.kind}`} role="dialog" aria-modal="true" aria-label={entity.name} onClick={(event) => event.stopPropagation()}>
        <button type="button" className="lore-modal-close" onClick={onClose} aria-label="关闭词条">
          <X size={18} />
        </button>

        {entity.image && (
          <div className="lore-modal-image">
            <img src={entity.image} alt={`${entity.name}详情图`} />
          </div>
        )}

        <div className="lore-modal-body">
          <span>{kindLabels[entity.kind]}</span>
          <h3>{entity.name}</h3>
          {entity.title && <b>{entity.title}</b>}
          {entity.subtitle && <small>{entity.subtitle}</small>}
          {entity.description && <p>{entity.description}</p>}

          {entity.fields && entity.fields.length > 0 && (
            <dl>
              {entity.fields.map((field) => (
                <div key={`${field.label}:${field.value}`}>
                  <dt>{field.label}</dt>
                  <dd>{field.value}</dd>
                </div>
              ))}
            </dl>
          )}
        </div>
      </article>
    </div>
  );
}
