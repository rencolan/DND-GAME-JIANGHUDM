import type { LocationOpportunity } from "../../types";

const riskLabels: Record<LocationOpportunity["risk"], string> = {
  low: "低风险",
  medium: "中风险",
  high: "高风险"
};

type OpportunityBoardProps = {
  opportunities: LocationOpportunity[];
  controlsBlocked: boolean;
  busy: boolean;
  onChoose: (actionText: string) => void;
};

export function OpportunityBoard({ opportunities, controlsBlocked, busy, onChoose }: OpportunityBoardProps) {
  if (opportunities.length === 0) return null;

  return (
    <section className="opportunity-board">
      <div className="opportunity-head">
        <span>当前机会</span>
        <small>选择一件眼前值得做的事</small>
      </div>
      <div className="opportunity-list">
        {opportunities.map((opportunity) => {
          const disabled = controlsBlocked || busy || Boolean(opportunity.disabledReason);
          return (
            <button
              key={opportunity.id}
              type="button"
              className={`opportunity-card ${opportunity.risk}`}
              disabled={disabled}
              onClick={() => onChoose(opportunity.actionText)}
            >
              <span>{riskLabels[opportunity.risk]}</span>
              <b>{opportunity.title}</b>
              <small>{opportunity.text}</small>
              <em>{opportunity.disabledReason || opportunity.reward}</em>
            </button>
          );
        })}
      </div>
    </section>
  );
}
