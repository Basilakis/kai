import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader';
// VR/AR buttons are imported but not used yet - will be used when implementing XR features
// import { VRButton } from 'three/examples/jsm/webxr/VRButton';
// import { ARButton } from 'three/examples/jsm/webxr/ARButton';
import { AcceleratedRaycast, computeBoundsTree } from 'three-mesh-bvh';

// Import types from our type extensions
import '../types/three-extensions';

// Extend THREE.Mesh to support BVH
(THREE.Mesh.prototype as any).raycast = AcceleratedRaycast;

// Custom Gaussian Splatting loader - would be implemented in a separate file
class GaussianSplattingLoader {
  async loadAsync(_url: string): Promise<THREE.Object3D> {
    // This is a placeholder implementation
    // The actual implementation would interface with the Python Gaussian Splatting service

    // Create a placeholder object
    const group = new THREE.Group();

    // In a real implementation, this would load the actual Gaussian Splatting points
    // and convert them to a renderable format

    // Return a promise that resolves to the loaded object
    return Promise.resolve(group);
  }
}

interface EnhancedThreeJsViewerProps {
  modelUrl?: string;
  modelType?: '3d' | 'architectural' | 'room' | 'gaussian';
  initialPosition?: { x: number; y: number; z: number };
  onSceneReady?: (scene: THREE.Scene) => void;
  enableVR?: boolean;
  enableAR?: boolean;
  enableBVH?: boolean;
  enableLOD?: boolean;
  enableOcclusionCulling?: boolean;
  preferWebGPU?: boolean;
}

