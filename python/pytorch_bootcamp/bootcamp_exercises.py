#!/usr/bin/env python3
"""
===============================================================================
GRADUATED PYTORCH BOOTCAMP FROM SCRATCH (`bootcamp_exercises.py`)
===============================================================================
Zero Clash of Clans complexity! Learn pure PyTorch step by step on your RTX 4060 GPU.

Each of the 6 modules below is a short, self-contained toy exercise (~5 to 15 lines).
Edit the `# TODO` lines directly in your editor (e.g. `nvim`), then verify from your terminal:
    .venv/bin/python python/pytorch_bootcamp/verify_bootcamp.py
===============================================================================
"""

from typing import Dict, Tuple
import torch
import torch.nn as nn
import torch.nn.functional as F
from torch.distributions import Categorical


# =============================================================================
# MODULE 1: Tensors, Shapes, Reshaping & GPU Acceleration
# =============================================================================
# WHY THIS MODULE EXISTS:
#   Every observation, action mask, and neural network weight in PyTorch is a
#   `torch.Tensor`. Understanding how tensors are allocated on the GPU, reshaped
#   into batches, broadcasted, and reduced across specific axes is the foundation
#   for feeding 50x50 Clash of Clans maps into a GPU neural network.
#
# STEP-BY-STEP JUSTIFICATIONS:
#   - Step 1 (`torch.arange(12, dtype=torch.float32, device=device)`):
#     Neural network weights use 32-bit floating point (`float32`). Passing
#     `device=device` allocates the array directly in NVIDIA GPU VRAM ("cuda")
#     instead of CPU RAM, avoiding slow CPU-to-GPU memory copies later.
#   - Step 2 (`x.reshape(3, 2, 2)`):
#     Deep learning models always process data in batches. Reshaping 12 flat
#     numbers into `(Batch=3, Rows=2, Cols=2)` is a zero-copy view operation:
#     it changes how PyTorch indexes the memory without copying any numbers.
#   - Step 3 (`batch_matrices * 2.0 + 1.0`):
#     Vectorized broadcasting runs across all 12 elements simultaneously on
#     thousands of GPU CUDA cores in a single instruction, instead of a slow
#     Python `for` loop.
#   - Step 4 (`transformed.mean(dim=(1, 2))`):
#     Passing `dim=(1, 2)` collapses the spatial Row (dim 1) and Col (dim 2)
#     axes while preserving the Batch axis (dim 0), producing 1 summary number
#     per item in the batch -> shape `(3,)`.
# =============================================================================
def module1_tensors_and_gpu(device: torch.device) -> Dict[str, torch.Tensor]:
    # STEP 1: Create a 1D float32 tensor of 12 numbers (0.0 to 11.0) on `device`
    # Justification: Allocates contiguous float32 memory directly on the GPU.
    # Syntax: x = torch.arange(12, dtype=torch.float32, device=device)
    x = torch.arange(
        12, dtype=torch.float32, device=device
    )  # TODO: replace None with torch.arange(...)

    # STEP 2: Reshape `x` into a batch of 3 matrices, each 2x2 -> shape (3, 2, 2)
    # Justification: Organizes flat data into (Batch, Height, Width) without copying memory.
    # Syntax: batch_matrices = x.reshape(3, 2, 2)
    batch_matrices = x.reshape(3, 2, 2)  # TODO: reshape x to (3, 2, 2)

    # STEP 3: Multiply `batch_matrices` by 2.0 and add 1.0
    # Justification: Demonstrates GPU-parallel affine scaling (like a weight + bias layer).
    transformed = batch_matrices * 2.0 + 1.0  # TODO: batch_matrices * 2.0 + 1.0

    # STEP 4: Compute the mean of each 2x2 matrix across dimensions (1, 2) -> shape (3,)
    # Justification: Reduces spatial dimensions (H, W) per sample while keeping the batch dimension intact.
    # Syntax: batch_means = transformed.mean(dim=(1, 2))
    batch_means = transformed.mean(dim=(1, 2))  # TODO: compute mean over dim=(1, 2)
    print(batch_means)

    return {
        "x": x,
        "batch_matrices": batch_matrices,
        "transformed": transformed,
        "batch_means": batch_means,
    }


