import { martialArtCatalog } from "../../data";
import {
  abilityModifier,
  injuryTickDamage,
  injuryTierLabel,
  internalStylePracticeThreshold,
  martialTagLabels,
  proficiencyBonus
} from "../../game/rules";
import { primaryRouteForNpc } from "../../game/world";
import type { GameState } from "../../types";
import { abilityDefinitions, abilityLabels, relationshipRouteStageLabel, relationshipTierLabel } from "../display";

const martialArtLookup = new Map(martialArtCatalog.map((art) => [art.id, art]));

type CharacterTabProps = {
  game: GameState;
  selectedAbilityInfoKey?: string;
  setSelectedAbilityInfoKey: (value: string | undefined | ((current: string | undefined) => string | undefined)) => void;
  activeRelationshipNpcs: GameState["npcs"];
  studyManual: (itemId: string) => void;
  cultivateFromManual: (itemId: string) => void;
  practicePendingArt: (studyId: string) => void;
  practiceOnsiteSource: (sourceId: string) => void;
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

function martialCategoryLabel(category: GameState["pendingStudies"][number]["category"]) {
  return category === "internal" ? "内功" : "外功/技法";
}

function styleMasteryText(style: GameState["internalStyles"][number]) {
  const threshold = internalStylePracticeThreshold(style.masteryLevel);
  return `掌握 ${style.masteryLevel} 层 · 进度 ${style.practiceCount}/${threshold} · 已带来真气成长 +${style.totalQiGrowth}`;
}

export function CharacterTab({
  game,
  selectedAbilityInfoKey,
  setSelectedAbilityInfoKey,
  activeRelationshipNpcs,
  studyManual,
  cultivateFromManual,
  practicePendingArt,
  practiceOnsiteSource,
  claimAttributeInsight
}: CharacterTabProps) {
  const innerInjury = game.innerInjury || 0;
  const innerTier = injuryTierLabel(innerInjury);
  const innerTick = injuryTickDamage(innerInjury);
  const innerSeverityClass = innerInjury >= 80
    ? "critical"
    : innerInjury >= 40
      ? "heavy"
      : innerInjury > 0
        ? "light"
        : "calm";
  const currentLocationId = game.locations.find((location) => location.current)?.id;
  const manuals = game.character.inventory.filter((item) => item.type === "manual" && item.manualArtId);
  const pendingStudies = game.pendingStudies.filter((entry) =>
    !game.character.martialArts.some((art) => art.id === entry.artId)
  );
  const onsiteSources = game.studySources.filter((source) =>
    source.locationId === currentLocationId && !game.character.martialArts.some((art) => art.id === source.artId)
  );
  const prof = proficiencyBonus(game.cultivationRank);

  return (
    <div className="drawer-grid">
      <section className="hero-card">
        <img src={game.character.portrait} alt={`${game.character.name}立绘`} />
        <div>
          <h2>{game.character.name}</h2>
          <p>{game.character.title}</p>
          <div className="bar-label"><span>生命</span><b>{game.character.hp}/{game.character.maxHp}</b></div>
          <div className="bar"><span className="hp" style={{ width: `${(game.character.hp / Math.max(1, game.character.maxHp)) * 100}%` }} /></div>
          <div className="bar-label"><span>真气</span><b>{game.character.qi}/{game.character.maxQi}</b></div>
          <div className="bar"><span className="qi" style={{ width: `${game.character.maxQi ? (game.character.qi / game.character.maxQi) * 100 : 0}%` }} /></div>
          <div className={`injury-banner ${innerSeverityClass}`}>
            <div className="injury-banner-top">
              <strong>内伤 {innerInjury}</strong>
              <span>{innerTier}</span>
            </div>
            <small>{innerTick > 0 ? `每次正式行动后 -${innerTick} HP` : "当前不会持续掉血"}</small>
          </div>
          <div className="growth-strip">
            <span>修为 Rank {game.cultivationRank}</span>
            <b>熟练 +{prof}</b>
            <span>真气成长 +{game.qiGrowthBonus}</span>
          </div>
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
          <small>属性定路线，修为给熟练，武学是动作，功法是底盘。内功修炼必须参照已有秘籍或功法来源。</small>
        </div>

        <div className="training-group">
          <div className="training-group-head">
            <b>已参照功法</b>
            <span>{game.internalStyles.length} 门</span>
          </div>
          {game.internalStyles.length > 0 ? game.internalStyles.map((style) => (
            <article key={style.artId} className={`study-card ${game.activeInternalArtId === style.artId ? "active" : ""}`}>
              <div className="study-card-main">
                <div className="study-card-top">
                  <b>{style.name}</b>
                  <span>{game.activeInternalArtId === style.artId ? "主运功法" : `风险 ${style.riskLevel}`}</span>
                </div>
                <small>{styleMasteryText(style)}</small>
              </div>
            </article>
          )) : (
            <p className="empty-state">还没有参照过内功秘籍。拿到内功抄本后，可在下方选择“参照修炼”。</p>
          )}
        </div>

        <div className="training-group">
          <div className="training-group-head">
            <b>待掌握招式</b>
            <span>{pendingStudies.length} 门</span>
          </div>
          {pendingStudies.length > 0 ? pendingStudies.map((entry) => {
            const art = martialArtLookup.get(entry.artId);
            return (
              <article key={entry.id} className="study-card">
                <div className="study-card-main">
                  <div className="study-card-top">
                    <b>{entry.name}</b>
                    <span>{martialCategoryLabel(entry.category)} · {studyStageLabel(entry.stage)}</span>
                  </div>
                  <small>来源：{entry.sourceLabel || entry.sourceKind} · 进度 {entry.progress}/{entry.requiredProgress}</small>
                  {art?.effectText && <small>效果：{art.effectText}</small>}
                </div>
                <button type="button" onClick={() => practicePendingArt(entry.id)}>演练招式</button>
              </article>
            );
          }) : (
            <p className="empty-state">眼下还没有待掌握的新招式。去秘笈、遗迹、石壁、残谱或前辈指点里找门路。</p>
          )}
        </div>

        {manuals.length > 0 && (
          <div className="training-group">
            <div className="training-group-head">
              <b>秘笈与功法</b>
              <span>{manuals.length} 本</span>
            </div>
            {manuals.map((item) => {
              const art = item.manualArtId ? martialArtLookup.get(item.manualArtId) : undefined;
              const isInternalManual = art?.category === "internal";
              const labels = martialTagLabels(art);

              return (
                <article key={item.id} className="study-card manual">
                  <div className="study-card-main">
                    <div className="study-card-top">
                      <b>{item.name}</b>
                      <span>{isInternalManual ? "内功秘籍" : "武学秘笈"}</span>
                    </div>
                    <small>{item.desc}</small>
                    {art && <small>{art.name} · {art.damageDice} · {labels.join(" / ") || "基础招式"}</small>}
                    {isInternalManual && <small>参照修炼会推进功法掌握度；满门槛后才提升真气成长或解锁底盘收益。</small>}
                  </div>
                  <div className="study-card-actions">
                    <button type="button" onClick={() => studyManual(item.id)}>研读秘笈</button>
                    {isInternalManual && (
                      <button type="button" onClick={() => cultivateFromManual(item.id)}>参照修炼</button>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        )}

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
                      ? "这处门路刚试过，先让局势往前走几步再回来。"
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
                  <small>只能从给定候选里选一项，不走日常刷属性路线。</small>
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
