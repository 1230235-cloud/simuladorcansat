# Mathematical & Physical Verification Contract (`AUDITORIA.md`)

All Vitest suites in `tests/` must enforce these exact equations and numerical bounds before approving any implementation by Gemini Flash.

---

## 1. Dimensional & Mass Budget Invariants (`tests/assembly.test.ts` & `tests/massProperties.test.ts`)

### 1.1 Regulatory Envelope & Power Source
- **Total Coupled Mass:**
  $$M_{total} = M_1 + M_2 = \sum_{i \in \text{Primary}} m_i + \sum_{j \in \text{Secondary}} m_j \le 0.600\text{ kg}$$
- **Biological Payloads (Two Chicken Eggs):**
  $$m_{\text{egg},1} = 0.065\text{ kg} \subset M_1, \quad m_{\text{egg},2} = 0.065\text{ kg} \subset M_2 \quad (m_{\text{eggs,total}} = 0.130\text{ kg})$$
- **Geometric Limits:**
  $$H_{total} \in [0.20, 0.23]\text{ m}, \quad D \in [0.09, 0.10]\text{ m}, \quad H_1 \le 0.16\text{ m}, \quad H_2 \le 0.07\text{ m}$$
- **Power Constraint:** Every battery component must satisfy `battery.type === "9V_PP3"`. Any LiPo/Li-Ion or active rotor motor throws a validation error.

### 1.2 Composite Center of Mass & Separation Shift ($\Delta \vec{R}_{CoM}$)
- **Coupled CoM ($h > 200\text{ m}$):**
  $$\vec{R}_{CoM}^{(0)} = \frac{1}{M_1 + M_2} \left( \sum_{i \in \text{Primary}} m_i \vec{r}_i + \sum_{j \in \text{Secondary}} m_j \vec{r}_j \right)$$
- **Primary CoM Post-Separation ($h \le 200\text{ m}$, including deployed blades):**
  $$\vec{R}_{CoM}^{(1)} = \frac{1}{M_1} \sum_{i \in \text{Primary}} m_i \vec{r}_i'$$
- **Exact CoM Shift Vector:**
  $$\Delta \vec{R}_{CoM} = \vec{R}_{CoM}^{(1)} - \vec{R}_{CoM}^{(0)} = \frac{M_2}{M_1 + M_2}\left(\vec{R}_{CoM}^{(1)} - \vec{R}_{CoM}^{(2)}\right)$$
- **Axial Moment of Inertia ($I_{zz}$) via Parallel Axis Theorem:**
  $$I_{zz} = \sum_{k} \left( I_{zz,k}^{\text{local}} + m_k \left[ (x_k - X_{CoM})^2 + (y_k - Y_{CoM})^2 \right] \right)$$
  For $N_b$ deployed rectangular blades of mass $m_b$, root offset $r_0$, and tip radius $R$:
  $$I_{zz,\text{blades}} = N_b m_b \left( \frac{1}{3}(R^2 + R r_0 + r_0^2) \right)$$

---

## 2. Mechanical Decoupling at $h = 200\text{ m}$ (`tests/autorotation.test.ts`)

When the release servo triggers at $h_{sep} = 200\text{ m}$ with pre-separation vertical velocity $V_{z,0}$ and internal spring impulse $J_{sep}$:
- **Linear Momentum Conservation:**
  $$(M_1 + M_2) V_{z,0} = M_1 V_{z,1}^{+} + M_2 V_{z,2}^{+}$$
  $$V_{z,1}^{+} = V_{z,0} - \frac{J_{sep}}{M_1}, \quad V_{z,2}^{+} = V_{z,0} + \frac{J_{sep}}{M_2}$$
  *(With downward $+z$ convention; unit test tolerance: $|\Delta p_z| < 10^{-9}\text{ N}\cdot\text{s}$).*

---

## 3. Passive Autorotation Dynamics for Primary Payload (`tests/autorotation.test.ts`)

