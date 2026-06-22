import type { Message } from "../../types";
import { messageRoleLabel } from "../display";

export function MessageBubble({ message }: { message: Message }) {
  const isCombatSummary = message.kind === "combat"
    || (message.role === "system" && /^【(先攻|先攻结果|命中|攻击结果|伤害|伤害结果|敌方回合|敌方结果|脱身|内伤|状态)】/.test(message.text));

  return (
    <article className={`message ${message.role}${isCombatSummary ? " combat-summary" : ""}`}>
      <span>{messageRoleLabel(message.role)}</span>
      <p>{message.text}</p>
    </article>
  );
}
