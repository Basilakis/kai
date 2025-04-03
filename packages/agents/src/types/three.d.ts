declare module 'three' {
  export * from '@types/three';

  // Add any custom extensions or overrides here
  export interface CustomMaterialParameters {
    roughness?: number;
    metalness?: number;
    normalMap?: Texture;
    normalScale?: Vector2;
    aoMap?: Texture;
    aoMapIntensity?: number;
    envMap?: Texture;
    envMapIntensity?: number;
  }

  export interface Room {
    geometry: BufferGeometry;
    material: Material;
    position: Vector3;
    rotation: Euler;
    scale: Vector3;
    walls: Mesh[];
    floor: Mesh;
    ceiling: Mesh;
  }

  export interface SceneMetadata {
    dimensions: {
      width: number;
      height: number;
      depth: number;
    };
    materials: Material[];
    objects: Object3D[];
  }

  export interface ReconstructionResult {
    scene: Scene;
    metadata: SceneMetadata;
    materials: Material[];
  }
}