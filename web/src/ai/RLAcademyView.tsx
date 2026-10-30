import React, { useMemo, useState } from 'react';
import katex from 'katex';
import 'katex/dist/katex.min.css';

const TeX: React.FC<{
  math: string;
  block?: boolean;
  className?: string;
}> = ({ math, block = false, className = '' }) => {
  const html = useMemo(() => {
    try {
      return katex.renderToString(math, {
        displayMode: block,
        throwOnError: false,
        strict: false,
      });
    } catch {
      return math;
    }
  }, [math, block]);

  if (block) {
    return (
      <div
        className={`rl-katex-block ${className}`}
        dangerouslySetInnerHTML={{ __html: html }}
      />
    );
  }
  return (
    <span
      className={`rl-katex-inline ${className}`}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
};

const MathText: React.FC<{ text: string }> = ({ text }) => {
  const parts = useMemo(() => text.split(/(\$[^$]+\$)/g), [text]);
  return (
    <>
      {parts.map((part, idx) => {
        if (part.startsWith('$') && part.endsWith('$') && part.length > 2) {
          return <TeX key={idx} math={part.slice(1, -1)} />;
        }
        return <React.Fragment key={idx}>{part}</React.Fragment>;
      })}
    </>
  );
};

type ModuleId =
  | 'mdp_state'
  | 'action_space'
  | 'reward_design'
  | 'actor_critic_gae'
  | 'ppo_vs_vanilla'
  | 'code_and_exam';

interface LectureModuleMeta {
  id: ModuleId;
  number: string;
  shortTitle: string;
  fullTitle: string;
  subtitle: string;
  keySymbolsTex: string;
  sourceFile: string;
}

const LECTURE_MODULES: LectureModuleMeta[] = [
  {
    id: 'mdp_state',
    number: '01',
    shortTitle: 'State & Dual-Stream CNN',
    fullTitle: 'From Supervised CNNs to MDPs & Dual-Stream State Encoding',
    subtitle:
      'Why static classification fails in sequential combat, and how CoCSpatialEncoder preserves 50×50 tile geometry while compressing a 256-D global embedding.',
    keySymbolsTex: String.raw`s_t = (O_t, c_t),\; O_t \in [0,1]^{10\times 50\times 50}`,
    sourceFile: 'python/coc_rl/networks.py • crates/coc-engine/src/sim.rs',
  },
  {
    id: 'action_space',
    number: '02',
    shortTitle: 'Actions, Masking & Sampling',
    fullTitle: 'Factorized Autoregressive Actions, Logit Masking & Categorical Sampling',
    subtitle:
      'Compressing 175,000 joint actions into 2,517 conditional logits via the Chain Rule of Probability, Red-Zone masking, and conditional gradient gating.',
    keySymbolsTex: String.raw`\pi_\theta(a_t\mid s_t) = \pi(a_{\text{type}})\,\pi(a_{\text{idx}}\mid a_{\text{type}})^{u_{\text{idx}}}\,\pi(a_{x,y}\mid a_{\text{type}})^{u_{\text{tile}}}`,
    sourceFile: 'python/coc_rl/networks.py (CoCActorCritic.get_action_and_value)',
  },
  {
    id: 'reward_design',
    number: '03',
    shortTitle: 'Reward Engineering',
    fullTitle: 'Crafting the Reward Function: Potential Shaping vs. Sparse Returns',
    subtitle:
      'Solving the 1,800-tick temporal credit assignment dilemma with a 50/50 balanced telescoping reward that prevents reward hacking.',
    keySymbolsTex: String.raw`r_t = 0.50\,\Delta\text{Dest\%}_t + \tfrac{50}{3}\,\Delta\text{Stars}_t - 0.05\,\mathbb{I}[\text{invalid}]`,
    sourceFile: 'python/coc_rl/ppo.py (compute_custom_reward)',
  },
  {
    id: 'actor_critic_gae',
    number: '04',
    shortTitle: 'Actor-Critic & GAE(γ,λ)',
    fullTitle: 'Actor-Critic Architecture, TD Residuals & Generalized Advantage Estimation',
    subtitle:
      'How the Critic acts as a variance-reducing baseline and how GAE(γ=0.99, λ=0.95) bridges 1-step TD error and Monte Carlo returns.',
    keySymbolsTex: String.raw`\delta_t = r_t + \gamma V(s_{t+1}) - V(s_t),\; \hat{A}_t^{\text{GAE}} = \sum_{l=0}^{\infty} (\gamma\lambda)^l \delta_{t+l}`,
    sourceFile: 'python/coc_rl/ppo.py (compute_gae)',
  },
  {
    id: 'ppo_vs_vanilla',
    number: '05',
    shortTitle: 'PPO vs. Vanilla RL',
    fullTitle: 'Proximal Policy Optimization (PPO) vs. Vanilla Policy Gradient',
    subtitle:
      'Why standard policy gradients collapse during multi-epoch updates, and how PPO’s clipped importance-sampling surrogate enforces a trust region.',
    keySymbolsTex: String.raw`L^{\text{CLIP}}(\theta) = -\hat{\mathbb{E}}_t\!\left[\min\!\left(r_t(\theta)\hat{A}_t,\;\text{clip}(r_t(\theta), 1-\epsilon, 1+\epsilon)\hat{A}_t\right)\right]`,
    sourceFile: 'python/coc_rl/ppo.py (ppo_minibatch_update)',
  },
  {
    id: 'code_and_exam',
    number: '06',
    shortTitle: 'Code Trace & Mastery Quiz',
    fullTitle: 'End-to-End PPO Training Loop, PyTorch Code Trace & Graduate Self-Check',
    subtitle:
      'Tracing the complete rollout-to-update lifecycle of CoCActorCritic in PyTorch and testing mathematical mastery.',
    keySymbolsTex: String.raw`\mathcal{L}_{\text{total}} = L^{\text{CLIP}} + c_1 \mathcal{L}_{V} - c_2 \mathcal{H}(\pi_\theta),\; \text{KL}_{\text{approx}} \le 0.045`,
    sourceFile: 'python/coc_rl/envs.py • python/coc_rl/ppo.py',
  },
];

const SPATIAL_CHANNELS_SPEC = [
  {
    ch: 0,
    name: 'Building HP Ratio',
    normTex: String.raw`\text{HP}_{x,y} / 11000.0 \in [0, 1]`,
    role: 'Marks surviving structure footprints (3×3 defenses, 4×4 Town Hall, 2×2 huts) and their remaining durability.',
    color: '#22c55e',
  },
  {
    ch: 1,
    name: 'Defense DPS Threat',
    normTex: String.raw`\min(\text{DPS}_{x,y} / 750.0,\; 1.0)`,
    role: 'Encodes lethal kill-zones (Monolith, Single Inferno, Scattershot, Hot Candle, Firespitter).',
    color: '#ef4444',
  },
  {
    ch: 2,
    name: 'Town Hall 18 Core Mask',
    normTex: String.raw`\mathbb{I}[(x,y) \in \text{TH18}] \in \{0, 1\}`,
    role: 'Explicitly highlights the 4×4 Town Hall 18 objective required to secure the mandatory Victory Star.',
    color: '#facc15',
  },
  {
    ch: 3,
    name: 'Wall Integrity Ratio',
    normTex: String.raw`\text{HP}_{\text{wall}} / \text{HP}_{\text{wall,max}} \in [0, 1]`,
    role: 'Reveals closed compartments vs. breached wall segments for ground pathfinding.',
    color: '#6366f1',
  },
  {
    ch: 4,
    name: 'No-Deploy Red Zone Mask',
    normTex: String.raw`1.0 = \text{forbidden},\; 0.0 = \text{legal}`,
    role: 'Computed dynamically in Rust: every surviving building casts a 1-tile forbidden halo; shrinks as outer rings fall.',
    color: '#f87171',
  },
  {
    ch: 5,
    name: 'Thrower (Max 12)',
    normTex: String.raw`N_{\text{Thrower}}(x,y) / 12.0 \in [0, 1]`,
    role: 'Primary ranged siege artillery; cluster density of friendly Throwers.',
    color: '#0ea5e9',
  },
  {
    ch: 6,
    name: 'Healer (Max 5)',
    normTex: String.raw`N_{\text{Healer}}(x,y) / 5.0 \in [0, 1]`,
    role: 'Airborne sustain support; tracks healing pocket escorting main push.',
    color: '#ec4899',
  },
  {
    ch: 7,
    name: 'Furnace (Max 2)',
    normTex: String.raw`N_{\text{Furnace}}(x,y) / 2.0 \in [0, 1]`,
    role: 'Mobile siege spawner launching continuous suicidal Firemites.',
    color: '#f97316',
  },
  {
    ch: 8,
    name: 'Druid & Bear (Max 1)',
    normTex: String.raw`N_{\text{Druid}}(x,y) / 1.0 \in [0, 1]`,
    role: 'Support healer evolving into tanky Bear frontline brawler on demise.',
    color: '#10b981',
  },
  {
    ch: 9,
    name: 'Ice Golem (Max 1)',
    normTex: String.raw`N_{\text{IceGolem}}(x,y) / 1.0 \in [0, 1]`,
    role: 'Frontline freeze tank immobilizing nearby defenses upon death.',
    color: '#38bdf8',
  },
  {
    ch: 10,
    name: 'Super Wall Breaker (Max 1)',
    normTex: String.raw`N_{\text{SWB}}(x,y) / 1.0 \in [0, 1]`,
    role: 'Mega-bomb breach unit for high-value compartment entry.',
    color: '#eab308',
  },
  {
    ch: 11,
    name: 'Headhunter (Max 1)',
    normTex: String.raw`N_{\text{Headhunter}}(x,y) / 1.0 \in [0, 1]`,
    role: 'Specialist hero-assassin dealing quadruple damage to enemy heroes.',
    color: '#a855f7',
  },
  {
    ch: 12,
    name: 'Balloon (Max 1)',
    normTex: String.raw`N_{\text{Balloon}}(x,y) / 1.0 \in [0, 1]`,
    role: 'Targeted air defense-seeker / trap tester.',
    color: '#f43f5e',
  },
  {
    ch: 13,
    name: 'Archer (Max 4)',
    normTex: String.raw`N_{\text{Archer}}(x,y) / 4.0 \in [0, 1]`,
    role: 'Light perimeter clean-up squad sniping exposed corner trash.',
    color: '#ec4899',
  },
  {
    ch: 14,
    name: 'Log Launcher Siege (Max 1)',
    normTex: String.raw`\mathbb{I}[\text{LogLauncher} \in (x,y)] \in \{0, 1\}`,
    role: 'Rolling battering ram piercing through multiple layers of walls towards Town Hall.',
    color: '#d97706',
  },
  {
    ch: 15,
    name: 'CC Super Yeti (Max 1)',
    normTex: String.raw`\mathbb{I}[\text{SuperYeti} \in (x,y)] \in \{0, 1\}`,
    role: 'Heavy core melee tank released from popped Log Launcher with Heavy Yetimites.',
    color: '#06b6d4',
  },
  {
    ch: 16,
    name: 'CC Super Valkyrie (Max 1)',
    normTex: String.raw`\mathbb{I}[\text{SuperValkyrie} \in (x,y)] \in \{0, 1\}`,
    role: 'Whirlwind brawler dropping a lingering Rage Spell upon death in core.',
    color: '#fb7185',
  },
  {
    ch: 17,
    name: 'Barbarian King',
    normTex: String.raw`\mathbb{I}[\text{King} \in (x,y)] \in \{0, 1\}`,
    role: 'High-HP melee tank equipped with Spiky Ball & Snake Bracelet.',
    color: '#eab308',
  },
  {
    ch: 18,
    name: 'Archer Queen',
    normTex: String.raw`\mathbb{I}[\text{Queen} \in (x,y)] \in \{0, 1\}`,
    role: 'High-DPS ranged carry equipped with Magic Mirror & Action Figure.',
    color: '#c084fc',
  },
  {
    ch: 19,
    name: 'Grand Warden',
    normTex: String.raw`\mathbb{I}[\text{Warden} \in (x,y)] \in \{0, 1\}`,
    role: 'Support aura hero providing Eternal Tome invulnerability and Rage Gem damage boost.',
    color: '#60a5fa',
  },
  {
    ch: 20,
    name: 'Royal Champion',
    normTex: String.raw`\mathbb{I}[\text{RC} \in (x,y)] \in \{0, 1\}`,
    role: 'Target-seeking defense assassin equipped with Rocket Spear & Electro Boots.',
    color: '#34d399',
  },
  {
    ch: 21,
    name: 'Totem Spell (HP Ratio)',
    normTex: String.raw`\text{HP}_{\text{totem}} / \text{HP}_{\max} \in [0, 1]`,
    role: 'Summoned lightning totem unit absorbing defense fire and pulsing lightning chains.',
    color: '#a78bfa',
  },
  {
    ch: 22,
    name: 'Rage Spell (Fade AoE)',
    normTex: String.raw`\text{rem\_sec} / \text{total\_sec} \in [0, 1] \text{ across radius}`,
    role: 'Haste & damage acceleration ring fading continuously from 1.0 down to 0.0.',
    color: '#f43f5e',
  },
  {
    ch: 23,
    name: 'Poison Spell (Fade AoE)',
    normTex: String.raw`\text{rem\_sec} / \text{total\_sec} \in [0, 1] \text{ across radius}`,
    role: 'Defending CC troop deceleration and lethal poison mist zone.',
    color: '#e11d48',
  },
  {
    ch: 24,
    name: 'Skeleton Spell (Fade AoE)',
    normTex: String.raw`\text{rem\_sec} / \text{total\_sec} \in [0, 1] \text{ across radius}`,
    role: 'Continuous distraction summon ring creating friendly skeletons to distract single infernos.',
    color: '#94a3b8',
  },
  {
    ch: 25,
    name: 'Enemy CC & Guardian',
    normTex: String.raw`\min(N_{\text{def\_cc}} / 5.0,\; 1.0)`,
    role: 'Defending Clan Castle troops (Lava Hound, Ice Golem, Headhunters) and Town Hall 18 Guardian.',
    color: '#e11d48',
  },
  {
    ch: 26,
    name: 'Defending Barbarian King',
    normTex: String.raw`\mathbb{I}[\text{DefKing} \in (x,y)] \in \{0, 1\}`,
    role: 'High-HP defending melee tank on pedestal; draws friendly melee target focus into compartment.',
    color: '#eab308',
  },
  {
    ch: 27,
    name: 'Defending Archer Queen',
    normTex: String.raw`\mathbb{I}[\text{DefQueen} \in (x,y)] \in \{0, 1\}`,
    role: 'High-DPS defending ranged carry (700+ DPS); priority target for Headhunters and Poison.',
    color: '#c084fc',
  },
  {
    ch: 28,
    name: 'Defending Grand Warden',
    normTex: String.raw`\mathbb{I}[\text{DefWarden} \in (x,y)] \in \{0, 1\}`,
    role: 'Long-range defending support sniper (7.0t range) covering defense core.',
    color: '#60a5fa',
  },
  {
    ch: 29,
    name: 'Defending Royal Champion',
    normTex: String.raw`\mathbb{I}[\text{DefRC} \in (x,y)] \in \{0, 1\}`,
    role: 'High-mobility defending defense assassin leaping walls to intercept attackers.',
    color: '#34d399',
  },
  {
    ch: 30,
    name: 'Defending Minion Prince',
    normTex: String.raw`\mathbb{I}[\text{DefMinionPrince} \in (x,y)] \in \{0, 1\}`,
    role: 'Airborne defending hero sniping advancing ground troops.',
    color: '#a855f7',
  },
  {
    ch: 31,
    name: 'Defending Dragon Duke',
    normTex: String.raw`\mathbb{I}[\text{DefDragonDuke} \in (x,y)] \in \{0, 1\}`,
    role: 'Heavy aerial defending tank dealing continuous splash flame damage.',
    color: '#f97316',
  },
  {
    ch: 32,
    name: 'Enemy Ground Skeletons',
    normTex: String.raw`\min(N_{\text{g\_skel}} / 10.0,\; 1.0)`,
    role: 'Defending ground skeletons triggered from ground skeleton traps or defending witch.',
    color: '#cbd5e1',
  },
  {
    ch: 33,
    name: 'Enemy Air Skeletons',
    normTex: String.raw`\min(N_{\text{a\_skel}} / 10.0,\; 1.0)`,
    role: 'Defending air skeletons triggered from air skeleton traps targeting Balloons and Healers.',
    color: '#93c5fd',
  },
  {
    ch: 34,
    name: 'Archer Tower',
    normTex: String.raw`1.0 \text{ while active}`,
    role: 'Point defense targeting ground and air (10.0t range).',
    color: '#38bdf8',
  },
  {
    ch: 35,
    name: 'Multi-Archer Tower',
    normTex: String.raw`1.0 \text{ while active}`,
    role: 'Merged 3-target point defense (10.0t range, 363 DPS).',
    color: '#0ea5e9',
  },
  {
    ch: 36,
    name: 'Ricochet Cannon',
    normTex: String.raw`1.0 \text{ while active}`,
    role: 'Merged 2-target ground bounce defense (9.0t range, 396 DPS).',
    color: '#f97316',
  },
  {
    ch: 37,
    name: 'Cannon',
    normTex: String.raw`1.0 \text{ while active}`,
    role: 'Standard ground point defense (9.0t range, 235 DPS).',
    color: '#fb923c',
  },
  {
    ch: 38,
    name: 'Mortar',
    normTex: String.raw`1.0 \text{ while active}`,
    role: 'Long-range ground splash defense with 4–11t blind deadzone.',
    color: '#a855f7',
  },
  {
    ch: 39,
    name: 'Air Defense',
    normTex: String.raw`1.0 \text{ while active}`,
    role: 'Lethal anti-air rocket battery (10.0t range, 650 DPS).',
    color: '#ef4444',
  },
  {
    ch: 40,
    name: 'Wizard Tower',
    normTex: String.raw`1.0 \text{ while active}`,
    role: 'Ground and air area splash defense (7.0t range, 110 DPS).',
    color: '#c084fc',
  },
  {
    ch: 41,
    name: 'Super Wizard Tower',
    normTex: String.raw`1.0 \text{ while active}`,
    role: 'Merged chain-lightning defense hitting up to 15 targets (8.0t range).',
    color: '#8b5cf6',
  },
  {
    ch: 42,
    name: 'Air Sweeper (Dir)',
    normTex: String.raw`0.25 + 0.75 \cdot (\theta / 360^\circ)`,
    role: 'Continuous 105° pushback cone angle encoding.',
    color: '#22d3ee',
  },
  {
    ch: 43,
    name: 'Hidden Tesla (Revealed)',
    normTex: String.raw`1.0 \text{ once revealed, } 0.0 \text{ hidden}`,
    role: 'Hidden information barrier: strictly 0.0 until revealed.',
    color: '#fde047',
  },
  {
    ch: 44,
    name: 'Bomb Tower',
    normTex: String.raw`1.0 \text{ while active}`,
    role: 'Ground splash defense leaving a high-damage death bomb.',
    color: '#fb7185',
  },
  {
    ch: 45,
    name: 'X-Bow (Mode)',
    normTex: String.raw`1.0 = \text{Air+Ground},\; 0.5 = \text{Ground}`,
    role: 'Distinguishes 11.5t Air+Ground mode from 14.0t Ground-only mode.',
    color: '#e879f9',
  },
  {
    ch: 46,
    name: 'Inferno Tower (Mode)',
    normTex: String.raw`1.0 = \text{Single},\; 0.5 = \text{Multi}`,
    role: 'Distinguishes ramping single-target beam from 6-target multi mode.',
    color: '#f43f5e',
  },
  {
    ch: 47,
    name: 'Scattershot',
    normTex: String.raw`1.0 \text{ while active}`,
    role: 'Heavy splash defense with 90° blast cone behind target.',
    color: '#6366f1',
  },
  {
    ch: 48,
    name: "Builder's Hut",
    normTex: String.raw`1.0 \text{ while active}`,
    role: 'Weaponized turret with active repair builder healing damaged defenses.',
    color: '#4ade80',
  },
  {
    ch: 49,
    name: 'Spell Tower (Mode)',
    normTex: String.raw`0.25=\text{Rage},\; 0.50=\text{Poison},\; 0.75=\text{Invis},\; 1.0=\text{EQ}`,
    role: 'Encodes active defensive spell canister triggered on compartment breach.',
    color: '#a3e635',
  },
  {
    ch: 50,
    name: 'Monolith',
    normTex: String.raw`1.0 \text{ while active}`,
    role: 'Extreme-threat tank destroyer dealing flat DPS plus percentage of max HP.',
    color: '#9333ea',
  },
  {
    ch: 51,
    name: 'Multi-Gear Tower (Mode)',
    normTex: String.raw`1.0 = \text{Long Range},\; 0.5 = \text{Fast Attack}`,
    role: 'Distinguishes sniper mode from rapid-fire point mode.',
    color: '#f59e0b',
  },
  {
    ch: 52,
    name: 'Firespitter (Dir)',
    normTex: String.raw`0.25 + 0.75 \cdot (\theta / 360^\circ)`,
    role: 'Continuous 150° piercing fireball cone angle encoding.',
    color: '#ea580c',
  },
  {
    ch: 53,
    name: 'Revenge Tower',
    normTex: String.raw`1.0 \text{ while active}`,
    role: 'Escalating defense activating stage buffs as structures fall.',
    color: '#dc2626',
  },
  {
    ch: 54,
    name: 'Hot Candle (Crafted)',
    normTex: String.raw`1.0 \text{ while active}`,
    role: 'Season 4 Crafted Defense melting down through 6 -> 4 -> 3 flames.',
    color: '#fbbf24',
  },
  {
    ch: 55,
    name: 'Clan Castle (Defense)',
    normTex: String.raw`1.0 \text{ while active}`,
    role: 'Defensive Clan Castle garrison structure housing defending CC reinforcements.',
    color: '#d97706',
  },
  {
    ch: 56,
    name: 'Storages & Hero Hall',
    normTex: String.raw`\text{HP}_{x,y} / \text{HP}_{\max} \in [0, 1]`,
    role: 'High-HP non-offensive tanks (Gold, Elixir, Dark Elixir Storages, Hero Hall).',
    color: '#f59e0b',
  },
  {
    ch: 57,
    name: 'Resource Collectors',
    normTex: String.raw`\text{HP}_{x,y} / \text{HP}_{\max} \in [0, 1]`,
    role: 'Outer perimeter resource collection structures (Gold Mines, Collectors, Drills).',
    color: '#10b981',
  },
  {
    ch: 58,
    name: 'Utility & Other Buildings',
    normTex: String.raw`\text{HP}_{x,y} / \text{HP}_{\max} \in [0, 1]`,
    role: 'Remaining non-defensive village buildings (Army Camps, Barracks, Lab, Spell Factories, Blacksmith, etc.).',
    color: '#8b5cf6',
  },
];

interface ActionTypeSpec {
  id: number;
  name: string;
  usesIdx: boolean;
  usesFrac: boolean;
  usesTile: boolean;
  bypassesRedZone: boolean;
  desc: string;
}

const ACTION_TYPES_SPEC: ActionTypeSpec[] = [
  {
    id: 0,
    name: 'NoOp (Wait 8 Ticks)',
    usesIdx: false,
    usesFrac: false,
    usesTile: false,
    bypassesRedZone: false,
    desc: 'Hold reserves and let deployed units advance for 8 ticks (0.64s). Neither slot_idx, deploy_fraction, nor tile_xy is used.',
  },
  {
    id: 1,
    name: 'DeployTroop',
    usesIdx: true,
    usesFrac: true,
    usesTile: true,
    bypassesRedZone: false,
    desc: 'Selects troop slot_idx ∈ [0..9], fraction α ∈ [0, 1] (spawning max(1, round(α · N_avail)) units at once!), and legal tile (x,y).',
  },
  {
    id: 2,
    name: 'DeployHero',
    usesIdx: true,
    usesFrac: false,
    usesTile: true,
    bypassesRedZone: false,
    desc: 'Selects hero slot_idx ∈ [0..3] (King, Queen, Warden, Champion/Prince/Duke) and spawns at legal tile (x,y).',
  },
  {
    id: 3,
    name: 'TriggerHeroAbility',
    usesIdx: true,
    usesFrac: false,
    usesTile: false,
    bypassesRedZone: false,
    desc: 'Activates equipment ability for already-deployed hero slot_idx ∈ [0..3]. Tile head is masked out (u_tile = 0).',
  },
  {
    id: 4,
    name: 'DeploySiege',
    usesIdx: false,
    usesFrac: false,
    usesTile: true,
    bypassesRedZone: false,
    desc: 'Spawns the army Siege Machine (Log Launcher, Blimp, Flame Flinger) at legal tile (x,y). u_idx = 0.',
  },
  {
    id: 5,
    name: 'PopSiege',
    usesIdx: false,
    usesFrac: false,
    usesTile: false,
    bypassesRedZone: false,
    desc: 'Manually pops the active Siege Machine to release Clan Castle troops immediately. u_idx = 0, u_tile = 0.',
  },
  {
    id: 6,
    name: 'DropSpell',
    usesIdx: true,
    usesFrac: false,
    usesTile: true,
    bypassesRedZone: true,
    desc: 'Selects spell slot_idx ∈ [0..9] and drops it on ANY tile (x,y) ∈ 50×50 — bypasses the Red Zone mask!',
  },
];

interface BattleTimelineEvent {
  step: number;
  tick: number;
  title: string;
  actionDesc: string;
  prevPct: number;
  newPct: number;
  prevStars: number;
  newStars: number;
  invalid: boolean;
  note: string;
}

const TIMELINE_EVENTS: BattleTimelineEvent[] = [
  {
    step: 1,
    tick: 8,
    title: 'Funnel Initialization (Queen + Flame Flinger)',
    actionDesc: 'DeployHero(Queen) at (6, 24) — outer Collector destroyed',
    prevPct: 0,
    newPct: 4,
    prevStars: 0,
    newStars: 0,
    invalid: false,
    note: 'Immediate dense feedback (+2.00 pts) confirms that outer building clearing is productive even though 0 stars are earned yet.',
  },
  {
    step: 6,
    tick: 48,
    title: 'Main Push Entry (Root Riders + Valkyries)',
    actionDesc: 'DeployTroop(Root Rider) at (10, 25) — outer ring breached',
    prevPct: 12,
    newPct: 26,
    prevStars: 0,
    newStars: 0,
    invalid: false,
    note: 'Root Riders crush compartment walls and 3 outer defenses (+14% destruction → +7.00 pts).',
  },
  {
    step: 9,
    tick: 72,
    title: 'Syntax Error Example: Illegal Red-Zone Attempt',
    actionDesc: 'Attempted DeployTroop inside core Red Zone (masked when logit mask active)',
    prevPct: 26,
    newPct: 26,
    prevStars: 0,
    newStars: 0,
    invalid: true,
    note: 'If an unmasked policy attempts an illegal action, engine returns invalid_action=True and applies −0.05 penalty with 0 progress.',
  },
  {
    step: 14,
    tick: 112,
    title: 'First Milestone: 50% Destruction Star Earned!',
    actionDesc: 'DropSpell(Rage) at (22, 25) — crosses 50% threshold',
    prevPct: 44,
    newPct: 52,
    prevStars: 0,
    newStars: 1,
    invalid: false,
    note: 'Crossing 50% awards both the +4.00 dense destruction delta AND the +16.67 Star Milestone jump (+20.67 pts total on this step!).',
  },
  {
    step: 19,
    tick: 152,
    title: 'Core Objective: Town Hall 18 Destroyed (2nd Star)!',
    actionDesc: 'TriggerHeroAbility(Warden Eternal Tome) in core',
    prevPct: 68,
    newPct: 76,
    prevStars: 1,
    newStars: 2,
    invalid: false,
    note: 'Securing the Town Hall 18 triggers the second +16.67 star spike (+20.67 pts total), teaching the CNN why Channel 2 (TH18 Mask) matters.',
  },
  {
    step: 28,
    tick: 224,
    title: 'Total Wipeout: 100% 3-Star Victory!',
    actionDesc: 'Royal Champion Seeking Shield clears final Builder Hut',
    prevPct: 94,
    newPct: 100,
    prevStars: 2,
    newStars: 3,
    invalid: false,
    note: 'Final building falls: +3.00 destruction pts + 16.67 third star = +19.67 pts. Cumulative episode return reaches +100.00 pts!',
  },
];

interface ExamQuestion {
  id: number;
  question: string;
  options: string[];
  correctIdx: number;
  explanation: string;
}

const EXAM_QUESTIONS: ExamQuestion[] = [
  {
    id: 1,
    question:
      'In CoCSpatialEncoder, why do we split the network into a padding-preserving dilated residual branch ($64\\times 50\\times 50$) AND a strided downsampling tower ($256\\text{-D}$), instead of using a standard ResNet classifier backbone for everything?',
    options: [
      'Because PyTorch Conv2d layers cannot process $50\\times 50$ inputs without an AdaptiveAvgPool2d layer.',
      'Because the Actor’s tile deployment head needs 1-to-1 spatial alignment with all $2{,}500$ $(x,y)$ tiles while still seeing an $11\\times 11$ cross-compartment receptive field, whereas the Critic and action-type heads need a compact global summary vector.',
      'Because dilated convolutions reduce the number of channels from $64$ to $1$ without learnable weights.',
      'To prevent the Critic from seeing Channel 4 (the No-Deploy Red Zone mask).',
    ],
    correctIdx: 1,
    explanation:
      'Exactly! A standard ResNet downsamples spatial dimensions ($50\\to 25\\to 13\\to 7$), destroying exact $(x,y)$ tile localization needed to place a Wall Breaker or Rage Spell on a specific tile. By keeping spatial features at $64\\times 50\\times 50$ and applying a $d=2$ dilated residual block, each pixel sees an $11\\times 11$ neighborhood without losing 1-to-1 coordinate alignment.',
  },
  {
    id: 2,
    question:
      'Why does CoCActorCritic multiply the slot and tile log-probabilities by indicator masks $u_{\\text{idx}}(a_{\\text{type}})$ and $u_{\\text{tile}}(a_{\\text{type}})$ when computing $\\log \\pi_\\theta(a_t \\mid s_t)$?',
    options: [
      'Because when the agent selects NoOp ($a_{\\text{type}}=0$) or PopSiege ($a_{\\text{type}}=5$), no unit slot or grid tile is actually used by the game engine; including their log-probs would inject random gradient noise from unused heads into the PPO update.',
      'To force the agent to always choose DropSpell ($a_{\\text{type}}=6$) during early training.',
      'Because log-probabilities are positive numbers and would otherwise overflow float32.',
      'To zero out the Critic value prediction $V_\\phi(s_t)$ on NoOp steps.',
    ],
    correctIdx: 0,
    explanation:
      'Spot on. By the Chain Rule of Probability, if an action type (like NoOp or TriggerHeroAbility) does not depend on a grid coordinate $(x,y)$, the random sample drawn from the tile distribution has zero causal effect on the environment transition. Multiplying by $u_{\\text{tile}} = 0$ prevents random unused tile samples from corrupting the policy gradient.',
  },
  {
    id: 3,
    question:
      'Why do we mask invalid actions by setting their raw logits to $-10^8$ BEFORE applying Softmax, rather than zeroing out probabilities AFTER Softmax?',
    options: [
      'Setting probabilities to zero after Softmax does not sum to $1.0$ and breaks gradient flow, whereas setting logits to $-10^8$ makes $\\exp(-10^8) = 0$ while automatically renormalizing the remaining valid actions to sum to $1.0$ with clean gradients.',
      'Because PyTorch Categorical distributions only accept negative numbers.',
      'So that invalid actions still have a $5\\%$ chance of being explored during training.',
      'To increase the Shannon entropy $\\mathcal{H}(\\pi)$ of the policy.',
    ],
    correctIdx: 0,
    explanation:
      'Correct! In Softmax, $p_i = \\frac{\\exp(z_i)}{\\sum_j \\exp(z_j)}$. Substituting $z_{\\text{invalid}} = -10^8$ yields $\\exp(-10^8) = 0$, so the probability mass is redistributed proportionally across ONLY the legal actions, summing to $1.0$ and producing exact gradients only on valid logits.',
  },
  {
    id: 4,
    question:
      'In Generalized Advantage Estimation $\\text{GAE}(\\gamma, \\lambda)$, what happens as we vary $\\lambda$ from $\\lambda = 0$ to $\\lambda = 1$?',
    options: [
      '$\\lambda = 0$ disables the Critic completely, while $\\lambda = 1$ sets the discount factor $\\gamma$ to zero.',
      '$\\lambda = 0$ reduces to the 1-step TD error $\\delta_t = r_t + \\gamma V(s_{t+1}) - V(s_t)$ (low variance, higher Critic bias), whereas $\\lambda = 1$ recovers the full Monte Carlo empirical advantage $G_t - V(s_t)$ (zero Critic bias in expectation, high variance).',
      '$\\lambda$ controls the PPO clipping threshold $\\epsilon$.',
      '$\\lambda = 1$ makes all rewards negative.',
    ],
    correctIdx: 1,
    explanation:
      'Precisely! $\\text{GAE}(\\gamma, \\lambda)$ is an exponentially-weighted average of $k$-step advantage estimators. Setting $\\lambda = 0.95$ (with $\\gamma = 0.99$) gives the sweet spot: low enough variance for stable gradient updates across $225$ combat steps, while propagating Town Hall and Star rewards dozens of steps backward.',
  },
  {
    id: 5,
    question:
      'Suppose an action had a NEGATIVE advantage ($\\hat{A}_t = -2.0$, meaning it performed worse than the Critic expected) and during minibatch epoch 3 its probability ratio is $r_t(\\theta) = 0.65$ (with $\\epsilon = 0.20$, so the clip interval is $[0.80, 1.20]$). What does PPO’s $L^{\\text{CLIP}}$ do on this sample?',
    options: [
      'It amplifies the gradient by $10\\times$ to punish the action even harder.',
      'Because $r_t(\\theta)\\hat{A}_t = 0.65 \\times (-2.0) = -1.30$ and $\\text{clip}(r_t)\\hat{A}_t = 0.80 \\times (-2.0) = -1.60$, the $\\min(-1.30, -1.60)$ selects the clipped constant $-1.60$, which has ZERO gradient with respect to $\\theta$—preventing PPO from crushing the action probability too far in a single update!',
      'It flips the sign of $\\hat{A}_t$ to $+2.0$.',
      'It resets the neural network weights to random initialization.',
    ],
    correctIdx: 1,
    explanation:
      'Bravo! Because we maximize $\\min(r_t \\hat{A}_t,\\; \\text{clip}(r_t) \\hat{A}_t)$ (or minimize its negation), when $\\hat{A}_t < 0$ and $r_t$ drops below $1 - \\epsilon = 0.80$, the clipped term $(1 - \\epsilon)\\hat{A}_t$ is MORE negative than $r_t \\hat{A}_t$. The $\\min$ operator selects the constant $(1 - \\epsilon)\\hat{A}_t$, setting $\\nabla_\\theta L^{\\text{CLIP}} = 0$ so the policy cannot catastrophically collapse.',
  },
];

export const RLAcademyView: React.FC<{
  onJumpToTab?: (tab: 'armory' | 'ai_train' | 'ai_test') => void;
}> = ({ onJumpToTab }) => {
  const [activeModule, setActiveModule] = useState<ModuleId>('mdp_state');

  // --- Module 1 Interactive State: Receptive Field & Channel Explorer ---
  const [selectedChannel, setSelectedChannel] = useState<number>(1);
  const [useDilatedBlock, setUseDilatedBlock] = useState<boolean>(true);
  const [probeTile, setProbeTile] = useState<{ x: number; y: number }>({ x: 5, y: 5 });

  // --- Module 2 Interactive State: Logits, Masking & Autoregressive Sampling ---
  const [selectedActionType, setSelectedActionType] = useState<number>(1); // DeployTroop
  const [availTroopCount, setAvailTroopCount] = useState<number>(14); // e.g., 14 Throwers
  const [selectedFracBin, setSelectedFracBin] = useState<number>(2); // 0->0.0(1 unit), 1->0.25, 2->0.50, 3->0.75, 4->1.00
  const [toyLogits, setToyLogits] = useState<number[]>([0.8, 2.1, 1.5, 2.8, 0.4]);
  const [toyMasks, setToyMasks] = useState<boolean[]>([true, true, false, false, true]);
  const [enableLogitMasking, setEnableLogitMasking] = useState<boolean>(true);
  const [sampledIndex, setSampledIndex] = useState<number | null>(1);
  const [sampleHistory, setSampleHistory] = useState<number[]>([1, 0, 1, 4, 1]);

  // --- Module 3 Interactive State: Reward Shaping Lab ---
  const [destWeight, setDestWeight] = useState<number>(0.5);
  const [starWeight, setStarWeight] = useState<number>(16.67);
  const [invalidPenalty, setInvalidPenalty] = useState<number>(0.05);
  const [selectedTimelineStep, setSelectedTimelineStep] = useState<number>(3);
  const [rewardMode, setRewardMode] = useState<'th18' | 'sparse' | 'naive_spam'>('th18');

  // --- Module 4 Interactive State: GAE(gamma, lambda) Calculator ---
  const [gaeGamma, setGaeGamma] = useState<number>(0.99);
  const [gaeLambda, setGaeLambda] = useState<number>(0.95);
  const [trajRewards, setTrajRewards] = useState<number[]>([1.0, 0.0, 2.5, 20.67, 4.0]);
  const [trajValues, setTrajValues] = useState<number[]>([14.0, 13.5, 16.0, 18.0, 3.5]);
  const [bootstrapNextVal, setBootstrapNextVal] = useState<number>(0.0);
  const [episodeTerminalLast, setEpisodeTerminalLast] = useState<boolean>(true);

  // --- Module 5 Interactive State: PPO Clipped Surrogate Explorer ---
  const [ppoAdvantage, setPpoAdvantage] = useState<number>(1.5);
  const [ppoEpsilon, setPpoEpsilon] = useState<number>(0.2);
  const [oldProb, setOldProb] = useState<number>(0.25);
  const [newProb, setNewProb] = useState<number>(0.34);

  // --- Module 6 Interactive State: Exam Answers ---
  const [selectedAnswers, setSelectedAnswers] = useState<Record<number, number>>({});

  // Module 2 Computed Softmax & Entropy
  const toyTileLabels = [
    'Tile A (Outer Grass)',
    'Tile B (Funnel Edge)',
    'Tile C (Red Zone Core)',
    'Tile D (On Town Hall)',
    'Tile E (Flank Corner)',
  ];

  const currentActionSpec = ACTION_TYPES_SPEC[selectedActionType];

  const effectiveMasks = useMemo(() => {
    if (selectedActionType === 6) {
      return [true, true, true, true, true];
    }
    return toyMasks;
  }, [selectedActionType, toyMasks]);

  const softmaxDistribution = useMemo(() => {
    const NEG_INF = -1e8;
    const masked = toyLogits.map((l, i) =>
      enableLogitMasking && !effectiveMasks[i] ? NEG_INF : l
    );
    const maxLogit = Math.max(...masked);
    const exps = masked.map((m) => (m <= NEG_INF / 2 ? 0 : Math.exp(m - maxLogit)));
    const sumExp = exps.reduce((a, b) => a + b, 0) || 1e-12;
    const probs = exps.map((e) => e / sumExp);
    const logProbs = probs.map((p) => (p > 1e-12 ? Math.log(p) : -18.42));
    const entropy = -probs.reduce(
      (acc, p) => (p > 1e-12 ? acc + p * Math.log(p) : acc),
      0
    );
    return { masked, probs, logProbs, entropy };
  }, [toyLogits, effectiveMasks, enableLogitMasking]);

  const handleSampleCategorical = () => {
    const r = Math.random();
    let cum = 0;
    let chosen = 0;
    for (let i = 0; i < softmaxDistribution.probs.length; i++) {
      cum += softmaxDistribution.probs[i];
      if (r <= cum) {
        chosen = i;
        break;
      }
    }
    setSampledIndex(chosen);
    setSampleHistory((prev) => [chosen, ...prev.slice(0, 7)]);
  };

  // Module 3 Computed Timeline Rewards
  const computedTimeline = useMemo(() => {
    let cumulative = 0;
    return TIMELINE_EVENTS.map((ev, idx) => {
      const dPct = ev.newPct - ev.prevPct;
      const dStars = ev.newStars - ev.prevStars;
      let r = 0;
      if (rewardMode === 'th18') {
        r =
          dPct * destWeight +
          dStars * starWeight -
          (ev.invalid ? invalidPenalty : 0);
      } else if (rewardMode === 'sparse') {
        r = idx === TIMELINE_EVENTS.length - 1 ? ev.newStars * 33.33 : 0;
      } else {
        r = 5.0 + dPct * 0.05;
      }
      cumulative += r;
      return {
        ...ev,
        dPct,
        dStars,
        stepReward: r,
        cumulativeReward: cumulative,
      };
    });
  }, [destWeight, starWeight, invalidPenalty, rewardMode]);

  // Module 4 Computed GAE Table
  const gaeComputation = useMemo(() => {
    const T = trajRewards.length;
    const deltas = new Array<number>(T).fill(0);
    const advantages = new Array<number>(T).fill(0);
    const returns = new Array<number>(T).fill(0);
    const mcReturns = new Array<number>(T).fill(0);

    let lastGae = 0;
    let runningMc = episodeTerminalLast ? 0 : bootstrapNextVal;

    for (let t = T - 1; t >= 0; t--) {
      const isLast = t === T - 1;
      const nonTerminal = isLast ? (episodeTerminalLast ? 0.0 : 1.0) : 1.0;
      const nextVal = isLast ? bootstrapNextVal : trajValues[t + 1];

      const delta =
        trajRewards[t] + gaeGamma * nextVal * nonTerminal - trajValues[t];
      lastGae = delta + gaeGamma * gaeLambda * nonTerminal * lastGae;

      deltas[t] = delta;
      advantages[t] = lastGae;
      returns[t] = lastGae + trajValues[t];

      runningMc = trajRewards[t] + gaeGamma * nonTerminal * runningMc;
      mcReturns[t] = runningMc;
    }

    const meanAdv = advantages.reduce((a, b) => a + b, 0) / T;
    const stdAdv =
      Math.sqrt(
        advantages.reduce((acc, a) => acc + (a - meanAdv) ** 2, 0) / T
      ) + 1e-8;
    const normAdvantages = advantages.map((a) => (a - meanAdv) / stdAdv);

    return { deltas, advantages, normAdvantages, returns, mcReturns };
  }, [trajRewards, trajValues, gaeGamma, gaeLambda, bootstrapNextVal, episodeTerminalLast]);

  // Module 5 Computed PPO Ratio & Objectives
  const ppoMetrics = useMemo(() => {
    const safeOld = Math.max(0.01, Math.min(0.99, oldProb));
    const safeNew = Math.max(0.01, Math.min(0.99, newProb));
    const logOld = Math.log(safeOld);
    const logNew = Math.log(safeNew);
    const ratio = Math.exp(logNew - logOld);
    const clippedRatio = Math.max(
      1 - ppoEpsilon,
      Math.min(1 + ppoEpsilon, ratio)
    );
    const unclippedTerm = ratio * ppoAdvantage;
    const clippedTerm = clippedRatio * ppoAdvantage;
    const surrogateObj = Math.min(unclippedTerm, clippedTerm);
    const ppoLoss = -surrogateObj;
    const approxKl = ratio - 1 - (logNew - logOld);

    const isClippedGradZero =
      (ppoAdvantage > 0 && ratio > 1 + ppoEpsilon) ||
      (ppoAdvantage < 0 && ratio < 1 - ppoEpsilon);

    return {
      logOld,
      logNew,
      ratio,
      clippedRatio,
      unclippedTerm,
      clippedTerm,
      surrogateObj,
      ppoLoss,
      approxKl,
      isClippedGradZero,
    };
  }, [oldProb, newProb, ppoAdvantage, ppoEpsilon]);

  const gridRadius = useDilatedBlock ? 5 : 2;

  return (
    <div className="rl-academy-shell">
      {/* LEFT LECTURE SYLLABUS & PROFESSOR PROGRESS RAIL */}
      <aside className="rl-academy-sidebar">
        <div className="rl-prof-badge">
          <div className="rl-prof-avatar">🎓</div>
          <div>
            <div className="rl-prof-tag">CS-285 / TH18 DEEP RL SEMINAR</div>
            <h2 className="rl-prof-title">Professor’s Interactive RL Laboratory</h2>
          </div>
        </div>

        <p className="rl-prof-intro">
          <strong>Prerequisites assumed:</strong> Multivariable calculus, probability theory, and
          Convolutional Neural Networks (CNNs). <br />
          <strong>Goal:</strong> Understand from first principles how Reinforcement Learning works
          and how every equation is engineered inside this Clash of Clans TH18 simulator.
        </p>

        <div className="rl-module-nav">
          {LECTURE_MODULES.map((mod) => {
            const isActive = mod.id === activeModule;
            return (
              <button
                key={mod.id}
                className={`rl-module-card ${isActive ? 'active' : ''}`}
                onClick={() => setActiveModule(mod.id)}
              >
                <div className="rl-module-card-top">
                  <span className="rl-module-num">LECTURE {mod.number}</span>
                  <span className="rl-module-status">{isActive ? '● ACTIVE' : 'OPEN'}</span>
                </div>
                <div className="rl-module-name">{mod.shortTitle}</div>
                <div className="rl-module-formula">
                  <TeX math={mod.keySymbolsTex} />
                </div>
              </button>
            );
          })}
        </div>

        <div className="rl-sidebar-footer">
          <div className="rl-sidebar-footer-title">Hands-On Bridge</div>
          <p>
            Ready to watch these equations optimize live weights on the Town Hall 18 battlefield?
          </p>
          <div className="rl-sidebar-actions">
            {onJumpToTab && (
              <>
                <button
                  className="clash-btn gold"
                  onClick={() => onJumpToTab('ai_train')}
                >
                  📊 Open PPO Trainer
                </button>
                <button
                  className="clash-btn"
                  onClick={() => onJumpToTab('ai_test')}
                >
                  🧪 Test Trained Policy
                </button>
              </>
            )}
          </div>
        </div>
      </aside>

      {/* MAIN INTERACTIVE LECTURE STAGE */}
      <main className="rl-academy-main">
        {LECTURE_MODULES.filter((m) => m.id === activeModule).map((mod) => (
          <div key={mod.id} className="rl-lecture-header">
            <div className="rl-lecture-eyebrow">
              <span className="rl-lecture-pill">LECTURE {mod.number} OF 06</span>
              <span className="rl-lecture-file">📂 {mod.sourceFile}</span>
            </div>
            <h1 className="rl-lecture-title">{mod.fullTitle}</h1>
            <p className="rl-lecture-subtitle">{mod.subtitle}</p>
          </div>
        ))}

        {/* ===================================================================
            MODULE 1: STATE REPRESENTATION & DUAL-STREAM CNN
           =================================================================== */}
        {activeModule === 'mdp_state' && (
          <div className="rl-lecture-body">
            <section className="rl-prof-note">
              <div className="rl-prof-note-header">
                <span>👨‍🏫 Professor’s Chalkboard: Why Not Supervised CNN Classification?</span>
                <span className="rl-badge-concept">MDP vs. Static I.I.D. Data</span>
              </div>
              <p>
                Since you already know how Convolutional Neural Networks work in computer vision,
                your first instinct might be: <em>“Why don’t we just feed the village map into a CNN
                and train it with Cross-Entropy loss?”</em> Three fundamental barriers make
                Supervised Learning impossible here:
              </p>
              <div className="rl-three-col">
                <div className="rl-concept-card">
                  <h4>
                    1. No Ground-Truth Labels (<TeX math="y^*" />)
                  </h4>
                  <p>
                    In ImageNet, every image has a known target label <TeX math="y^*" />. On a Town
                    Hall 18 base, what is the “correct” pixel at tick 24? Nobody knows a
                    priori—there are over <TeX math="10^{80}" /> possible deployment trajectories.
                  </p>
                </div>
                <div className="rl-concept-card">
                  <h4>2. Non-I.I.D. State Transitions</h4>
                  <p>
                    In supervised learning, samples are independent. Here, your action{' '}
                    <TeX math="a_t" /> mutates the next input image{' '}
                    <TeX math="s_{t+1} \sim P(\cdot \mid s_t, a_t)" />: dropping a Flame Flinger on
                    the west corner alters every future defense aggro vector.
                  </p>
                </div>
                <div className="rl-concept-card">
                  <h4>3. Delayed Credit Assignment</h4>
                  <p>
                    A Wall Breaker deployed at <TeX math="t = 2\text{ s}" /> opens a compartment
                    that enables the Archer Queen to destroy the Town Hall at{' '}
                    <TeX math="t = 110\text{ s}" />. The reward signal arrives hundreds of ticks
                    after the decision!
                  </p>
                </div>
              </div>
            </section>

            {/* MATHEMATICAL FORMULATION OF THE MDP */}
            <section className="rl-section-panel">
              <h3>1.1 Formalizing Clash of Clans as a Markov Decision Process (MDP)</h3>
              <p>
                We model a Town Hall 18 attack as a finite-horizon episodic Markov Decision Process{' '}
                <TeX math="\mathcal{M} = (\mathcal{S}, \mathcal{A}, P, R, \gamma)" /> running at a
                simulation rate of <strong>12.5 Hz</strong> (<TeX math="\Delta t = 80\text{ ms}" />{' '}
                per tick, max <TeX math="1{,}800\text{ ticks} = 180\text{ s}" />
                ). Because RL agents make strategic decisions every{' '}
                <strong>8 engine ticks</strong> (<TeX math="0.64\text{ s}" />
                ), an episode has a maximum horizon of <TeX math="T = 225" /> decision steps. A
                complete battle trajectory <TeX math="\tau = (s_0, a_0, r_0, \dots, s_T)" /> is
                distributed according to:
              </p>
              <div className="rl-equation-block">
                <TeX
                  block
                  math={String.raw`p_\theta(\tau) = \rho_0(s_0) \prod_{t=0}^{T-1} \pi_\theta(a_t \mid s_t)\, P(s_{t+1} \mid s_t, a_t)`}
                />
                <div className="rl-equation-legend">
                  <span>
                    <TeX math="s_t \in \mathcal{S}" />: Dual-stream state observation (
                    <TeX math="10\times 50\times 50" /> spatial tensor + <TeX math="64\text{-D}" />{' '}
                    vector)
                  </span>
                  <span>
                    <TeX math="\pi_\theta(a_t \mid s_t)" />: Parameterized Actor policy network
                  </span>
                  <span>
                    <TeX math="P(s_{t+1} \mid s_t, a_t)" />: Deterministic Rust combat engine (
                    <code>crates/coc-engine</code>) stepped for 8 ticks
                  </span>
                </div>
              </div>
            </section>

            {/* TOY EXAMPLE -> PROJECT GENERALIZATION: DUAL-PATHWAY CNN */}
            <section className="rl-two-zone-sandbox">
              <div className="rl-sandbox-stage">
                <div className="rl-sandbox-header">
                  <div>
                    <span className="rl-sandbox-badge">INTERACTIVE LAB 1</span>
                    <h4>
                      Toy Compartment vs. TH18 Receptive Field & Dual-Pathway CNN Explorer
                    </h4>
                  </div>
                  <div className="rl-toggle-row">
                    <button
                      className={`clash-btn ${!useDilatedBlock ? 'gold' : ''}`}
                      onClick={() => setUseDilatedBlock(false)}
                    >
                      Standard 2-Layer Conv (5×5 RF)
                    </button>
                    <button
                      className={`clash-btn ${useDilatedBlock ? 'gold' : ''}`}
                      onClick={() => setUseDilatedBlock(true)}
                    >
                      + Dilated Residual d=2 (11×11 RF)
                    </button>
                  </div>
                </div>

                <p className="rl-sandbox-instruction">
                  <strong>Click any tile</strong> on this 11×11 slice of a Town Hall 18 compartment
                  to inspect the CNN’s receptive field centered at{' '}
                  <TeX math={`(x=${probeTile.x},\\, y=${probeTile.y})`} />. Notice why our{' '}
                  <code>CoCSpatialEncoder</code> keeps a full-resolution{' '}
                  <TeX math="(B, 64, 50, 50)" /> map with <TeX math="d = 2" /> dilation instead of
                  spatial pooling!
                </p>

                <div className="rl-rf-visualizer-layout">
                  <div className="rl-rf-grid">
                    {Array.from({ length: 11 }).map((_, y) =>
                      Array.from({ length: 11 }).map((__, x) => {
                        const dx = Math.abs(x - probeTile.x);
                        const dy = Math.abs(y - probeTile.y);
                        const inReceptiveField = dx <= gridRadius && dy <= gridRadius;
                        const isDilatedSamplePoint =
                          useDilatedBlock &&
                          ((dx === 2 && dy === 0) ||
                            (dx === 0 && dy === 2) ||
                            (dx === 2 && dy === 2) ||
                            (dx === 4 && dy === 0) ||
                            (dx === 0 && dy === 4));
                        const isCenter = x === probeTile.x && y === probeTile.y;

                        const isTH = x >= 4 && x <= 6 && y >= 4 && y <= 6;
                        const isWall =
                          (x === 2 || x === 8) && y >= 2 && y <= 8
                            ? true
                            : (y === 2 || y === 8) && x >= 2 && x <= 8;
                        const isRedZone = x >= 1 && x <= 9 && y >= 1 && y <= 9;

                        let cellLabel = '·';
                        if (isTH) cellLabel = 'TH';
                        else if (isWall) cellLabel = '🧱';
                        else if (x === 3 && y === 5) cellLabel = '🔥';
                        else if (x === 7 && y === 5) cellLabel = '🏹';

                        return (
                          <button
                            key={`${x}-${y}`}
                            type="button"
                            onClick={() => setProbeTile({ x, y })}
                            className={`rl-rf-cell ${inReceptiveField ? 'in-rf' : ''} ${
                              isCenter ? 'center-tile' : ''
                            } ${isDilatedSamplePoint ? 'dilated-tap' : ''} ${
                              isTH
                                ? 'th-tile'
                                : isWall
                                ? 'wall-tile'
                                : isRedZone
                                ? 'red-tile'
                                : 'grass-tile'
                            }`}
                            title={`Tile (${x}, ${y})`}
                          >
                            <span>{cellLabel}</span>
                          </button>
                        );
                      })
                    )}
                  </div>

                  <div className="rl-rf-explanation">
                    <div className="rl-rf-stat-box">
                      <div className="rl-rf-stat">
                        <span>Active Architecture</span>
                        <strong>
                          {useDilatedBlock
                            ? 'Spatial Stem + Dilated ResBlock (d=2)'
                            : 'Spatial Stem Only (2× Conv 3×3, d=1)'}
                        </strong>
                      </div>
                      <div className="rl-rf-stat">
                        <span>Effective Receptive Field</span>
                        <strong className="rl-gold-num">
                          {useDilatedBlock ? '11 × 11 tiles (121 tiles)' : '5 × 5 tiles (25 tiles)'}
                        </strong>
                      </div>
                      <div className="rl-rf-stat">
                        <span>Output Spatial Tensor Shape</span>
                        <TeX math="F_{\text{spatial}} \in \mathbb{R}^{B \times 64 \times 50 \times 50}" />
                      </div>
                    </div>

                    <div className="rl-callout-box">
                      {useDilatedBlock ? (
                        <>
                          <strong>✅ Why Dilation d=2 Works for TH18:</strong> When evaluating a legal
                          deployment tile outside the Red Zone (e.g., tile <code>(0, 5)</code>), an{' '}
                          <strong>11×11 receptive field</strong> reaches across the outer grass,
                          through the 🧱 Wall ring, and sees the 🔥 Inferno / 🏰 Town Hall inside the
                          compartment—while keeping exact <TeX math="50 \times 50" /> pixel
                          coordinates for the Actor’s tile deployment head!
                        </>
                      ) : (
                        <>
                          <strong>⚠️ Problem with Narrow 5×5 Receptive Field:</strong> At a legal
                          deployment tile outside the Red Zone (e.g., <code>(0, 5)</code>), a 5×5
                          window only sees empty grass and the outer wall! The tile head is blind to
                          which defense sits behind the wall.
                        </>
                      )}
                    </div>

                    <div className="rl-dual-pathway-diagram">
                      <div className="rl-pathway-title">
                        Why <code>CoCSpatialEncoder</code> Splits Into Two Parallel Branches:
                      </div>
                      <div className="rl-pathway-row">
                        <div className="rl-pathway-node">
                          <span>Input Tensor</span>
                          <TeX math="O_t \in [0,1]^{B \times 10 \times 50 \times 50}" />
                        </div>
                        <span className="rl-arrow">→</span>
                        <div className="rl-pathway-node">
                          <span>Stem + Dilated Res</span>
                          <TeX math="\mathbb{R}^{B \times 64 \times 50 \times 50}" />
                        </div>
                        <span className="rl-arrow">⇒</span>
                        <div className="rl-pathway-branches">
                          <div className="rl-branch-box spatial">
                            <strong>Branch A: Full-Res Spatial Features</strong>
                            <TeX math="F_{\text{spatial}} \in \mathbb{R}^{B \times 64 \times 50 \times 50}" />
                            <span>Feeds Actor’s 50×50 Tile Pointer Head ("WHERE to deploy")</span>
                          </div>
                          <div className="rl-branch-box global">
                            <strong>Branch B: Strided Global Tower (s=2 → s=2 → 4×4 Pool)</strong>
                            <TeX math="h_{\text{global}} \in \mathbb{R}^{B \times 256}" />
                            <span>
                              Fused with 64-D Army Context → Feeds Action-Type, Slot & Critic{' '}
                              <TeX math="V_\phi(s_t)" />
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* RIGHT ZONE: 10 SPATIAL CHANNELS + 64-D ARMY CONTEXT INSPECTOR */}
              <div className="rl-sandbox-controls">
                <h4>
                  The 10 Spatial Channels of <TeX math="O_t \in [0, 1]^{10 \times 50 \times 50}" />
                </h4>
                <p className="rl-small-muted">
                  Extracted in Rust (<code>crates/coc-engine/src/sim.rs</code>) in under 40 microseconds
                  per step. Click any channel to inspect its normalization and tactical meaning:
                </p>
                <div className="rl-channel-list">
                  {SPATIAL_CHANNELS_SPEC.map((c) => (
                    <button
                      key={c.ch}
                      type="button"
                      className={`rl-channel-btn ${selectedChannel === c.ch ? 'active' : ''}`}
                      onClick={() => setSelectedChannel(c.ch)}
                    >
                      <span
                        className="rl-channel-dot"
                        style={{ backgroundColor: c.color }}
                      />
                      <span className="rl-channel-idx">Ch {c.ch}</span>
                      <span className="rl-channel-name">{c.name}</span>
                    </button>
                  ))}
                </div>

                {SPATIAL_CHANNELS_SPEC[selectedChannel] && (
                  <div className="rl-channel-detail-card">
                    <div className="rl-channel-detail-top">
                      <strong>
                        Channel {selectedChannel}: {SPATIAL_CHANNELS_SPEC[selectedChannel].name}
                      </strong>
                      <TeX math={SPATIAL_CHANNELS_SPEC[selectedChannel].normTex} />
                    </div>
                    <p>{SPATIAL_CHANNELS_SPEC[selectedChannel].role}</p>
                  </div>
                )}

                <div className="rl-callout-box" style={{ marginTop: '0.6rem' }}>
                  <strong>🧠 Why Tactical-Archetype Signatures <TeX math="\phi(u) \in [0,1]" /> Instead of Raw Enum Integers?</strong>
                  <div style={{ marginTop: '0.25rem', fontSize: '0.82rem', lineHeight: 1.45 }}>
                    A 2D convolution computes a linear dot product <TeX math="z = \sum W \cdot x + b" />. Feeding raw enum IDs (<TeX math="1..65" />) creates a false metric where unit <TeX math="60" /> excites filters <TeX math="60\times" /> stronger than unit <TeX math="1" />, and summing/averaging IDs on crowded tiles produces phantom unit IDs. Instead, Channels 8 &amp; 9 take <TeX math="\max_{u \in (x,y)} \phi(u)" /> over a structured <TeX math="[0,1]" /> tactical spectrum (Swarm <TeX math="[0.08..0.28]" />, Ranged DPS <TeX math="[0.30..0.54]" />, Heavy Breachers <TeX math="[0.56..0.76]" />, Sieges <TeX math="[0.78..0.85]" />, Pets/Heroes <TeX math="[0.86..1.00]" />), with <strong>Ground Skeletons (<TeX math="0.10" />)</strong> and <strong>Air Skeletons (<TeX math="0.28" />)</strong> strictly separated by domain.
                  </div>
                </div>

                <div className="rl-context-vector-box">
                  <h4>
                    Plus: The 64-D Non-Spatial Army Context Vector{' '}
                    <TeX math="c_t \in [0, 1]^{64}" />
                  </h4>
                  <p className="rl-small-muted">
                    Why isn’t the <TeX math="10 \times 50 \times 50" /> image sufficient for the
                    Markov property? Because the board cannot tell the agent{' '}
                    <em>how many troops remain in its hand</em> or{' '}
                    <em>how much time is left on the clock</em>! We project{' '}
                    <TeX math="c_t \in \mathbb{R}^{64} \to \mathbb{R}^{256}" /> and add it directly
                    to <TeX math="h_{\text{global}}" />:
                  </p>
                  <ul className="rl-compact-list">
                    <li>
                      <code>[0..3]</code> <strong>Battle Clock & Score:</strong> Time remaining ratio,
                      Destruction %, Stars/3, TH18 destroyed flag.
                    </li>
                    <li>
                      <code>[4..23]</code> <strong>10 Troop Slots:</strong> Normalized remaining count
                      + unit housing/role encoding.
                    </li>
                    <li>
                      <code>[24..43]</code> <strong>10 Spell Slots:</strong> Normalized remaining
                      spells + spell category.
                    </li>
                    <li>
                      <code>[44..59]</code> <strong>4 Heroes + Equipment + Pets:</strong> Deployed
                      flag, live HP ratio, ability available flag.
                    </li>
                    <li>
                      <code>[60..63]</code> <strong>Siege Machine & Clan Castle:</strong> Siege
                      deployed, Siege intact, CC popped flags.
                    </li>
                  </ul>
                </div>
              </div>
            </section>
          </div>
        )}

        {/* ===================================================================
            MODULE 2: FACTORIZED ACTION SPACE, MASKING & SAMPLING
           =================================================================== */}
        {activeModule === 'action_space' && (
          <div className="rl-lecture-body">
            <section className="rl-prof-note">
              <div className="rl-prof-note-header">
                <span>
                  👨‍🏫 Professor’s Chalkboard: The Combinatorial Action Space & Multi-Unit Batch Deployment
                </span>
                <span className="rl-badge-concept">Chain Rule of Probability</span>
              </div>
              <p>
                At every decision step <TeX math="t" /> (<TeX math="\Delta t = 0.64\text{ s}" />), a
                Clash of Clans player chooses a <strong>4-part composite action</strong>{' '}
                <TeX math="a_t = (a_{\text{type}},\, a_{\text{idx}},\, \alpha_{\text{frac}},\, a_{x,y})" />
                : which of the <strong>7 action types</strong> to execute, which of the{' '}
                <strong>10 inventory slots</strong> to use, what{' '}
                <strong>fraction <TeX math="\alpha_{\text{frac}} \in [0, 1]" /> of available troops</strong>{' '}
                in that slot to place down at once, and which of the{' '}
                <TeX math="50 \times 50 = 2{,}500" /> tiles to click.
              </p>
              <div className="rl-two-col">
                <div className="rl-concept-card danger-border">
                  <h4>
                    ❌ Naïve Flat Action Space:{' '}
                    <TeX math="7 \times 10 \times 5 \times 2{,}500 = 875{,}000" /> Actions
                  </h4>
                  <p>
                    A single linear layer mapping <TeX math="256 \to 875{,}000" /> logits would require{' '}
                    <strong>224 million parameters</strong> just in the output head! Worse, if the agent
                    could only place <strong>1 troop per step</strong> (<TeX math="0.64\text{ s}" />),
                    deploying 14 Throwers would waste <TeX math="14 \times 0.64\text{ s} = 8.96\text{ s}" />!
                  </p>
                </div>
                <div className="rl-concept-card success-border">
                  <h4>
                    ✅ Autoregressive Factorization:{' '}
                    <TeX math="7 + 10 + 5 + 2{,}500 = 2{,}522" /> Logits
                  </h4>
                  <p>
                    By the <strong>Chain Rule of Probability</strong>, we factor the joint policy into
                    4 sequential heads: <TeX math="a_{\text{type}} \to a_{\text{idx}} \to \alpha_{\text{frac}} \to a_{x,y}" />.
                    The fraction head <TeX math="\alpha_{\text{frac}} \in \{0.0, 0.25, 0.50, 0.75, 1.00\}" />{' '}
                    lets the agent drop <TeX math="\max(1, \text{round}(\alpha_{\text{frac}} \cdot N_{\text{avail}}))" />{' '}
                    troops simultaneously in a single <TeX math="0.64\text{ s}" /> step!
                  </p>
                </div>
              </div>

              <div className="rl-equation-block">
                <TeX
                  block
                  math={String.raw`\log \pi_\theta(a_t \mid s_t) = \log \pi_\theta(a_{\text{type}} \mid s_t) + u_{\text{idx}}(a_{\text{type}})\,\log \pi_\theta(a_{\text{idx}} \mid s_t, a_{\text{type}}) + u_{\text{frac}}(a_{\text{type}})\,\log \pi_\theta(\alpha_{\text{frac}} \mid s_t, a_{\text{type}}, a_{\text{idx}}) + u_{\text{tile}}(a_{\text{type}})\,\log \pi_\theta(a_{x,y} \mid s_t, a_{\text{type}})`}
                />
                <div className="rl-equation-legend">
                  <span>
                    <TeX math="u_{\text{idx}}(a_{\text{type}}) = \mathbb{I}[a_{\text{type}} \in \{1,2,3,6\}]" />{' '}
                    (Troop, Hero, Ability, Spell)
                  </span>
                  <span>
                    <TeX math="u_{\text{frac}}(a_{\text{type}}) = \mathbb{I}[a_{\text{type}} = 1]" />{' '}
                    (Active only for <code>DeployTroop</code>: <TeX math="N_{\text{spawn}} = \max(1, \text{round}(\alpha_{\text{frac}} \cdot N_{\text{avail}}))" />)
                  </span>
                  <span>
                    <TeX math="u_{\text{tile}}(a_{\text{type}}) = \mathbb{I}[a_{\text{type}} \in \{1,2,4,6\}]" />{' '}
                    (Troop, Hero, Siege, Spell)
                  </span>
                </div>
              </div>
            </section>

            {/* INTERACTIVE LAB 2: LOGIT MASKING, SOFTMAX & CATEGORICAL SAMPLING */}
            <section className="rl-two-zone-sandbox">
              <div className="rl-sandbox-stage">
                <div className="rl-sandbox-header">
                  <div>
                    <span className="rl-sandbox-badge">INTERACTIVE LAB 2</span>
                    <h4>
                      Autoregressive Conditioning, Troop Fraction <TeX math="\alpha_{\text{frac}} \in [0, 1]" /> & Logit Masking
                    </h4>
                  </div>
                  <div className="rl-toggle-row">
                    <button
                      className={`clash-btn ${enableLogitMasking ? 'green' : 'danger'}`}
                      onClick={() => setEnableLogitMasking(!enableLogitMasking)}
                    >
                      {enableLogitMasking
                        ? '🛡️ Invalid-Action Masking: ON (L = −10⁸)'
                        : '⚠️ Invalid-Action Masking: OFF (Raw Logits)'}
                    </button>
                    <button className="clash-btn gold" onClick={handleSampleCategorical}>
                      🎲 Draw Sample a ~ Categorical(p)
                    </button>
                  </div>
                </div>

                <p className="rl-sandbox-instruction">
                  <strong>Step 1:</strong> Choose an Action Type <TeX math="a_{\text{type}}" />{' '}
                  below. Notice how <code>DeployTroop (1)</code> activates the{' '}
                  <strong>Troop Deployment Fraction Head</strong> (<TeX math="u_{\text{frac}} = 1" />),
                  <code>DropSpell (6)</code> bypasses the Red Zone, and <code>NoOp (0)</code> masks out
                  all downstream sub-action heads!
                </p>

                <div className="rl-action-type-selector">
                  {ACTION_TYPES_SPEC.map((spec) => (
                    <button
                      key={spec.id}
                      type="button"
                      className={`rl-atype-chip ${selectedActionType === spec.id ? 'active' : ''}`}
                      onClick={() => setSelectedActionType(spec.id)}
                    >
                      <span className="rl-atype-id">#{spec.id}</span>
                      <span>{spec.name}</span>
                    </button>
                  ))}
                </div>

                <div className="rl-atype-telemetry">
                  <div className="rl-atype-pill">
                    <span>
                      Slot Gate <TeX math="u_{\text{idx}}" />:
                    </span>
                    <strong className={currentActionSpec.usesIdx ? 'text-green' : 'text-muted'}>
                      {currentActionSpec.usesIdx ? '1 (Active)' : '0 (Masked Out)'}
                    </strong>
                  </div>
                  <div className="rl-atype-pill">
                    <span>
                      Fraction Gate <TeX math="u_{\text{frac}}" />:
                    </span>
                    <strong className={currentActionSpec.usesFrac ? 'text-gold' : 'text-muted'}>
                      {currentActionSpec.usesFrac ? '1 (Active: α ∈ [0,1])' : '0 (Masked Out)'}
                    </strong>
                  </div>
                  <div className="rl-atype-pill">
                    <span>
                      Tile Gate <TeX math="u_{\text{tile}}" />:
                    </span>
                    <strong className={currentActionSpec.usesTile ? 'text-green' : 'text-muted'}>
                      {currentActionSpec.usesTile ? '1 (Active)' : '0 (Masked Out)'}
                    </strong>
                  </div>
                </div>

                {/* INTERACTIVE TROOP DEPLOYMENT FRACTION SIMULATOR */}
                <div
                  className="rl-concept-card"
                  style={{
                    marginBottom: 12,
                    borderColor: currentActionSpec.usesFrac
                      ? 'rgba(192, 132, 252, 0.5)'
                      : 'rgba(148, 163, 184, 0.2)',
                    opacity: currentActionSpec.usesFrac ? 1 : 0.6,
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      flexWrap: 'wrap',
                      gap: 8,
                    }}
                  >
                    <strong>
                      🪖 Head 3: Troop Deployment Fraction{' '}
                      <TeX math="\alpha_{\text{frac}} \in \{0.0,\, 0.25,\, 0.50,\, 0.75,\, 1.00\}" />
                    </strong>
                    <span className="rl-mono-num" style={{ color: '#e9d5ff' }}>
                      <TeX
                        math={`N_{\\text{spawn}} = \\max(1,\\, \\text{round}(${[0, 0.25, 0.5, 0.75, 1.0][selectedFracBin].toFixed(2)} \\times ${availTroopCount})) = ${Math.max(1, Math.min(availTroopCount, Math.round(availTroopCount * [0, 0.25, 0.5, 0.75, 1.0][selectedFracBin])))}`}
                      />{' '}
                      troops in 0.64s!
                    </span>
                  </div>
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '1fr auto',
                      gap: 12,
                      alignItems: 'center',
                      marginTop: 8,
                    }}
                  >
                    <div className="rl-slider-inline">
                      <span style={{ fontSize: '0.76rem', color: '#cbd5e1' }}>
                        Available in Slot (<TeX math="N_{\text{avail}}" />):
                      </span>
                      <input
                        type="range"
                        min={1}
                        max={20}
                        step={1}
                        value={availTroopCount}
                        onChange={(e) => setAvailTroopCount(Number(e.target.value))}
                      />
                      <span className="rl-mono-num">{availTroopCount} Throwers</span>
                    </div>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      {[
                        { bin: 0, label: 'α=0.0 (1 unit)' },
                        { bin: 1, label: 'α=0.25 (25%)' },
                        { bin: 2, label: 'α=0.50 (Half)' },
                        { bin: 3, label: 'α=0.75 (75%)' },
                        { bin: 4, label: 'α=1.00 (All)' },
                      ].map((item) => (
                        <button
                          key={item.bin}
                          type="button"
                          className={`rl-atype-chip ${selectedFracBin === item.bin ? 'active' : ''}`}
                          onClick={() => setSelectedFracBin(item.bin)}
                        >
                          {item.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <p className="rl-small-muted" style={{ marginTop: 6, marginBottom: 0 }}>
                    Instead of spending{' '}
                    <TeX math={`${availTroopCount} \\times 0.64\\text{ s} = ${(availTroopCount * 0.64).toFixed(2)}\\text{ s}`} />{' '}
                    placing 1 troop per action, choosing{' '}
                    <TeX math={`\\alpha_{\\text{frac}} = ${[0, 0.25, 0.5, 0.75, 1.0][selectedFracBin].toFixed(2)}`} />{' '}
                    places{' '}
                    <strong>
                      {Math.max(
                        1,
                        Math.min(
                          availTroopCount,
                          Math.round(
                            availTroopCount * [0, 0.25, 0.5, 0.75, 1.0][selectedFracBin]
                          )
                        )
                      )}{' '}
                      troops immediately
                    </strong>{' '}
                    (with <TeX math="\alpha=0.0" /> clamped to <TeX math="1" /> troop for single-unit funneling/trap-testing).
                  </p>
                </div>

                {/* TOY 5-TILE LOGIT & SOFTMAX TABLE */}
                <div className="rl-logit-table-wrap">
                  <table className="rl-logit-table">
                    <thead>
                      <tr>
                        <th>Candidate Tile</th>
                        <th>
                          Valid Mask <TeX math="M_i" />
                        </th>
                        <th>
                          Raw Logit <TeX math="z_i" />
                        </th>
                        <th>
                          Masked Logit <TeX math="\tilde{z}_i" />
                        </th>
                        <th>
                          Softmax <TeX math="p_i = \frac{e^{\tilde{z}_i}}{\sum_j e^{\tilde{z}_j}}" />
                        </th>
                        <th>
                          <TeX math="\log \pi_\theta(a_i \mid s_t)" />
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {toyTileLabels.map((label, i) => {
                        const isValid = effectiveMasks[i];
                        const prob = softmaxDistribution.probs[i];
                        const isSampled = sampledIndex === i;
                        return (
                          <tr
                            key={label}
                            className={`${isSampled ? 'sampled-row' : ''} ${
                              !isValid && enableLogitMasking ? 'masked-row' : ''
                            }`}
                          >
                            <td>
                              <strong>{label}</strong>
                              {isSampled && <span className="rl-sampled-tag">🎲 SAMPLED</span>}
                            </td>
                            <td>
                              <button
                                type="button"
                                disabled={selectedActionType === 6}
                                className={`rl-mask-toggle ${isValid ? 'valid' : 'invalid'}`}
                                onClick={() =>
                                  setToyMasks((prev) =>
                                    prev.map((m, idx) => (idx === i ? !m : m))
                                  )
                                }
                              >
                                {isValid ? '✓ VALID (1)' : '✗ RED ZONE (0)'}
                              </button>
                            </td>
                            <td>
                              <div className="rl-slider-inline">
                                <input
                                  type="range"
                                  min={-2.0}
                                  max={4.0}
                                  step={0.1}
                                  value={toyLogits[i]}
                                  onChange={(e) => {
                                    const val = parseFloat(e.target.value);
                                    setToyLogits((prev) =>
                                      prev.map((l, idx) => (idx === i ? val : l))
                                    );
                                  }}
                                />
                                <span className="rl-mono-num">{toyLogits[i].toFixed(1)}</span>
                              </div>
                            </td>
                            <td className="rl-mono-num">
                              {enableLogitMasking && !isValid
                                ? '−1.00×10⁸'
                                : toyLogits[i].toFixed(2)}
                            </td>
                            <td>
                              <div className="rl-prob-bar-cell">
                                <div className="rl-prob-bar-track">
                                  <div
                                    className="rl-prob-bar-fill"
                                    style={{ width: `${Math.min(100, prob * 100)}%` }}
                                  />
                                </div>
                                <span className="rl-mono-num">
                                  {(prob * 100).toFixed(1)}%
                                </span>
                              </div>
                            </td>
                            <td className="rl-mono-num">
                              {softmaxDistribution.logProbs[i].toFixed(3)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                <div className="rl-sampling-summary">
                  <div>
                    <span>
                      Policy Shannon Entropy{' '}
                      <TeX math="\mathcal{H}(\pi) = -\sum_i p_i \log p_i" />:{' '}
                    </span>
                    <strong className="rl-gold-num">
                      {softmaxDistribution.entropy.toFixed(3)} nats
                    </strong>{' '}
                    <span className="rl-small-muted">
                      (Multiplied by <TeX math="c_2 = 0.015" /> in PPO loss)
                    </span>
                  </div>
                  <div>
                    <span>Recent Categorical Draws: </span>
                    <code>
                      [{sampleHistory.map((idx) => `Tile ${String.fromCharCode(65 + idx)}`).join(', ')}]
                    </code>
                  </div>
                </div>
              </div>

              <div className="rl-sandbox-controls">
                <h4>Why How We Sample & Mask Matters</h4>
                <div className="rl-concept-card">
                  <h4>1. Training (Stochastic) vs. Testing (Greedy)</h4>
                  <p>
                    During <strong>PPO Training</strong>, we sample{' '}
                    <TeX math="a_t \sim \text{Categorical}(p)" />. If Tile B has 45% probability and
                    Tile A has 25%, the agent occasionally tries Tile A to discover if a wider
                    funnel yields higher return. During <strong>Evaluation</strong>, we can take{' '}
                    <TeX math="\arg\max_a p(a)" /> for deterministic play.
                  </p>
                </div>

                <div className="rl-concept-card">
                  <h4>2. Spatial Broadcast Conditioning in Code</h4>
                  <p>
                    How does the <TeX math="50 \times 50" /> convolutional head know whether it is
                    placing a <strong>Root Rider</strong> (wants outer perimeter wall segments) or an{' '}
                    <strong>Earthquake Spell</strong> (wants the core Town Hall + Inferno junction)?
                  </p>
                  <pre className="rl-code-snippet">
{`# From python/coc_rl/networks.py:
type_one_hot = F.one_hot(chosen_type, 7).float()
cond_emb = torch.cat([global_emb, type_one_hot], dim=-1) # (B, 263)

# Broadcast 64-D vector onto every (x,y) pixel of (B, 64, 50, 50):
tile_cond = self.tile_cond_proj(cond_emb).unsqueeze(-1).unsqueeze(-1)
fused_spatial = F.silu(spatial_feat + tile_cond)
raw_tile_logits = self.tile_conv_head(fused_spatial).view(B, 2500)`}
                  </pre>
                </div>
              </div>
            </section>
          </div>
        )}

        {/* ===================================================================
            MODULE 3: CRAFTING THE REWARD FUNCTION
           =================================================================== */}
        {activeModule === 'reward_design' && (
          <div className="rl-lecture-body">
            <section className="rl-prof-note">
              <div className="rl-prof-note-header">
                <span>
                  👨‍🏫 Professor’s Chalkboard: The Art & Mathematics of Reward Shaping
                </span>
                <span className="rl-badge-concept">Potential-Based Delta Shaping</span>
              </div>
              <p>
                In Reinforcement Learning, the agent has only one objective: maximize expected
                cumulative discounted reward{' '}
                <TeX math="J(\theta) = \mathbb{E}_{\tau \sim p_\theta}\!\left[\sum_{t=0}^{T} \gamma^t r_t\right]" />
                . If you design a flawed reward function, the neural network will ruthlessly exploit
                it:
              </p>
              <div className="rl-three-col">
                <div className="rl-concept-card danger-border">
                  <h4>Pitfall A: Purely Sparse Terminal Reward</h4>
                  <p>
                    Suppose <TeX math="r_t = 0" /> for all steps <TeX math="t < T" />, and{' '}
                    <TeX math="r_T \in \{0, 1, 2, 3\}" /> stars at the end. An untrained policy
                    deploying troops randomly never achieves 50% or destroys the Town Hall. Every
                    rollout gets <TeX math="0" />—the gradient is identically zero!
                  </p>
                </div>
                <div className="rl-concept-card danger-border">
                  <h4>Pitfall B: Action-Spam Reward Hacking</h4>
                  <p>
                    Suppose we give <TeX math="+0.2" /> reward whenever the agent deploys a troop or
                    spell so it “does something”. The agent immediately learns to dump all 352
                    housing space and 11 spells on tick 1 into a single corner!
                  </p>
                </div>
                <div className="rl-concept-card success-border">
                  <h4>Solution: Telescoping Potential Deltas</h4>
                  <p>
                    By rewarding <strong>step-over-step deltas</strong>{' '}
                    <TeX math="\Delta\text{Destruction\%}_t" /> and <TeX math="\Delta\text{Stars}_t" />,
                    the telescoping sum across an episode is strictly bounded:{' '}
                    <TeX math="\sum_t \Delta\text{Dest\%}_t \le 100" /> and{' '}
                    <TeX math="\sum_t \Delta\text{Stars}_t \le 3" />.
                  </p>
                </div>
              </div>

              <div className="rl-equation-block">
                <TeX
                  block
                  math={String.raw`r_t = \underbrace{0.50 \cdot \left(\text{Dest\%}_t - \text{Dest\%}_{t-1}\right)}_{\text{Dense Progress (max }+50.0\text{)}} + \underbrace{\frac{50.0}{3} \cdot \left(\text{Stars}_t - \text{Stars}_{t-1}\right)}_{\text{Star Milestones (max }+50.0\text{)}} - \underbrace{0.05 \cdot \mathbb{I}[\text{invalid\_action}_t]}_{\text{Rule Penalty}}`}
                />
                <div className="rl-equation-legend">
                  <span>
                    <strong>Dense Progress (50 pts max):</strong> <TeX math="+0.50\text{ pts}" /> per{' '}
                    <TeX math="+1\%" /> building destruction gives immediate gradient feedback for
                    every building destroyed.
                  </span>
                  <span>
                    <strong>Star Milestones (50 pts max):</strong> <TeX math="+16.67\text{ pts}" />{' '}
                    per Star (50%, TH18 takedown, 100%) aligns the policy with official Clash war
                    rules.
                  </span>
                  <span>
                    <strong>Total Episode Scale:</strong> Perfectly balanced 50 / 50 split summing to
                    exactly <strong>+100.0 points</strong> for a flawless 3-star 100% wipe!
                  </span>
                </div>
              </div>
            </section>

            {/* INTERACTIVE LAB 3: BATTLE TIMELINE REWARD SIMULATOR */}
            <section className="rl-two-zone-sandbox">
              <div className="rl-sandbox-stage">
                <div className="rl-sandbox-header">
                  <div>
                    <span className="rl-sandbox-badge">INTERACTIVE LAB 3</span>
                    <h4>TH18 Battle Timeline & Reward Shaping Comparator</h4>
                  </div>
                  <div className="rl-toggle-row">
                    <button
                      className={`clash-btn ${rewardMode === 'th18' ? 'gold' : ''}`}
                      onClick={() => setRewardMode('th18')}
                    >
                      ✅ TH18 50/50 Delta Shaping
                    </button>
                    <button
                      className={`clash-btn ${rewardMode === 'sparse' ? 'gold' : ''}`}
                      onClick={() => setRewardMode('sparse')}
                    >
                      ❌ Sparse Terminal Only
                    </button>
                    <button
                      className={`clash-btn ${rewardMode === 'naive_spam' ? 'gold' : ''}`}
                      onClick={() => setRewardMode('naive_spam')}
                    >
                      ⚠️ Naïve Action-Spam Bonus
                    </button>
                  </div>
                </div>

                <p className="rl-sandbox-instruction">
                  Click any combat milestone below or adjust the shaping coefficients on the right to
                  inspect how instantaneous step rewards <TeX math="r_t" /> and cumulative episode
                  returns evolve across a battle:
                </p>

                <div className="rl-timeline-grid">
                  {computedTimeline.map((item, idx) => {
                    const isSelected = selectedTimelineStep === idx;
                    return (
                      <div
                        key={item.step}
                        onClick={() => setSelectedTimelineStep(idx)}
                        className={`rl-timeline-card ${isSelected ? 'active' : ''} ${
                          item.invalid ? 'invalid-step' : ''
                        }`}
                      >
                        <div className="rl-timeline-top">
                          <span className="rl-step-tag">
                            Step {item.step} (Tick {item.tick})
                          </span>
                          <span
                            className={`rl-reward-pill ${
                              item.stepReward > 0
                                ? 'pos'
                                : item.stepReward < 0
                                ? 'neg'
                                : 'zero'
                            }`}
                          >
                            rₜ = {item.stepReward >= 0 ? '+' : ''}
                            {item.stepReward.toFixed(2)}
                          </span>
                        </div>
                        <div className="rl-timeline-title">{item.title}</div>
                        <div className="rl-timeline-metrics">
                          <span>
                            Destruction: {item.prevPct}% → <strong>{item.newPct}%</strong> (Δ
                            {item.dPct >= 0 ? `+${item.dPct}%` : `${item.dPct}%`})
                          </span>
                          <span>
                            Stars: {'⭐'.repeat(item.newStars) || '0'} (Δ+{item.dStars})
                          </span>
                        </div>
                        <div className="rl-timeline-cum">
                          Cumulative Return <TeX math="\sum_{k \le t} r_k" />:{' '}
                          <strong>{item.cumulativeReward.toFixed(2)} pts</strong>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {computedTimeline[selectedTimelineStep] && (
                  <div className="rl-selected-step-inspector">
                    <div className="rl-inspector-header">
                      <strong>
                        🔍 Step {computedTimeline[selectedTimelineStep].step} Breakdown:{' '}
                        {computedTimeline[selectedTimelineStep].title}
                      </strong>
                      <code>{computedTimeline[selectedTimelineStep].actionDesc}</code>
                    </div>
                    <p>{computedTimeline[selectedTimelineStep].note}</p>
                    <div className="rl-inspector-math">
                      <TeX
                        math={`r_t = (${computedTimeline[selectedTimelineStep].dPct} \\times ${destWeight.toFixed(
                          2
                        )}) + (${computedTimeline[selectedTimelineStep].dStars} \\times ${starWeight.toFixed(
                          2
                        )}) - ${
                          computedTimeline[selectedTimelineStep].invalid
                            ? invalidPenalty.toFixed(2)
                            : '0.00'
                        } = \\mathbf{${
                          computedTimeline[selectedTimelineStep].stepReward >= 0 ? '+' : ''
                        }${computedTimeline[selectedTimelineStep].stepReward.toFixed(2)}\\text{ pts}}`}
                      />
                    </div>
                  </div>
                )}
              </div>

              <div className="rl-sandbox-controls">
                <h4>Tune Reward Hyperparameters</h4>
                <p className="rl-small-muted">
                  Experiment with the weights in <code>compute_custom_reward</code> (
                  <code>python/coc_rl/ppo.py</code>) and watch how they reshape the trajectory above:
                </p>

                <div className="rl-control-group">
                  <label>
                    <span>
                      Destruction % Weight (<TeX math="w_{\text{dest}}" />)
                    </span>
                    <strong className="rl-mono-num">{destWeight.toFixed(2)} pts / %</strong>
                  </label>
                  <input
                    type="range"
                    min={0.0}
                    max={1.5}
                    step={0.05}
                    value={destWeight}
                    onChange={(e) => setDestWeight(parseFloat(e.target.value))}
                  />
                  <span className="rl-control-hint">
                    Default: 0.50 (yields +50.0 pts at 100% destruction)
                  </span>
                </div>

                <div className="rl-control-group">
                  <label>
                    <span>
                      Star Milestone Bonus (<TeX math="w_{\text{star}}" />)
                    </span>
                    <strong className="rl-mono-num">{starWeight.toFixed(2)} pts / ⭐</strong>
                  </label>
                  <input
                    type="range"
                    min={0.0}
                    max={35.0}
                    step={0.5}
                    value={starWeight}
                    onChange={(e) => setStarWeight(parseFloat(e.target.value))}
                  />
                  <span className="rl-control-hint">
                    Default: <TeX math="50/3 \approx 16.67" /> (yields +50.0 pts for 3 Stars)
                  </span>
                </div>

                <div className="rl-control-group">
                  <label>
                    <span>
                      Invalid Action Penalty (<TeX math="w_{\text{pen}}" />)
                    </span>
                    <strong className="rl-mono-num">−{invalidPenalty.toFixed(2)} pts</strong>
                  </label>
                  <input
                    type="range"
                    min={0.0}
                    max={1.0}
                    step={0.05}
                    value={invalidPenalty}
                    onChange={(e) => setInvalidPenalty(parseFloat(e.target.value))}
                  />
                  <span className="rl-control-hint">
                    Default: −0.05 pts when an unmasked action fails engine checks
                  </span>
                </div>

                <button
                  className="clash-btn"
                  onClick={() => {
                    setDestWeight(0.5);
                    setStarWeight(16.67);
                    setInvalidPenalty(0.05);
                    setRewardMode('th18');
                  }}
                >
                  ↺ Reset to Production TH18 Weights (50 / 50 Split)
                </button>
              </div>
            </section>
          </div>
        )}

        {/* ===================================================================
            MODULE 4: ACTOR-CRITIC & GENERALIZED ADVANTAGE ESTIMATION (GAE)
           =================================================================== */}
        {activeModule === 'actor_critic_gae' && (
          <div className="rl-lecture-body">
            <section className="rl-prof-note">
              <div className="rl-prof-note-header">
                <span>
                  👨‍🏫 Professor’s Chalkboard: What Are the Actor & Critic, and How Does GAE Work?
                </span>
                <span className="rl-badge-concept">Bias-Variance Trade-Off</span>
              </div>
              <div className="rl-two-col">
                <div className="rl-concept-card">
                  <h4>
                    🎭 The Actor <TeX math="\pi_\theta(a_t \mid s_t)" />: The Tactical Commander
                  </h4>
                  <p>
                    Maps state <TeX math="s_t" /> to probability distributions over actions. It
                    updates its parameters <TeX math="\theta" /> to make actions with positive{' '}
                    <strong>Advantage</strong> (<TeX math="\hat{A}_t > 0" />) more probable and
                    actions with negative Advantage (<TeX math="\hat{A}_t < 0" />) less probable.
                  </p>
                </div>
                <div className="rl-concept-card">
                  <h4>
                    ⚖️ The Critic <TeX math="V_\phi(s_t)" />: The State Evaluator Baseline
                  </h4>
                  <p>
                    Outputs a single scalar <TeX math="V_\phi(s_t) \in \mathbb{R}" /> predicting the
                    expected future return from state <TeX math="s_t" />:{' '}
                    <em>“From this exact board state, how many more points will we score?”</em>{' '}
                    Trained via MSE against empirical returns <TeX math="\hat{R}_t" />.
                  </p>
                </div>
              </div>

              <p style={{ marginTop: '10px' }}>
                <strong>Why do we need the Critic?</strong> Suppose at step <TeX math="t" />, our
                army is already inside the core and about to score +40 points regardless of which
                minor troop we drop next. Without a baseline, a raw Monte Carlo return{' '}
                <TeX math="G_t = +40" /> would blindly praise <em>any</em> action taken at step{' '}
                <TeX math="t" />! By subtracting the Critic’s prediction{' '}
                <TeX math="V_\phi(s_t) = +38" />, we measure only the{' '}
                <strong>Temporal Difference (TD) surprise</strong>{' '}
                <TeX math="\delta_t = r_t + \gamma V_\phi(s_{t+1}) - V_\phi(s_t)" />:
              </p>

              <div className="rl-equation-block">
                <TeX
                  block
                  math={String.raw`\delta_t = r_t + \gamma (1 - d_t) V_\phi(s_{t+1}) - V_\phi(s_t) \quad \Longrightarrow \quad \hat{A}_t^{\text{GAE}(\gamma,\lambda)} = \sum_{l=0}^{T-t-1} (\gamma \lambda)^l \delta_{t+l} = \delta_t + \gamma \lambda (1 - d_t) \hat{A}_{t+1}^{\text{GAE}}`}
                />
                <div className="rl-equation-legend">
                  <span>
                    <TeX math="\lambda = 0" /> <strong>(1-Step TD):</strong>{' '}
                    <TeX math="\hat{A}_t = \delta_t" /> (Low variance, but biased if Critic{' '}
                    <TeX math="V_\phi" /> is still inaccurate).
                  </span>
                  <span>
                    <TeX math="\lambda = 1" /> <strong>(Monte Carlo):</strong>{' '}
                    <TeX math="\hat{A}_t = G_t - V_\phi(s_t)" /> (Unbiased, but noisy over 225
                    steps).
                  </span>
                  <span>
                    <strong>TH18 Production Setting (</strong>
                    <TeX math="\gamma = 0.99,\; \lambda = 0.95" />
                    <strong>):</strong> Smoothly propagates Town Hall & Star rewards backward across
                    ~20–40 decision steps!
                  </span>
                </div>
              </div>
            </section>

            {/* INTERACTIVE LAB 4: 5-STEP TRAJECTORY GAE CALCULATOR */}
            <section className="rl-two-zone-sandbox">
              <div className="rl-sandbox-stage">
                <div className="rl-sandbox-header">
                  <div>
                    <span className="rl-sandbox-badge">INTERACTIVE LAB 4</span>
                    <h4>
                      Backward-Recursion GAE(γ, λ) & TD-Residual Calculator (5-Step Combat Rollout)
                    </h4>
                  </div>
                  <div className="rl-toggle-row">
                    <button
                      className={`clash-btn ${gaeLambda === 0 ? 'gold' : ''}`}
                      onClick={() => setGaeLambda(0.0)}
                    >
                      λ = 0.00 (Pure 1-Step TD)
                    </button>
                    <button
                      className={`clash-btn ${gaeLambda === 0.95 ? 'gold' : ''}`}
                      onClick={() => setGaeLambda(0.95)}
                    >
                      λ = 0.95 (TH18 GAE Default)
                    </button>
                    <button
                      className={`clash-btn ${gaeLambda === 1.0 ? 'gold' : ''}`}
                      onClick={() => setGaeLambda(1.0)}
                    >
                      λ = 1.00 (Monte Carlo)
                    </button>
                  </div>
                </div>

                <p className="rl-sandbox-instruction">
                  Notice step <TeX math="t = 3" /> below where the Town Hall falls for a huge reward
                  (<TeX math="r_3 = +20.67" />
                  ). Switch <TeX math="\lambda" /> between <code>0.00</code> and <code>0.95</code>{' '}
                  to see how GAE propagates credit backward to the Wall Breaker deployed at{' '}
                  <TeX math="t = 0" /> and <TeX math="t = 1" />!
                </p>

                <div className="rl-logit-table-wrap">
                  <table className="rl-logit-table">
                    <thead>
                      <tr>
                        <th>
                          Step <TeX math="t" />
                        </th>
                        <th>
                          Reward <TeX math="r_t" /> (Editable)
                        </th>
                        <th>
                          Critic <TeX math="V_\phi(s_t)" /> (Editable)
                        </th>
                        <th>
                          TD Surprise <TeX math="\delta_t" />
                        </th>
                        <th>
                          GAE Advantage <TeX math="\hat{A}_t^{\text{GAE}}" />
                        </th>
                        <th>
                          Normalized <TeX math="\tilde{A}_t" />
                        </th>
                        <th>
                          Critic Target <TeX math="\hat{R}_t = \hat{A}_t + V_\phi(s_t)" />
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {trajRewards.map((r, t) => {
                        const delta = gaeComputation.deltas[t];
                        const adv = gaeComputation.advantages[t];
                        const normAdv = gaeComputation.normAdvantages[t];
                        const ret = gaeComputation.returns[t];
                        return (
                          <tr key={t}>
                            <td>
                              <strong>t = {t}</strong>
                              <div className="rl-small-muted">
                                {t === 0
                                  ? 'Deploy Wall Breaker'
                                  : t === 1
                                  ? 'NoOp (Units walk)'
                                  : t === 2
                                  ? 'Drop Rage Spell'
                                  : t === 3
                                  ? '🏰 TH18 Destroyed!'
                                  : 'Cleanup Hut'}
                              </div>
                            </td>
                            <td>
                              <input
                                type="number"
                                step={0.5}
                                className="rl-num-input"
                                value={r}
                                onChange={(e) => {
                                  const v = parseFloat(e.target.value) || 0;
                                  setTrajRewards((prev) =>
                                    prev.map((item, idx) => (idx === t ? v : item))
                                  );
                                }}
                              />
                            </td>
                            <td>
                              <input
                                type="number"
                                step={0.5}
                                className="rl-num-input"
                                value={trajValues[t]}
                                onChange={(e) => {
                                  const v = parseFloat(e.target.value) || 0;
                                  setTrajValues((prev) =>
                                    prev.map((item, idx) => (idx === t ? v : item))
                                  );
                                }}
                              />
                            </td>
                            <td className={`rl-mono-num ${delta >= 0 ? 'text-green' : 'text-red'}`}>
                              {delta >= 0 ? '+' : ''}
                              {delta.toFixed(2)}
                            </td>
                            <td className={`rl-mono-num ${adv >= 0 ? 'text-gold' : 'text-red'}`}>
                              <strong>
                                {adv >= 0 ? '+' : ''}
                                {adv.toFixed(2)}
                              </strong>
                            </td>
                            <td className="rl-mono-num">
                              {normAdv >= 0 ? '+' : ''}
                              {normAdv.toFixed(2)}σ
                            </td>
                            <td className="rl-mono-num">{ret.toFixed(2)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="rl-sandbox-controls">
                <h4>GAE Hyperparameter Controls</h4>
                <div className="rl-control-group">
                  <label>
                    <span>
                      Discount Factor (<TeX math="\gamma" />)
                    </span>
                    <strong className="rl-mono-num">{gaeGamma.toFixed(2)}</strong>
                  </label>
                  <input
                    type="range"
                    min={0.8}
                    max={1.0}
                    step={0.01}
                    value={gaeGamma}
                    onChange={(e) => setGaeGamma(parseFloat(e.target.value))}
                  />
                  <span className="rl-control-hint">
                    Controls how much future rewards are discounted per step (0.99 in TH18).
                  </span>
                </div>

                <div className="rl-control-group">
                  <label>
                    <span>
                      GAE Exponential Decay (<TeX math="\lambda" />)
                    </span>
                    <strong className="rl-mono-num">{gaeLambda.toFixed(2)}</strong>
                  </label>
                  <input
                    type="range"
                    min={0.0}
                    max={1.0}
                    step={0.05}
                    value={gaeLambda}
                    onChange={(e) => setGaeLambda(parseFloat(e.target.value))}
                  />
                  <span className="rl-control-hint">
                    Effective lookahead horizon <TeX math="\approx \frac{1}{1 - \gamma\lambda} =" />{' '}
                    {(1 / Math.max(0.001, 1 - gaeGamma * gaeLambda)).toFixed(1)} steps.
                  </span>
                </div>

                <div className="rl-control-group">
                  <label>
                    <span>
                      Terminal Episode Flag at <TeX math="t = 4" /> (<TeX math="d_4" />)
                    </span>
                    <button
                      type="button"
                      className={`clash-btn ${episodeTerminalLast ? 'green' : ''}`}
                      onClick={() => setEpisodeTerminalLast(!episodeTerminalLast)}
                    >
                      {episodeTerminalLast ? 'Done = True (1 − d₄ = 0)' : 'Truncated (Bootstrap V)'}
                    </button>
                  </label>
                </div>

                {!episodeTerminalLast && (
                  <div className="rl-control-group">
                    <label>
                      <span>
                        Bootstrap Value <TeX math="V_\phi(s_5)" />
                      </span>
                      <strong className="rl-mono-num">{bootstrapNextVal.toFixed(1)}</strong>
                    </label>
                    <input
                      type="range"
                      min={0}
                      max={30}
                      step={1}
                      value={bootstrapNextVal}
                      onChange={(e) => setBootstrapNextVal(parseFloat(e.target.value))}
                    />
                  </div>
                )}
              </div>
            </section>
          </div>
        )}

        {/* ===================================================================
            MODULE 5: PPO VS VANILLA REINFORCEMENT LEARNING
           =================================================================== */}
        {activeModule === 'ppo_vs_vanilla' && (
          <div className="rl-lecture-body">
            <section className="rl-prof-note">
              <div className="rl-prof-note-header">
                <span>
                  👨‍🏫 Professor’s Chalkboard: Why Vanilla RL Collapses & How PPO Fixes It
                </span>
                <span className="rl-badge-concept">Clipped Surrogate Trust Region</span>
              </div>
              <p>
                In <strong>Vanilla Policy Gradient (REINFORCE / A2C)</strong>, we update the policy
                by ascending the gradient of{' '}
                <TeX math="L^{\text{PG}}(\theta) = \hat{\mathbb{E}}_t\!\left[\log \pi_\theta(a_t \mid s_t)\,\hat{A}_t\right]" />
                . Why is that fatally unstable for complex strategy games like Clash of Clans?
              </p>
              <div className="rl-two-col">
                <div className="rl-concept-card danger-border">
                  <h4>1. The Deadly Feedback Loop of Vanilla RL</h4>
                  <p>
                    Running a 1,800-tick Rust battle simulation takes precious CPU/GPU cycles, so we
                    want to run <strong>4 epochs of minibatch gradient updates</strong> on each
                    collected rollout buffer. In Vanilla PG, taking multiple steps on the same sample
                    pushes <TeX math="\pi_\theta(a_t \mid s_t) \to 1.0" /> or{' '}
                    <TeX math="0.0" />, causing a massive policy shift that ruins the next batch of
                    rollouts!
                  </p>
                </div>
                <div className="rl-concept-card success-border">
                  <h4>2. PPO’s Importance Sampling & Pessimistic Clipping</h4>
                  <p>
                    PPO measures the probability ratio{' '}
                    <TeX math="r_t(\theta) = \frac{\pi_\theta(a_t \mid s_t)}{\pi_{\theta_{\text{old}}}(a_t \mid s_t)}" />{' '}
                    and clips it to <TeX math="[1 - \epsilon,\, 1 + \epsilon] = [0.80,\, 1.20]" />.
                    Once an action’s probability has changed by more than ±20% in the favorable
                    direction, the <TeX math="\min(\cdot)" /> operator flattens the objective so{' '}
                    <TeX math="\nabla_\theta L^{\text{CLIP}} = 0" />!
                  </p>
                </div>
              </div>

              <div className="rl-equation-block">
                <TeX
                  block
                  math={String.raw`r_t(\theta) = \exp\!\left(\log \pi_\theta(a_t \mid s_t) - \log \pi_{\theta_{\text{old}}}(a_t \mid s_t)\right), \qquad L^{\text{CLIP}}(\theta) = -\hat{\mathbb{E}}_t\!\left[\min\!\left(r_t(\theta)\hat{A}_t,\;\text{clip}\!\left(r_t(\theta), 1-\epsilon, 1+\epsilon\right)\hat{A}_t\right)\right]`}
                />
                <div className="rl-equation-legend">
                  <span>
                    <strong>Total Joint Loss:</strong>{' '}
                    <TeX math="\mathcal{L}_{\text{total}} = L^{\text{CLIP}}(\theta) + 0.5 \cdot \tfrac{1}{2}(V_\phi(s_t) - \hat{R}_t)^2 - 0.015 \cdot \mathcal{H}(\pi_\theta(\cdot \mid s_t))" />
                  </span>
                  <span>
                    <strong>Safety Brake:</strong> Target-KL Early Stopping aborts remaining epochs
                    if <TeX math="\text{KL}_{\text{approx}} = \hat{\mathbb{E}}[(r_t - 1) - \log r_t] > 0.045" />.
                  </span>
                </div>
              </div>
            </section>

            {/* INTERACTIVE LAB 5: PPO CLIPPED SURROGATE PLOTTER */}
            <section className="rl-two-zone-sandbox">
              <div className="rl-sandbox-stage">
                <div className="rl-sandbox-header">
                  <div>
                    <span className="rl-sandbox-badge">INTERACTIVE LAB 5</span>
                    <h4>
                      Interactive PPO Trust-Region Curve: Vanilla PG vs. Clipped Surrogate Objective
                    </h4>
                  </div>
                  <div className="rl-toggle-row">
                    <button
                      className={`clash-btn ${ppoAdvantage > 0 ? 'green' : ''}`}
                      onClick={() => {
                        setPpoAdvantage(1.5);
                        setOldProb(0.25);
                        setNewProb(0.34);
                      }}
                    >
                      Case A: Good Action (Âₜ = +1.50 &gt; 0)
                    </button>
                    <button
                      className={`clash-btn ${ppoAdvantage < 0 ? 'danger' : ''}`}
                      onClick={() => {
                        setPpoAdvantage(-1.5);
                        setOldProb(0.30);
                        setNewProb(0.20);
                      }}
                    >
                      Case B: Bad Action (Âₜ = −1.50 &lt; 0)
                    </button>
                  </div>
                </div>

                {/* SVG PLOT OF r_t(theta) vs OBJECTIVE */}
                <div className="rl-ppo-chart-wrap">
                  <svg viewBox="0 0 620 260" className="rl-ppo-svg">
                    {(() => {
                      const xFromR = (r: number) => 60 + ((r - 0.2) / 1.8) * 520;
                      const yFromObj = (val: number) => 130 - (val / 3.5) * 100;

                      const xClipLow = xFromR(1 - ppoEpsilon);
                      const xClipHigh = xFromR(1 + ppoEpsilon);
                      const xOne = xFromR(1.0);

                      const vanillaPts: string[] = [];
                      const ppoPts: string[] = [];
                      for (let i = 0; i <= 90; i++) {
                        const r = 0.2 + (i / 90) * 1.8;
                        const unclip = r * ppoAdvantage;
                        const clipR = Math.max(1 - ppoEpsilon, Math.min(1 + ppoEpsilon, r));
                        const ppoVal = Math.min(unclip, clipR * ppoAdvantage);
                        vanillaPts.push(`${xFromR(r).toFixed(1)},${yFromObj(unclip).toFixed(1)}`);
                        ppoPts.push(`${xFromR(r).toFixed(1)},${yFromObj(ppoVal).toFixed(1)}`);
                      }

                      const curX = xFromR(Math.max(0.2, Math.min(2.0, ppoMetrics.ratio)));
                      const curY = yFromObj(ppoMetrics.surrogateObj);

                      return (
                        <>
                          <rect
                            x={xClipLow}
                            y={20}
                            width={xClipHigh - xClipLow}
                            height={210}
                            fill="rgba(56, 189, 248, 0.12)"
                            stroke="rgba(56, 189, 248, 0.4)"
                            strokeDasharray="4 4"
                          />
                          <line x1={60} y1={130} x2={580} y2={130} stroke="#475569" strokeWidth={1.5} />
                          <line x1={xOne} y1={20} x2={xOne} y2={230} stroke="#64748b" strokeDasharray="3 3" />

                          <polyline
                            fill="none"
                            stroke="#94a3b8"
                            strokeWidth={2}
                            strokeDasharray="6 4"
                            points={vanillaPts.join(' ')}
                          />

                          <polyline
                            fill="none"
                            stroke="#facc15"
                            strokeWidth={3.5}
                            points={ppoPts.join(' ')}
                          />

                          <circle
                            cx={curX}
                            cy={curY}
                            r={7}
                            fill={ppoMetrics.isClippedGradZero ? '#f87171' : '#4ade80'}
                            stroke="#0f172a"
                            strokeWidth={2}
                          />

                          <text x={xClipLow} y={246} fill="#38bdf8" fontSize="11" textAnchor="middle">
                            1−ε ({(1 - ppoEpsilon).toFixed(2)})
                          </text>
                          <text x={xOne} y={246} fill="#cbd5e1" fontSize="11" textAnchor="middle">
                            rₜ(θ) = 1.0
                          </text>
                          <text x={xClipHigh} y={246} fill="#38bdf8" fontSize="11" textAnchor="middle">
                            1+ε ({(1 + ppoEpsilon).toFixed(2)})
                          </text>
                          <text x={72} y={36} fill="#facc15" fontSize="12" fontWeight="bold">
                            — PPO Pessimistic Bound min(rₜ·Âₜ, clip(rₜ)·Âₜ)
                          </text>
                          <text x={72} y={54} fill="#94a3b8" fontSize="11">
                            --- Vanilla Unclipped Objective (rₜ · Âₜ)
                          </text>
                        </>
                      );
                    })()}
                  </svg>
                </div>

                <div className="rl-ppo-readout-grid">
                  <div className="rl-ppo-stat">
                    <span>
                      Importance Ratio <TeX math="r_t(\theta)" />
                    </span>
                    <strong className="rl-mono-num">{ppoMetrics.ratio.toFixed(3)}</strong>
                    <small>
                      <TeX math="\pi_\theta / \pi_{\theta_{\text{old}}} =" />{' '}
                      {(newProb / oldProb).toFixed(3)}
                    </small>
                  </div>
                  <div className="rl-ppo-stat">
                    <span>
                      Unclipped (<TeX math="r_t \hat{A}_t" />)
                    </span>
                    <strong className="rl-mono-num">{ppoMetrics.unclippedTerm.toFixed(3)}</strong>
                    <small>Vanilla Policy Gradient term</small>
                  </div>
                  <div className="rl-ppo-stat">
                    <span>
                      Clipped (<TeX math="\text{clip}(r_t)\hat{A}_t" />)
                    </span>
                    <strong className="rl-mono-num">{ppoMetrics.clippedTerm.toFixed(3)}</strong>
                    <small>
                      Bounded to [{1 - ppoEpsilon}, {1 + ppoEpsilon}]
                    </small>
                  </div>
                  <div className="rl-ppo-stat">
                    <span>
                      Gradient Status <TeX math="\nabla_\theta L^{\text{CLIP}}" />
                    </span>
                    <strong className={ppoMetrics.isClippedGradZero ? 'text-red' : 'text-green'}>
                      {ppoMetrics.isClippedGradZero
                        ? '🛑 CLIPPED (Gradient = 0)'
                        : '🟢 ACTIVE (Updating θ)'}
                    </strong>
                    <small>Approx KL = {ppoMetrics.approxKl.toFixed(4)}</small>
                  </div>
                </div>
              </div>

              <div className="rl-sandbox-controls">
                <h4>Manipulate Policy Update Step</h4>
                <div className="rl-control-group">
                  <label>
                    <span>
                      Old Policy Prob <TeX math="\pi_{\theta_{\text{old}}}(a_t \mid s_t)" />
                    </span>
                    <strong className="rl-mono-num">{(oldProb * 100).toFixed(0)}%</strong>
                  </label>
                  <input
                    type="range"
                    min={0.05}
                    max={0.8}
                    step={0.01}
                    value={oldProb}
                    onChange={(e) => setOldProb(parseFloat(e.target.value))}
                  />
                </div>

                <div className="rl-control-group">
                  <label>
                    <span>
                      New Policy Prob <TeX math="\pi_\theta(a_t \mid s_t)" />
                    </span>
                    <strong className="rl-mono-num">{(newProb * 100).toFixed(0)}%</strong>
                  </label>
                  <input
                    type="range"
                    min={0.05}
                    max={0.8}
                    step={0.01}
                    value={newProb}
                    onChange={(e) => setNewProb(parseFloat(e.target.value))}
                  />
                </div>

                <div className="rl-control-group">
                  <label>
                    <span>
                      Normalized Advantage <TeX math="\hat{A}_t" />
                    </span>
                    <strong className="rl-mono-num">
                      {ppoAdvantage >= 0 ? '+' : ''}
                      {ppoAdvantage.toFixed(2)}
                    </strong>
                  </label>
                  <input
                    type="range"
                    min={-2.5}
                    max={2.5}
                    step={0.1}
                    value={ppoAdvantage}
                    onChange={(e) => setPpoAdvantage(parseFloat(e.target.value))}
                  />
                </div>

                <div className="rl-control-group">
                  <label>
                    <span>
                      PPO Clipping Threshold (<TeX math="\epsilon" />)
                    </span>
                    <strong className="rl-mono-num">{ppoEpsilon.toFixed(2)}</strong>
                  </label>
                  <input
                    type="range"
                    min={0.05}
                    max={0.4}
                    step={0.05}
                    value={ppoEpsilon}
                    onChange={(e) => setPpoEpsilon(parseFloat(e.target.value))}
                  />
                </div>

                <div className="rl-callout-box">
                  <strong>💡 Professor’s Insight:</strong> Drag{' '}
                  <TeX math="\pi_\theta(a_t \mid s_t)" /> high when <TeX math="\hat{A}_t > 0" />. As
                  soon as <TeX math="r_t(\theta) > 1 + \epsilon" />, the yellow curve goes flat!
                  That flat plateau means <TeX math="\nabla_\theta L^{\text{CLIP}} = 0" />: PPO
                  refuses to greedily over-update on a single lucky batch.
                </div>
              </div>
            </section>
          </div>
        )}

        {/* ===================================================================
            MODULE 6: END-TO-END PPO PIPELINE, CODE TRACE & MASTERY EXAM
           =================================================================== */}
        {activeModule === 'code_and_exam' && (
          <div className="rl-lecture-body">
            <section className="rl-prof-note">
              <div className="rl-prof-note-header">
                <span>
                  👨‍🏫 Professor’s Chalkboard: Putting the End-to-End PPO Pipeline Together
                </span>
                <span className="rl-badge-concept">Rollout → GAE → Clipped PPO</span>
              </div>
              <p>
                In the Town Hall 18 AI Studio (<code>python/train_ai.py</code>,{' '}
                <code>python/coc_rl/networks.py</code>, and <code>python/coc_rl/ppo.py</code>), each
                training batch executes a three-stage optimization loop for{' '}
                <code>CoCActorCritic</code>:
              </p>
              <div className="rl-three-col">
                <div className="rl-concept-card">
                  <h4>1. Trajectory Rollout Collection</h4>
                  <p>
                    <code>CoCAttackerEnv</code> steps the deterministic Rust combat simulator while{' '}
                    <code>CoCActorCritic</code> samples masked actions{' '}
                    <TeX math="a_t \sim \pi_{\theta_{\text{old}}}(a_t \mid s_t)" /> and records{' '}
                    <TeX math="(s_t, a_t, r_t, V_t, \log \pi_t)" />.
                  </p>
                </div>
                <div className="rl-concept-card">
                  <h4>2. Backward GAE(γ, λ) Advantage Pass</h4>
                  <p>
                    <code>compute_gae</code> recurses backward from terminal state{' '}
                    <TeX math="t = T-1 \dots 0" /> to compute low-variance advantages{' '}
                    <TeX math="\hat{A}_t^{\text{GAE}}" /> and value targets{' '}
                    <TeX math="\hat{R}_t = \hat{A}_t + V(s_t)" />.
                  </p>
                </div>
                <div className="rl-concept-card">
                  <h4>3. Shuffled Minibatch PPO Update</h4>
                  <p>
                    <code>ppo_minibatch_update</code> normalizes advantages and runs multi-epoch
                    clipped surrogate updates with normalized per-head entropy regularization and
                    Target-KL early stopping.
                  </p>
                </div>
              </div>
            </section>

            {/* SIDE-BY-SIDE GRADUATE MASTERY QUIZ */}
            <section className="rl-section-panel">
              <div className="rl-sandbox-header">
                <div>
                  <span className="rl-sandbox-badge">GRADUATE MASTERY CHECK</span>
                  <h3>Test Your Mathematical & Architectural Understanding (5 Questions)</h3>
                </div>
                <span className="rl-gold-num">
                  Score:{' '}
                  {
                    EXAM_QUESTIONS.filter(
                      (q) => selectedAnswers[q.id] === q.correctIdx
                    ).length
                  }{' '}
                  / {EXAM_QUESTIONS.length}
                </span>
              </div>

              <div className="rl-exam-list">
                {EXAM_QUESTIONS.map((q) => {
                  const chosen = selectedAnswers[q.id];
                  const isAnswered = chosen !== undefined;
                  const isCorrect = chosen === q.correctIdx;

                  return (
                    <div key={q.id} className="rl-exam-card">
                      <div className="rl-exam-q">
                        <span className="rl-exam-qnum">Q{q.id}</span>
                        <strong>
                          <MathText text={q.question} />
                        </strong>
                      </div>
                      <div className="rl-exam-options">
                        {q.options.map((opt, idx) => {
                          const isThisSelected = chosen === idx;
                          const showCorrect = isAnswered && idx === q.correctIdx;
                          const showWrong = isThisSelected && !isCorrect;
                          return (
                            <button
                              key={idx}
                              type="button"
                              className={`rl-exam-opt ${
                                showCorrect
                                  ? 'correct'
                                  : showWrong
                                  ? 'wrong'
                                  : isThisSelected
                                  ? 'selected'
                                  : ''
                              }`}
                              onClick={() =>
                                setSelectedAnswers((prev) => ({ ...prev, [q.id]: idx }))
                              }
                            >
                              <span className="rl-opt-letter">
                                {String.fromCharCode(65 + idx)}
                              </span>
                              <span>
                                <MathText text={opt} />
                              </span>
                            </button>
                          );
                        })}
                      </div>
                      {isAnswered && (
                        <div
                          className={`rl-exam-feedback ${
                            isCorrect ? 'feedback-ok' : 'feedback-err'
                          }`}
                        >
                          <strong>
                            {isCorrect ? '✓ Correct! ' : '✗ Not quite — here is the proof: '}
                          </strong>
                          <MathText text={q.explanation} />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>
          </div>
        )}
      </main>
    </div>
  );
};
