#!/usr/bin/env python3
"""
Automated Lab Verifier for `learning/rl_labs/student_lab.py`.
Checks tensor shapes, action masking correctness, GAE math, and GPU PPO gradient updates.
Can be run from the CLI (`python learning/rl_labs/verify_labs.py`).
"""

import importlib
import os
import sys
import traceback
from typing import Any, Dict, List

import torch

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from rl_labs import student_lab


def run_all_verifications(verbose: bool = False) -> Dict[str, Any]:
    # Reload student_lab so live edits in the user's editor are picked up immediately
    importlib.reload(student_lab)

    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    device_name = (
        torch.cuda.get_device_name(0)
        if torch.cuda.is_available()
        else "CPU"
    )

    labs_report: List[Dict[str, Any]] = []

    # -------------------------------------------------------------------------
    # Check Lab 1: CoCSpatialEncoder
    # -------------------------------------------------------------------------
    try:
        encoder = student_lab.CoCSpatialEncoder(in_channels=8, spatial_dim=64, embed_dim=256).to(device)
        dummy_obs = torch.rand(4, 8, 50, 50, device=device)
        spatial_feat, global_emb = encoder(dummy_obs)

        assert spatial_feat.shape == (4, 64, 50, 50), (
            f"Expected spatial_features shape (4, 64, 50, 50), got {tuple(spatial_feat.shape)}"
        )
        assert global_emb.shape == (4, 256), (
            f"Expected global_embedding shape (4, 256), got {tuple(global_emb.shape)}"
        )
        assert not torch.isnan(spatial_feat).any() and not torch.isnan(global_emb).any(), (
            "Encoder output contains NaNs"
        )
        param_count = sum(p.numel() for p in encoder.parameters())
        labs_report.append({
            "id": "lab1",
            "title": "Lab 1: Spatial CNN Backbone (CoCSpatialEncoder)",
            "passed": True,
            "details": f"Shapes verified: spatial=(4, 64, 50, 50), global=(4, 256) • {param_count:,} params on {device.type.upper()}",
        })
    except Exception as e:
        labs_report.append({
            "id": "lab1",
            "title": "Lab 1: Spatial CNN Backbone (CoCSpatialEncoder)",
            "passed": False,
            "details": f"{type(e).__name__}: {e}",
            "traceback": traceback.format_exc(),
        })

    # -------------------------------------------------------------------------
    # Check Lab 2: CoCActorCritic & Invalid-Action Masking
    # -------------------------------------------------------------------------
    try:
        ac = student_lab.CoCActorCritic(in_channels=8).to(device)
        B = 4
        dummy_obs = torch.rand(B, 8, 50, 50, device=device)

        # Construct strict action mask where ONLY slot_type=1 (Troop), slot_idx=2, and tile=1234 are valid
        slot_type_mask = torch.zeros(B, 7, dtype=torch.bool, device=device)
        slot_type_mask[:, 1] = True  # Note: NoOp(0) is also allowed as fallback, so force action check via probs

        slot_idx_mask = torch.zeros(B, 7, 10, dtype=torch.bool, device=device)
        slot_idx_mask[:, :, 0] = True
        slot_idx_mask[:, 1, 0] = False
        slot_idx_mask[:, 1, 2] = True  # Only slot_idx=2 valid when slot_type=1

        tile_mask = torch.zeros(B, 2500, dtype=torch.bool, device=device)
        tile_mask[:, 1234] = True  # Only tile 1234 (x=34, y=24) is outside red zone

        masks = {
            "slot_type": slot_type_mask,
            "slot_idx": slot_idx_mask,
            "tile": tile_mask,
        }

        forced_action = torch.tensor([[1, 2, 34, 24]] * B, dtype=torch.long, device=device)
        out_action, log_prob, entropy, value, diag = ac.get_action_and_value(
            dummy_obs, masks=masks, action=forced_action
        )

        assert out_action.shape == (B, 4), f"Expected action shape ({B}, 4), got {tuple(out_action.shape)}"
        assert log_prob.shape == (B,), f"Expected log_prob shape ({B},), got {tuple(log_prob.shape)}"
        assert value.shape == (B,), f"Expected value shape ({B},), got {tuple(value.shape)}"

        # Verify red-zone tiles have ~0 probability when deploying a troop (slot_type=1)
        heatmap_flat = diag["tile_heatmap"].reshape(B, 2500)
        valid_tile_prob = heatmap_flat[:, 1234].mean().item()
        assert valid_tile_prob > 0.99, (
            f"Red-zone masking failed: expected valid tile #1234 to have prob ~1.0, got {valid_tile_prob:.4f}"
        )

        valid_idx_prob = diag["slot_idx_probs"][:, 2].mean().item()
        assert valid_idx_prob > 0.99, (
            f"Slot index masking failed: expected valid slot_idx=2 to have prob ~1.0, got {valid_idx_prob:.4f}"
        )

        total_params = sum(p.numel() for p in ac.parameters())
        labs_report.append({
            "id": "lab2",
            "title": "Lab 2: Factorized Actor-Critic & Action Masking",
            "passed": True,
            "details": f"Action masking & log-probs verified (masked tile prob={valid_tile_prob:.4f}, {total_params:,} total params)",
        })
    except Exception as e:
        labs_report.append({
            "id": "lab2",
            "title": "Lab 2: Factorized Actor-Critic & Action Masking",
            "passed": False,
            "details": f"{type(e).__name__}: {e}",
            "traceback": traceback.format_exc(),
        })

    # -------------------------------------------------------------------------
    # Check Lab 3: Reward Shaping & GAE(gamma, lambda)
    # -------------------------------------------------------------------------
    try:
        r_progress = student_lab.compute_custom_reward({
            "delta_damage_ratio": 0.10,
            "delta_pct": 10,
            "delta_stars": 1,
            "th_just_destroyed": True,
            "stars": 1,
            "time_remaining_ratio": 0.5,
            "invalid_action": False,
        })
        r_idle = student_lab.compute_custom_reward({
            "delta_damage_ratio": 0.0,
            "delta_pct": 0,
            "delta_stars": 0,
            "th_just_destroyed": False,
            "stars": 0,
            "time_remaining_ratio": 0.5,
            "invalid_action": True,
        })
        assert r_progress > 1.0, f"Expected positive reward for TH18 destruction & star, got {r_progress}"
        assert r_idle <= 0.0, f"Expected <= 0 reward for idle/invalid step, got {r_idle}"

        rewards = torch.tensor([1.0, 2.0, 3.0], device=device)
        values = torch.tensor([0.5, 1.0, 1.5], device=device)
        dones = torch.tensor([0.0, 0.0, 1.0], device=device)
        next_val = torch.tensor(2.0, device=device)

        adv, ret = student_lab.compute_gae(rewards, values, dones, next_val, gamma=0.99, gae_lambda=0.95)
        assert adv.shape == (3,) and ret.shape == (3,), "GAE outputs must have shape (T,)"
        # At t=2, done=1.0 -> delta_2 = r_2 - V(s_2) = 3.0 - 1.5 = 1.5
        assert torch.isclose(adv[2], torch.tensor(1.5, device=device), atol=1e-4), (
            f"Terminal step advantage should be r_2 - V(s_2) = 1.5, got {adv[2].item():.4f}"
        )
        assert torch.allclose(ret, adv + values, atol=1e-4), "Returns must equal advantages + values"

        labs_report.append({
            "id": "lab3",
            "title": "Lab 3: Reward Shaping & GAE(γ, λ) Advantage Math",
            "passed": True,
            "details": f"Reward shaping (TH star={r_progress:+.2f}, invalid={r_idle:+.2f}) & GAE terminal boundary verified",
        })
    except Exception as e:
        labs_report.append({
            "id": "lab3",
            "title": "Lab 3: Reward Shaping & GAE(γ, λ) Advantage Math",
            "passed": False,
            "details": f"{type(e).__name__}: {e}",
            "traceback": traceback.format_exc(),
        })

    # -------------------------------------------------------------------------
    # Check Lab 4: Clipped PPO Update Step on GPU
    # -------------------------------------------------------------------------
    try:
        ac = student_lab.CoCActorCritic(in_channels=8).to(device)
        optimizer = torch.optim.Adam(ac.parameters(), lr=3e-4)

        B = 8
        obs_b = torch.rand(B, 8, 50, 50, device=device)
        with torch.no_grad():
            actions_b, old_logprobs_b, _, values_b, _ = ac.get_action_and_value(obs_b)

        advantages_b = torch.randn(B, device=device)
        returns_b = values_b + advantages_b

        # Snapshot initial parameter to verify weights actually change
        first_param_before = next(ac.parameters()).detach().clone()

        metrics = student_lab.ppo_update_step(
            model=ac,
            optimizer=optimizer,
            obs_b=obs_b,
            actions_b=actions_b,
            old_logprobs_b=old_logprobs_b,
            advantages_b=advantages_b,
            returns_b=returns_b,
            clip_coef=0.2,
        )

        first_param_after = next(ac.parameters()).detach().clone()
        weight_delta = (first_param_after - first_param_before).abs().max().item()
        assert weight_delta > 0.0, "Model parameters did not update during ppo_update_step!"
        for key in ("policy_loss", "value_loss", "entropy"):
            assert key in metrics, f"Missing '{key}' in returned metrics dictionary"

        labs_report.append({
            "id": "lab4",
            "title": "Lab 4: Clipped PPO Update & GPU Backpropagation",
            "passed": True,
            "details": (
                f"GPU backward pass verified (π_loss={metrics['policy_loss']:.4f}, "
                f"V_loss={metrics['value_loss']:.4f}, H={metrics['entropy']:.2f}, max|Δw|={weight_delta:.2e})"
            ),
        })
    except Exception as e:
        labs_report.append({
            "id": "lab4",
            "title": "Lab 4: Clipped PPO Update & GPU Backpropagation",
            "passed": False,
            "details": f"{type(e).__name__}: {e}",
            "traceback": traceback.format_exc(),
        })

    all_passed = all(item["passed"] for item in labs_report)
    if verbose:
        print(f"=== CoC TH18 PyTorch Lab Verification ({device_name}) ===")
        for item in labs_report:
            badge = "✅ PASS" if item["passed"] else "❌ FAIL"
            print(f"  {badge} | {item['title']}\n         -> {item['details']}")

    return {
        "all_passed": all_passed,
        "device": device.type,
        "device_name": device_name,
        "cuda_available": torch.cuda.is_available(),
        "torch_version": torch.__version__,
        "labs": labs_report,
    }


if __name__ == "__main__":
    res = run_all_verifications(verbose=True)
    sys.exit(0 if res["all_passed"] else 1)
