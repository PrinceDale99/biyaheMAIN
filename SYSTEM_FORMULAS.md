# Biyahe Protocol: Core System Algorithms & Mathematical Models

This document outlines the complex mathematical models and algorithms that govern the Biyahe platform's backend ecosystem. These formulas determine optimal routing, dynamic trust scoring, and the automated distribution of XLM rewards via smart contracts.

---

## 1. Dynamic Route Optimization & Cost Function

The routing engine calculates the optimal path by minimizing a time-dependent, multi-variable cost function across a directed graph $G = (V, E)$, where $V$ represents geographic nodes and $E$ represents road segments.

### The Objective Function
The total cost $C(R)$ for a given route $R = \{v_1, v_2, \dots, v_n\}$ departing at time $t_0$ is minimized:

$$ \min_{R} C(R) = \sum_{i=1}^{n-1} \mathcal{W}(v_i, v_{i+1}, t_i) $$

Where the weight function $\mathcal{W}$ for a single edge is defined as:

$$ \mathcal{W}(u, v, t) = \alpha \cdot \mathcal{D}_{hav}(u, v) + \beta \cdot \mathcal{T}(u, v, t) + \gamma \cdot \mathcal{R}_{p}(u, v) + \delta \cdot \mathcal{E}(u, v) $$

**Variables & Parameters:**
*   $\mathcal{D}_{hav}(u, v)$: The Haversine distance between nodes $u$ and $v$.
*   $\mathcal{T}(u, v, t)$: The predictive traffic delay function at the estimated time of arrival $t$.
*   $\mathcal{R}_{p}(u, v)$: Static road penalty (e.g., tolls, road quality, unpaved terrain).
*   $\mathcal{E}(u, v)$: Elevation change penalty (applicable for non-motorized transport).
*   $\alpha, \beta, \gamma, \delta$: System-tuned weighting coefficients based on user preferences (e.g., fastest vs. shortest).

The estimated arrival time $t_i$ at node $v_i$ is computed recursively:
$$ t_i = t_{i-1} + \frac{\mathcal{D}_{hav}(v_{i-1}, v_i)}{\mathcal{V}_{avg}(v_{i-1}, v_i, t_{i-1})} $$

---

## 2. Sybil-Resistant Trust Score (Reputation) Calculation

To maintain a high-quality network, users and contributors are assigned a dynamic Trust Score $T(u) \in [0, 100]$. This score employs an Exponential Moving Average (EMA) to heavily weight recent behavior while applying a time-decay penalty for inactivity.

### The Trust Equation
The updated Trust Score for user $u$ at time $t$ is:

$$ T(u)_t = \max\left( 0, \min\left( 100, \left[ \lambda \cdot T(u)_{t-1} + (1-\lambda) \cdot \Omega(u)_t \right] \cdot \Psi(u, t) \right) \right) $$

**The Weighted Rating Component $\Omega(u)_t$:**
Ratings are weighted by the trust score of the user providing the rating ($w_k \propto T(rater_k)$):

$$ \Omega(u)_t = \frac{\sum_{k=1}^{N_t} \left( \sigma(T(rater_k)) \cdot r_k \cdot e^{-\mu \Delta \tau_k} \right)}{\sum_{k=1}^{N_t} \left( \sigma(T(rater_k)) \cdot e^{-\mu \Delta \tau_k} \right)} $$

**The Inactivity Decay Function $\Psi(u, t)$:**
Penalizes accounts that have not participated in the ecosystem over time:

$$ \Psi(u, t) = \exp\left( - \kappa \cdot \max\left(0, \frac{t_{current} - t_{last\_active} - \tau_{grace}}{\tau_{max}}\right) \right) $$

**Variables & Parameters:**
*   $\lambda$: Historical retention factor (e.g., 0.85).
*   $\sigma(x)$: Sigmoid function to normalize rater authority.
*   $r_k$: Individual feedback rating provided by peers.
*   $\mu$: Recency bias for individual ratings.
*   $\kappa$: Decay acceleration constant.

---

## 3. Stellar Smart Contract: XLM Reward Distribution

The platform incentivizes ecosystem growth by programmatically distributing XLM from a decentralized treasury pool. The payout $X(u, c)$ for a valid contribution $c$ by user $u$ during epoch $E$ is calculated dynamically.

### The Payout Formula
The base reward is scaled logarithmically by the user's Trust Score to prevent runaway monopolization, and normalized against the epoch's total network activity.

$$ X(u, c)_E = \left\lfloor \left( \mathcal{B}_{pool}^E \cdot \mathcal{F}_{mint} \right) \cdot \frac{\Phi(c) \cdot \Gamma(T(u))}{\sum_{j \in \mathcal{A}_E} \left( \Phi(j) \cdot \Gamma(T(j)) \right)} \right\rfloor $$

**The Trust Multiplier $\Gamma(x)$:**
$$ \Gamma(x) = 1 + \theta \cdot \ln\left(1 + \frac{x}{10}\right) $$

**Contribution Value Function $\Phi(c)$:**
Determines the raw base value of the contribution based on data scarcity and complexity:
$$ \Phi(c) = \mathcal{V}_{base} \cdot \left( 1 + \eta \cdot \mathcal{S}_{zone}(c_{loc}) \right) \cdot \Pi(c_{quality}) $$

**Variables & Parameters:**
*   $\mathcal{B}_{pool}^E$: Total XLM available in the smart contract treasury for epoch $E$.
*   $\mathcal{F}_{mint}$: Max emission fraction per epoch to prevent treasury depletion (e.g., 0.05).
*   $\mathcal{A}_E$: Set of all verified contributions processed by the oracle network in epoch $E$.
*   $\theta$: Trust scaling factor.
*   $\mathcal{S}_{zone}$: Scarcity multiplier for data provided in under-mapped geographic zones.
*   $\Pi$: Automated quality assessment score assigned to the contribution by consensus.
*   $\lfloor \dots \rfloor$: Floor function applied to ensure integer stroop calculations on the Stellar network.
