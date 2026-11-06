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

  const primaryComponents: Component[] = [
    { id: 'Heltec_LoRa_V3', category: 'avionics', massKg: 0.025, positionM: { x: 0, y: 0, z: 0.06 }, radiusM: 0.02 },
    { id: 'BMP280_Primary', category: 'sensor', massKg: 0.003, positionM: { x: 0.01, y: 0, z: 0.06 }, radiusM: 0.005 },
    { id: 'IMU_BNO080_9DOF', category: 'sensor', massKg: 0.004, positionM: { x: -0.01, y: 0, z: 0.06 }, radiusM: 0.005 },
    { id: 'Regulador_Mini360', category: 'avionics', massKg: 0.002, positionM: { x: -0.01, y: 0.01, z: 0.05 }, radiusM: 0.005 },
    { id: 'Servo_SG90', category: 'actuator', massKg: 0.009, positionM: { x: 0, y: 0, z: 0.01 }, radiusM: 0.01 },
    { id: 'Battery_9V_PP3_Primary', category: 'battery', type: '9V_PP3', massKg: 0.046, positionM: { x: 0, y: 0, z: 0.03 }, radiusM: 0.015 },
    { id: 'Rotor_Assembly', category: 'rotor', massKg: 0.045, positionM: { x: 0, y: 0, z: 0.145 }, radiusM: 0.045 },
    { id: 'Chicken_Egg_65g', category: 'biological', massKg: 0.065, positionM: { x: 0, y: 0, z: 0.04 }, radiusM: 0.022 },
  ];

  if (useGps) {
    primaryComponents.push({ id: 'GPS_Module', category: 'sensor', massKg: 0.014, positionM: { x: 0, y: 0.015, z: 0.09 }, radiusM: 0.012 });
  }

  // Secondary Payload: 100% clean of electronics by default (only Egg 2 of 65g)
  const secondaryComponents: Component[] = [
    { id: 'Chicken_Egg_65g', category: 'biological', massKg: 0.065, positionM: { x: 0, y: 0, z: 0.035 }, radiusM: 0.022 },
  ];

  return {
    useGps,
    hasExternalProtuberances: false,
    primary: { heightM: 0.15, diameterM: 0.095, rotorHubZM: 0.145, chassisMassKg: 0.120, components: primaryComponents },
    secondary: { heightM: 0.065, diameterM: 0.095, rotorHubZM: 0, chassisMassKg: 0.085, components: secondaryComponents },
  };
}

export interface CatalogItem {
  id: string;
  name: string;
  category: ComponentCategory;
  massKg: number;
  stage: 'primary' | 'secondary';
  type?: string;
  positionM: Vector3D;
  isMandatory?: boolean;
}

export const COMPONENT_CATALOG: CatalogItem[] = [
  { id: 'Heltec_LoRa_V3', name: 'Heltec LoRa V3 (ESP32-S3)', category: 'avionics', massKg: 0.025, stage: 'primary', positionM: { x: 0, y: 0, z: 0.06 } },
  { id: 'BMP280_Primary', name: 'BMP280 Barómetro (Primaria)', category: 'sensor', massKg: 0.003, stage: 'primary', positionM: { x: 0.01, y: 0, z: 0.06 } },
  { id: 'IMU_BNO080_9DOF', name: 'IMU BNO080 9-DOF (Primaria)', category: 'sensor', massKg: 0.004, stage: 'primary', positionM: { x: -0.01, y: 0, z: 0.06 } },
  { id: 'Regulador_Mini360', name: 'Regulador Step-Down Mini360', category: 'avionics', massKg: 0.002, stage: 'primary', positionM: { x: -0.01, y: 0.01, z: 0.05 } },
  { id: 'Servo_SG90', name: 'Servomotor SG90 (Cerrojo)', category: 'actuator', massKg: 0.009, stage: 'primary', positionM: { x: 0, y: 0, z: 0.01 } },
  { id: 'GPS_Module', name: 'Módulo GPS Diferencial', category: 'sensor', massKg: 0.014, stage: 'primary', positionM: { x: 0, y: 0.015, z: 0.09 } },
  { id: 'Battery_9V_PP3_Primary', name: 'Batería 9V PP3 (Primaria)', category: 'battery', type: '9V_PP3', massKg: 0.046, stage: 'primary', positionM: { x: 0, y: 0, z: 0.03 }, isMandatory: true },
  { id: 'Rotor_Assembly', name: 'Rotor Autogiro (Cubo+Palas)', category: 'rotor', massKg: 0.045, stage: 'primary', positionM: { x: 0, y: 0, z: 0.145 }, isMandatory: true },
  { id: 'Chicken_Egg_65g', name: 'Huevo 1 (65g Primaria)', category: 'biological', massKg: 0.065, stage: 'primary', positionM: { x: 0, y: 0, z: 0.04 }, isMandatory: true },
  { id: 'Chicken_Egg_65g', name: 'Huevo 2 (65g Secundaria)', category: 'biological', massKg: 0.065, stage: 'secondary', positionM: { x: 0, y: 0, z: 0.035 }, isMandatory: true },
  { id: 'Heltec_LoRa_Secondary', name: 'Heltec LoRa V3 (Opcional Sec)', category: 'avionics', massKg: 0.025, stage: 'secondary', positionM: { x: 0, y: 0, z: 0.02 } },
  { id: 'BMP280_Secondary', name: 'BMP280 Barómetro (Secundaria)', category: 'sensor', massKg: 0.003, stage: 'secondary', positionM: { x: 0.01, y: 0, z: 0.02 } },
  { id: 'Battery_9V_PP3_Secondary', name: 'Batería 9V PP3 (Secundaria)', category: 'battery', type: '9V_PP3', massKg: 0.046, stage: 'secondary', positionM: { x: 0, y: 0, z: 0.01 } },
];
