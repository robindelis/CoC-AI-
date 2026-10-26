#!/usr/bin/env python3
"""
Downloads official Clash of Clans TH18 sprites from ClashKingAssets and clash-of-clans-data
into web/public/assets/ and generates web/src/assetsManifest.ts.

Run:  python3 scripts/fetch_assets.py
"""
import concurrent.futures
import json
import re
import urllib.parse
import urllib.request
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
ASSETS_DIR = ROOT / "web" / "public" / "assets"
MANIFEST_TS = ROOT / "web" / "src" / "assetsManifest.ts"

CK_BASE = "https://raw.githubusercontent.com/ClashKingInc/ClashKingAssets/main/assets/"
CP_BASE = "https://raw.githubusercontent.com/chiefpansancolt/clash-of-clans-data/main/"
CP_TREE_API = "https://api.github.com/repos/chiefpansancolt/clash-of-clans-data/git/trees/main?recursive=1"

DOWNLOADS: dict[str, str] = {}

# --------------------------------------------------------------------------
# 1. Buildings (max TH18 level)
# --------------------------------------------------------------------------
BUILDINGS = {
    "TownHall": ("buildings/town_hall.webp", CK_BASE + "buildings/home-village/town_hall/level_18.webp"),
    "ArcherTower": ("buildings/archer_tower.webp", CK_BASE + "buildings/home-village/archer_tower/level_21.webp"),
    "MultiArcherTower": ("buildings/multi_archer_tower.webp", CK_BASE + "buildings/home-village/multi-archer_tower/level_4.webp"),
    "RicochetCannon": ("buildings/ricochet_cannon.webp", CK_BASE + "buildings/home-village/ricochet_cannon/level_4.webp"),
    "Cannon": ("buildings/cannon.webp", CK_BASE + "buildings/home-village/cannon/level_21.webp"),
    "Mortar": ("buildings/mortar.webp", CK_BASE + "buildings/home-village/mortar/level_18.webp"),
    "AirDefense": ("buildings/air_defense.webp", CK_BASE + "buildings/home-village/air_defense/level_16.webp"),
    "WizardTower": ("buildings/wizard_tower.webp", CK_BASE + "buildings/home-village/wizard_tower/level_17.webp"),
    "SuperWizardTower": ("buildings/super_wizard_tower.webp", CK_BASE + "buildings/home-village/super_wizard_tower/level_2.webp"),
    "AirSweeper": ("buildings/air_sweeper.webp", CK_BASE + "buildings/home-village/air_sweeper/level_7.webp"),
    "HiddenTesla": ("buildings/hidden_tesla.webp", CK_BASE + "buildings/home-village/hidden_tesla/level_17.webp"),
    "BombTower": ("buildings/bomb_tower.webp", CK_BASE + "buildings/home-village/bomb_tower/level_13.webp"),
    "XBow": ("buildings/x_bow.webp", CK_BASE + "buildings/home-village/x-bow/level_13.webp"),
    "InfernoTower": ("buildings/inferno_tower.webp", CK_BASE + "buildings/home-village/inferno_tower/level_12.webp"),
    "Scattershot": ("buildings/scattershot.webp", CK_BASE + "buildings/home-village/scattershot/level_7.webp"),
    "BuildersHut": ("buildings/builders_hut.webp", CK_BASE + "buildings/home-village/builder's_hut/level_8.webp"),
    "SpellTower": ("buildings/spell_tower.webp", CK_BASE + "buildings/home-village/spell_tower/level_4.webp"),
    "Monolith": ("buildings/monolith.webp", CK_BASE + "buildings/home-village/monolith/level_5.webp"),
    "MultiGearTower": ("buildings/multi_gear_tower.webp", CK_BASE + "buildings/home-village/multi-gear_tower/level_3.webp"),
    "Firespitter": ("buildings/firespitter.webp", CK_BASE + "buildings/home-village/firespitter/level_3.webp"),
    "RevengeTower": ("buildings/revenge_tower.webp", CK_BASE + "buildings/home-village/revenge_tower/level_2.webp"),
    "CraftingStation": ("buildings/hot_candle.webp", CK_BASE + "buildings/seasonal-defense/hot_candle/level_4.webp"),
    "ClanCastle": ("buildings/clan_castle.webp", CK_BASE + "buildings/home-village/clan_castle/level_14.webp"),
    "GoldStorage": ("buildings/gold_storage.webp", CK_BASE + "buildings/home-village/gold_storage/level_19.webp"),
    "ElixirStorage": ("buildings/elixir_storage.webp", CK_BASE + "buildings/home-village/elixir_storage/level_19.webp"),
    "DarkElixirStorage": ("buildings/dark_elixir_storage.webp", CK_BASE + "buildings/home-village/dark_elixir_storage/level_13.webp"),
    "GoldMine": ("buildings/gold_mine.webp", CK_BASE + "buildings/home-village/gold_mine/level_17.webp"),
    "ElixirCollector": ("buildings/elixir_collector.webp", CK_BASE + "buildings/home-village/elixir_collector/level_17.webp"),
    "DarkElixirDrill": ("buildings/dark_elixir_drill.webp", CK_BASE + "buildings/home-village/dark_elixir_drill/level_11.webp"),
    "ArmyCamp": ("buildings/army_camp.webp", CK_BASE + "buildings/home-village/army_camp/level_14.webp"),
    "Barracks": ("buildings/barracks.webp", CK_BASE + "buildings/home-village/barracks/level_19.webp"),
    "DarkBarracks": ("buildings/dark_barracks.webp", CK_BASE + "buildings/home-village/dark_barracks/level_13.webp"),
    "Laboratory": ("buildings/laboratory.webp", CK_BASE + "buildings/home-village/laboratory/level_16.webp"),
    "SpellFactory": ("buildings/spell_factory.webp", CK_BASE + "buildings/home-village/spell_factory/level_9.webp"),
    "DarkSpellFactory": ("buildings/dark_spell_factory.webp", CK_BASE + "buildings/home-village/dark_spell_factory/level_8.webp"),
    "HeroHall": ("buildings/hero_hall.webp", CK_BASE + "buildings/home-village/hero_hall/level_12.webp"),
    "Blacksmith": ("buildings/blacksmith.webp", CK_BASE + "buildings/home-village/blacksmith/level_9.webp"),
    "Workshop": ("buildings/workshop.webp", CK_BASE + "buildings/home-village/workshop/level_9.webp"),
    "PetHouse": ("buildings/pet_house.webp", CK_BASE + "buildings/home-village/pet_house/level_12.webp"),
    "HelperHut": ("buildings/helper_hut.png", CP_BASE + "images/home/other/helper-hut/normal/level-1.png"),
    "BobsHut": ("buildings/bobs_hut.png", CP_BASE + "images/home/other/bobs-hut/normal/level-1.png"),
    "Wall": ("buildings/wall.webp", CK_BASE + "buildings/home-village/wall/level_19.webp"),
}

