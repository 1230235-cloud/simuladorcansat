import { FailureConfig } from '../physics/failures';

export function setupFailureControls(onChange: () => void): () => FailureConfig {
  const windSlider = document.getElementById('slider-wind') as HTMLInputElement | null;
  const gustsSlider = document.getElementById('slider-gusts') as HTMLInputElement | null;
  const stiffSlider = document.getElementById('slider-stiffness') as HTMLInputElement | null;
  const asymSlider = document.getElementById('slider-asym') as HTMLInputElement | null;
  const groundSelect = document.getElementById('select-ground') as HTMLSelectElement | null;
  const tpuChk = document.getElementById('chk-tpu') as HTMLInputElement | null;
  const jamChk = document.getElementById('chk-jam') as HTMLInputElement | null;
  const lateChk = document.getElementById('chk-late') as HTMLInputElement | null;

  const valWind = document.getElementById('val-wind');
  const valGusts = document.getElementById('val-gusts');
  const valStiff = document.getElementById('val-stiffness');
  const valAsym = document.getElementById('val-asym');

  function updateLabels(): void {
    if (valWind && windSlider) valWind.textContent = `${parseFloat(windSlider.value).toFixed(1)} m/s`;
    if (valGusts && gustsSlider) valGusts.textContent = `${parseFloat(gustsSlider.value).toFixed(1)} m/s`;
    if (valStiff && stiffSlider) valStiff.textContent = `${stiffSlider.value} N/m`;
    if (valAsym && asymSlider) valAsym.textContent = `${asymSlider.value}%`;
  }

  [windSlider, gustsSlider, stiffSlider, asymSlider].forEach((el) => {
    el?.addEventListener('input', () => {
      updateLabels();
      onChange();
    });
  });

  groundSelect?.addEventListener('change', onChange);
  tpuChk?.addEventListener('change', onChange);

  jamChk?.addEventListener('change', () => {
    if (jamChk.checked && lateChk) lateChk.checked = false;
    onChange();
  });

  lateChk?.addEventListener('change', () => {
    if (lateChk.checked && jamChk) jamChk.checked = false;
    onChange();
  });

  updateLabels();

  return function getFailureConfig(): FailureConfig {
    const windSpeedMs = windSlider ? parseFloat(windSlider.value) : 0;
    const windGustsMs = gustsSlider ? parseFloat(gustsSlider.value) : 0;
    const bandStiffnessK = stiffSlider ? parseFloat(stiffSlider.value) : 950;
    const bladeDeployAsymmetry = asymSlider ? parseFloat(asymSlider.value) / 100 : 0;
    const groundHardness = (groundSelect?.value as 'soft_grass' | 'hard_dirt') ?? 'soft_grass';
    const hasTpu = tpuChk ? tpuChk.checked : true;

    let pinFrictionJam: boolean | 'LATE_DEPLOYMENT' | undefined = undefined;
    if (jamChk?.checked) pinFrictionJam = true;
    else if (lateChk?.checked) pinFrictionJam = 'LATE_DEPLOYMENT';

    return {
      windSpeedMs,
      windGustsMs,
      bandStiffnessK,
      bladeDeployAsymmetry,
      groundHardness,
      groundType: groundHardness,
      hasTpuProtection: hasTpu,
      hasTpuCapsule: hasTpu,
      hasFoam: hasTpu,
      pinFrictionJam,
    };
  };
}
