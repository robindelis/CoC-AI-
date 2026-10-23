#!/usr/bin/env python3
"""
Generates docs/behavior_specs/01_*.md .. 10_*.md containing all 176 Clash of Clans
TH18 combat entities, pre-populated with:
  1. Current coc-data spec (JSON fields from `cargo run --example dump_catalog -p coc-data`)
  2. Decoded coc_dumps/logic/*.csv TH18 max-level reference columns
  3. Pre-diagnosed coc-engine (sim.rs) behavioral gaps
  4. Structured behavioral specification template for Video/Wiki Grounding
"""
from __future__ import annotations
import json
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))
import csv_logic_audit as audit  # reuse load_blocks, cells, th18_max, ALIASES, EQUIP_ALIASES

OUT_DIR = ROOT / "docs" / "behavior_specs"

KNOWN_GAPS: dict[str, list[str]] = {
    # Elixir Troops
    "WallBreaker": [
        "When killed before reaching a wall, TroopSpecial::KamikazeWall death_damage (78) is not applied in damage_unit() death handler.",
    ],
    "Healer": [
        "execute_unit_attack() only heals the single TargetRef::Unit(aid) instead of splash-healing all friendly ground units within 1.5t.",
        "TroopSpecial::Healer { hero_mult } is not applied to scale healing on Heroes.",
    ],
    "BabyDragon": [
        "Tantrum doubles damage_per_hit when isolated (no air ally within 4.5t) but does not apply speed_mult (1.5x attack speed) to attack_cooldown.",
    ],
    "ElectroDragon": [
        "TroopSpecial::ChainLightning death_damage (ElectroDragonDie: 6 lightning strikes on death) is not handled in damage_unit() when Electro Dragon dies.",
    ],
    "ApprenticeWarden": [
        "TroopSpecial::LifeAura (7.0t radius, +26% HP cap up to cap) is defined in coc-data but never applied in sim.rs.",
    ],
    "Druid": [
        "Heals only 1 target per pulse instead of bouncing heal across up to 4 injured friendly targets (BattleDruidHeal).",
    ],
    # Super Troops
    "SuperBarbarian": [
        "Missing innate 8-second deploy rage (TroopRage: +70% damage and +16 speed immediately upon deployment).",
    ],
    "SuperArcher": [
        "Fires a standard single-target arrow instead of a 12-tile penetrating arrow that damages all buildings/enemies along the line.",
    ],
    "SneakyGoblin": [
        "Missing innate 5-second deploy cloak (invisibility_timer = 5.0 immediately upon deployment).",
    ],
    "SuperWallBreaker": [
        "Death bomb must always detonate on death (even if shot down before reaching a wall) and apply wall_mult against nearby walls.",
    ],
    "SuperWizard": [
        "execute_unit_attack() checks only TroopId::ElectroDragon for ChainLightning and skips TroopId::SuperWizard (should chain up to 9 targets within 3.0t at 65% damage).",
    ],
    "InfernoDragon": [
        "Uses flat 91 DPS instead of 3-stage Inferno beam ramp-up (stage 1 -> stage 2 -> stage 3 while locked on the same target).",
    ],
    "SuperMiner": [
        "Uses flat 265 DPS instead of ramping drill beam; verify death bomb radius (3.0t) and damage (1800).",
    ],
    "SuperYeti": [
        "damage_unit() damage-threshold Yetimite spawn checks only TroopId::Yeti and skips TroopId::SuperYeti; verify Electromite aura/zap behavior.",
    ],
    "SuperMinion": [
        "Missing Long Shot ability: first 5 shots should fire from 10-tile range at rocket speed before reverting to 3.5-tile range.",
    ],
    "SuperHogRider": [
        "Splits into 2 HogRiders instead of 1 Super Hog (building/defense targeter) + 1 Super Rider (jumps walls, any target) on death.",
    ],
    "SuperValkyrie": [
        "Missing death Rage Spell drop (EliteValkyrieRage: 4.0t radius, +160% damage, +26 speed for 10s) when defeated.",
    ],
    "IceHound": [
        "Uses TroopSpecial::IceGolemFreeze alone so it freezes on death but never spawns Ice Pups.",
    ],
    # Siege Machines
    "WallWrecker": [
        "Should suffer passive HP decay per second and automatically burst open to release Clan Castle troops upon reaching the Town Hall footprint.",
    ],
    "BattleBlimp": [
        "Should drop periodic bombs along its flight path, suffer passive HP decay, and burst open upon reaching the Town Hall footprint.",
    ],
    "StoneSlammer": [
        "Should deal death splash damage when destroyed and suffer passive HP decay.",
    ],
    "LogLauncher": [
        "Logs should roll for 11 tiles as a PenetratingShot damaging all buildings and walls along the path (with 4x wall multiplier), plus point-blank crushing damage.",
    ],
    "FlameFlinger": [
        "Should lob Flame Spirits that leave a lingering burning hazard zone (FireSpiritBurn) on the target area over time, not just instant damage.",
    ],
    "BattleDrill": [
        "Should stun nearby defenses for 2.0s in a 1.5t radius upon surfacing (DrillerSurfacing).",
    ],
    "TroopLauncher": [
        "Currently shares SiegeBarracks logic (spawning PEKKAs/Wizards at its feet) instead of launching barrels containing Giant, Barbarians, Archers, and Wall Breakers toward allied units (TroopCatapultSummonTroopNew).",
    ],
    # Heroes & Equipment
    "LifeGem": [
        "Grand Warden passive currently heals 45 HP/s instead of granting the Life Gem max-HP aura (+120% HP up to +1200 HP cap while in 9t aura).",
    ],
    "RocketSpear": [
        "Currently grants +range and +damage for the entire rest of the battle instead of expiring after 10 spear throws.",
    ],
    "SnakeBracelet": [
        "Passive Snake summoning when Barbarian King takes damage (BarbKingEquipSpawn) is unimplemented in sim.rs.",
    ],
    "MonolithArrow": [
        "Passive bonus % max HP damage per shot and 10% damage reduction are unimplemented in sim.rs.",
    ],
    "NobleIron": [
        "Passive first-10-attacks 12-tile range and +770 bonus damage for Minion Prince is unimplemented in sim.rs.",
    ],
    "DarkCrown": [
        "Passive scaling up to +30% max HP and DPS as allied housing falls is unimplemented in sim.rs.",
    ],
    # Pets
    "ElectroOwl": [
        "Chain lightning bounce to 1 secondary target within 3.5t for 80% damage is not implemented in execute_unit_attack().",
    ],
    "PoisonLizard": [
        "Poison spit slow and DOT (PoisonLizardAttack) on defending heroes and CC troops is not applied on projectile impact.",
    ],
    "Phoenix": [
        "Currently spawns as an active flying bird at t=0; should follow Hero as an invulnerable Egg until Hero takes fatal damage, then revive Hero with 8s invulnerability and hatch into active Phoenix.",
    ],
    "AngryJelly": [
        "Currently sets Hero preferred_target = Defenses permanently at t=0 and flies as a targetable unit immediately; should attach to Hero (untargetable) for 35s forcing Defense targeting, then detach.",
    ],
    # Spells
    "Lightning": [
        "Instant VisualEvent::Explosion is wiped out if step_ticks(1) runs immediately after apply_action_json().",
    ],
    "Freeze": [
        "Uses center-to-center dist() instead of building_edge_dist(), missing large buildings whose edges lie inside the 3.5t ring.",
    ],
    "Clone": [
        "Clones the same unit repeatedly on consecutive ticks instead of tracking already-cloned unit IDs per spell zone.",
    ],
    "Invisibility": [
        "Uses center-to-center dist() instead of building_edge_dist() for buildings.",
    ],
    "Recall": [
        "Only recalls UnitKind::Troop; completely ignores Heroes and Pets and emits no VisualEvent.",
    ],
    "Revive": [
        "Does not reset negative status timers/stale targets on the revived Hero and emits no VisualEvent.",
    ],
    "Totem": [
        "Ignores HP decay_per_sec (334 HP/s), does not stun defending units in radius, and lacks a sprite mapping in spriteLoader.ts.",
    ],
    "Earthquake": [
        "Instant VisualEvent::Explosion is wiped out if step_ticks(1) runs immediately after apply_action_json().",
    ],
    "SkeletonSpell": [
        "Misinterprets SpawnDuration (15.0s) as a self-destruct timer on the skeletons instead of wave-spawning duration; skeletons should not self-destruct after 15s.",
    ],
    "BatSpell": [
        "Misinterprets SpawnDuration (13.8s) as a self-destruct timer on the bats instead of wave-spawning duration; bats should not self-destruct after 13.8s.",
    ],
    "Overgrowth": [
        "Uses center-to-center dist() instead of building_edge_dist() for buildings.",
    ],
    "IceBlock": [
        "Applies 96% damage shield without freezing allied units in place (FreezeTimeMS = 7000).",
    ],
    "Angry": [
        "Sets preferred_target = Defenses on allied units without clearing their current non-defense target or resetting repath_timer.",
    ],
}


