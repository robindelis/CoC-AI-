---
title: "Clash of Clans TH18 Tactical Strategy Concepts & Input/Output Representation Design for Model Evolution"
tags:
  - coc-strategy
  - funneling
  - hero-charge
  - warden-walk
  - fireball
  - input-output-design
  - spatial-features
  - action-space
  - agy-research
  - model-evolution
updated: "2026-11-01"
research_agent: "coc-strategy-researcher (agy • gemini-3.8-flash-medium)"
evolver_agent: "opencode-model-evolver (opencode • google-vertex/gemini-4-argon#medium)"
---

# ⚔️ Clash of Clans TH18 Tactical Strategy Concepts & Input/Output Representation Design

Back to [[00_Index_MOC|Vault Index (MOC)]] • Vision Catalog: [[architectures/SOTA_Vision_And_Spatial_RL_Architectures|SOTA Vision & Spatial RL Architectures]] • Evolution Ledger: [[architectures/Model_Architecture_Evolution_Ledger|Model Architecture Evolution Ledger]] • Encodings: [[encodings/Defense_And_Unit_Spatial_Encoding|59-Channel Spatial & 64-D Inventory Spec]]

---

## 1. Executive Summary & Multi-Agent Research Architecture

To build an attacker policy that masters Town Hall 18 rather than merely spamming units along the border, **neural architecture evolution must be co-designed with Clash of Clans domain tactics and input/output representations**:

- **Tactical Research Agent (`agy` • `gemini-3.8-flash-medium` • `.agents/agents/coc-strategy-researcher/agent.md`)**: Synthesizes high-level Clash of Clans strategy concepts from competitive forums, pro attack breakdowns, Supercell `csv_logic` tables, and `docs/behavior_specs/` video analyses into this document.
- **Architecture Evolver Agent (`opencode` • `google-vertex/gemini-4-argon#medium` • `.agents/agents/opencode-model-evolver/agent.md`)**: Reads this tactical & input/output specification alongside [[architectures/SOTA_Vision_And_Spatial_RL_Architectures|SOTA Vision Architectures]] and live 5,000-episode telemetry when morphing `python/coc_rl/networks.py`.

---

## 2. Classical & Pro TH18 Clash of Clans Strategy Concepts

Competitive Town Hall 18 attacks are structured as **four synchronized tactical phases**. When an RL agent plateaus at 1-star (`50–69%`) or 2-star (`70–95%`), it is almost always failing one of these four classical principles:

### 2.1 Funneling & Pathfinding Manipulation (Anti-"Donut" Ring Control)
- **Game Mechanics**: Non-defense-targeting troops (`Thrower`, `Super Yeti`, `Super Valkyrie`, `Barbarian King`, `Archer Queen`, `P.E.K.K.A`) select their next target using Supercell's **Rule-of-3 Closest Buildings** weighted by Euclidean distance and A* wall pathing penalty (`crates/coc-engine/src/grid.rs`).
- **The Failure Mode ("Troop Walk / Donut Ring")**: If exterior collector and utility buildings (`Ch 57`, `Ch 58`) are left standing on the flanks of the deployment point, the main army's nearest next target after clearing the first building is *sideways along the perimeter* rather than *inward through the wall layer* (`Ch 3`). The entire army walks around the outside of the village while core defenses (`Monolith Ch 50`, `Hot Candle Ch 54`, `Multi-Archer Ch 35`, `Ricochet Cannon Ch 36`) annihilate them from behind walls.
- **Classical Pro Solution**:
  1. **Cut Two Corner Trenches First**: Drop flankers (e.g., `Barbarian King` with `Spiky Ball` on one corner, `Archer Queen` or `Furnace` / `Baby Dragon` / `Sneaky Goblin` on the adjacent corner) $8\text{–}14$ tiles apart to sever the exterior building ring.
  2. **Create a Dead-Zone Funnel**: Once the two flank corners are cleared, the *only* remaining buildings within the Rule-of-3 search radius lie straight ahead inside the first wall compartment.
  3. **Core Entry**: Deploy the main smash (`Thrower`, `Healer`, `Ice Golem`, `Druid`, `Grand Warden`, `Log Launcher`) strictly between the two cut corners.

