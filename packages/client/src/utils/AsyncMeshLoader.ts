import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader';

/**
 * Simple throttle implementation to avoid lodash dependency
 */
function throttle<T extends (...args: any[]) => any>(
  func: T,
  wait: number,
  options: { leading: boolean; trailing: boolean } = { leading: true, trailing: true }
): (...args: Parameters<T>) => ReturnType<T> | undefined {
  let timeout: number | null = null;
  let previous = 0;
  
  return function(this: any, ...args: Parameters<T>): ReturnType<T> | undefined {
    const now = Date.now();
    if (!previous && !options.leading) previous = now;
    const remaining = wait - (now - previous);
    
    if (remaining <= 0 || remaining > wait) {
      if (timeout) {
        window.clearTimeout(timeout);
        timeout = null;
      }
      previous = now;
      return func.apply(this, args);
    } else if (!timeout && options.trailing) {
      timeout = window.setTimeout(() => {
        previous = options.leading ? Date.now() : 0;
        timeout = null;
        func.apply(this, args);
      }, remaining);
    }
    return undefined;
  };
}

/**
 * Events emitted during async loading
 */
export interface LoadingEvent {
  type: 'start' | 'progress' | 'chunk' | 'complete' | 'error';
  progress?: number; // 0-1 loading progress
  chunk?: THREE.Object3D; // Loaded chunk (for 'chunk' events)
  model?: THREE.Object3D; // Full model (for 'complete' events)
  error?: Error; // Error information (for 'error' events)
}

export type LoadingEventHandler = (event: LoadingEvent) => void;

/**
 * Configuration for async loading
 */
export interface AsyncLoadingOptions {
  chunkSize?: number; // Number of vertices to process per chunk
  throttleTime?: number; // Milliseconds to wait between chunks
  processInBackground?: boolean; // Use Web Worker if available
  highPriorityDistance?: number; // Distance from camera for high priority loading
  applyTransforms?: boolean; // Auto center and scale model
}

/**
 * AsyncMeshLoader - Progressively loads 3D models to improve performance
 * 
 * This loader breaks large models into smaller chunks and loads them 
 * progressively, allowing for responsive UIs and better user experience.
 */
export class AsyncMeshLoader {
  private options: Required<AsyncLoadingOptions>;
  private listeners: LoadingEventHandler[] = [];
  private loading = false;
  private workers: Worker[] = [];
  private workerSupported = typeof Worker !== 'undefined';
  
  constructor(options: AsyncLoadingOptions = {}) {
    // Set default options
    this.options = {
      chunkSize: options.chunkSize || 5000,
      throttleTime: options.throttleTime || 16, // ~60fps
      processInBackground: options.processInBackground ?? true,
      highPriorityDistance: options.highPriorityDistance || 10,
      applyTransforms: options.applyTransforms ?? true
    };
    
    // Initialize workers if supported and enabled
    if (this.workerSupported && this.options.processInBackground) {
      const workerCount = Math.max(1, navigator.hardwareConcurrency ? navigator.hardwareConcurrency - 1 : 2);
      this.initWorkers(workerCount);
    }
  }
  
  /**
   * Initialize Web Workers for background processing
   */
  private initWorkers(count: number): void {
    // In a real implementation, this would create actual workers
    // For now, we'll use a placeholder
    console.log(`Would initialize ${count} workers for async loading`);
  }
  
  /**
   * Add event listener for loading events
   */
  addEventListener(handler: LoadingEventHandler): void {
    this.listeners.push(handler);
  }
  
  /**
   * Remove event listener
   */
  removeEventListener(handler: LoadingEventHandler): void {
    this.listeners = this.listeners.filter(h => h !== handler);
  }
  
  /**
   * Emit event to all listeners
   */
  private emit(event: LoadingEvent): void {
    this.listeners.forEach(handler => handler(event));
  }
  
  /**
   * Load model asynchronously in chunks
   */
  async load(url: string, modelType?: string): Promise<THREE.Object3D> {
    if (this.loading) {
      throw new Error('Another model is currently loading');
    }
    
    this.loading = true;
    this.emit({ type: 'start' });
    
    try {
      // Determine loader based on URL extension or model type
      const loader = this.getLoaderForUrl(url, modelType);
      
      // First load just the model structure without geometries
      // In a real implementation, this would use a custom loader
      // that supports partial loading
      const model = await this.loadModel(loader, url);
      
      // Process geometries in chunks
      await this.processGeometriesInChunks(model);
      
      // Apply transforms if requested
      if (this.options.applyTransforms) {
        this.centerAndScaleModel(model);
      }
      
      this.emit({ type: 'complete', model });
      return model;
    } catch (error) {
      this.emit({ type: 'error', error: error as Error });
      throw error;
    } finally {
      this.loading = false;
    }
  }
  
  /**
   * Get appropriate loader based on URL and type
   */
  private getLoaderForUrl(url: string, modelType?: string): any {
    if (modelType === 'gaussian') {
      // Use custom loader for Gaussian Splatting format
      // This would be implemented elsewhere
      return new (THREE as any).Loader(); // Placeholder with type casting
    }
    
    const extension = url.split('.').pop()?.toLowerCase();
    
    switch (extension) {
      case 'glb':
      case 'gltf':
        return new GLTFLoader();
      case 'fbx':
        return new FBXLoader();
      case 'obj':
        return new OBJLoader();
      case 'splat': // Gaussian Splatting format
        return new (THREE as any).Loader(); // Placeholder with type casting
      default:
        throw new Error(`Unsupported file format: ${extension}`);
    }
  }
  