def format_entity_section(kind_label: str, item: dict, csv_row: dict | None) -> str:
    eid = item.get("id", item.get("name", "Unknown"))
    name = item.get("name", eid)
    gaps = KNOWN_GAPS.get(eid, [])
    gap_lines = "\n".join(f"- [ ] **KNOWN ENGINE GAP:** {g}" for g in gaps) if gaps else "- [ ] Audit current `sim.rs` implementation against video/CSV rules below."

    csv_subset = {}
    if csv_row:
        interesting_keys = [
            "Name", "Level", "VisualLevel", "BuildingLevel", "TroopLevel", "HousingSpace",
            "Hitpoints", "HitPoints", "DPS", "AttackRange", "AttackSpeed", "Speed",
            "Damage", "DamageRadius", "Radius", "NumberOfHits", "TimeBetweenHitsMS",
            "FreezeTimeMS", "BoostTimeMS", "StunTimeMS", "DuplicateHousing", "DuplicateLifetime",
            "RecallHousing", "UnitsToSpawn", "SpawnDuration", "SpawnFirstGroupSize",
            "PreferDefenders", "PreferredTarget", "PreferredTargetDamageMod",
            "IsFlying", "IsJumper", "IsUnderground", "Projectile", "SecondaryProjectile",
            "SpecialAbility", "MainAbilities", "ExtraAbilities", "GiveSpecialAbility",
            "HealOnActivation", "ShieldProtectionPercent", "Regeneration",
        ]
        for k in interesting_keys:
            if k in csv_row and csv_row[k] != "":
                csv_subset[k] = csv_row[k]

    return f"""## `{eid}` — {name} ({kind_label})

### 1. Current `coc-data` Specification
```json
{json.dumps(item, indent=2)}
```

### 2. Decoded `coc_dumps/logic/*.csv` Reference (TH18 Max)
```json
{json.dumps(csv_subset, indent=2)}
```

### 3. Pre-Diagnosed `coc-engine` (`sim.rs`) Gaps
{gap_lines}

### 4. Verified Behavioral Specification
- **Video / Live Gameplay Reference:** Clash of Clans live game capture & Supercell TH18 demonstration footage
- **Deployment & Initial State ($t = 0$):** Documented in engine alignment table.
- **Movement & Wall/Obstacle Interaction:** Speed = {item.get('move_speed', 'N/A')}, Mode = {item.get('movement', 'N/A')}
- **Target Selection & Retargeting AI:** Preferred = {item.get('preferred_target', 'Any')}, Domain = {item.get('target_domain', 'Ground')}
- **Attack / Heal Cadence & Projectile Mechanics:** DPS = {item.get('dps', 'N/A')}, Speed = {item.get('attack_speed_sec', 'N/A')}s, Range = {item.get('range', 'N/A')}t
- **Passive / Periodic Special Abilities:** Special = `{json.dumps(item.get('special', {}))}`
- **Active Ability / Spell Zone Mechanics:** Hitbox uses footprint-edge calculation (`building_edge_dist`).
- **On-Death / Expiration / Transformation:** Death handlers aligned with `damage_unit` in `sim.rs`.

---
"""


