#!/usr/bin/env python3
"""
Clash of Clans TH18 — Attacker Deep RL (PyTorch PPO) & Defender Base Evolution Trainer
"""
import argparse
import json
import os
import random
import time
from typing import Any, Callable, Dict, List, Optional

import numpy as np
import torch

import coc_py
from coc_rl import (
    CoCActorCritic,
    CoCAttackerEnv,
    CoCDefenderEvolution,
    compute_custom_reward,
    compute_gae,
    ensure_architecture_diagrams,
    ppo_update_step,
)

CHECKPOINT_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "checkpoints")
DEFAULT_CKPT_PATH = os.path.join(CHECKPOINT_DIR, "latest_attacker.pt")


def masks_np_to_torch(
    masks_np: Dict[str, np.ndarray], device: torch.device, prevent_early_noop: bool = False
) -> Dict[str, torch.Tensor]:
    slot_type = torch.as_tensor(masks_np["slot_type"], dtype=torch.bool, device=device).unsqueeze(0)
    slot_idx = torch.as_tensor(masks_np["slot_idx"], dtype=torch.bool, device=device).unsqueeze(0)
    tile = torch.as_tensor(masks_np["tile"], dtype=torch.bool, device=device).unsqueeze(0)

    if prevent_early_noop and slot_type[0, 1:].any():
        slot_type = slot_type.clone()
        slot_type[0, 0] = False

    return {
        "slot_type": slot_type,
        "slot_idx": slot_idx,
        "tile": tile,
    }


