import * as THREE from 'three';

declare module 'three' {
  /**
   * Level of Detail object
   * 
   * Creates a LOD (Level of Detail) object that switches between different meshes
   * based on the distance from the camera to optimize rendering performance.
   */
  class LOD extends THREE.Object3D {
    constructor();
    
    // The array of level objects
    levels: { distance: number; object: THREE.Object3D }[];
    
    // Methods
    addLevel(object: THREE.Object3D, distance?: number): this;
    getObjectForDistance(distance: number): THREE.Object3D | null;
    getObjectsForDistance(distance: number): THREE.Object3D[];
    raycast(raycaster: THREE.Raycaster, intersects: THREE.Intersection[]): void;
    update(camera: THREE.Camera): void;
    toJSON(meta?: any): any;
    clone(): this;
    copy(source: this): this;
  }
  /**
   * LOD (Level of Detail) extension for Three.js
   * Adding proper TypeScript definitions for LOD optimization
   */
  export class LOD extends THREE.Object3D {
    /**
     * Create a new LOD object
     */
    constructor();

    /**
     * Current displayed LOD level
     */
    currentLevel: number;

    /**
     * Array of LOD levels
     */
    levels: { distance: number; object: THREE.Object3D }[];

    /**
     * Add an object to this LOD at the specified detail level
     * @param object - The object to add
     * @param distance - The distance at which to show this level
     */
    addLevel(object: THREE.Object3D, distance: number): this;

    /**
     * Get currently visible level
     */
    getCurrentLevel(): number;

    /**
     * Get object for the given level
     * @param level - Level index to get object for
     */
    getObjectForLevel(level: number): THREE.Object3D;

    /**
     * Update visibility based on camera position
     * @param camera - The camera to check distance against
     */
    update(camera: THREE.Camera): void;
  }

  /**
   * WebGPU support extensions
   */
  export interface WebGPURendererParameters extends WebGLRendererParameters {
    antialias?: boolean;
    powerPreference?: string;
  }

  /**
   * Extend Navigator interface with WebGPU support
   */
  interface NavigatorGPU {
    gpu: {
      requestAdapter(): Promise<any>;
    };
  }
}

// Extend Navigator type definition to include gpu property
declare global {
  interface Navigator extends NavigatorGPU {}
}