#!/usr/bin/env python3
"""
csv_logic_audit.py — cross-checks coc-data against the authentic game tables in coc_dumps/.

Usage:  python3 scripts/csv_logic_audit.py [--tol 5]
Expects the local Rust catalog dump via `cargo run --quiet --example dump_catalog -p coc-data`
(performed automatically) and builds a TH18-max reference from coc_dumps/logic.

Key conversions (Supercell csv_logic units):
  AttackRange / 100 -> tiles *  AttackSpeed & durations in ms  *  damage in HP points
  Speed (movement/projectile) -> raw units; projectiles ≈ /80 tiles-per-second
Name forward-fill: a block's Name appears only on its first row.
"""
from __future__ import annotations
import csv
import json
import os
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
LOGIC = ROOT / "coc_dumps" / "logic"
TILE = 100.0          # range units per tile
MS = 1000.0           # ms per second

ALIASES = {           # our catalog name -> csv_logic block name
    "Town Hall 18": "Town Hall",
    "Hot Candle": "Crafting Station",
    "Multi-Archer Tower": "Multi Archer Tower",
    "Firecracker Tower": "Firecracker Tower",
    "Workshop": "Siege Workshop",
    "L.A.S.S.I": "LASSI",
    "Greedy Raven": "Crow",
    "Lightning Spell": "Lightning",
    "Healing Spell": "Healing",
    "Rage Spell": "Rage",
    "Jump Spell": "Jump",
    "Freeze Spell": "Freeze",
    "Clone Spell": "Clone",
    "Invisibility Spell": "Invisibility",
    "Recall Spell": "Recall",
    "Revive Spell": "Revive",
    "Poison Spell": "Poison",
    "Earthquake Spell": "Earthquake",
    "Haste Spell": "Haste",
    "Overgrowth Spell": "Overgrowth",
    "Ice Block Spell": "Ice Block",
    "Angry Spell": "AngrySpell",
    "Skeleton Spell": "Skeleton Spell",
    "Bat Spell": "Bat Spell",
}

# Hero equipment: our display names (TID localization) often differ from the
# internal csv block names in character_items.csv.
EQUIP_ALIASES = {
    "Giant Arrow": "Piercing Arrow",
    "Frost Flake": "Frost Charm",
    "Revenge Deck": "Draconic Counter",
    "Electro Fangs": "ElectroAttack",
    "Portal Pendant": "Cosmic Portal",
}

# Equipment known to be retired/special-cased in character_items.csv
EQUIP_SKIP_BLOCKS = {"MP Trap Shield", "Punch Arrow"}  # legacy / duplicate blocks

# Duration column overrides: these spells encode lifetime in a dedicated column
# instead of NumberOfHits x TimeBetweenHitsMS.
DUR_COL_OVERRIDE = {
    "Freeze Spell": ["FreezeTimeMS"],
    "Ice Block Spell": ["FreezeTimeMS"],
    "Angry Spell": ["BoostTimeMS"],
    "Skeleton Spell": ["SpawnDuration"],
    "Bat Spell": ["SpawnDuration"],
    "Overgrowth Spell": ["FreezeTimeMS"],
}

# Multi-hit spells where our duration_sec is a rendering constant, not the
# csv tick cadence. Earthquake applies 5 building ticks (58 permil each);
# ours collapses them into one 29% hit at cast time (documented convention).
DUR_SKIP = {"Earthquake Spell"}


def load_blocks(table: str, name_col: int = 0):
    """Returns (header, list of (block_name, row)) with column 0 forward-filled."""
    with open(LOGIC / table, encoding="utf-8", errors="replace") as f:
        raw = list(csv.reader(f))
    hdr = raw[0]
    out, cur = [], None
    skip_offsets = {col for col in range(len(hdr))}  # placeholder
    for row in raw[2:]:
        if not any(row and c for c in row):
            continue
        if row and row[name_col].strip():
            cur = row[name_col].strip()
        if cur is None:
            continue
        r2 = list(row)
        if not r2[name_col].strip():
            r2[name_col] = cur
        out.append((cur, r2))
    return hdr, out


