import type { Message } from "../../types";
import { messageRoleLabel } from "../display";

export function MessageBubble({ message }: { message: Message }) {
  return (
    <article className={`message ${message.role}`}>
      <span>{messageRoleLabel(message.role)}</span>
      <p>{message.text}</p>
    </article>
  );
}
