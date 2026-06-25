import { Download, Sparkles, Upload, Volume2, VolumeX } from "lucide-react";
import { useState, type ChangeEvent, type MutableRefObject } from "react";
import { enemyPresets, martialArtCatalog, studySourceRegistry } from "../../data";
import type { ApiConfig, GameState, StudyRouteKey, StudyTier } from "../../types";
import { clearDiagnostics, readDiagnostics } from "../diagnostics";
import { DS_FLASH_MODEL, DS_PRO_MODEL, PROVIDER_DEFAULTS, PROVIDER_OPTIONS } from "../sessionShared";
import type { ApiTestState } from "../sessionTypes";

type SystemTabProps = {
  game: GameState;
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
  devStartCombat: (enemyName: string) => void;
  devEndCombat: () => void;
  devRecoverHero: () => void;
  devGrantMartialArt: (artId: string) => void;
  devGrantInternalManual: (artId: string) => void;
  devRaiseCultivationRank: () => void;
};

const routeLabels: Record<StudyRouteKey, string> = {
  str: "力道线",
  dex: "身法线",
  int: "悟性线",
  wis: "心境线"
};

const tierLabels: Record<StudyTier, string> = {
  starter: "起手",
  advanced: "进阶",
  mid: "中段",
  upper_prelude: "上乘前置",
  high_chance: "高阶机缘"
};

