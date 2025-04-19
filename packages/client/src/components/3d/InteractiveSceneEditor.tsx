/// <reference path="../../types/three-extensions.d.ts" />
/// <reference path="../../types/three-examples.d.ts" />
/// <reference path="../../types/jsx-custom.d.ts" />

import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';

// Import TransformControls using 'any' type to bypass TypeScript errors
// @ts-ignore
import { TransformControls as TCImport } from 'three/examples/jsm/controls/TransformControls';
const TransformControls = TCImport as any;
import OptimizedThreeJsViewer from './OptimizedThreeJsViewer';
// Import BVH only if actually needed in code
// import { AcceleratedRaycast } from 'three-mesh-bvh';

// Type assertion helpers for JSX elements
const liProps = (props: any) => props as React.LiHTMLAttributes<HTMLLIElement> & { 
  children?: React.ReactNode;
  key?: React.Key;
};

// Define compatible interface for OptimizedThreeJsViewer props
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

// Define the material properties interface for furniture
interface MaterialProperties {
  type: string;
  baseColor: THREE.Color | string;
  roughness: number;
  metalness: number;
  anisotropy?: number;
  anisotropyRotation?: number;
  subsurfaceColor?: THREE.Color | string;
  subsurfaceRadius?: number;
  filmThickness?: number;
  filmIOR?: number;
  textureType?: string;
  blendFactor?: number;
  blendType?: string;
}

// Define the physics properties interface for furniture
interface PhysicsProperties {
  mass: number;
  friction: number;
  restitution: number;  // "bounciness"
  isStatic: boolean;
  centerOfMass?: THREE.Vector3;
  collisionGroup?: number;
  collisionMask?: number;
}

// Define the furniture item interface
interface FurnitureItem {
  id: string;
  model: THREE.Object3D;
  name: string;
  type: string;
  position: THREE.Vector3;
  rotation: THREE.Euler;
  scale: THREE.Vector3;
  boundingBox: THREE.Box3;
  materials: MaterialProperties[];
  physics: PhysicsProperties;
  originalModelUrl?: string;
}

// Modes for the editor
type EditorMode = 'translate' | 'rotate' | 'scale' | 'view';

// Interface for collision data
interface CollisionData {
  object: THREE.Object3D;
  withObject: THREE.Object3D;
  intersectionPoint: THREE.Vector3;
  distance: number;
}

// Props for the InteractiveSceneEditor
interface InteractiveSceneEditorProps {
  initialFurniture?: FurnitureItem[];
  allowDynamicLoading?: boolean;
  furnitureCatalogUrls?: string[];
  roomDimensions?: {
    width: number;
    height: number;
    depth: number;
  };
  validationRules?: {
    minDistanceBetweenObjects?: number;
    respectGravity?: boolean;
    preventFloatingObjects?: boolean;
    preventCollisions?: boolean;
    wallClearance?: number;
    floorClearance?: number;
    ceilingClearance?: number;
  };
  onLayoutChange?: (furniture: FurnitureItem[]) => void;
  onValidationChange?: (isValid: boolean, issues: string[]) => void;
}

const defaultValidationRules = {
  minDistanceBetweenObjects: 0.1,  // meters
  respectGravity: true,
  preventFloatingObjects: true,
  preventCollisions: true,
  wallClearance: 0.05,  // meters
  floorClearance: 0,    // meters
  ceilingClearance: 0.1 // meters
};

/**
 * Interactive Scene Editor with real-time validation
 * Extends OptimizedThreeJsViewer with object manipulation and physics validation
 */
