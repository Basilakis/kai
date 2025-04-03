declare module 'three' {
  export * from '@types/three';
}

declare module 'three/examples/jsm/controls/OrbitControls' {
  import { Camera, EventDispatcher } from 'three';

  export class OrbitControls extends EventDispatcher {
    constructor(object: Camera, domElement?: HTMLElement);
    enabled: boolean;
    target: THREE.Vector3;
    enableDamping: boolean;
    dampingFactor: number;
    enableZoom: boolean;
    enableRotate: boolean;
    enablePan: boolean;
    update(): void;
    dispose(): void;
  }
}

declare module 'three/examples/jsm/exporters/GLTFExporter' {
  import { Object3D, Scene } from 'three';

  export interface GLTFExporterOptions {
    binary: boolean;
    embedImages: boolean;
    maxTextureSize?: number;
  }

  export class GLTFExporter {
    parse(
      input: Object3D | Scene,
      onCompleted: (buffer: ArrayBuffer) => void,
      options?: GLTFExporterOptions
    ): void;
  }
}

declare module 'three/examples/jsm/exporters/OBJExporter' {
  import { Object3D, Scene } from 'three';

  export class OBJExporter {
    parse(scene: Object3D | Scene): string;
  }
}

declare module 'three/examples/jsm/exporters/FBXExporter' {
  import { Object3D, Scene } from 'three';

  export class FBXExporter {
    parse(scene: Object3D | Scene): ArrayBuffer;
  }
}

declare module 'three/examples/jsm/webxr/VRButton' {
  import { WebGLRenderer } from 'three';

  export class VRButton {
    static createButton(renderer: WebGLRenderer): HTMLElement;
  }
}

declare module 'three/examples/jsm/webxr/ARButton' {
  import { WebGLRenderer } from 'three';

  export class ARButton {
    static createButton(renderer: WebGLRenderer): HTMLElement;
  }
}

declare module 'three-mesh-bvh' {
  import { BufferGeometry, Intersection, Mesh, Ray } from 'three';

  export function computeBoundsTree(this: BufferGeometry): void;
  export function disposeBoundsTree(this: BufferGeometry): void;
  
  export interface AcceleratedRaycast {
    (ray: Ray, intersects: Intersection[]): void;
  }

  export const AcceleratedRaycast: AcceleratedRaycast;

  declare global {
    namespace THREE {
      interface BufferGeometry {
        computeBoundsTree: typeof computeBoundsTree;
        disposeBoundsTree: typeof disposeBoundsTree;
        boundsTree?: any;
      }

      interface Mesh {
        raycast: AcceleratedRaycast;
      }
    }
  }
}

declare module 'three/examples/jsm/loaders/GLTFLoader' {
  import { Object3D, LoadingManager } from 'three';

  export class GLTFLoader {
    constructor(manager?: LoadingManager);
    load(url: string, onLoad: (gltf: { scene: Object3D }) => void, onProgress?: (event: ProgressEvent) => void, onError?: (error: ErrorEvent) => void): void;
    loadAsync(url: string, onProgress?: (event: ProgressEvent) => void): Promise<{ scene: Object3D }>;
  }
}

declare module 'three/examples/jsm/loaders/FBXLoader' {
  import { Object3D, LoadingManager } from 'three';

  export class FBXLoader {
    constructor(manager?: LoadingManager);
    load(url: string, onLoad: (object: Object3D) => void, onProgress?: (event: ProgressEvent) => void, onError?: (error: ErrorEvent) => void): void;
    loadAsync(url: string, onProgress?: (event: ProgressEvent) => void): Promise<Object3D>;
  }
}

declare module 'three/examples/jsm/loaders/OBJLoader' {
  import { Object3D, LoadingManager } from 'three';

  export class OBJLoader {
    constructor(manager?: LoadingManager);
    load(url: string, onLoad: (object: Object3D) => void, onProgress?: (event: ProgressEvent) => void, onError?: (error: ErrorEvent) => void): void;
    loadAsync(url: string, onProgress?: (event: ProgressEvent) => void): Promise<Object3D>;
  }
}