BUILDING_MODES = {
    "InfernoMulti": ("buildings/inferno_multi.png", CP_BASE + "images/home/defenses/inferno-tower/multi-target/level-12.png"),
    "XBowAirAndGround": ("buildings/xbow_air.png", CP_BASE + "images/home/defenses/x-bow/air-and-ground/level-13.png"),
    "MultiGearFastAttack": ("buildings/multigear_fast.png", CP_BASE + "images/home/defenses/multi-gear-tower/fast-attack/level-3.png"),
    "SpellTowerPoison": ("buildings/spelltower_poison.png", CP_BASE + "images/home/defenses/spell-tower/poison/level-4.png"),
    "SpellTowerInvisibility": ("buildings/spelltower_invis.png", CP_BASE + "images/home/defenses/spell-tower/invisibility/level-4.png"),
    "SpellTowerEarthquake": ("buildings/spelltower_eq.png", CP_BASE + "images/home/defenses/spell-tower/earthquake/level-4.png"),
    "RevengeStage3": ("buildings/revenge_stage3.png", CP_BASE + "images/home/defenses/revenge-tower/stage-3/level-2.png"),
    "HotCandleStage2": ("buildings/hot_candle_stage2.webp", CK_BASE + "buildings/seasonal-defense/hot_candle/level_2.webp"),
    "HotCandleStage3": ("buildings/hot_candle_stage3.webp", CK_BASE + "buildings/seasonal-defense/hot_candle/level_1.webp"),
}

