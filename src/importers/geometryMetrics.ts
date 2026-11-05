import * as THREE from 'three';
import { MATERIALS, MaterialName } from '../assembly/materials';
import { RotorConfig } from '../physics/autorotation';

export interface MeshGeometryMetrics {
  diameterXM: number;
  diameterYM: number;
  heightZM: number;
  volumeM3: number;
  axialProjectedAreaM2: number;
}

export interface BladeExtractionOptions {
  numBlades: number;
  rootOffsetM: number;
}

export interface RotorBladeMetrics {
  tipRadiusM: number;
  meanChordM: number;
  pitchAngleRad: number;
  sweptDiskAreaM2: number;
  rotorConfig: RotorConfig;
}

export function computeMeshVolumeAndBoundingBox(geometry: THREE.BufferGeometry): MeshGeometryMetrics {
  geometry.computeBoundingBox();
  const box = geometry.boundingBox ?? new THREE.Box3();
  const size = new THREE.Vector3();
  box.getSize(size);

  const posAttr = geometry.getAttribute('position');
  let volume = 0;

  const p1 = new THREE.Vector3();
  const p2 = new THREE.Vector3();
  const p3 = new THREE.Vector3();

  if (geometry.index) {
    const index = geometry.index;
    for (let i = 0; i < index.count; i += 3) {
      const i1 = index.getX(i);
      const i2 = index.getX(i + 1);
      const i3 = index.getX(i + 2);

      p1.fromBufferAttribute(posAttr, i1);
      p2.fromBufferAttribute(posAttr, i2);
      p3.fromBufferAttribute(posAttr, i3);

      volume += p1.dot(p2.cross(p3)) / 6.0;
    }
  } else {
    for (let i = 0; i < posAttr.count; i += 3) {
      p1.fromBufferAttribute(posAttr, i);
      p2.fromBufferAttribute(posAttr, i + 1);
      p3.fromBufferAttribute(posAttr, i + 2);

      volume += p1.dot(p2.cross(p3)) / 6.0;
    }
  }

  const axialProjectedAreaM2 = size.x * size.y;

  return {
    diameterXM: size.x,
    diameterYM: size.y,
    heightZM: size.z,
    volumeM3: Math.abs(volume),
    axialProjectedAreaM2,
  };
}

export function computeChassisMassFromMaterial(
  volumeM3: number,
  materialName: MaterialName,
  infillRatio: number = 0.15
): number {
  const material = MATERIALS[materialName];
  if (!material) {
    throw new Error(`Unknown material: ${materialName}`);
  }
  return volumeM3 * infillRatio * material.densityKgM3;
}

export function extractRotorBladeMetrics(
  bladeGeometry: THREE.BufferGeometry,
  options: BladeExtractionOptions
): RotorBladeMetrics {
  bladeGeometry.computeBoundingBox();
  const box = bladeGeometry.boundingBox ?? new THREE.Box3();
  const size = new THREE.Vector3();
  box.getSize(size);

  const tipRadiusM = box.max.x;

  let pitchAngleRad = Math.atan2(size.z, size.y);
  let meanChordM = size.y;

  const normalAttr = bladeGeometry.getAttribute('normal');
  if (normalAttr) {
    for (let i = 0; i < normalAttr.count; i++) {
      const nx = normalAttr.getX(i);
      const ny = normalAttr.getY(i);
      const nz = normalAttr.getZ(i);
      if (Math.abs(nx) < 1e-3 && ny > 0.05 && nz > 0.05) {
        pitchAngleRad = Math.atan2(nz, ny);
        break;
      }
    }
  }

  const cos2Theta = Math.cos(2 * pitchAngleRad);
  if (Math.abs(cos2Theta) > 1e-4) {
    meanChordM = (size.y * Math.cos(pitchAngleRad) - size.z * Math.sin(pitchAngleRad)) / cos2Theta;
  } else {
    meanChordM = Math.hypot(size.y, size.z);
  }

  const sweptDiskAreaM2 = Math.PI * (Math.pow(tipRadiusM, 2) - Math.pow(options.rootOffsetM, 2));

  const rotorConfig: RotorConfig = {
    numBlades: options.numBlades,
    tipRadiusM,
    rootOffsetM: options.rootOffsetM,
    bladeChordM: meanChordM,
    pitchAngleRad,
    liftSlope: 5.7,
    profileCd0: 0.02,
  };

  return {
    tipRadiusM,
    meanChordM,
    pitchAngleRad,
    sweptDiskAreaM2,
    rotorConfig,
  };
}
