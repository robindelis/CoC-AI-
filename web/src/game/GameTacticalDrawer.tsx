import React from 'react';
import { BattleEngineState } from '../types';
import { OverlayOptions } from '../canvas/BattlefieldCanvas';

interface GameTacticalDrawerProps {
  overlays: OverlayOptions;
  battleState: BattleEngineState | null;
  selectedBattleEntity: { kind: 'building' | 'unit'; id: number } | null;
  onSetOverlays: (next: OverlayOptions) => void;
  onClose: () => void;
}

export const GameTacticalDrawer: React.FC<GameTacticalDrawerProps> = ({
  overlays,
  battleState,
  selectedBattleEntity,
  onSetOverlays,
  onClose,
}) => {
  return (
    <aside className="tactical-floating-drawer">
      <div className="drawer-header">
        <h3>Tactical Overlays & Telemetry</h3>
        <button className="modal-close-btn" onClick={onClose}>
          ✕
        </button>
      </div>

      <div className="toggle-list">
        <label className="toggle-row">
          <input
            type="checkbox"
            checked={overlays.isometric}
            onChange={(e) => onSetOverlays({ ...overlays, isometric: e.target.checked })}
          />
          <span>2.5D Isometric Village Projection</span>
        </label>
        <label className="toggle-row">
          <input
            type="checkbox"
            checked={overlays.showRedZone}
            onChange={(e) =>
              onSetOverlays({ ...overlays, showRedZone: e.target.checked })
            }
          />
          <span>No-Deploy Red Zone Boundary</span>
        </label>
        <label className="toggle-row">
          <input
            type="checkbox"
            checked={overlays.showRanges}
            onChange={(e) => onSetOverlays({ ...overlays, showRanges: e.target.checked })}
          />
          <span>All Defense Range Circles</span>
        </label>
        <label className="toggle-row">
          <input
            type="checkbox"
            checked={overlays.showDpsHeatmap}
            onChange={(e) =>
              onSetOverlays({ ...overlays, showDpsHeatmap: e.target.checked })
            }
          />
          <span>DPS Threat Heatmap</span>
        </label>
        <label className="toggle-row">
          <input
            type="checkbox"
            checked={overlays.showTargetVectors}
            onChange={(e) =>
              onSetOverlays({ ...overlays, showTargetVectors: e.target.checked })
            }
          />
          <span>Unit Target Lock Vectors</span>
        </label>
        <label className="toggle-row">
          <input
            type="checkbox"
            checked={overlays.showTraps}
            onChange={(e) => onSetOverlays({ ...overlays, showTraps: e.target.checked })}
          />
          <span>Reveal Village Traps (48)</span>
        </label>
      </div>

      {battleState && (
        <div className="telemetry-kv-list">
          <div>
            <span>Simulation Tick</span>
            <strong>#{battleState.tick} / 1800</strong>
          </div>
          <div>
            <span>Total Damage Dealt</span>
            <strong>
              {Math.round(battleState.damage_dealt_total).toLocaleString()} HP
            </strong>
          </div>
          <div>
            <span>Active Attacker Units</span>
            <strong>
              {
                battleState.units.filter((u) => u.alive && u.team === 'Attacker')
                  .length
              }
            </strong>
          </div>
        </div>
      )}

      {battleState && selectedBattleEntity && (
        <div className="live-entity-box">
          <h4>Selected Entity</h4>
          {selectedBattleEntity.kind === 'unit' ? (
            (() => {
              const u = battleState.units.find(
                (unit) => unit.id === selectedBattleEntity.id
              );
              if (!u) return <p>Unit defeated.</p>;
              return (
                <div className="telemetry-kv-list">
                  <div>
                    <span>Unit</span>
                    <strong>
                      {u.name} (#{u.id})
                    </strong>
                  </div>
                  <div>
                    <span>Hitpoints</span>
                    <strong>
                      {Math.round(u.hp)} / {Math.round(u.max_hp)}
                    </strong>
                  </div>
                  <div>
                    <span>Position</span>
                    <strong>
                      ({u.x.toFixed(1)}, {u.y.toFixed(1)})
                    </strong>
                  </div>
                  <div>
                    <span>DPS</span>
                    <strong>{u.base_dps}</strong>
                  </div>
                </div>
              );
            })()
          ) : (
            (() => {
              const b = battleState.buildings.find(
                (bldg) => bldg.instance_id === selectedBattleEntity.id
              );
              if (!b) return null;
              return (
                <div className="telemetry-kv-list">
                  <div>
                    <span>Building</span>
                    <strong>{b.name}</strong>
                  </div>
                  <div>
                    <span>Hitpoints</span>
                    <strong>
                      {Math.round(b.hp)} / {Math.round(b.max_hp)}
                    </strong>
                  </div>
                  <div>
                    <span>Mode</span>
                    <strong>{b.mode}</strong>
                  </div>
                </div>
              );
            })()
          )}
        </div>
      )}
    </aside>
  );
};