# --------------------------------------------------------------------------
# 2. Traps
# --------------------------------------------------------------------------
TRAPS = {
    "Bomb": ("traps/bomb.webp", CK_BASE + "traps/home-village/bomb/level_14.webp"),
    "SpringTrap": ("traps/spring_trap.webp", CK_BASE + "traps/home-village/spring_trap/level_13.webp"),
    "AirBomb": ("traps/air_bomb.webp", CK_BASE + "traps/home-village/air_bomb/level_13.webp"),
    "GiantBomb": ("traps/giant_bomb.webp", CK_BASE + "traps/home-village/giant_bomb/level_12.webp"),
    "SeekingAirMine": ("traps/seeking_air_mine.webp", CK_BASE + "traps/home-village/seeking_air_mine/level_8.webp"),
    "SkeletonTrap": ("traps/skeleton_trap.webp", CK_BASE + "traps/home-village/skeleton_trap/level_5.webp"),
    "TornadoTrap": ("traps/tornado_trap.webp", CK_BASE + "traps/home-village/tornado_trap/level_3.webp"),
    "GigaBomb": ("traps/giga_bomb.webp", CK_BASE + "traps/home-village/giga_bomb/level_4.webp"),
}

# --------------------------------------------------------------------------
# 3. Heroes, Equipment, Pets, Guardians
# --------------------------------------------------------------------------
HEROES = {
    "BarbarianKing": ("heroes/barbarian_king.webp", CK_BASE + "heroes/barbarian_king/icon.webp"),
    "ArcherQueen": ("heroes/archer_queen.webp", CK_BASE + "heroes/archer_queen/icon.webp"),
    "MinionPrince": ("heroes/minion_prince.webp", CK_BASE + "heroes/minion_prince/icon.webp"),
    "GrandWarden": ("heroes/grand_warden.webp", CK_BASE + "heroes/grand_warden/icon.webp"),
    "RoyalChampion": ("heroes/royal_champion.webp", CK_BASE + "heroes/royal_champion/icon.webp"),
    "DragonDuke": ("heroes/dragon_duke.webp", CK_BASE + "heroes/dragon_duke/icon.webp"),
}

HERO_BODIES = {
    "BarbarianKing": ("unit/heroes/barbarian_king.webp", CK_BASE + "skins/barbarian_king/icon.webp"),
    "ArcherQueen": ("unit/heroes/archer_queen.webp", CK_BASE + "skins/archer_queen/icon.webp"),
    "MinionPrince": ("unit/heroes/minion_prince.webp", CK_BASE + "skins/minion_prince/icon.webp"),
    "GrandWarden": ("unit/heroes/grand_warden.webp", CK_BASE + "skins/grand_warden/icon.webp"),
    "RoyalChampion": ("unit/heroes/royal_champion.webp", CK_BASE + "skins/royal_champion/icon.webp"),
    "DragonDuke": ("unit/heroes/dragon_duke.webp", CK_BASE + "skins/dragon_duke/icon.webp"),
}

HERO_BANNERS = {
    "BarbarianKing": ("heroes/banner_barbarian_king.png", CP_BASE + "images/home/army-buildings/hero-banner/barbarian-king.png"),
    "ArcherQueen": ("heroes/banner_archer_queen.png", CP_BASE + "images/home/army-buildings/hero-banner/archer-queen.png"),
    "MinionPrince": ("heroes/banner_minion_prince.png", CP_BASE + "images/home/army-buildings/hero-banner/minion-prince.png"),
    "GrandWarden": ("heroes/banner_grand_warden.png", CP_BASE + "images/home/army-buildings/hero-banner/grand-warden.png"),
    "RoyalChampion": ("heroes/banner_royal_champion.png", CP_BASE + "images/home/army-buildings/hero-banner/royal-champion.png"),
    "DragonDuke": ("heroes/banner_dragon_duke.png", CP_BASE + "images/home/army-buildings/hero-banner/dragon-duke.png"),
}

