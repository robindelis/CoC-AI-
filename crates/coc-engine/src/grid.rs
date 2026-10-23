use coc_data::{
    BuildingId, PlacedBuilding, VillageLayout, BUILD_MAX, BUILD_MIN, MAP_SIZE,
    get_building_spec, get_trap_spec, BUILDINGS, TRAPS,
};
use serde::{Deserialize, Serialize};
use std::cmp::Ordering;
use std::collections::{BinaryHeap, HashMap};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LayoutValidation {
    pub is_valid: bool,
    pub errors: Vec<String>,
    pub total_buildings: usize,
    pub total_walls: usize,
    pub total_traps: usize,
}

/// Validates a VillageLayout against Town Hall 18 rules:
/// - All buildings & traps within [3..47, 3..47]
/// - No overlapping footprints
/// - Counts do not exceed TH18 maximums
pub fn validate_layout(layout: &VillageLayout) -> LayoutValidation {
    let mut errors = Vec::new();
    let mut occ = [[false; 50]; 50];
    let mut building_counts: HashMap<BuildingId, u16> = HashMap::new();

    for b in &layout.buildings {
        if b.building_id == BuildingId::Wall {
            errors.push("Wall should be stored in layout.walls, not layout.buildings".to_string());
            continue;
        }
        let spec = get_building_spec(b.building_id);
        let size = spec.footprint;
        *building_counts.entry(b.building_id).or_insert(0) += 1;

        if b.tile_x < BUILD_MIN
            || b.tile_y < BUILD_MIN
            || b.tile_x + size > BUILD_MAX
            || b.tile_y + size > BUILD_MAX
        {
            errors.push(format!(
                "{} (#{}) at ({}, {}) is outside buildable area [3..47)",
                spec.name, b.instance_id, b.tile_x, b.tile_y
            ));
            continue;
        }

        for dy in 0..size {
            for dx in 0..size {
                let cx = (b.tile_x + dx) as usize;
                let cy = (b.tile_y + dy) as usize;
                if occ[cy][cx] {
                    errors.push(format!(
                        "{} (#{}) overlaps another structure at ({}, {})",
                        spec.name, b.instance_id, cx, cy
                    ));
                }
                occ[cy][cx] = true;
            }
        }
    }

    for &(wx, wy) in &layout.walls {
        if wx < BUILD_MIN || wy < BUILD_MIN || wx >= BUILD_MAX || wy >= BUILD_MAX {
            errors.push(format!("Wall at ({}, {}) is outside buildable area", wx, wy));
            continue;
        }
        if occ[wy as usize][wx as usize] {
            errors.push(format!("Wall at ({}, {}) overlaps another structure", wx, wy));
        }
        occ[wy as usize][wx as usize] = true;
    }

    if layout.walls.len() > 325 {
        errors.push(format!(
            "Too many walls: {} (max 325 at TH18)",
            layout.walls.len()
        ));
    }

    for spec in BUILDINGS {
        if spec.id == BuildingId::Wall {
            continue;
        }
        let count = *building_counts.get(&spec.id).unwrap_or(&0);
        if count > spec.max_count {
            errors.push(format!(
                "Too many {}: {} placed, max is {}",
                spec.name, count, spec.max_count
            ));
        }
    }

    let mut trap_counts = HashMap::new();
    for t in &layout.traps {
        let spec = get_trap_spec(t.trap_id);
        let size = spec.footprint;
        *trap_counts.entry(t.trap_id).or_insert(0u8) += 1;

        if t.tile_x < BUILD_MIN
            || t.tile_y < BUILD_MIN
            || t.tile_x + size > BUILD_MAX
            || t.tile_y + size > BUILD_MAX
        {
            errors.push(format!(
                "Trap {} (#{}) at ({}, {}) is outside buildable area",
                spec.name, t.instance_id, t.tile_x, t.tile_y
            ));
            continue;
        }
        for dy in 0..size {
            for dx in 0..size {
                let cx = (t.tile_x + dx) as usize;
                let cy = (t.tile_y + dy) as usize;
                if occ[cy][cx] {
                    errors.push(format!(
                        "Trap {} (#{}) overlaps another structure at ({}, {})",
                        spec.name, t.instance_id, cx, cy
                    ));
                }
                occ[cy][cx] = true;
            }
        }
    }

    for spec in TRAPS {
        let count = *trap_counts.get(&spec.id).unwrap_or(&0);
        if count > spec.max_count {
            errors.push(format!(
                "Too many {}: {} placed, max is {}",
                spec.name, count, spec.max_count
            ));
        }
    }

    LayoutValidation {
        is_valid: errors.is_empty(),
        errors,
        total_buildings: layout.buildings.len(),
        total_walls: layout.walls.len(),
        total_traps: layout.traps.len(),
    }
}

