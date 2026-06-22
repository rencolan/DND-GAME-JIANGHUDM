export { routeLadders, ladderLabels } from "./routeLadders";
export { routeFlag, routeHintFlag } from "./helpers";
export type { StudyRouteDefinition } from "./types";

import { daliWuliangRoutes } from "./daliWuliang";
import { gusuShaoshiRoutes } from "./gusuShaoshi";
import { yanmenXingxiuRoutes } from "./yanmenXingxiu";

export const studySourceRegistry = [
  ...daliWuliangRoutes,
  ...gusuShaoshiRoutes,
  ...yanmenXingxiuRoutes
];