EQUIPMENT = {
    "BarbarianPuppet": "barbarian_puppet",
    "RageVial": "rage_vial",
    "EarthquakeBoots": "earthquake_boots",
    "Vampstache": "vampstache",
    "GiantGauntlet": "giant_gauntlet",
    "SpikyBall": "spiky_ball",
    "SnakeBracelet": "snake_bracelet",
    "StickHorse": "stick_horse",
    "ArcherPuppet": "archer_puppet",
    "InvisibilityVial": "invisibility_vial",
    "GiantArrow": "giant_arrow",
    "HealerPuppet": "healer_puppet",
    "FrozenArrow": "frozen_arrow",
    "MagicMirror": "magic_mirror",
    "ActionFigure": "action_figure",
    "MonolithArrow": "monolith_arrow",
    "EternalTome": "eternal_tome",
    "LifeGem": "life_gem",
    "RageGem": "rage_gem",
    "HealingTome": "healing_tome",
    "Fireball": "fireball",
    "LavaloonPuppet": "lavaloon_puppet",
    "HeroicTorch": "heroic_torch",
    "RoyalGem": "royal_gem",
    "SeekingShield": "seeking_shield",
    "HogRiderPuppet": "hog_rider_puppet",
    "HasteVial": "haste_vial",
    "RocketSpear": "rocket_spear",
    "ElectroBoots": "electro_boots",
    "FrostFlake": "frost_flake",
    "HenchmenPuppet": "henchmen_puppet",
    "DarkOrb": "dark_orb",
    "MetalPants": "metal_pants",
    "NobleIron": "noble_iron",
    "DarkCrown": "dark_crown",
    "MeteorStaff": "meteor_staff",
    "FireHeart": "fire_heart",
    "FlameBlower": "flame_blower",
    "StunBlaster": "stun_blaster",
    "ElectroFangs": "electro_fangs",
    "RocketBackpack": "rocket_backpack",
    "RevengeDeck": "revenge_deck",
}
EQUIPMENT_MAP = {
    k: (f"equipment/{v}.webp", CK_BASE + f"equipment/{v}.webp")
    for k, v in EQUIPMENT.items()
}

PETS = {
    "Lassi": "lassi",
    "ElectroOwl": "electro_owl",
    "MightyYak": "mighty_yak",
    "Unicorn": "unicorn",
    "Frosty": "frosty",
    "Diggy": "diggy",
    "PoisonLizard": "poison_lizard",
    "Phoenix": "phoenix",
    "SpiritFox": "spirit_fox",
    "AngryJelly": "angry_jelly",
    "Sneezy": "sneezy",
    "GreedyRaven": "greedy_raven",
}
PETS_MAP = {
    k: (f"pets/{v}.webp", CK_BASE + f"pets/{v}/icon.webp")
    for k, v in PETS.items()
}

