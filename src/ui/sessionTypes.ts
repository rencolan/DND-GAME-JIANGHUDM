export type RollPackage = [number, number, number, number, number, number];

export type ApiTestState = {
  status: "idle" | "testing" | "success" | "error";
  message?: string;
};

export type DiceGroup = {
  qty: number;
  sides: number;
};

export type RollingResolutionMode = "sum" | "first" | "highest" | "lowest" | "dropLowestSum";

export type RollingResolution = {
  mode: RollingResolutionMode;
  bonus?: number;
  bonusLabel?: string;
};

export type RollingState = {
  label: string;
  notation: string;
  diceGroups: DiceGroup[];
  animationKey: string;
  resolution: RollingResolution;
  settleMode?: "auto" | "engine";
};

export type RollingResult = {
  notation: string;
  diceGroups: DiceGroup[];
  faceResults: number[];
  diceTotal: number;
  resolvedValue: number;
  total: number;
  fallback: boolean;
};
