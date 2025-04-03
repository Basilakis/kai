import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader';
import { VRButton } from 'three/examples/jsm/webxr/VRButton';
import { ARButton } from 'three/examples/jsm/webxr/ARButton';
import { AcceleratedRaycast, computeBoundsTree, disposeBoundsTree } from 'three-mesh-bvh';

// Extend THREE.Mesh to support BVH
(THREE.Mesh.prototype as any).raycast = AcceleratedRaycast;

interface ThreeJsViewerProps {
  modelUrl?: string;
  modelType?: '3d' | 'architectural' | 'room';
  initialPosition?: { x: number; y: number; z: number };
  onSceneReady?: (scene: THREE.Scene) => void;
  enableVR?: boolean;
  enableAR?: boolean;
  enableBVH?: boolean;
}

const ThreeJsViewer: React.FC<ThreeJsViewerProps> = ({
  modelUrl,
  modelType = '3d',
  initialPosition = { x: 0, y: 0, z: 5 },
  onSceneReady,
  enableVR = false,
  enableAR = false,
  enableBVH = true,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene>(new THREE.Scene());
  const cameraRef = useRef<THREE.PerspectiveCamera>();
  const rendererRef = useRef<THREE.WebGLRenderer>();
  const controlsRef = useRef<OrbitControls>();
  const animationFrameRef = useRef<number>();
  const [isXRSupported, setIsXRSupported] = useState(false);

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
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(containerRef.current.clientWidth, containerRef.current.clientHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    
    // Check XR support
    renderer.xr.enabled = true;
    renderer.xr.isPresenting;
    setIsXRSupported(renderer.xr.enabled);

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
    scene.add(directionalLight);

    // Notify when scene is ready
    if (onSceneReady) {
      onSceneReady(scene);
    }

    // Handle window resize
    const handleResize = () => {
      if (!containerRef.current || !renderer || !camera) return;
      
      camera.aspect = containerRef.current.clientWidth / containerRef.current.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(containerRef.current.clientWidth, containerRef.current.clientHeight);
    };

    window.addEventListener('resize', handleResize);

    // Animation loop
    const animate = () => {
      if (!renderer || !scene || !camera || !controls) return;
      
      controls.update();
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
          }
        }
      });
    };
  }, [initialPosition, enableVR, enableAR]);

  // Load model when URL changes
  useEffect(() => {
    if (!modelUrl || !sceneRef.current) return;

    const loadModel = async () => {
      const scene = sceneRef.current;
      const fileExtension = modelUrl.split('.').pop()?.toLowerCase();
      let loader;

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
        default:
          console.error('Unsupported file format');
          return;
      }

      try {
        const result = await loader.loadAsync(modelUrl);
        
        // Clear existing model if any
        scene.children
          .filter((child: THREE.Object3D): child is THREE.Mesh => child instanceof THREE.Mesh)
          .forEach((child: THREE.Mesh) => scene.remove(child));

        // Add new model
        if (result instanceof THREE.Group || result instanceof THREE.Mesh) {
          scene.add(result);
          
          // Apply BVH if enabled
          if (enableBVH) {
            result.traverse((object: THREE.Object3D) => {
              if (object instanceof THREE.Mesh) {
                const geometry = object.geometry as any;
                geometry.computeBoundsTree = computeBoundsTree;
                geometry.computeBoundsTree();
              }
            });
          }

          // Center and scale model
          const box = new THREE.Box3().setFromObject(result);
          const center = box.getCenter(new THREE.Vector3());
          const size = box.getSize(new THREE.Vector3());
          
          result.position.sub(center);
          const scale = 5 / Math.max(size.x, size.y, size.z);
          result.scale.multiplyScalar(scale);
        }
      } catch (error) {
        console.error('Error loading model:', error);
      }
    };

    loadModel();
  }, [modelUrl, enableBVH]);

  return <div ref={containerRef} style={{ width: '100%', height: '100%' }} />;
};

export default ThreeJsViewer;