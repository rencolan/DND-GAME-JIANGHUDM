import { Loader2 } from "lucide-react";
import { useMemo, useState, type MutableRefObject, type ReactNode } from "react";
import type { Message } from "../../types";
import { buildLoreEntities } from "../lore/loreEntityRegistry";
import type { LoreEntity } from "../lore/types";
import { resolveMessageSpeakerVisual, resolveMessageVisuals } from "../visuals/messageVisualResolver";
import type { MessageVisualContext } from "../visuals/types";
import { LoreEntityModal } from "./LoreEntityModal";
import { MessageBubble } from "./MessageBubble";

type ChatLogProps = {
  messages: Message[];
  busy: boolean;
  endRef: MutableRefObject<HTMLDivElement | null>;
  visualContext?: MessageVisualContext;
  children?: ReactNode;
};

const MAX_VISIBLE_MESSAGES = 120;

export function ChatLog({ messages, busy, endRef, visualContext, children }: ChatLogProps) {
  const [selectedLoreEntity, setSelectedLoreEntity] = useState<LoreEntity | undefined>();
  const loreEntities = useMemo(() => visualContext ? buildLoreEntities(visualContext) : [], [visualContext]);
  const seenVisualIds = new Set<string>();
  const visibleStart = Math.max(0, messages.length - MAX_VISIBLE_MESSAGES);
  const renderedMessages: ReactNode[] = [];

  messages.forEach((message, index) => {
    const visuals = visualContext ? resolveMessageVisuals(message, visualContext) : [];
    const firstAppearanceVisuals = visuals.filter((visual) => !seenVisualIds.has(visual.id));
    visuals.forEach((visual) => seenVisualIds.add(visual.id));

    if (index < visibleStart) {
      return;
    }

    const speakerVisual = visualContext ? resolveMessageSpeakerVisual(message, visualContext) : undefined;
    const compactSpeakerVisual = speakerVisual && firstAppearanceVisuals.length === 0 && seenVisualIds.has(speakerVisual.id)
      ? speakerVisual
      : undefined;

    renderedMessages.push(
      <MessageBubble
        key={message.id}
        message={message}
        visuals={firstAppearanceVisuals}
        speakerVisual={compactSpeakerVisual}
        loreEntities={loreEntities}
        onOpenLoreEntity={setSelectedLoreEntity}
      />
    );
  });

  return (
    <section className="chat">
      {children}
      {renderedMessages}

      {busy && (
        <article className="message dm loading">
          <Loader2 className="spin" size={16} />
          <p>说书人正在接下一手...</p>
        </article>
      )}

      <div ref={endRef} />
      <LoreEntityModal entity={selectedLoreEntity} onClose={() => setSelectedLoreEntity(undefined)} />
    </section>
  );
}
