import { Download, Sparkles, Upload, Volume2, VolumeX } from "lucide-react";
import type { ChangeEvent, MutableRefObject } from "react";
import type { ApiConfig } from "../../types";
import { DS_FLASH_MODEL, DS_PRO_MODEL, PROVIDER_DEFAULTS, PROVIDER_OPTIONS } from "../sessionShared";
import type { ApiTestState } from "../sessionTypes";

type SystemTabProps = {
  api: ApiConfig;
  setApi: (updater: (prev: ApiConfig) => ApiConfig) => void;
  applyDeepSeekPreset: (model: string) => void;
  runApiTest: () => Promise<void>;
  apiTest: ApiTestState;
  exportSave: () => void;
  resetGame: () => void;
  importSave: (event: ChangeEvent<HTMLInputElement>) => void;
  fileInputRef: MutableRefObject<HTMLInputElement | null>;
  toggleMusic: () => void;
  musicEnabled: boolean;
  bgmVolume: number;
  setBgmVolume: (value: number) => void;
  toggleSfx: () => void;
  sfxEnabled: boolean;
  sfxVolume: number;
  setSfxVolume: (value: number) => void;
};

export function SystemTab({
  api,
  setApi,
  applyDeepSeekPreset,
  runApiTest,
  apiTest,
  exportSave,
  resetGame,
  importSave,
  fileInputRef,
  toggleMusic,
  musicEnabled,
  bgmVolume,
  setBgmVolume,
  toggleSfx,
  sfxEnabled,
  sfxVolume,
  setSfxVolume
}: SystemTabProps) {
  return (
    <section className="system-panel">
      <article className="system-section">
        <header>
          <b>接口设置</b>
        </header>

        <label>
          Provider
          <select value={api.provider} onChange={(event) => setApi((prev) => ({ ...prev, provider: event.target.value as ApiConfig["provider"] }))}>
            {PROVIDER_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </label>

        <div className="api-presets">
          <button type="button" onClick={() => applyDeepSeekPreset(DS_FLASH_MODEL)}>
            DS Flash
          </button>
          <button type="button" onClick={() => applyDeepSeekPreset(DS_PRO_MODEL)}>
            DS Pro
          </button>
        </div>

        <label>
          API URL
          <input
            value={api.apiUrl}
            placeholder={PROVIDER_DEFAULTS[api.provider].apiUrl || "https://your-api.example/v1/chat/completions"}
            onChange={(event) => setApi((prev) => ({ ...prev, apiUrl: event.target.value }))}
          />
        </label>

        <label>
          Model
          <input
            value={api.model}
            placeholder={PROVIDER_DEFAULTS[api.provider].model || "输入模型名"}
            onChange={(event) => setApi((prev) => ({ ...prev, model: event.target.value }))}
          />
        </label>

        <label>
          API Key
          <input
            type="password"
            value={api.apiKey}
            onChange={(event) => setApi((prev) => ({ ...prev, apiKey: event.target.value }))}
          />
        </label>

        <button
          type="button"
          className="system-primary"
          onClick={() => void runApiTest()}
          disabled={apiTest.status === "testing"}
        >
          {apiTest.status === "testing" ? "测试中..." : "测试连通"}
        </button>

        {apiTest.status !== "idle" && <p>{apiTest.message}</p>}
      </article>

      <article className="system-section">
        <header>
          <b>存档管理</b>
          <span>导入、导出和重新开局都在这里。</span>
        </header>

        <section className="save-panel">
          <button type="button" onClick={exportSave}>
            <Download size={18} />
            导出存档
          </button>
          <button type="button" onClick={() => fileInputRef.current?.click()}>
            <Upload size={18} />
            导入存档
          </button>
          <button type="button" onClick={resetGame}>
            <Sparkles size={18} />
            重新开局
          </button>
          <input ref={fileInputRef} type="file" accept="application/json" onChange={importSave} hidden />
          <p>当前人物和世界状态会自动保存在本地浏览器里。</p>
        </section>
      </article>

      <article className="system-section">
        <header>
          <b>江湖配乐</b>
        </header>

        <section className="save-panel">
          <button type="button" onClick={toggleMusic}>
            {musicEnabled ? <Volume2 size={18} /> : <VolumeX size={18} />}
            {musicEnabled ? "关闭 BGM" : "开启 BGM"}
          </button>
          <label className="volume-control">
            <span>音量</span>
            <b>{bgmVolume}%</b>
            <input
              type="range"
              min="0"
              max="100"
              step="1"
              value={bgmVolume}
              onChange={(event) => setBgmVolume(Number(event.target.value))}
            />
          </label>
          <p>当前曲目：Seven Peaks at Twilight</p>
        </section>
      </article>

      <article className="system-section">
        <header>
          <b>骰子音效</b>
          <span>掷出和落定时会播放短促音效。</span>
        </header>

        <section className="save-panel">
          <button type="button" onClick={toggleSfx}>
            {sfxEnabled ? <Volume2 size={18} /> : <VolumeX size={18} />}
            {sfxEnabled ? "关闭音效" : "开启音效"}
          </button>
          <label className="volume-control">
            <span>音量</span>
            <b>{sfxVolume}%</b>
            <input
              type="range"
              min="0"
              max="100"
              step="1"
              value={sfxVolume}
              onChange={(event) => setSfxVolume(Number(event.target.value))}
            />
          </label>
        </section>
      </article>
    </section>
  );
}