def cells(name: str, row, hdr):
    d = {}
    for i, h in enumerate(hdr):
        if i < len(row) and row[i]:
            d[h] = row[i]
    return d


def th18_max(hdr, rows, level_key, gate_key="TownHallLevel"):
    """Best per-block row with level max among TownHallLevel<=18 (blank gate = TH1)."""
    best = {}
    for name, row in rows:
        d = cells(name, row, hdr)
        if level_key not in d:
            continue
        lv = _int(d[level_key])
        if lv < 0 or lv > 999:
            continue
        g = d.get(gate_key)
        th = _int(g) if g not in (None, "") else 1
        if th > 18:
            continue
        if name not in best or lv > _int(best[name][level_key]):
            best[name] = d
    return best


def _int(v):
    try:
        return int(float(str(v).replace(",", "")))
    except Exception:
        return -999


def f(v, default=0.0):
    try:
        return float(str(v).replace(",", ""))
    except Exception:
        return default


def pct(ours, ref):
    if ref == 0:
        return 0.0 if ours == 0 else float("inf")
    return abs(ours - ref) / abs(ref) * 100.0


def ours_catalog():
    out = subprocess.run(
        ["cargo", "run", "--quiet", "--example", "dump_catalog", "-p", "coc-data"],
        cwd=ROOT, capture_output=True, text=True)
    if out.returncode != 0:
        print("cargo example failed:\n", out.stderr[-2000:])
        sys.exit(2)
    return json.loads(out.stdout)


