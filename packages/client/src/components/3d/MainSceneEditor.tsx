import React, { useState, useEffect, useCallback } from 'react';
import * as THREE from 'three';

import InteractiveSceneEditor from './InteractiveSceneEditor';
import FurnitureMaterialEditor from './FurnitureMaterialEditor';
import PhysicsPropertiesEditor from './PhysicsPropertiesEditor';
import { PhysicsProperties, ValidationResult } from './PhysicsPropertiesEditor';
import { BaseMaterialProperties } from './FurnitureMaterialEditor';

// Interface for selected furniture item
interface FurnitureItem {
  id: string;
  name: string;
  object3D: THREE.Object3D;
  material: BaseMaterialProperties;
  physics: PhysicsProperties;
  dimensions?: {
    width: number;
    height: number;
    depth: number;
  };
}

interface MainSceneEditorProps {
  modelUrl?: string;
  furnitureItems?: FurnitureItem[];
  onSave?: (items: FurnitureItem[]) => void;
  onValidate?: (results: { item: FurnitureItem, validation: ValidationResult }[]) => void;
}

/**
 * Main Scene Editor Component
 * 
 * Combines all three editors:
 * - InteractiveSceneEditor for object manipulation and collision detection
 * - FurnitureMaterialEditor for advanced material properties
 * - PhysicsPropertiesEditor for physics validation
 * 
 * Provides a complete 3D editing experience with all the functionality
 * requested in the implementation roadmap.
 */
