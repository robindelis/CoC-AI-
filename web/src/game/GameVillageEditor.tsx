import React from 'react';
import {
  BuildingSpec,
  FullCatalog,
  PlacedBuilding,
  VillageLayout,
} from '../types';
import {
  BUILDING_SPRITES,
  SPELL_SPRITES,
  TRAP_SPRITES,
} from '../assetsManifest';

export type EditorToolType =
  | { type: 'select' }
  | { type: 'wall_brush' }
  | { type: 'wall_eraser' }
  | { type: 'place_building'; buildingId: string }
  | { type: 'place_trap'; trapId: string };

interface GameVillageEditorProps {
  catalog: FullCatalog;
  layout: VillageLayout;
  editorTool: EditorToolType;
  layoutValidation: {
    is_valid: boolean;
    errors: string[];
    total_buildings: number;
    total_walls: number;
    total_traps: number;
  } | null;
  selectedPlacedBuilding?: PlacedBuilding;
  selectedBuildingSpec?: BuildingSpec;
  onSetEditorTool: (tool: EditorToolType) => void;
  onSetLayout: (next: VillageLayout) => void;
  onSelectBuildingInstance: (instanceId: number | null) => void;
  onBumpSelectionSeq: () => void;
}

export const GameVillageEditor: React.FC<GameVillageEditorProps> = ({
  catalog,
  layout,
  editorTool,
  layoutValidation,
  selectedPlacedBuilding,
  selectedBuildingSpec,
  onSetEditorTool,
  onSetLayout,
  onSelectBuildingInstance,
  onBumpSelectionSeq,
}) => {
  return (
    <>
      <aside className="editor-floating-left">
        <div className="editor-card-header">
          <h3>TH18 Village Editor</h3>
          <span
            className={`validation-pill ${
              layoutValidation?.is_valid ? 'valid' : 'invalid'
            }`}
          >
            {layout.buildings.length}/
            {catalog.buildings.reduce((n, b) => n + b.max_count, 0)} Bldgs •{' '}
            {layout.walls.length}/325 Walls
          </span>
        </div>

        <div className="editor-tools-row">
          <button
            className={`clash-btn ${editorTool.type === 'select' ? 'gold' : ''}`}
            onClick={() => onSetEditorTool({ type: 'select' })}
          >
            🎯 Move
          </button>
          <button
            className={`clash-btn ${editorTool.type === 'wall_brush' ? 'gold' : ''}`}
            onClick={() => onSetEditorTool({ type: 'wall_brush' })}
          >
            🧱 Wall+
          </button>
          <button
            className={`clash-btn ${editorTool.type === 'wall_eraser' ? 'gold' : ''}`}
            onClick={() => onSetEditorTool({ type: 'wall_eraser' })}
          >
            🧹 Erase
          </button>
          <button
            className="clash-btn danger"
            onClick={() =>
              onSetLayout({
                ...layout,
                buildings: [],
                walls: [],
                traps: [],
              })
            }
          >
            🗑️ Clear
          </button>
        </div>

        <div className="editor-palette-scroll">
          {catalog.buildings
            .filter((b) => b.id !== 'Wall')
            .map((b) => {
              const placedCount = layout.buildings.filter(
                (pb) => pb.building_id === b.id
              ).length;
              const isFull = placedCount >= b.max_count;
              const isSelected =
                editorTool.type === 'place_building' && editorTool.buildingId === b.id;
              return (
                <button
                  key={b.id}
                  className={`editor-palette-row ${isSelected ? 'active' : ''} ${
                    isFull ? 'full' : ''
                  }`}
                  onClick={() => {
                    if (!isFull) {
                      onSetEditorTool({
                        type: 'place_building',
                        buildingId: b.id,
                      });
                    } else {
                      const inst = layout.buildings.find((pb) => pb.building_id === b.id);
                      if (inst) {
                        onSetEditorTool({ type: 'select' });
                        onSelectBuildingInstance(inst.instance_id);
                      }
                    }
                  }}
                >
                  <img
                    src={BUILDING_SPRITES[b.id]}
                    alt={b.name}
                    className="palette-row-sprite"
                  />
                  <div className="palette-row-text">
                    <strong>{b.name}</strong>
                    <span>
                      Lv {b.max_level} • {b.footprint}×{b.footprint}
                    </span>
                  </div>
                  <span className="palette-row-count">
                    {placedCount}/{b.max_count}
                  </span>
                </button>
              );
            })}

          <div className="palette-divider">TRAPS (48 MAX)</div>
          {catalog.traps.map((t) => {
            const placedCount = layout.traps.filter((pt) => pt.trap_id === t.id).length;
            const isFull = placedCount >= t.max_count;
            const isSelected =
              editorTool.type === 'place_trap' && editorTool.trapId === t.id;
            return (
              <button
                key={t.id}
                className={`editor-palette-row ${isSelected ? 'active' : ''} ${
                  isFull ? 'full' : ''
                }`}
                onClick={() => {
                  if (!isFull) {
                    onSetEditorTool({ type: 'place_trap', trapId: t.id });
                  }
                }}
              >
                <img
                  src={TRAP_SPRITES[t.id]}
                  alt={t.name}
                  className="palette-row-sprite"
                />
                <div className="palette-row-text">
                  <strong>{t.name}</strong>
                  <span>Lv {t.max_level}</span>
                </div>
                <span className="palette-row-count">
                  {placedCount}/{t.max_count}
                </span>
              </button>
            );
          })}
        </div>
      </aside>

      {selectedPlacedBuilding && selectedBuildingSpec && (
        <aside className="editor-floating-right">
          <div className="inspector-building-header">
            <img
              src={BUILDING_SPRITES[selectedBuildingSpec.id]}
              alt={selectedBuildingSpec.name}
              className="inspector-bldg-sprite"
            />
            <div>
              <h3>{selectedBuildingSpec.name}</h3>
              <span className="badge-gold">
                Lv {selectedBuildingSpec.max_level} • ({selectedPlacedBuilding.tile_x},{' '}
                {selectedPlacedBuilding.tile_y})
              </span>
            </div>
          </div>

          <div className="telemetry-kv-list">
            <div>
              <span>Hitpoints</span>
              <strong>{selectedBuildingSpec.max_hp.toLocaleString()} HP</strong>
            </div>
            <div>
              <span>Damage / Sec</span>
              <strong>
                {selectedBuildingSpec.id === 'CraftingStation'
                  ? '250 DPS × 6/4/3 Flames'
                  : `${selectedBuildingSpec.dps} DPS`}
              </strong>
            </div>
            <div>
              <span>Range</span>
              <strong>
                {selectedBuildingSpec.id === 'SpellTower'
                  ? selectedPlacedBuilding.mode === 'SpellTowerInvisibility'
                    ? '4.5 tiles (Trigger & Cloak)'
                    : selectedPlacedBuilding.mode === 'SpellTowerEarthquake'
                    ? '9.0t Trigger • 4.7t Ground EQ'
                    : '9.0t Trigger • 5.0t Aura'
                  : selectedBuildingSpec.id === 'AirSweeper'
                  ? '1.0–15.0t • 105° Cone'
                  : selectedBuildingSpec.id === 'Firespitter'
                  ? '16.0t • 150° Cone (2× Pierce)'
                  : `${selectedBuildingSpec.max_range} tiles`}
              </strong>
            </div>
            {(selectedBuildingSpec.id === 'AirSweeper' ||
              selectedBuildingSpec.id === 'Firespitter') && (
              <div>
                <span>Aim Direction</span>
                <strong>{Math.round(selectedPlacedBuilding.direction_deg ?? 0)}°</strong>
              </div>
            )}
          </div>

          {(selectedBuildingSpec.id === 'AirSweeper' ||
            selectedBuildingSpec.id === 'Firespitter') && (
            <div className="mode-switch-box">
              <label>
                🧭 Directional Cone (
                {selectedBuildingSpec.id === 'AirSweeper'
                  ? '105° Arc • 45° Step'
                  : '150° Arc • 90° Step'}
                )
              </label>
              <button
                type="button"
                className="clash-btn gold"
                style={{ width: '100%', marginTop: '6px' }}
                onClick={() => {
                  const step = selectedBuildingSpec.id === 'AirSweeper' ? 45 : 90;
                  const nextDeg =
                    ((selectedPlacedBuilding.direction_deg ?? 0) + step) % 360;
                  onSetLayout({
                    ...layout,
                    buildings: layout.buildings.map((b) =>
                      b.instance_id === selectedPlacedBuilding.instance_id
                        ? { ...b, direction_deg: nextDeg }
                        : b
                    ),
                  });
                  onBumpSelectionSeq();
                }}
              >
                ↻ Rotate +{selectedBuildingSpec.id === 'AirSweeper' ? '45°' : '90°'}{' '}
                (Facing {Math.round(selectedPlacedBuilding.direction_deg ?? 0)}°)
              </button>
            </div>
          )}

          {selectedBuildingSpec.id === 'SpellTower' ? (
            <div className="mode-switch-box">
              <label>🧪 Spell Tower Mode</label>
              <div className="spelltower-picker-grid">
                {[
                  {
                    mode: 'SpellTowerRage',
                    label: 'Rage',
                    icon: SPELL_SPRITES.Rage,
                    sub: '+60% DMG • 5t • 18s',
                  },
                  {
                    mode: 'SpellTowerPoison',
                    label: 'Poison',
                    icon: SPELL_SPRITES.Poison,
                    sub: '60 DPS & Slow • 5t • 12s',
                  },
                  {
                    mode: 'SpellTowerInvisibility',
                    label: 'Invisibility',
                    icon: SPELL_SPRITES.Invisibility,
                    sub: 'Cloak • 4.5t • 4.5s',
                  },
                  {
                    mode: 'SpellTowerEarthquake',
                    label: 'Earthquake',
                    icon: SPELL_SPRITES.Earthquake,
                    sub: '-30% Ground HP • 4.7t',
                  },
                ].map((sp) => {
                  const active = selectedPlacedBuilding.mode === sp.mode;
                  return (
                    <button
                      key={sp.mode}
                      type="button"
                      className={`spelltower-mode-btn ${active ? 'active' : ''}`}
                      onClick={() => {
                        onSetLayout({
                          ...layout,
                          buildings: layout.buildings.map((b) =>
                            b.instance_id === selectedPlacedBuilding.instance_id
                              ? { ...b, mode: sp.mode }
                              : b
                          ),
                        });
                        onBumpSelectionSeq();
                      }}
                    >
                      <img src={sp.icon} alt={sp.label} />
                      <div>
                        <strong>{sp.label}</strong>
                        <span>{sp.sub}</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          ) : (
            selectedBuildingSpec.available_modes.length > 1 && (
              <div className="mode-switch-box">
                <label>Defense / Guardian Mode</label>
                <select
                  className="clash-select"
                  value={selectedPlacedBuilding.mode}
                  onChange={(e) => {
                    const newMode = e.target.value;
                    onSetLayout({
                      ...layout,
                      buildings: layout.buildings.map((b) =>
                        b.instance_id === selectedPlacedBuilding.instance_id
                          ? { ...b, mode: newMode }
                          : b
                      ),
                    });
                  }}
                >
                  {selectedBuildingSpec.available_modes.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </div>
            )
          )}

          <button
            className="clash-btn danger"
            onClick={() => {
              onSetLayout({
                ...layout,
                buildings: layout.buildings.filter(
                  (b) => b.instance_id !== selectedPlacedBuilding.instance_id
                ),
              });
              onSelectBuildingInstance(null);
            }}
          >
            🗑️ Remove Building
          </button>
        </aside>
      )}
    </>
  );
};
