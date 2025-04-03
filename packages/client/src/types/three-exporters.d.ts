import * as THREE from 'three';

declare module 'three/examples/jsm/exporters/GLTFExporter' {
  export class GLTFExporter {
    parse(
      scene: THREE.Object3D,
      callback: (buffer: ArrayBuffer) => void,
      options?: {
        binary?: boolean;
        embedImages?: boolean;
        maxTextureSize?: number;
      }
    ): void;
  }
}

declare module 'three/examples/jsm/exporters/OBJExporter' {
  export class OBJExporter {
    parse(scene: THREE.Object3D): string;
  }
}

declare module 'three/examples/jsm/exporters/FBXExporter' {
  export class FBXExporter {
    parse(scene: THREE.Object3D): ArrayBuffer;
  }
}

declare module 'three-mesh-bvh' {
  import { BufferGeometry, Intersection, Mesh, Ray, Vector3 } from 'three';

  export function computeBoundsTree(this: BufferGeometry): void;
  export function disposeBoundsTree(this: BufferGeometry): void;
  
  export interface AcceleratedRaycast {
    (ray: Ray, intersects: Intersection[]): void;
  }

  export const AcceleratedRaycast: AcceleratedRaycast;
}