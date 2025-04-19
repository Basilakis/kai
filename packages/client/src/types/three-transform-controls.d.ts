import * as THREE from 'three';

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
    addEventListener(type: string, listener: (event: { type: string; [key: string]: any }) => void): void;
    removeEventListener(type: string, listener: (event: { type: string; [key: string]: any }) => void): void;
    dispatchEvent(event: { type: string; [key: string]: any }): void;
  }
}