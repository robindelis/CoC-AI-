#!/usr/bin/env python3
"""
Verifier and Interactive Runner for the 6-Module PyTorch From-Scratch Bootcamp.
"""

import importlib
import os
import sys
import traceback
from typing import Any, Dict, List

import torch

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from pytorch_bootcamp import bootcamp_exercises, bootcamp_solutions


def verify_all_bootcamp_modules(use_solutions: bool = False, verbose: bool = False) -> Dict[str, Any]:
    if not use_solutions:
        importlib.reload(bootcamp_exercises)
    mod = bootcamp_solutions if use_solutions else bootcamp_exercises
    prefix = "sol_" if use_solutions else ""

    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    device_name = torch.cuda.get_device_name(0) if torch.cuda.is_available() else "CPU"

    results: List[Dict[str, Any]] = []

    # -------------------------------------------------------------------------
    # Module 1: Tensors, Shapes, Reshaping & GPU Acceleration
    # -------------------------------------------------------------------------
    try:
        fn1 = getattr(mod, f"{prefix}module1_tensors_and_gpu")
        out1 = fn1(device)
        assert out1["x"] is not None, "Step 1 (`x`) is still None! Replace None with `torch.arange(12, dtype=torch.float32, device=device)`."
        assert out1["x"].shape == (12,), f"Expected `x` to have shape (12,), got {tuple(out1['x'].shape)}"
        assert out1["x"].device.type == device.type, f"Expected `x` on {device.type}, got {out1['x'].device.type}"

        assert out1["batch_matrices"] is not None, "Step 2 (`batch_matrices`) is still None! Use `x.reshape(3, 2, 2)`."
        assert out1["batch_matrices"].shape == (3, 2, 2), f"Expected shape (3, 2, 2), got {tuple(out1['batch_matrices'].shape)}"

        assert out1["transformed"] is not None, "Step 3 (`transformed`) is still None! Use `batch_matrices * 2.0 + 1.0`."
        expected_trans = out1["batch_matrices"] * 2.0 + 1.0
        assert torch.allclose(out1["transformed"], expected_trans), "Step 3 values do not match `batch_matrices * 2.0 + 1.0`."

        assert out1["batch_means"] is not None, "Step 4 (`batch_means`) is still None! Use `transformed.mean(dim=(1, 2))`."
        assert out1["batch_means"].shape == (3,), f"Expected `batch_means` shape (3,), got {tuple(out1['batch_means'].shape)}"
        expected_means = torch.tensor([4.0, 12.0, 20.0], device=device)
        assert torch.allclose(out1["batch_means"], expected_means), f"Expected means [4.0, 12.0, 20.0], got {out1['batch_means'].tolist()}"

        results.append({
            "id": "mod1",
            "number": "Module 1",
            "title": "Tensors, Shapes & GPU Acceleration",
            "passed": True,
            "summary": f"Created (12,) -> reshaped to (3, 2, 2) on {device.type.upper()} • Batch means = {out1['batch_means'].tolist()}",
            "output_preview": (
                f"x.device = {out1['x'].device}\n"
                f"batch_matrices.shape = {tuple(out1['batch_matrices'].shape)}\n"
                f"batch_means = {out1['batch_means'].tolist()} (expected [4.0, 12.0, 20.0])"
            ),
        })
    except Exception as e:
        results.append({
            "id": "mod1",
            "number": "Module 1",
            "title": "Tensors, Shapes & GPU Acceleration",
            "passed": False,
            "summary": str(e),
            "output_preview": traceback.format_exc(),
        })

    # -------------------------------------------------------------------------
    # Module 2: Autograd & Automatic Differentiation
    # -------------------------------------------------------------------------
    try:
        fn2 = getattr(mod, f"{prefix}module2_autograd_parabola")
        out2 = fn2()
        w_val = out2["learned_w"]
        b_val = out2["learned_b"]
        assert abs(w_val - 3.0) < 0.05 and abs(b_val - 2.0) < 0.05, (
            f"Expected learned parameters w ≈ 3.0, b ≈ 2.0, but got w={w_val}, b={b_val}. "
            "Did you call `loss.backward()`, update `w -= lr * w.grad` and `b -= lr * b.grad` inside `with torch.no_grad():`, and zero out `.grad`?"
        )
        results.append({
            "id": "mod2",
            "number": "Module 2",
            "title": "Autograd & Automatic Differentiation (.backward())",
            "passed": True,
            "summary": f"Converged to w={w_val:.3f} (target 3.0), b={b_val:.3f} (target 2.0) • Loss: {out2['initial_loss']:.2f} → {out2['final_loss']:.6f}",
            "output_preview": (
                f"Initial MSE Loss: {out2['initial_loss']}\n"
                f"Final MSE Loss:   {out2['final_loss']}\n"
                f"Learned Line:     y = {w_val} * x + {b_val}  (True hidden formula: y = 3.0 * x + 2.0)"
            ),
        })
    except Exception as e:
        results.append({
            "id": "mod2",
            "number": "Module 2",
            "title": "Autograd & Automatic Differentiation (.backward())",
            "passed": False,
            "summary": str(e),
            "output_preview": traceback.format_exc(),
        })

    # -------------------------------------------------------------------------
    # Module 3: Neural Networks (`nn.Module`) & `torch.optim.Adam`
    # -------------------------------------------------------------------------
    try:
        fn3 = getattr(mod, f"{prefix}module3_train_mlp")
        out3 = fn3(device)
        assert out3["final_loss"] < 0.15, (
            f"Expected final MLP loss < 0.15 after 120 Adam steps, got {out3['final_loss']}. "
            "Check your 5-line training loop!"
        )
        results.append({
            "id": "mod3",
            "number": "Module 3",
            "title": "Building Neural Nets (`nn.Module` & `torch.optim`)",
            "passed": True,
            "summary": f"Trained {out3['param_count']:,}-param MLP on {device.type.upper()} • Loss dropped {out3['initial_loss']:.3f} → {out3['final_loss']:.4f}",
            "output_preview": (
                f"MLP Parameters: {out3['param_count']}\n"
                f"Step 0 Loss:    {out3['initial_loss']}\n"
                f"Step 120 Loss:  {out3['final_loss']}"
            ),
        })
    except Exception as e:
        results.append({
            "id": "mod3",
            "number": "Module 3",
            "title": "Building Neural Nets (`nn.Module` & `torch.optim`)",
            "passed": False,
            "summary": str(e),
            "output_preview": traceback.format_exc(),
        })

    # -------------------------------------------------------------------------
    # Module 4: 2D Convolutions (`nn.Conv2d`) & Spatial Heatmaps
    # -------------------------------------------------------------------------
    try:
        cls4 = getattr(mod, "SolMiniGridCNN" if use_solutions else "MiniGridCNN")
        cnn = cls4().to(device)
        dummy_grid = torch.randn(4, 3, 8, 8, device=device)
        heatmap_logits, global_summary = cnn(dummy_grid)
        assert heatmap_logits is not None, "`heatmap_logits` is still None! Pass `feat` through `self.heatmap_head` and `.reshape(B, 64)`."
        assert global_summary is not None, "`global_summary` is still None! Pass `feat` through `self.global_head`."
        assert heatmap_logits.shape == (4, 64), f"Expected heatmap_logits shape (4, 64), got {tuple(heatmap_logits.shape)}"
        assert global_summary.shape == (4, 16), f"Expected global_summary shape (4, 16), got {tuple(global_summary.shape)}"

        results.append({
            "id": "mod4",
            "number": "Module 4",
            "title": "2D Convolutions (`nn.Conv2d`) & Spatial Heatmaps",
            "passed": True,
            "summary": f"8×8 Grid CNN verified: heatmap_logits=(4, 64), global_summary=(4, 16)",
            "output_preview": (
                f"Input Grid Shape:      (4, 3, 8, 8)\n"
                f"Heatmap Logits Shape:  {tuple(heatmap_logits.shape)} (64 cells of the 8×8 board)\n"
                f"Global Summary Shape:  {tuple(global_summary.shape)}"
            ),
        })
    except Exception as e:
        results.append({
            "id": "mod4",
            "number": "Module 4",
            "title": "2D Convolutions (`nn.Conv2d`) & Spatial Heatmaps",
            "passed": False,
            "summary": str(e),
            "output_preview": traceback.format_exc(),
        })

    # -------------------------------------------------------------------------
    # Module 5: `Categorical` Distributions & Invalid-Action Masking
    # -------------------------------------------------------------------------
    try:
        fn5 = getattr(mod, f"{prefix}module5_masked_categorical")
        out5 = fn5()
        probs = out5["probs"]
        assert probs is not None, "Step 1/2 (`probs`) is None! Mask `raw_logits` with `.masked_fill(~valid_mask, -1e8)` and pass to `Categorical(logits=...)`."
        assert probs[1].item() < 1e-6 and probs[3].item() < 1e-6, (
            f"Illegal actions 1 and 3 must have 0.0 probability after masking, got probs={probs.tolist()}"
        )
        assert out5["log_prob"] is not None and out5["entropy"] is not None, (
            "Compute `dist.log_prob(chosen_action)` and `dist.entropy()`!"
        )
        probs_rounded = [round(float(p), 4) for p in probs.tolist()]
        results.append({
            "id": "mod5",
            "number": "Module 5",
            "title": "`Categorical` Distributions & Action Masking",
            "passed": True,
            "summary": f"Masked probs = {probs_rounded} (illegal actions 1 & 3 forced to 0.0%)",
            "output_preview": (
                f"Raw Logits:    [1.0, 10.0 (ILLEGAL), 2.0, 8.0 (ILLEGAL), 0.5]\n"
                f"Masked Probs:  {probs_rounded}\n"
                f"log P(a=2):    {float(out5['log_prob'].item()):.4f}\n"
                f"Entropy H(π):  {float(out5['entropy'].item()):.4f} nats"
            ),
        })
    except Exception as e:
        results.append({
            "id": "mod5",
            "number": "Module 5",
            "title": "`Categorical` Distributions & Action Masking",
            "passed": False,
            "summary": str(e),
            "output_preview": traceback.format_exc(),
        })

    # -------------------------------------------------------------------------
    # Module 6: Mini Clipped-PPO Agent (5-Door Treasure Bandit)
    # -------------------------------------------------------------------------
    try:
        fn6 = getattr(mod, f"{prefix}module6_mini_ppo_step")
        out6 = fn6()
        assert out6["final_prob_treasure"] > 0.85, (
            f"Expected PPO agent to shift >85% probability onto Treasure Door #4, got {out6['final_prob_treasure']*100:.1f}%."
        )
        results.append({
            "id": "mod6",
            "number": "Module 6",
            "title": "Your First Mini Clipped-PPO RL Agent",
            "passed": True,
            "summary": (
                f"Treasure Door #4 probability rose {out6['init_prob_treasure']*100:.0f}% → "
                f"{out6['final_prob_treasure']*100:.1f}% • Critic V = {out6['learned_value']:+.2f}"
            ),
            "output_preview": (
                f"Initial P(Door 4): {out6['init_prob_treasure']*100:.1f}%\n"
                f"Final P(Door 4):   {out6['final_prob_treasure']*100:.2f}%\n"
                f"Critic Value V:    {out6['learned_value']:+.2f} (approaching +10.0 treasure)"
            ),
        })
    except Exception as e:
        results.append({
            "id": "mod6",
            "number": "Module 6",
            "title": "Your First Mini Clipped-PPO RL Agent",
            "passed": False,
            "summary": str(e),
            "output_preview": traceback.format_exc(),
        })

    passed_count = sum(1 for r in results if r["passed"])
    if verbose:
        print(f"=== PyTorch From-Scratch Bootcamp ({passed_count}/6 Completed on {device_name}) ===")
        for r in results:
            badge = "✅ PASS" if r["passed"] else "📝 TODO"
            print(f"  {badge} | {r['number']}: {r['title']}\n         -> {r['summary']}")

    return {
        "passed_count": passed_count,
        "total_count": 6,
        "all_passed": passed_count == 6,
        "device_name": device_name,
        "modules": results,
    }


if __name__ == "__main__":
    use_sol = "--solutions" in sys.argv
    verify_all_bootcamp_modules(use_solutions=use_sol, verbose=True)
