export interface MissionAltitudes {
  dropAltitudeM: number;
  separationAltitudeM: number;
}

export function setupAltitudeControls(
  onChange: (altitudes: MissionAltitudes) => void
): () => MissionAltitudes {
  const dropSlider = document.getElementById('slider-drop-alt') as HTMLInputElement | null;
  const sepSlider = document.getElementById('slider-sep-alt') as HTMLInputElement | null;
  const valDrop = document.getElementById('val-drop-alt');
  const valSep = document.getElementById('val-sep-alt');
  const warnEl = document.getElementById('alt-validation-warn');
  const droneCamBtn = document.getElementById('btn-cam-drone');
  const sepCamBtn = document.getElementById('btn-cam-sep');

  function update(): MissionAltitudes {
    let dropAlt = dropSlider ? parseFloat(dropSlider.value) : 450;
    let sepAlt = sepSlider ? parseFloat(sepSlider.value) : 200;

    if (sepAlt >= dropAlt) {
      sepAlt = Math.max(20, dropAlt - 10);
      if (sepSlider) sepSlider.value = sepAlt.toString();
      if (warnEl) warnEl.style.display = 'block';
    } else {
      if (warnEl) warnEl.style.display = 'none';
    }

    if (valDrop) valDrop.textContent = `${dropAlt} m`;
    if (valSep) valSep.textContent = `${sepAlt} m`;
    if (droneCamBtn) droneCamBtn.textContent = `Fija Dron (${dropAlt} m)`;
    if (sepCamBtn) sepCamBtn.textContent = `Fija Desacople (${sepAlt} m)`;

    return { dropAltitudeM: dropAlt, separationAltitudeM: sepAlt };
  }

  const handleInput = () => {
    const alts = update();
    onChange(alts);
  };

  dropSlider?.addEventListener('input', handleInput);
  sepSlider?.addEventListener('input', handleInput);

  update();

  return () => update();
}
