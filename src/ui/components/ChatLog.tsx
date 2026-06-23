import { Loader2 } from "lucide-react";
import type { MutableRefObject, ReactNode } from "react";
import type { Message } from "../../types";
import { resolveMessageSpeakerVisual, resolveMessageVisuals } from "../visuals/messageVisualResolver";
import type { MessageVisualContext } from "../visuals/types";
import { MessageBubble } from "./MessageBubble";

type ChatLogProps = {
  messages: Message[];
  busy: boolean;
  endRef: MutableRefObject<HTMLDivElement | null>;
  visualContext?: MessageVisualContext;
  children?: ReactNode;
};

export function ChatLog({ messages, busy, endRef, visualContext, children }: ChatLogProps) {
  const seenVisualIds = new Set<string>();

  return (
    <section className="chat">
      {children}
      {messages.map((message) => {
        const visuals = visualContext ? resolveMessageVisuals(message, visualContext) : [];
        const firstAppearanceVisuals = visuals.filter((visual) => !seenVisualIds.has(visual.id));
        visuals.forEach((visual) => seenVisualIds.add(visual.id));

        const speakerVisual = visualContext ? resolveMessageSpeakerVisual(message, visualContext) : undefined;
        const compactSpeakerVisual = speakerVisual && firstAppearanceVisuals.length === 0 && seenVisualIds.has(speakerVisual.id)
          ? speakerVisual
          : undefined;

        return (
          <MessageBubble
            key={message.id}
            message={message}
            visuals={firstAppearanceVisuals}
            speakerVisual={compactSpeakerVisual}
          />
        );
      })}

      {busy && (
        <article className="message dm loading">
          <Loader2 className="spin" size={16} />
          <p>说书人正在接下一手...</p>
        </article>
      )}

      <div ref={endRef} />
    </section>
  );
}