/// Computes the 50x50 red-zone No-Deploy Mask.
/// Every placed building and wall projects a 1-tile no-deploy buffer around its footprint.
/// Troops cannot be deployed where `mask[y][x] == true`.
pub fn compute_no_deploy_mask(
    buildings: &[PlacedBuilding],
    walls: &[(u8, u8)],
) -> Vec<Vec<bool>> {
    let mut mask = vec![vec![false; 50]; 50];
    for b in buildings {
        let size = get_building_spec(b.building_id).footprint;
        let x0 = b.tile_x.saturating_sub(1);
        let y0 = b.tile_y.saturating_sub(1);
        let x1 = (b.tile_x + size + 1).min(MAP_SIZE);
        let y1 = (b.tile_y + size + 1).min(MAP_SIZE);
        for y in y0..y1 {
            for x in x0..x1 {
                mask[y as usize][x as usize] = true;
            }
        }
    }
    for &(wx, wy) in walls {
        let x0 = wx.saturating_sub(1);
        let y0 = wy.saturating_sub(1);
        let x1 = (wx + 2).min(MAP_SIZE);
        let y1 = (wy + 2).min(MAP_SIZE);
        for y in y0..y1 {
            for x in x0..x1 {
                mask[y as usize][x as usize] = true;
            }
        }
    }
    mask
}

#[derive(Copy, Clone, PartialEq)]
struct AStarNode {
    x: u8,
    y: u8,
    f_score: f32,
}

impl Eq for AStarNode {}

impl Ord for AStarNode {
    fn cmp(&self, other: &Self) -> Ordering {
        other
            .f_score
            .partial_cmp(&self.f_score)
            .unwrap_or(Ordering::Equal)
    }
}

impl PartialOrd for AStarNode {
    fn partial_cmp(&self, other: &Self) -> Option<Ordering> {
        Some(self.cmp(other))
    }
}

pub struct PathResult {
    pub waypoints: Vec<(f32, f32)>,
    pub total_cost: f32,
    pub blocking_wall_tile: Option<(u8, u8)>,
}

/// Computes an A* path on the 50x50 grid from `(start_x, start_y)` to `(goal_x, goal_y)`.
/// `wall_hp_ratio[y][x]` is `0.0` if no wall or covered by Jump Spell, or `(hp / max_hp)` in `(0.0..=1.0]` if a live wall blocks the tile.
/// Returns the waypoint path, total path cost, and the first blocking wall tile if the path cuts through a wall.
pub fn find_path_astar(
    start_x: f32,
    start_y: f32,
    goal_x: f32,
    goal_y: f32,
    wall_hp_ratio: &[[f32; 50]; 50],
) -> PathResult {
    find_path_astar_blocked(start_x, start_y, goal_x, goal_y, wall_hp_ratio, None)
}