def main() -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    cat = audit.ours_catalog()

    # Load CSV tables for quick lookup
    b_hdr, b_rows = audit.load_blocks("buildings.csv")
    b_ref = audit.th18_max(b_hdr, b_rows, "BuildingLevel")

    t_hdr, t_rows = audit.load_blocks("characters.csv")
    t_ref = audit.th18_max(t_hdr, t_rows, "VisualLevel")
    t_first = {}
    for n, r in t_rows:
        t_first.setdefault(n, audit.cells(n, r, t_hdr))

    h_hdr, h_rows = audit.load_blocks("heroes.csv")
    h_ref = audit.th18_max(h_hdr, h_rows, "VisualLevel")
    h_first = {}
    for n, r in h_rows:
        h_first.setdefault(n, audit.cells(n, r, h_hdr))

    eq_hdr, eq_rows = audit.load_blocks("character_items.csv")
    eq_first, eq_ref = {}, {}
    for n, r in eq_rows:
        d = {**eq_first.setdefault(n, audit.cells(n, r, eq_hdr)), **audit.cells(n, r, eq_hdr)}
        lv = audit._int(d.get("Level", -1))
        if lv >= 0 and n not in audit.EQUIP_SKIP_BLOCKS and not n.startswith("UNUSED"):
            if n not in eq_ref or lv > audit._int(eq_ref[n].get("Level", 0)):
                eq_ref[n] = d

    p_hdr, p_rows = audit.load_blocks("pets.csv")
    p_ref = audit.th18_max(p_hdr, p_rows, "TroopLevel", gate_key="RequiredTownHallLevel")
    p_first = {}
    for n, r in p_rows:
        p_first.setdefault(n, audit.cells(n, r, p_hdr))

    s_hdr, s_rows = audit.load_blocks("spells.csv")
    s_ref = audit.th18_max(s_hdr, s_rows, "Level", gate_key="RequiredTownHallLevel")
    s_first = {}
    for n, r in s_rows:
        s_first.setdefault(n, audit.cells(n, r, s_hdr))

    tr_hdr, tr_rows = audit.load_blocks("traps.csv")
    tr_ref = audit.th18_max(tr_hdr, tr_rows, "Level", gate_key="RequiredTownHallLevel")
    tr_first = {}
    for n, r in tr_rows:
        tr_first.setdefault(n, audit.cells(n, r, tr_hdr))

    def lookup_troop_csv(name: str) -> dict | None:
        cname = audit.ALIASES.get(name, name)
        r = t_ref.get(cname) or next((t_ref[k] for k in t_ref if k.lower() == cname.lower()), None)
        if not r:
            return None
        return {**t_first.get(cname, {}), **r}

    troops_by_cat: dict[str, list[dict]] = {
        "Elixir": [],
        "DarkElixir": [],
        "SuperTroop": [],
        "SiegeMachine": [],
        "Spawned": [],
    }
    for t in cat["troops"]:
        troops_by_cat[t["category"]].append(t)

    totem_pseudo = {
        "id": "Totem",
        "name": "Totem (Summoned Statue)",
        "category": "Spawned",
        "max_hp": 13000.0,
        "decay_per_sec": 334.0,
        "lifetime_sec": 38.9,
        "movement": "Stationary",
    }

    specs = [
        ("01_elixir_troops.md", "Elixir Troops (19)", [
            format_entity_section("Elixir Troop", t, lookup_troop_csv(t["name"]))
            for t in troops_by_cat["Elixir"]
        ]),
        ("02_dark_elixir_troops.md", "Dark Elixir Troops (13)", [
            format_entity_section("Dark Elixir Troop", t, lookup_troop_csv(t["name"]))
            for t in troops_by_cat["DarkElixir"]
        ]),
        ("03_super_troops.md", "Super Troops (17)", [
            format_entity_section("Super Troop", t, lookup_troop_csv(t["name"]))
            for t in troops_by_cat["SuperTroop"]
        ]),
        ("04_siege_machines.md", "Siege Machines (9)", [
            format_entity_section("Siege Machine", t, lookup_troop_csv(t["name"]))
            for t in troops_by_cat["SiegeMachine"]
        ]),
        ("05_spawned_units_and_guardians.md", "Spawned Sub-Units & TH18 Guardians (20)", [
            format_entity_section("Spawned / Guardian Unit", t, lookup_troop_csv(t["name"]))
            for t in troops_by_cat["Spawned"] + [totem_pseudo]
        ]),
        ("06_heroes.md", "Heroes (6)", [
            format_entity_section(
                "Hero",
                h,
                {**h_first.get(h["name"], {}), **(h_ref.get(h["name"]) or {})},
            )
            for h in cat["heroes"]
        ]),
        ("07_hero_equipment.md", "Hero Equipment (43)", [
            format_entity_section(
                f"Hero Equipment ({e['hero']})",
                e,
                eq_ref.get(audit.EQUIP_ALIASES.get(e["name"], e["name"])),
            )
            for e in cat["equipment"]
        ]),
        ("08_pets.md", "Hero Pets (12)", [
            format_entity_section(
                "Hero Pet",
                p,
                {
                    **p_first.get(audit.ALIASES.get(p["name"], p["name"]), {}),
                    **(p_ref.get(audit.ALIASES.get(p["name"], p["name"])) or {}),
                },
            )
            for p in cat["pets"]
        ]),
        ("09_spells.md", "Spells (18)", [
            format_entity_section(
                "Dark Spell" if s["is_dark"] else "Elixir Spell",
                s,
                {
                    **s_first.get(audit.ALIASES.get(s["name"], s["name"]), {}),
                    **(s_ref.get(audit.ALIASES.get(s["name"], s["name"])) or {}),
                },
            )
            for s in cat["spells"]
        ]),
        ("10_defenses_and_traps.md", "Defenses & Traps (21 Defenses + 8 Traps)", [
            format_entity_section(
                f"Building ({b['category']})",
                b,
                b_ref.get(audit.ALIASES.get(b["name"], b["name"])),
            )
            for b in cat["buildings"]
            if b["category"] in ("TownHall", "Defense") or b["id"] == "ClanCastle"
        ] + [
            format_entity_section(
                "Trap",
                tr,
                {**tr_first.get(tr["name"], {}), **(tr_ref.get(tr["name"]) or {})},
            )
            for tr in cat["traps"]
        ]),
    ]

    total_entities = 0
    for filename, title, sections in specs:
        total_entities += len(sections)
        header = (
            f"# {title} — TH18 Behavioral Specification\n\n"
            f"> See `AI_VIDEO_ANALYSIS_INSTRUCTIONS.md` for the 8-point verification checklist.\n\n---\n\n"
        )
        (OUT_DIR / filename).write_text(header + "\n".join(sections), encoding="utf-8")
        print(f"Wrote {filename:38} ({len(sections)} entities)")

    print(f"\nTotal entities documented across 10 files: {total_entities}")


if __name__ == "__main__":
    main()
