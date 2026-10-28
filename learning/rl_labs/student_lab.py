#!/usr/bin/env python3
"""
===============================================================================
CLASH OF CLANS TH18 — HANDS-ON PYTORCH DEEP RL WORKBOOK (`student_lab.py`)
===============================================================================

Welcome to your hands-on PyTorch Deep Reinforcement Learning build lab!
This script connects directly to the Rust `coc_py` simulation engine and your
NVIDIA RTX 4060 Laptop GPU (CUDA) to train a neural commander capable of
attacking a max-level Town Hall 18 village.

HOW THIS WORKBOOK IS STRUCTURED:
  - LAB 1: Spatial CNN Backbone (`CoCSpatialEncoder`)
           Map the `(B, 8, 50, 50)` battlefield grid into both a `(B, 64, 50, 50)`
           full-resolution spatial feature map and a `(B, 256)` global tactical vector.
  - LAB 2: Factorized Actor-Critic & Invalid-Action Masking (`CoCActorCritic`)
           Predict `slot_type` (0..6), `slot_idx` (0..9), and a `50x50` deployment
           heatmap while masking out illegal red-zone tiles and depleted slots with `-1e8`.
  - LAB 3: Reward Shaping & Generalized Advantage Estimation (`compute_custom_reward`, `compute_gae`)
           Design the dense reward function and compute GAE(gamma, lambda) advantages.
  - LAB 4: Clipped PPO Update Loop (`ppo_update_step`)
           Implement the surrogate policy ratio, clipping, value loss, entropy bonus,
           gradient norm clipping, and optimizer step on the GPU.

HOW TO VERIFY & TRAIN:
  1. Run `.venv/bin/python python/verify_labs.py` to test each of your 4 labs
     for tensor shapes, action-masking correctness, GAE math, and GPU gradient flow.
  2. Run `.venv/bin/python python/labs/student_lab.py` or
     `.venv/bin/python python/train_ai.py --train-ppo --episodes 20` directly
     to execute a live GPU training session from your terminal!
===============================================================================
"""

from typing import Any, Dict, Optional, Tuple

import torch
import torch.nn as nn
import torch.nn.functional as F
from torch.distributions import Categorical

# Constant used to mask illegal action logits before softmax / Categorical
NEG_INF = -1e8


