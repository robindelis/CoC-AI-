import React from 'react';
import {
  ArmyLoadout,
  BattleEngineState,
  FullCatalog,
  VillageLayout,
} from '../types';
import {
  BUILDING_SPRITES,
  EQUIPMENT_SPRITES,
  HERO_SPRITES,
  PET_SPRITES,
  SPELL_SPRITES,
  TROOP_SPRITES,
  UI_SPRITES,
} from '../assetsManifest';
import { DeploySlotType } from '../canvas/BattlefieldCanvas';

interface GameBattleHudProps {
  catalog: FullCatalog;
  layout: VillageLayout;
  army: ArmyLoadout;
  battleState: BattleEngineState;
  isPlaying: boolean;
  simSpeed: number;
  deploySlot: DeploySlotType;
  onSetDeploySlot: (slot: DeploySlotType) => void;
  onTogglePause: () => void;
  onStepSingleTick: () => void;
  onResetBattle: () => void;
  onSetSimSpeed: (speed: number) => void;
  onPopSiegeMachine: () => void;
  onActivateHeroAbility: (heroId: string) => void;
}

export const GameBattleHud: React.FC<GameBattleHudProps> = ({
  catalog,
  layout,
  army,
  battleState,
  isPlaying,
  simSpeed,
  deploySlot,
  onSetDeploySlot,
  onTogglePause,
  onStepSingleTick,
  onResetBattle,
  onSetSimSpeed,
  onPopSiegeMachine,
  onActivateHeroAbility,
}) => {
  const timeRemainingSec = Math.max(0, Math.floor(180 - battleState.time_elapsed_sec));
  const mins = Math.floor(timeRemainingSec / 60);
  const secs = timeRemainingSec % 60;

  return (
    <>
      {/* TOP-LEFT DEFENDER & 3-STAR SCOREBOARD HUD */}
      <div className="hud-top-left">
        <div className="defender-banner">
          <img
            src={BUILDING_SPRITES.TownHall}
            alt="TH18"
            className="defender-th-icon"
          />
          <div>
            <div className="defender-name">{layout.name}</div>
            <div className="defender-sub">
              Town Hall 18 •{' '}
              {battleState.town_hall_destroyed ? '💥 TH Destroyed' : '🛡️ Guardian Ready'}
            </div>
          </div>
        </div>

        <div className="clash-scoreboard-pod">
          <div className="clash-stars-strip">
            {[1, 2, 3].map((s) => (
              <img
                key={s}
                src={battleState.stars >= s ? UI_SPRITES.star : UI_SPRITES.empty_star}
                alt="star"
                className={`clash-star-img ${battleState.stars >= s ? 'earned' : ''}`}
              />
            ))}
          </div>
          <div className="damage-readout-row">
            <span className="damage-label">Overall Damage</span>
            <span className="damage-pct">{battleState.destruction_pct}%</span>
          </div>
          <div className="clash-progress-track">
            <div
              className="clash-progress-fill"
              style={{ width: `${battleState.destruction_pct}%` }}
            />
          </div>
        </div>
      </div>

      {/* TOP-CENTER BATTLE TIMER */}
      <div className="hud-top-center">
        <div className="battle-timer-label">
          {battleState.is_finished ? 'BATTLE ENDED' : 'Time left:'}
        </div>
        <div className="battle-timer-value">
          {mins}m {secs.toString().padStart(2, '0')}s
        </div>
      </div>

      {/* TOP-RIGHT PLAYBACK CONTROLS (PURE GAMEPLAY) */}
      <div className="hud-top-right">
        <div className="playback-pod">
          {battleState.tick > 0 && !battleState.is_finished && (
            <button
              className={`clash-btn ${isPlaying ? 'danger' : 'green'}`}
              onClick={onTogglePause}
              title="Pause or resume simulation"
            >
              {isPlaying ? '⏸ Pause' : '▶ Resume'}
            </button>
          )}
          <button
            className="clash-btn"
            onClick={onStepSingleTick}
            disabled={isPlaying}
            title="Step 0.1s Tick"
          >
            ⏭ +1 Tick
          </button>
          <button className="clash-btn" onClick={onResetBattle}>
            ↺ Reset
          </button>
        </div>

        <div className="speed-pills-row">
          <span>Speed:</span>
          {[1, 2, 4, 10].map((sp) => (
            <button
              key={sp}
              className={`speed-pill-btn ${simSpeed === sp ? 'active' : ''}`}
              onClick={() => onSetSimSpeed(sp)}
            >
              {sp}×
            </button>
          ))}
        </div>
      </div>

      {/* BOTTOM AUTHENTIC CLASH DEPLOYMENT DOCK */}
      <div className="hud-bottom-dock-wrap">
        <div className="clash-deployment-dock">
          {/* Troop Cards */}
          {battleState.remaining_troops.map(([tid, count]) => {
            const spec = catalog.troops.find((t) => t.id === tid);
            const isSelected = deploySlot.kind === 'troop' && deploySlot.troopId === tid;
            return (
              <button
                key={tid}
                className={`deploy-slot-card troop-slot ${isSelected ? 'selected' : ''} ${
                  count === 0 ? 'depleted' : ''
                }`}
                onClick={() => onSetDeploySlot({ kind: 'troop', troopId: tid })}
              >
                <span className="slot-top-count">×{count}</span>
                <img
                  src={TROOP_SPRITES[tid]}
                  alt={spec?.name ?? tid}
                  className="slot-unit-sprite"
                />
                <span className="slot-lv-pill">{spec?.max_level}</span>
                <span className="slot-bottom-name">{spec?.name ?? tid}</span>
              </button>
            );
          })}

          {/* Siege Machine / Offensive Clan Castle Card */}
          {(battleState.remaining_siege ||
            battleState.active_siege_unit_id ||
            (!battleState.attacker_cc_popped &&
              army.cc_troops.some(([_, c]) => c > 0))) && (
            <button
              className={`deploy-slot-card siege-slot ${
                deploySlot.kind === 'siege' ? 'selected' : ''
              }`}
              onClick={() => {
                if (
                  battleState.remaining_siege ||
                  (!battleState.active_siege_unit_id && !battleState.attacker_cc_popped)
                ) {
                  onSetDeploySlot({ kind: 'siege' });
                } else if (
                  battleState.active_siege_unit_id &&
                  !battleState.attacker_cc_popped
                ) {
                  onPopSiegeMachine();
                }
              }}
            >
              <span className="slot-top-count">
                {battleState.active_siege_unit_id ? '⚡ POP' : '×1'}
              </span>
              <img
                src={
                  battleState.remaining_siege || army.siege_machine
                    ? TROOP_SPRITES[
                        battleState.remaining_siege ??
                          army.siege_machine ??
                          'SiegeBarracks'
                      ]
                    : BUILDING_SPRITES.ClanCastle
                }
                alt="Siege / CC"
                className="slot-unit-sprite"
              />
              <span className="slot-lv-pill">
                {battleState.remaining_siege || army.siege_machine ? 'SIEGE' : 'CC'}
              </span>
              <span className="slot-bottom-name">
                {battleState.active_siege_unit_id
                  ? 'Release CC'
                  : battleState.remaining_siege
                  ? 'Deploy'
                  : 'Deploy CC'}
              </span>
            </button>
          )}

          {/* Hero Cards */}
          {army.heroes.map(([hid, pid]) => {
            const hspec = catalog.heroes.find((h) => h.id === hid);
            const eqPair =
              army.hero_equipment?.find(([h]) => h === hid)?.[1] ??
              hspec?.default_equipment ??
              [];
            const isRemaining = battleState.remaining_heroes.some(([h]) => h === hid);
            const deployedEntry = battleState.deployed_heroes.find(([h]) => h === hid);
            const liveHero = deployedEntry
              ? battleState.units.find((u) => u.id === deployedEntry[1])
              : null;
            const canTriggerAbility =
              liveHero && liveHero.alive && !liveHero.ability_used;
            const isSelected = deploySlot.kind === 'hero' && deploySlot.heroId === hid;
            const hpRatio = liveHero ? Math.max(0, liveHero.hp / liveHero.max_hp) : 1;

            return (
              <button
                key={hid}
                className={`deploy-slot-card hero-slot ${isSelected ? 'selected' : ''} ${
                  canTriggerAbility ? 'ability-ready' : ''
                } ${!isRemaining && (!liveHero || !liveHero.alive) ? 'depleted' : ''}`}
                onClick={() => {
                  if (isRemaining) {
                    onSetDeploySlot({ kind: 'hero', heroId: hid });
                  } else if (canTriggerAbility) {
                    onActivateHeroAbility(hid);
                  }
                }}
              >
                <div className="hero-dock-badges">
                  <div className="hero-dock-equips">
                    {eqPair.map((eqId) => (
                      <img
                        key={eqId}
                        src={EQUIPMENT_SPRITES[eqId]}
                        alt={eqId}
                        className="dock-mini-equip"
                      />
                    ))}
                  </div>
                  <img
                    src={PET_SPRITES[pid]}
                    alt={pid}
                    className="dock-mini-pet"
                  />
                </div>

                <img
                  src={HERO_SPRITES[hid]}
                  alt={hspec?.name ?? hid}
                  className="slot-unit-sprite"
                />
                <span className="slot-lv-pill">{hspec?.max_level}</span>

                {!isRemaining && liveHero && liveHero.alive && (
                  <div className="dock-hero-hp-bar">
                    <div
                      className="dock-hero-hp-fill"
                      style={{ width: `${hpRatio * 100}%` }}
                    />
                  </div>
                )}

                <span className="slot-bottom-name">
                  {isRemaining
                    ? hspec?.name.split(' ')[1] ?? hspec?.name
                    : canTriggerAbility
                    ? '⚡ ABILITY!'
                    : liveHero?.alive
                    ? `${Math.round(hpRatio * 100)}% HP`
                    : 'KO'}
                </span>
              </button>
            );
          })}

          {/* Spell Cards */}
          {battleState.remaining_spells.map(([sid, count]) => {
            const spec = catalog.spells.find((s) => s.id === sid);
            const isSelected = deploySlot.kind === 'spell' && deploySlot.spellId === sid;
            return (
              <button
                key={sid}
                className={`deploy-slot-card spell-slot ${isSelected ? 'selected' : ''} ${
                  count === 0 ? 'depleted' : ''
                }`}
                onClick={() => onSetDeploySlot({ kind: 'spell', spellId: sid })}
              >
                <span className="slot-top-count">×{count}</span>
                <img
                  src={SPELL_SPRITES[sid]}
                  alt={spec?.name ?? sid}
                  className="slot-unit-sprite"
                />
                <span className="slot-lv-pill">{spec?.max_level}</span>
                <span className="slot-bottom-name">
                  {spec?.name.replace(' Spell', '')}
                </span>
              </button>
            );
          })}

          {/* Inspect Tool Card */}
          <button
            className={`deploy-slot-card inspect-slot ${
              deploySlot.kind === 'inspect' ? 'selected' : ''
            }`}
            onClick={() => onSetDeploySlot({ kind: 'inspect' })}
            title="Inspect battle units and buildings"
          >
            <span className="slot-top-count">INSPECT</span>
            <div className="inspect-icon-circle">🔍</div>
            <span className="slot-bottom-name">Inspect</span>
          </button>
        </div>
      </div>
    </>
  );
};
