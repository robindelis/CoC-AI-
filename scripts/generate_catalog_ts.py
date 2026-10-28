#!/usr/bin/env python3
"""Generates /web/src/wasm-pkg/catalogData.ts directly from crates/coc-data/src/*.rs."""

import json
import math
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA_DIR = ROOT / "crates" / "coc-data" / "src"
OUT_PATH = ROOT / "web" / "src" / "wasm-pkg" / "catalogData.ts"


def strip_comments(text: str) -> str:
    return re.sub(r"//.*", "", text)


def parse_rust_value(val_str: str):
    val_str = val_str.strip().rstrip(",")
    if val_str == "true":
        return True
    if val_str == "false":
        return False
    if val_str.startswith('"') and val_str.endswith('"'):
        return val_str[1:-1]
    if val_str.endswith(".to_string()"):
        inner = val_str[: -len(".to_string()")].strip()
        if inner.startswith('"') and inner.endswith('"'):
            return inner[1:-1]
    # Numeric
    m_num = re.match(r"^-?\d+(\.\d+)?(u8|u16|u32|usize|f32)?$", val_str)
    if m_num:
        cleaned = re.sub(r"(u8|u16|u32|usize|f32)$", "", val_str)
        return float(cleaned) if "." in cleaned else int(cleaned)
    # Slice or array &[ ... ] or [ ... ]
    if val_str.startswith("&[") or val_str.startswith("["):
        inner = val_str.lstrip("&")[1:-1].strip()
        if not inner:
            return []
        parts = [p.strip() for p in inner.split(",") if p.strip()]
        return [parse_rust_value(p) for p in parts]
    # Enum with struct payload: Enum::Variant { a: 1, b: 2 }
    m_enum_struct = re.match(r"^[A-Za-z0-9_]+::([A-Za-z0-9_]+)\s*\{(.*)\}$", val_str, re.S)
    if m_enum_struct:
        variant = m_enum_struct.group(1)
        body = m_enum_struct.group(2)
        fields = {}
        for fm in re.finditer(r"([a-z0-9_]+)\s*:\s*([^,]+)", body):
            fields[fm.group(1)] = parse_rust_value(fm.group(2))
        return {variant: fields}
    # Simple Enum::Variant
    m_enum = re.match(r"^[A-Za-z0-9_]+::([A-Za-z0-9_]+)$", val_str)
    if m_enum:
        return m_enum.group(1)
    return val_str


def parse_struct_blocks(rs_text: str, struct_name: str):
    text = strip_comments(rs_text)
    items = []
    pattern = re.compile(rf"{struct_name}\s*\{{", re.S)
    pos = 0
    while True:
        m = pattern.search(text, pos)
        if not m:
            break
        start = m.end()
        depth = 1
        i = start
        while i < len(text) and depth > 0:
            if text[i] == "{":
                depth += 1
            elif text[i] == "}":
                depth -= 1
            i += 1
        body = text[start : i - 1]
        pos = i
        # Check if this is the struct definition itself (contains `pub `)
        if "pub " in body:
            continue
        obj = {}
        # Parse top-level key: value pairs inside the struct literal
        field_pos = 0
        while field_pos < len(body):
            fm = re.search(r"([a-z0-9_]+)\s*:\s*", body[field_pos:])
            if not fm:
                break
            key = fm.group(1)
            v_start = field_pos + fm.end()
            # scan until comma at depth 0
            d = 0
            in_str = False
            j = v_start
            while j < len(body):
                ch = body[j]
                if ch == '"' and (j == 0 or body[j - 1] != "\\"):
                    in_str = not in_str
                elif not in_str:
                    if ch in "{[(":
                        d += 1
                    elif ch in "}])":
                        d -= 1
                    elif ch == "," and d == 0:
                        break
                j += 1
            val_raw = body[v_start:j].strip()
            obj[key] = parse_rust_value(val_raw)
            field_pos = j + 1
        if "id" in obj and "name" in obj:
            items.append(obj)
    return items