def main():
    tol = float(sys.argv[2] if len(sys.argv) > 2 else 5.0) + 0.01
    ours = ours_catalog()
    print(f"Catalog: {len(ours['buildings'])} buildings, {len(ours['troops'])} troops, "
          f"{len(ours['heroes'])} heroes, {len(ours['spells'])} spells, {len(ours['traps'])} traps\n")

    bad = 0

    # ---------------- BUILDINGS ----------------
    hdr, rows = load_blocks("buildings.csv")
    ref = th18_max(hdr, rows, "BuildingLevel")
    # projectile speeds lookup
    pjhdr, pjrows = load_blocks("projectiles.csv")
    pj_speed = {}
    for name, row in pjrows:
        d = cells(name, row, pjhdr)
        if name not in pj_speed and "Speed" in d:
            pj_speed[name] = f(d["Speed"]) / 80.0
    print("=" * 24, "BUILDINGS (max level @ TH18) ", "=" * 24)
    print(f"{'ours name':24}{'field':10}{'ours':>12}{'csv':>12}  {'Δ%':>6}")
    CUSTOM = {"Multi-Gear Tower", "Revenge Tower", "B.O.B's Hut", "Builder's Hut"}
    for b in ours["buildings"]:
        if b["name"] in CUSTOM:
            continue
        if b["name"] == "Hot Candle":
            # Authentic values from seasonal_defense modules (max level)
            rv_hp, rv_dps_flame, rv_speed, rv_range = 6000.0, 125.0, 0.5, 10.5
            for field, ours_v, ref_v, nd in [
                ("max_hp", b["max_hp"], rv_hp, 1),
                ("damage_per_shot", b["damage_per_shot"], rv_dps_flame, 1),
                ("attack_speed_sec", b["attack_speed_sec"], rv_speed, 1),
                ("max_range", b["max_range"], rv_range, 1),
            ]:
                d = pct(ours_v, ref_v)
                if d > tol and ref_v:
                    bad += 1
                    print(f"{b['name']:24}{field:10}{round(ours_v, nd):>12}{round(ref_v, nd):>12}  {d:5.1f}%")
            print(f"{'':24}{'proj':10}{'':>12}{'CandleFlame (matches modules)':>12}")
            continue
        cname = ALIASES.get(b["name"], b["name"])
        r = ref.get(cname) or next((ref[n] for n in ref if n.lower() == cname.lower()), None)
        if r is None:
            print(f"{b['name']:24}{'--':10}{'':>12}{'ABSENT(custom)':>12}")
            continue
        for of, cf, mult, nd in [
            ("max_hp", "Hitpoints", 1.0, 1),
            ("dps", "DPS", 1.0, 1),
            ("attack_speed_sec", "AttackSpeed", 1.0 / MS, 2),
            ("max_range", "AttackRange", 1.0 / TILE, 1),
        ]:
            if cf not in r:
                continue
            rv = f(r[cf]) * mult
            ov = b.get(of, -1)
            d = pct(ov, rv)
            if d > tol and rv != 0:
                bad += 1
                print(f"{b['name']:24}{of:10}{round(ov, nd):>12}{round(rv, nd):>12}  {d:5.1f}%")
        pj = r.get("Projectile", "")
        if pj:
            parts = []
            for p in pj.split(";"):
                sp = pj_speed.get(p.strip())
                parts.append(f"{p.strip()}" + (f"≈{sp:.1f}t/s" if sp else ""))
            print(f"{b['name']:24}{'proj':10}{'':>12}{'; '.join(parts)[:60]}")

    # ---------------- TROOPS ----------------
    hdr, rows = load_blocks("characters.csv")
    rtroops = th18_max(hdr, rows, "VisualLevel")
    first_rows = {}
    cur = None
    for name, row in rows:
        if name != cur:
            cur = name
            first_rows[name] = cells(name, row, hdr)
    print()
    print("=" * 24, "TROOPS (max level)", "=" * 24)
    print(f"{'ours name':24}{'field':10}{'ours':>12}{'csv':>12}  {'Δ%':>6}")
    matched = 0
    for t in ours["troops"]:
        cname = ALIASES.get(t["name"], t["name"])
        r = rtroops.get(cname) or next((rtroops[n] for n in rtroops if n.lower() == cname.lower()), None)
        if r is None:
            # summon/derived units (spell spawns, pets, hero bodyguards) live in other tables
            continue
        matched += 1
        f1 = first_rows.get(cname, {})
        # Documented convention differences (not CSV errors):
        EXCEPTIONS = {
            "Healer", "Druid",        # dps column is negative (= heal HPS); ours stores positive
            "Unicorn",
            "Furnace",                # spawner: csv DPS/Range are spawn-flavor; only cadence matters
            "Log Launcher",           # range = our log-roll reach (~11 t), csv 1.0 = engagement dist
            "Giant Giant",            # AQSummonGiantGiant caps at TroopLevel 10 (18500 HP / 700 DPS); rows 11-16 unreleased
        }
        skip = t["name"] in EXCEPTIONS
        for of, cf, mult, nd in [
            ("max_hp", "Hitpoints", 1.0, 1),
            ("dps", "DPS", 1.0, 1),
        ]:
            if skip:
                continue
            if cf not in r:
                continue
            rv = f(r[cf]) * mult
            ov = t.get(of, -1)
            d = pct(ov, rv)
            if d > tol and rv != 0:
                bad += 1
                print(f"{t['name']:24}{of:10}{round(ov, nd):>12}{round(rv, nd):>12}  {d:5.1f}%")
        # attack params & projectile only exist on the block's first row
        SKIP_RANGE = {"Log Launcher"}  # our roll-reach interpretation
        SKIP_OPS = {"Furnace": {"range"}}  # spawner semantics
        for of, cf, mult, nd in [
            ("range", "AttackRange", 1.0 / TILE, 2),
            ("attack_speed_sec", "AttackSpeed", 1.0 / MS, 2),
        ]:
            if t["name"] in SKIP_RANGE and of == "range":
                continue
            if of in SKIP_OPS.get(t["name"], set()):
                continue
            v = f1.get(cf)
            if v:
                rv = f(v) * mult
                ov = t.get(of, -1)
                d = pct(ov, rv)
                if d > tol and rv != 0:
                    bad += 1
                    print(f"{t['name']:24}{of:10}{round(ov, nd):>12}{round(rv, nd):>12}  {d:5.1f}%")
        pj = f1.get("Projectile", "")
        if pj and (t.get("range", 0) > 1.25):
            parts = []
            for p in pj.split(";"):
                sp = pj_speed.get(p.strip())
                parts.append(p.strip() + (f"≈{sp:.2f}t/s" if sp else ""))
            print(f"{t['name']:24}{'proj':10}{'':>12}{'; '.join(parts)[:60]}")

    # ---------------- HEROES ----------------
    hdr, rows = load_blocks("heroes.csv")
    rhero = th18_max(hdr, rows, "VisualLevel")
    # heroes.csv rows carry attack params on the BLOCK's first row only
    first_rows = {}
    cur = None
    for name, row in rows:
        if name != cur:
            cur = name
            first_rows[name] = cells(name, row, hdr)
    print()
    print("=" * 24, "HEROES (max VisualLevel)", "=" * 24)
    print(f"{'ours name':24}{'field':10}{'ours':>12}{'csv':>12}  {'Δ%':>6}")
    for h in ours["heroes"]:
        r = rhero.get(h["name"])
        f1 = first_rows.get(h["name"], {})
        if r is None:
            prev = next((rhero[n] for n in (h['name'],) if n in rhero), None)
            if prev is None:
                print(f"{h['name']:24}{'--':10}{'':>12}{'ABSENT':>12}")
                continue
            r = prev
        # csv heroes.csv holds the NAKED hero; our base_* mirrors that.
        # (max_hp/dps additionally include default-equipment passive bonuses.)
        for of, cf in [("base_hp", "Hitpoints"), ("base_dps", "DPS")]:
            rv = f(r[cf])
            ov = h.get(of, -1)
            d = pct(ov, rv)
            if d > tol and rv != 0:
                bad += 1
                print(f"{h['name']:24}{of:10}{round(ov, 1):>12}{round(rv, 1):>12}  {d:5.1f}%")
        # consistency: max_* must equal base_* + default equipment passives
        eq = {e["id"]: e for e in ours["equipment"]}
        hp_sum = sum(eq[n]["hp_bonus"] for n in h["default_equipment"])
        dps_sum = sum(eq[n]["dps_bonus"] for n in h["default_equipment"])
        exp_hp, exp_dps = h.get("base_hp", 0) + hp_sum, h.get("base_dps", 0) + dps_sum
        if abs(h["max_hp"] - exp_hp) > 0.5 or abs(h["dps"] - exp_dps) > 0.5:
            bad += 1
            ours_txt = f"{h['max_hp']:.0f}/{h['dps']:.0f}"
            exp_txt = f"{exp_hp:.0f}/{exp_dps:.0f}"
            print(f"{h['name']:24}{'eq-consist':10}{ours_txt:>12}{exp_txt:>12}  (max != base+equip)")
        for of, cf, mult in [("range", "AttackRange", 1.0 / TILE), ("attack_speed_sec", "AttackSpeed", 1.0 / MS)]:
            v = f1.get(cf)
            if v:
                rv = f(v) * mult
                ov = h.get(of, -1)
                d = pct(ov, rv)
                if d > tol and rv != 0:
                    bad += 1
                    print(f"{h['name']:24}{of:10}{round(ov, 2):>12}{round(rv, 2):>12}  {d:5.1f}%")

    # ---------------- EQUIPMENT ----------------
    # special_abilities.csv blocks carry ability-level constants (heal on
    # activation, shield protection...). Keep the max-level row merged with the
    # block's first row for the audit's heal/shield special cases.
    sp_hdr, sp_rows = load_blocks("special_abilities.csv")
    specials_max = {}
    specials_first = {}
    for name, row in sp_rows:
        d = cells(name, row, sp_hdr)
        lv = _int(d.get("Level", 0))
        if name not in specials_first:
            specials_first[name] = d
        cur = specials_max.get(name)
        merged = {**specials_first[name], **d}
        if cur is None or lv >= _int(cur.get("Level", 0)):
            specials_max[name] = merged

    hdr, rows = load_blocks("character_items.csv")
    # Block-level columns (TID, Rarity, Deprecated, MainAbilities, gates) only
    # appear on each block's first row; forward-fill them alongside column 0.
    eq_first = {}
    ref_eq = {}
    for name, row in rows:
        d = cells(name, row, hdr)
        bf = eq_first.setdefault(name, d)
        # merge block-first values underneath (row values win)
        d = {**bf, **d}
        lv = _int(d.get("Level", -999))
        if lv < 0:
            continue
        dep = d.get("Deprecated", "").strip().lower()
        bsl = f(d.get("RequiredBlacksmithLevel", 0), 0)
        rcl = f(d.get("RequiredCharacterLevel", 0), 0)
        if (dep in ("true", "1")
                or name.startswith("UNUSED")
                or name in EQUIP_SKIP_BLOCKS
                or bsl > 10          # blacksmith caps at level 10 (TH17)
                or rcl > 18):        # TR18 hero/equipment unlocks cap at 18
            continue
        if name not in ref_eq or lv > _int(ref_eq[name]["Level"]):
            ref_eq[name] = d

    print()
    print("=" * 24, "HERO EQUIPMENT (max level per blacksmith<=10 / TH18 gates)", "=" * 24)
    print(f"{'ours name':24}{'field':24}{'ours':>12}{'csv':>12}  {'Δ%':>6}")
    for e in ours["equipment"]:
        cname = EQUIP_ALIASES.get(e["name"], e["name"])
        r = ref_eq.get(cname) or next(
            (ref_eq[n] for n in ref_eq if n.lower() == cname.lower()), None)
        if r is None:
            bad += 1
            print(f"{e['name']:24}{'--':24}{'':>12}{'ABSENT (csv)':>12}")
            continue
        checks: list[tuple[str, float, float]] = [
            ("hp_bonus", e.get("hp_bonus", -1), f(r.get("HitPoints", 0))),
            ("dps_bonus", e.get("dps_bonus", -1), f(r.get("DPS", 0))),
            ("max_level", e.get("max_level", -1), _int(r.get("Level", 0))),
        ]
        # HealOnActivation lives on the item row; the Royal Gem instead heals
        # through its MainAbility block (RCProtectiveCloak L7 = 2400).
        csv_heal = f(r.get("HealOnActivation", 0))
        if csv_heal == 0:
            main = r.get("MainAbilities", "").split(";")[0].strip()
            sp = specials_max.get(main)
            if sp is not None and f(sp.get("HealOnActivation", 0), 0) > 0:
                csv_heal = f(sp["HealOnActivation"])
        checks.append(("heal_on_activation", e.get("heal_on_activation", -1), csv_heal))
        for of, ov, rv in checks:
            d = pct(ov, rv)
            if d > tol and (rv != 0 or ov != 0):
                bad += 1
                print(f"{e['name']:24}{of:24}{round(ov, 1):>12}{round(rv, 1):>12}  {d:5.1f}%")

    # ---------------- SPELLS / TRAPS / PETS ----------------
    for section, table, lvlkey, extra in [
        ("SPELLS", "spells.csv", "Level", []),
        ("TRAPS", "traps.csv", "Level", []),
        ("PETS", "pets.csv", "TroopLevel", []),
    ]:
        hdr, rows = load_blocks(table)
        ref2 = th18_max(hdr, rows, lvlkey, gate_key="RequiredTownHallLevel" if table in ("spells.csv", "traps.csv", "pets.csv") else "TownHallLevel")
        # spell effect constants (SpeedBoost, StunTimeMS, GiveSpecialAbility...)
        # often live only on the block's first row
        first2 = {}
        cur = None
        for name, row in rows:
            if name != cur:
                cur = name
                first2[name] = cells(name, row, hdr)
        print()
        print("=" * 24, section, "=" * 24)
        cat_key = {"SPELLS": "spells", "TRAPS": "traps", "PETS": "pets"}[section]
        for o in ours[cat_key]:
            cname = ALIASES.get(o["name"], o["name"])
            r = ref2.get(cname) or next((ref2[n] for n in ref2 if n.lower() == cname.lower()), None)
            if r is None:
                print(f"{o['name']:24}{'--':10}{'':>12}{'ABSENT':>12}")
                continue
            checks: list[tuple[str, float, float]] = []
            if section == "SPELLS":
                # merge the block's first row underneath the max-level row
                # (row values win; cells() already drops blank cells)
                r = {**first2.get(cname, {}), **r}
                checks.append(("radius", o.get("radius", -1), f(r.get("Radius", 0)) / TILE))
                checks.append(("max_level", o.get("max_level", -1), _int(r.get("Level", 0))))
                checks.append(("housing_space", o.get("housing_space", -1), f(r.get("HousingSpace", 0))))
                hits = _int(r.get("NumberOfHits", 0))
                tbh = _int(r.get("TimeBetweenHitsMS", 0))
                # duration: dedicated lifetime column wins (DUR_COL_OVERRIDE),
                # else hits x time-between-hits when the spell ticks repeatedly
                refdur = 0.0
                for col in DUR_COL_OVERRIDE.get(o["name"], []):
                    v = _int(r.get(col, 0))
                    if v > 0:
                        refdur = v / MS
                        break
                if refdur == 0 and o["name"] not in DUR_SKIP and hits > 1 and tbh > 0:
                    refdur = hits * tbh / MS
                if refdur > 0:
                    checks.append(("duration_sec", o.get("duration_sec", -1), refdur))
                # effect magnitudes vs the serde-tagged SpellEffect enum
                eff = o.get("effect")
                ename, ev = "", {}
                if isinstance(eff, dict) and eff:
                    ename = next(iter(eff))
                    ev = eff[ename] if isinstance(eff[ename], dict) else {}
                if ename == "InstantDamage":
                    checks.append(("InstantDamage.damage", ev.get("damage", -1), f(r.get("Damage", 0))))
                    st = _int(r.get("StunTimeMS", 0))
                    if st > 0:
                        checks.append(("InstantDamage.stun", ev.get("stun_sec", -1), st / MS))
                elif ename == "HealOverTime":
                    # heal lives in negative Damage x NumberOfHits (-75 x 41 = 3075)
                    if f(r.get("Damage", 0)) < 0 and hits > 0:
                        checks.append(("HealOverTime.total", ev.get("total_heal", -1), -f(r["Damage"]) * hits))
                    hm = f(r.get("HeroDamageMultiplier", 0))
                    if hm > 0:
                        checks.append(("HealOverTime.hero_mult", ev.get("hero_mult", -1), hm / 100.0))
                elif ename == "RageBuff":
                    checks.append(("RageBuff.damage_mult", ev.get("damage_mult", -1), 1 + f(r.get("DamageBoostPercent", 0)) / 100.0))
                    checks.append(("RageBuff.hero_mult", ev.get("hero_damage_mult", -1), 1 + f(r.get("DamageBoostPercent", 0)) / 100.0))
                    checks.append(("RageBuff.speed", ev.get("speed_bonus", -1), f(r.get("SpeedBoost", 0))))
                elif ename == "CloneUnits":
                    checks.append(("CloneUnits.max_housing", ev.get("max_housing", -1), f(r.get("DuplicateHousing", 0))))
                    life = _int(r.get("DuplicateLifetime", 0))
                    if life > 0:
                        checks.append(("CloneUnits.lifetime", ev.get("clone_lifetime_sec", -1), life / MS))
                elif ename == "RecallUnits":
                    checks.append(("RecallUnits.max_housing", ev.get("max_housing", -1), f(r.get("RecallHousing", 0))))
                elif ename == "SummonTotem":
                    # the summoned statue is its own characters.csv block
                    tot = rtroops.get("Totem") or {}
                    if "Hitpoints" in tot:
                        checks.append(("SummonTotem.hp", ev.get("hp", -1), f(tot["Hitpoints"])))
                    st = _int(r.get("StunTimeMS", 0))
                    if st > 0:
                        checks.append(("SummonTotem.stun", ev.get("stun_sec", -1), st / MS))
                elif ename == "PoisonZone":
                    checks.append(("PoisonZone.max_dps", ev.get("max_dps", -1), f(r.get("PoisonDPS", 0))))
                    if f(r.get("SpeedBoost", 0)) < 0:
                        checks.append(("PoisonZone.speed_slow", ev.get("speed_slow_pct", -1), -f(r["SpeedBoost"]) / 100.0))
                    if f(r.get("AttackSpeedBoost", 0)) < 0:
                        checks.append(("PoisonZone.attack_slow", ev.get("attack_slow_pct", -1), -f(r["AttackSpeedBoost"]) / 100.0))
                elif ename == "EarthquakePct":
                    # BuildingDamagePermil per tick x NumberOfHits(5) ticks = total
                    # % of building max HP (58 x 5 = 290 permil -> 0.29)
                    bd = _int(r.get("BuildingDamagePermil", 0))
                    if bd > 0 and hits > 0:
                        checks.append(("EarthquakePct.building_pct", ev.get("building_max_hp_pct", -1), bd * hits / 1000.0))
                    wmod = f(r.get("PreferredTargetDamageMod", 0))
                    if wmod > 0:
                        checks.append(("EarthquakePct.wall_mult", ev.get("wall_mult", -1), wmod))
                elif ename == "HasteBuff":
                    checks.append(("HasteBuff.speed", ev.get("speed_bonus", -1), f(r.get("SpeedBoost", 0))))
                elif ename in ("SpawnSkeletons", "SpawnBats"):
                    checks.append((f"{ename}.count", ev.get("count", -1), f(r.get("UnitsToSpawn", 0))))
                elif ename == "IceBlockShield":
                    # spell level N activates special ability N: Ice Block -> IceBlockSpell
                    ab = str(r.get("GiveSpecialAbility", "")).strip()
                    sp = specials_max.get(ab) if ab else None
                    if sp is not None and f(sp.get("ShieldProtectionPercent", 0), 0) > 0:
                        checks.append(("IceBlockShield.pct", ev.get("damage_reduction_pct", -1), f(sp["ShieldProtectionPercent"]) / 100.0))
                # AngryDefenses / JumpWalls / FreezeEnemies / InvisibilityZone /
                # OvergrowthRoots / ReviveHero: csv carries no effect magnitudes
                # beyond radius+duration (documented).
            elif section == "TRAPS":
                eff = o.get("effect") or {}
                for k, v in eff.items():
                    if isinstance(v, dict) and "damage" in v and "Damage" in r:
                        checks.append((f"{k}.damage", v["damage"], f(r["Damage"])))
                        break
            else:  # pets
                for of, cf, mult in [("max_hp", "Hitpoints", 1.0), ("dps", "DPS", 1.0),
                                     ("move_speed", "Speed", 1.0 / 12.5),
                                     ("range", "AttackRange", 1.0 / TILE),
                                     ("attack_speed_sec", "AttackSpeed", 1.0 / MS)]:
                    if of == "dps" and o["name"] == "Unicorn":
                        continue  # csv stores heal-HPS negative; ours positive
                    if cf in r:
                        checks.append((of, o.get(of, -1), f(r[cf]) * mult))
            for of, ov, rv in checks:
                d = pct(ov, rv)
                if d > tol and rv != 0:
                    bad += 1
                    print(f"{o['name']:24}{of:14}{round(ov, 3):>12}{round(rv, 3):>12}  {d:5.1f}%")

    print()
    print(f"--> {bad} numeric mismatches (tolerance {float(sys.argv[2]) if len(sys.argv) > 2 else 5.0:.0f}%).")


if __name__ == "__main__":
    main()