export function SystemTab({
  game,
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
  setSfxVolume,
  devStartCombat,
  devEndCombat,
  devRecoverHero,
  devGrantMartialArt,
  devGrantInternalManual,
  devRaiseCultivationRank
}: SystemTabProps) {
  const internalArts = martialArtCatalog.filter((art) => art.category === "internal");
  const [selectedEnemyName, setSelectedEnemyName] = useState(enemyPresets[0]?.name || "");
  const [selectedArtId, setSelectedArtId] = useState(martialArtCatalog[0]?.id || "");
  const [selectedInternalArtId, setSelectedInternalArtId] = useState(internalArts[0]?.id || "");
  const [devUnlockClicks, setDevUnlockClicks] = useState(0);
  const [devPanelUnlocked, setDevPanelUnlocked] = useState(false);
  const [, setDiagnosticsRefresh] = useState(0);
  const diagnostics = readDiagnostics();

  function handleDevUnlockClick() {
    if (devPanelUnlocked) return;
    setDevUnlockClicks((current) => {
      const next = current + 1;
      if (next >= 7) {
        setDevPanelUnlocked(true);
        return 0;
      }
      return next;
    });
  }

  const registryRows = studySourceRegistry.map((route) => {
    const learned = route.artId ? game.character.martialArts.some((art) => art.id === route.artId) : false;
    const pending = route.artId ? game.pendingStudies.some((entry) => entry.artId === route.artId) : false;
    const onsite = route.artId ? game.studySources.some((entry) => entry.artId === route.artId) : false;
    const discovered = game.storyFlags.includes(`study-source:${route.id}:discovered`) || game.storyFlags.includes(`study-hint:${route.id}`);

    let status = "未触发";
    if (learned) status = "已掌握";
    else if (pending) status = "待掌握";
    else if (onsite) status = "现场来源";
    else if (discovered) status = route.accessLevel === "hint" ? "仅线索" : "已发现";

    return {
      ...route,
      status
    };
  });

  const byLocation = Object.entries(
    registryRows.reduce<Record<string, { total: number; discovered: number; learned: number }>>((acc, route) => {
      const current = acc[route.locationId] || { total: 0, discovered: 0, learned: 0 };
      current.total += 1;
      if (route.status !== "未触发") current.discovered += 1;
      if (route.status === "已掌握") current.learned += 1;
      acc[route.locationId] = current;
      return acc;
    }, {})
  );

  const byRoute = Object.entries(
    registryRows.reduce<Record<StudyRouteKey, Record<StudyTier, number>>>((acc, route) => {
      const routeBucket = acc[route.routeKey] || {
        starter: 0,
        advanced: 0,
        mid: 0,
        upper_prelude: 0,
        high_chance: 0
      };
      routeBucket[route.tier] += 1;
      acc[route.routeKey] = routeBucket;
      return acc;
    }, {} as Record<StudyRouteKey, Record<StudyTier, number>>)
  ) as Array<[StudyRouteKey, Record<StudyTier, number>]>;
  const taggedArts = martialArtCatalog.filter((art) => art.tags?.length);
  const enemyArchetypes = new Set(enemyPresets.map((enemy) => enemy.archetype));
  const sourcedArtIds = new Set(studySourceRegistry.map((route) => route.artId).filter(Boolean));
  const unsourcedArts = martialArtCatalog.filter((art) => !sourcedArtIds.has(art.id));
  const highGateIssues = studySourceRegistry.filter((route) =>
    (route.tier === "upper_prelude" || route.tier === "high_chance")
    && (!route.chapterGate || (!(route.prerequisiteArts?.length) && !(route.prerequisiteFlags?.length)))
  );
  const keywordIssues = studySourceRegistry.filter((route) => route.keywords.length === 0);
  const artSourceCounts = studySourceRegistry.reduce<Record<string, number>>((acc, route) => {
    if (!route.artId) return acc;
    acc[route.artId] = (acc[route.artId] || 0) + 1;
    return acc;
  }, {});
  const duplicateArtSources = Object.entries(artSourceCounts).filter(([, count]) => count > 1);

  return (
    <section className="system-panel">
      <article className="system-section">
        <header>
          <b>最近诊断</b>
          <span>黑屏、异常、存储失败都会记录在这里。</span>
        </header>
        <section className="save-panel">
          <button
            type="button"
            onClick={() => {
              clearDiagnostics();
              setDiagnosticsRefresh((value) => value + 1);
            }}
          >
            清除诊断
          </button>
          <p>{diagnostics.length ? `最近 ${Math.min(6, diagnostics.length)} 条记录如下。` : "当前没有诊断记录。"}</p>
          {diagnostics.slice(-6).map((entry) => (
            <article key={entry.id} className="dev-simple-item">
              <strong>{entry.kind}</strong>
              <span>{new Date(entry.at).toLocaleString()}</span>
              <small>{entry.message}{entry.detail ? ` · ${entry.detail}` : ""}</small>
            </article>
          ))}
        </section>
      </article>

      <article className="system-section">
        <header>
          <b className="hidden-dev-trigger" onClick={handleDevUnlockClick}>接口设置</b>
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

      {devPanelUnlocked && (
      <article className="system-section">
        <header>
          <b>开发面板</b>
          <span>只用于内容维护，帮助查看修行来源覆盖、发现状态和路线分层。</span>
        </header>

        <section className="dev-subsection dev-test-panel">
          <b>战斗/成长测试</b>
          <div className="dev-test-grid">
            <label>
              敌人
              <select value={selectedEnemyName} onChange={(event) => setSelectedEnemyName(event.target.value)}>
                {enemyPresets.map((enemy) => (
                  <option key={enemy.name} value={enemy.name}>
                    {enemy.name} · {enemy.archetype}
                  </option>
                ))}
              </select>
            </label>
            <button type="button" onClick={() => selectedEnemyName && devStartCombat(selectedEnemyName)}>
              生成敌人
            </button>
            <button type="button" onClick={devEndCombat} disabled={!game.combat.active}>
              结束战斗
            </button>

            <label>
              武学
              <select value={selectedArtId} onChange={(event) => setSelectedArtId(event.target.value)}>
                {martialArtCatalog.map((art) => (
                  <option key={art.id} value={art.id}>
                    {art.name} · {art.linkedAbility}
                  </option>
                ))}
              </select>
            </label>
            <button type="button" onClick={() => selectedArtId && devGrantMartialArt(selectedArtId)}>
              授予武学
            </button>
            <button type="button" onClick={devRecoverHero}>
              恢复角色
            </button>

            <label>
              内功秘籍
              <select value={selectedInternalArtId} onChange={(event) => setSelectedInternalArtId(event.target.value)}>
                {internalArts.map((art) => (
                  <option key={art.id} value={art.id}>
                    {art.name}
                  </option>
                ))}
              </select>
            </label>
            <button type="button" onClick={() => selectedInternalArtId && devGrantInternalManual(selectedInternalArtId)}>
              授予秘籍
            </button>
            <button type="button" onClick={devRaiseCultivationRank}>
              修为 +1
            </button>
          </div>
        </section>

        <div className="dev-metrics-grid">
          <article className="dev-metric-card">
            <b>{studySourceRegistry.length}</b>
            <small>总修行来源</small>
          </article>
          <article className="dev-metric-card">
            <b>{registryRows.filter((row) => row.status !== "未触发").length}</b>
            <small>已触达来源</small>
          </article>
          <article className="dev-metric-card">
            <b>{registryRows.filter((row) => row.status === "已掌握").length}</b>
            <small>已掌握武学</small>
          </article>
          <article className="dev-metric-card">
            <b>{game.pendingStudies.length}</b>
            <small>待掌握招式</small>
          </article>
          <article className="dev-metric-card">
            <b>{game.cultivationRank}</b>
            <small>修为 Rank</small>
          </article>
          <article className="dev-metric-card">
            <b>{game.internalStyles.length}</b>
            <small>已参照功法</small>
          </article>
          <article className="dev-metric-card">
            <b>{taggedArts.length}/{martialArtCatalog.length}</b>
            <small>武学效果覆盖</small>
          </article>
          <article className="dev-metric-card">
            <b>{enemyArchetypes.size}</b>
            <small>敌人类型</small>
          </article>
        </div>

        <div className="dev-grid-two">
          <section className="dev-subsection">
            <b>按地点统计</b>
            <div className="dev-simple-list">
              {byLocation.map(([locationId, stats]) => (
                <article key={locationId}>
                  <strong>{locationId}</strong>
                  <span>{stats.discovered}/{stats.total} 已触达 · {stats.learned} 已掌握</span>
                </article>
              ))}
            </div>
          </section>

          <section className="dev-subsection">
            <b>按路线分层</b>
            <div className="dev-simple-list">
              {byRoute.map(([routeKey, tiers]) => (
                <article key={routeKey}>
                  <strong>{routeLabels[routeKey]}</strong>
                  <span>
                    {Object.entries(tiers)
                      .filter(([, count]) => count > 0)
                      .map(([tier, count]) => `${tierLabels[tier as StudyTier]} ${count}`)
                      .join(" · ")}
                  </span>
                </article>
              ))}
            </div>
          </section>
        </div>

        <section className="dev-subsection">
          <b>覆盖检查</b>
          <div className="dev-check-grid">
            <article className={unsourcedArts.length ? "warn" : "ok"}>
              <strong>{unsourcedArts.length}</strong>
              <span>无来源武学</span>
              <small>{unsourcedArts.slice(0, 4).map((art) => art.name).join("、") || "已覆盖"}</small>
            </article>
            <article className={highGateIssues.length ? "warn" : "ok"}>
              <strong>{highGateIssues.length}</strong>
              <span>高阶门槛问题</span>
              <small>{highGateIssues.slice(0, 4).map((route) => route.name).join("、") || "已设置章节/前置"}</small>
            </article>
            <article className={keywordIssues.length ? "warn" : "ok"}>
              <strong>{keywordIssues.length}</strong>
              <span>缺关键词来源</span>
              <small>{keywordIssues.slice(0, 4).map((route) => route.name).join("、") || "已覆盖"}</small>
            </article>
            <article className={duplicateArtSources.length ? "warn" : "ok"}>
              <strong>{duplicateArtSources.length}</strong>
              <span>重复来源武学</span>
              <small>{duplicateArtSources.slice(0, 4).map(([artId]) => artId).join("、") || "无重复"}</small>
            </article>
          </div>
        </section>

        <section className="dev-subsection">
          <b>来源明细</b>
          <div className="dev-route-table">
            {registryRows.map((row) => (
              <article key={row.id}>
                <div>
                  <strong>{row.name}</strong>
                  <small>{row.locationId} · {routeLabels[row.routeKey]} · {tierLabels[row.tier]}</small>
                </div>
                <span>{row.accessLevel}</span>
                <span>{row.status}</span>
              </article>
            ))}
          </div>
        </section>
      </article>
      )}
    </section>
  );
}
