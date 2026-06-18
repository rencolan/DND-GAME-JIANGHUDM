export type RollPackage = [number, number, number, number, number, number];

export type ApiTestState = {
  status: "idle" | "testing" | "success" | "error";
  message?: string;
};

export type RollingState = {
  label: string;
  total: number;
  detail: string;
};
