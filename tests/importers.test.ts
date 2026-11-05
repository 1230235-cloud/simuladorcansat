import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { MATERIALS } from '../src/assembly/materials';
import {
  parseCadFromBuffer,
  validateCadEnvelopeAndDroneSocket,
} from '../src/importers/cadLoader';
import {
  computeMeshVolumeAndBoundingBox,
  computeChassisMassFromMaterial,
  extractRotorBladeMetrics,
} from '../src/importers/geometryMetrics';

describe('Phase 3.1: Headless CAD Importer, Signed Tetrahedron Volume, Drone Socket & Blade Metrics', () => {
  it('parses synthetic .obj, .stl, and .gltf/.glb buffers headlessly into non-empty BufferGeometry', () => {
    const asciiObj = `
      v 0 0 0
      v 0.095 0 0
      v 0.095 0.095 0
      v 0 0.095 0
      v 0 0 0.15
      v 0.095 0 0.15
      v 0.095 0.095 0.15
      v 0 0.095 0.15
      f 1 3 2
      f 1 4 3
      f 5 6 7
      f 5 7 8
    `;

    const asciiStl = `solid test_box
      facet normal 0 0 -1
        outer loop
          vertex 0 0 0
          vertex 0.095 0.095 0
          vertex 0.095 0 0
        endloop
      endfacet
      facet normal 0 0 1
        outer loop
          vertex 0 0 0.15
          vertex 0.095 0 0.15
          vertex 0.095 0.095 0.15
        endloop
      endfacet
    endsolid test_box`;

    const geomObj = parseCadFromBuffer(new TextEncoder().encode(asciiObj).buffer, 'obj');
    const geomStl = parseCadFromBuffer(new TextEncoder().encode(asciiStl).buffer, 'stl');

    expect(geomObj.getAttribute('position').count).toBeGreaterThanOrEqual(6);
    expect(geomStl.getAttribute('position').count).toBe(6);

    // Synthetic GLTF JSON buffer
    const boxGeom = new THREE.BoxGeometry(0.095, 0.095, 0.15);
    const gltfJson = JSON.stringify({
      asset: { version: '2.0' },
      SimSyntheticBox: { width: 0.095, depth: 0.095, height: 0.15 },
    });
    const geomGltf = parseCadFromBuffer(new TextEncoder().encode(gltfJson).buffer, 'gltf');
    expect(geomGltf.getAttribute('position').count).toBe(boxGeom.getAttribute('position').count);
  });

  it('computes exact signed tetrahedron volume V, bounding box (D_x, D_y, H_z), and real material mass m = rho * V', () => {
    const widthX = 0.095;
    const depthY = 0.095;
    const heightZ = 0.150;
    const box = new THREE.BoxGeometry(widthX, depthY, heightZ);

    const metrics = computeMeshVolumeAndBoundingBox(box);
    const expectedVolumeM3 = widthX * depthY * heightZ;

    expect(metrics.diameterXM).toBeCloseTo(widthX, 6);
    expect(metrics.diameterYM).toBeCloseTo(depthY, 6);
    expect(metrics.heightZM).toBeCloseTo(heightZ, 6);
    expect(metrics.volumeM3).toBeCloseTo(expectedVolumeM3, 6);
    expect(metrics.axialProjectedAreaM2).toBeCloseTo(widthX * depthY, 5);

    const plaMassKg = computeChassisMassFromMaterial(metrics.volumeM3, 'PLA', 0.15); // 15% infill/shell factor
    const expectedPlaMassKg = expectedVolumeM3 * 0.15 * MATERIALS.PLA.densityKgM3;
    expect(plaMassKg).toBeCloseTo(expectedPlaMassKg, 6);
  });

  it('validates coupled CAD envelope (D in [9, 10] cm, H in [20, 23] cm, H1 <= 16 cm, H2 <= 7 cm) and top drone attachment socket (D_socket in [9, 10] mm, depth >= 3 mm)', () => {
    const primaryGeom = new THREE.CylinderGeometry(0.0475, 0.0475, 0.150, 32);
    primaryGeom.rotateX(Math.PI / 2); // Align cylinder axis with Z

    const secondaryGeom = new THREE.CylinderGeometry(0.0475, 0.0475, 0.065, 32);
    secondaryGeom.rotateX(Math.PI / 2);

    const validCheck = validateCadEnvelopeAndDroneSocket({
      primaryGeometry: primaryGeom,
      secondaryGeometry: secondaryGeom,
      topDroneSocket: {
        diameterMm: 9.5,
        depthMm: 4.0,
      },
    });

    expect(validCheck.isValid).toBe(true);
    expect(validCheck.coupledHeightM).toBeCloseTo(0.215, 3);
    expect(validCheck.maxDiameterM).toBeCloseTo(0.095, 3);
    expect(validCheck.droneSocketValid).toBe(true);

    // Reject invalid drone socket (e.g. 7.5 mm diameter or < 3 mm depth)
    const invalidSocketCheck = validateCadEnvelopeAndDroneSocket({
      primaryGeometry: primaryGeom,
      secondaryGeometry: secondaryGeom,
      topDroneSocket: {
        diameterMm: 7.5,
        depthMm: 2.0,
      },
    });

    expect(invalidSocketCheck.isValid).toBe(false);
    expect(invalidSocketCheck.droneSocketValid).toBe(false);
  });

  it('extracts deployed rotor blade geometry (tip radius R, mean chord c, pitch angle theta, and swept disk area) compatible with autorotation.ts', () => {
    const spanM = 0.205;
    const rootOffsetM = 0.015;
    const chordM = 0.040;
    const thicknessM = 0.002;
    const pitchDeg = 17.5;
    const pitchRad = (pitchDeg * Math.PI) / 180;

    // Create blade along X (span = 0.205m from r0=0.015m to R=0.220m), tilted by pitchRad around X axis
    const bladeGeom = new THREE.BoxGeometry(spanM, chordM, thicknessM);
    bladeGeom.rotateX(pitchRad);
    bladeGeom.translate(rootOffsetM + spanM / 2, 0, 0);

    const bladeMetrics = extractRotorBladeMetrics(bladeGeom, {
      numBlades: 3,
      rootOffsetM,
    });

    expect(bladeMetrics.tipRadiusM).toBeCloseTo(0.220, 3);
    expect(bladeMetrics.meanChordM).toBeCloseTo(chordM, 3);
    expect(bladeMetrics.pitchAngleRad).toBeCloseTo(pitchRad, 2);
    expect(bladeMetrics.sweptDiskAreaM2).toBeCloseTo(Math.PI * (0.220 ** 2 - 0.015 ** 2), 4);
    expect(bladeMetrics.rotorConfig.numBlades).toBe(3);
    expect(bladeMetrics.rotorConfig.tipRadiusM).toBeCloseTo(0.220, 3);
    expect(bladeMetrics.rotorConfig.bladeChordM).toBeCloseTo(chordM, 3);
  });
});
