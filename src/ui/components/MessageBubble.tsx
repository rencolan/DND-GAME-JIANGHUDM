import type { Message } from "../../types";
import { messageRoleLabel } from "../display";
import type { LoreEntity } from "../lore/types";
import type { MessageVisual } from "../visuals/types";
import { LoreText } from "./LoreText";
import { MessageVisuals } from "./MessageVisuals";

type MessageBubbleProps = {
  message: Message;
  visuals?: MessageVisual[];
  speakerVisual?: MessageVisual;
  loreEntities?: LoreEntity[];
  onOpenLoreEntity?: (entity: LoreEntity) => void;
};

export function MessageBubble({ message, visuals = [], speakerVisual, loreEntities = [], onOpenLoreEntity }: MessageBubbleProps) {
  const isCombatSummary = message.kind === "combat"
    || (message.role === "system" && /^【(先攻|先攻结果|命中|攻击结果|伤害|伤害结果|敌方回合|敌方结果|脱身|内伤|状态)】/.test(message.text));

  return (
    <div className={`message-row ${message.role}${speakerVisual ? " with-speaker" : ""}`}>
      {speakerVisual && (
        <img
          className="message-speaker-portrait"
          src={speakerVisual.src}
          alt={speakerVisual.alt}
          title={speakerVisual.title}
          loading="lazy"
        />
      )}
      <article className={`message ${message.role}${isCombatSummary ? " combat-summary" : ""}`}>
        <span className="message-role">{speakerVisual ? speakerVisual.title : messageRoleLabel(message.role)}</span>
        {onOpenLoreEntity
          ? <LoreText text={message.text} entities={loreEntities} onOpenEntity={onOpenLoreEntity} />
          : <p>{message.text}</p>}
        <MessageVisuals visuals={visuals} />
      </article>
    </div>
  );
}
