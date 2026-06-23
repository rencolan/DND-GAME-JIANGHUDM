import { itemCatalog, martialArtCatalog } from "../../data";
import type { Item, MartialArt, Npc } from "../../types";
import { abilityLabels } from "../display";
import { locationSceneVisuals, npcVisualAliases, sceneTypeVisuals } from "../visuals/visualRegistry";
import type { LoreEntity, LoreEntityContext, LoreTextPart } from "./types";

function unique(values: Array<string | undefined>) {
  return [...new Set(values.filter((value): value is string => Boolean(value && value.trim().length >= 2)))];
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function entityPriority(entity: LoreEntity) {
  return {
    npc: 5,
    manual: 4,
    martial: 3,
    location: 2,
    scene: 1
  }[entity.kind];
}

function isVisibleNpc(npc: Npc) {
  return !npc.hidden || npc.discovered || npc.companion;
}

function relationshipTierLabel(value: number) {
  if (value >= 80) return "倾心";
  if (value >= 65) return "知己";
  if (value >= 50) return "信任";
  if (value >= 35) return "顺眼";
  return "生疏";
}

const martialCategoryLabels: Record<MartialArt["category"], string> = {
  external: "外功",
  internal: "内功"
};

function martialLoreImage(art: MartialArt) {
  return art.category === "internal"
    ? "/assets/lore/martial-internal.png"
    : "/assets/lore/martial-external.png";
}

function manualLoreImage(item: Item) {
  return item.dangerous
    ? "/assets/lore/manual-dangerous.png"
    : "/assets/lore/manual-standard.png";
}

function artLabel(art: MartialArt) {
  return `${art.grade} · ${martialCategoryLabels[art.category]} · ${abilityLabels[art.linkedAbility] || art.linkedAbility}`;
}

function artFields(art: MartialArt) {
  return [
    { label: "品级", value: art.grade },
    { label: "类型", value: martialCategoryLabels[art.category] || art.category },
    { label: "主属性", value: abilityLabels[art.linkedAbility] || art.linkedAbility },
    { label: "伤害", value: `${art.damageDice}${art.damageBonus ? ` + ${art.damageBonus}` : ""}` },
    { label: "真气消耗", value: String(art.baseQiCost) },
    art.tags?.length ? { label: "效果标签", value: art.tags.join(" / ") } : undefined,
    art.effectText ? { label: "招式效果", value: art.effectText } : undefined,
    { label: "来源", value: art.source }
  ].filter((field): field is { label: string; value: string } => Boolean(field));
}

function manualFields(item: Item, art?: MartialArt) {
  return [
    { label: "物品类型", value: "功法秘笈" },
    item.routeKey ? { label: "路线", value: abilityLabels[item.routeKey] || item.routeKey } : undefined,
    item.requiredProgress ? { label: "掌握进度", value: `${item.requiredProgress} 次成功` } : undefined,
    item.dangerous ? { label: "风险", value: "失败可能引发内伤" } : undefined,
    art ? { label: "对应功法", value: art.name } : undefined,
    item.value ? { label: "价值", value: `${item.value} 银` } : undefined
  ].filter((field): field is { label: string; value: string } => Boolean(field));
}

function buildNpcEntities(context: LoreEntityContext): LoreEntity[] {
  return context.npcs
    .filter((npc) => isVisibleNpc(npc))
    .map((npc) => ({
      id: `npc:${npc.id}`,
      kind: "npc",
      name: npc.name,
      aliases: unique([npc.name, npc.title, ...(npcVisualAliases[npc.id] || [])]),
      title: npc.title,
      subtitle: `${npc.location} · ${npc.attitude}`,
      description: npc.goal,
      image: npc.portrait,
      fields: [
        { label: "所在地", value: npc.location },
        { label: "关系", value: `${relationshipTierLabel(npc.relationship)} · ${npc.attitude}` },
        { label: "状态", value: npc.status },
        { label: "最近出现", value: npc.lastSeen },
        npc.tags.length ? { label: "标签", value: npc.tags.join(" / ") } : undefined
      ].filter((field): field is { label: string; value: string } => Boolean(field))
    }));
}

function buildLocationEntities(context: LoreEntityContext): LoreEntity[] {
  return context.locations
    .filter((location) => location.unlocked || location.current)
    .map((location) => {
      const visual = locationSceneVisuals[location.id] || sceneTypeVisuals[context.sceneType];
      return {
        id: `location:${location.id}`,
        kind: "location",
        name: location.name,
        aliases: unique([location.name, ...(locationSceneVisuals[location.id]?.aliases || [])]),
        title: "地点",
        subtitle: location.current ? "当前所在地" : "已解锁地点",
        description: location.desc,
        image: visual.src,
        fields: [
          { label: "状态", value: location.current ? "当前所在地" : "可前往" },
          { label: "地图位置", value: `${location.x}, ${location.y}` }
        ]
      };
    });
}

function buildMartialEntities(): LoreEntity[] {
  return martialArtCatalog.map((art) => ({
    id: `martial:${art.id}`,
    kind: "martial",
    name: art.name,
    aliases: unique([art.name, art.source]),
    title: artLabel(art),
    subtitle: art.role ? `定位：${art.role}` : undefined,
    description: art.effectText || art.source,
    image: martialLoreImage(art),
    fields: artFields(art),
    relatedArt: art
  }));
}

function buildManualEntities(): LoreEntity[] {
  return itemCatalog
    .filter((item) => item.type === "manual" || item.manualArtId)
    .map((item) => {
      const art = item.manualArtId ? martialArtCatalog.find((entry) => entry.id === item.manualArtId) : undefined;
      return {
        id: `manual:${item.id}`,
        kind: "manual",
        name: item.name,
        aliases: unique([item.name, art?.name, art?.source]),
        title: "功法秘笈",
        subtitle: art ? `可参照修炼：${art.name}` : undefined,
        description: item.desc,
        image: manualLoreImage(item),
        fields: manualFields(item, art),
        relatedArt: art,
        relatedItem: item
      };
    });
}

function buildSceneEntities(context: LoreEntityContext): LoreEntity[] {
  return Object.entries(sceneTypeVisuals).map(([sceneType, scene]) => ({
    id: `scene:${sceneType}`,
    kind: "scene",
    name: scene.title,
    aliases: unique([scene.title, ...scene.aliases]),
    title: "场景",
    subtitle: context.sceneType === sceneType ? "当前场景类型" : undefined,
    description: scene.caption,
    image: scene.src,
    fields: [{ label: "氛围", value: scene.subtitle || scene.title }]
  }));
}

export function buildLoreEntities(context: LoreEntityContext): LoreEntity[] {
  const entities = [
    ...buildNpcEntities(context),
    ...buildLocationEntities(context),
    ...buildManualEntities(),
    ...buildMartialEntities(),
    ...buildSceneEntities(context)
  ];

  return entities.filter((entity, index) => entities.findIndex((item) => item.id === entity.id) === index);
}

export function splitTextByLoreEntities(text: string, entities: LoreEntity[]): LoreTextPart[] {
  if (!text || entities.length === 0) return [{ kind: "text", text }];

  const mentions = entities
    .flatMap((entity) => entity.aliases.map((alias) => ({ entity, alias })))
    .filter(({ alias }) => alias.length >= 2)
    .sort((a, b) => b.alias.length - a.alias.length || entityPriority(b.entity) - entityPriority(a.entity));

  const parts: LoreTextPart[] = [];
  let cursor = 0;

  while (cursor < text.length) {
    const match = mentions
      .map(({ entity, alias }) => {
        const found = text.slice(cursor).search(new RegExp(escapeRegExp(alias)));
        return found < 0 ? undefined : { entity, alias, index: cursor + found };
      })
      .filter((item): item is { entity: LoreEntity; alias: string; index: number } => Boolean(item))
      .sort((a, b) => a.index - b.index || b.alias.length - a.alias.length || entityPriority(b.entity) - entityPriority(a.entity))[0];

    if (!match) {
      parts.push({ kind: "text", text: text.slice(cursor) });
      break;
    }

    if (match.index > cursor) {
      parts.push({ kind: "text", text: text.slice(cursor, match.index) });
    }

    parts.push({ kind: "entity", text: text.slice(match.index, match.index + match.alias.length), entity: match.entity });
    cursor = match.index + match.alias.length;
  }

  return parts;
}