# =============================================================================
# MODULE 2: Autograd & Automatic Differentiation (`.backward()`)
# =============================================================================
# WHY THIS MODULE EXISTS:
#   To train a neural network, we need to know how changing each weight `w`
#   affects the final error (`d(loss)/d(w)`). PyTorch's Autograd engine builds a
#   dynamic computation graph on the fly during the forward pass and applies the
#   chain rule backwards automatically when you call `loss.backward()`.
#
# STEP-BY-STEP JUSTIFICATIONS:
#   - Step 1 (Forward Pass & Mean Squared Error):
#     `y_pred = w * x + b` computes the current line prediction. Squaring the
#     error `(y_pred - y_target) ** 2` ensures positive and negative errors don't
#     cancel out, and penalizes large misses more heavily than small ones.
#   - Step 2 (`loss.backward()`):
#     Walks backward from `loss` through the computation graph to `w` and `b`,
#     computing the exact partial derivatives `d(loss)/dw` and `d(loss)/db` and
#     storing them in `w.grad` and `b.grad`.
#   - Step 3 (`with torch.no_grad(): w -= lr * w.grad`):
#     The gradient `w.grad` points in the direction of STEEPEST INCREASE of the
#     loss. Subtracting `lr * w.grad` steps downhill toward lower loss. We wrap
#     this in `torch.no_grad()` because the weight update itself is not part of
#     the forward prediction formula—if tracked, PyTorch would build an infinite
#     history graph across training steps!
#   - Step 4 (`w.grad.zero_()`):
#     PyTorch intentionally ADDS (`+=`) new gradients into `.grad` on every
#     `.backward()` call (useful when accumulating gradients over multiple
#     mini-batches). For standard step-by-step updates, failing to zero `.grad`
#     mixes old stale gradients into the current step and causes wild oscillations.
# =============================================================================
def module2_autograd_parabola() -> Dict[str, float]:
    # Goal: Discover the hidden line y = 3.0 * x + 2.0 starting from w=0, b=0
    x = torch.tensor([-2.0, -1.0, 0.0, 1.0, 2.0])
    y_target = 3.0 * x + 2.0

    # `requires_grad=True` tells PyTorch to track every operation on `w` and `b`
    w = torch.tensor(0.0, requires_grad=True)
    b = torch.tensor(0.0, requires_grad=True)
    lr = 0.1

    initial_loss = 0.0
    final_loss = 0.0

    for step in range(60):
        # STEP 1: Compute prediction `y_pred = w * x + b` and Mean Squared Error `((y_pred - y_target) ** 2).mean()`
        # Justification: Builds the forward computation graph linking `w` and `b` to scalar `loss`.
        y_pred = w * x + b  # TODO: w * x + b
        loss = (
            (y_pred - y_target) ** 2
        ).mean()  # TODO: ((y_pred - y_target) ** 2).mean()

        assert y_pred is not None, (
            "Step 1 (`y_pred`) is still None! Write `y_pred = w * x + b`."
        )
        assert loss is not None, (
            "Step 1 (`loss`) is still None! Write `loss = ((y_pred - y_target) ** 2).mean()`."
        )

        if step == 0:
            initial_loss = float(loss.item())

        # STEP 2: Trigger backpropagation so PyTorch populates `w.grad` and `b.grad`
        # Justification: Applies the calculus chain rule backward from `loss` to every leaf parameter.
        # Syntax: loss.backward()
        # TODO: call loss.backward()
        loss.backward()
        assert w.grad is not None and b.grad is not None, (
            "Step 2: `w.grad` is None! Call `loss.backward()` before updating `w` and `b`."
        )

        # STEP 3: Update `w` and `b` using gradient descent inside `with torch.no_grad():`
        # Justification: Steps opposite the gradient to reduce loss, without recording the update in autograd.
        with torch.no_grad():
            w -= lr * w.grad
            b -= lr * b.grad
            # TODO: w -= lr * w.grad
            # TODO: b -= lr * b.grad

        # STEP 4: Reset gradients to zero for the next loop iteration!
        # Justification: Prevents gradient accumulation across steps (`backward()` uses `+=` on `.grad`).
        # Syntax: w.grad.zero_() and b.grad.zero_()
        # TODO: zero out w.grad and b.grad
        w.grad.zero_()
        b.grad.zero_()

        final_loss = float(loss.item())

    return {
        "learned_w": round(float(w.item()), 4),
        "learned_b": round(float(b.item()), 4),
        "initial_loss": round(initial_loss, 4),
        "final_loss": round(final_loss, 6),
    }