# =============================================================================
# LAB 1: SPATIAL PERCEPTION BACKBONE (`CoCSpatialEncoder`)
# =============================================================================
# Input Tensor `obs` has shape `(B, 8, 50, 50)` where:
#   - Ch 0: Live Building HP normalized (0..1)
#   - Ch 1: Defense DPS Threat normalized (0..1)
#   - Ch 2: Town Hall 18 binary mask (0 or 1)
#   - Ch 3: Live Wall HP normalized (0..1)
#   - Ch 4: No-Deploy Red Zone mask (1 = red zone, 0 = valid green tile)
#   - Ch 5: Attacking Ground unit HP density
#   - Ch 6: Attacking Air unit HP density
#   - Ch 7: Active Spell zone indicator
#
# WHY TWO OUTPUTS? (ARCHITECTURAL JUSTIFICATION):
#   - Choosing *what* to deploy (`slot_type`, `slot_idx`) and estimating state
#     value `V(s)` require a global view of the whole village -> `global_embedding: (B, 256)`
#   - Choosing *where* to click (`tile_x, tile_y` in 50x50) requires preserving
#     exact 50x50 tile alignment -> `spatial_features: (B, 64, 50, 50)`
#
# STEP-BY-STEP JUSTIFICATIONS:
#   - Step 1.1 (`self.spatial_stem` with `kernel_size=3, padding=1` and `GroupNorm`):
#     * Why `padding=1`? A 3x3 convolution without padding shrinks 50x50 -> 48x48.
#       Adding a 1-tile zero border (`padding=1`) keeps the output at exact 50x50
#       so feature cell `(y, x)` stays 1-to-1 aligned with village tile `(y, x)`.
#     * Why `GroupNorm` instead of `BatchNorm2d`? In Reinforcement Learning, data
#       distributions shift constantly as the policy evolves, which corrupts
#       BatchNorm's running mean/variance. `GroupNorm` normalizes per sample across
#       channel groups, making it completely immune to non-stationary RL batches.
#     * Why `bias=False` before `GroupNorm`? `GroupNorm` already subtracts the mean
#       and applies its own learnable shift parameter, so a conv bias would be
#       mathematically redundant (cancelled out immediately).
#   - Step 1.2 (`self.context_res` with `dilation=2, padding=2` + Residual Skip):
#     * Why `dilation=2, padding=2`? Standard 3x3 filters only see immediate 1-tile
#       neighbors. Spacing the 3x3 filter taps 2 tiles apart (`dilation=2`) expands
#       the receptive field to 5x5 (seeing across TH18 wall compartments and defense
#       rings) with zero extra parameters, while `padding=2` keeps the 50x50 size!
#     * Why the residual skip `F.silu(h + self.context_res(h))`? Adding the input `h`
#       directly to the block output creates an unimpeded gradient highway during
#       `.backward()` and preserves fine 1-tile coordinates alongside wider context.
#   - Step 1.3 (`self.global_tower` with `stride=2` Convs + `AdaptiveAvgPool2d((4, 4))`):
#     * Why `stride=2` convolutions instead of MaxPool? Strided convolutions learn
#       how to downsample (`50x50 -> 25x25 -> 13x13`) without throwing away spatial
#       coverage.
#     * Why `AdaptiveAvgPool2d((4, 4))`? Compresses the `13x13` grid into a coarse
#       `4x4` quadrant summary (`128 * 4 * 4 = 2048` features) before projecting to
#       the 256-D global tactical vector with `LayerNorm` for stable Actor/Critic inputs.
# =============================================================================
class CoCSpatialEncoder(nn.Module):
    def __init__(self, in_channels: int = 8, spatial_dim: int = 64, embed_dim: int = 256):
        super().__init__()
        self.spatial_dim = spatial_dim
        self.embed_dim = embed_dim

        # --- STEP 1.1: Full-Resolution Spatial Stem (keeps 50x50 via padding=1) ---
        # Tip: GroupNorm + SiLU works great in RL where batch statistics shift over time.
        self.spatial_stem = nn.Sequential(
            nn.Conv2d(in_channels, 32, kernel_size=3, padding=1, bias=False),
            nn.GroupNorm(4, 32),
            nn.SiLU(),
            nn.Conv2d(32, spatial_dim, kernel_size=3, padding=1, bias=False),
            nn.GroupNorm(8, spatial_dim),
            nn.SiLU(),
        )

        # --- STEP 1.2: Dilated Residual Block (sees across TH18 wall compartments) ---
        # With kernel_size=3 and dilation=2, padding=2 keeps the 50x50 size exact!
        self.context_res = nn.Sequential(
            nn.Conv2d(spatial_dim, spatial_dim, kernel_size=3, padding=2, dilation=2, bias=False),
            nn.GroupNorm(8, spatial_dim),
            nn.SiLU(),
            nn.Conv2d(spatial_dim, spatial_dim, kernel_size=3, padding=1, bias=False),
            nn.GroupNorm(8, spatial_dim),
        )

        # --- STEP 1.3: Global Downsampling Tower `(B, 64, 50, 50) -> (B, 256)` ---
        self.global_tower = nn.Sequential(
            nn.Conv2d(spatial_dim, 96, kernel_size=3, stride=2, padding=1),   # 50x50 -> 25x25
            nn.SiLU(),
            nn.Conv2d(96, 128, kernel_size=3, stride=2, padding=1),           # 25x25 -> 13x13
            nn.SiLU(),
            nn.AdaptiveAvgPool2d((4, 4)),                                     # 13x13 -> 4x4
            nn.Flatten(),                                                     # -> 128 * 16 = 2048
            nn.Linear(128 * 4 * 4, embed_dim),
            nn.LayerNorm(embed_dim),
            nn.SiLU(),
        )

    def forward(self, obs: torch.Tensor) -> Tuple[torch.Tensor, torch.Tensor]:
        """
        Contract:
            obs: (B, 8, 50, 50) float32
        Returns:
            spatial_features: (B, 64, 50, 50) float32
            global_embedding: (B, 256) float32
        """
        # >>> YOUR LAB 1 FORWARD PASS <<<
        # 1. Extract local 50x50 features via spatial_stem
        h = self.spatial_stem(obs)
        # 2. Add dilated compartment context via residual skip connection
        spatial_features = F.silu(h + self.context_res(h))
        # 3. Compress 50x50 map into a 256-D village-wide tactical embedding
        global_embedding = self.global_tower(spatial_features)
        return spatial_features, global_embedding


