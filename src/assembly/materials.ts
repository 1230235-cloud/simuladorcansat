export interface Material {
  name: string;
  densityKgM3: number;
  crushStressPa: number;
}

export type MaterialName = 'PLA' | 'PETG' | 'ABS' | 'CarbonFiber' | 'Aluminum6061';

export const MATERIALS: Record<MaterialName, Material> = {
  PLA: {
    name: 'PLA',
    densityKgM3: 1240,
    crushStressPa: 4.5e7,
  },
  PETG: {
    name: 'PETG',
    densityKgM3: 1270,
    crushStressPa: 5.0e7,
  },
  ABS: {
    name: 'ABS',
    densityKgM3: 1040,
    crushStressPa: 4.0e7,
  },
  CarbonFiber: {
    name: 'CarbonFiber',
    densityKgM3: 1550,
    crushStressPa: 1.2e8,
  },
  Aluminum6061: {
    name: 'Aluminum6061',
    densityKgM3: 2700,
    crushStressPa: 2.7e8,
  },
};