# =============================================================================
# MODULE 3: Neural Networks (`nn.Module`) & Optimizers (`torch.optim.Adam`)
# =============================================================================
# WHY THIS MODULE EXISTS:
#   Real neural networks have hundreds of thousands of weights across many layers.
#   `nn.Module` automatically registers every layer's weights/biases, and
#   `torch.optim.Adam` automates the `with torch.no_grad(): w -= lr * w.grad`
#   loop with adaptive per-parameter learning rates and momentum.
#
# STEP-BY-STEP JUSTIFICATIONS:
#   - Step 1 (`nn.Sequential` with `nn.Linear` and `nn.SiLU()`):
#     Why do we need `nn.SiLU()` between `nn.Linear` layers? Because the product
#     of two linear matrices `W2 @ (W1 @ x)` is still just a single linear matrix!
#     Without a non-linear activation (`SiLU(z) = z * sigmoid(z)`), a 100-layer
#     network could still only fit straight lines/planes and could never learn
#     curves like `sin(x)` or `cos(x)`.
#   - Step 2 (`forward(self, x)`):
#     Defines how input tensors flow through the layers. When you call `model(x)`,
#     PyTorch runs hooks and then invokes `model.forward(x)`.
#   - Step 3 (The 5-Line Training Loop):
#     1. `optimizer.zero_grad()` clears `.grad` on every parameter in `model`.
#     2. `pred = model(x)` runs the forward pass.
#     3. `loss = F.mse_loss(pred, y_target)` measures prediction error.
#     4. `loss.backward()` computes gradients for all layers in one pass.
#     5. `optimizer.step()` updates all parameters using Adam's momentum + RMSProp.
# =============================================================================
class TinyMLP(nn.Module):
    def __init__(
        self, in_features: int = 4, hidden_dim: int = 32, out_features: int = 2
    ):
        super().__init__()
        # STEP 1: Build `self.net` using `nn.Sequential` with:
        # nn.Linear(in_features, hidden_dim), nn.SiLU(),
        # nn.Linear(hidden_dim, hidden_dim),  nn.SiLU(),
        # nn.Linear(hidden_dim, out_features)
        # Justification: Non-linear `nn.SiLU()` activations between `nn.Linear` layers allow
        # the network to approximate curved functions (`sin`, `cos`); the final output layer
        # has no activation so predictions can take any positive or negative real value.
        self.net = nn.Sequential(
            nn.Linear(in_features, hidden_dim),
            nn.Linear(hidden_dim, hidden_dim),
            nn.Linear(hidden_dim, out_features),
        )

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        # STEP 2: Pass `x` through `self.net` and return the result
        return self.net(x)  # TODO: return self.net(x)


