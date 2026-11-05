import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { Scene3DState } from './scene3d';

export class CanSat3DViewport {
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private controls: OrbitControls;
  private primaryGroup: THREE.Group;
  private secondaryGroup: THREE.Group;
  private rotorGroup: THREE.Group;
  private thrustArrow: THREE.ArrowHelper;
  private relativeArrow: THREE.ArrowHelper;
  private comMarker: THREE.Mesh;
  private primaryMesh: THREE.Mesh;
  private secondaryMesh: THREE.Mesh;

  constructor(container: HTMLElement) {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x0b0f19);

    const width = container.clientWidth || 800;
    const height = container.clientHeight || 500;
    this.camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
    this.camera.position.set(0, -12, 10);
    this.camera.up.set(0, 0, 1);

    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setSize(width, height);
    this.renderer.shadowMap.enabled = true;
    container.appendChild(this.renderer.domElement);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;

    this.initLights();
    this.initEnvironment();

    this.primaryGroup = new THREE.Group();
    this.secondaryGroup = new THREE.Group();
    this.rotorGroup = new THREE.Group();

    this.primaryMesh = this.createDefaultBody(0.048, 0.155, 0x38bdf8);
    this.secondaryMesh = this.createDefaultBody(0.048, 0.065, 0xf59e0b);
    this.primaryGroup.add(this.primaryMesh);
    this.secondaryGroup.add(this.secondaryMesh);

    this.initRotor();
    this.primaryGroup.add(this.rotorGroup);

    this.scene.add(this.primaryGroup);
    this.scene.add(this.secondaryGroup);

    this.thrustArrow = new THREE.ArrowHelper(new THREE.Vector3(0, 0, 1), new THREE.Vector3(), 1, 0x22c55e);
    this.relativeArrow = new THREE.ArrowHelper(new THREE.Vector3(1, 0, 0), new THREE.Vector3(), 1, 0xf43f5e);
    this.scene.add(this.thrustArrow);
    this.scene.add(this.relativeArrow);

    const comGeo = new THREE.SphereGeometry(0.02, 16, 16);
    this.comMarker = new THREE.Mesh(comGeo, new THREE.MeshBasicMaterial({ color: 0xeab308 }));
    this.scene.add(this.comMarker);

    window.addEventListener('resize', () => this.onResize(container));
  }

  private initLights(): void {
    const ambient = new THREE.AmbientLight(0xffffff, 0.7);
    this.scene.add(ambient);
    const sun = new THREE.DirectionalLight(0xffffff, 1.2);
    sun.position.set(20, -30, 50);
    this.scene.add(sun);
  }

  private initEnvironment(): void {
    const grid = new THREE.GridHelper(100, 50, 0x334155, 0x1e293b);
    grid.rotation.x = Math.PI / 2;
    this.scene.add(grid);

    // 3m Ground Target Circle
    const targetGroup = new THREE.Group();
    const colors = [0xef4444, 0xffffff, 0xef4444, 0x38bdf8];
    const radii = [1.5, 1.0, 0.5, 0.15];
    radii.forEach((r, idx) => {
      const ring = new THREE.Mesh(
        new THREE.RingGeometry(r - 0.02, r, 64),
        new THREE.MeshBasicMaterial({ color: colors[idx], side: THREE.DoubleSide })
      );
      targetGroup.add(ring);
    });
    this.scene.add(targetGroup);
  }

  private createDefaultBody(radius: number, height: number, color: number): THREE.Mesh {
    const geo = new THREE.CylinderGeometry(radius, radius, height, 32);
    geo.rotateX(Math.PI / 2);
    const mat = new THREE.MeshStandardMaterial({ color, metalness: 0.3, roughness: 0.4 });
    return new THREE.Mesh(geo, mat);
  }

  private initRotor(): void {
    const hub = new THREE.Mesh(
      new THREE.CylinderGeometry(0.015, 0.015, 0.01, 16),
      new THREE.MeshStandardMaterial({ color: 0x94a3b8 })
    );
    hub.rotateX(Math.PI / 2);
    this.rotorGroup.add(hub);

    for (let i = 0; i < 3; i++) {
      const angle = (i * 2 * Math.PI) / 3;
      const blade = new THREE.Mesh(
        new THREE.BoxGeometry(0.20, 0.038, 0.002),
        new THREE.MeshStandardMaterial({ color: 0x22c55e, roughness: 0.2 })
      );
      blade.position.set(Math.cos(angle) * 0.10, Math.sin(angle) * 0.10, 0);
      blade.rotation.z = angle;
      this.rotorGroup.add(blade);
    }
    this.rotorGroup.position.set(0, 0, 0.08);
  }

  public loadCustomCadGeometry(target: 'primary' | 'secondary', geometry: THREE.BufferGeometry): void {
    geometry.computeVertexNormals();
    const mat = new THREE.MeshStandardMaterial({
      color: target === 'primary' ? 0x38bdf8 : 0xf59e0b,
      metalness: 0.2,
      roughness: 0.5,
    });
    const newMesh = new THREE.Mesh(geometry, mat);

    if (target === 'primary') {
      this.primaryGroup.remove(this.primaryMesh);
      this.primaryMesh = newMesh;
      this.primaryGroup.add(this.primaryMesh);
    } else {
      this.secondaryGroup.remove(this.secondaryMesh);
      this.secondaryMesh = newMesh;
      this.secondaryGroup.add(this.secondaryMesh);
    }
  }

  public updateState(state: Scene3DState, follow: 'primary' | 'secondary' | 'overview'): void {
    // Coordinate scale: 1 world unit = 1 meter
    this.primaryGroup.position.set(0, 0, state.primaryZ);
    this.rotorGroup.rotation.z = state.bladeSpinAngleRad;

    if (!state.isSeparated) {
      this.secondaryGroup.position.set(0, 0, state.primaryZ - 0.11);
      this.relativeArrow.visible = false;
    } else {
      this.secondaryGroup.position.set(0.5, 0.5, state.secondaryZ);
      this.relativeArrow.visible = true;
      const origin = this.primaryGroup.position;
      const dest = this.secondaryGroup.position;
      const dir = new THREE.Vector3().subVectors(dest, origin).normalize();
      const dist = origin.distanceTo(dest);
      this.relativeArrow.setDirection(dir);
      this.relativeArrow.setLength(Math.max(0.1, dist));
      this.relativeArrow.position.copy(origin);
    }

    // Thrust vector
    const thrustLen = Math.min(2.0, state.vectors.thrustN * 0.4);
    this.thrustArrow.position.set(0, 0, state.primaryZ + 0.08);
    this.thrustArrow.setLength(thrustLen);
    this.thrustArrow.visible = state.vectors.thrustN > 0.01;

    // CoM Marker
    this.comMarker.position.set(0, 0, state.primaryZ);

    // Follow camera
    if (follow === 'primary') {
      this.controls.target.set(0, 0, state.primaryZ);
    } else if (follow === 'secondary') {
      this.controls.target.set(0.5, 0.5, state.secondaryZ);
    } else {
      this.controls.target.set(0, 0, Math.min(50, state.primaryZ / 2));
    }

    this.controls.update();
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