def train_pytorch_ppo(
    episodes: int = 25,
    ticks_per_step: int = 8,
    max_steps_per_ep: int = 120,
    lr: float = 3e-4,
    gamma: float = 0.99,
    gae_lambda: float = 0.95,
    clip_coef: float = 0.2,
    ent_coef: float = 0.01,
    ppo_epochs: int = 4,
    use_reference: bool = False,
    curriculum_deploy: bool = True,
    layout_json: Optional[str] = None,
    army_json: Optional[str] = None,
    on_episode_callback: Optional[Callable[[Dict[str, Any]], bool]] = None,
) -> Dict[str, Any]:
    os.makedirs(CHECKPOINT_DIR, exist_ok=True)
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")

    env = CoCAttackerEnv(
        layout_json=layout_json,
        army_json=army_json,
        ticks_per_step=ticks_per_step,
    )
    model = CoCActorCritic(in_channels=8).to(device)
    ensure_architecture_diagrams(model)
    if os.path.exists(DEFAULT_CKPT_PATH):
        try:
            ckpt = torch.load(DEFAULT_CKPT_PATH, map_location=device, weights_only=False)
            if "model_state_dict" in ckpt:
                model.load_state_dict(ckpt["model_state_dict"], strict=False)
        except Exception:
            pass

    optimizer = torch.optim.Adam(model.parameters(), lr=lr)

    history: List[Dict[str, Any]] = []
    best_pct = 0
    best_stars = 0
    best_reward = -1e9

    for ep in range(1, episodes + 1):
        t0 = time.perf_counter()
        obs_np, info = env.reset()

        obs_list: List[torch.Tensor] = []
        actions_list: List[torch.Tensor] = []
        logprobs_list: List[torch.Tensor] = []
        values_list: List[torch.Tensor] = []
        rewards_list: List[float] = []
        dones_list: List[float] = []
        mask_type_list: List[torch.Tensor] = []
        mask_idx_list: List[torch.Tensor] = []
        mask_tile_list: List[torch.Tensor] = []

        ep_custom_reward = 0.0
        steps_run = 0

        for step_i in range(max_steps_per_ep):
            obs_t = torch.as_tensor(obs_np, dtype=torch.float32, device=device).unsqueeze(0)
            # Curriculum: encourage active deployments in the first 45 steps while troops/heroes remain
            prevent_noop = curriculum_deploy and (step_i < 45)
            masks_t = masks_np_to_torch(info["action_masks"], device, prevent_early_noop=prevent_noop)

            with torch.no_grad():
                action_t, logprob_t, _, value_t, _ = model.get_action_and_value(
                    obs_t, masks=masks_t
                )

            action_np = action_t.squeeze(0).cpu().numpy()
            next_obs_np, _engine_rew, terminated, truncated, next_info = env.step(action_np)
            done = bool(terminated or truncated)

            custom_r = compute_custom_reward(next_info)
            ep_custom_reward += custom_r
            steps_run += 1

            obs_list.append(obs_t.squeeze(0))
            actions_list.append(action_t.squeeze(0))
            logprobs_list.append(logprob_t.squeeze(0))
            values_list.append(value_t.squeeze(0))
            rewards_list.append(custom_r)
            dones_list.append(1.0 if done else 0.0)
            mask_type_list.append(masks_t["slot_type"].squeeze(0))
            mask_idx_list.append(masks_t["slot_idx"].squeeze(0))
            mask_tile_list.append(masks_t["tile"].squeeze(0))

            obs_np = next_obs_np
            info = next_info
            if done:
                break

        with torch.no_grad():
            next_obs_t = torch.as_tensor(obs_np, dtype=torch.float32, device=device).unsqueeze(0)
            _, _, _, next_val_t, _ = model.get_action_and_value(next_obs_t)

        rewards_t = torch.tensor(rewards_list, dtype=torch.float32, device=device)
        values_t = torch.stack(values_list)
        dones_t = torch.tensor(dones_list, dtype=torch.float32, device=device)

        advantages_t, returns_t = compute_gae(
            rewards=rewards_t,
            values=values_t,
            dones=dones_t,
            next_value=next_val_t.squeeze(0),
            gamma=gamma,
            gae_lambda=gae_lambda,
        )

        obs_b = torch.stack(obs_list)
        actions_b = torch.stack(actions_list)
        old_logprobs_b = torch.stack(logprobs_list)
        masks_b = {
            "slot_type": torch.stack(mask_type_list),
            "slot_idx": torch.stack(mask_idx_list),
            "tile": torch.stack(mask_tile_list),
        }

        last_metrics = {
            "policy_loss": 0.0,
            "value_loss": 0.0,
            "entropy": 0.0,
            "approx_kl": 0.0,
            "clip_fraction": 0.0,
        }
        for _ in range(ppo_epochs):
            last_metrics = ppo_update_step(
                model=model,
                optimizer=optimizer,
                obs_b=obs_b,
                actions_b=actions_b,
                old_logprobs_b=old_logprobs_b,
                advantages_b=advantages_t,
                returns_b=returns_t,
                masks_b=masks_b,
                clip_coef=clip_coef,
                ent_coef=ent_coef,
            )

        elapsed = max(1e-6, time.perf_counter() - t0)
        sim_ticks = info.get("tick", steps_run * ticks_per_step)
        fps_ticks = sim_ticks / elapsed
        pct = int(info["destruction_pct"])
        stars = int(info["stars"])

        if pct > best_pct or (pct == best_pct and ep_custom_reward > best_reward):
            best_pct = max(best_pct, pct)
            best_stars = max(best_stars, stars)
            best_reward = max(best_reward, ep_custom_reward)
            torch.save(
                {
                    "model_state_dict": model.state_dict(),
                    "episode": ep,
                    "best_pct": best_pct,
                    "best_stars": best_stars,
                    "best_reward": best_reward,
                    "use_reference": use_reference,
                },
                DEFAULT_CKPT_PATH,
            )

        recent_rewards = [h["reward"] for h in history[-9:]] + [ep_custom_reward]
        avg_reward_10 = float(np.mean(recent_rewards))

        ep_record = {
            "episode": ep,
            "total_episodes": episodes,
            "reward": round(float(ep_custom_reward), 3),
            "avg_reward_10": round(avg_reward_10, 3),
            "destruction_pct": pct,
            "stars": stars,
            "best_pct": best_pct,
            "best_stars": best_stars,
            "policy_loss": round(last_metrics["policy_loss"], 4),
            "value_loss": round(last_metrics["value_loss"], 4),
            "entropy": round(last_metrics["entropy"], 3),
            "approx_kl": round(last_metrics.get("approx_kl", 0.0), 4),
            "fps_ticks": round(fps_ticks, 0),
            "steps": steps_run,
        }
        history.append(ep_record)

        if on_episode_callback is not None:
            should_continue = on_episode_callback(ep_record)
            if not should_continue:
                break

    # Always save latest weights at end of run
    torch.save(
        {
            "model_state_dict": model.state_dict(),
            "episode": len(history),
            "best_pct": best_pct,
            "best_stars": best_stars,
            "best_reward": best_reward,
            "use_reference": use_reference,
        },
        DEFAULT_CKPT_PATH,
    )
    return {
        "history": history,
        "best_pct": best_pct,
        "best_stars": best_stars,
        "checkpoint_path": DEFAULT_CKPT_PATH,
    }


