import type { GameState, Item } from "../../types";
import { martialTagDetails } from "../../game/rules";

type InventoryTabProps = {
  game: GameState;
  selectedInventoryMartialId?: string;
  setSelectedInventoryMartialId: (value: string | undefined | ((current: string | undefined) => string | undefined)) => void;
  useItem: (item: Item) => void;
};

const statusLabels: Record<string, string> = {
  screened: "掩护",
  guarded: "守势",
  poisoned: "中毒",
  cold: "寒毒",
  sealed: "封脉",
  controlled: "受扰",
  exposed: "破绽"
};

function readableStatuses(statuses?: string[]) {
  return (statuses || []).map((status) => statusLabels[status] || status).join("、");
}

export function InventoryTab({
  game,
  selectedInventoryMartialId,
  setSelectedInventoryMartialId,
  useItem
}: InventoryTabProps) {
  const selectedInventoryMartial = game.character.martialArts.find((art) => art.id === selectedInventoryMartialId);

  return (
    <div className="drawer-grid">
      <section className="inventory-summary-card">
        <div>
          <b>行囊银两</b>
          <p>随身盘缠与可立即调用的现银。</p>
        </div>
        <span>{game.character.silver} 两</span>
      </section>

      <section className="list">
        {game.character.inventory.length > 0 ? (
          game.character.inventory.map((item) => (
            <article key={item.id}>
              <div>
                <b>{item.name}</b>
                <p>{item.desc}</p>
                {(item.combatActionCost || item.grantsStatus?.length || item.curesStatus?.length) && (
                  <p>
                    {item.combatActionCost ? "战斗中消耗一手" : "战斗中不耗手"}
                    {item.grantsStatus?.length ? ` · 获得 ${readableStatuses(item.grantsStatus)}` : ""}
                    {item.curesStatus?.length ? ` · 解除 ${readableStatuses(item.curesStatus)}` : ""}
                  </p>
                )}
              </div>
              <span>x{item.count}</span>
              {item.usable && (
                <button type="button" onClick={() => useItem(item)}>使用</button>
              )}
            </article>
          ))
        ) : (
          <p className="empty-state">眼下行囊空空，只剩几分风尘味。</p>
        )}
      </section>

      <section className="martial-list">
        <h3>武学</h3>
        {game.character.martialArts.map((art) => {
          const tagDetails = martialTagDetails(art);
          return (
            <article key={art.id}>
              <button
                type="button"
                className="martial-detail-toggle"
                onClick={() => setSelectedInventoryMartialId((current) => current === art.id ? undefined : art.id)}
              >
                <div>
                  <b>{art.name}</b>
                  <span>{art.category === "internal" ? "内功" : "外功"}</span>
                </div>
                <small>{art.damageDice}{art.damageBonus ? ` +${art.damageBonus}` : ""}</small>
              </button>

              {selectedInventoryMartial?.id === art.id && (
                <div className="martial-detail-card">
                  <small>类别：{art.category === "internal" ? "内功" : "外功"}</small>
                  <small>等级：{art.grade}</small>
                  <small>来源：{art.source}</small>
                  <small>对应属性：{art.linkedAbility.toUpperCase()}</small>
                  <small>伤害：{art.damageDice}{art.damageBonus ? ` +${art.damageBonus}` : ""}</small>
                  <small>耗气：{art.category === "internal" ? art.baseQiCost : 0}</small>
                  {art.effectText && <small>招式说明：{art.effectText}</small>}
                  {tagDetails.length > 0 ? (
                    <div className="martial-effect-list">
                      {tagDetails.map((detail) => (
                        <small key={detail.tag}>
                          {detail.label}：{detail.description}
                        </small>
                      ))}
                    </div>
                  ) : (
                    <small>特殊效果：无，按基础命中与伤害结算。</small>
                  )}
                </div>
              )}
            </article>
          );
        })}
      </section>
    </div>
  );
}