# --------------------------------------------------------------------------
# 4. Troop / Siege / Pet / Guardian sheet directory names (official folder names)
#    Full-body renders are resolved to their highest available level at runtime.
# --------------------------------------------------------------------------
TROOP_SHEETS = {
    "Barbarian": "barbarian",
    "Archer": "archer",
    "Giant": "giant",
    "Goblin": "goblin",
    "WallBreaker": "wall-breaker",
    "Balloon": "balloon",
    "Wizard": "wizard",
    "Healer": "healer",
    "Dragon": "dragon",
    "Pekka": "pekka",
    "BabyDragon": "baby-dragon",
    "Miner": "miner",
    "ElectroDragon": "electro-dragon",
    "Yeti": "yeti",
    "DragonRider": "dragon-rider",
    "ElectroTitan": "electro-titan",
    "RootRider": "root-rider",
    "Thrower": "thrower",
    "MeteorGolem": "meteor-golem",
    "Minion": "minion",
    "HogRider": "hog-rider",
    "Valkyrie": "valkyrie",
    "Golem": "golem",
    "Witch": "witch",
    "LavaHound": "lava-hound",
    "Bowler": "bowler",
    "IceGolem": "ice-golem",
    "Headhunter": "headhunter",
    "ApprenticeWarden": "apprentice-warden",
    "Druid": "druid",
    "Furnace": "furnace",
    "RuinWitch": "ruin-witch",
    # Super troops reuse their base troop sheet with the /super/ render
    "SuperBarbarian": "barbarian",
    "SuperArcher": "archer",
    "SuperGiant": "giant",
    "SneakyGoblin": "goblin",
    "SuperWallBreaker": "wall-breaker",
    "RocketBalloon": "balloon",
    "SuperWizard": "wizard",
    "SuperDragon": "dragon",
    "InfernoDragon": "inferno-dragon",
    "SuperMiner": "miner",
    "SuperYeti": "yeti",
    "SuperMinion": "minion",
    "SuperHogRider": "hog-rider",
    "SuperValkyrie": "valkyrie",
    "SuperWitch": "witch",
    "IceHound": "lava-hound",
    "SuperBowler": "bowler",
}
SUPER_TROOPS = {
    "SuperBarbarian", "SuperArcher", "SuperGiant", "SneakyGoblin", "SuperWallBreaker",
    "RocketBalloon", "SuperWizard", "SuperDragon", "SuperMiner", "SuperYeti",
    "SuperMinion", "SuperHogRider", "SuperValkyrie", "SuperWitch", "SuperBowler",
}

SIEGE_SHEETS = {
    "WallWrecker": "wall-wrecker",
    "BattleBlimp": "battle-blimp",
    "StoneSlammer": "stone-slammer",
    "SiegeBarracks": "siege-barracks",
    "LogLauncher": "log-launcher",
    "FlameFlinger": "flame-flinger",
    "BattleDrill": "battle-drill",
    "TroopLauncher": "troop-launcher",
    "SkyWagon": "sky-wagon",
}

# Troop icon sheet names in ClashKingAssets
TROOPS_CK = {k: v.replace("-", "_") for k, v in TROOP_SHEETS.items()}
TROOPS_MAP = {
    k: (f"troops/{v}.webp", CK_BASE + f"troops/{v}/icon.webp")
    for k, v in TROOPS_CK.items()
}
for siege_id, sheet in SIEGE_SHEETS.items():
    v = sheet.replace("-", "_")
    TROOPS_MAP[siege_id] = (f"troops/{v}.webp", CK_BASE + f"siege_machines/{v}/icon.webp")
for super_id, fname in {
    "SuperBarbarian": "super_barbarian",
    "SuperArcher": "super_archer",
    "SuperGiant": "super_giant",
    "SneakyGoblin": "sneaky_goblin",
    "SuperWallBreaker": "super_wall_breaker",
    "RocketBalloon": "rocket_balloon",
    "SuperWizard": "super_wizard",
    "SuperDragon": "super_dragon",
    "InfernoDragon": "inferno_dragon",
    "SuperMiner": "super_miner",
    "SuperYeti": "super_yeti",
    "SuperMinion": "super_minion",
    "SuperHogRider": "super_hog_rider",
    "SuperValkyrie": "super_valkyrie",
    "SuperWitch": "super_witch",
    "IceHound": "ice_hound",
    "SuperBowler": "super_bowler",
}.items():
    TROOPS_MAP[super_id] = (f"troops/{fname}.webp", CK_BASE + f"troops/{fname}/icon.webp")
