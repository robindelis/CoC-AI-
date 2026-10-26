"""
Reference solutions and metadata for the 6-Module PyTorch From-Scratch Bootcamp.
Completely independent of Clash of Clans — teaches pure PyTorch fundamentals step by step.
"""

from typing import Dict, Tuple
import torch
import torch.nn as nn
import torch.nn.functional as F
from torch.distributions import Categorical


# =============================================================================
# MODULE 1 SOLUTION: Tensors, Shapes, Reshaping & GPU Acceleration
# =============================================================================
def sol_module1_tensors_and_gpu(device: torch.device) -> Dict[str, torch.Tensor]:
    # 1. Create a 1D tensor of 12 numbers from 0.0 to 11.0 directly on `device`.
    #    Justification: `float32` is standard GPU precision; `device=device` allocates directly in VRAM.
    x = torch.arange(12, dtype=torch.float32, device=device)

    # 2. Reshape `x` into a batch of 3 matrices, each of shape (2, 2) -> (3, 2, 2).
    #    Justification: Zero-copy view change organizing flat data into (Batch, Height, Width).
    batch_matrices = x.reshape(3, 2, 2)

    # 3. Scale every matrix by 2.0 and add 1.0 (element-wise broadcasting).
    #    Justification: Runs across all elements in parallel on GPU CUDA cores without Python loops.
    transformed = batch_matrices * 2.0 + 1.0

    # 4. Compute the mean across each 2x2 matrix (dim=(1, 2)) -> shape (3,).
    #    Justification: Collapses spatial axes (1, 2) while preserving the batch axis (0).
    batch_means = transformed.mean(dim=(1, 2))

    return {
        "x": x,
        "batch_matrices": batch_matrices,
        "transformed": transformed,
        "batch_means": batch_means,
    }


# =============================================================================
# MODULE 2 SOLUTION: Autograd & Automatic Differentiation
# =============================================================================
def sol_module2_autograd_parabola() -> Dict[str, float]:
    # Fit y = w * x + b to the rule y = 3.0 * x + 2.0 using raw PyTorch autograd!
    x = torch.tensor([-2.0, -1.0, 0.0, 1.0, 2.0])
    y_target = 3.0 * x + 2.0

    # Learnable parameters with `requires_grad=True` so PyTorch records all math on them
    w = torch.tensor(0.0, requires_grad=True)
    b = torch.tensor(0.0, requires_grad=True)
    lr = 0.1

    initial_loss = 0.0
    final_loss = 0.0

    for step in range(60):
        # 1. Forward pass: predict y_pred = w * x + b and MSE loss.
        #    Justification: Squaring the error penalizes large deviations and keeps loss smooth & convex.
        y_pred = w * x + b
        loss = ((y_pred - y_target) ** 2).mean()
        if step == 0:
            initial_loss = float(loss.item())

        # 2. Backward pass: compute d(loss)/dw and d(loss)/db via the chain rule.
        loss.backward()

        # 3. Update parameters inside `torch.no_grad()` so the update itself isn't tracked in the graph.
        #    Justification: `.grad` points uphill (increasing loss), so subtracting `lr * grad` steps downhill.
        with torch.no_grad():
            w -= lr * w.grad
            b -= lr * b.grad

        # 4. Zero out gradients before the next iteration!
        #    Justification: `.backward()` accumulates (`+=`) into `.grad`; failing to zero mixes old gradients.
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
# MODULE 3 SOLUTION: Building Neural Networks with `nn.Module` & `torch.optim`
# =============================================================================
class SolTinyMLP(nn.Module):
    def __init__(self, in_features: int = 4, hidden_dim: int = 32, out_features: int = 2):
        super().__init__()
        # Justification: Non-linear `nn.SiLU()` layers between linear projections enable the network
        # to bend its representation and approximate curved targets (`sin`, `cos`).
        self.net = nn.Sequential(
            nn.Linear(in_features, hidden_dim),
            nn.SiLU(),
            nn.Linear(hidden_dim, hidden_dim),
            nn.SiLU(),
            nn.Linear(hidden_dim, out_features),
        )

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        return self.net(x)


def sol_module3_train_mlp(device: torch.device) -> Dict[str, float]:
    torch.manual_seed(42)
    x = torch.randn(64, 4, device=device)
    # Target is a non-linear combination of the 4 inputs
    y_target = torch.stack(
        [torch.sin(x[:, 0] * 2.0) + x[:, 1], torch.cos(x[:, 2]) - x[:, 3] * 0.5],
        dim=-1,
    )

    model = SolTinyMLP(in_features=4, hidden_dim=32, out_features=2).to(device)
    optimizer = torch.optim.Adam(model.parameters(), lr=1e-2)

    initial_loss = 0.0
    final_loss = 0.0
    for step in range(120):
        # Universal 5-line PyTorch training loop:
        optimizer.zero_grad()               # 1. Reset parameter gradients
        pred = model(x)                     # 2. Forward pass through layers
        loss = F.mse_loss(pred, y_target)   # 3. Compute scalar error
        if step == 0:
            initial_loss = float(loss.item())
        loss.backward()                     # 4. Backpropagate gradients through all layers
        optimizer.step()                    # 5. Apply Adam adaptive weight update
        final_loss = float(loss.item())

    return {
        "initial_loss": round(initial_loss, 4),
        "final_loss": round(final_loss, 5),
        "param_count": sum(p.numel() for p in model.parameters()),
    }