# =============================================================================
# LAB 2: FACTORIZED ACTOR-CRITIC & INVALID-ACTION MASKING (`CoCActorCritic`)
# =============================================================================
# WHY FACTORIZED + MASKED? (ARCHITECTURAL & MATHEMATICAL JUSTIFICATION):
#   A flat action space of 7 * 10 * 50 * 50 = 175,000 discrete outputs would
#   require a massive 44.8M-parameter Linear layer, ignore 2D spatial neighborhood
#   structure, and waste exploration on the 80%+ of actions that are illegal at
#   any tick (e.g., deploying a ground troop inside the village red zone, or
#   selecting a spell slot with 0 spells remaining).
#
#   Instead, we factorize the joint policy auto-regressively by the chain rule of
#   probability:
#     P(type, idx, tile | s) = P(type | s) * P(idx | s, type) * P(tile | s, type)
#   Taking logarithms turns that product into a sum of log-probabilities:
#     log P(action | s) = log P(type | s) + uses_idx * log P(idx | s, type)
#                                         + uses_tile * log P(tile | s, type)
#
# STEP-BY-STEP JUSTIFICATIONS:
#   - Step 2.1 (`slot_type` Head & Masking):
#     Predicts which of the 7 action categories to take (0=NoOp, 1=Troop, 2=Hero,
#     3=HeroAbility, 4=Siege, 5=PopSiege, 6=Spell). We force `type_mask[:, 0] = True`
#     because waiting (`NoOp`) is always legal, preventing an all-False mask NaN.
#     Setting illegal logits to `NEG_INF = -1e8` makes `exp(-1e8) == 0.0` inside
#     Softmax so depleted categories have strictly 0% probability.
#   - Step 2.2 (Auto-Regressive Conditioning & `slot_idx` Head):
#     Why concatenate `one_hot(chosen_type)` to `global_emb` before `slot_idx_head`?
#     Because slot index 0 means "Barbarian/Root Rider" when `chosen_type == Troop(1)`,
#     "Barbarian King" when `chosen_type == Hero(2)`, and "Rage Spell" when
#     `chosen_type == Spell(6)`! Conditioning on `chosen_type` lets the network
#     know *which* bar of 10 slots it is indexing into, and we slice the matching
#     row `masks["slot_idx"][batch_indices, chosen_type]` to mask empty slots.
#   - Step 2.3 (Spatial 50x50 Tile Pointer & Conditional Red-Zone Masking):
#     Why broadcast-add `self.tile_cond_proj(cond_emb)` into `spatial_feat`?
#     A troop wants a perimeter green tile near weak defenses, whereas a Rage/Freeze
#     spell wants a high-DPS core tile *inside* the village! Conditioning the 50x50
#     feature map on `chosen_type` shifts the heatmap between perimeter deployment
#     and core spell targeting.
#     Then, `needs_green = (chosen_type == 1) | (chosen_type == 2) | (chosen_type == 4)`
#     applies the Red-Zone mask ONLY to Troops, Heroes, and Sieges, leaving all
#     2,500 tiles legal when casting a Spell (`chosen_type == 6`).
#   - Step 2.4 (`uses_idx` and `uses_tile` Masks in Joint `log_prob` & `entropy`):
#     Why multiply `idx_dist.log_prob` by `uses_idx` and `tile_dist.log_prob` by
#     `uses_tile`? When `chosen_type == NoOp(0)`, neither `slot_idx` nor `tile_xy`
#     has any effect on the game! If we included dummy tile log-probs on `NoOp`
#     ticks, random tile samples during waiting ticks would inject pure noise into
#     the policy gradient. Zeroing them out when unused keeps credit assignment clean.
# =============================================================================
class CoCActorCritic(nn.Module):
    def __init__(self, in_channels: int = 8):
        super().__init__()
        self.encoder = CoCSpatialEncoder(in_channels=in_channels, spatial_dim=64, embed_dim=256)

        # Actor Head 1: Action Category (`slot_type` in 0..6)
        self.slot_type_head = nn.Linear(256, 7)

        # Actor Head 2: Loadout Slot Index (`slot_idx` in 0..9, conditioned on global_emb + one_hot(slot_type))
        self.slot_idx_head = nn.Sequential(
            nn.Linear(256 + 7, 128),
            nn.SiLU(),
            nn.Linear(128, 10),
        )

        # Actor Head 3: Spatial Tile Pointer (`50x50 = 2500` logits)
        self.tile_cond_proj = nn.Linear(256 + 7, 64)
        self.tile_conv_head = nn.Sequential(
            nn.Conv2d(64, 32, kernel_size=3, padding=1),
            nn.SiLU(),
            nn.Conv2d(32, 1, kernel_size=1),
        )

        # Critic Head: State Value V(s) scalar
        self.critic_head = nn.Sequential(
            nn.Linear(256, 128),
            nn.SiLU(),
            nn.Linear(128, 1),
        )

    def get_action_and_value(
        self,
        obs: torch.Tensor,
        masks: Optional[Dict[str, torch.Tensor]] = None,
        action: Optional[torch.Tensor] = None,
        deterministic: bool = False,
    ) -> Tuple[torch.Tensor, torch.Tensor, torch.Tensor, torch.Tensor, Dict[str, torch.Tensor]]:
        B = obs.shape[0]
        device = obs.device
        spatial_feat, global_emb = self.encoder(obs)

        # --- STEP 2.1: Slot Type Logits & Masking ---
        type_logits = self.slot_type_head(global_emb)  # (B, 7)
        if masks is not None and "slot_type" in masks:
            type_mask = masks["slot_type"].to(device=device, dtype=torch.bool).clone()
            type_mask[:, 0] = True  # NoOp (0) is always legal
            type_logits = type_logits.masked_fill(~type_mask, NEG_INF)

        type_dist = Categorical(logits=type_logits)
        if action is None:
            chosen_type = type_logits.argmax(dim=-1) if deterministic else type_dist.sample()
        else:
            chosen_type = action[:, 0].long()

        # Condition downstream heads on which `slot_type` was chosen
        type_onehot = F.one_hot(chosen_type.clamp(0, 6), num_classes=7).float()
        cond_emb = torch.cat([global_emb, type_onehot], dim=-1)  # (B, 263)

        # --- STEP 2.2: Slot Index Logits & Masking ---
        idx_logits = self.slot_idx_head(cond_emb)  # (B, 10)
        if masks is not None and "slot_idx" in masks:
            batch_indices = torch.arange(B, device=device)
            idx_mask = masks["slot_idx"].to(device=device, dtype=torch.bool)[
                batch_indices, chosen_type.clamp(0, 6)
            ]
            # Fallback to index 0 if a row has no True entries
            all_false = ~idx_mask.any(dim=-1, keepdim=True)
            fallback_zero = F.one_hot(torch.zeros(B, dtype=torch.long, device=device), 10).bool()
            idx_mask = idx_mask | (all_false & fallback_zero)
            idx_logits = idx_logits.masked_fill(~idx_mask, NEG_INF)

        idx_dist = Categorical(logits=idx_logits)
        if action is None:
            chosen_idx = idx_logits.argmax(dim=-1) if deterministic else idx_dist.sample()
        else:
            chosen_idx = action[:, 1].long()

        # --- STEP 2.3: Spatial 50x50 Tile Heatmap & Red-Zone Masking ---
        cond_spatial = self.tile_cond_proj(cond_emb).unsqueeze(-1).unsqueeze(-1)  # (B, 64, 1, 1)
        fused_spatial = F.silu(spatial_feat + cond_spatial)
        tile_logits = self.tile_conv_head(fused_spatial).reshape(B, 2500)

        if masks is not None and "tile" in masks:
            valid_green = masks["tile"].to(device=device, dtype=torch.bool)
            # Troops (1), Heroes (2), and Siege (4) MUST be placed outside the red zone.
            # Spells (6) can be dropped anywhere on the 50x50 village!
            needs_green = (chosen_type == 1) | (chosen_type == 2) | (chosen_type == 4)
            effective_tile_mask = torch.where(
                needs_green.unsqueeze(-1),
                valid_green,
                torch.ones_like(valid_green, dtype=torch.bool),
            )
            tile_logits = tile_logits.masked_fill(~effective_tile_mask, NEG_INF)

        tile_dist = Categorical(logits=tile_logits)
        if action is None:
            chosen_tile = tile_logits.argmax(dim=-1) if deterministic else tile_dist.sample()
            tile_x = chosen_tile % 50
            tile_y = torch.div(chosen_tile, 50, rounding_mode="floor")
            out_action = torch.stack([chosen_type, chosen_idx, tile_x, tile_y], dim=-1)
        else:
            tile_x = action[:, 2].long().clamp(0, 49)
            tile_y = action[:, 3].long().clamp(0, 49)
            chosen_tile = tile_y * 50 + tile_x
            out_action = action.long()

        # --- STEP 2.4: Joint Log-Prob, Entropy & Critic Value ---
        uses_idx = ((chosen_type == 1) | (chosen_type == 2) | (chosen_type == 3) | (chosen_type == 6)).float()
        uses_tile = ((chosen_type == 1) | (chosen_type == 2) | (chosen_type == 4) | (chosen_type == 6)).float()

        log_prob = (
            type_dist.log_prob(chosen_type)
            + uses_idx * idx_dist.log_prob(chosen_idx)
            + uses_tile * tile_dist.log_prob(chosen_tile)
        )
        entropy = (
            type_dist.entropy()
            + uses_idx * idx_dist.entropy()
            + uses_tile * tile_dist.entropy()
        )
        value = self.critic_head(global_emb).squeeze(-1)

        diagnostics = {
            "slot_type_probs": type_dist.probs.detach(),
            "slot_idx_probs": idx_dist.probs.detach(),
            "tile_heatmap": tile_dist.probs.detach().reshape(B, 50, 50),
        }
        return out_action, log_prob, entropy, value, diagnostics