TROOPS_MAP.update({
    "GuardianLongshot": ("guardians/longshot.webp", CK_BASE + "guardians/longshot/icon.webp"),
    "GuardianSmasher": ("guardians/smasher.webp", CK_BASE + "guardians/smasher/icon.webp"),
    "GuardianLogger": ("guardians/logger.webp", CK_BASE + "guardians/logger/icon.webp"),
    "Skeleton": ("troops/skeleton.webp", "https://static.wikia.nocookie.net/clashofclans/images/a/a3/Skeleton_info.png/revision/latest?cb=20170927232100"),
    "ArmoredSkeleton": ("troops/armored_skeleton.webp", "https://static.wikia.nocookie.net/clashofclans/images/0/0c/Skeleton1_Shielded.png/revision/latest?cb=20201017212402"),
    "Bat": ("troops/bat.webp", CK_BASE + "spells/bat_spell.webp"),
    "Golemite": ("troops/golem.webp", CK_BASE + "troops/golem/icon.webp"),
    "LavaPup": ("troops/lava_hound.webp", CK_BASE + "troops/lava_hound/icon.webp"),
    "Yetimite": ("troops/yeti.webp", CK_BASE + "troops/yeti/icon.webp"),
    "Firemite": ("troops/firemite.webp", "https://static.wikia.nocookie.net/clashofclans/images/a/a7/Avatar_Firemite.png/revision/latest?cb=20251109095356"),
    "Frostmite": ("pets/frosty.webp", CK_BASE + "pets/frosty/icon.webp"),
    "Henchman": ("equipment/henchmen_puppet.webp", CK_BASE + "equipment/henchmen_puppet.webp"),
    "Booger": ("pets/sneezy.webp", CK_BASE + "pets/sneezy/icon.webp"),
    "DruidBear": ("troops/druid.webp", CK_BASE + "troops/druid/icon.webp"),
    "Meteormite": ("troops/meteor_golem.webp", CK_BASE + "troops/meteor_golem/icon.webp"),
    "RuinKnight": ("troops/ruin_witch.webp", CK_BASE + "troops/ruin_witch/icon.webp"),
    "GiantGiant": ("troops/giant_giant.webp", CK_BASE + "troops/giant_giant/icon.webp"),
    "Lavaloon": ("troops/lavaloon.webp", CK_BASE + "troops/lavaloon/icon.webp"),
    "Snake": ("equipment/snake_bracelet.webp", CK_BASE + "equipment/snake_bracelet.webp"),
})

SPELLS_CK = {
    "Lightning": "lightning_spell",
    "Healing": "healing_spell",
    "Rage": "rage_spell",
    "Jump": "jump_spell",
    "Freeze": "freeze_spell",
    "Clone": "clone_spell",
    "Invisibility": "invisibility_spell",
    "Recall": "recall_spell",
    "Revive": "revive_spell",
    "Totem": "totem_spell",
    "Poison": "poison_spell",
    "Earthquake": "earthquake_spell",
    "Haste": "haste_spell",
    "SkeletonSpell": "skeleton_spell",
    "BatSpell": "bat_spell",
    "Overgrowth": "overgrowth_spell",
    "IceBlock": "ice_block_spell",
    "Angry": "angry_spell",
}
SPELLS_MAP = {
    k: (f"spells/{v}.webp", CK_BASE + f"spells/{v}.webp")
    for k, v in SPELLS_CK.items()
}

# --------------------------------------------------------------------------
# 3b. FX / effect art (used by the canvas combat FX layer)
#
#     Neither mirror ships true projectile/deploy-shadow/sprung-trap atlases,
#     so the FX layer is canvas-drawn; these small derivables are the only
#     reusable art: flame renders for the Hot Candle fire, an icy crystal
#     block for freeze tinting, and the skeleton trap's air-mode render.
# --------------------------------------------------------------------------
FX_ART = {
    "EternalFlame": ("effects/eternal_flame.webp", CK_BASE + "decorations/home-village/eternal_flame.webp"),
    "ChampionsFlame": ("effects/champions_flame.webp", CK_BASE + "decorations/home-village/champion's_flame.webp"),
    "FrozenStone": ("effects/frozen_stone.webp", CK_BASE + "decorations/home-village/frozen_stone.webp"),
    "SkeletonTrapAir": ("traps/skeleton_trap_air.png", CP_BASE + "images/home/traps/skeleton-trap/air/level-5.png"),
    "AirWave": ("effects/air_wave_tex.png", ""),
    "AirWaveShadow": ("effects/air_wave_shadow.png", ""),
    "DirectionArrow": ("effects/arrow.png", ""),
    "DirectionArrowShort": ("effects/arrow_short.png", ""),
    "Flare": ("effects/flare.png", ""),
    "RangeEdge": ("effects/range.png", ""),
}