### 3.1 Blade Element Inflow & Aerodynamic Torques
At radial station $r \in [r_0, R]$ with axial descent speed $V_z$, angular velocity $\omega$, inflow angle $\phi(r) = \arctan\left(\frac{V_z}{\omega r}\right)$, and blade pitch angle $\theta$ (measured from rotation plane):
- **Effective Angle of Attack:**
  $$\alpha_{\text{eff}}(r) = \phi(r) - \theta = \arctan\left(\frac{V_z}{\omega r}\right) - \theta$$
- **Differential Thrust & Net Autorotative Torque ($N_b$ blades, chord $c$):**
  $$dL = \frac{1}{2}\rho W^2 c C_L(\alpha_{\text{eff}})\,dr, \quad dD = \frac{1}{2}\rho W^2 c C_D(\alpha_{\text{eff}})\,dr, \quad W^2 = V_z^2 + (\omega r)^2$$
  $$dT_z = N_b \left( dL \cos\phi + dD \sin\phi \right)$$
  $$d\tau_{\text{net}} = d\tau_{\text{drive}} - d\tau_{\text{drag}} = N_b r \left( dL \sin\phi - dD \cos\phi \right)$$

### 3.2 Rotational & Vertical Equations of Motion
$$\tau_{\text{net}}(\omega, V_z) = \int_{r_0}^{R} d\tau_{\text{net}} = I_{zz}^{(1)} \frac{d\omega}{dt} = I_{zz}^{(1)} \alpha$$
$$M_1 \frac{dV_{z,1}}{dt} = M_1 g - T_z(\omega, V_z) - \frac{1}{2}\rho C_{d,\text{body}} A_1 V_{z,1}^2$$

### 3.3 Equilibrium Condition ($\alpha \to 0$)
At steady-state autorotation ($\alpha = 0, \frac{dV_{z,1}}{dt} = 0$):
1. $\tau_{\text{drive}}(\omega_{eq}, V_{z,eq}) = \tau_{\text{drag}}(\omega_{eq}, V_{z,eq})$ with $|\alpha| < 10^{-3}\text{ rad/s}^2$.
2. Total upward aerodynamic force balances weight: $T_z + F_{D,\text{body}} = M_1 g$.
3. **Tip-Speed Ratio ($\lambda = \frac{\omega_{eq} R}{V_{z,eq}}$):** Evaluated at representative radius $r_{75} = 0.75 R$:
   $$\omega_{eq} \approx \frac{V_{z,eq}}{0.75 R \tan\left(\theta + \alpha_{eq}\right)}$$

---

## 4. Secondary Payload Free-Fall & Dual Egg Impact Survival (`tests/impact.test.ts`)

### 4.1 Secondary Payload Ballistic Descent ($200\text{ m} \to 0\text{ m}$)
$$M_2 \frac{dV_{z,2}}{dt} = M_2 g - \frac{1}{2}\rho(h) C_{d,2} A_2 V_{z,2}^2$$

### 4.2 Ground Impact Energy & G-Load on Each $65\text{ g}$ Egg
For payload $k \in \{1, 2\}$ striking ground at $V_{imp,k}$ with internal crushable absorber stroke $\Delta s_k$ and efficiency $\eta_k \in [0.6, 0.85]$:
- **Kinetic Energy at Impact:** $E_{k} = \frac{1}{2} M_k V_{imp,k}^2$
- **Peak Deceleration (in Gs) & Egg Force:**
  $$a_{\text{peak},k} = \frac{V_{imp,k}^2}{2 \eta_k \Delta s_k}, \quad G_{\text{peak},k} = \frac{a_{\text{peak},k}}{g_0}, \quad F_{\text{egg},k} = m_{\text{egg}} \, a_{\text{peak},k}$$
