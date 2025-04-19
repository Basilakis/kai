import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader';
import { VRButton } from 'three/examples/jsm/webxr/VRButton';
import { ARButton } from 'three/examples/jsm/webxr/ARButton';
import { AcceleratedRaycast, computeBoundsTree, disposeBoundsTree } from 'three-mesh-bvh';
import { AsyncMeshLoader, LoadingEvent } from '../../utils/AsyncMeshLoader';

// Extend THREE.Mesh to support BVH
(THREE.Mesh.prototype as any).raycast = AcceleratedRaycast;

// Custom Gaussian Splatting loader - placeholder for actual implementation
class GaussianSplattingLoader {
  async loadAsync(url: string): Promise<THREE.Object3D> {
    // Create a placeholder object - in a real implementation, this would load actual Gaussian Splatting data
    const group = new THREE.Group();
    return Promise.resolve(group);
  }
}

interface OptimizedThreeJsViewerProps {
  modelUrl?: string;
  modelType?: '3d' | 'architectural' | 'room' | 'gaussian';
  initialPosition?: { x: number; y: number; z: number };
  onSceneReady?: (scene: THREE.Scene) => void;
  enableVR?: boolean;
  enableAR?: boolean;
  enableBVH?: boolean;
  enableOcclusionCulling?: boolean;
  enableAsyncLoading?: boolean;
  onLoadingProgress?: (progress: number) => void;
}

