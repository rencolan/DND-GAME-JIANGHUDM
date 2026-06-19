import { Loader2 } from "lucide-react";
import type { MutableRefObject, ReactNode } from "react";
import type { Message } from "../../types";
import { MessageBubble } from "./MessageBubble";

type ChatLogProps = {
  messages: Message[];
  busy: boolean;
  endRef: MutableRefObject<HTMLDivElement | null>;
  children?: ReactNode;
};

export function ChatLog({ messages, busy, endRef, children }: ChatLogProps) {
  return (
    <section className="chat">
      {children}
      {messages.map((message) => <MessageBubble key={message.id} message={message} />)}

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