const EnhancedThreeJsViewer: React.FC<EnhancedThreeJsViewerProps> = ({
  modelUrl,
  modelType = '3d',
  initialPosition = { x: 0, y: 0, z: 5 },
  onSceneReady,
  enableVR = false,
  enableAR = false,
  enableBVH = true,
  enableLOD = true,
  enableOcclusionCulling = true,
  preferWebGPU = true,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene>(new THREE.Scene());
  const cameraRef = useRef<THREE.PerspectiveCamera>();
  const rendererRef = useRef<THREE.WebGLRenderer>();
  const controlsRef = useRef<OrbitControls>();
  const animationFrameRef = useRef<number>();
  const lodObjectsRef = useRef<THREE.LOD[]>([]);
  // XR support state - will be used when implementing VR/AR features
  const [_isXRSupported, setIsXRSupported] = useState(false);

  // Check WebGPU support
  const [isWebGPUSupported, setIsWebGPUSupported] = useState(false);

  useEffect(() => {
    // Check for WebGPU support
    const checkWebGPUSupport = async () => {
      try {
        if (
          navigator.gpu &&
          await navigator.gpu.requestAdapter() !== null
        ) {
          setIsWebGPUSupported(true);
          console.log('WebGPU is supported!');
        } else {
          setIsWebGPUSupported(false);
          console.log('WebGPU is not supported.');
        }
      } catch (error) {
        setIsWebGPUSupported(false);
        console.log('WebGPU check failed:', error);
      }
    };

    if (preferWebGPU) {
      checkWebGPUSupport();
    }
  }, [preferWebGPU]);

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

    // Initialize renderer based on capability
    let renderer: THREE.WebGLRenderer;

    // Use WebGL as we don't have WebGPU renderer yet in this context
    // In a real implementation, we would conditionally create a WebGPU renderer
    renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: 'high-performance',
      precision: 'highp',
    } as THREE.WebGLRendererParameters);

    renderer.setSize(containerRef.current.clientWidth, containerRef.current.clientHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    // Check XR support
    renderer.xr.enabled = true;
    setIsXRSupported(renderer.xr.enabled);

    containerRef.current.appendChild(renderer.domElement);
    rendererRef.current = renderer;

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

    // Improve shadow quality
    directionalLight.shadow.mapSize.width = 2048;
    directionalLight.shadow.mapSize.height = 2048;
    directionalLight.shadow.camera.near = 0.5;
    directionalLight.shadow.camera.far = 50;
    directionalLight.shadow.bias = -0.0005;

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
    const frustum = new THREE.Frustum();
    const frustumMatrix = new THREE.Matrix4();

    // Animation loop
    const animate = () => {
      if (!renderer || !scene || !camera || !controls) return;

      controls.update();

      // Update LOD objects based on camera position
      if (enableLOD && lodObjectsRef.current.length > 0) {
        lodObjectsRef.current.forEach((lod: THREE.LOD) => {
          lod.update(camera);
        });
      }

      // Perform occlusion culling
      if (enableOcclusionCulling) {
        // Update the frustum
        frustumMatrix.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
        frustum.setFromProjectionMatrix(frustumMatrix);

        // Check visibility for large objects
        scene.traverse((object: THREE.Object3D) => {
          if (object instanceof THREE.Mesh && object.geometry.boundingSphere) {
            // Skip small objects for performance
            if (object.geometry.boundingSphere.radius < 1) return;

            // Check if object is in view frustum
            const isVisible = frustum.intersectsObject(object);

            // Only update visibility if it changed to avoid unnecessary updates
            if (object.visible !== isVisible) {
              object.visible = isVisible;
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

      // Clear LOD objects
      lodObjectsRef.current = [];
    };
  }, [initialPosition, enableVR, enableAR, enableOcclusionCulling, isWebGPUSupported, preferWebGPU]);

  // Create LOD versions of a mesh
  const createLODVersions = (mesh: THREE.Mesh, levels: number = 3): THREE.LOD => {
    const lod = new THREE.LOD();

    // Add original mesh as highest detail
    lod.addLevel(mesh, 0);

    // Create decreasing detail versions
    for (let i = 1; i < levels; i++) {
      // Clone the geometry for modification
      const detailGeometry = mesh.geometry.clone();

      // Simplify the geometry (in a real implementation, this would use proper decimation)
      // Here we simply create a simpler version manually
      if (detailGeometry instanceof THREE.BufferGeometry) {
        const simplifiedMesh = mesh.clone();

        // Apply modifiers based on level
        // This is a placeholder for actual geometry simplification
        simplifiedMesh.scale.set(1, 1, 1); // No change in scale

        // Add to LOD with appropriate distance
        // Higher index = lower detail = larger distance
        const distance = Math.pow(2, i) * 5; // Exponential distance increase
        lod.addLevel(simplifiedMesh, distance);
      }
    }

    return lod;
  };

  // Load model when URL changes
  useEffect(() => {
    if (!modelUrl || !sceneRef.current) return;

    const loadModel = async () => {
      const scene = sceneRef.current;
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
            return;
        }
      }

      try {
        const result = await loader.loadAsync(modelUrl);

        // Clear existing model if any
        scene.children
          .filter((child: THREE.Object3D): child is THREE.Mesh =>
            child instanceof THREE.Mesh ||
            child instanceof THREE.Group ||
            child instanceof THREE.LOD
          )
          .forEach((child: THREE.Object3D) => scene.remove(child));

        // Clear existing LOD objects
        lodObjectsRef.current = [];

        // Add new model
        if (result instanceof THREE.Group || result instanceof THREE.Mesh) {
          // Center and scale model
          const box = new THREE.Box3().setFromObject(result);
          const center = box.getCenter(new THREE.Vector3());
          const size = box.getSize(new THREE.Vector3());

          result.position.sub(center);
          const scale = 5 / Math.max(size.x, size.y, size.z);
          result.scale.multiplyScalar(scale);

          // Apply enhancements

          // Apply BVH if enabled
          if (enableBVH) {
            result.traverse((object: THREE.Object3D) => {
              if (object instanceof THREE.Mesh) {
                const geometry = object.geometry as any;
                if (geometry.computeBoundsTree) {
                  geometry.computeBoundsTree();
                } else {
                  geometry.computeBoundsTree = computeBoundsTree;
                  geometry.computeBoundsTree();
                }
              }
            });
          }

          // Apply LOD if enabled
          if (enableLOD) {
            const lodObjects: THREE.LOD[] = [];

            // Find meshes to apply LOD
            result.traverse((object: THREE.Object3D) => {
              // Only apply LOD to substantial meshes, not small details
              if (object instanceof THREE.Mesh && object.geometry.boundingSphere && object.geometry.boundingSphere.radius > 1) {
                // Create LOD versions
                const lod = createLODVersions(object);

                // Replace mesh with LOD in the hierarchy
                if (object.parent) {
                  const parent = object.parent;
                  const index = parent.children.indexOf(object);
                  parent.remove(object);
                  parent.children.splice(index, 0, lod);
                  lodObjects.push(lod);
                }
              }
            });

            // Store LOD objects for updates in animation loop
            lodObjectsRef.current = lodObjects;
          }

          // Add the result to the scene
          scene.add(result);
        }
      } catch (error) {
        console.error('Error loading model:', error);
      }
    };

    loadModel();
  }, [modelUrl, modelType, enableBVH, enableLOD]);

  return <div ref={containerRef} style={{ width: '100%', height: '100%' }} />;
};

export default EnhancedThreeJsViewer;