UI_ICONS = {
    "gold": ("ui/gold.webp", CK_BASE + "resources/gold.webp"),
    "elixir": ("ui/elixir.webp", CK_BASE + "resources/elixir.webp"),
    "dark_elixir": ("ui/dark_elixir.webp", CK_BASE + "resources/dark_elixir.webp"),
    "shiny_ore": ("ui/shiny_ore.webp", CK_BASE + "resources/shiny_ore.webp"),
    "glowy_ore": ("ui/glowy_ore.webp", CK_BASE + "resources/glowy_ore.webp"),
    "starry_ore": ("ui/starry_ore.webp", CK_BASE + "resources/starry_ore.webp"),
    "star": ("ui/star.png", CK_BASE + "icons/Icon_HV_Attack_Star.png"),
    "empty_star": ("ui/empty_star.png", CK_BASE + "icons/Icon_BB_Empty_Star.png"),
    "shield": ("ui/shield.png", CK_BASE + "icons/Icon_HV_Shield.png"),
    "sword": ("ui/sword.png", CK_BASE + "icons/Icon_HV_Sword.png"),
    "trophy": ("ui/trophy.png", CK_BASE + "icons/Icon_HV_Trophy.png"),
    "war": ("ui/war.png", CK_BASE + "icons/Icon_HV_Clan_War.png"),
}

# --------------------------------------------------------------------------
# Unit full-body render resolution (highest available level per sheet)
# --------------------------------------------------------------------------
def build_unit_body_jobs() -> dict[str, str]:
    print("Indexing clash-of-clans-data image tree for full-body renders...")
    req = urllib.request.Request(CP_TREE_API, headers={"User-Agent": "Mozilla/5.0"})
    with urllib.request.urlopen(req, timeout=30) as resp:
        tree = json.load(resp)

    # dir -> {level:int -> path}
    sheet_levels: dict[str, dict[int, str]] = defaultdict(dict)
    for entry in tree["tree"]:
        path = entry["path"]
        if not path.startswith("images/home/") or not path.endswith(".png"):
            continue
        m = re.match(r"^(.*)/level-(\d+)\.png$", path)
        if not m:
            continue
        sheet_levels[m.group(1)][int(m.group(2))] = path

    jobs: dict[str, str] = {}

    def add(local: str, sheet_dir: str) -> None:
        levels = sheet_levels.get(sheet_dir)
        if levels:
            best = levels[max(levels)]
            jobs[local] = CP_BASE + best

    for troop_id, sheet in TROOP_SHEETS.items():
        if troop_id in SUPER_TROOPS:
            add(f"unit/{troop_id}.png", f"images/home/troops/{sheet}/super")
        else:
            add(f"unit/{troop_id}.png", f"images/home/troops/{sheet}/normal")

    for siege_id, sheet in SIEGE_SHEETS.items():
        add(f"unit/{siege_id}.png", f"images/home/siege-machines/{sheet}/normal")

    for guardian in ("longshot", "smasher", "logger"):
        add(f"unit/guardians/{guardian}.png", f"images/home/guardians/{guardian}/normal")

    # Pets use a single full-body render (official folder names use hyphens)
    for pet_id, pet_dir in PETS.items():
        folder = pet_dir.replace("_", "-")
        jobs[f"unit/pets/{pet_id}.png"] = CP_BASE + f"images/home/pets/{folder}/normal.png"

    print(f"  resolved {len(jobs)} full-body unit renders.")
    return jobs


for group in (
    BUILDINGS,
    BUILDING_MODES,
    TRAPS,
    HEROES,
    HERO_BODIES,
    HERO_BANNERS,
    EQUIPMENT_MAP,
    PETS_MAP,
    TROOPS_MAP,
    SPELLS_MAP,
    FX_ART,
    UI_ICONS,
):
    for _, (rel_path, url) in group.items():
        DOWNLOADS[rel_path] = url


