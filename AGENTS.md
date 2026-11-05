# Architecture & Agent Contract (`AGENTS.md`)

## 1. Tech Stack & Execution Rules
- **Core:** TypeScript (strict mode) + Vite.
- **3D & CAD:** Three.js (`GLTFLoader`, `OBJLoader`, `STLLoader`).
- **Physics:** Rapier3D WASM (rigid-body collisions/ground impact) + Pure TS 6-DOF Aerodynamics & Autorotation solver.
- **Testing:** Vitest (100% headless console execution).
- **Prohibitions:** ZERO implementation of motor-assisted rotors (pure passive mechanical autorotation only). Only 9V block batteries (`PP3`) allowed in power budget.

## 2. Strict Modular Tree (`src/`)
- `src/physics/`: Pure TS, ZERO Three.js/DOM imports.
  - `isa.ts`: International Standard Atmosphere ($\rho(h), P(h), T(h)$).
  - `massProperties.ts`: Composite Mass, Center of Mass ($\vec{R}_{CoM}$), and Inertia Tensor ($I_{xx}, I_{yy}, I_{zz}$) pre/post separation.
  - `autorotation.ts`: Blade Element Momentum / analytical autorotation ($\tau_{drive} - \tau_{drag} = I_{zz}\alpha$, angular speed $\omega$, axial thrust $T_z$).
  - `ballistics.ts`: 6-DOF free-fall drag & terminal velocity for Coupled CanSat ($450\text{ m} \to 200\text{ m}$) and Secondary Payload ($200\text{ m} \to 0\text{ m}$).
  - `separation.ts`: Conservation of linear/angular momentum at $h = 200\text{ m}$ decoupling.
  - `impact.ts`: Ground impact kinematics, crush stroke $\Delta s$, peak G-load, and 65 g chicken egg survival check (Primary & Secondary).
- `src/assembly/`:
  - `materials.ts`: Chassis catalog (PLA, PETG, ABS, Carbon Fiber, Aluminum 6061) with density $\rho_m$ and crush modulus.
  - `components.ts`: Internal parts catalog (ESP32/LoRa, BMP280, 9-axis IMU, 9V PP3 battery, release servo, rotor hub/blades, 2x 65 g eggs, optional GPS module with boolean toggle `useGps: boolean`).
  - `validator.ts`: Enforces contest constraints:
    - Total mass $M_{total} \le 0.600\text{ kg}$ (including two $0.065\text{ kg}$ eggs and 9V batteries).
    - Coupled height $H_{total} \in [0.20, 0.23]\text{ m}$, diameter $D \in [0.09, 0.10]\text{ m}$ (smooth outer envelope).
    - Primary height $H_1 \le 0.16\text{ m}$; Secondary height $H_2 \le 0.07\text{ m}$.
- `src/importers/`:
  - `cadLoader.ts`: Loads `.glb`, `.gltf`, `.obj`, `.stl` meshes for Primary chassis, Secondary chassis, and rotor blades.
  - `geometryMetrics.ts`: Computes real volume $V$, wet surface, and axial projected area $A_z$ from triangle buffers.
- `src/sim/`:
  - `flightLoop.ts`: Ascent $\to$ Drop at $450\text{ m}$ over $3\text{ m}$ target circle $\to$ Coupled free-fall $\to$ Servo release & blade deployment at $200\text{ m}$ $\to$ Primary autorotation ($V_{z,1} \in [8, 12]\text{ m/s}$) + Secondary free-fall $\to$ Impact & $+10\text{ s}$ post-landing logging.
  - `telemetry.ts`: Synthetic Barometer ($P, T, h$), 9-axis IMU (accel, gyro $\omega_z$ saturation check, attitude), servo state, and Relative Localization (Primary-to-Secondary distance $d_{12}$ and bearing $\psi_{12}$ via GPS if `useGps === true` or LoRa RSSI + IMU dead-reckoning if `useGps === false`).
- `src/ui/`:
  - `scene3d.ts`: Three.js viewport, dual-body separation animation, blade spin synced to physical $\omega$, force/CoM vectors, $3\text{ m}$ ground target.
  - `dashboard.ts`: Plots for RPM vs $V_z$, altitude profile, impact G-loads, and relative bearing/distance vector.

## 3. Token-Saving & Code Hygiene Rules
- **Forbidden Directories:** NEVER read, grep, or edit `dist/`, `node_modules/`, or `package-lock.json`.
- **File Size Cap:** Max **250 lines** per source file. Split modules before exceeding this limit.
- **Surgical Edits:** Apply minimal diffs; never rewrite unchanged functions.
- **Headless First:** Every equation in `src/physics/`, `src/assembly/`, and `src/sim/` MUST pass Vitest unit tests before touching `src/ui/`.