### 2.2 Hero Charges, Warden Walks & Equipment Synergies
At TH18, Heroes (`Ch 17..20`) and their active/passive Equipment (`docs/behavior_specs/07_hero_equipment.md`) account for **40–55% of total offensive value**:
- **Grand Warden Walk + Eternal Tome / Rage Gem / Fireball**:
  - *Aura Mechanics*: Grand Warden (`Ch 19`) follows the highest-housing-space allied troop cluster (`FightWithGroups`) and projects a $7.0\text{-tile}$ aura.
  - *Eternal Tome Timing*: Must be triggered (`slot_type=3, slot_idx=2`) *not* on deployment at the border, but when the main pack enters peak core DPS (`Ch 1 > 0.5`) or right as the Town Hall 18 (`Ch 2`) / Giga Bomb / Monolith (`Ch 50`) engages the pack.
  - *Fireball + Earthquake Combo*: When equipped, targets the densest $3.5\text{–}4.5\text{t}$ cluster of high-value defenses (excluding Storages and Town Hall which are immune to Earthquake).
- **Archer Queen Charge / Magic Mirror & Action Figure**:
  - *Mechanics*: High-DPS ranged carry (`Ch 18`, $5.0\text{t}$ range). Activating ability (`slot_type=3, slot_idx=1`) spawns cloned Queens (`Magic Mirror` brief invulnerability + burst DPS) and the `GiantGiant` tank (`ActionFigure`).
  - *Tactical Requirement*: Must be triggered when Queen takes focus fire or engages high-HP core targets (`Defending Heroes Ch 26..31`, `Clan Castle Ch 25`, `Town Hall Ch 2`), never wasted at 100% HP on outer trash.
- **Barbarian King Flank & Breach (`Spiky Ball` + `Snake Bracelet`)**:
  - *Mechanics*: High-HP melee tank (`Ch 17`). `Spiky Ball` bounces across up to 8 structures/walls, instantly cracking compartments or clearing a funnel corner.
- **Royal Champion Back-End Assassin (`Electro Boots` + `Rocket Spear`)**:
  - *Mechanics*: Jumps walls and targets `Defenses` (`Ch 34..54`). `Electro Boots` emit a continuous $2.5\text{-tile}$ passive chain-lightning aura that melts skeleton traps (`Ch 32..33`) and adjacent buildings; `Rocket Spear` grants long-range ($10\text{t}$) high-damage spear throws on ability activation.
  - *Classical Pro Timing*: **Never dump the Royal Champion at $t=0$ into the main meatgrinder**. Pro players hold the Royal Champion until the main smash has engaged the core (`tick >= 200..450` or `destruction >= 40%`), then deploy her on an **orthogonal or back-end flank** to snipe surviving point defenses (`X-Bow`, `Inferno`, `Multi-Gear`, `Scattershot`) while core defenses are distracted by the main pack and `Totem` spells.

### 2.3 Siege Machine Line-of-Sight & Compartment Breaching
- **Log Launcher (`Ch 14`)**:
  - Rolls straight from its deployment tile $(x_{\text{deploy}}, y_{\text{deploy}})$ toward the center of the **Town Hall 18 (`Ch 2`)**, firing logs every $3.0\text{s}$ that travel $10\text{ tiles}$ and deal $4\times$ damage to walls (`Ch 3`).
  - **Line-of-Sight Invariant**: The value of a `Log Launcher` deployment tile is a direct function of the **ray connecting $(x_{\text{deploy}}, y_{\text{deploy}}) \to (x_{\text{TH}}, y_{\text{TH}})$**. An optimal deployment tile aligns this ray so the logs pierce 2–3 wall layers and hit key defenses (`Inferno`, `Eagle/Revenge Tower`, `Monolith`, `Clan Castle`) along the path to TH18.
  - **PopSiege (`slot_type=5`)**: Should only be triggered if the Siege Machine is about to die outside the core or has already reached the target core compartment to release `CC Super Yeti` (`Ch 15`) and `CC Super Valkyrie` (`Ch 16`).
- **Super Wall Breaker (`Ch 10`)**:
  - Targets nearest closed wall compartment shielding buildings (`Speed=28`, instant detonation on contact). Must be dropped in single/small batches (`deploy_fraction = 0.0` or `0.25` $\to 1$ unit) right behind an `Ice Golem` or `Barbarian King` tank.

### 2.4 Spell Geometry, Stacking & Phase Mitigation
- **Rage Spell (`Ch 22`)**: $5.0\text{t}$ radius. Must be placed slightly *ahead* of the advancing `Thrower + Healer` pack so both the `Throwers` (`Ch 5`) and `Healers` (`Ch 6`) sit inside the ring while engaging core defenses.
- **Totem Spell (`Ch 21`)**: Summons a high-HP 1×1 lightning totem directly on the target tile. Unlike troops, **Totem Spell ignores the No-Deploy Red Zone (`Ch 4`)** and can be dropped *directly adjacent to `Monolith`, `Hot Candle`, `Ricochet Cannon`, or `Town Hall 18`* to tank lethal shots right before the main army steps into range.
- **Poison Spell (`Ch 23`)**: Must be reserved for **Enemy Defending CC & Guardian (`Ch 25`)** or **Defending Heroes (`Ch 26..31`)** once they aggro allied troops.
- **Skeleton Spell (`Ch 24`)**: Dropped directly on single-target high-DPS defenses (`Monolith Ch 50`, `Single Inferno Ch 46`, `Ricochet Cannon Ch 36`, `Defending Archer Queen Ch 27`) to waste their high-damage shots.

