import type { SceneType } from "../../types";
import type { MessageVisual } from "./types";

export const npcVisualAliases: Record<string, string[]> = {
  innkeeper: ["掌柜", "客栈掌柜"],
  "duan-yu": ["段誉", "大理世子"],
  "qiao-feng": ["乔峰", "萧峰", "丐帮帮主"],
  "murong-fu": ["慕容复", "姑苏公子"],
  "xu-zhu": ["虚竹", "少林弟子"],
  "wang-yuyan": ["王语嫣"],
  "a-zhu": ["阿朱"],
  "a-zi": ["阿紫"],
  "mu-wanqing": ["木婉清"],
  "shuang-er": ["双儿", "双兒"]
};

export const sceneTypeVisuals: Record<SceneType, Omit<MessageVisual, "id" | "kind"> & { aliases: string[] }> = {
  inn: {
    title: "客栈",
    subtitle: "灯影、人声与歇脚处",
    caption: "屋檐下有短暂停顿，也可能有新的江湖线索。",
    src: "/assets/scene-inn.png",
    alt: "客栈场景",
    aliases: ["客栈", "住店", "歇脚", "前堂", "后院"]
  },
  market: {
    title: "街市",
    subtitle: "人潮与风声混在一处",
    caption: "商贩、行脚人与暗线都在这里交换消息。",
    src: "/assets/scene-market.png",
    alt: "街市场景",
    aliases: ["街市", "坊市", "市集", "茶肆", "城中"]
  },
  tavern: {
    title: "酒肆",
    subtitle: "酒香里最容易听见真话",
    caption: "杯盏声掩着低语，旧案常从酒桌边露头。",
    src: "/assets/scene-tavern.png",
    alt: "酒肆场景",
    aliases: ["酒肆", "酒楼", "酒馆", "喝酒"]
  },
  temple: {
    title: "寺院",
    subtitle: "钟声、石阶与山门",
    caption: "清净地里也有江湖人绕不开的因果。",
    src: "/assets/scene-temple.png",
    alt: "寺院场景",
    aliases: ["寺院", "寺", "少林", "山门", "石阶"]
  },
  palace: {
    title: "府邸",
    subtitle: "深宅水榭，礼数与机锋并行",
    caption: "每一步都像寻常礼节，也像试探。",
    src: "/assets/scene-palace.png",
    alt: "府邸场景",
    aliases: ["府邸", "水榭", "庄子", "楼阁", "藏书楼"]
  },
  brothel: {
    title: "花楼",
    subtitle: "红灯照处，消息流得最快",
    caption: "香风不只遮人耳目，也能放大危险。",
    src: "/assets/scene-brothel.png",
    alt: "花楼场景",
    aliases: ["花楼", "红灯", "楼中"]
  }
};

export const locationSceneVisuals: Record<string, Omit<MessageVisual, "id" | "kind"> & { aliases: string[] }> = {
  dali: {
    title: "大理城",
    subtitle: "苍山洱海之间的江湖入口",
    caption: "城中消息灵通，客栈、坊市和官道都牵着无量山的风声。",
    src: "/assets/scenes/location-dali.png",
    alt: "大理城场景",
    aliases: ["大理城", "大理", "苍山", "洱海"]
  },
  wuliang: {
    title: "无量山",
    subtitle: "山路深曲，草木藏话",
    caption: "山道、石壁与残痕都可能指向一门未成形的武学。",
    src: "/assets/scenes/location-wuliang.png",
    alt: "无量山场景",
    aliases: ["无量山", "无量", "山道", "石壁"]
  },
  gusu: {
    title: "姑苏",
    subtitle: "水路纵横，世家深院",
    caption: "看似温雅的园林里，藏着更细密的武学与人心。",
    src: "/assets/scenes/location-gusu.png",
    alt: "姑苏场景",
    aliases: ["姑苏", "燕子坞", "水榭", "藏书楼"]
  },
  shaoshi: {
    title: "少室山",
    subtitle: "钟声入云，山门森严",
    caption: "正宗门墙之下，试炼常比话语更直接。",
    src: "/assets/scenes/location-shaoshi.png",
    alt: "少室山场景",
    aliases: ["少室山", "少室", "少林", "山门"]
  },
  yanmen: {
    title: "雁门关",
    subtitle: "风沙极硬，旧案未冷",
    caption: "关外每一阵风都像在翻旧账。",
    src: "/assets/scenes/location-yanmen.png",
    alt: "雁门关场景",
    aliases: ["雁门关", "雁门", "关外", "边关"]
  },
  xingxiu: {
    title: "星宿海",
    subtitle: "毒雾与怪笑同起",
    caption: "越靠近这里，越要分清机缘和陷阱。",
    src: "/assets/scenes/location-xingxiu.png",
    alt: "星宿海场景",
    aliases: ["星宿海", "星宿", "毒雾"]
  }
};
