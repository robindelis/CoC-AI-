import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  WasmBattleSession,
  wasm_compute_no_deploy_json,
} from '../wasm-pkg/coc_wasm';
import {
  BattleEngineState,
  FullCatalog,
} from '../types';
import {
  HERO_SPRITES,
  SPELL_SPRITES,
  TROOP_SPRITES,
} from '../assetsManifest';
import { BattlefieldCanvas, OverlayOptions } from '../canvas/BattlefieldCanvas';
import {
  fetchCVReplays,
  getCVVideoStreamUrl,
  parseCVReplay,
} from './aiClient';
import {
  CVReplayAction,
  CVReplayDossier,
  CVReplaySummaryItem,
} from './aiTypes';

interface Props {
  catalog: FullCatalog;
  overlays: OverlayOptions;
  onToggleOverlay: (key: keyof OverlayOptions) => void;
}

function getUnitIconUrl(slotType: string, unitName: string): string {
  if (slotType === 'Hero' || slotType === 'HeroAbility') {
    return HERO_SPRITES[unitName] ?? TROOP_SPRITES.Barbarian;
  }
  if (slotType === 'Spell') {
    return SPELL_SPRITES[unitName] ?? SPELL_SPRITES.Rage;
  }
  return TROOP_SPRITES[unitName] ?? TROOP_SPRITES.Thrower;
}

