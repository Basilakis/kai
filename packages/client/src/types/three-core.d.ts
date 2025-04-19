declare module 'three' {
  export class Object3D {
    position: Vector3;
    rotation: Euler;
    scale: Vector3;
    geometry?: BufferGeometry;
    material?: Material | Material[];
    matrix: Matrix4;
    matrixWorld: Matrix4;
    matrixAutoUpdate: boolean;
    visible: boolean;
    parent: Object3D | null;
    children: Object3D[];
    name: string;
    uuid: string;
    traverse(callback: (object: Object3D) => void): void;
    add(object: Object3D): this;
    remove(object: Object3D): this;
    getObjectByProperty(name: string, value: any): Object3D | undefined;
    addEventListener(type: string, listener: (event: any) => void): void;
    clone(recursive?: boolean): this;
  }

  export class Scene extends Object3D {
    background: Color | null;
  }

  export class Mesh extends Object3D {
    constructor();
    constructor(geometry: BufferGeometry, material: Material);
    geometry: BufferGeometry;
    material: Material | Material[];
    rotateX(angle: number): this;
    clone(recursive?: boolean): this;
    receiveShadow: boolean;
    castShadow: boolean;
  }

  export class Group extends Object3D {}

  export class LOD extends Object3D {
    constructor();
    levels: { distance: number; object: Object3D }[];
    addLevel(object: Object3D, distance: number): this;
    getObjectForDistance(distance: number): Object3D | null;
    update(camera: Camera): void;
  }

  export class BufferGeometry {
    dispose(): void;
    computeBoundsTree?: () => void;
    disposeBoundsTree?: () => void;
    boundsTree?: any;
    boundingSphere: Sphere | null;
    setAttribute(name: string, attribute: BufferAttribute): this;
    clone(): BufferGeometry;
  }

  export class BufferAttribute {
    constructor(array: ArrayLike<number>, itemSize: number, normalized?: boolean);
    count: number;
    itemSize: number;
    array: ArrayLike<number>;
  }

  export class Material {
    dispose(): void;
    transparent: boolean;
    vertexColors: boolean;
    depthTest: boolean;
    depthWrite: boolean;
    blending: number;
    side: number;
    needsUpdate: boolean;
  }

  export class ShaderMaterial extends Material {
    constructor(parameters?: {
      uniforms?: { [uniform: string]: { value: any } };
      vertexShader?: string;
      fragmentShader?: string;
      transparent?: boolean;
      vertexColors?: boolean;
      depthTest?: boolean;
      depthWrite?: boolean;
      blending?: number;
    });
    uniforms: { [uniform: string]: { value: any } };
    vertexShader: string;
    fragmentShader: string;
  }

  export class Color {
    constructor();
    constructor(hex: number);
    constructor(r: number, g: number, b: number);
    r: number;
    g: number;
    b: number;
    set(color: Color | number | string): this;
    copy(color: Color): this;
  }

  export class Vector3 {
    x: number;
    y: number;
    z: number;
    set(x: number, y: number, z: number): this;
    sub(v: Vector3): this;
    multiplyScalar(scalar: number): this;
    copy(v: Vector3): this;
    distanceTo(v: Vector3): number;
    constructor();
    constructor(x: number, y: number, z: number);
  }

  export class Euler {
    x: number;
    y: number;
    z: number;
    set(x: number, y: number, z: number): this;
    copy(e: Euler): this;
  }

  export class Box3 {
    min: Vector3;
    max: Vector3;
    setFromObject(object: Object3D): this;
    getCenter(target: Vector3): Vector3;
    getSize(target: Vector3): Vector3;
    intersectsBox(box: Box3): boolean;
  }

  export class Sphere {
    center: Vector3;
    radius: number;
  }

  export class Frustum {
    constructor();
    planes: Plane[];
    setFromProjectionMatrix(m: Matrix4): this;
    intersectsObject(object: Object3D): boolean;
  }

  export class Plane {
    normal: Vector3;
    constant: number;
  }

  export interface WebGLRendererParameters {
    canvas?: HTMLCanvasElement;
    context?: WebGLRenderingContext;
    precision?: string;
    alpha?: boolean;
    premultipliedAlpha?: boolean;
    antialias?: boolean;
    stencil?: boolean;
    preserveDrawingBuffer?: boolean;
    powerPreference?: string;
    depth?: boolean;
    logarithmicDepthBuffer?: boolean;
  }

  export class WebGLRenderer {
    constructor(parameters?: WebGLRendererParameters);
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

  export class Camera extends Object3D {
    matrixWorldInverse: Matrix4;
    projectionMatrix: Matrix4;
  }

  export class PerspectiveCamera extends Camera {
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
    shadow: {
      mapSize: { width: number; height: number };
      camera: { near: number; far: number };
      bias: number;
    };
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

  export interface MeshStandardMaterialParameters {
    color?: Color | string | number;
    roughness?: number;
    metalness?: number;
    map?: Texture | null;
    normalMap?: Texture | null;
    roughnessMap?: Texture | null;
    metalnessMap?: Texture | null;
    aoMap?: Texture | null;
    aoMapIntensity?: number;
    displacementMap?: Texture | null;
    displacementScale?: number;
    emissive?: Color | string | number;
    emissiveIntensity?: number;
    envMap?: Texture | null;
    envMapIntensity?: number;
    wireframe?: boolean;
    transparent?: boolean;
    opacity?: number;
    side?: number;
  }

  export class MeshStandardMaterial extends Material {
    constructor(parameters?: MeshStandardMaterialParameters);
    map: Texture | null;
    normalMap: Texture | null;
    roughnessMap: Texture | null;
    metalnessMap: Texture | null;
    aoMap: Texture | null;
    aoMapIntensity: number;
    displacementMap: Texture | null;
    displacementScale: number;
    emissive: Color;
    emissiveIntensity: number;
    envMap: Texture | null;
    envMapIntensity: number;
    wireframe: boolean;
    color: Color;
    roughness: number;
    metalness: number;
  }

  export interface MeshPhysicalMaterialParameters extends MeshStandardMaterialParameters {
    clearcoat?: number;
    clearcoatRoughness?: number;
    clearcoatMap?: Texture | null;
    clearcoatRoughnessMap?: Texture | null;
    clearcoatNormalMap?: Texture | null;
    reflectivity?: number;
    ior?: number;
    sheen?: number;
    sheenColor?: Color | string | number;
    sheenRoughness?: number;
    transmission?: number;
    thickness?: number;
    attenuationColor?: Color | string | number;
    attenuationDistance?: number;
    specularIntensity?: number;
    specularColor?: Color | string | number;
  }

  export class MeshPhysicalMaterial extends MeshStandardMaterial {
    constructor(parameters?: MeshPhysicalMaterialParameters);
    clearcoat: number;
    clearcoatRoughness: number;
    clearcoatMap: Texture | null;
    clearcoatRoughnessMap: Texture | null;
    clearcoatNormalMap: Texture | null;
    reflectivity: number;
    ior: number;
    sheen: number;
    sheenColor: Color;
    sheenRoughness: number;
    transmission: number;
    thickness: number;
    attenuationColor: Color;
    attenuationDistance: number;
    specularIntensity: number;
    specularColor: Color;
  }

  export class MeshBasicMaterial extends Material {
    constructor(parameters?: any);
    map: Texture | null;
    color: Color;
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
    multiplyMatrices(a: Matrix4, b: Matrix4): this;
  }

  export const DoubleSide: number;
  export const LinearEncoding: number;
  export const sRGBEncoding: number;
  export const PCFSoftShadowMap: number;
  export const NormalBlending: number;
}