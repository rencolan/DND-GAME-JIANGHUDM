import type { LocationOpportunity } from "../../types";
import { useState } from "react";

const riskLabels: Record<LocationOpportunity["risk"], string> = {
  low: "低风险",
  medium: "中风险",
  high: "高风险"
};

const categoryLabels: Record<LocationOpportunity["category"], string> = {
  mainline: "主线",
  training: "修行",
  relationship: "关系",
  exploration: "探索",
  trade: "交易",
  danger: "高危"
};

type OpportunityBoardProps = {
  opportunities: LocationOpportunity[];
  controlsBlocked: boolean;
  busy: boolean;
  onChoose: (actionText: string) => void;
};

export function OpportunityBoard({ opportunities, controlsBlocked, busy, onChoose }: OpportunityBoardProps) {
  const [selectedId, setSelectedId] = useState<string | undefined>(undefined);
  if (opportunities.length === 0) return null;

  const selected = opportunities.find((opportunity) => opportunity.id === selectedId);
  const selectedDisabled = Boolean(selected?.disabledReason) || controlsBlocked || busy;

  return (
    <section className="opportunity-board">
      <div className="opportunity-head">
        <span>当前机会</span>
        <small>选择一件眼前值得做的事</small>
      </div>
      <div className="opportunity-list">
        {opportunities.map((opportunity) => {
          return (
            <button
              key={opportunity.id}
              type="button"
              className={`opportunity-card ${opportunity.risk} ${selectedId === opportunity.id ? "selected" : ""}`}
              disabled={controlsBlocked || busy}
              onClick={() => setSelectedId((current) => current === opportunity.id ? undefined : opportunity.id)}
            >
              <span>{categoryLabels[opportunity.category]} · {riskLabels[opportunity.risk]}</span>
              <b>{opportunity.title}</b>
              <small>{opportunity.text}</small>
              <em>{opportunity.disabledReason || opportunity.reward}</em>
            </button>
          );
        })}
      </div>
      {selected && (
        <article className={`opportunity-detail ${selected.risk}`}>
          <div className="opportunity-detail-head">
            <span>{categoryLabels[selected.category]}</span>
            <b>{selected.title}</b>
          </div>
          <p>{selected.text}</p>
          <dl>
            <div>
              <dt>风险</dt>
              <dd>{riskLabels[selected.risk]}</dd>
            </div>
            <div>
              <dt>收益</dt>
              <dd>{selected.reward}</dd>
            </div>
            <div>
              <dt>失败</dt>
              <dd>{selected.failure}</dd>
            </div>
            {selected.checkAbility && (
              <div>
                <dt>推荐</dt>
                <dd>{selected.checkAbility}</dd>
              </div>
            )}
            {selected.timeCost && (
              <div>
                <dt>耗时</dt>
                <dd>{selected.timeCost}</dd>
              </div>
            )}
            {(selected.requirement || selected.disabledReason) && (
              <div>
                <dt>条件</dt>
                <dd>{selected.disabledReason || selected.requirement}</dd>
              </div>
            )}
          </dl>
          <button type="button" disabled={selectedDisabled} onClick={() => onChoose(selected.actionText)}>
            {selected.disabledReason ? "条件不足" : "执行这件事"}
          </button>
        </article>
      )}
    </section>
  );
}
