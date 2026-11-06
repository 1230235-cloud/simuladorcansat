import { parseCadFromBuffer, CadFormat } from '../importers/cadLoader';
import { CanSat3DViewport } from './viewport3d';

export let userUploadedCad = false;

export async function autoLoadDefaultModels(
  viewport: CanSat3DViewport,
  onComplete?: () => void
): Promise<void> {
  if (userUploadedCad) return;
  const load = async (url: string, target: 'primary' | 'secondary' | 'blades') => {
    try {
      let res = await fetch(url);
      if (!res.ok) res = await fetch('.' + url);
      if (!res.ok) return;
      const buf = await res.arrayBuffer();
      const geom = parseCadFromBuffer(buf, 'stl');
      if (!userUploadedCad) {
        viewport.loadCustomCadGeometry(target, geom, false);
      }
    } catch {
      // Silently ignore in headless or offline
    }
  };

  await Promise.all([
    load('/models/primaria.stl', 'primary'),
    load('/models/secundaria.stl', 'secondary'),
    load('/models/palas.stl', 'blades'),
  ]);
  onComplete?.();
}

export function setupCadImport(viewport: CanSat3DViewport, onUpdate?: () => void): void {
  const completeBtn = document.getElementById('btn-cad-mode-complete');
  const separateBtn = document.getElementById('btn-cad-mode-separate');
  const completeBox = document.getElementById('cad-complete-box');
  const separateBox = document.getElementById('cad-separate-box');

  completeBtn?.addEventListener('click', () => {
    completeBtn.classList.add('active');
    separateBtn?.classList.remove('active');
    if (completeBox) completeBox.style.display = 'block';
    if (separateBox) separateBox.style.display = 'none';
  });

  separateBtn?.addEventListener('click', () => {
    separateBtn.classList.add('active');
    completeBtn?.classList.remove('active');
    if (completeBox) completeBox.style.display = 'none';
    if (separateBox) separateBox.style.display = 'block';
    if (!userUploadedCad) autoLoadDefaultModels(viewport, onUpdate);
  });

  async function handleFile(file: File, target: 'complete' | 'primary' | 'secondary' | 'blades') {
    const ext = file.name.split('.').pop()?.toLowerCase() as CadFormat;
    if (!['stl', 'obj', 'gltf', 'glb'].includes(ext)) {
      alert('Formato CAD no soportado (.stl, .obj, .gltf, .glb)');
      return;
    }
    userUploadedCad = true;
    const buffer = await file.arrayBuffer();
    const geometry = parseCadFromBuffer(buffer, ext);
    viewport.loadCustomCadGeometry(target, geometry, true);
    onUpdate?.();
  }

  const bind = (id: string, target: 'complete' | 'primary' | 'secondary' | 'blades') => {
    document.getElementById(id)?.addEventListener('change', (e) => {
      const f = (e.target as HTMLInputElement).files?.[0];
      if (f) handleFile(f, target);
    });
  };

  bind('cad-file-complete', 'complete');
  bind('cad-file-primary', 'primary');
  bind('cad-file-blades', 'blades');
  bind('cad-file-secondary', 'secondary');
}