/// A* variant that also treats building footprints as impassable terrain, so
/// ground troops walk *around* buildings instead of through them, exactly as
/// they do in Clash of Clans. Walls remain passable but heavily penalised
/// (they get broken first).
pub fn find_path_astar_blocked(
    start_x: f32,
    start_y: f32,
    goal_x: f32,
    goal_y: f32,
    wall_hp_ratio: &[[f32; 50]; 50],
    blocked: Option<&[[bool; 50]; 50]>,
) -> PathResult {
    let sx = (start_x.floor() as i32).clamp(0, 49) as u8;
    let sy = (start_y.floor() as i32).clamp(0, 49) as u8;
    let gx = (goal_x.floor() as i32).clamp(0, 49) as u8;
    let gy = (goal_y.floor() as i32).clamp(0, 49) as u8;

    if sx == gx && sy == gy {
        return PathResult {
            waypoints: vec![(goal_x, goal_y)],
            total_cost: 0.0,
            blocking_wall_tile: None,
        };
    }

    let mut g_score = [[f32::INFINITY; 50]; 50];
    let mut came_from = [[(255u8, 255u8); 50]; 50];
    let mut closed = [[false; 50]; 50];
    let mut open = BinaryHeap::new();

    g_score[sy as usize][sx as usize] = 0.0;
    let h0 = (((gx as f32 - sx as f32).powi(2) + (gy as f32 - sy as f32).powi(2)).sqrt()) * 1.0;
    open.push(AStarNode {
        x: sx,
        y: sy,
        f_score: h0,
    });

    let dirs: [(i32, i32, f32); 8] = [
        (1, 0, 1.0),
        (-1, 0, 1.0),
        (0, 1, 1.0),
        (0, -1, 1.0),
        (1, 1, 1.4142),
        (1, -1, 1.4142),
        (-1, 1, 1.4142),
        (-1, -1, 1.4142),
    ];

    while let Some(curr) = open.pop() {
        if curr.x == gx && curr.y == gy {
            break;
        }
        if closed[curr.y as usize][curr.x as usize] {
            continue;
        }
        closed[curr.y as usize][curr.x as usize] = true;

        let cur_g = g_score[curr.y as usize][curr.x as usize];

        for &(dx, dy, step_cost) in &dirs {
            let nx = curr.x as i32 + dx;
            let ny = curr.y as i32 + dy;
            if nx < 0 || ny < 0 || nx >= 50 || ny >= 50 {
                continue;
            }
            let nxu = nx as u8;
            let nyu = ny as u8;
            if closed[nyu as usize][nxu as usize] {
                continue;
            }

            // Building footprints are solid: units must walk around them.
            if let Some(b) = blocked {
                if b[nyu as usize][nxu as usize] && !(nxu == gx && nyu == gy) {
                    continue;
                }
            }

            // Prevent free diagonal corner-cutting through a diagonal wall or pinched building corner.
            if dx != 0 && dy != 0 {
                let ox1 = (curr.x as i32 + dx) as usize;
                let oy1 = curr.y as usize;
                let ox2 = curr.x as usize;
                let oy2 = (curr.y as i32 + dy) as usize;
                let side1_blocked =
                    blocked.map_or(false, |b| b[oy1][ox1]) || wall_hp_ratio[oy1][ox1] > 0.0;
                let side2_blocked =
                    blocked.map_or(false, |b| b[oy2][ox2]) || wall_hp_ratio[oy2][ox2] > 0.0;
                if side1_blocked && side2_blocked {
                    continue;
                }
            }

            // Wall traversal penalty: breaking a full-HP wall costs ~16 tiles of detour
            let w_ratio = wall_hp_ratio[nyu as usize][nxu as usize];
            let wall_penalty = if w_ratio > 0.0 {
                4.0 + 12.0 * w_ratio
            } else {
                0.0
            };

            let tentative_g = cur_g + step_cost + wall_penalty;
            if tentative_g < g_score[nyu as usize][nxu as usize] {
                g_score[nyu as usize][nxu as usize] = tentative_g;
                came_from[nyu as usize][nxu as usize] = (curr.x, curr.y);
                let h = ((gx as f32 - nxu as f32).powi(2) + (gy as f32 - nyu as f32).powi(2)).sqrt();
                open.push(AStarNode {
                    x: nxu,
                    y: nyu,
                    f_score: tentative_g + h,
                });
            }
        }
    }

    let total_cost = g_score[gy as usize][gx as usize];
    if !total_cost.is_finite() {
        return PathResult {
            waypoints: vec![(goal_x, goal_y)],
            total_cost: 999.0,
            blocking_wall_tile: None,
        };
    }

    let mut tiles = Vec::new();
    let mut cx = gx;
    let mut cy = gy;
    while !(cx == sx && cy == sy) {
        tiles.push((cx, cy));
        let prev = came_from[cy as usize][cx as usize];
        if prev.0 == 255 {
            break;
        }
        cx = prev.0;
        cy = prev.1;
    }
    tiles.reverse();

    let mut blocking_wall_tile = None;
    let mut waypoints = Vec::with_capacity(tiles.len());
    for &(tx, ty) in &tiles {
        if wall_hp_ratio[ty as usize][tx as usize] > 0.0 {
            blocking_wall_tile = Some((tx, ty));
            waypoints.push((tx as f32 + 0.5, ty as f32 + 0.5));
            break;
        }
        waypoints.push((tx as f32 + 0.5, ty as f32 + 0.5));
    }
    if blocking_wall_tile.is_none() {
        waypoints.push((goal_x, goal_y));
    }

    PathResult {
        waypoints,
        total_cost,
        blocking_wall_tile,
    }
}

