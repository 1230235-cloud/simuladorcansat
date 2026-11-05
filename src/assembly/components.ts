export interface Vector3D {
  x: number;
  y: number;
  z: number;
}

export type ComponentCategory =
  | 'avionics'
  | 'battery'
  | 'sensor'
  | 'actuator'
  | 'biological'
  | 'rotor'
  | 'structural'
  | 'active_rotor_motor';

export interface Component {
  id: string;
  category: ComponentCategory;
  type?: string;
  massKg: number;
  positionM: Vector3D;
  radiusM?: number;
}

export interface PayloadAssembly {
  heightM: number;
  diameterM: number;
  rotorHubZM: number;
  chassisMassKg: number;
  components: Component[];
}

export interface DualCanSatAssembly {
  useGps: boolean;
  hasExternalProtuberances: boolean;
  primary: PayloadAssembly;
  secondary: PayloadAssembly;
}

export interface AssemblyOptions {
  useGps?: boolean;
}

export function createDefaultAssembly(options: AssemblyOptions = {}): DualCanSatAssembly {
  const useGps = options.useGps ?? true;

  // Primary Payload (Max H <= 0.16m, D in [0.09, 0.10]m)
  // Height = 0.15 m, Diameter = 0.095 m
  const primaryComponents: Component[] = [
    {
      id: 'ESP32_LoRa_Primary',
      category: 'avionics',
      massKg: 0.028,
      positionM: { x: 0, y: 0, z: 0.06 },
      radiusM: 0.02,
    },
    {
      id: 'BMP280_Primary',
      category: 'sensor',
      massKg: 0.003,
      positionM: { x: 0.01, y: 0, z: 0.06 },
      radiusM: 0.005,
    },
    {
      id: 'IMU_9DOF_Primary',
      category: 'sensor',
      massKg: 0.004,
      positionM: { x: -0.01, y: 0, z: 0.06 },
      radiusM: 0.005,
    },
    {
      id: 'Battery_9V_PP3_Primary',
      category: 'battery',
      type: '9V_PP3',
      massKg: 0.046,
      positionM: { x: 0, y: 0, z: 0.03 },
      radiusM: 0.015,
    },
    {
      id: 'Servo_Release',
      category: 'actuator',
      massKg: 0.012,
      positionM: { x: 0, y: 0, z: 0.01 },
      radiusM: 0.01,
    },
    {
      id: 'Rotor_Assembly',
      category: 'rotor',
      massKg: 0.045, // includes hub + 3 passive blades (0.012 kg each + hub)
      positionM: { x: 0, y: 0, z: 0.145 },
      radiusM: 0.045,
    },
    {
      id: 'Chicken_Egg_65g',
      category: 'biological',
      massKg: 0.065,
      positionM: { x: 0, y: 0, z: 0.04 },
      radiusM: 0.022,
    },
  ];

  if (useGps) {
    primaryComponents.push({
      id: 'GPS_Module',
      category: 'sensor',
      massKg: 0.014,
      positionM: { x: 0, y: 0.015, z: 0.09 },
      radiusM: 0.012,
    });
  }

  // Secondary Payload (Max H <= 0.07m, D in [0.09, 0.10]m)
  // Height = 0.065 m, Diameter = 0.095 m
  const secondaryComponents: Component[] = [
    {
      id: 'ESP32_LoRa_Secondary',
      category: 'avionics',
      massKg: 0.025,
      positionM: { x: 0, y: 0, z: 0.185 },
      radiusM: 0.02,
    },
    {
      id: 'BMP280_Secondary',
      category: 'sensor',
      massKg: 0.003,
      positionM: { x: 0.01, y: 0, z: 0.185 },
      radiusM: 0.005,
    },
    {
      id: 'IMU_9DOF_Secondary',
      category: 'sensor',
      massKg: 0.004,
      positionM: { x: -0.01, y: 0, z: 0.185 },
      radiusM: 0.005,
    },
    {
      id: 'Battery_9V_PP3_Secondary',
      category: 'battery',
      type: '9V_PP3',
      massKg: 0.046,
      positionM: { x: 0, y: 0, z: 0.17 },
      radiusM: 0.015,
    },
    {
      id: 'Chicken_Egg_65g',
      category: 'biological',
      massKg: 0.065,
      positionM: { x: 0, y: 0, z: 0.18 },
      radiusM: 0.022,
    },
  ];

  return {
    useGps,
    hasExternalProtuberances: false,
    primary: {
      heightM: 0.15,
      diameterM: 0.095,
      rotorHubZM: 0.145,
      chassisMassKg: 0.080,
      components: primaryComponents,
    },
    secondary: {
      heightM: 0.065,
      diameterM: 0.095,
      rotorHubZM: 0,
      chassisMassKg: 0.045,
      components: secondaryComponents,
    },
  };
}
