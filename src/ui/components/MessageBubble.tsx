import type { Message } from "../../types";
import { messageRoleLabel } from "../display";

export function MessageBubble({ message }: { message: Message }) {
  const isCombatSummary = message.role === "system" && /^【(先攻结果|攻击结果|伤害结果|敌方结果)】/.test(message.text);

  return (
    <article className={`message ${message.role}${isCombatSummary ? " combat-summary" : ""}`}>
      <span>{messageRoleLabel(message.role)}</span>
      <p>{message.text}</p>
    </article>
  );
}