# =============================================================================
# LAB 3: REWARD SHAPING & GENERALIZED ADVANTAGE ESTIMATION (GAE)
# =============================================================================
# WHY THIS LAB EXISTS (CREDIT ASSIGNMENT IN LONG HORIZONS):
#   A Clash of Clans battle lasts up to 180 seconds (1,800 simulation ticks).
#   If we only rewarded the agent when it earned a Star (0, 1, 2, or 3), almost
#   every step would have reward 0.0 (sparse rewards), and a troop deployed at
#   t=1.0s wouldn't know if it helped earn a star at t=60.0s!
#   Lab 3 solves credit assignment in two parts:
#     - Lab 3A (`compute_custom_reward`): Combines continuous dense feedback
#       (building HP damage & destruction %) with sparse tactical milestones
#       (destroying Town Hall 18, earning stars, fast 3-star completion).
#     - Lab 3B (`compute_gae`): Uses Generalized Advantage Estimation (Schulman
#       et al., 2015) to propagate future rewards backward through time while
#       balancing bias vs. variance via `gamma` and `gae_lambda`.
# =============================================================================
def compute_custom_reward(step_info: Dict[str, Any]) -> float:
    """
    LAB 3A: Design the reward signal received by the agent after each step.

    Available keys in `step_info`:
      - `delta_damage_ratio` (float in 0..1): fraction of total village HP destroyed this step
      - `delta_pct`          (int): new destruction percentage points gained this step
      - `delta_stars`        (int): new stars (0..3) earned this step
      - `th_just_destroyed`  (bool): True on the exact step Town Hall 18 falls
      - `stars`              (int): current total stars (0..3)
      - `time_remaining_ratio` (float in 0..1): fraction of the 180s battle clock left
      - `invalid_action`     (bool): True if the agent attempted an illegal action
    """
    # >>> YOUR LAB 3A REWARD FORMULA (50/50 Balanced Destruction % & Stars) <<<
    delta_pct = float(step_info.get("delta_pct", 0))
    delta_stars = float(step_info.get("delta_stars", 0))
    invalid_action = bool(step_info.get("invalid_action", False))

    # 1. 50% for 100% destruction: 0.50 points per 1% destruction (50.0 max)
    pct_reward = delta_pct * 0.50
    # 2. 50% for 3 stars: 50.0 / 3.0 = 16.6667 points per star (50.0 max)
    stars_reward = delta_stars * (50.0 / 3.0)

    reward = pct_reward + stars_reward

    if invalid_action:
        # Small safety penalty for illegal unmasked actions
        reward -= 0.05

    return float(reward)