const InteractiveSceneEditor: React.FC<InteractiveSceneEditorProps> = ({
  initialFurniture = [],
  // These props aren't currently used but kept for future extension
  // allowDynamicLoading = true,
  // furnitureCatalogUrls = [],
  roomDimensions = { width: 10, height: 3, depth: 10 },
  validationRules = defaultValidationRules,
  onLayoutChange,
  onValidationChange,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const transformControlsRef = useRef<any>(null);
  const orbitControlsRef = useRef<any>(null);

  // Track furniture items and their properties
  const [furniture, setFurniture] = useState<FurnitureItem[]>(initialFurniture);
  const [selectedFurniture, setSelectedFurniture] = useState<FurnitureItem | null>(null);
  const [editorMode, setEditorMode] = useState<EditorMode>('view');
  const [collisions, setCollisions] = useState<CollisionData[]>([]);
  const [validationIssues, setValidationIssues] = useState<string[]>([]);
  // Store validation state for future use with API integrations
  const [, setIsValid] = useState(true);

  // Track whether a transform operation is in progress
  const isTransformingRef = useRef(false);

  // Helper method to create a default furniture item from an object
  const createFurnitureItem = (object: THREE.Object3D, name: string, type: string): FurnitureItem => {
    const position = new THREE.Vector3();
    const rotation = new THREE.Euler();
    const scale = new THREE.Vector3();

    // Extract position, rotation, scale if available
    if (object.position) position.copy(object.position);
    if (object.rotation) rotation.copy(object.rotation);
    if (object.scale) scale.copy(object.scale);

    // Compute bounding box
    const boundingBox = new THREE.Box3().setFromObject(object);

    return {
      id: `furniture_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      model: object,
      name,
      type,
      position,
      rotation,
      scale,
      boundingBox,
      materials: [{
        type: 'standard',
        baseColor: '#cccccc',
        roughness: 0.5,
        metalness: 0
      }],
      physics: {
        mass: 1,
        friction: 0.5,
        restitution: 0.2,
        isStatic: true
      }
    };
  };

  // Handle scene ready callback from OptimizedThreeJsViewer
  const handleSceneReady = useCallback((scene: THREE.Scene) => {
    sceneRef.current = scene;

    // Create room if dimensions are provided
    if (roomDimensions) {
      createRoom(scene, roomDimensions);
    }

    // Add initial furniture to the scene
    initialFurniture.forEach(item => {
      scene.add(item.model);
    });

    // Set up transform controls
    if (scene && containerRef.current) {
      const renderer = new THREE.WebGLRenderer(); // This is just to access the domElement type
      const canvas = document.querySelector('canvas') as HTMLCanvasElement;
      if (canvas) {
        // Create camera with required parameters
        const camera = new THREE.PerspectiveCamera(75, window.innerWidth/window.innerHeight, 0.1, 1000);
        const controls = new TransformControls(camera, canvas);
        controls.addEventListener('dragging-changed', (event: { value: boolean }) => {
          // Disable orbit controls when transforming
          if (orbitControlsRef.current) {
            orbitControlsRef.current.enabled = !event.value;
          }
          isTransformingRef.current = event.value;

          // When transform ends, update furniture item data
          if (!event.value && selectedFurniture) {
            updateFurnitureFromObject(selectedFurniture);
            // Check for collisions after transform
            detectCollisions();
            validateLayout();
          }
        });

        // Add to scene and store reference
        scene.add(controls);
        transformControlsRef.current = controls;
      }
    }
  }, [initialFurniture, roomDimensions]);

  // Create a basic room with walls, floor, ceiling
  const createRoom = (scene: THREE.Scene, dimensions: { width: number, height: number, depth: number }) => {
    const { width, height, depth } = dimensions;

    // Create room geometry
    const roomGroup = new THREE.Group();
    roomGroup.name = "Room";

    // Floor
    const floorGeometry = new THREE.PlaneGeometry(width, depth);
    const floorMaterial = new THREE.MeshStandardMaterial({
      color: 0xeeeeee,
      side: THREE.DoubleSide,
      roughness: 0.7
    });
    const floor = new THREE.Mesh(floorGeometry, floorMaterial);
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = 0;
    floor.receiveShadow = true;
    floor.name = "Floor";
    roomGroup.add(floor);

    // Ceiling
    const ceilingGeometry = new THREE.PlaneGeometry(width, depth);
    const ceilingMaterial = new THREE.MeshStandardMaterial({
      color: 0xfafafa,
      side: THREE.DoubleSide,
      roughness: 0.8
    });
    const ceiling = new THREE.Mesh(ceilingGeometry, ceilingMaterial);
    ceiling.rotation.x = Math.PI / 2;
    ceiling.position.y = height;
    ceiling.receiveShadow = true;
    ceiling.name = "Ceiling";
    roomGroup.add(ceiling);

    // Walls
    const wallMaterial = new THREE.MeshStandardMaterial({
      color: 0xf5f5f5,
      side: THREE.DoubleSide,
      roughness: 0.6
    });

    // Back wall
    const backWallGeometry = new THREE.PlaneGeometry(width, height);
    const backWall = new THREE.Mesh(backWallGeometry, wallMaterial);
    backWall.position.z = -depth / 2;
    backWall.position.y = height / 2;
    backWall.receiveShadow = true;
    backWall.name = "BackWall";
    roomGroup.add(backWall);

    // Front wall
    const frontWallGeometry = new THREE.PlaneGeometry(width, height);
    const frontWall = new THREE.Mesh(frontWallGeometry, wallMaterial);
    frontWall.position.z = depth / 2;
    frontWall.position.y = height / 2;
    frontWall.rotation.y = Math.PI;
    frontWall.receiveShadow = true;
    frontWall.name = "FrontWall";
    roomGroup.add(frontWall);

    // Left wall
    const leftWallGeometry = new THREE.PlaneGeometry(depth, height);
    const leftWall = new THREE.Mesh(leftWallGeometry, wallMaterial);
    leftWall.position.x = -width / 2;
    leftWall.position.y = height / 2;
    leftWall.rotation.y = Math.PI / 2;
    leftWall.receiveShadow = true;
    leftWall.name = "LeftWall";
    roomGroup.add(leftWall);

    // Right wall
    const rightWallGeometry = new THREE.PlaneGeometry(depth, height);
    const rightWall = new THREE.Mesh(rightWallGeometry, wallMaterial);
    rightWall.position.x = width / 2;
    rightWall.position.y = height / 2;
    rightWall.rotation.y = -Math.PI / 2;
    rightWall.receiveShadow = true;
    rightWall.name = "RightWall";
    roomGroup.add(rightWall);

    // Add room to scene
    scene.add(roomGroup);

    // Compute BVH for room components for collision detection
    roomGroup.traverse((object) => {
      if (object instanceof THREE.Mesh) {
        const geometry = object.geometry as any;
        if (geometry.computeBoundsTree) {
          geometry.computeBoundsTree();
        }
      }
    });

    return roomGroup;
  };

  // Handle object selection via raycasting
  const handleObjectSelect = (event: React.MouseEvent) => {
    if (!sceneRef.current || !containerRef.current || editorMode === 'view' || isTransformingRef.current) return;

    // Calculate mouse position in normalized device coordinates
    const rect = containerRef.current.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    const y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    // Raycasting
    const raycaster = new (THREE as any).Raycaster();
    // Create a proper Vector2 instance
    const mousePosition = new (THREE as any).Vector2(x, y);
    raycaster.setFromCamera(mousePosition, getCamera());

    // Filter objects that can be selected (furniture only, not room)
    const selectableObjects: THREE.Object3D[] = [];
    furniture.forEach(item => {
      // Add the furniture model and all its children
      item.model.traverse((child) => {
        selectableObjects.push(child);
      });
    });

    const intersects = raycaster.intersectObjects(selectableObjects, true);

    if (intersects.length > 0) {
      // Find the furniture item that was clicked
      const clickedObject = intersects[0].object;
      let selectedItem: FurnitureItem | null = null;

      // Find which furniture item this object belongs to
      for (const item of furniture) {
        let isPartOfItem = false;
        item.model.traverse((child) => {
          if (child === clickedObject) {
            isPartOfItem = true;
          }
        });

        if (isPartOfItem) {
          selectedItem = item;
          break;
        }
      }

      if (selectedItem) {
        setSelectedFurniture(selectedItem);

        // Attach transform controls to the furniture model
        if (transformControlsRef.current) {
          transformControlsRef.current.attach(selectedItem.model);
          transformControlsRef.current.setMode(editorMode);
        }
      }
    } else {
      // Clicked on empty space, deselect
      if (transformControlsRef.current) {
        transformControlsRef.current.detach();
      }
      setSelectedFurniture(null);
    }
  };

  // Get the current camera from the Three.js scene
  const getCamera = (): any => {
    // This is a placeholder. In reality, we'd need to get the camera
    // from the OptimizedThreeJsViewer. For now, we'll create a dummy.
    return new THREE.PerspectiveCamera(75, window.innerWidth/window.innerHeight, 0.1, 1000);
  };

  // Update furniture item data from its 3D object
  const updateFurnitureFromObject = (item: FurnitureItem) => {
    // Update position, rotation, scale from the object
    item.position.copy(item.model.position);
    item.rotation.copy(item.model.rotation);
    item.scale.copy(item.model.scale);

    // Update bounding box
    item.boundingBox.setFromObject(item.model);

    // Update the furniture array
    setFurniture(prev => {
      const index = prev.findIndex(f => f.id === item.id);
      if (index >= 0) {
        const newFurniture = [...prev];
        newFurniture[index] = { ...item };
        return newFurniture;
      }
      return prev;
    });

    // Notify parent of layout change
    if (onLayoutChange) {
      onLayoutChange([...furniture]);
    }
  };

  // Add a furniture item to the scene
  const addFurnitureItem = (object: THREE.Object3D, name: string, type: string) => {
    if (!sceneRef.current) return;

    const newItem = createFurnitureItem(object, name, type);

    // Add to scene
    sceneRef.current.add(newItem.model);

    // Update state
    setFurniture(prev => [...prev, newItem]);

    // Compute BVH for the new object
    newItem.model.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        const geometry = child.geometry as any;
        if (geometry.computeBoundsTree) {
          geometry.computeBoundsTree();
        }
      }
    });

    // Select the new item
    setSelectedFurniture(newItem);
    if (transformControlsRef.current) {
      transformControlsRef.current.attach(newItem.model);
      transformControlsRef.current.setMode(editorMode);
    }

    // Check for collisions
    detectCollisions();
    validateLayout();

    // Notify parent of layout change
    if (onLayoutChange) {
      onLayoutChange([...furniture, newItem]);
    }

    return newItem;
  };

  // Remove a furniture item from the scene
  const removeFurnitureItem = (itemId: string) => {
    if (!sceneRef.current) return;

    const itemToRemove = furniture.find(item => item.id === itemId);
    if (!itemToRemove) return;

    // Remove from scene
    sceneRef.current.remove(itemToRemove.model);

    // Update state
    setFurniture(prev => prev.filter(item => item.id !== itemId));

    // If this was the selected item, deselect it
    if (selectedFurniture && selectedFurniture.id === itemId) {
      setSelectedFurniture(null);
      if (transformControlsRef.current) {
        transformControlsRef.current.detach();
      }
    }

    // Check for collisions
    detectCollisions();
    validateLayout();

    // Notify parent of layout change
    if (onLayoutChange) {
      onLayoutChange(furniture.filter(item => item.id !== itemId));
    }
  };

  // Detect collisions between furniture items
  const detectCollisions = () => {
    if (!sceneRef.current || !validationRules.preventCollisions) {
      setCollisions([]);
      return;
    }

    const newCollisions: CollisionData[] = [];

    // Check collisions between furniture items
    for (let i = 0; i < furniture.length; i++) {
      for (let j = i + 1; j < furniture.length; j++) {
        const item1 = furniture[i];
        const item2 = furniture[j];

        // Quick check using bounding boxes first
        // Add null/undefined checks for item1 and item2
        if (item1 && item2 && item1.boundingBox.intersectsBox(item2.boundingBox)) {
          // More detailed collision check using raycasting
          const collisionData = checkDetailedCollision(item1, item2);
          if (collisionData) {
            newCollisions.push(collisionData);
          }
        }
      }

      // Check collisions with room (with null check)
      const furnitureItem = furniture[i];
      if (furnitureItem) {
        const roomCollisions = checkRoomCollision(furnitureItem);
        newCollisions.push(...roomCollisions);
      }
    }

    setCollisions(newCollisions);

    // Apply visual feedback for collisions
    applyCollisionFeedback(newCollisions);
  };

  // Detailed collision check between two furniture items using raycasting
  const checkDetailedCollision = (item1: FurnitureItem, item2: FurnitureItem): CollisionData | null => {
    // This is a simplified implementation. A full implementation would use
    // more sophisticated collision detection algorithms.

    // For now, just use the bounding box intersection as a collision
    if (item1.boundingBox.intersectsBox(item2.boundingBox)) {
      // Calculate intersection point (approximate)
      const intersectionPoint = new THREE.Vector3();
      item1.boundingBox.getCenter(intersectionPoint);

      // Calculate distance (approximate)
      const distance = item1.model.position.distanceTo(item2.model.position);

      return {
        object: item1.model,
        withObject: item2.model,
        intersectionPoint,
        distance
      };
    }

    return null;
  };

  // Check collision between a furniture item and the room
  const checkRoomCollision = (item: FurnitureItem): CollisionData[] => {
    const collisions: CollisionData[] = [];

    // This is a simplified implementation.
    // A full implementation would check collisions with walls, floor, ceiling
    // using raycasting against the room mesh.

    return collisions;
  };

  // Apply visual feedback for collisions
  const applyCollisionFeedback = (collisionsData: CollisionData[]) => {
    // Reset all furniture to normal appearance
    furniture.forEach(item => {
      item.model.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          // Reset material to original
          if (child.material instanceof THREE.Material) {
            // Remove any emissive color that was added for highlighting
            (child.material as any).emissive = new THREE.Color(0x000000);
          }
        }
      });
    });

    // Highlight objects with collisions
    collisionsData.forEach(collision => {
      [collision.object, collision.withObject].forEach(object => {
        object.traverse((child) => {
          if (child instanceof THREE.Mesh) {
            if (child.material instanceof THREE.Material) {
              // Add red emissive color for highlighting
              (child.material as any).emissive = new THREE.Color(0xff0000);
              (child.material as any).emissiveIntensity = 0.5;
            }
          }
        });
      });
    });
  };

  // Validate the entire layout based on validation rules
  const validateLayout = () => {
    if (!sceneRef.current) return;

    const issues: string[] = [];

    // Check for collisions
    if (validationRules.preventCollisions && collisions.length > 0) {
      issues.push(`Found ${collisions.length} collisions between objects`);
    }

    // Check for floating objects
    if (validationRules.preventFloatingObjects) {
      furniture.forEach(item => {
        // Simple check: is the bottom of the bounding box above the floor?
        if (item.boundingBox.min.y > 0.01) {
          issues.push(`Object "${item.name}" is floating above the floor`);
        }
      });
    }

    // Check for minimum distance between objects
    // Add null/undefined check for validationRules.minDistanceBetweenObjects
    if (validationRules.minDistanceBetweenObjects && validationRules.minDistanceBetweenObjects > 0) {
      for (let i = 0; i < furniture.length; i++) {
        for (let j = i + 1; j < furniture.length; j++) {
          // Add null/undefined checks for furniture elements
          const item1 = furniture[i];
          const item2 = furniture[j];

          if (item1 && item2) {
            const distance = item1.model.position.distanceTo(item2.model.position);
            if (validationRules.minDistanceBetweenObjects && distance < validationRules.minDistanceBetweenObjects) {
              issues.push(`Objects "${item1.name}" and "${item2.name}" are too close together`);
            }
          }
        }
      }
    }

    // Check for wall clearance
    // Add null/undefined check for validationRules.wallClearance
    if (validationRules.wallClearance && validationRules.wallClearance > 0 && roomDimensions) {
      const { width, depth } = roomDimensions;
      const halfWidth = width / 2;
      const halfDepth = depth / 2;

      furniture.forEach(item => {
        // Check distance to each wall
        // Add null check for validationRules.wallClearance
        const wallClearance = validationRules.wallClearance || 0;
        if (halfWidth - Math.abs(item.model.position.x) < wallClearance) {
          issues.push(`Object "${item.name}" is too close to a wall`);
        }
        if (halfDepth - Math.abs(item.model.position.z) < wallClearance) {
          issues.push(`Object "${item.name}" is too close to a wall`);
        }
      });
    }

    setValidationIssues(issues);
    setIsValid(issues.length === 0);

    // Notify parent of validation change
    if (onValidationChange) {
      onValidationChange(issues.length === 0, issues);
    }
  };

  // Change editor mode (translate, rotate, scale, view)
  const changeEditorMode = (mode: EditorMode) => {
    setEditorMode(mode);

    if (transformControlsRef.current && selectedFurniture) {
      if (mode === 'view') {
        transformControlsRef.current.detach();
      } else {
        transformControlsRef.current.setMode(mode);
      }
    }
  };

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Only handle shortcuts if we're in edit mode
      if (editorMode === 'view') return;

      switch (event.key.toLowerCase()) {
        case 'delete':
        case 'backspace':
          // Delete selected furniture
          if (selectedFurniture) {
            removeFurnitureItem(selectedFurniture.id);
          }
          break;
        case 'escape':
          // Cancel selection
          if (selectedFurniture) {
            if (transformControlsRef.current) {
              transformControlsRef.current.detach();
            }
            setSelectedFurniture(null);
          }
          break;
        case 'g':
          // Translate mode
          changeEditorMode('translate');
          break;
        case 'r':
          // Rotate mode
          changeEditorMode('rotate');
          break;
        case 's':
          // Scale mode
          changeEditorMode('scale');
          break;
        case 'v':
          // View mode
          changeEditorMode('view');
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [editorMode, selectedFurniture]);

  // Update collision detection and validation whenever furniture changes
  useEffect(() => {
    if (!isTransformingRef.current) {
      detectCollisions();
      validateLayout();
    }
  }, [furniture]);

  // Render the UI controls
  const renderControls = () => {
    return (
      <div className="editor-controls" style={{
        position: 'absolute',
        bottom: '20px',
        left: '20px',
        zIndex: 100,
        display: 'flex',
        flexDirection: 'column',
        gap: '10px',
        background: 'rgba(255,255,255,0.8)',
        padding: '15px',
        borderRadius: '8px',
      }}>
        <div className="mode-controls" style={{ display: 'flex', gap: '10px' }}>
          <button
            onClick={() => changeEditorMode('view')}
            style={{
              background: editorMode === 'view' ? '#4CAF50' : '#e0e0e0',
              padding: '8px 12px',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            View
          </button>
          <button
            onClick={() => changeEditorMode('translate')}
            style={{
              background: editorMode === 'translate' ? '#4CAF50' : '#e0e0e0',
              padding: '8px 12px',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            Move
          </button>
          <button
            onClick={() => changeEditorMode('rotate')}
            style={{
              background: editorMode === 'rotate' ? '#4CAF50' : '#e0e0e0',
              padding: '8px 12px',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            Rotate
          </button>
          <button
            onClick={() => changeEditorMode('scale')}
            style={{
              background: editorMode === 'scale' ? '#4CAF50' : '#e0e0e0',
              padding: '8px 12px',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            Scale
          </button>
        </div>

        {selectedFurniture && (
          <div className="selection-info" style={{
            marginTop: '10px',
            padding: '10px',
            backgroundColor: 'rgba(0,0,0,0.05)',
            borderRadius: '4px'
          }}>
            <div>Selected: {selectedFurniture.name}</div>
            <div>
              Position: {selectedFurniture.position.x.toFixed(2)},
              {selectedFurniture.position.y.toFixed(2)},
              {selectedFurniture.position.z.toFixed(2)}
            </div>
            <button
              onClick={() => removeFurnitureItem(selectedFurniture.id)}
              style={{
                marginTop: '5px',
                padding: '5px 10px',
                backgroundColor: '#f44336',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer'
              }}
            >
              Remove
            </button>
          </div>
        )}

        {validationIssues.length > 0 && (
          <div className="validation-issues" style={{
            marginTop: '10px',
            padding: '10px',
            backgroundColor: 'rgba(244,67,54,0.1)',
            borderRadius: '4px',
            maxHeight: '100px',
            overflowY: 'auto'
          }}>
            <div style={{ fontWeight: 'bold', marginBottom: '5px' }}>Validation Issues:</div>
            <ul style={{ margin: 0, paddingLeft: '20px' }}>
              {validationIssues.map((issue, index) => (
                {...liProps({key: index, children: issue})}
              ))}
            </ul>
          </div>
        )}
      </div>
    );
  };

  return (
    <div
      ref={containerRef}
      style={{ width: '100%', height: '100%', position: 'relative' }}
      onClick={handleObjectSelect}
    >
      <OptimizedThreeJsViewer
        modelUrl=""  // Use empty string instead of undefined
        onSceneReady={handleSceneReady}
        enableBVH={true}
        enableOcclusionCulling={true}
        enableAsyncLoading={true}
      />
      {renderControls()}
    </div>
  );
};

export default InteractiveSceneEditor;