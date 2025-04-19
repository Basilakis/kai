/**
 * Type declarations for Three.js examples
 */

import * as THREE from 'three';

// Transform Controls
declare module 'three/examples/jsm/controls/TransformControls' {
  export class TransformControls extends THREE.Object3D {
    constructor(camera: THREE.Camera, domElement?: HTMLElement);
    
    // Properties
    camera: THREE.Camera;
    object: THREE.Object3D | null;
    enabled: boolean;
    axis: string | null;
    mode: string;
    translationSnap: number | null;
    rotationSnap: number | null;
    space: string;
    size: number;
    dragging: boolean;
    showX: boolean;
    showY: boolean;
    showZ: boolean;
    domElement: HTMLElement;
    
    // Methods
    attach(object: THREE.Object3D): this;
    detach(): this;
    getMode(): string;
    setMode(mode: string): void;
    setTranslationSnap(translationSnap: number | null): void;
    setRotationSnap(rotationSnap: number | null): void;
    setSize(size: number): void;
    setSpace(space: string): void;
    dispose(): void;
    
    // Events
    addEventListener(type: string, listener: (event: { type: string; value?: boolean; [key: string]: any }) => void): void;
    removeEventListener(type: string, listener: (event: { type: string; value?: boolean; [key: string]: any }) => void): void;
    dispatchEvent(event: { type: string; [key: string]: any }): void;
  }
}

// OrbitControls
declare module 'three/examples/jsm/controls/OrbitControls' {
  export class OrbitControls {
    constructor(camera: THREE.Camera, domElement?: HTMLElement);
    
    // Properties
    enabled: boolean;
    target: THREE.Vector3;
    minDistance: number;
    maxDistance: number;
    minZoom: number;
    maxZoom: number;
    minPolarAngle: number;
    maxPolarAngle: number;
    minAzimuthAngle: number;
    maxAzimuthAngle: number;
    enableDamping: boolean;
    dampingFactor: number;
    enableZoom: boolean;
    zoomSpeed: number;
    enableRotate: boolean;
    rotateSpeed: number;
    enablePan: boolean;
    panSpeed: number;
    screenSpacePanning: boolean;
    keyPanSpeed: number;
    autoRotate: boolean;
    autoRotateSpeed: number;
    enableKeys: boolean;
    keys: { LEFT: number; UP: number; RIGHT: number; BOTTOM: number };
    mouseButtons: { LEFT: number; MIDDLE: number; RIGHT: number };
    
    // Methods
    update(): boolean;
    dispose(): void;
    getPolarAngle(): number;
    getAzimuthalAngle(): number;
    saveState(): void;
    reset(): void;
  }
}

// Mesh BVH
declare module 'three-mesh-bvh' {
  export function computeBoundsTree(geometry: THREE.BufferGeometry): void;
  export function disposeBoundsTree(geometry: THREE.BufferGeometry): void;
  export class MeshBVH {
    constructor(geometry: THREE.BufferGeometry, options?: any);
  }
  export class AcceleratedRaycast {
    constructor();
  }
}