---

## 3. Input & Output Space Decisions for Evolutionary Morphing

Based on the tactical mechanics above, we establish the **canonical Input/Output contract** and the **In-Network Tactical Feature Engineering** that the model (and the OpenCode Argon 4 evolver) uses across generations:

### 3.1 Input Space Contract & On-the-Fly Tactical Spatial Feature Maps
The Rust simulation engine (`crates/coc-engine/src/sim.rs`) provides the fast, zero-copy raw state:
1. **`obs` `(B, 59, 50, 50)`**: 59 dedicated channels (Base/Env `0..4`, Friendly Troops/Siege/CC `5..16`, Friendly Heroes `17..20`, Friendly Spells `21..24`, Enemy CC/Heroes/Skeletons `25..33`, 22 Defenses & CC `34..55`, Storages/Collectors/Utility `56..58`).
2. **`army_context` `(B, 64)`**: Live battle progress (`0..4`), 10 Troop Slots (`4..24`), 10 Spell Slots (`24..44`), 4 Hero Slots with HP & Ability Readiness (`44..56`), and Siege/CC state (`56..64`).

> [!IMPORTANT]
> **In-Network Tactical Feature Synthesis (Zero Engine Overhead)**
> While keeping the C++/Rust PyO3 interface fixed at `(B, 59, 50, 50)` + `(B, 64)`, `CoCSpatialEncoder` / `CoCActorCritic` in `python/coc_rl/networks.py` can synthesize **explicit tactical geometry maps on the GPU** inside `forward()` as the model evolves:

| Tactical Feature Map / Signal | Formula from `obs (59, 50, 50)` & `army_context (64)` | Clash of Clans Concept Encoded | Target Generation |
| :--- | :--- | :--- | :---: |
| **1. Normalized Board Coordinates $(X, Y)$ & Border Ring** | $X, Y \in [-1, 1]^{50\times 50}$, $D_{\text{border}} = \min(x, 49-x, y, 49-y)/25$ | Distinguishes outer deployment perimeter from deep interior compartments. | **Gen 1+** |
| **2. Town Hall 18 Radial Distance & Line-of-Sight Vector** | $(x_{\text{TH}}, y_{\text{TH}}) = \text{centroid}(\text{Ch } 2)$; $R_{\text{TH}} = \|p - p_{\text{TH}}\|_2 / 50$ | Direct breach vector for **Log Launcher**, **Super Wall Breaker**, and **Main Smash Entry**. | **Gen 1+** |
| **3. Exterior Trash vs. Core Funnel Density** | $\text{AvgPool}_{7\times 7}(\text{Ch } 57 + \text{Ch } 58) \cdot (1 - \text{AvgPool}_{15\times 15}(\text{Ch } 2))$ | Identifies uncut exterior trash buildings that cause **Donut Ring troop walks**. | **Gen 2+** |
| **4. Lethal Core Killzone & Spell Value Field** | $\text{AvgPool}_{9\times 9}(\text{Ch } 1 + 2\cdot\text{Ch } 50_{\text{Mono}} + 2\cdot\text{Ch } 54_{\text{Candle}} + 2\cdot\text{Ch } 2_{\text{TH}})$ | Highlights peak DPS overlap zones for **Grand Warden Eternal Tome**, **Rage**, and **Totem** drops. | **Gen 2+** |
| **5. Allied Push Centroid & Frontline Engagement Zone** | $\text{MaxPool}_{7\times 7}(\sum_{c=5}^{20} \text{Ch } c) \odot \text{MaxPool}_{7\times 7}(\text{Ch } 0 + \text{Ch } 1)$ | Exact active combat frontline where **Rage**, **Heal**, **Poison**, and **Hero Abilities** have maximum impact. | **Gen 0–5** |
| **6. Attack Phase & Pacing Vector (from `army_context`)** | Derived from `time_left = ctx[0]`, `destr = ctx[1]`, `stars = ctx[2]`, `alive_units = ctx[3]` | Controls **Multi-Phase Sequencing**: Phase 1 Funnel (`destr < 15%`) $\to$ Phase 2 Core Push $\to$ Phase 3 RC Back-End Sweep (`destr > 45%`). | **Gen 2+** |