# Replicate deterministic LayoutBuilder from crates/coc-data/src/presets.rs
MAP_SIZE = 50
BUILD_MIN = 3
BUILD_MAX = 47


class LayoutBuilder:
    def __init__(self, building_specs, trap_specs):
        self.occ = [[False] * 50 for _ in range(50)]
        self.buildings = []
        self.walls = []
        self.traps = []
        self.next_b_id = 1
        self.next_t_id = 1
        self.b_map = {b["id"]: b for b in building_specs}
        self.t_map = {t["id"]: t for t in trap_specs}

    def can_place(self, x: int, y: int, size: int) -> bool:
        if x < BUILD_MIN or y < BUILD_MIN or x + size > BUILD_MAX or y + size > BUILD_MAX:
            return False
        for dy in range(size):
            for dx in range(size):
                if self.occ[y + dy][x + dx]:
                    return False
        return True

    def mark(self, x: int, y: int, size: int):
        for dy in range(size):
            for dx in range(size):
                self.occ[y + dy][x + dx] = True

    def try_place_building(self, building_id: str, x: int, y: int, mode: str, direction_deg: float) -> bool:
        spec = self.b_map[building_id]
        size = int(spec["footprint"])
        if not self.can_place(x, y, size):
            return False
        self.mark(x, y, size)
        self.buildings.append(
            {
                "instance_id": self.next_b_id,
                "building_id": building_id,
                "tile_x": x,
                "tile_y": y,
                "mode": mode,
                "direction_deg": float(direction_deg),
            }
        )
        self.next_b_id += 1
        return True

    def place_near(self, building_id: str, target_x: float, target_y: float, mode: str) -> bool:
        spec = self.b_map[building_id]
        size = int(spec["footprint"])
        best = None
        for y in range(BUILD_MIN, BUILD_MAX - size + 1):
            for x in range(BUILD_MIN, BUILD_MAX - size + 1):
                if not self.can_place(x, y, size):
                    continue
                dx = x + size * 0.5 - target_x
                dy = y + size * 0.5 - target_y
                d2 = int(dx * dx + dy * dy)
                if best is None or d2 < best[2]:
                    best = (x, y, d2)
        if best is not None:
            bx, by, _ = best
            cx = bx + size * 0.5
            cy = by + size * 0.5
            raw_deg = math.degrees(math.atan2(cy - 25.0, cx - 25.0)) % 360.0
            if building_id == "AirSweeper":
                dir_deg = (round(raw_deg / 45.0) * 45.0) % 360.0
            elif building_id == "Firespitter":
                dir_deg = (round(raw_deg / 90.0) * 90.0) % 360.0
            else:
                dir_deg = 0.0
            return self.try_place_building(building_id, bx, by, mode, dir_deg)
        return False

    @staticmethod
    def spread_anchor(index: int, count: int, r_min: float, r_max: float):
        GOLDEN = 2.3999631
        t = 0.0 if count <= 1 else index / (count - 1)
        radius = r_min + (r_max - r_min) * t
        angle = index * GOLDEN
        return (24.0 + radius * math.cos(angle), 24.0 + radius * math.sin(angle))

    def try_add_wall(self, x: int, y: int):
        if len(self.walls) >= 325:
            return
        if self.can_place(x, y, 1):
            self.mark(x, y, 1)
            self.walls.append([x, y])

    def add_wall_rect(self, x0: int, y0: int, x1: int, y1: int, leave_gates: bool):
        mid_x = (x0 + x1) // 2
        mid_y = (y0 + y1) // 2
        gate_w = max(1, (x1 - x0) // 10)
        for x in range(x0, x1 + 1):
            for y in (y0, y1):
                if leave_gates and abs(x - mid_x) < gate_w:
                    continue
                self.try_add_wall(x, y)
        for y in range(y0 + 1, y1):
            for x in (x0, x1):
                if leave_gates and abs(y - mid_y) < gate_w:
                    continue
                self.try_add_wall(x, y)


def th18_defenses_for_archetype(archetype: int):
    v = []
    def push(b_id, mode, n):
        for _ in range(n):
            v.append((b_id, mode))

    push("Monolith", "Default", 1)
    push("RevengeTower", "Default", 1)
    mg_mode = "MultiGearFastAttack" if archetype == 4 else "MultiGearLongRange"
    push("MultiGearTower", mg_mode, 1)
    push("CraftingStation", "Default", 1)

    if archetype in (1, 2):
        push("InfernoTower", "InfernoSingle", 2)
        push("InfernoTower", "InfernoMulti", 1)
    elif archetype == 3:
        push("InfernoTower", "InfernoSingle", 3)
    else:
        push("InfernoTower", "InfernoMulti", 3)

    push("Scattershot", "Default", 2)
    push("Firespitter", "Default", 2)
    push("SuperWizardTower", "Default", 2)

    if archetype == 2:
        push("XBow", "XBowAirAndGround", 4)
    elif archetype == 3:
        push("XBow", "XBowGround", 2)
        push("XBow", "XBowAirAndGround", 2)
    else:
        push("XBow", "XBowAirAndGround", 3)
        push("XBow", "XBowGround", 1)

    push("MultiArcherTower", "Default", 3)
    push("RicochetCannon", "Default", 3)
    push("AirDefense", "Default", 4)
    push("AirSweeper", "Default", 2)

    if archetype == 2:
        push("SpellTower", "SpellTowerPoison", 1)
        push("SpellTower", "SpellTowerInvisibility", 1)
    elif archetype == 3:
        push("SpellTower", "SpellTowerEarthquake", 1)
        push("SpellTower", "SpellTowerInvisibility", 1)
    elif archetype == 4:
        push("SpellTower", "SpellTowerRage", 2)
    else:
        push("SpellTower", "SpellTowerRage", 1)
        push("SpellTower", "SpellTowerPoison", 1)

    push("BombTower", "Default", 2)
    push("WizardTower", "Default", 2)
    push("Mortar", "Default", 4)
    push("Cannon", "Default", 1)
    push("ArcherTower", "Default", 3)
    push("HiddenTesla", "Default", 5)
    push("BuildersHut", "Default", 5)
    return v


def build_th18_meta_village(archetype: int, building_specs, trap_specs):
    b = LayoutBuilder(building_specs, trap_specs)
    if archetype == 1:
        th_x, th_y, th_mode, core_cx, core_cy = 16, 23, "GuardianLongshot", 30.0, 24.0
    elif archetype == 2:
        th_x, th_y, th_mode, core_cx, core_cy = 23, 23, "GuardianLongshot", 24.0, 24.0
    elif archetype == 3:
        th_x, th_y, th_mode, core_cx, core_cy = 23, 17, "GuardianLogger", 24.0, 26.0
    elif archetype == 4:
        th_x, th_y, th_mode, core_cx, core_cy = 17, 28, "GuardianLogger", 29.0, 19.0
    else:
        th_x, th_y, th_mode, core_cx, core_cy = 23, 23, "GuardianSmasher", 24.0, 24.0

    b.try_place_building("TownHall", th_x, th_y, th_mode, 0.0)

    if archetype == 1:
        b.add_wall_rect(13, 19, 22, 29, True)
        b.add_wall_rect(25, 17, 37, 31, True)
        b.add_wall_rect(9, 10, 41, 39, True)
        for i in range(5, 12):
            b.try_add_wall(24, i)
            b.try_add_wall(24, 49 - i)
    elif archetype == 2:
        b.add_wall_rect(20, 20, 29, 29, False)
        b.add_wall_rect(12, 12, 37, 37, True)
        b.add_wall_rect(7, 7, 42, 42, True)
        for i in range(7, 12):
            b.try_add_wall(i, 20)
            b.try_add_wall(49 - i, 29)
            b.try_add_wall(20, i)
            b.try_add_wall(29, 49 - i)
    elif archetype == 3:
        b.add_wall_rect(9, 9, 21, 21, True)
        b.add_wall_rect(28, 9, 40, 21, True)
        b.add_wall_rect(9, 28, 21, 40, True)
        b.add_wall_rect(28, 28, 40, 40, True)
        b.add_wall_rect(18, 15, 31, 34, True)
    elif archetype == 4:
        b.add_wall_rect(23, 12, 37, 26, True)
        b.add_wall_rect(18, 9, 41, 32, True)
        b.add_wall_rect(12, 24, 24, 36, True)
        b.add_wall_rect(8, 8, 42, 41, True)
    else:
        b.add_wall_rect(19, 19, 30, 30, True)
        b.add_wall_rect(14, 14, 35, 35, True)
        b.add_wall_rect(9, 9, 40, 40, True)
        for i in range(5, 9):
            b.try_add_wall(i, 24)
            b.try_add_wall(49 - i, 24)
            b.try_add_wall(24, i)
            b.try_add_wall(24, 49 - i)

    defences = th18_defenses_for_archetype(archetype)
    n = len(defences)
    for i, (b_id, mode) in enumerate(defences):
        if archetype == 2:
            r_min, r_max = (3.5, 6.0) if i < n // 4 else ((9.0, 14.0) if i < (3 * n) // 4 else (14.0, 17.5))
        elif archetype == 3:
            r_min, r_max = (5.0, 9.5) if i < n // 3 else ((9.5, 14.0) if i < (2 * n) // 3 else (14.0, 18.0))
        else:
            r_min, r_max = (3.4, 7.0) if i < n // 3 else ((7.0, 11.0) if i < (2 * n) // 3 else (11.0, 14.5))
        base_x, base_y = LayoutBuilder.spread_anchor(i + archetype * 5, n, r_min, r_max)
        tx = max(6.0, min(43.0, base_x + (core_cx - 24.0) * 0.55))
        ty = max(6.0, min(43.0, base_y + (core_cy - 24.0) * 0.55))
        if not b.place_near(b_id, tx, ty, mode):
            b.place_near(b_id, 24.0, 24.0, mode)

    storages = [
        "GoldStorage", "GoldStorage", "GoldStorage", "GoldStorage",
        "ElixirStorage", "ElixirStorage", "ElixirStorage", "ElixirStorage",
        "DarkElixirStorage", "ClanCastle",
    ]
    for i, b_id in enumerate(storages):
        tx, ty = LayoutBuilder.spread_anchor(i + 7 + archetype * 3, len(storages), 6.0, 11.5)
        b.place_near(b_id, tx, ty, "Default")

    collectors = (
        ["GoldMine"] * 7
        + ["ElixirCollector"] * 7
        + ["DarkElixirDrill"] * 3
    )
    for i, b_id in enumerate(collectors):
        tx, ty = LayoutBuilder.spread_anchor(i + archetype * 2, len(collectors), 13.0, 19.5)
        b.place_near(b_id, tx, ty, "Default")

    army_buildings = [
        "ArmyCamp", "ArmyCamp", "ArmyCamp", "ArmyCamp",
        "Barracks", "DarkBarracks", "Laboratory", "SpellFactory",
        "DarkSpellFactory", "HeroHall", "Blacksmith", "Workshop",
        "PetHouse", "HelperHut", "BobsHut",
    ]
    for i, b_id in enumerate(army_buildings):
        tx, ty = LayoutBuilder.spread_anchor(i + 3 + archetype, len(army_buildings), 15.0, 20.5)
        b.place_near(b_id, tx, ty, "Default")

    for spec in trap_specs:
        for _ in range(int(spec["max_count"])):
            trap_id = spec["id"]
            mode = spec["default_mode"]
            size = int(spec["footprint"])
            best = None
            for y in range(BUILD_MIN, BUILD_MAX - size + 1):
                for x in range(BUILD_MIN, BUILD_MAX - size + 1):
                    if not b.can_place(x, y, size):
                        continue
                    dx = x + size * 0.5 - core_cx
                    dy = y + size * 0.5 - core_cy
                    d2 = int(dx * dx + dy * dy)
                    if best is None or d2 < best[2]:
                        best = (x, y, d2)
            if best is not None:
                tx, ty, _ = best
                b.mark(tx, ty, size)
                b.traps.append(
                    {
                        "instance_id": b.next_t_id,
                        "trap_id": trap_id,
                        "tile_x": tx,
                        "tile_y": ty,
                        "mode": mode,
                    }
                )
                b.next_t_id += 1

    for r in (16, 22, 27, 33):
        if len(b.walls) >= 325:
            break
        b.add_wall_rect(min(r, 20), min(r, 20), max(49 - r, 29), max(49 - r, 29), True)

    sweeper_dirs = [180.0, 0.0] if archetype % 2 == 0 else [90.0, 270.0]
    spitter_dirs = [225.0, 180.0] if archetype == 4 else [180.0, 0.0]
    sw_i = 0
    sp_i = 0
    for pb in b.buildings:
        if pb["building_id"] == "AirSweeper":
            pb["direction_deg"] = sweeper_dirs[sw_i % len(sweeper_dirs)]
            sw_i += 1
        elif pb["building_id"] == "Firespitter":
            pb["direction_deg"] = spitter_dirs[sp_i % len(spitter_dirs)]
            sp_i += 1

    names = {
        0: "TH18 Central Box Legends (Cake-A-Pult + Smasher)",
        1: "TH18 Offset Diamond (Hot Candle + Longshot)",
        2: "TH18 Anti-Hydra Air Ring (4 Air X-Bows + Sweepers)",
        3: "TH18 Anti-Fireball Wide Spread (3 Single Infernos)",
        4: "TH18 Teaser War Base (Double Rage Towers + Killzone)",
    }
    if archetype == 2:
        cc = [["LavaHound", 1], ["IceGolem", 1], ["Archer", 5]]
    elif archetype == 4:
        cc = [["Furnace", 1], ["Witch", 1], ["Headhunter", 3], ["Archer", 2]]
    else:
        cc = [["IceGolem", 2], ["Headhunter", 3], ["Archer", 7]]

    return {
        "name": names[archetype],
        "buildings": b.buildings,
        "walls": b.walls,
        "traps": b.traps,
        "defending_heroes": [
            {"hero_id": "BarbarianKing", "tile_x": 20, "tile_y": 27},
            {"hero_id": "ArcherQueen", "tile_x": 28, "tile_y": 20},
            {"hero_id": "GrandWarden", "tile_x": 27, "tile_y": 28},
            {"hero_id": "DragonDuke", "tile_x": 20, "tile_y": 20},
        ],
        "defending_cc_troops": cc,
    }


def get_preset_armies():
    return [
        {
            "name": "TH18 Thrower + Healer + Totem Smash (Meta)",
            "troops": [
                ["Thrower", 12],
                ["Healer", 5],
                ["Furnace", 2],
                ["Druid", 1],
                ["IceGolem", 1],
                ["SuperWallBreaker", 1],
                ["Headhunter", 1],
                ["Balloon", 1],
                ["Archer", 4],
            ],
            "spells": [
                ["Totem", 7],
                ["Rage", 1],
                ["Poison", 1],
                ["SkeletonSpell", 1],
            ],
            "heroes": [
                ["BarbarianKing", "Frosty"],
                ["ArcherQueen", "Unicorn"],
                ["GrandWarden", "AngryJelly"],
                ["RoyalChampion", "Phoenix"],
            ],
            "hero_equipment": [
                ["BarbarianKing", ["SpikyBall", "SnakeBracelet"]],
                ["ArcherQueen", ["MagicMirror", "ActionFigure"]],
                ["GrandWarden", ["EternalTome", "RageGem"]],
                ["RoyalChampion", ["RocketSpear", "ElectroBoots"]],
            ],
            "siege_machine": "LogLauncher",
            "cc_troops": [["SuperYeti", 1], ["SuperValkyrie", 1]],
            "cc_spells": [["Rage", 1], ["Freeze", 1]],
        },
        {
            "name": "TH18 Dragon Duke Charge Hydra (Meta)",
            "troops": [
                ["Dragon", 7],
                ["DragonRider", 6],
                ["RocketBalloon", 5],
                ["IceGolem", 1],
                ["Headhunter", 1],
                ["Archer", 1],
            ],
            "spells": [
                ["Totem", 6],
                ["Rage", 2],
                ["Freeze", 1],
                ["Poison", 1],
            ],
            "heroes": [
                ["DragonDuke", "Phoenix"],
                ["MinionPrince", "AngryJelly"],
                ["GrandWarden", "ElectroOwl"],
                ["RoyalChampion", "SpiritFox"],
            ],
            "hero_equipment": [
                ["DragonDuke", ["RevengeDeck", "FlameBlower"]],
                ["MinionPrince", ["PortalPendant", "DarkOrb"]],
                ["GrandWarden", ["EternalTome", "RageGem"]],
                ["RoyalChampion", ["RocketSpear", "ElectroBoots"]],
            ],
            "siege_machine": "BattleBlimp",
            "cc_troops": [["DragonRider", 2], ["Balloon", 1]],
            "cc_spells": [["Rage", 1], ["Freeze", 1]],
        },
        {
            "name": "TH18 Fireball Super Bowler & Meteor Golem Smash (Meta)",
            "troops": [
                ["SuperBowler", 5],
                ["MeteorGolem", 1],
                ["Healer", 5],
                ["RootRider", 1],
                ["Furnace", 1],
                ["Druid", 1],
                ["SuperWallBreaker", 2],
                ["IceGolem", 1],
                ["Headhunter", 1],
                ["Archer", 1],
            ],
            "spells": [
                ["Totem", 4],
                ["Rage", 2],
                ["Overgrowth", 1],
                ["Earthquake", 1],
                ["Invisibility", 1],
            ],
            "heroes": [
                ["GrandWarden", "AngryJelly"],
                ["DragonDuke", "Phoenix"],
                ["BarbarianKing", "Frosty"],
                ["ArcherQueen", "Unicorn"],
            ],
            "hero_equipment": [
                ["GrandWarden", ["Fireball", "EternalTome"]],
                ["DragonDuke", ["RocketBackpack", "FireHeart"]],
                ["BarbarianKing", ["GiantGauntlet", "SpikyBall"]],
                ["ArcherQueen", ["MagicMirror", "FrozenArrow"]],
            ],
            "siege_machine": "FlameFlinger",
            "cc_troops": [["SuperYeti", 1], ["IceGolem", 1]],
            "cc_spells": [["Rage", 1], ["Poison", 1]],
        },
    ]


def main():
    buildings = parse_struct_blocks((DATA_DIR / "buildings.rs").read_text(), "BuildingSpec")
    traps = parse_struct_blocks((DATA_DIR / "traps.rs").read_text(), "TrapSpec")
    troops = parse_struct_blocks((DATA_DIR / "troops.rs").read_text(), "TroopSpec")
    heroes_rs = (DATA_DIR / "heroes.rs").read_text()
    heroes = parse_struct_blocks(heroes_rs, "HeroSpec")
    equipment = parse_struct_blocks(heroes_rs, "HeroEquipmentSpec")
    pets = parse_struct_blocks(heroes_rs, "PetSpec")
    spells = parse_struct_blocks((DATA_DIR / "spells.rs").read_text(), "SpellSpec")

    catalog = {
        "buildings": buildings,
        "traps": traps,
        "troops": troops,
        "heroes": heroes,
        "equipment": equipment,
        "pets": pets,
        "spells": spells,
        "preset_layouts": [build_th18_meta_village(i, buildings, traps) for i in range(5)],
        "preset_armies": get_preset_armies(),
    }

    OUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    ts_code = (
        "import { FullCatalog } from '../types';\n\n"
        f"export const FULL_CATALOG: FullCatalog = {json.dumps(catalog, indent=2)} as unknown as FullCatalog;\n"
    )
    OUT_PATH.write_text(ts_code)
    print(
        f"Wrote {OUT_PATH} ({len(buildings)} buildings, {len(traps)} traps, "
        f"{len(troops)} troops, {len(heroes)} heroes, {len(equipment)} equipment, "
        f"{len(pets)} pets, {len(spells)} spells)"
    )


if __name__ == "__main__":
    main()