def module3_train_mlp(device: torch.device) -> Dict[str, float]:
    torch.manual_seed(42)
    x = torch.randn(64, 4, device=device)
    y_target = torch.stack(
        [torch.sin(x[:, 0] * 2.0) + x[:, 1], torch.cos(x[:, 2]) - x[:, 3] * 0.5],
        dim=-1,
    )

    model = TinyMLP(in_features=4, hidden_dim=32, out_features=2).to(device)
    assert model.net is not None, (
        "Step 1 (`TinyMLP.__init__`): `self.net` is still None! Build `nn.Sequential(nn.Linear(in_features, hidden_dim), nn.SiLU(), nn.Linear(hidden_dim, hidden_dim), nn.SiLU(), nn.Linear(hidden_dim, out_features))`."
    )
    optimizer = torch.optim.Adam(model.parameters(), lr=1e-2)

    initial_loss = 0.0
    final_loss = 0.0
    for step in range(120):
        # STEP 3: Write the 5-line PyTorch training step (`zero_grad`, `model(x)`, `F.mse_loss`, `backward`, `step`)
        # Justification: This 5-step cycle (clear old grads -> forward pass -> compute loss ->
        # backprop gradients -> apply Adam update) is the universal engine of all PyTorch training.
        optimizer.zero_grad()
        pred = model.forward(x)
        loss = F.mse_loss(pred, y_target)
        loss.backward()
        optimizer.step()
        assert loss is not None, (
            "Step 3: `loss` is still None! Run `optimizer.zero_grad()`, `pred = model(x)`, `loss = F.mse_loss(pred, y_target)`, `loss.backward()`, and `optimizer.step()`."
        )
        if step == 0:
            initial_loss = float(loss.item())
        final_loss = float(loss.item())

    return {
        "initial_loss": round(initial_loss, 4),
        "final_loss": round(final_loss, 5),
        "param_count": sum(p.numel() for p in model.parameters()),
    }


