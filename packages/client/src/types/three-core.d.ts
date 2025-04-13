declare module 'three' {
  export class Object3D {
    position: Vector3;
    rotation: Euler;
    scale: Vector3;
    geometry?: BufferGeometry;
    material?: Material;
    matrix: Matrix4;
    traverse(callback: (object: Object3D) => void): void;
    add(object: Object3D): this;
    remove(object: Object3D): this;
    getObjectByProperty(name: string, value: any): Object3D | undefined;
    addEventListener(type: string, listener: (event: any) => void): void;
  }

  export class Scene extends Object3D {
    background: Color | null;
    children: Object3D[];
  }

  export class Mesh extends Object3D {
    constructor();
    constructor(geometry: BufferGeometry, material: Material);
    geometry: BufferGeometry;
    material: Material;
    matrixAutoUpdate: boolean;
    visible: boolean;
    rotateX(angle: number): this;
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
    constructor(parameters?: { antialias?: boolean; canvas?: HTMLCanvasElement; alpha?: boolean });
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
      getController(index: number): Object3D;
      getSession(): any;
      getReferenceSpace(): any;
      setAnimationLoop(callback: (timestamp: number, frame?: any) => void): void;
    };
    setAnimationLoop(callback: ((timestamp: number, frame?: any) => void) | null): void;
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

  export class Texture {
    constructor();
    image: any;
    needsUpdate: boolean;
    encoding: number;
    wrapS: number;
    wrapT: number;
    minFilter: number;
    magFilter: number;
    dispose(): void;
  }

  export class TextureLoader {
    constructor();
    load(url: string, onLoad?: (texture: Texture) => void, onProgress?: (event: ProgressEvent) => void, onError?: (event: ErrorEvent) => void): Texture;
  }

  export class MeshStandardMaterial extends Material {
    constructor(parameters?: any);
    map: Texture | null;
    normalMap: Texture | null;
    roughnessMap: Texture | null;
    metalnessMap: Texture | null;
    aoMap: Texture | null;
    displacementMap: Texture | null;
    displacementScale: number;
    side: number;
    needsUpdate: boolean;
  }

  export class MeshBasicMaterial extends Material {
    constructor(parameters?: any);
    map: Texture | null;
    color: Color;
    side: number;
  }

  export class BoxGeometry extends BufferGeometry {
    constructor(width?: number, height?: number, depth?: number);
  }

  export class PlaneGeometry extends BufferGeometry {
    constructor(width?: number, height?: number, widthSegments?: number, heightSegments?: number);
  }

  export class RingGeometry extends BufferGeometry {
    constructor();
    constructor(innerRadius?: number, outerRadius?: number, thetaSegments?: number, phiSegments?: number, thetaStart?: number, thetaLength?: number);
  }

  export class Matrix4 {
    constructor();
    identity(): this;
    compose(position: Vector3, quaternion: any, scale: Vector3): this;
    fromArray(array: number[]): this;
    copy(m: Matrix4): this;
    setFromMatrixPosition(m: Matrix4): Vector3;
  }

  export const DoubleSide: number;
  export const LinearEncoding: number;
  export const sRGBEncoding: number;
  export const PCFSoftShadowMap: number;
}