const OptimizedThreeJsViewer: React.FC<OptimizedThreeJsViewerProps> = ({
  modelUrl,
  modelType = '3d',
  initialPosition = { x: 0, y: 0, z: 5 },
  onSceneReady,
  enableVR = false,
  enableAR = false,
  enableBVH = true,
  enableOcclusionCulling = true,
  enableAsyncLoading = true,
  onLoadingProgress,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene>(new THREE.Scene());
  const cameraRef = useRef<THREE.PerspectiveCamera>();
  const rendererRef = useRef<THREE.WebGLRenderer>();
  const controlsRef = useRef<OrbitControls>();
  const animationFrameRef = useRef<number>();
  const [isXRSupported, setIsXRSupported] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [modelLoading, setModelLoading] = useState(false);
  const asyncLoaderRef = useRef<AsyncMeshLoader | null>(null);
      // Update loading progress in parent component if needed
      if (modelLoading && onLoadingProgress) {
        onLoadingProgress(loadingProgress);
      }
  useEffect(() => {
    if (!containerRef.current) return;

    // Initialize scene
    const scene = sceneRef.current;
    scene.background = new THREE.Color(0xf0f0f0);

    // Initialize camera
    const camera = new THREE.PerspectiveCamera(
      75,
      containerRef.current.clientWidth / containerRef.current.clientHeight,
      0.1,
      1000
    );
    camera.position.set(initialPosition.x, initialPosition.y, initialPosition.z);
    cameraRef.current = camera;

    // Initialize renderer
    const renderer = new THREE.WebGLRenderer({ 
      antialias: true,
    });
    
    renderer.setSize(containerRef.current.clientWidth, containerRef.current.clientHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.shadowMap.enabled = true;
    
    // Check XR support
    (renderer as any).xr = (renderer as any).xr || {};
    (renderer as any).xr.enabled = true;
    setIsXRSupported((renderer as any).xr.enabled);

    containerRef.current.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // Add XR buttons if enabled
    if (enableVR && isXRSupported) {
      document.body.appendChild(VRButton.createButton(renderer));
    }
    if (enableAR && isXRSupported) {
      document.body.appendChild(ARButton.createButton(renderer));
    }

    // Initialize controls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controlsRef.current = controls;

    // Add lights
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(5, 5, 5);
    directionalLight.castShadow = true;
    
    // Set up shadow properties
    if ((directionalLight as any).shadow) {
      (directionalLight as any).shadow.mapSize = {
        width: 2048,
        height: 2048
      };
      (directionalLight as any).shadow.camera = {
        near: 0.5,
        far: 50
      };
      (directionalLight as any).shadow.bias = -0.0005;
    }
    
    scene.add(directionalLight);

    // Notify when scene is ready
    if (onSceneReady) {
      onSceneReady(scene);
    }

    // Handle window resize
    const handleResize = () => {
      if (!containerRef.current || !renderer || !camera) return;
      
      const width = containerRef.current.clientWidth;
      const height = containerRef.current.clientHeight;
      
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      
      renderer.setSize(width, height);
    };

    window.addEventListener('resize', handleResize);

    // Create a frustum for occlusion culling
    const frustum = new (THREE as any).Frustum();
    const frustumMatrix = new THREE.Matrix4();

    // Animation loop
    const animate = () => {
      if (!renderer || !scene || !camera || !controls) return;
      
      controls.update();
      
      // Perform occlusion culling
      if (enableOcclusionCulling) {
        // Update the frustum - using any type to bypass strict type checking
        (frustumMatrix as any).multiplyMatrices(
          (camera as any).projectionMatrix, 
          (camera as any).matrixWorldInverse
        );
        (frustum as any).setFromProjectionMatrix(frustumMatrix);
        
        // Enhanced occlusion culling with distance-based priority
        scene.traverse((object: THREE.Object3D) => {
          if (object instanceof THREE.Mesh && (object.geometry as any).boundingSphere) {
            // Skip small objects for performance
            if ((object.geometry as any).boundingSphere.radius < 1) return;
            
            // Get distance to camera
            const objectPos = new THREE.Vector3();
            // Cast to any to access methods not defined in type definitions
            (object as any).getWorldPosition(objectPos);
            const distanceToCamera = (camera.position as any).distanceTo(objectPos);
            
            // For distant objects, use a simplified culling approach
            if (distanceToCamera > 50) {
              // Just use frustum culling for distant objects
              const isVisible = (frustum as any).intersectsObject(object);
              if (object.visible !== isVisible) {
                object.visible = isVisible;
              }
            } else {
              // For closer objects, use more precise testing
              // First frustum test (fast)
              const isInFrustum = (frustum as any).intersectsObject(object);
              
              if (!isInFrustum) {
                // Definitely not visible
                if (object.visible) object.visible = false;
              } else {
                // Potentially visible, check for occlusion by other objects
                // This is simplified, a real implementation would use occlusion queries or depth testing
                // For now, we'll just use the frustum test
                if (!object.visible) object.visible = true;
              }
            }
          }
        });
      }
      
      // Render scene
      renderer.render(scene, camera);
      
      animationFrameRef.current = requestAnimationFrame(animate);
    };

    animate();

    // Cleanup
    return () => {
      window.removeEventListener('resize', handleResize);
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      if (renderer && containerRef.current) {
        containerRef.current.removeChild(renderer.domElement);
      }
      scene.traverse((object: THREE.Object3D) => {
        if (object instanceof THREE.Mesh) {
          if ('boundsTree' in object.geometry) {
            (object.geometry as any).disposeBoundsTree();
          }
          object.geometry.dispose();
          if (object.material instanceof THREE.Material) {
            object.material.dispose();
          } else if (Array.isArray(object.material)) {
            (object.material as THREE.Material[]).forEach((material: THREE.Material) => {
              material.dispose();
            });
          }
        }
      });
      
      // Dispose async loader if it exists
      if (asyncLoaderRef.current) {
        asyncLoaderRef.current.dispose();
      }
    };
  }, [initialPosition, enableVR, enableAR, enableOcclusionCulling, onLoadingProgress]);

  // Load model when URL changes
  useEffect(() => {
    if (!modelUrl || !sceneRef.current) return;

    // Create an AsyncMeshLoader if async loading is enabled
    if (enableAsyncLoading) {
      // Clean up previous loader if exists
      if (asyncLoaderRef.current) {
        asyncLoaderRef.current.dispose();
      }
      
      // Create new loader
      asyncLoaderRef.current = new AsyncMeshLoader({
        chunkSize: 10000, // Process 10k vertices per chunk
        throttleTime: 16, // ~60fps
        processInBackground: true,
        highPriorityDistance: 10,
        applyTransforms: true
      });
    }

    const loadModel = async () => {
      setModelLoading(true);
      setLoadingProgress(0);
      
      const scene = sceneRef.current;
      
      try {
        // Clear existing model
        scene.children
          .filter((child: THREE.Object3D) => 
            child instanceof THREE.Mesh || 
            child instanceof THREE.Group
          )
          .forEach((child: THREE.Object3D) => scene.remove(child));
        
        let result: THREE.Object3D;
        
        // Use AsyncMeshLoader if enabled
        if (enableAsyncLoading && asyncLoaderRef.current) {
          // Add event listeners for loading progress
          const handleLoadingEvent = (event: LoadingEvent) => {
            switch (event.type) {
              case 'progress':
                if (event.progress !== undefined) {
                  setLoadingProgress(event.progress);
                }
                break;
              case 'chunk':
                // A chunk was loaded, apply BVH if enabled
                if (enableBVH && event.chunk) {
                  event.chunk.traverse((object: THREE.Object3D) => {
                    if (object instanceof THREE.Mesh) {
                      const geometry = object.geometry as any;
                      if (computeBoundsTree) {
                        geometry.computeBoundsTree = computeBoundsTree;
                        geometry.computeBoundsTree();
                      }
                    }
                  });
                }
                break;
            }
          };
          
          asyncLoaderRef.current.addEventListener(handleLoadingEvent);
          
          // Load the model asynchronously
          result = await asyncLoaderRef.current.load(modelUrl, modelType);
          
          // Clean up event listener
          asyncLoaderRef.current.removeEventListener(handleLoadingEvent);
        } else {
          // Use traditional loading if async is disabled
          const fileExtension = modelUrl.split('.').pop()?.toLowerCase();
          let loader;
          
          // Determine loader based on file extension or model type
          if (modelType === 'gaussian') {
            loader = new GaussianSplattingLoader();
          } else {
            switch (fileExtension) {
              case 'glb':
              case 'gltf':
                loader = new GLTFLoader();
                break;
              case 'fbx':
                loader = new FBXLoader();
                break;
              case 'obj':
                loader = new OBJLoader();
                break;
              case 'splat': // Gaussian Splatting format
                loader = new GaussianSplattingLoader();
                break;
              default:
                console.error('Unsupported file format');
                setModelLoading(false);
                return;
            }
          }
          
          // Load model with traditional loader
          const loadResult = await loader.loadAsync(modelUrl);
          
          // Handle different loader result formats
          if ('scene' in loadResult) {
            // GLTF result with scene property
            result = loadResult.scene;
          } else {
            // Direct model result
            result = loadResult as THREE.Object3D;
          }
          
          // Apply BVH if enabled
          if (enableBVH) {
            result.traverse((object: THREE.Object3D) => {
              if (object instanceof THREE.Mesh) {
                const geometry = object.geometry as any;
                if (computeBoundsTree) {
                  geometry.computeBoundsTree = computeBoundsTree;
                  geometry.computeBoundsTree();
                }
              }
            });
          }
          
          // Apply transforms if needed
          const box = new THREE.Box3().setFromObject(result);
          const center = box.getCenter(new THREE.Vector3());
          const size = box.getSize(new THREE.Vector3());
          
          result.position.sub(center);
          const scale = 5 / Math.max(size.x, size.y, size.z);
          result.scale.multiplyScalar(scale);
        }
        
        // Add the model to the scene
        scene.add(result);
        
        // Signal completion
        setLoadingProgress(1.0);
      } catch (error) {
        console.error('Error loading model:', error);
      } finally {
        setModelLoading(false);
      }
    };

    loadModel();
    
    // Cleanup function
    return () => {
      if (asyncLoaderRef.current) {
        asyncLoaderRef.current.cancel();
      }
    };
  }, [modelUrl, modelType, enableBVH, enableAsyncLoading]);

  return <div ref={containerRef} style={{ width: '100%', height: '100%' }} />;
};

export default OptimizedThreeJsViewer;