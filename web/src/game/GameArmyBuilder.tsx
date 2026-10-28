import React, { useMemo, useState } from 'react';
import {
  ArmyLoadout,
  FullCatalog,
  HeroEquipmentSpec,
  HeroSpec,
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
import {
  deleteCustomArmyPreset,
  fetchArmyPresets,
  saveCustomArmyPreset,
} from '../ai/aiClient';

interface Props {
  catalog: FullCatalog;
  army: ArmyLoadout;
  onChangeArmy: (next: ArmyLoadout) => void;
  onGoToTrainer?: () => void;
}

type CatalogTab =
  | 'elixir'
  | 'dark'
  | 'super'
  | 'spells'
  | 'siege'
  | 'equipment'
  | 'pets'
  | 'buildings';

const SAVED_RECIPES_KEY = 'coc_th18_saved_army_recipes_v2';

export const GameArmyBuilder: React.FC<Props> = ({
  catalog,
  army,
  onChangeArmy,
  onGoToTrainer,
}) => {
  const [catalogTab, setCatalogTab] = useState<CatalogTab>('elixir');
  const [targetDestination, setTargetDestination] = useState<'main' | 'cc'>('main');
  const [editingHeroEquip, setEditingHeroEquip] = useState<{
    heroId: string;
    slotIdx: 0 | 1;
  } | null>(null);
  const [editingHeroPet, setEditingHeroPet] = useState<string | null>(null);
  const [statusNotice, setStatusNotice] = useState<string | null>(null);
  const [savedRecipes, setSavedRecipes] = useState<ArmyLoadout[]>(() => {
    try {
      const raw = localStorage.getItem(SAVED_RECIPES_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  });

  // Sync server custom armies on mount
  React.useEffect(() => {
    fetchArmyPresets().then((res) => {
      if (res && res.custom_armies && res.custom_armies.length > 0) {
        setSavedRecipes((prev) => {
          const names = new Set(prev.map((r) => r.name));
          const additions = res.custom_armies.filter((ca) => !names.has(ca.name));
          const merged = [...additions, ...prev].slice(0, 16);
          try {
            localStorage.setItem(SAVED_RECIPES_KEY, JSON.stringify(merged));
          } catch {
            // ignore
          }
          return merged;
        });
      }
    });
  }, []);

  // Helper to get a Hero's 2 equipped items
  const getHeroEquipmentPair = (hero: HeroSpec): [string, string] => {
    const found = army.hero_equipment?.find(([hid]) => hid === hero.id);
    return found ? found[1] : hero.default_equipment;
  };

  const setHeroEquipmentSlot = (heroId: string, slotIdx: 0 | 1, newEqId: string) => {
    const hSpec = catalog.heroes.find((h) => h.id === heroId);
    if (!hSpec) return;
    const currentPair = [...getHeroEquipmentPair(hSpec)] as [string, string];
    const otherIdx = slotIdx === 0 ? 1 : 0;
    // Prevent duplicate equipment on both slots; swap if already in the other slot
    if (currentPair[otherIdx] === newEqId) {
      currentPair[otherIdx] = currentPair[slotIdx];
    }
    currentPair[slotIdx] = newEqId;

    const existingList = army.hero_equipment ?? [];
    const hasEntry = existingList.some(([hid]) => hid === heroId);
    const nextEquip: [string, [string, string]][] = hasEntry
      ? existingList.map(([hid, pair]) => (hid === heroId ? [hid, currentPair] : [hid, pair]))
      : [...existingList, [heroId, currentPair]];

    onChangeArmy({
      ...army,
      hero_equipment: nextEquip,
    });
  };

  // Housing space calculations
  const totalArmyHousing = useMemo(
    () =>
      army.troops.reduce((acc, [tid, count]) => {
        const sp = catalog.troops.find((t) => t.id === tid);
        return acc + (sp?.housing_space ?? 1) * count;
      }, 0),
    [army.troops, catalog.troops]
  );

  const totalSpellHousing = useMemo(
    () =>
      army.spells.reduce((acc, [sid, count]) => {
        const sp = catalog.spells.find((s) => s.id === sid);
        return acc + (sp?.housing_space ?? 1) * count;
      }, 0),
    [army.spells, catalog.spells]
  );

  const totalCcTroopHousing = useMemo(
    () =>
      army.cc_troops.reduce((acc, [tid, count]) => {
        const sp = catalog.troops.find((t) => t.id === tid);
        return acc + (sp?.housing_space ?? 1) * count;
      }, 0),
    [army.cc_troops, catalog.troops]
  );

  const totalCcSpellHousing = useMemo(
    () =>
      army.cc_spells.reduce((acc, [sid, count]) => {
        const sp = catalog.spells.find((s) => s.id === sid);
        return acc + (sp?.housing_space ?? 1) * count;
      }, 0),
    [army.cc_spells, catalog.spells]
  );

  // Add / Remove Troop
  const adjustTroop = (troopId: string, delta: number, isCc = false) => {
    const spec = catalog.troops.find((t) => t.id === troopId);
    if (!spec) return;

    if (!isCc) {
      const current = army.troops.find(([id]) => id === troopId)?.[1] ?? 0;
      const nextCount = current + delta;
      if (delta > 0 && totalArmyHousing + spec.housing_space * delta > 352) return;
      if (nextCount <= 0) {
        onChangeArmy({
          ...army,
          troops: army.troops.filter(([id]) => id !== troopId),
        });
      } else {
        const exists = army.troops.some(([id]) => id === troopId);
        onChangeArmy({
          ...army,
          troops: exists
            ? army.troops.map(([id, c]) => (id === troopId ? [id, nextCount] : [id, c]))
            : [...army.troops, [troopId, nextCount]],
        });
      }
    } else {
      const current = army.cc_troops.find(([id]) => id === troopId)?.[1] ?? 0;
      const nextCount = current + delta;
      if (delta > 0 && totalCcTroopHousing + spec.housing_space * delta > 55) return;
      if (nextCount <= 0) {
        onChangeArmy({
          ...army,
          cc_troops: army.cc_troops.filter(([id]) => id !== troopId),
        });
      } else {
        const exists = army.cc_troops.some(([id]) => id === troopId);
        onChangeArmy({
          ...army,
          cc_troops: exists
            ? army.cc_troops.map(([id, c]) => (id === troopId ? [id, nextCount] : [id, c]))
            : [...army.cc_troops, [troopId, nextCount]],
        });
      }
    }
  };

  // Add / Remove Spell
  const adjustSpell = (spellId: string, delta: number, isCc = false) => {
    const spec = catalog.spells.find((s) => s.id === spellId);
    if (!spec) return;

    if (!isCc) {
      const current = army.spells.find(([id]) => id === spellId)?.[1] ?? 0;
      const nextCount = current + delta;
      if (delta > 0 && totalSpellHousing + spec.housing_space * delta > 11) return;
      if (nextCount <= 0) {
        onChangeArmy({
          ...army,
          spells: army.spells.filter(([id]) => id !== spellId),
        });
      } else {
        const exists = army.spells.some(([id]) => id === spellId);
        onChangeArmy({
          ...army,
          spells: exists
            ? army.spells.map(([id, c]) => (id === spellId ? [id, nextCount] : [id, c]))
            : [...army.spells, [spellId, nextCount]],
        });
      }
    } else {
      const current = army.cc_spells.find(([id]) => id === spellId)?.[1] ?? 0;
      const nextCount = current + delta;
      if (delta > 0 && totalCcSpellHousing + spec.housing_space * delta > 3) return;
      if (nextCount <= 0) {
        onChangeArmy({
          ...army,
          cc_spells: army.cc_spells.filter(([id]) => id !== spellId),
        });
      } else {
        const exists = army.cc_spells.some(([id]) => id === spellId);
        onChangeArmy({
          ...army,
          cc_spells: exists
            ? army.cc_spells.map(([id, c]) => (id === spellId ? [id, nextCount] : [id, c]))
            : [...army.cc_spells, [spellId, nextCount]],
        });
      }
    }
  };

  const saveCurrentRecipe = async () => {
    const cloned = structuredClone(army);
    const next = [
      cloned,
      ...savedRecipes.filter((r) => r.name !== army.name),
    ].slice(0, 16);
    setSavedRecipes(next);
    try {
      localStorage.setItem(SAVED_RECIPES_KEY, JSON.stringify(next));
    } catch {
      // ignore storage quota errors
    }
    await saveCustomArmyPreset(cloned);
    setStatusNotice(`⭐ "${army.name}" saved as Training Preset! Ready in AI Trainer.`);
    setTimeout(() => setStatusNotice(null), 4000);
  };

  const deleteSavedRecipe = async (name: string) => {
    const next = savedRecipes.filter((r) => r.name !== name);
    setSavedRecipes(next);
    try {
      localStorage.setItem(SAVED_RECIPES_KEY, JSON.stringify(next));
    } catch {
      // ignore
    }
    await deleteCustomArmyPreset(name);
    setStatusNotice(`🗑️ Deleted custom preset "${name}".`);
    setTimeout(() => setStatusNotice(null), 3000);
  };

  const isCurrentCustom = savedRecipes.some((r) => r.name === army.name);

  return (
    <div className="recipe-page">
      {statusNotice && (
        <div
          style={{
            background: 'rgba(34, 197, 94, 0.2)',
            border: '1px solid #22c55e',
            color: '#4ade80',
            padding: '8px 16px',
            borderRadius: 8,
            margin: '0 16px 12px 16px',
            fontSize: '0.9rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <span>{statusNotice}</span>
          <button
            type="button"
            style={{ background: 'transparent', border: 'none', color: '#cbd5e1', cursor: 'pointer' }}
            onClick={() => setStatusNotice(null)}
          >
            ✕
          </button>
        </div>
      )}

      {/* 1. TOP ARMY RECIPE HEADER BAR */}
      <div className="recipe-header-bar">
        <div className="recipe-title-group">
          <img src={UI_SPRITES.sword} alt="" className="recipe-header-icon" />
          <div>
            <span className="recipe-eyebrow">CLASH ANYTIME • TH18 MAX ARMY RECIPE</span>
            <input
              type="text"
              className="recipe-name-input"
              value={army.name}
              onChange={(e) => onChangeArmy({ ...army, name: e.target.value })}
              placeholder="Name your Army Recipe..."
            />
          </div>
        </div>

        <div className="recipe-meters-row">
          <div className={`capacity-pill ${totalArmyHousing === 352 ? 'full' : ''}`}>
            <span>Troops</span>
            <strong>{totalArmyHousing} / 352</strong>
          </div>
          <div className={`capacity-pill ${totalSpellHousing === 11 ? 'full' : ''}`}>
            <span>Spells</span>
            <strong>{totalSpellHousing} / 11</strong>
          </div>
          <div className={`capacity-pill ${army.heroes.length === 4 ? 'full' : ''}`}>
            <span>Heroes</span>
            <strong>{army.heroes.length} / 4</strong>
          </div>
          <div className={`capacity-pill ${totalCcTroopHousing === 55 ? 'full' : ''}`}>
            <span>CC Troops</span>
            <strong>{totalCcTroopHousing} / 55</strong>
          </div>
        </div>

        <div className="recipe-actions-row">
          <select
            className="clash-select"
            value=""
            onChange={(e) => {
              const all = [...catalog.preset_armies, ...savedRecipes];
              const found = all.find((a) => a.name === e.target.value);
              if (found) onChangeArmy(structuredClone(found));
            }}
          >
            <option value="" disabled>
              📂 Load Army Recipe...
            </option>
            <optgroup label="TH18 Meta Presets">
              {catalog.preset_armies.map((pa) => (
                <option key={pa.name} value={pa.name}>
                  ⭐ {pa.name}
                </option>
              ))}
            </optgroup>
            {savedRecipes.length > 0 && (
              <optgroup label="Custom Training Presets">
                {savedRecipes.map((sr) => (
                  <option key={sr.name} value={sr.name}>
                    💾 {sr.name}
                  </option>
                ))}
              </optgroup>
            )}
          </select>

          <button className="clash-btn gold" onClick={saveCurrentRecipe}>
            ⭐ Save as Training Preset
          </button>
          {isCurrentCustom && (
            <button
              className="clash-btn danger"
              style={{ padding: '0 8px' }}
              title="Delete this custom preset"
              onClick={() => deleteSavedRecipe(army.name)}
            >
              🗑️ Delete Preset
            </button>
          )}
          <button
            className="clash-btn danger"
            onClick={() =>
              onChangeArmy({
                ...army,
                troops: [],
                spells: [],
              })
            }
          >
            Clear All
          </button>
          {onGoToTrainer && (
            <button className="clash-btn green" onClick={onGoToTrainer}>
              🚀 Use in AI Trainer →
            </button>
          )}
        </div>
      </div>

      {/* 2. HEROES, EQUIPMENT & PETS BOARD (ALL 6 HEROES INCLUDING DRAGON DUKE!) */}
      <section className="recipe-section-card">
        <div className="section-title-bar">
          <div>
            <h2>HERO HALL & BLACKSMITH LOADOUT (SELECT UP TO 4 ACTIVE HEROES)</h2>
            <p>
              Click any Equipment slot to customize Common (Lv 18) & Epic (Lv 27) Hero Equipment, or
              click the Pet slot to pair any of the 12 TH18 Pets.
            </p>
          </div>
          <span className="badge-gold">{army.heroes.length} / 4 Heroes Active</span>
        </div>

        <div className="heroes-board-grid">
          {catalog.heroes.map((h) => {
            const activeEntry = army.heroes.find(([hid]) => hid === h.id);
            const isSelected = Boolean(activeEntry);
            const petId = activeEntry?.[1] ?? h.default_pet;
            const petSpec = catalog.pets.find((p) => p.id === petId);
            const eqPair = getHeroEquipmentPair(h);
            const eq0 = catalog.equipment.find((e) => e.id === eqPair[0]);
            const eq1 = catalog.equipment.find((e) => e.id === eqPair[1]);

            const dynamicHp = Math.round(
              h.base_hp + (eq0?.hp_bonus ?? 0) + (eq1?.hp_bonus ?? 0)
            );
            const dynamicDps = Math.round(
              h.base_dps + (eq0?.dps_bonus ?? 0) + (eq1?.dps_bonus ?? 0)
            );

            return (
              <div
                key={h.id}
                className={`hero-loadout-card ${isSelected ? 'active-hero' : 'benched-hero'}`}
              >
                <div className="hero-card-header">
                  <div className="hero-portrait-wrap">
                    <img
                      src={HERO_SPRITES[h.id]}
                      alt={h.name}
                      className="hero-portrait-img"
                    />
                    <span className="clash-lv-badge">Lv {h.max_level}</span>
                  </div>

                  <div className="hero-title-info">
                    <div className="hero-name-row">
                      <h3>{h.name}</h3>
                      {h.id === 'DragonDuke' && <span className="new-pill">NEW 2026</span>}
                    </div>
                    <div className="hero-stat-chips">
                      <span>❤️ {dynamicHp.toLocaleString()} HP</span>
                      <span>⚔️ {dynamicDps} DPS</span>
                    </div>
                  </div>

                  <button
                    className={`hero-toggle-btn ${isSelected ? 'selected' : ''}`}
                    onClick={() => {
                      if (isSelected) {
                        onChangeArmy({
                          ...army,
                          heroes: army.heroes.filter(([hid]) => hid !== h.id),
                        });
                      } else if (army.heroes.length < 4) {
                        onChangeArmy({
                          ...army,
                          heroes: [...army.heroes, [h.id, petId]],
                        });
                      }
                    }}
                  >
                    {isSelected ? '✓ IN ARMY' : army.heroes.length >= 4 ? 'BENCHED' : '+ EQUIP'}
                  </button>
                </div>

                {/* 2 EQUIPMENT SLOTS + 1 PET SLOT */}
                <div className="hero-slots-strip">
                  {[0, 1].map((slotIdx) => {
                    const eq = slotIdx === 0 ? eq0 : eq1;
                    return (
                      <button
                        key={slotIdx}
                        className={`equip-slot-btn ${
                          eq?.rarity === 'Epic' ? 'rarity-epic' : 'rarity-common'
                        }`}
                        onClick={() =>
                          setEditingHeroEquip({
                            heroId: h.id,
                            slotIdx: slotIdx as 0 | 1,
                          })
                        }
                        title={eq?.ability_description}
                      >
                        <div className="slot-icon-box">
                          {eq && (
                            <img
                              src={EQUIPMENT_SPRITES[eq.id]}
                              alt={eq.name}
                              className="slot-icon-img"
                            />
                          )}
                          <span className="slot-lv-tag">Lv {eq?.max_level ?? 18}</span>
                        </div>
                        <div className="slot-meta">
                          <span className="slot-kind">
                            {eq?.rarity === 'Epic' ? '★ EPIC' : 'COMMON'}
                          </span>
                          <strong className="slot-title">{eq?.name ?? 'Select'}</strong>
                        </div>
                      </button>
                    );
                  })}

                  {/* PET SLOT */}
                  <button
                    className="equip-slot-btn pet-slot-btn"
                    onClick={() => setEditingHeroPet(h.id)}
                    title="Click to assign Hero Pet"
                  >
                    <div className="slot-icon-box">
                      <img
                        src={PET_SPRITES[petId]}
                        alt={petSpec?.name}
                        className="slot-icon-img"
                      />
                      <span className="slot-lv-tag">Lv {petSpec?.max_level ?? 10}</span>
                    </div>
                    <div className="slot-meta">
                      <span className="slot-kind">🐾 PET</span>
                      <strong className="slot-title">{petSpec?.name ?? petId}</strong>
                    </div>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* 3. ACTIVE ARMY STRIPS (TROOPS, SPELLS, SIEGE & CLAN CASTLE) */}
      <div className="active-army-strips-grid">
        {/* Active Troops + Siege */}
        <section className="recipe-section-card">
          <div className="section-title-bar">
            <h2>ACTIVE TROOPS & SIEGE MACHINE</h2>
            <span className="badge-gold">
              {totalArmyHousing} / 352 Housing • {army.siege_machine ? '1/1 Siege' : 'No Siege'}
            </span>
          </div>

          <div className="active-cards-tray">
            {/* Active Siege Machine Card */}
            {army.siege_machine && (
              <div className="clash-unit-card siege-border">
                <span className="card-count-badge">SIEGE</span>
                <img
                  src={TROOP_SPRITES[army.siege_machine]}
                  alt={army.siege_machine}
                  className="card-sprite-img"
                />
                <span className="card-lv-badge">
                  Lv{' '}
                  {catalog.troops.find((t) => t.id === army.siege_machine)?.max_level ?? 5}
                </span>
                <div className="card-name-bar">
                  {catalog.troops.find((t) => t.id === army.siege_machine)?.name ??
                    army.siege_machine}
                </div>
              </div>
            )}

            {/* Active Troops */}
            {army.troops.length === 0 ? (
              <div className="empty-tray-hint">
                No troops in army yet. Click troops in the catalog below to add them!
              </div>
            ) : (
              army.troops.map(([tid, count]) => {
                const spec = catalog.troops.find((t) => t.id === tid);
                return (
                  <div key={tid} className="clash-unit-card">
                    <span className="card-count-badge">×{count}</span>
                    <img
                      src={TROOP_SPRITES[tid]}
                      alt={spec?.name ?? tid}
                      className="card-sprite-img"
                    />
                    <span className="card-lv-badge">Lv {spec?.max_level}</span>
                    <div className="card-name-bar">{spec?.name ?? tid}</div>
                    <div className="card-stepper-row">
                      <button onClick={() => adjustTroop(tid, -1, false)}>−</button>
                      <button onClick={() => adjustTroop(tid, 1, false)}>+</button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </section>

        {/* Active Spells + Clan Castle */}
        <section className="recipe-section-card">
          <div className="section-title-bar">
            <h2>ACTIVE SPELLS & CLAN CASTLE</h2>
            <span className="badge-gold">
              Spells: {totalSpellHousing}/11 • CC: {totalCcTroopHousing}/55
            </span>
          </div>

          <div className="active-cards-tray">
            {army.spells.map(([sid, count]) => {
              const spec = catalog.spells.find((s) => s.id === sid);
              return (
                <div key={sid} className="clash-unit-card spell-border">
                  <span className="card-count-badge">×{count}</span>
                  <img
                    src={SPELL_SPRITES[sid]}
                    alt={spec?.name ?? sid}
                    className="card-sprite-img"
                  />
                  <span className="card-lv-badge">Lv {spec?.max_level}</span>
                  <div className="card-name-bar">
                    {spec?.name.replace(' Spell', '') ?? sid}
                  </div>
                  <div className="card-stepper-row">
                    <button onClick={() => adjustSpell(sid, -1, false)}>−</button>
                    <button onClick={() => adjustSpell(sid, 1, false)}>+</button>
                  </div>
                </div>
              );
            })}

            {army.cc_troops.map(([tid, count]) => {
              const spec = catalog.troops.find((t) => t.id === tid);
              return (
                <div key={`cc-${tid}`} className="clash-unit-card cc-border">
                  <span className="card-count-badge">CC ×{count}</span>
                  <img
                    src={TROOP_SPRITES[tid]}
                    alt={spec?.name ?? tid}
                    className="card-sprite-img"
                  />
                  <span className="card-lv-badge">Lv {spec?.max_level}</span>
                  <div className="card-name-bar">{spec?.name ?? tid}</div>
                  <div className="card-stepper-row">
                    <button onClick={() => adjustTroop(tid, -1, true)}>−</button>
                    <button onClick={() => adjustTroop(tid, 1, true)}>+</button>
                  </div>
                </div>
              );
            })}

            {army.cc_spells.map(([sid, count]) => {
              if (count <= 0) return null;
              const spec = catalog.spells.find((s) => s.id === sid);
              return (
                <div key={`ccs-${sid}`} className="clash-unit-card cc-border">
                  <span className="card-count-badge">CC ×{count}</span>
                  <img
                    src={SPELL_SPRITES[sid]}
                    alt={spec?.name ?? sid}
                    className="card-sprite-img"
                  />
                  <span className="card-lv-badge">Lv {spec?.max_level}</span>
                  <div className="card-name-bar">
                    {spec?.name.replace(' Spell', '') ?? sid}
                  </div>
                  <div className="card-stepper-row">
                    <button onClick={() => adjustSpell(sid, -1, true)}>−</button>
                    <button onClick={() => adjustSpell(sid, 1, true)}>+</button>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      </div>

      {/* 4. BOTTOM CATEGORIZED UNIT, SPELL, SIEGE & EQUIPMENT PICKER */}
      <section className="recipe-section-card">
        <div className="catalog-tabs-header">
          <div className="catalog-subtabs">
            <button
              className={`subtab-btn ${catalogTab === 'elixir' ? 'active' : ''}`}
              onClick={() => setCatalogTab('elixir')}
            >
              <img src={UI_SPRITES.elixir} alt="" /> Elixir Troops (19)
            </button>
            <button
              className={`subtab-btn ${catalogTab === 'dark' ? 'active' : ''}`}
              onClick={() => setCatalogTab('dark')}
            >
              <img src={UI_SPRITES.dark_elixir} alt="" /> Dark Troops (13)
            </button>
            <button
              className={`subtab-btn ${catalogTab === 'super' ? 'active' : ''}`}
              onClick={() => setCatalogTab('super')}
            >
              🔥 Super Troops (17)
            </button>
            <button
              className={`subtab-btn ${catalogTab === 'spells' ? 'active' : ''}`}
              onClick={() => setCatalogTab('spells')}
            >
              🧪 Spells (18)
            </button>
            <button
              className={`subtab-btn ${catalogTab === 'siege' ? 'active' : ''}`}
              onClick={() => setCatalogTab('siege')}
            >
              🚜 Siege Machines (9)
            </button>
            <button
              className={`subtab-btn ${catalogTab === 'equipment' ? 'active' : ''}`}
              onClick={() => setCatalogTab('equipment')}
            >
              <img src={UI_SPRITES.starry_ore} alt="" /> All Equipment (42)
            </button>
            <button
              className={`subtab-btn ${catalogTab === 'pets' ? 'active' : ''}`}
              onClick={() => setCatalogTab('pets')}
            >
              🐾 Hero Pets (12)
            </button>
            <button
              className={`subtab-btn ${catalogTab === 'buildings' ? 'active' : ''}`}
              onClick={() => setCatalogTab('buildings')}
            >
              🏰 TH18 Buildings ({catalog.buildings.reduce((n, b) => n + b.max_count, 0)})
            </button>
          </div>

          {(catalogTab === 'elixir' ||
            catalogTab === 'dark' ||
            catalogTab === 'super' ||
            catalogTab === 'spells') && (
            <div className="destination-toggle">
              <span>Add clicks to:</span>
              <button
                className={`dest-btn ${targetDestination === 'main' ? 'active' : ''}`}
                onClick={() => setTargetDestination('main')}
              >
                Main Army
              </button>
              <button
                className={`dest-btn ${targetDestination === 'cc' ? 'active' : ''}`}
                onClick={() => setTargetDestination('cc')}
              >
                Clan Castle
              </button>
            </div>
          )}
        </div>

        {/* TROOP TABS (Elixir, Dark, Super) */}
        {(catalogTab === 'elixir' || catalogTab === 'dark' || catalogTab === 'super') && (
          <div className="catalog-cards-grid">
            {catalog.troops
              .filter((t) =>
                catalogTab === 'elixir'
                  ? t.category === 'Elixir'
                  : catalogTab === 'dark'
                  ? t.category === 'DarkElixir'
                  : t.category === 'SuperTroop'
              )
              .map((t) => {
                const isCc = targetDestination === 'cc';
                const count = isCc
                  ? army.cc_troops.find(([id]) => id === t.id)?.[1] ?? 0
                  : army.troops.find(([id]) => id === t.id)?.[1] ?? 0;
                return (
                  <div key={t.id} className="catalog-picker-card">
                    <div
                      className="picker-portrait-area"
                      onClick={() => adjustTroop(t.id, 1, isCc)}
                    >
                      <span className="picker-housing-tag">🏠 {t.housing_space}</span>
                      {count > 0 && <span className="picker-active-count">×{count}</span>}
                      <img
                        src={TROOP_SPRITES[t.id]}
                        alt={t.name}
                        className="picker-sprite-img"
                      />
                      <span className="clash-lv-badge">Lv {t.max_level}</span>
                    </div>
                    <div className="picker-info">
                      <strong>{t.name}</strong>
                      <div className="picker-mini-stats">
                        <span>❤️ {t.max_hp.toLocaleString()}</span>
                        <span>⚔️ {Math.abs(t.dps)}</span>
                      </div>
                    </div>
                    <div className="picker-btn-row">
                      <button
                        className="step-btn minus"
                        onClick={() => adjustTroop(t.id, -1, isCc)}
                        disabled={count <= 0}
                      >
                        −
                      </button>
                      <span className="step-count">{count}</span>
                      <button
                        className="step-btn plus"
                        onClick={() => adjustTroop(t.id, 1, isCc)}
                      >
                        +
                      </button>
                    </div>
                  </div>
                );
              })}
          </div>
        )}

        {/* SPELLS TAB */}
        {catalogTab === 'spells' && (
          <div className="catalog-cards-grid">
            {catalog.spells.map((s) => {
              const isCc = targetDestination === 'cc';
              const count = isCc
                ? army.cc_spells.find(([id]) => id === s.id)?.[1] ?? 0
                : army.spells.find(([id]) => id === s.id)?.[1] ?? 0;
              return (
                <div key={s.id} className="catalog-picker-card">
                  <div
                    className="picker-portrait-area"
                    onClick={() => adjustSpell(s.id, 1, isCc)}
                  >
                    <span className="picker-housing-tag">🧪 {s.housing_space}</span>
                    {count > 0 && <span className="picker-active-count">×{count}</span>}
                    <img
                      src={SPELL_SPRITES[s.id]}
                      alt={s.name}
                      className="picker-sprite-img"
                    />
                    <span className="clash-lv-badge">Lv {s.max_level}</span>
                  </div>
                  <div className="picker-info">
                    <strong>{s.name}</strong>
                    <div className="picker-mini-stats">
                      <span>📏 {s.radius}t</span>
                      <span>⏱️ {s.duration_sec}s</span>
                    </div>
                  </div>
                  <div className="picker-btn-row">
                    <button
                      className="step-btn minus"
                      onClick={() => adjustSpell(s.id, -1, isCc)}
                      disabled={count <= 0}
                    >
                      −
                    </button>
                    <span className="step-count">{count}</span>
                    <button
                      className="step-btn plus"
                      onClick={() => adjustSpell(s.id, 1, isCc)}
                    >
                      +
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* SIEGE MACHINES TAB */}
        {catalogTab === 'siege' && (
          <div className="catalog-cards-grid">
            {catalog.troops
              .filter((t) => t.category === 'SiegeMachine')
              .map((sm) => {
                const isSelected = army.siege_machine === sm.id;
                return (
                  <div
                    key={sm.id}
                    className={`catalog-picker-card ${isSelected ? 'selected-card' : ''}`}
                    onClick={() => onChangeArmy({ ...army, siege_machine: sm.id })}
                  >
                    <div className="picker-portrait-area">
                      <img
                        src={TROOP_SPRITES[sm.id]}
                        alt={sm.name}
                        className="picker-sprite-img"
                      />
                      <span className="clash-lv-badge">Lv {sm.max_level}</span>
                    </div>
                    <div className="picker-info">
                      <strong>{sm.name}</strong>
                      <div className="picker-mini-stats">
                        <span>❤️ {sm.max_hp.toLocaleString()}</span>
                        <span>⚔️ {sm.dps}</span>
                      </div>
                    </div>
                    <button className={`clash-btn ${isSelected ? 'gold' : ''}`}>
                      {isSelected ? '✓ Active Siege' : 'Select Siege'}
                    </button>
                  </div>
                );
              })}
          </div>
        )}

        {/* ALL 42 HERO EQUIPMENT TAB */}
        {catalogTab === 'equipment' && (
          <div className="equipment-showcase-grid">
            {catalog.equipment.map((eq) => {
              const heroSpec = catalog.heroes.find((h) => h.id === eq.hero);
              const pair = heroSpec ? getHeroEquipmentPair(heroSpec) : ['', ''];
              const isEquipped = pair[0] === eq.id || pair[1] === eq.id;
              return (
                <div
                  key={eq.id}
                  className={`equip-showcase-card ${
                    eq.rarity === 'Epic' ? 'epic-card' : 'common-card'
                  } ${isEquipped ? 'equipped' : ''}`}
                >
                  <div className="equip-card-top">
                    <img
                      src={EQUIPMENT_SPRITES[eq.id]}
                      alt={eq.name}
                      className="equip-large-icon"
                    />
                    <div className="equip-header-text">
                      <div className="equip-badges-row">
                        <span
                          className={`rarity-pill ${
                            eq.rarity === 'Epic' ? 'epic' : 'common'
                          }`}
                        >
                          {eq.rarity} • Lv {eq.max_level}
                        </span>
                        <span className="hero-owner-pill">{heroSpec?.name}</span>
                      </div>
                      <h4>{eq.name}</h4>
                      <div className="equip-stat-line">
                        {eq.hp_bonus > 0 && <span>+{eq.hp_bonus} HP</span>}
                        {eq.dps_bonus > 0 && <span>+{eq.dps_bonus} DPS</span>}
                        {eq.heal_on_activation > 0 && (
                          <span>+{eq.heal_on_activation} Heal</span>
                        )}
                      </div>
                    </div>
                  </div>
                  <p className="equip-desc">{eq.ability_description}</p>
                  <div className="equip-slot-actions">
                    <button
                      className={`clash-btn ${pair[0] === eq.id ? 'gold' : ''}`}
                      onClick={() => setHeroEquipmentSlot(eq.hero, 0, eq.id)}
                    >
                      {pair[0] === eq.id ? '✓ Slot 1' : 'Equip Slot 1'}
                    </button>
                    <button
                      className={`clash-btn ${pair[1] === eq.id ? 'gold' : ''}`}
                      onClick={() => setHeroEquipmentSlot(eq.hero, 1, eq.id)}
                    >
                      {pair[1] === eq.id ? '✓ Slot 2' : 'Equip Slot 2'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ALL 12 PETS TAB */}
        {catalogTab === 'pets' && (
          <div className="catalog-cards-grid">
            {catalog.pets.map((p) => {
              const assignedHeroId = army.heroes.find(([, pid]) => pid === p.id)?.[0];
              const assignedHero = catalog.heroes.find((h) => h.id === assignedHeroId);
              return (
                <div key={p.id} className="catalog-picker-card">
                  <div className="picker-portrait-area">
                    <img
                      src={PET_SPRITES[p.id]}
                      alt={p.name}
                      className="picker-sprite-img"
                    />
                    <span className="clash-lv-badge">Lv {p.max_level}</span>
                  </div>
                  <div className="picker-info">
                    <strong>{p.name}</strong>
                    <div className="picker-mini-stats">
                      <span>❤️ {p.max_hp}</span>
                      <span>⚔️ {p.dps}</span>
                    </div>
                    {assignedHero && (
                      <span className="pet-assigned-tag">Paired: {assignedHero.name}</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* TH18 BUILDINGS REFERENCE TAB */}
        {catalogTab === 'buildings' && (
          <div className="buildings-ref-grid">
            {catalog.buildings.map((b) => (
              <div key={b.id} className="building-ref-card">
                <img
                  src={BUILDING_SPRITES[b.id]}
                  alt={b.name}
                  className="building-ref-sprite"
                />
                <div className="building-ref-meta">
                  <div className="b-ref-top">
                    <strong>{b.name}</strong>
                    <span className="clash-lv-badge">Lv {b.max_level}</span>
                  </div>
                  <div className="b-ref-stats">
                    <span>Count: {b.max_count}×</span>
                    <span>
                      Size: {b.footprint}×{b.footprint}
                    </span>
                    <span>❤️ {b.max_hp.toLocaleString()}</span>
                    {b.dps > 0 && <span>⚔️ {b.dps} DPS</span>}
                    {b.max_range > 0 && <span>🎯 {b.max_range}t</span>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* MODAL: BLACKSMITH HERO EQUIPMENT PICKER */}
      {editingHeroEquip && (
        <div
          className="clash-modal-backdrop"
          onClick={() => setEditingHeroEquip(null)}
        >
          <div
            className="clash-modal-card"
            onClick={(e) => e.stopPropagation()}
          >
            {(() => {
              const hero = catalog.heroes.find((h) => h.id === editingHeroEquip.heroId);
              const heroEquips: HeroEquipmentSpec[] = catalog.equipment.filter(
                (e) => e.hero === editingHeroEquip.heroId
              );
              const currentPair = hero ? getHeroEquipmentPair(hero) : ['', ''];
              return (
                <>
                  <div className="modal-header">
                    <div className="modal-title-group">
                      {hero && (
                        <img
                          src={HERO_SPRITES[hero.id]}
                          alt={hero.name}
                          className="modal-hero-avatar"
                        />
                      )}
                      <div>
                        <h3>
                          {hero?.name} • Equipment Slot #{editingHeroEquip.slotIdx + 1}
                        </h3>
                        <p>Select a Common (Lv 18) or Epic (Lv 27) piece from the Blacksmith</p>
                      </div>
                    </div>
                    <button
                      className="modal-close-btn"
                      onClick={() => setEditingHeroEquip(null)}
                    >
                      ✕
                    </button>
                  </div>

                  <div className="modal-equip-grid">
                    {heroEquips.map((eq) => {
                      const isCurrentSlot =
                        currentPair[editingHeroEquip.slotIdx] === eq.id;
                      const isOtherSlot =
                        currentPair[editingHeroEquip.slotIdx === 0 ? 1 : 0] === eq.id;
                      return (
                        <div
                          key={eq.id}
                          className={`equip-showcase-card ${
                            eq.rarity === 'Epic' ? 'epic-card' : 'common-card'
                          } ${isCurrentSlot ? 'equipped' : ''}`}
                          onClick={() => {
                            setHeroEquipmentSlot(
                              editingHeroEquip.heroId,
                              editingHeroEquip.slotIdx,
                              eq.id
                            );
                            setEditingHeroEquip(null);
                          }}
                        >
                          <div className="equip-card-top">
                            <img
                              src={EQUIPMENT_SPRITES[eq.id]}
                              alt={eq.name}
                              className="equip-large-icon"
                            />
                            <div className="equip-header-text">
                              <span
                                className={`rarity-pill ${
                                  eq.rarity === 'Epic' ? 'epic' : 'common'
                                }`}
                              >
                                {eq.rarity} • Lv {eq.max_level}
                              </span>
                              <h4>{eq.name}</h4>
                              <div className="equip-stat-line">
                                {eq.hp_bonus > 0 && <span>+{eq.hp_bonus} HP</span>}
                                {eq.dps_bonus > 0 && <span>+{eq.dps_bonus} DPS</span>}
                                {eq.heal_on_activation > 0 && (
                                  <span>+{eq.heal_on_activation} Heal</span>
                                )}
                              </div>
                            </div>
                          </div>
                          <p className="equip-desc">{eq.ability_description}</p>
                          <button className="clash-btn gold">
                            {isCurrentSlot
                              ? '✓ Currently Equipped'
                              : isOtherSlot
                              ? '⇄ Swap Slots'
                              : 'Equip in Slot'}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </>
              );
            })()}
          </div>
        </div>
      )}

      {/* MODAL: PET HOUSE PICKER */}
      {editingHeroPet && (
        <div
          className="clash-modal-backdrop"
          onClick={() => setEditingHeroPet(null)}
        >
          <div
            className="clash-modal-card"
            onClick={(e) => e.stopPropagation()}
          >
            {(() => {
              const hero = catalog.heroes.find((h) => h.id === editingHeroPet);
              const currentPet =
                army.heroes.find(([hid]) => hid === editingHeroPet)?.[1] ??
                hero?.default_pet;
              return (
                <>
                  <div className="modal-header">
                    <div className="modal-title-group">
                      {hero && (
                        <img
                          src={HERO_SPRITES[hero.id]}
                          alt={hero.name}
                          className="modal-hero-avatar"
                        />
                      )}
                      <div>
                        <h3>Pair a TH18 Pet with {hero?.name}</h3>
                        <p>Pet House Lv 12 — Includes Sneezy & Greedy Raven (5× Resource Damage)</p>
                      </div>
                    </div>
                    <button
                      className="modal-close-btn"
                      onClick={() => setEditingHeroPet(null)}
                    >
                      ✕
                    </button>
                  </div>

                  <div className="modal-pet-grid">
                    {catalog.pets.map((p) => {
                      const isCurrent = currentPet === p.id;
                      return (
                        <div
                          key={p.id}
                          className={`catalog-picker-card ${
                            isCurrent ? 'selected-card' : ''
                          }`}
                          onClick={() => {
                            const isHeroActive = army.heroes.some(
                              ([hid]) => hid === editingHeroPet
                            );
                            if (isHeroActive) {
                              onChangeArmy({
                                ...army,
                                heroes: army.heroes.map(([hid, pid]) =>
                                  hid === editingHeroPet ? [hid, p.id] : [hid, pid]
                                ),
                              });
                            } else if (army.heroes.length < 4) {
                              onChangeArmy({
                                ...army,
                                heroes: [...army.heroes, [editingHeroPet, p.id]],
                              });
                            }
                            setEditingHeroPet(null);
                          }}
                        >
                          <div className="picker-portrait-area">
                            <img
                              src={PET_SPRITES[p.id]}
                              alt={p.name}
                              className="picker-sprite-img"
                            />
                            <span className="clash-lv-badge">Lv {p.max_level}</span>
                          </div>
                          <div className="picker-info">
                            <strong>{p.name}</strong>
                            <div className="picker-mini-stats">
                              <span>❤️ {p.max_hp}</span>
                              <span>⚔️ {p.dps}</span>
                            </div>
                          </div>
                          <button className="clash-btn gold">
                            {isCurrent ? '✓ Paired' : 'Assign Pet'}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </>
              );
            })()}
          </div>
        </div>
      )}
    </div>
  );
};