# =============================================================================
# MODULE 4: 2D Convolutions (`nn.Conv2d`) & Spatial Heatmaps
# =============================================================================
# WHY THIS MODULE EXISTS:
#   A game board (or 50x50 Clash of Clans village) is a 2D spatial grid. If you
#   flattened the grid into a 1D vector first, the network would lose all notion
#   of which tiles are neighbors! `nn.Conv2d` slides small 3x3 filters across
#   `(Batch, Channels, Height, Width)` to detect local patterns (like walls next
#   to defenses) while keeping exact `(x, y)` coordinates intact.
#
# STEP-BY-STEP JUSTIFICATIONS:
#   - Why `kernel_size=3, padding=1` in the backbone?:
#     A 3x3 filter without padding shrinks an 8x8 grid to 6x6 because border tiles
#     lack outer neighbors. Adding a 1-tile border (`padding=1`) guarantees the
#     output stays 8x8 so feature cell `(y, x)` still aligns with board tile `(y, x)`.
#   - Step 1 (`self.heatmap_head = nn.Conv2d(32, 1, kernel_size=1)`):
#     At each `(y, x)` tile, we have a 32-number feature vector. A `1x1` convolution
#     is simply a shared `Linear(32 -> 1)` applied independently at every tile,
#     collapsing `(B, 32, 8, 8)` into a 1-channel spatial score map `(B, 1, 8, 8)`.
#   - Step 2 (`self.global_head` with `AdaptiveAvgPool2d((1, 1))`):
#     To decide *what* unit to use or estimate overall win probability, we need a
#     single summary of the whole board. `AdaptiveAvgPool2d((1, 1))` averages each
#     of the 32 channels across all 64 tiles -> `(B, 32, 1, 1)`, which `Flatten()`
#     turns into `(B, 32)` before `Linear(32, 16)` projects it to `(B, 16)`.
#   - Step 3 & Step 4 (`forward` pass):
#     Reshaping the `(B, 1, 8, 8)` heatmap into `(B, 64)` gives a flat list of 64
#     tile logits ready to pass into a 64-way `Categorical` distribution!
# =============================================================================
class MiniGridCNN(nn.Module):
    def __init__(self):
        super().__init__()
        # Input is a batch of 8x8 boards with 3 channels: `(B, 3, 8, 8)`
        self.conv_backbone = nn.Sequential(
            nn.Conv2d(in_channels=3, out_channels=16, kernel_size=3, padding=1),
            nn.SiLU(),
            nn.Conv2d(in_channels=16, out_channels=32, kernel_size=3, padding=1),
            nn.SiLU(),
        )
        # STEP 1: Create `self.heatmap_head` using a 1x1 Conv2d that maps 32 channels -> 1 channel
        # Justification: Projects the 32 local features at every (x, y) cell into 1 action score per tile.
        # Syntax: nn.Conv2d(in_channels=32, out_channels=1, kernel_size=1)
        self.heatmap_head = nn.Sequential(
            nn.Conv2d(in_channels=32, out_channels=1, kernel_size=1)
        )

        # STEP 2: Create `self.global_head` using `nn.Sequential`:
        #   nn.AdaptiveAvgPool2d((1, 1)), nn.Flatten(), nn.Linear(32, 16)
        # Justification: Pools spatial information across the entire board into a compact 16-D state vector.
        self.global_head = nn.Sequential(
            nn.AdaptiveAvgPool2d((1, 1)), nn.Flatten(), nn.Linear(32, 16)
        )  # TODO

    def forward(self, grid: torch.Tensor) -> Tuple[torch.Tensor, torch.Tensor]:
        B = grid.shape[0]
        feat = self.conv_backbone(grid)  # shape is (B, 32, 8, 8)
        assert self.heatmap_head is not None, (
            "Step 1 (`self.heatmap_head`) is still None! Set `self.heatmap_head = nn.Conv2d(32, 1, kernel_size=1)`."
        )
        assert self.global_head is not None, (
            "Step 2 (`self.global_head`) is still None! Set `self.global_head = nn.Sequential(nn.AdaptiveAvgPool2d((1, 1)), nn.Flatten(), nn.Linear(32, 16))`."
        )

        # STEP 3: Compute `heatmap_logits` by passing `feat` to `self.heatmap_head` and reshaping to `(B, 64)`
        # Justification: Flattens the 8x8 spatial score grid into 64 discrete action logits per batch item.
        heatmap_logits = self.heatmap_head(feat).reshape(
            B, 64
        )  # TODO: self.heatmap_head(feat).reshape(B, 64)

        # STEP 4: Compute `global_summary` by passing `feat` to `self.global_head` -> shape `(B, 16)`
        # Justification: Produces the board-wide context vector used for non-spatial decisions and Critic value.
        global_summary = self.global_head(feat)  # TODO: self.global_head(feat)

        return heatmap_logits, global_summary


