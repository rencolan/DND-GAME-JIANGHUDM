import type { GameState, Item } from "../../types";

type InventoryTabProps = {
  game: GameState;
  selectedInventoryMartialId?: string;
  setSelectedInventoryMartialId: (value: string | undefined | ((current: string | undefined) => string | undefined)) => void;
  useItem: (item: Item) => void;
};

export function InventoryTab({
  game,
  selectedInventoryMartialId,
  setSelectedInventoryMartialId,
  useItem
}: InventoryTabProps) {
  const selectedInventoryMartial = game.character.martialArts.find((art) => art.id === selectedInventoryMartialId);

  return (
    <div className="drawer-grid">
      <section className="list">
        {game.character.inventory.length > 0 ? (
          game.character.inventory.map((item) => (
            <article key={item.id}>
              <div>
                <b>{item.name}</b>
                <p>{item.desc}</p>
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
        {game.character.martialArts.map((art) => (
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
              </div>
            )}
          </article>
        ))}
      </section>
    </div>
  );
}
