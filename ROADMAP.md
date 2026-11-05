# Implementation Roadmap (`ROADMAP.md`)

> **Execution Contract for Gemini Flash:** Implement strictly in sequence. Do not advance to the next phase until all Vitest suites in the current phase pass in headless mode. Keep every file $\le 250$ lines.

---

## Phase 1: TS/Vite/Vitest Skeleton, Dual-Payload Assembly & Mass/Inertia Engine
- [x] **1.1 Project & Test Harness Setup** (`package.json`, `tsconfig.json`, `vite.config.ts`, `vitest.config.ts`)
  - Initialize strict TypeScript config and Vitest headless runner.
  - **Approval Command:** `npx vitest run --passWithNoTests`
- [x] **1.2 Materials & Internal Component Catalog** (`src/assembly/materials.ts`, `src/assembly/components.ts`, `tests/assembly.test.ts`)
  - Define materials (`PLA`, `PETG`, `ABS`, `CarbonFiber`, `Aluminum6061`) with density $\rho$ and impact crush stress $\sigma_c$.
  - Define internal parts: `ESP32_LoRa`, `BMP280`, `IMU_9DOF`, `Battery_9V_PP3` (strictly the only allowed power source), `Servo_Release`, `Rotor_Assembly` (passive mechanical hinges + blades), two `Chicken_Egg_65g` ($0.065\text{ kg}$ each, one in Primary, one in Secondary), and `GPS_Module` controlled by boolean toggle `useGps: boolean`.
  - **Approval Command:** `npx vitest run tests/assembly.test.ts`
- [x] **1.3 Contest Rule Validator & Pre/Post Separation CoM + $I_{zz}$** (`src/assembly/validator.ts`, `src/physics/massProperties.ts`, `tests/massProperties.test.ts`)
  - Validate envelope rules: $M_{total} \le 0.600\text{ kg}$, coupled height $H \in [0.20, 0.23]\text{ m}$, diameter $D \in [0.09, 0.10]\text{ m}$, $H_1 \le 0.16\text{ m}$, $H_2 \le 0.07\text{ m}$.
  - Compute exact coupled and decoupled Mass ($M, M_1, M_2$), 3D Center of Mass ($\vec{R}_{CoM}$), CoM shift ($\Delta \vec{R}_{CoM}$), and axial Moment of Inertia ($I_{zz}$) using Parallel Axis Theorem (including folded vs. deployed rotor blades).
  - **Approval Command:** `npx vitest run tests/massProperties.test.ts`

---

## Phase 2: Separation, Passive Autorotation & Impact Survival Physics Engine
- [x] **2.1 ISA Atmosphere & Ballistic Free-Fall Solver** (`src/physics/isa.ts`, `src/physics/ballistics.ts`, `tests/ballistics.test.ts`)
  - Model $\rho(h), P(h), T(h)$ from $0\text{ m}$ to $450\text{ m}$.
  - Model coupled free-fall ($450\text{ m} \to 200\text{ m}$) and Secondary Payload unbraked free-fall ($200\text{ m} \to 0\text{ m}$).
  - **Approval Command:** `npx vitest run tests/ballistics.test.ts`
- [x] **2.2 Mechanical Separation & Passive Autorotation Solver** (`src/physics/separation.ts`, `src/physics/autorotation.ts`, `tests/autorotation.test.ts`)
  - Enforce linear momentum conservation during $h = 200\text{ m}$ spring/servo decoupling.
  - Solve differential spin-up $\tau_{net}(\omega, V_z) = \tau_{drive} - \tau_{drag} = I_{zz}\alpha$ for the Primary Payload from blade deployment ($\omega_0 = 0$) to equilibrium RPM ($\alpha \to 0$).
  - Verify steady-state Primary terminal descent speed strictly within $V_{z,1} \in [8, 12]\text{ m/s}$ without any parachute or active motor.
  - **Approval Command:** `npx vitest run tests/autorotation.test.ts`