# =============================================================================
# MODULE 5: `Categorical` Distributions & Invalid-Action Masking
# =============================================================================
# WHY THIS MODULE EXISTS:
#   In Reinforcement Learning, the Actor network outputs unnormalized raw scores
#   (`logits`) for each discrete action. We need a way to:
#     1. Strictly forbid illegal moves (e.g., deploying a troop inside the village's
#        inner Red Zone, or picking an empty troop slot).
#     2. Convert the remaining legal logits into probabilities `P(a | s)` via Softmax.
#     3. Sample actions stochastically (to explore) and compute `log P(a | s)` and
#        Shannon entropy `H(P)` for the PPO loss function.
#
# STEP-BY-STEP JUSTIFICATIONS:
#   - Step 1 (`raw_logits.masked_fill(~valid_mask, -1e8)`):
#     Why replace illegal logits with `-1e8` instead of zeroing probabilities after
#     Softmax? Because Softmax computes `P(a_i) = exp(logit_i) / sum_j exp(logit_j)`.
#     When `logit_i = -1e8`, `exp(-1e8)` underflows to `0.0`, so illegal actions get
#     0.0000% probability AND the remaining legal actions automatically sum to 100%
#     with clean, exact gradients!
#   - Step 2 (`dist = Categorical(logits=masked_logits)`):
#     Wraps the masked logits in a PyTorch probability distribution using numerically
#     stable `log_softmax` under the hood.
#   - Step 3 (`dist.log_prob(chosen_action)` and `dist.entropy()`):
#     - Why `log_prob` instead of raw `prob`? Probabilities across multiple decisions
#       multiply (`P_1 * P_2 * P_3`), which quickly underflows to 0 in float32. Logs
#       turn multiplication into stable addition (`log P_1 + log P_2 + log P_3`), and
#       the policy gradient theorem directly uses `grad log P(a | s)`.
#     - Why `entropy()`? Entropy `-sum P(a) log P(a)` is high when probabilities are
#       spread out (exploring) and 0 when collapsed onto 1 action (deterministic).
#       Adding an entropy bonus in PPO prevents premature convergence.
# =============================================================================
def module5_masked_categorical() -> Dict[str, torch.Tensor]:
    # Actions 1 and 3 have huge raw logits (10.0 and 8.0), but are ILLEGAL (False)!
    raw_logits = torch.tensor([[1.0, 10.0, 2.0, 8.0, 0.5]])
    valid_mask = torch.tensor([[True, False, True, False, True]])

    # STEP 1: Mask out illegal actions in `raw_logits` using `.masked_fill(~valid_mask, -1e8)`
    # Justification: `~valid_mask` flips True/False so illegal slots become True and get replaced
    # by `-1e8`. Inside Softmax, `exp(-1e8) == 0.0`, zeroing out illegal actions before sampling.
    masked_logits = raw_logits.masked_fill(~valid_mask, -1e8)
    assert masked_logits is not None, (
        "Step 1 (`masked_logits`) is still None! Write `masked_logits = raw_logits.masked_fill(~valid_mask, -1e8)`."
    )

    # STEP 2: Create a `Categorical(logits=masked_logits)` distribution
    # Justification: Applies Softmax over the legal logits and exposes `.sample()`, `.log_prob()`, and `.entropy()`.
    dist = Categorical(logits=masked_logits)
    assert dist is not None, (
        "Step 2 (`dist`) is still None! Write `dist = Categorical(logits=masked_logits)`."
    )

    # STEP 3: Evaluate `dist.log_prob(chosen_action)` and `dist.entropy()` for action 2
    # Justification: `log_prob` is differentiated by PPO to push good actions up/bad actions down;
    # `entropy` measures how much exploration randomness remains in the policy.
    chosen_action = torch.tensor([2])
    log_prob = dist.log_prob(chosen_action)
    entropy = dist.entropy()

    return {
        "probs": dist.probs.squeeze(0),
        "log_prob": log_prob,
        "entropy": entropy,
    }


