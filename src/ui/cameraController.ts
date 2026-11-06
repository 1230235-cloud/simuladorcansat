import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { Scene3DState } from './scene3d';

export type CameraViewMode =
  | 'orbit'
  | 'followPrimary'
  | 'followSecondary'
  | 'fixedDrone'
  | 'fixedSeparation'
  | 'fixedTarget';

export class CameraController {
  private camera: THREE.PerspectiveCamera;
  private controls: OrbitControls;
  private currentMode: CameraViewMode = 'orbit';
  private dropAltitudeM = 450.0;
  private separationAltitudeM = 200.0;

  constructor(camera: THREE.PerspectiveCamera, controls: OrbitControls) {
    this.camera = camera;
    this.controls = controls;
    this.setMode('orbit');
  }

  public setAltitudes(dropAlt: number, sepAlt: number): void {
    this.dropAltitudeM = dropAlt;
    this.separationAltitudeM = sepAlt;
    if (this.currentMode === 'fixedDrone' || this.currentMode === 'fixedSeparation') {
      this.setMode(this.currentMode);
    }
  }

  public setMode(mode: CameraViewMode): void {
    this.currentMode = mode;
    this.controls.enabled = mode === 'orbit';

    if (mode === 'orbit') {
      this.camera.position.set(0, 8, 12);
      this.controls.target.set(0, 3, 0);
      this.controls.update();
    } else if (mode === 'fixedDrone') {
      this.camera.position.set(0.2, this.dropAltitudeM + 3, 0.2);
    } else if (mode === 'fixedSeparation') {
      this.camera.position.set(8, this.separationAltitudeM, 8);
    } else if (mode === 'fixedTarget') {
      this.camera.position.set(2.2, 0.3, 2.2);
    }
  }

  public getMode(): CameraViewMode {
    return this.currentMode;
  }

  public framePreview(targetY = 0.1): void {
    this.currentMode = 'orbit';
    this.controls.enabled = true;
    this.controls.target.set(0, targetY + 0.08, 0);
    this.camera.position.set(0.35, targetY + 0.25, 0.45);
    this.camera.lookAt(0, targetY + 0.08, 0);
    this.controls.update();
  }

  public update(state: Scene3DState): void {
    const pY = state.primaryZ;
    const sY = state.secondaryZ;
    const secX = state.isSeparated ? 0.5 : 0;
    const secZ = state.isSeparated ? 0.5 : 0;

    switch (this.currentMode) {
      case 'orbit':
        this.controls.update();
        break;

      case 'followPrimary':
        this.controls.target.set(0, pY + 0.08, 0);
        this.camera.position.set(1.5, pY + 0.4, 1.8);
        this.camera.lookAt(0, pY + 0.08, 0);
        break;

      case 'followSecondary':
        this.controls.target.set(secX, sY + 0.04, secZ);
        this.camera.position.set(secX + 1.2, sY + 0.3, secZ + 1.2);
        this.camera.lookAt(secX, sY + 0.04, secZ);
        break;

      case 'fixedDrone':
        this.camera.position.set(0.2, this.dropAltitudeM + 3, 0.2);
        this.camera.lookAt(0, Math.min(this.dropAltitudeM - 1, pY), 0);
        break;

      case 'fixedSeparation':
        this.camera.position.set(8, this.separationAltitudeM, 8);
        this.camera.lookAt(0, pY > this.separationAltitudeM - 10 && pY < this.separationAltitudeM + 10 ? pY : this.separationAltitudeM, 0);
        break;

      case 'fixedTarget':
        this.camera.position.set(2.2, 0.3, 2.2);
        this.camera.lookAt(0, Math.max(0.1, pY), 0);
        break;
    }
  }
}
