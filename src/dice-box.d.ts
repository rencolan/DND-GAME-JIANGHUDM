declare module "@3d-dice/dice-box" {
  export type DiceBoxConfig = {
    container?: string | HTMLElement | null;
    assetPath: string;
    theme?: string;
    themeColor?: string;
    scale?: number;
    lightIntensity?: number;
    enableShadows?: boolean;
    offscreen?: boolean;
    suspendSimulation?: boolean;
    preloadThemes?: string[];
  };

  export type DiceBoxRollOptions = {
    theme?: string;
    themeColor?: string;
    newStartPoint?: boolean;
  };

  export default class DiceBox {
    constructor(config?: DiceBoxConfig);
    init(): Promise<void>;
    roll(notation: string, options?: DiceBoxRollOptions): Promise<unknown>;
    clear(): this;
    show(): this;
    hide(className?: string): this;
  }
}
