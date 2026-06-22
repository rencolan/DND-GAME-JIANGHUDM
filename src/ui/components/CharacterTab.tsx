import { abilityModifier, injuryTickDamage, injuryTierLabel } from "../../game/rules";
import { primaryRouteForNpc } from "../../game/world";
import type { GameState } from "../../types";
import { abilityDefinitions, abilityLabels, relationshipRouteStageLabel, relationshipTierLabel } from "../display";

type CharacterTabProps = {
  game: GameState;
  selectedAbilityInfoKey?: string;
  setSelectedAbilityInfoKey: (value: string | undefined | ((current: string | undefined) => string | undefined)) => void;
  activeRelationshipNpcs: GameState["npcs"];
  studyManual: (itemId: string) => void;
  practicePendingArt: (studyId: string) => void;
  practiceOnsiteSource: (sourceId: string) => void;
  cultivateQi: () => void;
  meditateRecovery: () => void;
  claimAttributeInsight: (abilityKey: string) => void;
};

function relationshipTier(relationship: number) {
  if (relationship >= 80) return "devoted";
  if (relationship >= 65) return "confidant";
  if (relationship >= 50) return "trusted";
  if (relationship >= 35) return "familiar";
  return "stranger";
}

function studyStageLabel(stage: GameState["pendingStudies"][number]["stage"]) {
  if (stage === "studying") return "研习中";
  if (stage === "mastered") return "已掌握";
  return "初得门径";
}

