export function routeFlag(routeId: string) {
  return `study-source:${routeId}:discovered`;
}

export function routeHintFlag(routeId: string) {
  return `study-hint:${routeId}`;
}