def compute_gae(
    rewards: torch.Tensor,
    values: torch.Tensor,
    dones: torch.Tensor,
    next_value: torch.Tensor,
    gamma: float = 0.99,
    gae_lambda: float = 0.95,
) -> Tuple[torch.Tensor, torch.Tensor]:
    """
    LAB 3B: Generalized Advantage Estimation (Schulman et al., 2015).

    STEP-BY-STEP MATHEMATICAL JUSTIFICATIONS:
      1. Why iterate BACKWARDS (`reversed(range(T))`)?
         The advantage at step `t` depends on what happened at `t+1, t+2, ...`.
         Iterating from the end of the rollout (`T-1`) back to `0` lets us compute
         every step's multi-step advantage in O(T) time using a single running
         variable `last_gae_lam` (`A_{t+1}`).
      2. Why `non_terminal = 1.0 - dones[t].float()`?
         If the battle ended at step `t` (`dones[t] == 1`), there is no future
         value from this battle after step `t`! Multiplying by `non_terminal`
         zeros out `next_val` and `last_gae_lam` across episode boundaries so
         rewards from a new battle never leak backward into the previous battle.
      3. Why `delta = r_t + gamma * V(s_{t+1}) * non_terminal - V(s_t)`?
         This is the 1-step Temporal Difference (TD) error:
           - `r_t + gamma * V(s_{t+1})` is what *actually* happened (immediate reward
             plus discounted Critic estimate of the next state).
           - `V(s_t)` is what the Critic *expected* before the action was taken.
         So `delta > 0` means the action at step `t` was a pleasant surprise!
      4. Why `last_gae_lam = delta + gamma * gae_lambda * non_terminal * last_gae_lam`?
         - Setting `gae_lambda = 0` uses only 1-step `delta` (low variance, but high
           bias if the Critic `V` is inaccurate).
         - Setting `gae_lambda = 1` sums all raw future rewards (unbiased Monte Carlo,
           but huge variance over cientos of ticks).
         - `gae_lambda = 0.95` exponentially decays future TD errors, giving the sweet
           spot between fast credit assignment and low gradient noise.
      5. Why `returns = advantages + values`?
         Since `Advantage(s_t, a_t) = Return_t - V(s_t)`, adding `V(s_t)` back recovers
         the multi-step target return `R_t` that the Critic head will train to predict
         via Mean Squared Error in Lab 4!
    """
    # >>> YOUR LAB 3B GAE IMPLEMENTATION <<<
    T = rewards.shape[0]
    advantages = torch.zeros_like(rewards)
    last_gae_lam = torch.zeros((), dtype=rewards.dtype, device=rewards.device)
    next_val = next_value.squeeze()

    for t in reversed(range(T)):
        non_terminal = 1.0 - dones[t].float()
        delta = rewards[t] + gamma * next_val * non_terminal - values[t]
        last_gae_lam = delta + gamma * gae_lambda * non_terminal * last_gae_lam
        advantages[t] = last_gae_lam
        next_val = values[t]

    returns = advantages + values
    return advantages, returns


