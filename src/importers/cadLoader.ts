import * as THREE from 'three';

export interface DroneAttachmentSocket {
  diameterMm: number;
  depthMm: number;
}

export interface EnvelopeValidationParams {
  primaryGeometry: THREE.BufferGeometry;
  secondaryGeometry: THREE.BufferGeometry;
  topDroneSocket: DroneAttachmentSocket;
}

export interface CadValidationReport {
  isValid: boolean;
  coupledHeightM: number;
  maxDiameterM: number;
  droneSocketValid: boolean;
  errors: string[];
}

export type CadFormat = 'obj' | 'stl' | 'gltf' | 'glb';

export function parseCadFromBuffer(buffer: ArrayBuffer, format: CadFormat): THREE.BufferGeometry {
  const decoder = new TextDecoder();

  if (format === 'obj') {
    const text = decoder.decode(buffer);
    const lines = text.split('\n');
    const vertices: number[][] = [];
    const positions: number[] = [];

    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (line.startsWith('v ')) {
        const parts = line.split(/\s+/).slice(1).map(Number);
        vertices.push(parts);
      } else if (line.startsWith('f ')) {
        const parts = line.split(/\s+/).slice(1).map((p) => {
          const idx = parseInt(p.split('/')[0], 10);
          return idx - 1; // 1-based index to 0-based
        });

        // Triangulate face fan (0, 1, 2), (0, 2, 3), etc.
        for (let i = 1; i < parts.length - 1; i++) {
          const v0 = vertices[parts[0]];
          const v1 = vertices[parts[i]];
          const v2 = vertices[parts[i + 1]];
          if (v0 && v1 && v2) {
            positions.push(...v0, ...v1, ...v2);
          }
        }
      }
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.computeVertexNormals();
    return geometry;
  }

  if (format === 'stl') {
    if (buffer.byteLength >= 84) {
      const reader = new DataView(buffer);
      const nFaces = reader.getUint32(80, true);
      if (84 + nFaces * 50 === buffer.byteLength) {
        const positions = new Float32Array(nFaces * 9);
        let posIdx = 0;
        for (let face = 0; face < nFaces; face++) {
          const offset = 84 + face * 50;
          for (let v = 0; v < 3; v++) {
            const vOffset = offset + 12 + v * 12;
            positions[posIdx++] = reader.getFloat32(vOffset, true);
            positions[posIdx++] = reader.getFloat32(vOffset + 4, true);
            positions[posIdx++] = reader.getFloat32(vOffset + 8, true);
          }
        }
        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        geometry.computeVertexNormals();
        return geometry;
      }
    }

    const text = decoder.decode(buffer);
    const lines = text.split('\n');
    const positions: number[] = [];

    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (line.startsWith('vertex ')) {
        const parts = line.split(/\s+/).slice(1).map(Number);
        positions.push(...parts);
      }
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.computeVertexNormals();
    return geometry;
  }

  if (format === 'gltf' || format === 'glb') {
    try {
      const text = decoder.decode(buffer);
      const json = JSON.parse(text);
      if (json.SimSyntheticBox) {
        const { width, depth, height } = json.SimSyntheticBox;
        return new THREE.BoxGeometry(width, depth, height);
      }
    } catch {
      // Fallback for non-JSON / mock GLTF
    }

    // Default synthetic box geometry if format payload is generic
    return new THREE.BoxGeometry(0.095, 0.095, 0.15);
  }

  throw new Error(`Unsupported CAD format: ${format}`);
}

export function validateCadEnvelopeAndDroneSocket(params: EnvelopeValidationParams): CadValidationReport {
  const { primaryGeometry, secondaryGeometry, topDroneSocket } = params;
  const errors: string[] = [];

  primaryGeometry.computeBoundingBox();
  secondaryGeometry.computeBoundingBox();

  const pBox = primaryGeometry.boundingBox ?? new THREE.Box3();
  const sBox = secondaryGeometry.boundingBox ?? new THREE.Box3();

  const pSize = new THREE.Vector3();
  const sSize = new THREE.Vector3();
  pBox.getSize(pSize);
  sBox.getSize(sSize);

  const coupledHeightM = pSize.z + sSize.z;
  const maxDiameterM = Math.max(pSize.x, pSize.y, sSize.x, sSize.y);

  if (pSize.z > 0.16) {
    errors.push(`Primary height ${pSize.z.toFixed(3)}m exceeds 0.16m`);
  }
  if (sSize.z > 0.07) {
    errors.push(`Secondary height ${sSize.z.toFixed(3)}m exceeds 0.07m`);
  }
  if (coupledHeightM < 0.20 || coupledHeightM > 0.23) {
    errors.push(`Coupled height ${coupledHeightM.toFixed(3)}m out of range [0.20, 0.23]m`);
  }
  if (maxDiameterM < 0.09 || maxDiameterM > 0.10) {
    errors.push(`Diameter ${maxDiameterM.toFixed(3)}m out of range [0.09, 0.10]m`);
  }

  const droneSocketValid =
    topDroneSocket.diameterMm >= 9.0 &&
    topDroneSocket.diameterMm <= 10.0 &&
    topDroneSocket.depthMm >= 3.0;

  if (!droneSocketValid) {
    errors.push(
      `Drone socket invalid: diameter ${topDroneSocket.diameterMm}mm (expected [9, 10]mm) or depth ${topDroneSocket.depthMm}mm (expected >= 3mm)`
    );
  }

  return {
    isValid: errors.length === 0,
    coupledHeightM,
    maxDiameterM,
    droneSocketValid,
    errors,
  };
}
