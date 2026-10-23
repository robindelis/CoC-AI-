pub mod buildings;
pub mod heroes;
pub mod presets;
pub mod spells;
pub mod traps;
pub mod troops;

pub use buildings::*;
pub use heroes::*;
pub use presets::*;
pub use spells::*;
pub use traps::*;
pub use troops::*;

use serde::Serialize;

#[derive(Serialize)]
pub struct FullCatalog {
    pub buildings: &'static [BuildingSpec],
    pub traps: &'static [TrapSpec],
    pub troops: &'static [TroopSpec],
    pub heroes: &'static [HeroSpec],
    pub equipment: &'static [HeroEquipmentSpec],
    pub pets: &'static [PetSpec],
    pub spells: &'static [SpellSpec],
    pub preset_layouts: Vec<VillageLayout>,
    pub preset_armies: Vec<ArmyLoadout>,
}

pub fn get_full_catalog() -> FullCatalog {
    FullCatalog {
        buildings: BUILDINGS,
        traps: TRAPS,
        troops: TROOPS,
        heroes: HEROES,
        equipment: HERO_EQUIPMENT,
        pets: PETS,
        spells: SPELLS,
        preset_layouts: get_preset_layouts(),
        preset_armies: get_preset_armies(),
    }
}