export function CharacterTab({
  game,
  selectedAbilityInfoKey,
  setSelectedAbilityInfoKey,
  activeRelationshipNpcs,
  studyManual,
  practicePendingArt,
  practiceOnsiteSource,
  cultivateQi,
  meditateRecovery,
  claimAttributeInsight
}: CharacterTabProps) {
  const innerInjury = game.innerInjury || 0;
  const innerTier = injuryTierLabel(innerInjury);
  const innerTick = injuryTickDamage(innerInjury);
  const currentLocationId = game.locations.find((location) => location.current)?.id;
  const manuals = game.character.inventory.filter((item) => item.type === "manual" && item.manualArtId);
  const pendingStudies = game.pendingStudies.filter((entry) =>
    !game.character.martialArts.some((art) => art.id === entry.artId)
  );
  const onsiteSources = game.studySources.filter((source) =>
    source.locationId === currentLocationId && !game.character.martialArts.some((art) => art.id === source.artId)
  );

  return (
    <div className="drawer-grid">
      <section className="hero-card">
        <img src={game.character.portrait} alt={`${game.character.name}立绘`} />
        <div>
          <h2>{game.character.name}</h2>
          <p>{game.character.title}</p>
          <div className="bar-label"><span>生命</span><b>{game.character.hp}/{game.character.maxHp}</b></div>
          <div className="bar"><span className="hp" style={{ width: `${(game.character.hp / Math.max(1, game.character.maxHp)) * 100}%` }} /></div>
          <div className="bar-label"><span>内力</span><b>{game.character.qi}/{game.character.maxQi}</b></div>
          <div className="bar"><span className="qi" style={{ width: `${game.character.maxQi ? (game.character.qi / game.character.maxQi) * 100 : 0}%` }} /></div>
          <p className="inner-state">银两 {game.character.silver}</p>
          <p className="inner-state">内伤 {innerInjury} · {innerTier} · 每行动 -{innerTick} HP</p>
          <p className="inner-state">真气成长 +{game.qiGrowthBonus} / {game.qiBreakthroughCap} · 修炼进度 {game.qiTrainingProgress}/3</p>
        </div>
      </section>

      <section className="stat-grid">
        {game.character.abilities.map((ability) => (
          <button
            key={ability.key}
            type="button"
            onClick={() => setSelectedAbilityInfoKey((current) => current === ability.key ? undefined : ability.key)}
          >
            <span>{ability.label}</span>
            <b>{ability.value}</b>
            <em>{abilityModifier(ability.value) >= 0 ? "+" : ""}{abilityModifier(ability.value)}</em>
          </button>
        ))}
      </section>

      {selectedAbilityInfoKey && (
        <article className="origin-hook">
          <b>{abilityDefinitions[selectedAbilityInfoKey].title}</b>
          <span>{abilityDefinitions[selectedAbilityInfoKey].text}</span>
        </article>
      )}

      <section className="training-panel">
        <div className="training-header">
          <h3>修行</h3>
          <small>新招式需先得门径，再逐步掌握；已掌握武学不在这里重复刷熟练。</small>
        </div>

        <div className="training-group">
          <div className="training-group-head">
            <b>待掌握招式</b>
            <span>{pendingStudies.length} 门</span>
          </div>
          {pendingStudies.length > 0 ? pendingStudies.map((entry) => (
            <article key={entry.id} className="study-card">
              <div className="study-card-main">
                <div className="study-card-top">
                  <b>{entry.name}</b>
                  <span>{entry.category === "internal" ? "内功" : "技法"} · {studyStageLabel(entry.stage)}</span>
                </div>
                <small>来源：{entry.sourceLabel || entry.sourceKind} · 进度 {entry.progress}/{entry.requiredProgress}</small>
              </div>
              <button type="button" onClick={() => practicePendingArt(entry.id)}>演练招式</button>
            </article>
          )) : (
            <p className="empty-state">眼下还没有待掌握的新招式。先去秘笈、遗迹、石壁、残谱或前辈指点里找门路。</p>
          )}

          {manuals.length > 0 && (
            <div className="study-manual-list">
              {manuals.map((item) => (
                <article key={item.id} className="study-card manual">
                  <div className="study-card-main">
                    <div className="study-card-top">
                      <b>{item.name}</b>
                      <span>秘笈</span>
                    </div>
                    <small>{item.desc}</small>
                  </div>
                  <button type="button" onClick={() => studyManual(item.id)}>研读秘笈</button>
                </article>
              ))}
            </div>
          )}
        </div>

        <div className="training-group">
          <div className="training-group-head">
            <b>当前地点可参悟</b>
            <span>{onsiteSources.length} 处</span>
          </div>
          {onsiteSources.length > 0 ? onsiteSources.map((source) => {
            const cooldownBlocked = (source.cooldownUntilActionCount || 0) > game.actionCount;
            const refreshBlocked = source.requiresSceneRefresh && !source.refreshedSinceFailure;
            const blocked = cooldownBlocked || refreshBlocked;
            return (
              <article key={source.id} className="study-card">
                <div className="study-card-main">
                  <div className="study-card-top">
                    <b>{source.name}</b>
                    <span>{source.sourceLabel || "现场来源"}</span>
                  </div>
                  <small>
                    {blocked
                      ? "这处门路刚试过一次，先让局势往前走两步再回来。"
                      : "可直接现场参悟，成功会推进掌握进度。"}
                  </small>
                </div>
                <button type="button" onClick={() => practiceOnsiteSource(source.id)} disabled={blocked}>现场参悟</button>
              </article>
            );
          }) : (
            <p className="empty-state">当前地点没有可直接参悟的新门路。</p>
          )}
        </div>

        <div className="training-group">
          <div className="training-group-head">
            <b>内功修炼 / 调息疗伤</b>
            <span>稳步成长</span>
          </div>
          <div className="training-actions">
            <article className="training-action-card">
              <b>内功修炼</b>
              <small>成功时推进 Qi 上限成长；失败时有概率岔气伤脉。</small>
              <button type="button" onClick={cultivateQi}>内功修炼</button>
            </article>
            <article className="training-action-card">
              <b>调息疗伤</b>
              <small>用于缓和内伤并回一口气，不走属性刷点路线。</small>
              <button type="button" onClick={meditateRecovery}>调息疗伤</button>
            </article>
          </div>
        </div>

        {game.availableAttributeInsights.length > 0 && (
          <div className="training-group">
            <div className="training-group-head">
              <b>心得领悟</b>
              <span>{game.availableAttributeInsights.length} 次</span>
            </div>
            {game.availableAttributeInsights.map((insight) => (
              <article key={insight.id} className="insight-card">
                <div>
                  <b>{insight.reason || "一段新的领悟"}</b>
                  <small>只能从给定候选里择一，不走日常刷属性路线。</small>
                </div>
                <div className="insight-actions">
                  {insight.choices.map((choice) => (
                    <button key={choice} type="button" onClick={() => claimAttributeInsight(choice)}>
                      {abilityLabels[choice] || choice.toUpperCase()} +1
                    </button>
                  ))}
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      {activeRelationshipNpcs.length > 0 && (
        <section className="relationship-route-panel">
          <h3>特别的人</h3>
          {activeRelationshipNpcs.slice(0, 3).map((npc) => {
            const route = primaryRouteForNpc(game, npc.id);
            return (
              <article key={npc.id}>
                <b>{npc.name}</b>
                <span>{relationshipTierLabel(relationshipTier(npc.relationship))} · {route ? relationshipRouteStageLabel(route.stage, route.kind) : "未起线"}</span>
                <p>{route?.note || npc.goal}</p>
              </article>
            );
          })}
        </section>
      )}
    </div>
  );
}
