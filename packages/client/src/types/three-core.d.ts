declare module 'three' {
  export class Object3D {
    position: Vector3;
    rotation: Euler;
    scale: Vector3;
    geometry?: BufferGeometry;
    material?: Material;
    traverse(callback: (object: Object3D) => void): void;
    add(object: Object3D): this;
    remove(object: Object3D): this;
    getObjectByProperty(name: string, value: any): Object3D | undefined;
  }

  export class Scene extends Object3D {
    background: Color | null;
    children: Object3D[];
  }

  export class Mesh extends Object3D {
    geometry: BufferGeometry;
    material: Material;
  }

  export class Group extends Object3D {}

  export class BufferGeometry {
    dispose(): void;
    computeBoundsTree?: () => void;
    boundsTree?: any;
  }

  export class Material {
    dispose(): void;
  }

  export class Color {
    constructor(hex: number);
  }

  export class Vector3 {
    x: number;
    y: number;
    z: number;
    set(x: number, y: number, z: number): this;
    sub(v: Vector3): this;
    multiplyScalar(scalar: number): this;
  }

  export class Euler {
    x: number;
    y: number;
    z: number;
    set(x: number, y: number, z: number): this;
  }

  export class Box3 {
    setFromObject(object: Object3D): this;
    getCenter(target: Vector3): Vector3;
    getSize(target: Vector3): Vector3;
  }

  export class WebGLRenderer {
    constructor(parameters?: { antialias?: boolean });
    setSize(width: number, height: number): void;
    setPixelRatio(value: number): void;
    render(scene: Scene, camera: Camera): void;
    dispose(): void;
    domElement: HTMLCanvasElement;
    shadowMap: {
      enabled: boolean;
      type: number;
    };
    xr: {
      enabled: boolean;
      isPresenting: boolean;
    };
  }

  export class PerspectiveCamera extends Object3D {
    constructor(fov: number, aspect: number, near: number, far: number);
    aspect: number;
    updateProjectionMatrix(): void;
  }

  export class AmbientLight extends Object3D {
    constructor(color: number, intensity?: number);
  }

  export class DirectionalLight extends Object3D {
    constructor(color: number, intensity?: number);
    castShadow: boolean;
  }

  export const PCFSoftShadowMap: number;
}