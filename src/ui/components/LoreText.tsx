import type { LoreEntity } from "../lore/types";
import { splitTextByLoreEntities } from "../lore/loreEntityRegistry";

type LoreTextProps = {
  text: string;
  entities: LoreEntity[];
  onOpenEntity: (entity: LoreEntity) => void;
};

export function LoreText({ text, entities, onOpenEntity }: LoreTextProps) {
  const parts = splitTextByLoreEntities(text, entities);

  return (
    <p>
      {parts.map((part, index) => {
        if (part.kind === "text") return <span key={index}>{part.text}</span>;
        return (
          <button
            key={`${part.entity.id}-${index}`}
            type="button"
            className={`lore-link ${part.entity.kind}`}
            onClick={() => onOpenEntity(part.entity)}
          >
            {part.text}
          </button>
        );
      })}
    </p>
  );
}