function formatClock(sec: number | null | undefined): string {
  if (sec == null || Number.isNaN(sec)) return '03:00';
  const s = Math.max(0, Math.floor(sec));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}`;
}

export const CVReplayStudioView: React.FC<Props> = ({
  catalog,
  overlays,
  onToggleOverlay,
}) => {
  const [replaysList, setReplaysList] = useState<CVReplaySummaryItem[]>([]);
  const [videosList, setVideosList] = useState<string[]>(['samples/pro_attack.mp4']);
  const [activeReplay, setActiveReplay] = useState<CVReplayDossier | null>(null);
  const [selectedMatchId, setSelectedMatchId] = useState<string>('pro_attack_01');

  // Extraction form controls
  const [sourceMode, setSourceMode] = useState<'sample' | 'file' | 'url'>('sample');
  const [filePathInput, setFilePathInput] = useState<string>('samples/pro_attack.mp4');
  const [urlInput, setUrlInput] = useState<string>('');
  const [startInput, setStartInput] = useState<string>('');
  const [endInput, setEndInput] = useState<string>('');
  const [matchIdInput, setMatchIdInput] = useState<string>('pro_attack_01');
  const [isExtracting, setIsExtracting] = useState<boolean>(false);
  const [extractError, setExtractError] = useState<string | null>(null);
  const [videoCacheBust, setVideoCacheBust] = useState<number>(1);

  // CV Overlay visibility toggles
  const [showHudRois, setShowHudRois] = useState<boolean>(true);
  const [showDockBoxes, setShowDockBoxes] = useState<boolean>(true);
  const [showSpawnPuffs, setShowSpawnPuffs] = useState<boolean>(true);

  // Playback & Synchronization state
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [currentTimeSec, setCurrentTimeSec] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [isFinishingSim, setIsFinishingSim] = useState<boolean>(false);
  const [selectedActionIdx, setSelectedActionIdx] = useState<number | null>(null);

  // Right-pane WASM Simulation state
  const simSessionRef = useRef<WasmBattleSession | null>(null);
  const appliedActionCountRef = useRef<number>(0);
  const [simState, setSimState] = useState<BattleEngineState | null>(null);
  const [noDeployMask, setNoDeployMask] = useState<boolean[][]>([]);
  const [selectedEntity, setSelectedEntity] = useState<{
    kind: 'building' | 'unit';
    id: number;
  } | null>(null);

  const disposeSimSession = useCallback(() => {
    const prev = simSessionRef.current;
    simSessionRef.current = null;
    if (prev) {
      try {
        prev.free();
      } catch {
        // ignore
      }
    }
  }, []);

  const initSimFromReplay = useCallback(
    (replay: CVReplayDossier) => {
      disposeSimSession();
      const layoutJson = JSON.stringify(replay.layout);
      const armyJson = JSON.stringify(replay.army);
      try {
        const mask: boolean[][] = JSON.parse(wasm_compute_no_deploy_json(layoutJson));
        setNoDeployMask(mask);
        const sess = new WasmBattleSession(layoutJson, armyJson);
        simSessionRef.current = sess;
        appliedActionCountRef.current = 0;
        setSimState(JSON.parse(sess.get_state_json()));
      } catch (err) {
        console.error('Failed to initialize CV replay simulation session:', err);
      }
    },
    [disposeSimSession]
  );

  const loadReplays = useCallback(
    async (targetMatchId?: string) => {
      const data = await fetchCVReplays(targetMatchId);
      if (!data) return;
      setReplaysList(data.replays ?? []);
      if (data.videos && data.videos.length > 0) {
        setVideosList(data.videos);
      }
      if (data.active_replay) {
        setActiveReplay(data.active_replay);
        setSelectedMatchId(data.active_replay.match_id);
        initSimFromReplay(data.active_replay);
      }
    },
    [initSimFromReplay]
  );

  useEffect(() => {
    loadReplays('pro_attack_01');
    return () => {
      disposeSimSession();
    };
  }, [loadReplays, disposeSimSession]);

  const fps = activeReplay?.source?.fps || 30;
  const videoW = activeReplay?.source?.width || 1280;
  const videoH = activeReplay?.source?.height || 720;
  const currentFrameIdx = Math.max(0, Math.round(currentTimeSec * fps));

  const currentHudFrame = useMemo(() => {
    const timeline = activeReplay?.cv_telemetry?.hud_timeline;
    if (!timeline || timeline.length === 0) return null;
    const idx = Math.min(timeline.length - 1, Math.max(0, currentFrameIdx));
    return timeline[idx] ?? timeline[timeline.length - 1];
  }, [activeReplay, currentFrameIdx]);

  const actionsWithSec = useMemo(() => {
    if (!activeReplay) return [];
    const startSec = activeReplay.battle_segment?.start_sec ?? 0;
    const tps = activeReplay.ticks_per_second || 30;
    return activeReplay.actions.map((act, idx) => {
      const vSec =
        act.video_sec != null ? act.video_sec : startSec + act.tick / tps;
      const fIdx =
        act.frame_idx != null ? act.frame_idx : Math.round(vSec * fps);
      return {
        ...act,
        idx,
        resolvedSec: vSec,
        resolvedFrame: fIdx,
      };
    });
  }, [activeReplay, fps]);

  // Synchronize the WASM simulation to a target action index + elapsed tick
  const syncSimulationToTime = useCallback(
    (targetSec: number, forceRebuild = false) => {
      if (!activeReplay) return;
      let sess = simSessionRef.current;

      const dueActions = actionsWithSec.filter((a) => a.resolvedSec <= targetSec + 0.015);
      const targetCount = dueActions.length;

      if (!sess || forceRebuild || targetCount < appliedActionCountRef.current) {
        disposeSimSession();
        sess = new WasmBattleSession(
          JSON.stringify(activeReplay.layout),
          JSON.stringify(activeReplay.army)
        );
        simSessionRef.current = sess;
        appliedActionCountRef.current = 0;
      }

      while (appliedActionCountRef.current < targetCount) {
        const nextAct = actionsWithSec[appliedActionCountRef.current];
        appliedActionCountRef.current += 1;
        if (nextAct.battle_action) {
          sess.apply_action_json(JSON.stringify(nextAct.battle_action));
        }
        sess.step_ticks(3);
      }

      // Advance combat ticks proportionally as video progresses
      const startSec = activeReplay.battle_segment?.start_sec ?? 0;
      const elapsedSec = Math.max(0, targetSec - startSec);
      const targetEngineTick = Math.min(1800, Math.round(elapsedSec * 15));
      const curState: BattleEngineState = JSON.parse(sess.get_state_json());
      if (targetEngineTick > curState.tick && !curState.is_finished) {
        const delta = Math.min(30, targetEngineTick - curState.tick);
        setSimState(JSON.parse(sess.step_ticks(delta)));
      } else {
        setSimState(curState);
      }
    },
    [activeReplay, actionsWithSec, disposeSimSession]
  );

  // Finish combat simulation after video ends or when user clicks Finish Sim
  useEffect(() => {
    if (!isFinishingSim) return;
    const timer = window.setInterval(() => {
      const sess = simSessionRef.current;
      if (!sess) {
        setIsFinishingSim(false);
        return;
      }
      const next: BattleEngineState = JSON.parse(sess.step_ticks(15));
      setSimState(next);
      if (next.is_finished) {
        setIsFinishingSim(false);
      }
    }, 30);
    return () => window.clearInterval(timer);
  }, [isFinishingSim]);

  const handleVideoTimeUpdate = () => {
    const v = videoRef.current;
    if (!v) return;
    const t = v.currentTime;
    setCurrentTimeSec(t);
    syncSimulationToTime(t, false);
  };

  const handleTogglePlay = () => {
    const v = videoRef.current;
    if (!v) return;
    setIsFinishingSim(false);
    if (v.paused || v.ended) {
      if (v.ended) {
        v.currentTime = 0;
        syncSimulationToTime(0, true);
      }
      v.play().catch(() => {});
      setIsPlaying(true);
    } else {
      v.pause();
      setIsPlaying(false);
    }
  };

  const handleReset = () => {
    setIsFinishingSim(false);
    setSelectedActionIdx(null);
    const v = videoRef.current;
    if (v) {
      v.pause();
      v.currentTime = 0;
    }
    setIsPlaying(false);
    setCurrentTimeSec(0);
    if (activeReplay) {
      initSimFromReplay(activeReplay);
    }
  };

  const handleJumpToAction = (actIdx: number) => {
    const target = actionsWithSec[actIdx];
    if (!target) return;
    setIsFinishingSim(false);
    setSelectedActionIdx(actIdx);
    const v = videoRef.current;
    if (v) {
      v.pause();
      v.currentTime = target.resolvedSec;
    }
    setIsPlaying(false);
    setCurrentTimeSec(target.resolvedSec);
    syncSimulationToTime(target.resolvedSec, true);
  };

  const handleStepNextDrop = () => {
    if (actionsWithSec.length === 0) return;
    const nextIdx =
      selectedActionIdx == null
        ? actionsWithSec.findIndex((a) => a.resolvedSec > currentTimeSec + 0.02)
        : Math.min(actionsWithSec.length - 1, selectedActionIdx + 1);
    const resolvedIdx = nextIdx >= 0 ? nextIdx : 0;
    handleJumpToAction(resolvedIdx);
  };

  const handleRunExtraction = async () => {
    setIsExtracting(true);
    setExtractError(null);
    setIsFinishingSim(false);
    const v = videoRef.current;
    if (v) v.pause();
    setIsPlaying(false);

    const res = await parseCVReplay({
      mode: sourceMode,
      match_id: matchIdInput.trim() || 'pro_attack_01',
      file_path: sourceMode === 'file' ? filePathInput : 'samples/pro_attack.mp4',
      url: sourceMode === 'url' ? urlInput : undefined,
      start: startInput || undefined,
      end: endInput || undefined,
      stride: 1,
    });
    setIsExtracting(false);

    if (!res || !res.success || !res.replay) {
      setExtractError(res?.error || 'CV extraction failed');
      return;
    }

    if (res.replays) setReplaysList(res.replays);
    if (res.videos && res.videos.length > 0) setVideosList(res.videos);
    setActiveReplay(res.replay);
    setSelectedMatchId(res.replay.match_id);
    setVideoCacheBust((c) => c + 1);
    setCurrentTimeSec(0);
    setSelectedActionIdx(null);
    initSimFromReplay(res.replay);
  };

  // Active spawn puffs visible around the current video frame
  const visiblePuffs = useMemo(() => {
    return actionsWithSec.filter((a) => {
      if (a.slot_type === 'HeroAbility' || a.slot_type === 'PopSiege') return false;
      if (selectedActionIdx === a.idx) return true;
      return Math.abs(a.resolvedFrame - currentFrameIdx) <= 7;
    });
  }, [actionsWithSec, currentFrameIdx, selectedActionIdx]);

  const hudRois = activeReplay?.cv_telemetry?.hud_rois;
  const dockSlots = activeReplay?.cv_telemetry?.dock_slots ?? [];
  const videoPath = activeReplay?.source?.video_path || 'samples/pro_attack.mp4';
  const videoStreamUrl = getCVVideoStreamUrl(videoPath, videoCacheBust);

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        width: '100%',
        height: 'calc(100vh - 54px)',
        background: '#0b0f17',
        color: '#e2e8f0',
        overflow: 'hidden',
      }}
    >
      {/* Top Toolbar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 10,
          padding: '8px 14px',
          background: '#111827',
          borderBottom: '1px solid #1e293b',
          flexWrap: 'wrap',
        }}
      >
        {/* Left: Source & Extraction Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <select
            value={sourceMode}
            onChange={(e) => setSourceMode(e.target.value as 'sample' | 'file' | 'url')}
            style={{
              background: '#1e293b',
              color: '#f8fafc',
              border: '1px solid #334155',
              borderRadius: 6,
              padding: '5px 8px',
              fontSize: 12,
              fontWeight: 600,
            }}
          >
            <option value="sample">Sample Pro Attack (Synth 720p)</option>
            <option value="file">Local Video (.mp4)</option>
            <option value="url">YouTube / Twitch URL</option>
          </select>

          {sourceMode === 'file' && (
            <select
              value={filePathInput}
              onChange={(e) => setFilePathInput(e.target.value)}
              style={{
                background: '#0f172a',
                color: '#e2e8f0',
                border: '1px solid #334155',
                borderRadius: 6,
                padding: '5px 8px',
                fontSize: 12,
              }}
            >
              {videosList.map((vp) => (
                <option key={vp} value={vp}>
                  {vp}
                </option>
              ))}
            </select>
          )}

          {sourceMode === 'url' && (
            <>
              <input
                type="text"
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                placeholder="https://www.youtube.com/watch?v=..."
                style={{
                  width: 220,
                  background: '#0f172a',
                  color: '#f8fafc',
                  border: '1px solid #334155',
                  borderRadius: 6,
                  padding: '5px 8px',
                  fontSize: 12,
                }}
              />
              <input
                type="text"
                value={startInput}
                onChange={(e) => setStartInput(e.target.value)}
                placeholder="01:23"
                style={{
                  width: 58,
                  background: '#0f172a',
                  color: '#f8fafc',
                  border: '1px solid #334155',
                  borderRadius: 6,
                  padding: '5px 6px',
                  fontSize: 12,
                }}
              />
              <input
                type="text"
                value={endInput}
                onChange={(e) => setEndInput(e.target.value)}
                placeholder="04:15"
                style={{
                  width: 58,
                  background: '#0f172a',
                  color: '#f8fafc',
                  border: '1px solid #334155',
                  borderRadius: 6,
                  padding: '5px 6px',
                  fontSize: 12,
                }}
              />
            </>
          )}

          <input
            type="text"
            value={matchIdInput}
            onChange={(e) => setMatchIdInput(e.target.value)}
            placeholder="match_id"
            style={{
              width: 130,
              background: '#0f172a',
              color: '#f8fafc',
              border: '1px solid #334155',
              borderRadius: 6,
              padding: '5px 8px',
              fontSize: 12,
            }}
          />

          <button
            className="clash-btn gold"
            onClick={handleRunExtraction}
            disabled={isExtracting}
            style={{ padding: '5px 12px', fontSize: 12 }}
          >
            {isExtracting ? '⏳ Extracting CV...' : '🎥 Extract Replay'}
          </button>

          {replaysList.length > 0 && (
            <select
              value={selectedMatchId}
              onChange={(e) => {
                const nextId = e.target.value;
                setSelectedMatchId(nextId);
                setMatchIdInput(nextId);
                loadReplays(nextId);
              }}
              style={{
                background: '#1e293b',
                color: '#fbbf24',
                border: '1px solid #475569',
                borderRadius: 6,
                padding: '5px 8px',
                fontSize: 12,
                fontWeight: 600,
              }}
            >
              {replaysList.map((r) => (
                <option key={r.match_id} value={r.match_id}>
                  {r.match_id}.json ({r.actions_count} drops)
                </option>
              ))}
            </select>
          )}
        </div>

        {/* Right: Synchronized Transport & Overlay Toggles */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          <button
            className={`clash-btn ${isPlaying ? 'gold' : ''}`}
            onClick={handleTogglePlay}
            style={{ padding: '5px 12px', fontSize: 12 }}
          >
            {isPlaying ? '⏸ Pause' : '▶ Play Sync'}
          </button>
          <button
            className="clash-btn"
            onClick={handleStepNextDrop}
            style={{ padding: '5px 10px', fontSize: 12 }}
          >
            ⏭ Next Drop
          </button>
          <button
            className={`clash-btn ${isFinishingSim ? 'gold' : ''}`}
            onClick={() => {
              syncSimulationToTime(999, false);
              setIsFinishingSim((prev) => !prev);
            }}
            style={{ padding: '5px 10px', fontSize: 12 }}
          >
            ⏩ Finish Sim
          </button>
          <button
            className="clash-btn"
            onClick={handleReset}
            style={{ padding: '5px 10px', fontSize: 12 }}
          >
            ⏮ Reset
          </button>

          <div
            style={{
              display: 'flex',
              gap: 4,
              marginLeft: 6,
              paddingLeft: 8,
              borderLeft: '1px solid #334155',
            }}
          >
            <button
              onClick={() => setShowHudRois((v) => !v)}
              style={{
                background: showHudRois ? '#1d4ed8' : '#1e293b',
                color: '#fff',
                border: '1px solid #3b82f6',
                borderRadius: 5,
                padding: '4px 8px',
                fontSize: 11,
                cursor: 'pointer',
              }}
            >
              HUD OCR
            </button>
            <button
              onClick={() => setShowDockBoxes((v) => !v)}
              style={{
                background: showDockBoxes ? '#047857' : '#1e293b',
                color: '#fff',
                border: '1px solid #10b981',
                borderRadius: 5,
                padding: '4px 8px',
                fontSize: 11,
                cursor: 'pointer',
              }}
            >
              Dock Slots
            </button>
            <button
              onClick={() => setShowSpawnPuffs((v) => !v)}
              style={{
                background: showSpawnPuffs ? '#b45309' : '#1e293b',
                color: '#fff',
                border: '1px solid #f59e0b',
                borderRadius: 5,
                padding: '4px 8px',
                fontSize: 11,
                cursor: 'pointer',
              }}
            >
              Spawn Puffs
            </button>
          </div>
        </div>
      </div>

      {extractError && (
        <div
          style={{
            background: '#7f1d1d',
            color: '#fecaca',
            padding: '6px 14px',
            fontSize: 12,
            borderBottom: '1px solid #ef4444',
          }}
        >
          {extractError}
        </div>
      )}

      {/* Main Split-Pane Area: Left = Video + CV Telemetry | Right = coc-engine Simulation */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          flex: 1,
          minHeight: 0,
          overflow: 'hidden',
        }}
      >
        {/* LEFT PANE: Video Stream + Live CV Detection Overlays + Extracted Timeline */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            borderRight: '1px solid #1e293b',
            minHeight: 0,
            overflow: 'hidden',
          }}
        >
          {/* Pane Header */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '6px 12px',
              background: '#0f172a',
              borderBottom: '1px solid #1e293b',
              fontSize: 12,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontWeight: 700, color: '#38bdf8' }}>
                📹 SOURCE VIDEO + CV EXTRACTOR
              </span>
              <span style={{ color: '#94a3b8' }}>
                Frame {currentFrameIdx} • {currentTimeSec.toFixed(2)}s
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span
                style={{
                  background: '#1e293b',
                  padding: '2px 8px',
                  borderRadius: 4,
                  color: '#f8fafc',
                  fontWeight: 600,
                }}
              >
                ⏱ {formatClock(currentHudFrame?.time_remaining_sec)}
              </span>
              <span
                style={{
                  background: '#1e293b',
                  padding: '2px 8px',
                  borderRadius: 4,
                  color: '#fbbf24',
                  fontWeight: 600,
                }}
              >
                💥 {currentHudFrame?.destruction_pct ?? 0}% •{' '}
                {'★'.repeat(currentHudFrame?.stars ?? 0)}
                {'☆'.repeat(Math.max(0, 3 - (currentHudFrame?.stars ?? 0)))}
              </span>
            </div>
          </div>

          {/* Video Player + 1:1 SVG CV Detection Overlay */}
          <div
            style={{
              position: 'relative',
              width: '100%',
              background: '#05080f',
              aspectRatio: `${videoW} / ${videoH}`,
              maxHeight: '48vh',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              overflow: 'hidden',
              borderBottom: '1px solid #1e293b',
            }}
          >
            <div
              style={{
                position: 'relative',
                width: '100%',
                height: '100%',
                maxWidth: `calc(48vh * ${videoW / videoH})`,
              }}
            >
              <video
                ref={videoRef}
                src={videoStreamUrl}
                style={{
                  width: '100%',
                  height: '100%',
                  display: 'block',
                  objectFit: ' fill',
                }}
                playsInline
                muted
                onTimeUpdate={handleVideoTimeUpdate}
                onPlay={() => setIsPlaying(true)}
                onPause={() => setIsPlaying(false)}
                onEnded={() => {
                  setIsPlaying(false);
                  syncSimulationToTime(999, false);
                  setIsFinishingSim(true);
                }}
              />

              {/* Synchronized CV Bounding Boxes & Reticles SVG */}
              <svg
                viewBox={`0 0 ${videoW} ${videoH}`}
                style={{
                  position: 'absolute',
                  inset: 0,
                  width: '100%',
                  height: '100%',
                  pointerEvents: 'none',
                }}
              >
                {/* 1. HUD OCR Bounding Boxes */}
                {showHudRois && hudRois && (
                  <>
                    {/* Timer ROI */}
                    <rect
                      x={hudRois.timer[0] * videoW}
                      y={hudRois.timer[1] * videoH}
                      width={(hudRois.timer[2] - hudRois.timer[0]) * videoW}
                      height={(hudRois.timer[3] - hudRois.timer[1]) * videoH}
                      fill="rgba(59, 130, 246, 0.12)"
                      stroke="#3b82f6"
                      strokeWidth={2}
                      strokeDasharray="5 3"
                    />
                    <text
                      x={hudRois.timer[0] * videoW}
                      y={hudRois.timer[1] * videoH - 4}
                      fill="#60a5fa"
                      fontSize={13}
                      fontWeight={700}
                    >
                      TIMER OCR: {formatClock(currentHudFrame?.time_remaining_sec)}
                    </text>

                    {/* Destruction % ROI */}
                    <rect
                      x={hudRois.destruction[0] * videoW}
                      y={hudRois.destruction[1] * videoH}
                      width={(hudRois.destruction[2] - hudRois.destruction[0]) * videoW}
                      height={(hudRois.destruction[3] - hudRois.destruction[1]) * videoH}
                      fill="rgba(245, 158, 11, 0.12)"
                      stroke="#f59e0b"
                      strokeWidth={2}
                      strokeDasharray="5 3"
                    />
                    <text
                      x={hudRois.destruction[0] * videoW}
                      y={hudRois.destruction[1] * videoH - 4}
                      fill="#fbbf24"
                      fontSize={13}
                      fontWeight={700}
                    >
                      DESTR OCR: {currentHudFrame?.destruction_pct ?? 0}% (
                      {currentHudFrame?.stars ?? 0}★)
                    </text>
                  </>
                )}

                {/* 2. Dock Slot Bounding Boxes & Live Counts */}
                {showDockBoxes &&
                  dockSlots.map((slot) => {
                    const [bx, by, bw, bh] = slot.bbox;
                    const liveCnt =
                      currentHudFrame?.slot_counts?.[slot.slot_idx] ??
                      slot.initial_count;
                    const isSel =
                      currentHudFrame?.selected_slots?.includes(slot.slot_idx) ??
                      false;
                    const isAbil =
                      currentHudFrame?.ability_slots?.includes(slot.slot_idx) ??
                      false;
                    const strokeCol = isAbil
                      ? '#e879f9'
                      : isSel
                      ? '#34d399'
                      : '#10b981';

                    return (
                      <g key={slot.slot_idx}>
                        <rect
                          x={bx}
                          y={by}
                          width={bw}
                          height={bh}
                          fill={
                            isAbil
                              ? 'rgba(217, 70, 239, 0.22)'
                              : isSel
                              ? 'rgba(16, 185, 129, 0.20)'
                              : 'rgba(16, 185, 129, 0.05)'
                          }
                          stroke={strokeCol}
                          strokeWidth={isSel || isAbil ? 3.5 : 1.5}
                          rx={4}
                        />
                        <rect
                          x={bx}
                          y={by - 18}
                          width={bw}
                          height={16}
                          fill="rgba(15, 23, 42, 0.88)"
                          rx={3}
                        />
                        <text
                          x={bx + bw / 2}
                          y={by - 6}
                          textAnchor="middle"
                          fill={liveCnt > 0 ? '#a7f3d0' : '#64748b'}
                          fontSize={11}
                          fontWeight={700}
                        >
                          {slot.unit_name.slice(0, 7)} ×{liveCnt}
                        </text>
                      </g>
                    );
                  })}

                {/* 3. Isometric Spawn Puff Reticles */}
                {showSpawnPuffs &&
                  visiblePuffs.map((puff) => {
                    const px = puff.pixel_x ?? videoW / 2;
                    const py = puff.pixel_y ?? videoH / 2;
                    return (
                      <g key={`puff-${puff.idx}`}>
                        <circle
                          cx={px}
                          cy={py}
                          r={24}
                          fill="rgba(245, 158, 11, 0.22)"
                          stroke="#fbbf24"
                          strokeWidth={2.5}
                        />
                        <circle cx={px} cy={py} r={5} fill="#ef4444" />
                        <line
                          x1={px - 32}
                          y1={py}
                          x2={px + 32}
                          y2={py}
                          stroke="#fbbf24"
                          strokeWidth={1.5}
                        />
                        <line
                          x1={px}
                          y1={py - 32}
                          x2={px}
                          y2={py + 32}
                          stroke="#fbbf24"
                          strokeWidth={1.5}
                        />
                        <rect
                          x={Math.min(videoW - 190, Math.max(8, px + 14))}
                          y={Math.max(8, py - 32)}
                          width={180}
                          height={24}
                          rx={5}
                          fill="rgba(15, 23, 42, 0.92)"
                          stroke="#fbbf24"
                          strokeWidth={1.5}
                        />
                        <text
                          x={Math.min(videoW - 190, Math.max(8, px + 14)) + 8}
                          y={Math.max(8, py - 32) + 16}
                          fill="#fef08a"
                          fontSize={12}
                          fontWeight={700}
                        >
                          {puff.unit_name} ×{puff.dropped_count ?? 1} → ({puff.tile_x},{' '}
                          {puff.tile_y})
                        </text>
                      </g>
                    );
                  })}
              </svg>
            </div>
          </div>

          {/* Detected Dock Slots Strip */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '6px 10px',
              background: '#0f172a',
              borderBottom: '1px solid #1e293b',
              overflowX: 'auto',
            }}
          >
            {dockSlots.map((slot) => {
              const liveCnt =
                currentHudFrame?.slot_counts?.[slot.slot_idx] ?? slot.initial_count;
              const isSel =
                currentHudFrame?.selected_slots?.includes(slot.slot_idx) ?? false;
              const isAbil =
                currentHudFrame?.ability_slots?.includes(slot.slot_idx) ?? false;
              return (
                <div
                  key={slot.slot_idx}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '4px 8px',
                    borderRadius: 6,
                    background: isAbil
                      ? 'rgba(192, 38, 211, 0.25)'
                      : isSel
                      ? 'rgba(16, 185, 129, 0.22)'
                      : '#1e293b',
                    border: `1px solid ${
                      isAbil ? '#e879f9' : isSel ? '#34d399' : '#334155'
                    }`,
                    opacity: liveCnt === 0 && slot.slot_type !== 'Hero' ? 0.5 : 1,
                    flexShrink: 0,
                  }}
                >
                  <img
                    src={getUnitIconUrl(slot.slot_type, slot.unit_name)}
                    alt={slot.unit_name}
                    style={{ width: 24, height: 24, objectFit: 'contain' }}
                  />
                  <div style={{ lineHeight: 1.15 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: '#f8fafc' }}>
                      {slot.unit_name}
                    </div>
                    <div style={{ fontSize: 10, color: '#94a3b8' }}>
                      #{slot.slot_idx} •{' '}
                      <strong style={{ color: '#fbbf24' }}>{liveCnt}</strong>/
                      {slot.initial_count}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Chronological Extracted Actions Timeline Table */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '6px 10px' }}>
            <table
              style={{
                width: '100%',
                borderCollapse: 'collapse',
                fontSize: 12,
              }}
            >
              <thead>
                <tr
                  style={{
                    color: '#94a3b8',
                    borderBottom: '1px solid #1e293b',
                    textAlign: 'left',
                  }}
                >
                  <th style={{ padding: '4px 6px' }}>#</th>
                  <th style={{ padding: '4px 6px' }}>Video</th>
                  <th style={{ padding: '4px 6px' }}>Tick</th>
                  <th style={{ padding: '4px 6px' }}>Type</th>
                  <th style={{ padding: '4px 6px' }}>Unit</th>
                  <th style={{ padding: '4px 6px' }}>Batch / Frac</th>
                  <th style={{ padding: '4px 6px' }}>Grid (X, Y)</th>
                  <th style={{ padding: '4px 6px' }}>Conf</th>
                </tr>
              </thead>
              <tbody>
                {actionsWithSec.map((act: CVReplayAction & { idx: number; resolvedSec: number; resolvedFrame: number }) => {
                  const isExecuted = act.resolvedSec <= currentTimeSec + 0.015;
                  const isSelected = selectedActionIdx === act.idx;
                  return (
                    <tr
                      key={act.idx}
                      onClick={() => handleJumpToAction(act.idx)}
                      style={{
                        cursor: 'pointer',
                        background: isSelected
                          ? 'rgba(59, 130, 246, 0.25)'
                          : isExecuted
                          ? 'rgba(16, 185, 129, 0.10)'
                          : 'transparent',
                        borderBottom: '1px solid #1e293b',
                      }}
                    >
                      <td style={{ padding: '5px 6px', fontWeight: 700, color: '#64748b' }}>
                        {act.idx + 1}
                      </td>
                      <td style={{ padding: '5px 6px', color: '#cbd5e1' }}>
                        {act.resolvedSec.toFixed(2)}s (f{act.resolvedFrame})
                      </td>
                      <td style={{ padding: '5px 6px', fontWeight: 700, color: '#38bdf8' }}>
                        t={act.tick}
                      </td>
                      <td style={{ padding: '5px 6px' }}>
                        <span
                          style={{
                            padding: '1px 6px',
                            borderRadius: 4,
                            fontSize: 10,
                            fontWeight: 700,
                            background:
                              act.slot_type === 'Spell'
                                ? '#7c3aed'
                                : act.slot_type === 'Hero' ||
                                  act.slot_type === 'HeroAbility'
                                ? '#b45309'
                                : act.slot_type === 'Siege'
                                ? '#0f766e'
                                : '#1d4ed8',
                            color: '#fff',
                          }}
                        >
                          {act.slot_type}
                        </span>
                      </td>
                      <td
                        style={{
                          padding: '5px 6px',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 6,
                          fontWeight: 600,
                        }}
                      >
                        <img
                          src={getUnitIconUrl(act.slot_type, act.unit_name)}
                          alt=""
                          style={{ width: 18, height: 18, objectFit: 'contain' }}
                        />
                        {act.unit_name}
                      </td>
                      <td style={{ padding: '5px 6px', color: '#e2e8f0' }}>
                        ×{act.dropped_count ?? 1} ({Math.round(act.fraction * 100)}%)
                      </td>
                      <td
                        style={{
                          padding: '5px 6px',
                          fontFamily: 'monospace',
                          fontWeight: 700,
                          color: '#fbbf24',
                        }}
                      >
                        ({act.tile_x}, {act.tile_y})
                      </td>
                      <td style={{ padding: '5px 6px', color: '#34d399' }}>
                        {Math.round((act.confidence ?? 1) * 100)}%
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* RIGHT PANE: Synchronized coc-engine WASM Battlefield Simulation */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            minHeight: 0,
            overflow: 'hidden',
            position: 'relative',
          }}
        >
          {/* Simulation Pane Header */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '6px 12px',
              background: '#0f172a',
              borderBottom: '1px solid #1e293b',
              fontSize: 12,
              flexWrap: 'wrap',
              gap: 8,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontWeight: 700, color: '#34d399' }}>
                ⚔️ COC-ENGINE SIMULATION PLAYBACK
              </span>
              {activeReplay?.validation && (
                <span
                  style={{
                    background: activeReplay.validation.valid
                      ? 'rgba(16, 185, 129, 0.18)'
                      : 'rgba(239, 68, 68, 0.2)',
                    border: `1px solid ${
                      activeReplay.validation.valid ? '#10b981' : '#ef4444'
                    }`,
                    color: activeReplay.validation.valid ? '#6ee7b7' : '#fca5a5',
                    padding: '1px 7px',
                    borderRadius: 4,
                    fontSize: 11,
                    fontWeight: 700,
                  }}
                >
                  {activeReplay.validation.valid ? '✓ VALID SCHEMA' : '✗ INVALID'}
                </span>
              )}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ color: '#94a3b8' }}>
                Actions Applied:{' '}
                <strong style={{ color: '#f8fafc' }}>
                  {appliedActionCountRef.current}/{actionsWithSec.length}
                </strong>
              </span>
              <span
                style={{
                  background: '#1e293b',
                  padding: '2px 8px',
                  borderRadius: 4,
                  color: '#38bdf8',
                  fontWeight: 700,
                }}
              >
                Tick {simState?.tick ?? 0}/1800
              </span>
              <span
                style={{
                  background: '#1e293b',
                  padding: '2px 8px',
                  borderRadius: 4,
                  color: '#fbbf24',
                  fontWeight: 700,
                }}
              >
                {simState?.destruction_pct ?? 0}% •{' '}
                {'★'.repeat(simState?.stars ?? 0)}
                {'☆'.repeat(Math.max(0, 3 - (simState?.stars ?? 0)))}
              </span>
            </div>
          </div>

          {/* Interactive 50x50 Battlefield Canvas */}
          <div style={{ flex: 1, position: 'relative', minHeight: 0 }}>
            {activeReplay && (
              <BattlefieldCanvas
                mode="battle"
                catalog={catalog}
                layout={activeReplay.layout}
                noDeployMask={noDeployMask}
                battleState={simState}
                overlays={overlays}
                onToggleOverlay={onToggleOverlay}
                selectedEditorTool={{ type: 'select' }}
                selectedBuildingInstanceId={null}
                selectedBattleEntity={selectedEntity}
                onTileAction={() => {}}
                onSelectBuildingInstance={() => {}}
                onSelectBattleEntity={setSelectedEntity}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
