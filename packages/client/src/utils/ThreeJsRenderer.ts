import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import { ExtractedTextures } from '@kai/shared/services/3d/materialVisualizationProvider';
import { Material as MaterialType } from '@kai/shared/types/material';

interface WebGLRendererParameters {
  canvas?: HTMLCanvasElement;
  antialias?: boolean;
  alpha?: boolean;
}

interface XRSession {
  addEventListener(type: string, listener: () => void): void;
  end(): Promise<void>;
}

declare global {
  interface Navigator {
    xr?: {
      isSessionSupported(mode: string): Promise<boolean>;
      requestSession(mode: string, options?: {
        requiredFeatures?: string[];
        optionalFeatures?: string[];
      }): Promise<XRSession>;
    };
  }
}

export interface RenderOptions {
  quality: 'low' | 'medium' | 'high';
  enableAR?: boolean;
  environmentMap?: string;
}

export class ThreeJsRenderer {
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private renderer: THREE.WebGLRenderer;
  private controls: OrbitControls;
  private material: any; // THREE.MeshStandardMaterial
  private geometry: THREE.BufferGeometry;
  private mesh: THREE.Mesh;
  private textureLoader: any; // THREE.TextureLoader
  private isDisposed = false;

  constructor(
    private canvas: HTMLCanvasElement,
    private containerElement: HTMLElement
  ) {
    // Initialize Three.js components
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(
      75,
      containerElement.clientWidth / containerElement.clientHeight,
      0.1,
      1000
    );
    
    const params: WebGLRendererParameters = {
      canvas: this.canvas,
      antialias: true,
      alpha: true
    };
    
    this.renderer = new THREE.WebGLRenderer(params);
    this.renderer.setSize(containerElement.clientWidth, containerElement.clientHeight);
    this.renderer.setPixelRatio(window.devicePixelRatio);
    
    // Initialize controls
    this.controls = new OrbitControls(this.camera, canvas);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.05;
    
    // Set up camera position
    this.camera.position.z = 5;
    
    // Initialize loader
    this.textureLoader = new (THREE as any).TextureLoader();
    
    // Create default material and geometry
    this.material = new (THREE as any).MeshStandardMaterial({
      roughness: 0.5,
      metalness: 0.5
    });
    
    this.geometry = new (THREE as any).BoxGeometry(1, 1, 1);
    this.mesh = new (THREE as any).Mesh(this.geometry, this.material);
    this.scene.add(this.mesh);
    
    // Add lights
    this.setupLighting();
    
    // Start animation loop
    this.animate();
    
    // Handle resize
    window.addEventListener('resize', this.handleResize);
  }

  private setupLighting(): void {
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    this.scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
    directionalLight.position.set(5, 5, 5);
    this.scene.add(directionalLight);

    const pointLight = new (THREE as any).PointLight(0xffffff, 0.5);
    pointLight.position.set(-5, -5, -5);
    this.scene.add(pointLight);
  }

  public async loadMaterial(
    material: MaterialType,
    textures: ExtractedTextures,
    options: RenderOptions
  ): Promise<void> {
    // Create appropriate geometry based on material type
    this.geometry.dispose();
    this.geometry = this.createGeometryForMaterial(material);
    
    // Load and apply textures
    const loadedTextures = await this.loadTextures(textures);
    this.applyTexturesToMaterial(loadedTextures);
    
    // Update mesh
    this.mesh.geometry = this.geometry;
    
    // Center and scale the mesh
    this.centerAndScaleMesh();
  }

  private createGeometryForMaterial(material: MaterialType): THREE.BufferGeometry {
    const size = { width: 1, height: 1, depth: 1 };
    
    switch (material.materialType) {
      case 'tile':
      case 'stone':
      case 'ceramic':
        return new (THREE as any).PlaneGeometry(size.width, size.height);
      
      case 'wood':
      case 'laminate':
        return new (THREE as any).BoxGeometry(size.width, 0.05, size.depth);
      
      case 'metal':
        return new (THREE as any).SphereGeometry(0.5, 32, 32);
      
      default:
        return new (THREE as any).BoxGeometry(size.width, size.height, size.depth);
    }
  }