- **Egg Survival Criterion:** A $65\text{ g}$ chicken egg cushioned in an axial cup survives iff $G_{\text{peak},k} \le G_{\text{crit}} = 45\text{ G}$ (equivalent to distributed axial force $F_{\text{egg},k} \le 28.7\text{ N}$).

---

## 5. Relative Localization & Telemetry Contract (`tests/telemetry.test.ts`)

- **True Relative Vector (Primary $\vec{p}_1$ to Secondary $\vec{p}_2$):**
  $$\vec{d}_{12} = \vec{p}_2 - \vec{p}_1, \quad d_{12} = \|\vec{d}_{12}\|, \quad \psi_{12} = \text{atan2}(y_2 - y_1, x_2 - x_1)$$
- **Mode `useGps: true`:** Computes $\hat{d}_{12}, \hat{\psi}_{12}$ from simulated WGS84/local ENU GPS fixes ($\sigma_{xy} \le 2.5\text{ m}$) + 9-axis IMU yaw.
- **Mode `useGps: false`:** Computes $\hat{d}_{12}$ via LoRa RSSI log-distance model $\text{RSSI}(d) = P_{tx} - PL(d_0) - 10 n \log_{10}(d/d_0)$ fused with barometric altitude delta $\Delta h$ and IMU propagation.
- **Post-Landing Window:** Telemetry buffer MUST record continuously from launch ($t=0$), through $450\text{ m}$ apogee, $200\text{ m}$ separation, touchdown ($t_{\text{land}}$), up to $t_{\text{land}} + 10.0\text{ s}$.

---

## 6. Mandatory Pass Criteria Table for Vitest (`tests/`)

| Physical Parameter | Symbol | Expected Pass Range | Target Test File |
| :--- | :---: | :---: | :--- |
| Coupled Total Mass (with 2 eggs + 9V) | $M_{total}$ | $\le 0.600\text{ kg}$ | `tests/assembly.test.ts` |
| Coupled Height / Diameter | $H_{total} / D$ | $[0.20, 0.23]\text{ m} \;/\; [0.09, 0.10]\text{ m}$ | `tests/assembly.test.ts` |
| Primary / Secondary Height | $H_1 / H_2$ | $\le 0.16\text{ m} \;/\; \le 0.07\text{ m}$ | `tests/assembly.test.ts` |
| Drop / Separation Altitude | $h_{\text{drop}} / h_{\text{sep}}$ | $450\text{ m} \pm 0.5\text{ m} \;/\; 200\text{ m} \pm 1.0\text{ m}$ | `tests/flightLoop.test.ts` |
| Momentum Conservation Error | $|\Delta p_z|$ | $< 10^{-9}\text{ N}\cdot\text{s}$ | `tests/autorotation.test.ts` |
| **Primary Terminal Velocity** | $V_{z,1,\text{eq}}$ | **$[8.0, 12.0]\text{ m/s}$** | `tests/autorotation.test.ts` |
| Primary Equilibrium Spin | $\text{RPM}_{\text{eq}}$ | $[900, 2800]\text{ RPM}$ ($\approx 94 - 293\text{ rad/s}$) | `tests/autorotation.test.ts` |
| Rotational Stability (Metacentric) | $Z_{\text{hub}} - Z_{CoM}^{(1)}$ | $\ge +0.03\text{ m}$ (hub strictly above CoM) | `tests/massProperties.test.ts` |
| Gyroscopic Precession / Tilt | $\theta_{\text{tilt}}$ | $< 8^\circ$ in steady descent | `tests/autorotation.test.ts` |
| Egg Peak Impact Acceleration (Both) | $G_{\text{peak},1}, G_{\text{peak},2}$ | $\le 45.0\text{ G}$ (`eggSurvived === true`) | `tests/impact.test.ts` |
| Post-Landing Telemetry Duration | $\Delta t_{\text{post}}$ | $\ge 10.0\text{ s}$ after $h = 0\text{ m}$ | `tests/telemetry.test.ts` |