---

### 3.2 Output Space Contract & Tactical Head Conditioning
The output space is factorized into **4 autoregressively conditioned discrete actor heads + 1 scalar critic head** producing `[slot_type, slot_idx, tile_x, tile_y, deploy_fraction]`:

1. **Head 1 — `slot_type` (`7` logits: `0=NoOp, 1=Troop, 2=Hero, 3=HeroAbility, 4=Siege, 5=PopSiege, 6=Spell`)**:
   - *Tactical Role*: Controls **attack pacing and phase transitions**.
   - *Evolution Guidance*: If `NoOp` is too low early, the agent dumps its entire army in 3 seconds (preventing funneling and wasting spells before troops reach the core). If `HeroAbility` (`3`) triggers immediately after `Hero` (`2`), abilities are wasted on the border. The Argon 4 evolver can condition `slot_type_head` on explicit battle phase features (`ctx[0..4]` + frontline combat intensity).
2. **Head 2 — `slot_idx` (`10` logits, conditioned on `global_emb + one_hot(slot_type)`)**:
   - *Tactical Role*: Selects *which* troop (`0..9`), spell (`0..9`), or hero (`0..3`) to use.
   - *Evolution Guidance*: Can be upgraded from a simple MLP (`Gen 0`) to a **Slot-Entity Attention / Bilinear Pointer** that directly scores each slot's 2-float/3-float descriptor in `army_context` against the current battlefield state (e.g., picking `Poison` when `Ch 25..31` enemy CC/heroes are active, or `Headhunter` when defending heroes are near the frontline).
3. **Head 3 — `deploy_fraction` (`5` logits: `0.0 -> 1 unit`, `0.25 -> 25%`, `0.50 -> 50%`, `0.75 -> 75%`, `1.00 -> 100%`, conditioned on `type + idx`)**:
   - *Tactical Role*: Distinguishes **surgical funnel/breaker drops** (`bin 0` = 1 unit for `Super Wall Breaker`, `Balloon` trap tester, `Archer` corner snipe, `Ice Golem` lead tank) from **main smash waves** (`bin 3/4` = 75–100% batch for `Throwers` and `Healers`).
4. **Head 4 — `tile_xy` (`2500` spatial logits on the $50\times 50$ grid, conditioned on `type + idx + frac`)**:
   - *Tactical Role*: Selects the exact deployment coordinate $(x, y) \in \{0..49\}^2$.
   - *Evolution Guidance*:
     - **Gen 0 (`TinyCNN`)**: Uses a single $1\times 1$ convolution over FiLM-modulated `spatial_features` + spatial breach prior.
     - **Gen 2+ (`Dual-Mode / Key-Query Spatial Pointer`)**: Splits or modulates spatial scoring by tactical role:
       - *Perimeter Troop/Hero/Siege Mode (`slot_type in {1, 2, 4}`)*: Scores valid green tiles (`Ch 4 == 0`) along the TH18 breach vector and funnel flanks.
       - *Interior Spell Mode (`slot_type == 6`)*: Scores interior combat tiles where allied units (`Ch 5..20`) intersect enemy defenses (`Ch 1, 34..55`) or where `Totem` (`idx=0`) can tank core defenses (`Monolith`, `TH18`, `Hot Candle`).
5. **Head 5 — `value` (`1` scalar state-value estimate $V(s)$)**:
   - *Tactical Role*: Predicts expected discounted return for GAE advantage calculation.
   - *Evolution Guidance*: When `explained_variance < 0.45` or `calibration_gap > 5.0`, upgrade `critic_head` with LayerNorm residual blocks and direct skip-concatenation of `army_context[0..4]` (time remaining, current destruction %, current stars, alive attackers) so the critic immediately anchors on exact battle progress.

---

## 4. How `agy` (`gemini-3.8-flash-medium`) & `opencode` (`gemini-4-argon#medium`) Collaborate

