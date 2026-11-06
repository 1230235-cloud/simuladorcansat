import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { Scene3DState } from './scene3d';
import { CameraController, CameraViewMode } from './cameraController';

export class CanSat3DViewport {
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private controls: OrbitControls;
  private cameraController: CameraController;
  private primaryGroup: THREE.Group;
  private secondaryGroup: THREE.Group;
  private rotorGroup: THREE.Group;
  private thrustArrow: THREE.ArrowHelper;
  private relativeArrow: THREE.ArrowHelper;
  private comMarker: THREE.Mesh;
  private primaryMesh: THREE.Mesh;
  private secondaryMesh: THREE.Mesh;
  private lastPrimaryBlink = false;
  private lastSecondaryBlink = false;

  constructor(container: HTMLElement) {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x0b0f19);

    const width = container.clientWidth || 800;
    const height = container.clientHeight || 500;
    this.camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);

    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setSize(width, height);
    this.renderer.shadowMap.enabled = true;
    container.appendChild(this.renderer.domElement);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.cameraController = new CameraController(this.camera, this.controls);

    this.initLights();
    this.initEnvironment();

    this.primaryGroup = new THREE.Group();
    this.secondaryGroup = new THREE.Group();
    this.rotorGroup = new THREE.Group();

    this.primaryMesh = this.createDefaultBody(0.048, 0.14, 0x94a3b8, 0.8);
    this.secondaryMesh = this.createDefaultBody(0.048, 0.07, 0x0d9488, 1.0);
    this.primaryGroup.add(this.primaryMesh);
    this.secondaryGroup.add(this.secondaryMesh);

    this.initDefaultRotor();
    this.rotorGroup.position.set(0, 0.145, 0);
    this.primaryGroup.add(this.rotorGroup);

    this.scene.add(this.primaryGroup);
    this.scene.add(this.secondaryGroup);

    this.thrustArrow = new THREE.ArrowHelper(new THREE.Vector3(0, 1, 0), new THREE.Vector3(), 1, 0x22c55e);
    this.relativeArrow = new THREE.ArrowHelper(new THREE.Vector3(1, 0, 0), new THREE.Vector3(), 1, 0xf43f5e);
    this.scene.add(this.thrustArrow);
    this.scene.add(this.relativeArrow);

    const comGeo = new THREE.SphereGeometry(0.02, 16, 16);
    this.comMarker = new THREE.Mesh(comGeo, new THREE.MeshBasicMaterial({ color: 0xeab308 }));
    this.scene.add(this.comMarker);

    window.addEventListener('resize', () => this.onResize(container));
  }

  private initLights(): void {
    this.scene.add(new THREE.AmbientLight(0xffffff, 0.7));
    const sun = new THREE.DirectionalLight(0xffffff, 1.2);
    sun.position.set(20, 50, 30);
    this.scene.add(sun);
  }

  private initEnvironment(): void {
    this.scene.add(new THREE.GridHelper(100, 50, 0x334155, 0x1e293b));
    const targetGroup = new THREE.Group();
    [1.5, 1.0, 0.5, 0.15].forEach((r, idx) => {
      const c = [0xef4444, 0xffffff, 0xef4444, 0x38bdf8][idx];
      const ring = new THREE.Mesh(new THREE.RingGeometry(r - 0.02, r, 64), new THREE.MeshBasicMaterial({ color: c, side: THREE.DoubleSide }));
      ring.rotateX(-Math.PI / 2);
      ring.position.y = 0.002;
      targetGroup.add(ring);
    });
    this.scene.add(targetGroup);
  }

  private createDefaultBody(radius: number, height: number, color: number, opacity = 1.0): THREE.Mesh {
    const geo = new THREE.CylinderGeometry(radius, radius, height, 32);
    geo.translate(0, height / 2, 0);
    return new THREE.Mesh(geo, new THREE.MeshStandardMaterial({
      color, metalness: 0.2, roughness: 0.5, transparent: opacity < 1.0, opacity, side: THREE.DoubleSide,
    }));
  }

  private initDefaultRotor(): void {
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.01, 16), new THREE.MeshStandardMaterial({ color: 0x94a3b8 }));
    this.rotorGroup.add(hub);
    for (let i = 0; i < 3; i++) {
      const angle = (i * 2 * Math.PI) / 3;
      const blade = new THREE.Mesh(new THREE.BoxGeometry(0.20, 0.002, 0.038), new THREE.MeshStandardMaterial({ color: 0xf97316, roughness: 0.3, side: THREE.DoubleSide }));
      blade.position.set(Math.cos(angle) * 0.10, 0, Math.sin(angle) * 0.10);
      blade.rotation.y = angle;
      this.rotorGroup.add(blade);
    }
  }

  public setCameraMode(mode: CameraViewMode): void {
    this.cameraController.setMode(mode);
  }

  public setAltitudes(dropAlt: number, sepAlt: number): void {
    this.cameraController.setAltitudes(dropAlt, sepAlt);
  }

  public loadCustomCadGeometry(
    target: 'complete' | 'primary' | 'secondary' | 'blades',
    geometry: THREE.BufferGeometry,
    shouldFrameCamera = true
  ): void {
    // 1) OpenSCAD Z-up to Three.js Y-up + mm to meters scaling
    geometry.rotateX(-Math.PI / 2);
    geometry.computeBoundingBox();
    if (geometry.boundingBox) {
      const size = new THREE.Vector3();
      geometry.boundingBox.getSize(size);
      const maxDim = Math.max(size.x, size.y, size.z);
      if (maxDim > 5.0) geometry.scale(0.001, 0.001, 0.001);
      else if (maxDim > 0.5) geometry.scale(0.01, 0.01, 0.01);
    }
    geometry.computeVertexNormals();

    if (target === 'blades') {
      while (this.rotorGroup.children.length > 0) this.rotorGroup.remove(this.rotorGroup.children[0]);
      const mat = new THREE.MeshStandardMaterial({ color: 0xf97316, roughness: 0.3, side: THREE.DoubleSide });
      this.rotorGroup.add(new THREE.Mesh(geometry, mat));
      this.rotorGroup.position.set(0, 0.145, 0);
      if (shouldFrameCamera) this.cameraController.framePreview(this.primaryGroup.position.y);
      this.render();
      return;
    }

    const isPrimary = target === 'primary' || target === 'complete';
    const mat = new THREE.MeshStandardMaterial({
      color: isPrimary ? 0x94a3b8 : 0x0d9488,
      transparent: isPrimary,
      opacity: isPrimary ? 0.8 : 1.0,
      metalness: 0.2,
      roughness: 0.5,
      side: THREE.DoubleSide,
    });
    const newMesh = new THREE.Mesh(geometry, mat);

    if (isPrimary) {
      this.primaryGroup.remove(this.primaryMesh);
      this.primaryMesh = newMesh;
      this.primaryGroup.add(this.primaryMesh);
      if (target === 'complete') this.secondaryMesh.visible = false;
    } else {
      this.secondaryGroup.remove(this.secondaryMesh);
      this.secondaryMesh = newMesh;
      this.secondaryGroup.add(this.secondaryMesh);
      this.secondaryMesh.visible = true;
    }

    if (shouldFrameCamera) this.cameraController.framePreview(this.primaryGroup.position.y);
    this.render();
  }

  public updateState(state: Scene3DState, cameraMode?: CameraViewMode): void {
    if (cameraMode && cameraMode !== this.cameraController.getMode()) {
      this.cameraController.setMode(cameraMode);
    }

    this.primaryGroup.position.set(0, state.primaryZ, 0);

    // 3) Separation & blade deployment animation at 200m
    if (!state.isSeparated) {
      // 450m -> 200m: Secondary nested directly on top of primary (+0.14m locales)
      this.secondaryGroup.position.set(0, state.primaryZ + 0.14, 0);
      this.rotorGroup.visible = false; // Blades folded/hidden inside primary
      this.relativeArrow.visible = false;
    } else {
      // < 200m: Secondary free falls on independent trajectory, blades deployed at top
      this.secondaryGroup.position.set(0.5, state.secondaryZ, 0.5);
      this.rotorGroup.visible = true;
      this.rotorGroup.position.set(0, 0.145, 0);
      this.rotorGroup.rotation.y = state.bladeSpinAngleRad;
      this.relativeArrow.visible = true;

      const origin = this.primaryGroup.position;
      const dest = this.secondaryGroup.position;
      const dir = new THREE.Vector3().subVectors(dest, origin).normalize();
      this.relativeArrow.setDirection(dir);
      this.relativeArrow.setLength(Math.max(0.1, origin.distanceTo(dest)));
      this.relativeArrow.position.copy(origin);
    }

    const thrustLen = Math.min(2.0, state.vectors.thrustN * 0.4);
    this.thrustArrow.position.set(0, state.primaryZ + 0.145, 0);
    this.thrustArrow.setLength(thrustLen);
    this.thrustArrow.visible = state.vectors.thrustN > 0.01;
    this.comMarker.position.set(0, state.primaryZ + 0.08, 0);

    this.cameraController.update(state);
    if (this.lastPrimaryBlink || this.lastSecondaryBlink) this.updateBlinkColor();
    this.renderer.render(this.scene, this.camera);
  }

  public setBlinkState(primaryBlink: boolean, secondaryBlink: boolean): void {
    this.lastPrimaryBlink = primaryBlink;
    this.lastSecondaryBlink = secondaryBlink;
    this.updateBlinkColor();
  }

  private updateBlinkColor(): void {
    const isRed = Math.floor(Date.now() / 250) % 2 === 0;
    this.applyBlink(this.primaryMesh, this.lastPrimaryBlink && isRed);
    this.applyBlink(this.secondaryMesh, this.lastSecondaryBlink && isRed);
  }

  private applyBlink(mesh: THREE.Mesh, active: boolean): void {
    const mat = mesh.material as THREE.MeshStandardMaterial;
    if (mat && mat.emissive) mat.emissive.setHex(active ? 0xef4444 : 0x000000);
  }

  public render(): void {
    this.controls.update();
    if (this.lastPrimaryBlink || this.lastSecondaryBlink) this.updateBlinkColor();
    this.renderer.render(this.scene, this.camera);
  }

  private onResize(container: HTMLElement): void {
    const w = container.clientWidth;
    const h = container.clientHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
  }
}