def fetch_one(item):
    rel_path, url = item
    dest = ASSETS_DIR / rel_path
    if dest.exists() and dest.stat().st_size > 100:
        return (rel_path, "cached")
    dest.parent.mkdir(parents=True, exist_ok=True)
    parts = urllib.parse.urlsplit(url)
    safe_url = urllib.parse.urlunsplit(
        (
            parts.scheme,
            parts.netloc,
            urllib.parse.quote(urllib.parse.unquote(parts.path), safe="/'"),
            parts.query,
            parts.fragment,
        )
    )
    req = urllib.request.Request(safe_url, headers={"User-Agent": "Mozilla/5.0"})
    with urllib.request.urlopen(req, timeout=25) as resp:
        data = resp.read()
    dest.write_bytes(data)
    return (rel_path, f"{len(data)} bytes")


def main() -> None:
    DOWNLOADS.update(build_unit_body_jobs())

    print(f"Downloading {len(DOWNLOADS)} Clash of Clans sprites to {ASSETS_DIR}...")
    failed = []
    with concurrent.futures.ThreadPoolExecutor(max_workers=24) as pool:
        futures = {pool.submit(fetch_one, item): item for item in DOWNLOADS.items()}
        for fut in concurrent.futures.as_completed(futures):
            rel_path, _ = futures[fut]
            try:
                fut.result()
            except Exception as exc:  # noqa: BLE001
                failed.append((rel_path, str(exc)))
                print(f"  [FAIL] {rel_path}: {exc}")

    print(f"Completed: {len(DOWNLOADS) - len(failed)}/{len(DOWNLOADS)} succeeded.")
    if failed:
        for f in failed:
            print("  Failed:", f)
        raise SystemExit(1)

    def urls(group) -> dict[str, str]:
        return {k: f"/assets/{v[0]}" for k, v in group.items()}

    unit_bodies: dict[str, str] = {}
    for rel_path in DOWNLOADS:
        if rel_path.startswith("unit/") and (ASSETS_DIR / rel_path).exists():
            unit_bodies[rel_path] = f"/assets/{rel_path}"

    ts = "// Auto-generated by scripts/fetch_assets.py — Real Clash of Clans TH18 Sprites\n\n"
    ts += f"export const BUILDING_SPRITES: Record<string, string> = {json.dumps(urls(BUILDINGS), indent=2)};\n\n"
    ts += f"export const BUILDING_MODE_SPRITES: Record<string, string> = {json.dumps(urls(BUILDING_MODES), indent=2)};\n\n"
    ts += f"export const TRAP_SPRITES: Record<string, string> = {json.dumps(urls(TRAPS), indent=2)};\n\n"
    ts += f"export const HERO_SPRITES: Record<string, string> = {json.dumps(urls(HEROES), indent=2)};\n\n"
    ts += f"export const HERO_BANNER_SPRITES: Record<string, string> = {json.dumps(urls(HERO_BANNERS), indent=2)};\n\n"
    ts += f"export const EQUIPMENT_SPRITES: Record<string, string> = {json.dumps(urls(EQUIPMENT_MAP), indent=2)};\n\n"
    ts += f"export const PET_SPRITES: Record<string, string> = {json.dumps(urls(PETS_MAP), indent=2)};\n\n"
    ts += f"export const TROOP_SPRITES: Record<string, string> = {json.dumps(urls(TROOPS_MAP), indent=2)};\n\n"
    ts += f"export const SPELL_SPRITES: Record<string, string> = {json.dumps(urls(SPELLS_MAP), indent=2)};\n\n"
    ts += f"export const FX_SPRITES: Record<string, string> = {json.dumps(urls(FX_ART), indent=2)};\n\n"
    ts += f"export const UI_SPRITES: Record<string, string> = {json.dumps(urls(UI_ICONS), indent=2)};\n\n"
    ts += (
        "// Full-body battlefield renders (transparent PNG) for troops, siege machines, pets & guardians\n"
        f"export const UNIT_BODY_SPRITES: Record<string, string> = {json.dumps(unit_bodies, indent=2)};\n"
    )

    MANIFEST_TS.write_text(ts, encoding="utf-8")
    print(f"Wrote {MANIFEST_TS}")


if __name__ == "__main__":
    main()