```text
┌───────────────────────────────────────────────────────────────────────────────────┐
│  STEP 1: 5,000-Episode Training Run Completes (or Plateau Detected)               │
│  • Telemetry collected: 300-ep Mean Destr %, 1★ -> 2★ TH18 -> 3★ Funnel,          │
│    Per-Village Spread, Head Entropies, Rollout Timing (Troop/Spell/Ability Ticks) │
└─────────────────────────────────────────┬─────────────────────────────────────────┘
                                          ▼
┌───────────────────────────────────────────────────────────────────────────────────┐
│  STEP 2: AGY Strategy Researcher (`agy --agent coc-strategy-researcher`)          │
│  • Model: `gemini-3.8-flash-medium`                                               │
│  • Analyzes telemetry failure mode through the lens of CoC pro tactics            │
│    (e.g., Donut Funneling failure, premature Eternal Tome, late RC cleanup stall) │
│  • Searches CoC strategy guides / behavior specs and appends targeted tactical    │
│    & input/output recommendations to this Obsidian Vault note                     │
└─────────────────────────────────────────┬─────────────────────────────────────────┘
                                          ▼
┌───────────────────────────────────────────────────────────────────────────────────┐
│  STEP 3: OpenCode Argon 4 Model Evolver (`opencode-model-evolver`)                │
│  • Model: `google-vertex/gemini-4-argon#medium`                                   │
│  • Reads:                                                                         │
│    1. `SOTA_Vision_And_Spatial_RL_Architectures.md`                               │
│    2. `CoC_Strategy_Concepts_And_Input_Output_Design.md` (updated by AGY)         │
│    3. `Model_Architecture_Evolution_Ledger.md`                                    │
│    4. Live 5,000-episode telemetry                                                │
│  • Morphs `python/coc_rl/networks.py` to the next generation, selects             │
│    `warm_start` or `scratch_restart`, verifies smoke test, and logs to Obsidian   │
└───────────────────────────────────────────────────────────────────────────────────┘
```

---

## 5. Tactical Research Findings & I/O Recommendations Ledger

### 5.1 Cycle #1 Audit: Gen 1 (`v4.1-Gen1-CoordSE-ResCNN`) → Gen 2 Evolution
- **Evaluation Date**: 2026-11-02
- **Telemetry Analyzed**:
  - Model: `v4.1-Gen1-CoordSE-ResCNN` (Gen 1)
  - Mean Destruction: `84.6%` | 2-Star TH18: `96.7%` | 3-Star Triple: `33.7%`
  - Spatial Deploy Spread: `3.98t std` (tight, focused entry vector)
  - Worst Village: `TH18 Offset Diamond (Hot Candle + Longshot)` at `77.0%`
- **Classical CoC Strategy Diagnosis (Orthogonal Wall Compartment Corridors & Asymmetric Ring/Diamond Breaching)**:
  1. **Asymmetric Diamond Splitting & Donut Flank Siphon**: In offset diamond layouts, the main entry breaches the Town Hall compartment with high fidelity (`P(2★) = 96.7%`), but the diagonal compartment boundaries channel surviving troops into split perimeter paths. Without an active orthogonal flank funnel, troops bypass the isolated back-end compartment housing the `Hot Candle` (`Ch 54`, 10.5t melting beam) and get picked off through unbroken wall layers (`Ch 3`).
  2. **Monolithic LoS Ray Limitation**: The Log Launcher (`Ch 14`) punches a single linear breach along $(x_{\text{deploy}}, y_{\text{deploy}}) \to (x_{\text{TH}}, y_{\text{TH}})$, opening the central corridor but leaving the orthogonal diamond quadrants sealed behind intact high-HP walls, trapping the primary smash while back-end defenses focus-fire them down.
  3. **Royal Champion Premature Commitment**: Deploying the Royal Champion (`Ch 20`) along the primary breach axis exposes her to the same core crossfire; classical pro meta demands holding her until `destr >= 45%` and deploying her on an **orthogonal tangent angle (85°–95° off primary vector)** to clear the back-end diamond corridor alongside delayed Totem tanking (`Ch 21`).
- **Tactical I/O Recommendations for OpenCode Argon 4 Evolver (`Gen 2: v4.2-ConvNeXtV2-GRN`)**:
  1. **In-Network Spatial Synthesis**: Synthesize an **Orthogonal Compartment Corridor & Diamond Ray Map** ($\vec{v}_{\text{ortho}} \perp \vec{v}_{\text{TH}}$, masking intact wall segments `Ch 3` outside the main breach cone) and a **Back-End Threat Density Map** ($\text{Ch } 54_{\text{HotCandle}} + \text{Ch } 50_{\text{Mono}} + \text{Ch } 35..36$), providing the spatial backbone with explicit geometric awareness of isolated side pockets.
  2. **Autoregressive Dual Spatial Head & Phase-Conditioned Pointer**: Decouple the deployment head into a **Perimeter Unit Branch** and an **Interior Spell/Totem Branch** (`use_dual_spatial_head=True`), while conditioning late hero deployment (`slot_idx=3` Royal Champion when `army_context[1] >= 0.45`) on orthogonal flank coordinates to sweep the remaining diamond defenses.


