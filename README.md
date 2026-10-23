# CoC-AI

A personal project where I'm learning PyTorch and Deep Reinforcement Learning (RL) by building an AI that attacks bases in Clash of Clans.

## Why this project?

Standard beginner ML tutorials usually start with MNIST digits or CartPole. They work, but they get boring fast.

I wanted something more complex to sink my teeth into: a real game with a 2D map, unit pathfinding, cooldowns, and tactical choices (like funneling troops, timing spells, and sequencing hero abilities). Clash of Clans fits really well because every attack is essentially a planning puzzle:
* What troop or spell should I drop?
* Where on the 50x50 map should I put it?
* When is the right time to trigger an ability?

I'm also treating this as an experiment in learning *with* AI. I use coding assistants as tutors to bounce ideas off of, help write verification tests, and debug PyTorch tensor issues when shapes don't match up.

## What I'm learning here

* **PyTorch basics**: Writing tensor operations, autograd loops, and running models on my GPU.
* **Spatial encoders (CNNs)**: Turning the 50x50 village grid into feature maps so the network can "see" wall compartments, defensive threat zones, and open deployment areas.
* **Actor-Critic & PPO**: Using Proximal Policy Optimization to update the model based on attack results (damage percentage, Town Hall takedowns, and star count).
* **Action masking**: Forcing the policy to only pick legal actions, like keeping ground troops outside the red zone and blocking already-used hero equipment.
* **Fast simulation**: RL needs a lot of rollouts to learn anything useful. The combat simulator is written in Rust so it can run thousands of battle ticks per second before sending state into Python.

## Structure

* `python/pytorch_bootcamp/`: Small warmup exercises covering pure PyTorch (tensors, linear layers, conv nets, autograd).
* `python/labs/`: Guided labs building up the actual RL pipeline:
  1. `student_lab.py`: CNN backbone, actor-critic heads, reward shaping, and the PPO training step.
  2. `reference_solution.py`: Reference code to check against when stuck.
  3. `verify_labs.py`: Test script checking tensor shapes and gradient flow on CUDA.
* `crates/`: The game simulator written in Rust (`coc-engine`) with Python bindings (`coc-py`) and WebAssembly export (`coc-wasm`).
* `web/`: A small Vite/React canvas app to inspect village layouts and watch battles visually.

## Quickstart

### 1. Verify the PyTorch exercises

```bash
# Test the basic PyTorch exercises
python python/pytorch_bootcamp/verify_bootcamp.py

# Check the RL lab implementations
python python/verify_labs.py
```

### 2. Run a short training loop

```bash
python python/train_ai.py --train-ppo --episodes 20
```

### 3. Run the visual sandbox

```bash
# Start the Python API
python python/server.py

# In another terminal, start the UI
cd web
npm install
npm run dev
```

Then open `http://localhost:5173`.

## Disclaimer

This is an independent educational project. Clash of Clans and its game assets belong to Supercell.