# =============================================================================
# MODULE 4 SOLUTION: 2D Convolutions (`nn.Conv2d`) & Spatial Heatmaps
# =============================================================================
class SolMiniGridCNN(nn.Module):
    """
    Takes a tiny 8x8 multi-channel grid `(B, 3, 8, 8)` and outputs:
      1. `heatmap_logits`: `(B, 64)` (1 logit per cell of the 8x8 grid via 1x1 Conv2d)
      2. `global_summary`: `(B, 16)` (compact vector summarizing the whole 8x8 board)
    """

    def __init__(self):
        super().__init__()
        # `kernel_size=3, padding=1` keeps the spatial size at 8x8 so cell (y, x) stays aligned!
        self.conv_backbone = nn.Sequential(
            nn.Conv2d(in_channels=3, out_channels=16, kernel_size=3, padding=1),
            nn.SiLU(),
            nn.Conv2d(in_channels=16, out_channels=32, kernel_size=3, padding=1),
            nn.SiLU(),
        )
        # 1x1 Conv2d projects 32 channels down to 1 score per cell: (B, 32, 8, 8) -> (B, 1, 8, 8)
        self.heatmap_head = nn.Conv2d(in_channels=32, out_channels=1, kernel_size=1)

        # Global pooling compresses (B, 32, 8, 8) -> (B, 32, 1, 1) -> Flatten -> Linear(32, 16)
        self.global_head = nn.Sequential(
            nn.AdaptiveAvgPool2d((1, 1)),
            nn.Flatten(),
            nn.Linear(32, 16),
        )

    def forward(self, grid: torch.Tensor) -> Tuple[torch.Tensor, torch.Tensor]:
        B = grid.shape[0]
        feat = self.conv_backbone(grid)  # (B, 32, 8, 8)
        heatmap_logits = self.heatmap_head(feat).reshape(B, 64)  # (B, 64)
        global_summary = self.global_head(feat)  # (B, 16)
        return heatmap_logits, global_summary


# =============================================================================
# MODULE 5 SOLUTION: `Categorical` Distributions & Invalid-Action Masking
# =============================================================================
def sol_module5_masked_categorical() -> Dict[str, torch.Tensor]:
    # Suppose our policy network outputs raw scores (logits) for 5 actions:
    # Notice action 1 and action 3 have huge logits (10.0 and 8.0),
    # BUT they are currently ILLEGAL (`mask = [True, False, True, False, True]`)!
    raw_logits = torch.tensor([[1.0, 10.0, 2.0, 8.0, 0.5]])  # shape (1, 5)
    valid_mask = torch.tensor([[True, False, True, False, True]])  # shape (1, 5)

    # 1. Replace illegal logits (where `~valid_mask` is True) with `-1e8`.
    #    Justification: Inside Softmax, `exp(-1e8) == 0.0`, guaranteeing 0% probability
    #    on illegal moves while renormalizing legal moves to sum to 100%.
    masked_logits = raw_logits.masked_fill(~valid_mask, -1e8)

    # 2. Build a PyTorch Categorical distribution from `masked_logits`.
    dist = Categorical(logits=masked_logits)

    # 3. Pick action 2 and compute its log-probability and the distribution's entropy.
    #    Justification: `log_prob` provides stable additive gradients for RL; `entropy`
    #    quantifies exploration spread across the legal choices.
    chosen_action = torch.tensor([2])
    log_prob = dist.log_prob(chosen_action)
    entropy = dist.entropy()

    return {
        "probs": dist.probs.squeeze(0),
        "log_prob": log_prob,
        "entropy": entropy,
    }


# =============================================================================
# MODULE 6 SOLUTION: Mini Actor-Critic PPO on a 5-Door Treasure Bandit
# =============================================================================
def sol_module6_mini_ppo_step() -> Dict[str, float]:
    """
    Trains a tiny Actor-Critic on a 1-step bandit problem where Door 4 gives
    reward +10.0 and Doors 0..3 give -1.0, demonstrating how Clipped PPO
    shifts probability mass onto Door 4 (> 90%) without overshooting.
    """
    torch.manual_seed(0)
    actor_logits = nn.Parameter(torch.zeros(5))
    critic_value = nn.Parameter(torch.zeros(1))
    optimizer = torch.optim.Adam([actor_logits, critic_value], lr=0.15)

    rewards_for_action = torch.tensor([-1.0, -1.0, -1.0, -1.0, 10.0])
    clip_coef = 0.2

    init_prob_action4 = float(F.softmax(actor_logits.detach(), dim=-1)[4].item())

    for _ in range(45):
        # 1. Rollout: sample 32 tries from the current ("old") policy without tracking gradients
        with torch.no_grad():
            old_dist = Categorical(logits=actor_logits)
            actions = old_dist.sample((32,))
            old_logprobs = old_dist.log_prob(actions)
            rewards = rewards_for_action[actions]
            # Advantage = how much better/worse the reward was than the Critic's baseline V(s)
            advantages = rewards - critic_value.detach()
            # Normalize advantages to zero mean and unit variance for consistent gradient scale
            adv_norm = (advantages - advantages.mean()) / (advantages.std() + 1e-8)

        # 2. Run 4 PPO update epochs on the collected batch
        for _ in range(4):
            new_dist = Categorical(logits=actor_logits)
            new_logprobs = new_dist.log_prob(actions)
            # Importance-sampling ratio r(theta) = P_new(a) / P_old(a)
            ratio = torch.exp(new_logprobs - old_logprobs)

            # Clipped surrogate objective: caps incentive to move ratio outside [0.8, 1.2]
            surr1 = -adv_norm * ratio
            surr2 = -adv_norm * torch.clamp(ratio, 1.0 - clip_coef, 1.0 + clip_coef)
            policy_loss = torch.max(surr1, surr2).mean()

            # Critic regression loss (MSE) + Entropy bonus (exploration regularizer)
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