def run_attacker_benchmark() -> None:
    print("=== 1. Attacker Gymnasium RL Environment Benchmark ===")
    env = CoCAttackerEnv(ticks_per_step=5)
    obs, info = env.reset()
    valid_tiles = env.valid_deploy_tiles()
    print(f"Observation tensor shape: {obs.shape} (dtype={obs.dtype})")
    print(f"Valid deployment tiles outside village red-zone: {len(valid_tiles)} / 2500")

    t0 = time.perf_counter()
    total_steps = 0
    total_reward = 0.0

    west_breach_tiles = [(x, y) for (x, y) in valid_tiles if x == 1 and 17 <= y <= 31]
    for step_idx in range(360):
        tx, ty = random.choice(west_breach_tiles)
        if step_idx < 36:
            slot_type = 1
            action = np.array([slot_type, step_idx % 6, tx, ty], dtype=np.int64)
        elif 36 <= step_idx < 40:
            action = np.array([2, step_idx - 36, 1, 21 + (step_idx - 36) * 2], dtype=np.int64)
        elif step_idx == 40:
            action = np.array([4, 0, 1, 24], dtype=np.int64)
        elif step_idx in (48, 60, 75, 90, 105, 120):
            action = np.array([6, (step_idx // 15) % 4, 21, 24], dtype=np.int64)
        elif step_idx in (65, 66, 67, 68):
            action = np.array([3, step_idx - 65, 24, 24], dtype=np.int64)
        else:
            action = np.array([0, 0, 0, 0], dtype=np.int64)

        obs, reward, terminated, truncated, info = env.step(action)
        total_reward += reward
        total_steps += 1
        if terminated or truncated:
            break

    elapsed = time.perf_counter() - t0
    sim_ticks = total_steps * env.ticks_per_step
    print(
        f"Completed Episode in {elapsed * 1000:.2f} ms "
        f"({sim_ticks / elapsed:,.0f} sim ticks/sec)"
    )
    print(
        f"Result -> Destruction: {info['destruction_pct']}% | "
        f"Stars: {info['stars']}★ | Total Dense Reward: {total_reward:.2f}\n"
    )


def run_defender_evolution() -> None:
    print("=== 2. Defender Base-Layout Evolution (Rayon Multi-Core) ===")
    evolver = CoCDefenderEvolution()
    population = [evolver.base_layout] + [
        evolver.mutate_layout(evolver.base_layout, num_swaps=6) for _ in range(11)
    ]

    t0 = time.perf_counter()
    for gen in range(1, 4):
        population, ranked_scores = evolver.evolve_generation(population, elite_k=4)
        best_pct, best_stars, best_fitness = ranked_scores[0]
        print(
            f"Generation {gen} | Best Village Defense -> "
            f"Avg Attacker Destruction: {best_pct}% | Avg Stars Allowed: {best_stars}★ | "
            f"Defense Fitness: {best_fitness:.1f}"
        )

    elapsed = time.perf_counter() - t0
    print(f"Evaluated 3 generations × 12 layouts × 3 meta armies = 108 full TH18 battles in {elapsed:.2f}s")

    val = json.loads(coc_py.validate_layout_json(json.dumps(population[0])))
    print(
        f"Best Evolved Layout Validation: is_valid={val['is_valid']} "
        f"(Buildings={val['total_buildings']}, Walls={val['total_walls']}/325, Traps={val['total_traps']}/48)"
    )


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="CoC TH18 AI Trainer & Benchmark")
    parser.add_argument("--train-ppo", action="store_true", help="Run PyTorch GPU PPO training loop")
    parser.add_argument("--episodes", type=int, default=15, help="Number of PPO training episodes")
    parser.add_argument("--lr", type=float, default=3e-4, help="Learning rate")
    parser.add_argument("--use-reference", action="store_true", help="Use reference_solution.py instead of student_lab.py")
    args = parser.parse_args()

    if args.train_ppo:
        device_str = torch.cuda.get_device_name(0) if torch.cuda.is_available() else "CPU"
        print(f"=== Training CoCActorCritic with PyTorch PPO on {device_str} ===")
        def log_ep(rec: Dict[str, Any]) -> bool:
            print(
                f"Ep {rec['episode']:02d}/{rec['total_episodes']:02d} | "
                f"Reward: {rec['reward']:+6.2f} (Avg10: {rec['avg_reward_10']:+6.2f}) | "
                f"Destruction: {rec['destruction_pct']:3d}% ({rec['stars']}★) | "
                f"π_loss: {rec['policy_loss']:+.4f} V_loss: {rec['value_loss']:.4f} H: {rec['entropy']:.2f} | "
                f"{rec['fps_ticks']:.0f} ticks/s"
            )
            return True

        train_pytorch_ppo(
            episodes=args.episodes,
            lr=args.lr,
            use_reference=args.use_reference,
            on_episode_callback=log_ep,
        )
    else:
        run_attacker_benchmark()
        run_defender_evolution()