const MainSceneEditor: React.FC<MainSceneEditorProps> = ({
  modelUrl,
  furnitureItems = [],
  onSave,
  onValidate
}) => {
  // State for furniture items in the scene
  const [items, setItems] = useState<FurnitureItem[]>(furnitureItems);
  // Currently selected item
  const [selectedItem, setSelectedItem] = useState<FurnitureItem | null>(null);
  // Validation results for all items
  const [validationResults, setValidationResults] = useState<{ 
    [key: string]: ValidationResult 
  }>({});
  // UI state for which editor panel is active
  const [activePanel, setActivePanel] = useState<'material' | 'physics'>('material');

  // Initialize default material and physics properties for new items
  const initializeNewItem = useCallback((object: THREE.Object3D): FurnitureItem => {
    // Calculate dimensions from object's bounding box
    const bbox = new THREE.Box3().setFromObject(object);
    const size = new THREE.Vector3();
    bbox.getSize(size);
    
    // Create a unique ID
    const id = `furniture-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    
    return {
      id,
      name: object.name || `Item ${items.length + 1}`,
      object3D: object,
      material: {
        type: 'standard',
        baseColor: '#cccccc',
        roughness: 0.5,
        metalness: 0.2
      },
      physics: {
        mass: size.x * size.y * size.z * 100, // Approximated mass based on volume
        friction: 0.5,
        restitution: 0.3,
        isStatic: false,
        // Default center of mass at the center bottom of the object
        centerOfMass: new THREE.Vector3(0, size.y * 0.1, 0)
      },
      dimensions: {
        width: size.x,
        height: size.y,
        depth: size.z
      }
    };
  }, [items.length]);

  // Handle object selection from the scene
  const handleObjectSelected = useCallback((object: THREE.Object3D | null) => {
    if (!object) {
      setSelectedItem(null);
      return;
    }
    
    // Check if this object is already in our items list
    const existingItem = items.find(item => item.object3D.uuid === object.uuid);
    
    if (existingItem) {
      setSelectedItem(existingItem);
    } else {
      // Create a new item with default properties
      const newItem = initializeNewItem(object);
      setItems(prev => [...prev, newItem]);
      setSelectedItem(newItem);
    }
  }, [items, initializeNewItem]);

  // Handle changes to material properties
  const handleMaterialChange = useCallback((material: BaseMaterialProperties) => {
    if (!selectedItem) return;
    
    // Update the selected item's material
    const updatedItem = {
      ...selectedItem,
      material
    };
    
    // Update both the selected item and the items array
    setSelectedItem(updatedItem);
    setItems(prev => prev.map(item => 
      item.id === updatedItem.id ? updatedItem : item
    ));
  }, [selectedItem]);

  // Handle changes to physics properties
  const handlePhysicsChange = useCallback((physics: PhysicsProperties) => {
    if (!selectedItem) return;
    
    // Update the selected item's physics properties
    const updatedItem = {
      ...selectedItem,
      physics
    };
    
    // Update both the selected item and the items array
    setSelectedItem(updatedItem);
    setItems(prev => prev.map(item => 
      item.id === updatedItem.id ? updatedItem : item
    ));
  }, [selectedItem]);

  // Handle physics validation results
  const handleValidation = useCallback((result: ValidationResult) => {
    if (!selectedItem) return;
    
    // Store validation result for this item
    setValidationResults(prev => ({
      ...prev,
      [selectedItem.id]: result
    }));
    
    // Call external validation handler if provided
    if (onValidate) {
      const allResults = items.map(item => ({
        item,
        validation: item.id === selectedItem.id 
          ? result 
          : validationResults[item.id] || { isValid: true, issues: [], warnings: [] }
      }));
      
      onValidate(allResults);
    }
  }, [selectedItem, items, validationResults, onValidate]);

  // Save scene (called when user wants to save changes)
  const handleSave = useCallback(() => {
    if (onSave) {
      onSave(items);
    }
  }, [items, onSave]);

  // Handle furniture item transformations (position, rotation, scale)
  const handleItemTransformed = useCallback((object: THREE.Object3D, position: THREE.Vector3, rotation: THREE.Euler, scale: THREE.Vector3) => {
    if (!object) return;
    
    // Find the item in our array
    const itemIndex = items.findIndex(item => item.object3D.uuid === object.uuid);
    if (itemIndex === -1) return;
    
    // Update the object's transform
    object.position.copy(position);
    object.rotation.copy(rotation);
    object.scale.copy(scale);
    
    // Update the item in our array
    const updatedItems = [...items];
    updatedItems[itemIndex] = {
      ...updatedItems[itemIndex],
      object3D: object
    };
    
    setItems(updatedItems);
    
    // If this is the selected item, update selected item too
    if (selectedItem && selectedItem.object3D.uuid === object.uuid) {
      setSelectedItem({
        ...selectedItem,
        object3D: object
      });
    }
  }, [items, selectedItem]);

  // Detect collisions between items
  const handleCollisionsDetected = useCallback((collisions: Array<[THREE.Object3D, THREE.Object3D]>) => {
    // Visual feedback for collisions would go here
    // For example, highlighting objects that are colliding
    console.log('Collisions detected:', collisions.length);
  }, []);

  return (
    <div className="main-scene-editor" style={{
      display: 'flex',
      height: '100%',
      width: '100%'
    }}>
      {/* Scene View (left panel) */}
      <div className="scene-view-panel" style={{
        flex: 3,
        height: '100%',
        position: 'relative',
        overflow: 'hidden'
      }}>
        <InteractiveSceneEditor
          modelUrl={modelUrl}
          onObjectSelected={handleObjectSelected}
          onObjectTransformed={handleItemTransformed}
          onCollisionsDetected={handleCollisionsDetected}
        />

        {/* Toolbar */}
        <div className="editor-toolbar" style={{
          position: 'absolute',
          top: '10px',
          right: '10px',
          display: 'flex',
          gap: '10px'
        }}>
          <button 
            onClick={handleSave}
            style={{
              padding: '8px 16px',
              backgroundColor: '#4CAF50',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            Save Scene
          </button>
        </div>
      </div>
      
      {/* Properties Panel (right panel) */}
      <div className="properties-panel" style={{
        flex: 1,
        height: '100%',
        padding: '15px',
        backgroundColor: '#f0f0f0',
        overflowY: 'auto'
      }}>
        {/* Item selection info */}
        <div className="selection-info" style={{ marginBottom: '20px' }}>
          <h2 style={{ margin: '0 0 10px 0' }}>
            {selectedItem ? selectedItem.name : 'No item selected'}
          </h2>
          {selectedItem && (
            <div className="dimensions-info" style={{ fontSize: '0.9em', color: '#666' }}>
              <div>
                W: {selectedItem.dimensions?.width.toFixed(2) || 'unknown'} x 
                H: {selectedItem.dimensions?.height.toFixed(2) || 'unknown'} x 
                D: {selectedItem.dimensions?.depth.toFixed(2) || 'unknown'}
              </div>
            </div>
          )}
        </div>
        
        {/* Editor tabs */}
        <div className="editor-tabs" style={{
          display: 'flex',
          borderBottom: '1px solid #ddd',
          marginBottom: '15px'
        }}>
          <button 
            onClick={() => setActivePanel('material')}
            style={{
              padding: '8px 16px',
              backgroundColor: activePanel === 'material' ? '#f0f0f0' : '#ddd',
              border: 'none',
              borderTopLeftRadius: '4px',
              borderTopRightRadius: '4px',
              borderBottom: activePanel === 'material' ? '2px solid #2196F3' : 'none',
              cursor: 'pointer'
            }}
          >
            Material
          </button>
          <button 
            onClick={() => setActivePanel('physics')}
            style={{
              padding: '8px 16px',
              backgroundColor: activePanel === 'physics' ? '#f0f0f0' : '#ddd',
              border: 'none',
              borderTopLeftRadius: '4px',
              borderTopRightRadius: '4px',
              borderBottom: activePanel === 'physics' ? '2px solid #2196F3' : 'none',
              cursor: 'pointer',
              marginLeft: '4px'
            }}
          >
            Physics
          </button>
        </div>
        
        {/* Editor panels based on active tab */}
        {selectedItem && activePanel === 'material' && (
          <FurnitureMaterialEditor
            material={selectedItem.material}
            onMaterialChange={handleMaterialChange}
            previewObject={selectedItem.object3D}
          />
        )}
        
        {selectedItem && activePanel === 'physics' && (
          <PhysicsPropertiesEditor
            properties={selectedItem.physics}
            materialType={selectedItem.material.type}
            dimensions={selectedItem.dimensions}
            onChange={handlePhysicsChange}
            onValidate={handleValidation}
          />
        )}
        
        {!selectedItem && (
          <div className="no-selection-message" style={{
            padding: '20px',
            textAlign: 'center',
            color: '#666'
          }}>
            <p>Select an object in the scene to edit its properties</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default MainSceneEditor;