  /**
   * Load the initial model
   */
  private async loadModel(loader: any, url: string): Promise<THREE.Object3D> {
    return new Promise((resolve, reject) => {
      loader.load(
        url,
        (result: any) => {
          // Handle different loader result formats
          let model: THREE.Object3D;
          
          if ('scene' in result) {
            // GLTF result
            model = result.scene;
          } else {
            // Direct model result
            model = result as THREE.Object3D;
          }
          
          resolve(model);
        },
        (progress: any) => {
          if (progress.lengthComputable) {
            this.emit({ 
              type: 'progress', 
              progress: progress.loaded / progress.total 
            });
          }
        },
        reject
      );
    });
  }
  
  /**
   * Process all geometries in the model in chunks
   */
  private async processGeometriesInChunks(model: THREE.Object3D): Promise<void> {
    // Collect all meshes that need processing
    const meshes: THREE.Mesh[] = [];
    model.traverse((object) => {
      if (object instanceof THREE.Mesh) {
        meshes.push(object);
      }
    });
    
    // Sort meshes by priority (e.g., visibility, size)
    this.sortMeshesByPriority(meshes);
    
    // Process in chunks with throttling
    const throttledProcess = throttle(
      async (mesh: THREE.Mesh) => {
        await this.processMeshGeometry(mesh);
        this.emit({ type: 'chunk', chunk: mesh });
      },
      this.options.throttleTime,
      { leading: true, trailing: true }
    );
    
    // Process each mesh
    let processedCount = 0;
    for (const mesh of meshes) {
      await throttledProcess(mesh);
      processedCount++;
      this.emit({ 
        type: 'progress', 
        progress: processedCount / meshes.length 
      });
    }
  }
  
  /**
   * Sort meshes by priority for loading
   * - Larger, more visible meshes should load first
   * - Meshes closer to camera should load first
   */
  private sortMeshesByPriority(meshes: THREE.Mesh[]): void {
    // This is a simplified priority algorithm
    // A real implementation would consider:
    // - Distance from camera
    // - Size in viewport
    // - Material opacity/importance
    
    meshes.sort((a, b) => {
      // Get size as a priority factor
      const getSize = (mesh: THREE.Mesh) => {
        if (!mesh.geometry.boundingSphere) {
          mesh.geometry.computeBoundingSphere();
        }
        return mesh.geometry.boundingSphere?.radius || 0;
      };
      
      const sizeA = getSize(a);
      const sizeB = getSize(b);
      
      // Larger objects first
      return sizeB - sizeA;
    });
  }
  
  /**
   * Process a single mesh's geometry
   * - Compute normals if missing
   * - Set up buffers for rendering
   * - Apply optimizations (in a real implementation)
   */
  private async processMeshGeometry(mesh: THREE.Mesh): Promise<void> {
    // Simulate async processing
    return new Promise(resolve => {
      // In a real implementation, this would do real work
      // like computing bounding volumes, optimizing buffers, etc.
      
      // Cast geometry to any to access properties not defined in type definitions
      const geometry = mesh.geometry as any;
      
      if (!geometry.index && geometry.attributes.position) {
        // Generate index buffer for non-indexed geometries
        // This would be more complex in a real implementation
      }
      
      // Ensure normals exist
      if (!geometry.attributes.normal && geometry.attributes.position) {
        geometry.computeVertexNormals();
      }
      
      // Ensure bounding sphere for culling
      if (!geometry.boundingSphere) {
        geometry.computeBoundingSphere();
      }
      
      // Simulate work time proportional to vertex count
      const vertexCount = geometry.attributes.position.count;
      const delay = Math.min(
        50, // Cap maximum delay
        Math.floor(vertexCount / 1000) // Roughly proportional to complexity
      );
      
      setTimeout(resolve, delay);
    });
  }
  
  /**
   * Center and scale model to standard size
   */
  private centerAndScaleModel(model: THREE.Object3D): void {
    const box = new THREE.Box3().setFromObject(model);
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());
    
    // Center the model
    model.position.sub(center);
    
    // Scale to standard size (if needed)
    const maxDimension = Math.max(size.x, size.y, size.z);
    if (maxDimension > 10) {
      const scale = 5 / maxDimension;
      model.scale.multiplyScalar(scale);
    }
  }
  
  /**
   * Cancel current loading operation
   */
  cancel(): void {
    // In a real implementation, this would abort fetch requests
    // and terminate worker operations
    this.loading = false;
    
    // Clean up any resources
    this.emit({ type: 'error', error: new Error('Loading cancelled') });
  }
  
  /**
   * Clean up resources
   */
  dispose(): void {
    this.workers.forEach(worker => worker.terminate());
    this.workers = [];
    this.listeners = [];
  }
}

/**
 * Helper function to create a loader with default options
 */
export function createAsyncLoader(options?: AsyncLoadingOptions): AsyncMeshLoader {
  return new AsyncMeshLoader(options);
}