# =============================================================================
# LAB 4: CLIPPED PPO UPDATE STEP (`ppo_update_step`)
# =============================================================================
# WHY THIS LAB EXISTS (SAFE MULTI-EPOCH GPU POLICY OPTIMIZATION):
#   Once we have collected a rollout of battles and computed `advantages` and
#   `returns` via GAE, we want to update our `CoCActorCritic` weights on the GPU
#   for several epochs (minibatches). Standard policy gradient (`-adv * log_prob`)
#   cannot be run for multiple epochs on the same data without pushing action
#   probabilities too far and causing catastrophic policy collapse.
#   Clipped PPO solves this with a pessimistic trust-region objective.
# =============================================================================
def ppo_update_step(
    model: CoCActorCritic,
    optimizer: torch.optim.Optimizer,
    obs_b: torch.Tensor,
    actions_b: torch.Tensor,
    old_logprobs_b: torch.Tensor,
    advantages_b: torch.Tensor,
    returns_b: torch.Tensor,
    masks_b: Optional[Dict[str, torch.Tensor]] = None,
    clip_coef: float = 0.2,
    vf_coef: float = 0.5,
    ent_coef: float = 0.01,
    max_grad_norm: float = 0.5,
) -> Dict[str, float]:
    """
    LAB 4: Single Minibatch Update of Clipped Proximal Policy Optimization (PPO).

    STEP-BY-STEP JUSTIFICATIONS:
      1. Re-evaluate `actions_b` under current `model`:
         We pass `action=actions_b` into `model.get_action_and_value(...)` so the
         network does NOT sample new random actions—instead, it computes what the
         *current* weights think the `new_logprob`, `entropy`, and `new_value` are
         for the exact actions that were taken during the rollout.
      2. Per-minibatch Advantage Normalization:
         `adv = (advantages_b - mean) / (std + 1e-8)` ensures that every minibatch
         has zero mean and unit standard deviation, keeping policy gradient step
         sizes invariant to how large or small rewards are early vs. late in training.
      3. Probability Ratio `ratio = torch.exp(new_logprob - old_logprobs_b)`:
         Since `exp(log P_new - log P_old) = P_new(a|s) / P_old(a|s)`, `ratio`
         measures how much more (> 1.0) or less (< 1.0) likely the action has
         become compared to when the rollout was collected.
      4. Clipped Surrogate Policy Loss (`pg_loss1`, `pg_loss2`, `torch.max`):
         - `pg_loss1 = -adv * ratio` is the unclipped objective (negative because
           PyTorch optimizers minimize loss, whereas we want to maximize advantage).
         - `pg_loss2 = -adv * torch.clamp(ratio, 1.0 - clip_coef, 1.0 + clip_coef)`
           clamps the ratio to `[0.8, 1.2]`.
         - `policy_loss = torch.max(pg_loss1, pg_loss2).mean()` takes the worse
           (larger) loss of the two. Once a good action (`adv > 0`) has increased
           in probability by +20% (`ratio > 1.2`), or a bad action (`adv < 0`) has
           decreased by -20% (`ratio < 0.8`), `pg_loss2` flattens out with zero
           gradient, removing any incentive to push the policy further in this update!
      5. Critic Value Loss (`0.5 * F.mse_loss(new_value, returns_b)`):
         Trains `self.critic_head` to predict the GAE target `returns_b` accurately.
      6. Entropy Bonus (`- ent_coef * entropy_loss`):
         Subtracting entropy from the total loss rewards higher entropy (more spread-out
         action probabilities), preventing the agent from collapsing onto a single
         deployment tile before exploring the whole village perimeter.
      7. Gradient Norm Clipping (`nn.utils.clip_grad_norm_`):
         Rescales the global parameter gradient vector if its L2 norm exceeds
         `max_grad_norm` (0.5), protecting the CNN from rare reward spikes.
    """
    # >>> YOUR LAB 4 PPO UPDATE IMPLEMENTATION <<<
    # 1. Forward pass evaluating the stored rollout actions under current weights
    _, new_logprob, entropy, new_value, _ = model.get_action_and_value(
        obs_b, masks=masks_b, action=actions_b
    )

    # 2. Normalize advantages to mean=0, std=1 within the minibatch
    adv = (advantages_b - advantages_b.mean()) / (advantages_b.std(unbiased=False) + 1e-8)

    # 3. Importance-sampling probability ratio r(theta) = P_new(a|s) / P_old(a|s)
    logratio = new_logprob - old_logprobs_b
    ratio = torch.exp(logratio)

    # 4. Pessimistic Clipped Surrogate Objective
    pg_loss1 = -adv * ratio
    pg_loss2 = -adv * torch.clamp(ratio, 1.0 - clip_coef, 1.0 + clip_coef)
    policy_loss = torch.max(pg_loss1, pg_loss2).mean()

    # 5. Critic MSE loss + 6. Entropy exploration bonus
    value_loss = 0.5 * F.mse_loss(new_value, returns_b)
    entropy_loss = entropy.mean()

    total_loss = policy_loss + vf_coef * value_loss - ent_coef * entropy_loss

    # 7. Backprop, global gradient norm clipping, and Adam step
    optimizer.zero_grad()
    total_loss.backward()
    nn.utils.clip_grad_norm_(model.parameters(), max_grad_norm)
    optimizer.step()

    # Diagnostics: approximate KL divergence (Schulman's unbiased estimator) & clip fraction
    with torch.no_grad():
        approx_kl = ((ratio - 1.0) - logratio).mean().item()
        clip_frac = ((ratio - 1.0).abs() > clip_coef).float().mean().item()

    return {
        "total_loss": float(total_loss.item()),
        "policy_loss": float(policy_loss.item()),
        "value_loss": float(value_loss.item()),
        "entropy": float(entropy_loss.item()),
        "approx_kl": float(approx_kl),
        "clip_fraction": float(clip_frac),
    }


if __name__ == "__main__":
    import os
    import sys

    sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    from verify_labs import run_all_verifications

    summary = run_all_verifications(verbose=True)
    if summary["all_passed"]:
        print("\n🚀 All 4 Labs verified on", summary["device_name"])
        print("Run `.venv/bin/python python/train_ai.py --episodes 20` to train your agent!")