# =============================================================================
# MODULE 6: Your First Mini Clipped-PPO Agent (5-Action Treasure Bandit)
# =============================================================================
# WHY THIS MODULE EXISTS (WHAT PPO IS FOR):
#   In supervised learning (Modules 1-3), a teacher gives you the true label `y_target`
#   and you minimize `MSE(pred, y_target)`. In Reinforcement Learning, there is NO
#   label telling the agent which door (or which 50x50 village tile) is optimal!
#   The agent must try actions, observe the resulting reward, and adjust its action
#   probabilities via trial and error.
#
#   Proximal Policy Optimization (PPO) is the industry-standard RL algorithm that
#   lets us safely run multiple gradient update epochs on each batch of collected
#   experience without overshooting and wrecking the policy network.
#
# THE TOY ENVIRONMENT (5-Door Treasure Bandit):
#   - Doors 0, 1, 2, 3 are traps: reward = -1.0
#   - Door 4 holds the treasure:  reward = +10.0
#   - `actor_logits` (5 params, init 0): controls door probabilities (starts at 20% each)
#   - `critic_value` (1 param, init 0): estimates the expected average reward `V(s)`
#
# HOW EACH PHASE & STEP WORKS (WITH MATHEMATICAL JUSTIFICATIONS):
#   Phase A — Rollout Collection (`with torch.no_grad():`):
#     1. We sample 32 door picks (`actions`) from the current ("old") policy and
#        record `old_logprobs = log P_old(actions)`. We use `torch.no_grad()`
#        because environment interaction is just data collection, not backprop.
#     2. Why compute `advantages = rewards - critic_value.detach()`?
#        Raw rewards alone are noisy; what matters is whether an action did BETTER
#        (`advantage > 0`) or WORSE (`advantage < 0`) than the Critic's baseline
#        expectation `V(s)`. We `.detach()` `critic_value` so the Actor update
#        doesn't try to cheat by moving the Critic's baseline.
#     3. Why normalize `adv_norm = (advantages - mean) / (std + 1e-8)`?
#        Centering advantages to mean 0 and unit variance ensures half the batch
#        gets pushed up and half gets pushed down with consistent gradient magnitude,
#        whether rewards are in `[-0.1, 0.1]` or `[-100, 1000]`.
#
#   Phase B — 4 PPO Update Epochs on the Collected Batch:
#     Because running game simulations is expensive, PPO reuses the same 32 samples
#     for 4 gradient epochs. Here is why each of your 3 TODO lines is needed:
#
#     - Step 1 (`ratio = torch.exp(new_logprobs - old_logprobs)`):
#       By logarithm laws, `exp(log P_new(a) - log P_old(a)) = P_new(a) / P_old(a)`.
#       This importance-sampling ratio `r(theta)` measures how much the current
#       policy's probability for action `a` has changed since the rollout:
#         * At epoch 0 (before `.step()`), `P_new == P_old`, so `ratio == 1.0`.
#         * If Door 4's probability rises from 20% to 24%, `ratio = 0.24 / 0.20 = 1.20`.
#
#     - Step 2 (`surr1`, `surr2`, and `policy_loss = torch.max(surr1, surr2).mean()`):
#       * Why the minus sign in `surr1 = -adv_norm * ratio`?
#         PyTorch optimizers MINIMIZE loss. When `adv_norm > 0` (a good action), we
#         want `ratio` to increase, which makes `-adv_norm * ratio` more negative.
#       * Why not just minimize `surr1`?
#         Across multiple epochs on the same data, unclipped `surr1` would keep
#         pushing `ratio` to `5x, 20x, 100x...`, causing massive weight updates that
#         destabilize deep neural networks.
#       * How `surr2 = -adv_norm * torch.clamp(ratio, 1.0 - clip_coef, 1.0 + clip_coef)`
#         and `torch.max(surr1, surr2)` enforce a "Trust Region":
#         With `clip_coef = 0.2`, `ratio` is clamped to `[0.8, 1.2]` (+/- 20% change).
#         Taking `torch.max(surr1, surr2)` selects the MORE PESSIMISTIC (larger) loss:
#           - If `adv_norm > 0` (good action like Door 4): once `ratio` exceeds `1.2`,
#             `surr2` caps the reward at `-adv_norm * 1.2`. Its gradient with respect
#             to `actor_logits` becomes 0, stopping the optimizer from pushing Door 4
#             any further during this 4-epoch batch!
#           - If `adv_norm < 0` (bad action like Doors 0-3): once `ratio` drops below
#             `0.8`, `surr2` caps at `-adv_norm * 0.8` (gradient = 0), preventing the
#             optimizer from over-crushing that action in a single update.
#
#     - Step 3 (`value_loss` and `entropy_bonus`):
#       * `value_loss = 0.5 * ((critic_value - rewards.mean()) ** 2).mean()` trains
#         the Critic via MSE so its baseline `V(s)` tracks the true average reward.
#       * `- 0.01 * entropy_bonus` subtracts a small fraction of policy entropy from
#         the total loss, rewarding the Actor for staying slightly exploratory until
#         one door is overwhelmingly proven best.
# =============================================================================
def module6_mini_ppo_step() -> Dict[str, float]:
    torch.manual_seed(0)
    actor_logits = nn.Parameter(torch.zeros(5))  # Starts with equal 20% prob per door
    critic_value = nn.Parameter(torch.zeros(1))  # Critic's estimate of average reward
    optimizer = torch.optim.Adam([actor_logits, critic_value], lr=0.15)

    rewards_for_action = torch.tensor([-1.0, -1.0, -1.0, -1.0, 10.0])
    clip_coef = 0.2

    init_prob_action4 = float(F.softmax(actor_logits.detach(), dim=-1)[4].item())

    for _ in range(45):
        # Rollout: sample 32 tries from current ("old") policy without tracking gradients
        with torch.no_grad():
            old_dist = Categorical(logits=actor_logits)
            actions = old_dist.sample((32,))
            old_logprobs = old_dist.log_prob(actions)
            rewards = rewards_for_action[actions]
            # Advantage = how much better/worse each action did compared to Critic's baseline
            advantages = rewards - critic_value.detach()
            # Normalize advantages to mean=0, std=1 for stable gradient step sizes
            adv_norm = (advantages - advantages.mean()) / (advantages.std() + 1e-8)

        # PPO Update Epochs: reuse the 32 rollout samples for 4 bounded gradient steps
        for _ in range(4):
            new_dist = Categorical(logits=actor_logits)
            new_logprobs = new_dist.log_prob(actions)

            # STEP 1: Compute probability ratio `torch.exp(new_logprobs - old_logprobs)`
            # Justification: Equals P_new(actions) / P_old(actions). Measures how far the
            # updated policy has drifted from the rollout policy that collected the batch.
            ratio = None  # TODO
            assert ratio is not None, (
                "Step 1 (`ratio`) is still None! Write `ratio = torch.exp(new_logprobs - old_logprobs)`."
            )

            # STEP 2: Compute `surr1`, `surr2` (clamped to 1-clip_coef, 1+clip_coef), and `policy_loss = torch.max(surr1, surr2).mean()`
            # Justification: `surr1` is the raw policy gradient loss; `surr2` flattens the gradient
            # once `ratio` moves outside [0.8, 1.2]. `torch.max(surr1, surr2)` takes the pessimistic
            # bound so the optimizer cannot change action probabilities by >20% per rollout batch.
            surr1 = -adv_norm * ratio  # TODO: -adv_norm * ratio
            surr2 = -adv_norm * torch.clamp(
                ratio, 1.0 - clip_coef, 1.0 + clip_coef
            )  # TODO: -adv_norm * torch.clamp(ratio, 1.0 - clip_coef, 1.0 + clip_coef)
            policy_loss = None  # TODO: torch.max(surr1, surr2).mean()
            assert policy_loss is not None, (
                "Step 2 (`policy_loss`) is still None! Compute `surr1`, `surr2`, and `policy_loss = torch.max(surr1, surr2).mean()`."
            )

            # Critic MSE loss (trains baseline V(s)) + Entropy bonus (prevents premature collapse)
            value_loss = 0.5 * ((critic_value - rewards.mean()) ** 2).mean()
            entropy_bonus = new_dist.entropy()

            loss = policy_loss + 0.5 * value_loss - 0.01 * entropy_bonus
            optimizer.zero_grad()
            loss.backward()
            optimizer.step()

    final_probs = F.softmax(actor_logits.detach(), dim=-1)
    return {
        "init_prob_treasure": round(init_prob_action4, 4),
        "final_prob_treasure": round(float(final_probs[4].item()), 4),
        "learned_value": round(float(critic_value.item()), 3),
    }