  private async loadTextures(textures: ExtractedTextures): Promise<Record<string, any>> {
    const loadedTextures: Record<string, any> = {};
    
    const texturePromises = Object.entries(textures).map(async ([key, url]) => {
      if (url) {
        try {
          const texture = await new Promise<any>((resolve, reject) => {
            this.textureLoader.load(url, resolve, undefined, reject);
          });
          loadedTextures[key] = texture;
        } catch (error) {
          console.error(`Failed to load ${key} texture:`, error);
        }
      }
    });
    
    await Promise.all(texturePromises);
    return loadedTextures;
  }

  private applyTexturesToMaterial(textures: Record<string, any>): void {
    if (textures.albedo) {
      this.material.map = textures.albedo;
    }
    
    if (textures.normal) {
      this.material.normalMap = textures.normal;
      this.material.normalScale.set(1, 1);
    }
    
    if (textures.roughness) {
      this.material.roughnessMap = textures.roughness;
    }
    
    if (textures.metallic) {
      this.material.metalnessMap = textures.metallic;
    }
    
    if (textures.ao) {
      this.material.aoMap = textures.ao;
      this.material.aoMapIntensity = 1;
    }
    
    if (textures.displacement) {
      this.material.displacementMap = textures.displacement;
      this.material.displacementScale = 0.1;
    }
    
    this.material.needsUpdate = true;
  }

  private centerAndScaleMesh(): void {
    const box = new THREE.Box3().setFromObject(this.mesh);
    const size = new THREE.Vector3();
    box.getSize(size);
    
    const maxDim = Math.max(size.x, size.y, size.z);
    const scale = 2 / maxDim;
    this.mesh.scale.set(scale, scale, scale);
    
    const center = new THREE.Vector3();
    box.getCenter(center);
    this.mesh.position.sub(center);
    
    const distance = 3;
    this.camera.position.z = distance;
    this.controls.target.set(0, 0, 0);
    this.controls.update();
  }

  private animate = (): void => {
    if (this.isDisposed) return;
    
    requestAnimationFrame(this.animate);
    
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
  };

  private handleResize = (): void => {
    const width = this.containerElement.clientWidth;
    const height = this.containerElement.clientHeight;
    
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    
    this.renderer.setSize(width, height);
  };

  public async initializeAR(): Promise<void> {
    if (!navigator.xr) {
      throw new Error('WebXR not supported by browser');
    }

    const isSupported = await navigator.xr.isSessionSupported('immersive-ar');
    if (!isSupported) {
      throw new Error('AR not supported by device');
    }

    try {
      const session = await navigator.xr.requestSession('immersive-ar', {
        requiredFeatures: ['hit-test']
      });
      
      // Set up AR scene
      this.setupARScene();
      
      // Clean up when session ends
      session.addEventListener('end', () => {
        this.cleanupAR();
      });
    } catch (error) {
      console.error('Failed to initialize AR:', error);
      throw error;
    }
  }

  private setupARScene(): void {
    // Add AR-specific lighting
    const arLight = new THREE.DirectionalLight(0xffffff, 1);
    arLight.position.set(0, 5, 0);
    this.scene.add(arLight);
    
    // Add ground plane for hit testing
    const planeGeometry = new (THREE as any).PlaneGeometry(20, 20);
    const planeMaterial = new (THREE as any).MeshBasicMaterial({ visible: false });
    const plane = new (THREE as any).Mesh(planeGeometry, planeMaterial);
    plane.rotation.x = -Math.PI / 2;
    this.scene.add(plane);
  }

  private cleanupAR(): void {
    // Remove AR-specific elements
    const children = [...this.scene.children];
    children.forEach(child => {
      if (child instanceof THREE.DirectionalLight || child instanceof THREE.Mesh) {
        this.scene.remove(child);
      }
    });
  }

  public dispose(): void {
    this.isDisposed = true;
    
    // Remove event listener
    window.removeEventListener('resize', this.handleResize);
    
    // Dispose of Three.js resources
    this.geometry.dispose();
    this.material.dispose();
    this.renderer.dispose();
    
    // Remove all children from the scene
    const children = [...this.scene.children];
    children.forEach(child => {
      if (child instanceof THREE.Mesh) {
        if (child.geometry) {
          child.geometry.dispose();
        }
        if (child.material) {
          if (Array.isArray(child.material)) {
            child.material.forEach((mat: THREE.Material) => mat.dispose());
          } else {
            child.material.dispose();
          }
        }
      }
      this.scene.remove(child);
    });
  }
}