/// Computes an A* path on the 50x50 grid from `(start_x, start_y)` to the best
/// valid attack position within `attack_range` of a target building's footprint
/// `[b_tile_x .. b_tile_x + b_footprint] x [b_tile_y .. b_tile_y + b_footprint]`.
///
/// In Clash of Clans:
/// - Ranged ground units (`can_attack_over_walls = true`) shoot over walls
///   (`NoAttackOverWalls = false`), so any walkable tile `(tx, ty)` with a point in
///   `[tx + 0.15, tx + 0.85] x [ty + 0.15, ty + 0.85]` within `(attack_range - 0.05)`
///   of the building's footprint edge is a valid attack position. This reproduces the
///   exact live-game wall-gap rules (e.g. Wizard 3.0t reaches 1-tile gap, Archer 3.5t
///   reaches 2-tile gap, Archer Queen 5.0t reaches 3-tile gap and is blocked by a
///   4-tile gap, Thrower/Super Archer 6.0t reaches 4-tile gap).
/// - Melee ground units (`can_attack_over_walls = false`) must reach a tile within
///   `attack_range.min(0.95)` of the building's footprint so they cannot attack through
///   a 1-tile wall flush against the building without breaking the wall first.
#[allow(clippy::too_many_arguments)]
pub fn find_path_to_building(
    start_x: f32,
    start_y: f32,
    b_tile_x: u8,
    b_tile_y: u8,
    b_footprint: u8,
    attack_range: f32,
    can_attack_over_walls: bool,
    wall_hp_ratio: &[[f32; 50]; 50],
    blocked: Option<&[[bool; 50]; 50]>,
) -> PathResult {
    let bx0 = b_tile_x as f32;
    let by0 = b_tile_y as f32;
    let bx1 = (b_tile_x + b_footprint) as f32;
    let by1 = (b_tile_y + b_footprint) as f32;

    let edge_dist = |px: f32, py: f32| -> f32 {
        let ex = px.clamp(bx0, bx1);
        let ey = py.clamp(by0, by1);
        ((px - ex).powi(2) + (py - ey).powi(2)).sqrt()
    };

    let eff_range = if can_attack_over_walls {
        (attack_range - 0.05).max(0.35)
    } else {
        attack_range.min(0.95).max(0.35)
    };

    let tile_attack_point = |tx: u8, ty: u8| -> (f32, f32) {
        let cx = tx as f32 + 0.5;
        let cy = ty as f32 + 0.5;
        if edge_dist(cx, cy) <= eff_range {
            (cx, cy)
        } else {
            let ex = cx.clamp(bx0, bx1);
            let ey = cy.clamp(by0, by1);
            (
                ex.clamp(tx as f32 + 0.15, tx as f32 + 0.85),
                ey.clamp(ty as f32 + 0.15, ty as f32 + 0.85),
            )
        }
    };

    let is_goal_tile = |tx: u8, ty: u8| -> bool {
        if let Some(b) = blocked {
            if b[ty as usize][tx as usize] {
                return false;
            }
        }
        let (ax, ay) = tile_attack_point(tx, ty);
        edge_dist(ax, ay) <= eff_range
    };

    let sx = (start_x.floor() as i32).clamp(0, 49) as u8;
    let sy = (start_y.floor() as i32).clamp(0, 49) as u8;
    let start_dist = edge_dist(start_x, start_y);

    // Already within attack range at current position: no movement or wall break needed!
    if (can_attack_over_walls && start_dist <= attack_range)
        || (!can_attack_over_walls
            && start_dist <= eff_range
            && wall_hp_ratio[sy as usize][sx as usize] == 0.0)
    {
        return PathResult {
            waypoints: Vec::new(),
            total_cost: 0.0,
            blocking_wall_tile: None,
        };
    }

    // Current tile already contains a wall-free attack position: step to `(ax, ay)` inside `(sx, sy)`.
    if is_goal_tile(sx, sy) && wall_hp_ratio[sy as usize][sx as usize] == 0.0 {
        let (ax, ay) = tile_attack_point(sx, sy);
        let d = ((ax - start_x).powi(2) + (ay - start_y).powi(2)).sqrt();
        return PathResult {
            waypoints: vec![(ax, ay)],
            total_cost: d,
            blocking_wall_tile: None,
        };
    }

    let heuristic = |tx: u8, ty: u8| -> f32 {
        let (ax, ay) = tile_attack_point(tx, ty);
        (edge_dist(ax, ay) - eff_range).max(0.0)
    };

    let mut g_score = [[f32::INFINITY; 50]; 50];
    let mut came_from = [[(255u8, 255u8); 50]; 50];
    let mut closed = [[false; 50]; 50];
    let mut open = BinaryHeap::new();

    g_score[sy as usize][sx as usize] = 0.0;
    open.push(AStarNode {
        x: sx,
        y: sy,
        f_score: heuristic(sx, sy),
    });

    let dirs: [(i32, i32, f32); 8] = [
        (1, 0, 1.0),
        (-1, 0, 1.0),
        (0, 1, 1.0),
        (0, -1, 1.0),
        (1, 1, 1.4142),
        (1, -1, 1.4142),
        (-1, 1, 1.4142),
        (-1, -1, 1.4142),
    ];

    let mut goal_tile: Option<(u8, u8)> = None;

    while let Some(curr) = open.pop() {
        if !(curr.x == sx && curr.y == sy) && is_goal_tile(curr.x, curr.y) {
            goal_tile = Some((curr.x, curr.y));
            break;
        }
        if closed[curr.y as usize][curr.x as usize] {
            continue;
        }
        closed[curr.y as usize][curr.x as usize] = true;

        let cur_g = g_score[curr.y as usize][curr.x as usize];

        for &(dx, dy, step_cost) in &dirs {
            let nx = curr.x as i32 + dx;
            let ny = curr.y as i32 + dy;
            if nx < 0 || ny < 0 || nx >= 50 || ny >= 50 {
                continue;
            }
            let nxu = nx as u8;
            let nyu = ny as u8;
            if closed[nyu as usize][nxu as usize] {
                continue;
            }

            if let Some(b) = blocked {
                if b[nyu as usize][nxu as usize] {
                    continue;
                }
            }

            if dx != 0 && dy != 0 {
                let ox1 = (curr.x as i32 + dx) as usize;
                let oy1 = curr.y as usize;
                let ox2 = curr.x as usize;
                let oy2 = (curr.y as i32 + dy) as usize;
                let side1_blocked =
                    blocked.map_or(false, |b| b[oy1][ox1]) || wall_hp_ratio[oy1][ox1] > 0.0;
                let side2_blocked =
                    blocked.map_or(false, |b| b[oy2][ox2]) || wall_hp_ratio[oy2][ox2] > 0.0;
                if side1_blocked && side2_blocked {
                    continue;
                }
            }

            let w_ratio = wall_hp_ratio[nyu as usize][nxu as usize];
            let wall_penalty = if w_ratio > 0.0 {
                4.0 + 12.0 * w_ratio
            } else {
                0.0
            };

            let tentative_g = cur_g + step_cost + wall_penalty;
            if tentative_g < g_score[nyu as usize][nxu as usize] {
                g_score[nyu as usize][nxu as usize] = tentative_g;
                came_from[nyu as usize][nxu as usize] = (curr.x, curr.y);
                let h = heuristic(nxu, nyu);
                open.push(AStarNode {
                    x: nxu,
                    y: nyu,
                    f_score: tentative_g + h,
                });
            }
        }
    }

    let Some((gx, gy)) = goal_tile else {
        let fallback_x = start_x.clamp(bx0, bx1);
        let fallback_y = start_y.clamp(by0, by1);
        return find_path_astar_blocked(
            start_x,
            start_y,
            fallback_x,
            fallback_y,
            wall_hp_ratio,
            blocked,
        );
    };

    let total_cost = g_score[gy as usize][gx as usize];
    let mut tiles = Vec::new();
    let mut cx = gx;
    let mut cy = gy;
    while !(cx == sx && cy == sy) {
        tiles.push((cx, cy));
        let prev = came_from[cy as usize][cx as usize];
        if prev.0 == 255 {
            break;
        }
        cx = prev.0;
        cy = prev.1;
    }
    tiles.reverse();

    let mut blocking_wall_tile = None;
    let mut waypoints = Vec::with_capacity(tiles.len());
    let last_idx = tiles.len().saturating_sub(1);
    for (idx, &(tx, ty)) in tiles.iter().enumerate() {
        if wall_hp_ratio[ty as usize][tx as usize] > 0.0 {
            blocking_wall_tile = Some((tx, ty));
            waypoints.push((tx as f32 + 0.5, ty as f32 + 0.5));
            break;
        }
        if idx == last_idx {
            waypoints.push(tile_attack_point(tx, ty));
        } else {
            waypoints.push((tx as f32 + 0.5, ty as f32 + 0.5));
        }
    }

    PathResult {
        waypoints,
        total_cost,
        blocking_wall_tile,
    }
}
