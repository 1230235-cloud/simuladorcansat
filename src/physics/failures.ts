export interface FailureConfig {
  windSpeedMs?: number;
  windGustsMs?: number;
  pinFrictionJam?: boolean | 'LATE_DEPLOYMENT';
  bladeDeployAsymmetry?: number;
  bandStiffnessK?: number;
  bandSnapProb?: number;
  groundHardness?: 'soft_grass' | 'hard_dirt' | 'grass';
  groundType?: 'soft_grass' | 'hard_dirt' | 'grass';
  hasTpuProtection?: boolean;
  hasTpuCapsule?: boolean;
  hasFoam?: boolean;
}

export interface FailureState {
  servoJammed: boolean;
  maxTiltDeg: number;
  horizontalSpeedMS: number;
  effectiveAsymmetry: number;
}

export function initFailureState(config?: FailureConfig): FailureState {
  if (!config) {
    return { servoJammed: false, maxTiltDeg: 0, horizontalSpeedMS: 0, effectiveAsymmetry: 0 };
  }
  const wind = (config.windSpeedMs ?? 0) + (config.windGustsMs ?? 0);
  const asymmetry = Math.max(0, Math.min(1.0, config.bladeDeployAsymmetry ?? 0));
  const tilt = asymmetry * 30.0;
  const jammed = config.pinFrictionJam === true;

  return {
    servoJammed: jammed,
    maxTiltDeg: tilt,
    horizontalSpeedMS: wind,
    effectiveAsymmetry: asymmetry,
  };
}