- [x] **2.3 Ground Impact & 65 g Egg Survival Solver** (`src/physics/impact.ts`, `tests/impact.test.ts`)
  - Compute kinetic energy at touchdown ($h = 0\text{ m}$), crumple zone deformation stroke $\Delta s$, and peak deceleration $G_{peak}$ for both Primary ($V_{z,1} \in [8, 12]\text{ m/s}$) and Secondary (free-fall from $200\text{ m}$) payloads to verify both $65\text{ g}$ eggs survive below structural fracture threshold.
  - **Approval Command:** `npx vitest run tests/impact.test.ts`

---

## Phase 3: External CAD Importer & Geometric Metrics
- [x] **3.1 Headless Mesh Parser & Volume/Area Extractor** (`src/importers/geometryMetrics.ts`, `src/importers/cadLoader.ts`, `tests/importers.test.ts`)
  - Support `.glb`, `.gltf`, `.obj`, and `.stl` geometries for Primary chassis, Secondary chassis, and rotor blades.
  - Compute signed tetrahedron volume $V$, axial projected area $A_z$, and rotor blade chord/span/pitch parameters directly from buffer geometry.
  - **Approval Command:** `npx vitest run tests/importers.test.ts`

---

## Phase 4: Dual Telemetry, Relative Localization (`useGps` Toggle) & Full Flight Loop
- [x] **4.1 Synthetic Sensors & Relative Localization Engine** (`src/sim/telemetry.ts`, `tests/telemetry.test.ts`)
  - Simulate Barometer ($P, T$, derived altitude & vertical speed), 9-axis IMU (3-axis accelerometer, 3-axis gyroscope measuring autorotation $\omega_z$ in $\text{rad/s}$ & RPM, magnetometer orientation), and release servo state.
  - Implement Primary-to-Secondary localization (distance $d_{12}$ and bearing vector $\vec{u}_{12}$):
    - Mode A (`useGps: true`): Differential GPS coordinates + IMU heading.
    - Mode B (`useGps: false`): LoRa RSSI log-distance path loss + IMU/barometric ballistic propagation.
  - **Approval Command:** `npx vitest run tests/telemetry.test.ts`
- [x] **4.2 Full Mission Simulation Loop** (`src/sim/flightLoop.ts`, `tests/flightLoop.test.ts`)
  - Execute complete timeline: Ascent $\to$ Drop at $450\text{ m}$ above $3\text{ m}$ diameter target $\to$ Coupled descent $\to$ $200\text{ m}$ separation & blade deployment $\to$ Dual descent $\to$ Landing & $+10\text{ s}$ post-landing stationary telemetry capture.
  - **Approval Command:** `npx vitest run tests/flightLoop.test.ts`

---

## Phase 5: Three.js 3D Visualizer & Telemetry Dashboard
- [ ] **5.1 3D Scene, Separation Animation & Force Vectors** (`src/ui/scene3d.ts`, `src/main.ts`, `index.html`)
  - Render $3\text{ m}$ ground target circle, Primary & Secondary CAD meshes, mechanical separation at $200\text{ m}$, blade spin proportional to physical $\omega(t)$, and live arrows for $\vec{R}_{CoM}$, Thrust $\vec{T}_z$, Torque $\vec{\tau}$, and Primary-to-Secondary tracking vector.
  - **Approval Command:** `npx tsc --noEmit && npx vitest run`
- [ ] **5.2 Real-Time Engineering Plots & GPS Toggle UI** (`src/ui/dashboard.ts`, `tests/e2eSim.test.ts`)
  - Display RPM vs. $V_z$, altitude vs. time ($450\text{ m} \to 0\text{ m} + 10\text{ s}$), impact G-load gauges for both $65\text{ g}$ eggs, and live `useGps` switch (`Yes/No`).
  - **Approval Command:** `npx vitest run`
