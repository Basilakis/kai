/// <reference path="../../types/three-materials.d.ts" />
/// <reference path="../../types/jsx-custom.d.ts" />

import React, { useState, useEffect, HTMLAttributes } from 'react';
import * as THREE from 'three';

// Material types supported by our enhanced system
export type MaterialType = 
  | 'standard' 
  | 'anisotropic' 
  | 'subsurface' 
  | 'thinfilm' 
  | 'procedural' 
  | 'layered';

// Interface for base material properties
export interface BaseMaterialProperties {
  type: MaterialType;
  baseColor: string | THREE.Color;
  roughness: number;
  metalness: number;
  normalMapStrength?: number;
  aoMapIntensity?: number;
  displacementScale?: number;
  envMapIntensity?: number;
}

// Interface for anisotropic material properties
export interface AnisotropicMaterialProperties extends BaseMaterialProperties {
  type: 'anisotropic';
  anisotropy: number;
  anisotropyRotation: number;
  anisotropyMap?: string;
}

// Interface for subsurface scattering material properties
export interface SubsurfaceMaterialProperties extends BaseMaterialProperties {
  type: 'subsurface';
  subsurfaceColor: string | THREE.Color;
  subsurfaceRadius: number;
  subsurfaceIntensity?: number;
}

// Interface for thin film material properties
export interface ThinFilmMaterialProperties extends BaseMaterialProperties {
  type: 'thinfilm';
  filmThickness: number;
  filmIOR: number;
  filmColor?: string | THREE.Color;
}

// Interface for procedural material properties
export interface ProceduralMaterialProperties extends BaseMaterialProperties {
  type: 'procedural';
  textureType: string;
  scale?: number;
  detail?: number;
  distortion?: number;
  seed?: number;
}

// Interface for layered material properties
export interface LayeredMaterialProperties extends BaseMaterialProperties {
  type: 'layered';
  layers: BaseMaterialProperties[];
  blendFactors: number[];
  blendTypes: string[];
}

// Combined type for all material properties
export type MaterialProperties = 
  | BaseMaterialProperties 
  | AnisotropicMaterialProperties 
  | SubsurfaceMaterialProperties 
  | ThinFilmMaterialProperties
  | ProceduralMaterialProperties
  | LayeredMaterialProperties;

// Props for the FurnitureMaterialEditor component
interface FurnitureMaterialEditorProps {
  material: MaterialProperties;
  onMaterialChange: (material: MaterialProperties) => void;
  previewObject?: THREE.Object3D;
}

/**
 * Component for editing enhanced material properties
 * Supports all material types implemented in our BlenderProc custom shaders
 */
const FurnitureMaterialEditor: React.FC<FurnitureMaterialEditorProps> = ({
  material,
  onMaterialChange,
  previewObject
}) => {
  // State for the current material
  const [currentMaterial, setCurrentMaterial] = useState<MaterialProperties>(material);
  
  // Apply material changes to the preview object if available
  useEffect(() => {
    if (previewObject) {
      applyMaterialToObject(previewObject, currentMaterial);
    }
  }, [previewObject, currentMaterial]);
  
  // Apply material to a Three.js object
  const applyMaterialToObject = (object: THREE.Object3D, material: MaterialProperties) => {
    object.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        let threeMaterial: THREE.Material | undefined;
        
        // Create appropriate Three.js material based on type
        switch (material.type) {
          case 'standard':
            threeMaterial = createStandardMaterial(material);
            break;
          case 'anisotropic':
            threeMaterial = createAnisotropicMaterial(material);
            break;
          case 'subsurface':
            threeMaterial = createSubsurfaceMaterial(material);
            break;
          case 'thinfilm':
            threeMaterial = createThinFilmMaterial(material);
            break;
          case 'procedural':
            threeMaterial = createProceduralMaterial(material);
            break;
          case 'layered':
            threeMaterial = createLayeredMaterial(material);
            break;
        }
        
        if (threeMaterial) {
          child.material = threeMaterial;
        }
      }
    });
  };
  
  // Create a standard Three.js material
  const createStandardMaterial = (props: BaseMaterialProperties): THREE.Material => {
    const material = new THREE.MeshStandardMaterial({
      color: props.baseColor,
      roughness: props.roughness,
      metalness: props.metalness
    });
    
    if (props.normalMapStrength !== undefined && props.normalMapStrength > 0) {
      // Normally you would set up normal map here
    }
    
    if (props.aoMapIntensity !== undefined) {
      material.aoMapIntensity = props.aoMapIntensity;
    }
    
    if (props.envMapIntensity !== undefined) {
      material.envMapIntensity = props.envMapIntensity;
    }
    
    return material;
  };
  
  // Create an anisotropic material
  const createAnisotropicMaterial = (props: MaterialProperties): THREE.Material => {
    if (props.type !== 'anisotropic') {
      throw new Error('Expected anisotropic material');
    }
    // In a real implementation, we would use a custom shader
    // For now, we'll simulate with ShaderMaterial
    const material = new THREE.MeshPhysicalMaterial({
      color: props.baseColor,
      roughness: props.roughness,
      metalness: props.metalness,
      // Note: Three.js MeshPhysicalMaterial doesn't directly support anisotropy
      // In a production environment, we would use a custom shader
    });
    
    return material;
  };
  
  // Create a subsurface scattering material
  const createSubsurfaceMaterial = (props: MaterialProperties): THREE.Material => {
    if (props.type !== 'subsurface') {
      throw new Error('Expected subsurface material');
    }
    const material = new THREE.MeshPhysicalMaterial({
      color: props.baseColor,
      roughness: props.roughness,
      metalness: props.metalness,
      // Three.js has some subsurface capabilities in MeshPhysicalMaterial
      transmission: 0.5, // Approximation of subsurface effect
    });
    
    return material;
  };
  
  // Create a thin film material
  const createThinFilmMaterial = (props: MaterialProperties): THREE.Material => {
    if (props.type !== 'thinfilm') {
      throw new Error('Expected thin film material');
    }
    // For thin film effect, we need a custom shader in production
    const material = new THREE.MeshPhysicalMaterial({
      color: props.baseColor,
      roughness: props.roughness,
      metalness: props.metalness,
      clearcoat: 1.0, // Approximation of thin film effect
      clearcoatRoughness: 0.1,
    });
    
    return material;
  };
  
  // Create a procedural material
  const createProceduralMaterial = (props: MaterialProperties): THREE.Material => {
    if (props.type !== 'procedural') {
      throw new Error('Expected procedural material');
    }
    // For procedural textures, we'd need custom shaders
    const material = new THREE.MeshStandardMaterial({
      color: props.baseColor,
      roughness: props.roughness,
      metalness: props.metalness,
    });
    
    return material;
  };
  
  // Create a layered material
  const createLayeredMaterial = (props: MaterialProperties): THREE.Material => {
    if (props.type !== 'layered') {
      throw new Error('Expected layered material');
    }
    // Layered materials require custom shader implementation
    // For now, return a basic material
    const material = new THREE.MeshStandardMaterial({
      color: props.baseColor,
      roughness: props.roughness,
      metalness: props.metalness,
    });
    
    return material;
  };
  
  // Handle material type change
  const handleMaterialTypeChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const newType = event.target.value as MaterialType;
    let newMaterial: MaterialProperties;
    
    // Create new material properties based on type
    switch (newType) {
      case 'anisotropic':
        newMaterial = {
          ...currentMaterial,
          type: 'anisotropic',
          anisotropy: 0.5,
          anisotropyRotation: 0
        } as AnisotropicMaterialProperties;
        break;
      case 'subsurface':
        newMaterial = {
          ...currentMaterial,
          type: 'subsurface',
          subsurfaceColor: '#ffffff',
          subsurfaceRadius: 1.0
        } as SubsurfaceMaterialProperties;
        break;
      case 'thinfilm':
        newMaterial = {
          ...currentMaterial,
          type: 'thinfilm',
          filmThickness: 500, // nanometers
          filmIOR: 1.5
        } as ThinFilmMaterialProperties;
        break;
      case 'procedural':
        newMaterial = {
          ...currentMaterial,
          type: 'procedural',
          textureType: 'noise'
        } as ProceduralMaterialProperties;
        break;
      case 'layered':
        newMaterial = {
          ...currentMaterial,
          type: 'layered',
          layers: [{ ...currentMaterial }] as BaseMaterialProperties[],
          blendFactors: [1.0],
          blendTypes: ['mix']
        } as LayeredMaterialProperties;
        break;
      default:
        newMaterial = {
          ...currentMaterial,
          type: 'standard'
        } as BaseMaterialProperties;
    }
    
    setCurrentMaterial(newMaterial);
    onMaterialChange(newMaterial);
  };
  
  // Handle base property changes
  const handleBasePropertyChange = (
    event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value } = event.target;
    let parsedValue: any = value;
    
    // Convert numeric values
    if (name !== 'baseColor' && name !== 'type') {
      parsedValue = parseFloat(value);
    }
    
    const updatedMaterial = {
      ...currentMaterial,
      [name]: parsedValue
    };
    
    setCurrentMaterial(updatedMaterial);
    onMaterialChange(updatedMaterial);
  };
  
  // Render UI based on material type
  const renderMaterialSpecificControls = () => {
    // Render specific controls based on material type
    switch (currentMaterial.type) {
      case 'anisotropic':
        return renderAnisotropicControls(currentMaterial as AnisotropicMaterialProperties);
      case 'subsurface':
        return renderSubsurfaceControls(currentMaterial as SubsurfaceMaterialProperties);
      case 'thinfilm':
        return renderThinFilmControls(currentMaterial as ThinFilmMaterialProperties);
      case 'procedural':
        return renderProceduralControls(currentMaterial as ProceduralMaterialProperties);
      case 'layered':
        return renderLayeredControls(currentMaterial as LayeredMaterialProperties);
      default:
        return null;
    }
  };
  
  // Render controls for anisotropic material
  const renderAnisotropicControls = (material: AnisotropicMaterialProperties) => {
    return (
      <div className="material-specific-controls">
        <div className="control-group">
          <label>Anisotropy Strength:</label>
          <input {...inputProps({
            type: "range", 
            name: "anisotropy", 
            min: "0", 
            max: "1", 
            step: "0.01", 
            value: material.anisotropy,
            onChange: handleSpecificPropertyChange
          })} />
          <span>{material.anisotropy.toFixed(2)}</span>
        </div>
        
        <div className="control-group">
          <label>Anisotropy Rotation:</label>
          <input {...inputProps({
            type: "range", 
            name: "anisotropyRotation", 
            min: "0", 
            max: Math.PI * 2, 
            step: "0.01", 
            value: material.anisotropyRotation,
            onChange: handleSpecificPropertyChange
          })}
          />
          <span>{(material.anisotropyRotation * 180 / Math.PI).toFixed(0)}°</span>
        </div>
      </div>
    );
  };
  
  // Render controls for subsurface material
  const renderSubsurfaceControls = (material: SubsurfaceMaterialProperties) => {
    return (
      <div className="material-specific-controls">
        <div className="control-group">
          <label>Subsurface Color:</label>
          <input {...inputProps({
            type: "color", 
            name: "subsurfaceColor", 
            value: typeof material.subsurfaceColor === 'string' ? 
              material.subsurfaceColor : '#ffffff',
            onChange: handleSpecificPropertyChange
          })}
          />
        </div>
        
        <div className="control-group">
          <label>Subsurface Radius:</label>
          <input {...inputProps({
            type: "range", 
            name: "subsurfaceRadius", 
            min: "0", 
            max: "10", 
            step: "0.1", 
            value: material.subsurfaceRadius,
            onChange: handleSpecificPropertyChange
          })}
          />
          <span>{material.subsurfaceRadius.toFixed(1)}</span>
        </div>
        
        {material.subsurfaceIntensity !== undefined && (
          <div className="control-group">
            <label>Subsurface Intensity:</label>
            <input {...inputProps({
              type: "range",
              name: "subsurfaceIntensity",
              min: "0",
              max: "1",
              step: "0.01",
              value: material.subsurfaceIntensity,
              onChange: handleSpecificPropertyChange
            })}
            />
            <span>{material.subsurfaceIntensity.toFixed(2)}</span>
          </div>
        )}
      </div>
    );
  };
  
  // Render controls for thin film material
  const renderThinFilmControls = (material: ThinFilmMaterialProperties) => {
    return (
      <div className="material-specific-controls">
        <div className="control-group">
          <label>Film Thickness (nm):</label>
          <input {...inputProps({
            type: "range",
            name: "filmThickness",
            min: "100",
            max: "1000",
            step: "10",
            value: material.filmThickness,
            onChange: handleSpecificPropertyChange
          })}
          />
          <span>{material.filmThickness} nm</span>
        </div>
        
        <div className="control-group">
          <label>Film IOR:</label>
          <input {...inputProps({
            type: "range",
            name: "filmIOR",
            min: "1.0",
            max: "2.5",
            step: "0.01",
            value: material.filmIOR,
            onChange: handleSpecificPropertyChange
          })}
          />
          <span>{material.filmIOR.toFixed(2)}</span>
        </div>
        
        {material.filmColor !== undefined && (
          <div className="control-group">
            <label>Film Color:</label>
            <input {...inputProps({
              type: "color",
              name: "filmColor",
              value: typeof material.filmColor === 'string' ? 
                material.filmColor : '#ffffff',
              onChange: handleSpecificPropertyChange
            })}
            />
          </div>
        )}
      </div>
    );
  };
  
  // Render controls for procedural material
  const renderProceduralControls = (material: ProceduralMaterialProperties) => {
    return (
      <div className="material-specific-controls">
        <div className="control-group">
          <label>Texture Type:</label>
          <select {...selectProps({
            name: "textureType",
            value: material.textureType,
            onChange: handleSpecificPropertyChange
          })}>
            <option {...optionProps({ value: "noise", children: "Noise" })} />
            <option {...optionProps({ value: "wood", children: "Wood" })} />
            <option {...optionProps({ value: "marble", children: "Marble" })} />
            <option {...optionProps({ value: "leather", children: "Leather" })} />
            <option {...optionProps({ value: "fabric", children: "Fabric" })} />
          </select>
        </div>
        
        {material.scale !== undefined && (
          <div className="control-group">
            <label>Scale:</label>
            <input {...inputProps({
              type: "range",
              name: "scale",
              min: "0.1",
              max: "10",
              step: "0.1",
              value: material.scale,
              onChange: handleSpecificPropertyChange
            })}
            />
            <span>{material.scale.toFixed(1)}</span>
          </div>
        )}
        
        {material.detail !== undefined && (
          <div className="control-group">
            <label>Detail:</label>
            <input {...inputProps({
              type: "range",
              name: "detail",
              min: "1",
              max: "10", 
              step: "1",
              value: material.detail,
              onChange: handleSpecificPropertyChange
            })}
            />
            <span>{material.detail}</span>
          </div>
        )}
        
        {material.distortion !== undefined && (
          <div className="control-group">
            <label>Distortion:</label>
            <input {...inputProps({
              type: "range",
              name: "distortion",
              min: "0",
              max: "1",
              step: "0.01",
              value: material.distortion,
              onChange: handleSpecificPropertyChange
            })}
            />
            <span>{material.distortion.toFixed(2)}</span>
          </div>
        )}
      </div>
    );
  };
  
  // Render controls for layered material
  const renderLayeredControls = (material: LayeredMaterialProperties) => {
    return (
      <div className="material-specific-controls">
        <div className="layered-materials">
          <h4>Layers</h4>
          {material.layers.map((layer, index) => (
            <div key={index} className="layer-item">
              <div className="layer-header">
                <span>Layer {index + 1}</span>
                <button onClick={() => handleRemoveLayer(index)} disabled={material.layers.length <= 1}>
                  Remove
                </button>
              </div>
              
              <div className="control-group">
                <label>Blend Factor:</label>
                <input {...inputProps({
                  type: "range", 
                  min: "0", 
                  max: "1", 
                  step: "0.01", 
                  value: material.blendFactors[index] || 1,
                  onChange: (e: React.ChangeEvent<HTMLInputElement>) => handleLayerBlendChange(index, parseFloat(e.target.value))
                })}
                />
                <span>{(material.blendFactors[index] || 1).toFixed(2)}</span>
              </div>
              
              <div className="control-group">
                <label>Blend Type:</label>
                <select {...selectProps({
                  value: material.blendTypes[index] || 'mix',
                  onChange: (e: React.ChangeEvent<HTMLSelectElement>) => handleLayerBlendTypeChange(index, e.target.value)
                })}>
                  <option {...optionProps({ value: "mix", children: "Mix" })} key="mix" />
                  <option {...optionProps({ value: "add", children: "Add" })} key="add" />
                  <option {...optionProps({ value: "multiply", children: "Multiply" })} key="multiply" />
                  <option {...optionProps({ value: "overlay", children: "Overlay" })} key="overlay" />
                </select>
              </div>
              
              {/* For a full implementation, we would have nested material editors here */}
              <div className="mini-material-editor">
                <div className="control-group">
                  <label>Color:</label>
                  <input {...inputProps({
                    type: "color", 
                    value: typeof layer.baseColor === 'string' ? 
                      layer.baseColor : '#ffffff',
                    onChange: (e: React.ChangeEvent<HTMLInputElement>) => handleLayerPropertyChange(index, 'baseColor', e.target.value)
                  })}
                  />
                </div>
                
                <div className="control-group">
                  <label>Roughness:</label>
                  <input {...inputProps({
                    type: "range", 
                    min: "0", 
                    max: "1", 
                    step: "0.01", 
                    value: layer.roughness,
                    onChange: (e: React.ChangeEvent<HTMLInputElement>) => handleLayerPropertyChange(index, 'roughness', parseFloat(e.target.value))
                  })}
                  />
                  <span>{layer.roughness.toFixed(2)}</span>
                </div>
                
                <div className="control-group">
                  <label>Metalness:</label>
                  <input {...inputProps({
                    type: "range", 
                    min: "0", 
                    max: "1", 
                    step: "0.01", 
                    value: layer.metalness,
                    onChange: (e: React.ChangeEvent<HTMLInputElement>) => handleLayerPropertyChange(index, 'metalness', parseFloat(e.target.value))
                  })}
                  />
                  <span>{layer.metalness.toFixed(2)}</span>
                </div>
              </div>
            </div>
          ))}
          
          <button 
            className="add-layer-button"
            onClick={handleAddLayer}
          >
            Add Layer
          </button>
        </div>
      </div>
    );
  };
  
  // Handle a specific property change in the current material
  const handleSpecificPropertyChange = (
    event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value } = event.target;
    let parsedValue: any = value;
    
    // Convert numeric values
    if (name !== 'textureType' && name !== 'subsurfaceColor' && name !== 'filmColor') {
      parsedValue = parseFloat(value);
    }
    
    const updatedMaterial = {
      ...currentMaterial,
      [name]: parsedValue
    };
    
    setCurrentMaterial(updatedMaterial);
    onMaterialChange(updatedMaterial);
  };
  
  // Handle layered material specific functions
  const handleAddLayer = () => {
    if (currentMaterial.type !== 'layered') return;
    
    const layeredMaterial = currentMaterial as LayeredMaterialProperties;
    const newLayer: BaseMaterialProperties = {
      type: 'standard',
      baseColor: '#cccccc',
      roughness: 0.5,
      metalness: 0
    };
    
    const updatedMaterial: LayeredMaterialProperties = {
      ...layeredMaterial,
      layers: [...layeredMaterial.layers, newLayer],
      blendFactors: [...layeredMaterial.blendFactors, 0.5],
      blendTypes: [...layeredMaterial.blendTypes, 'mix']
    };
    
    setCurrentMaterial(updatedMaterial);
    onMaterialChange(updatedMaterial);
  };
  
  const handleRemoveLayer = (index: number) => {
    if (currentMaterial.type !== 'layered') return;
    
    const layeredMaterial = currentMaterial as LayeredMaterialProperties;
    if (layeredMaterial.layers.length <= 1) return; // Always keep at least one layer
    
    const updatedMaterial: LayeredMaterialProperties = {
      ...layeredMaterial,
      layers: layeredMaterial.layers.filter((_, i) => i !== index),
      blendFactors: layeredMaterial.blendFactors.filter((_, i) => i !== index),
      blendTypes: layeredMaterial.blendTypes.filter((_, i) => i !== index)
    };
    
    setCurrentMaterial(updatedMaterial);
    onMaterialChange(updatedMaterial);
  };
  
  const handleLayerBlendChange = (index: number, value: number) => {
    if (currentMaterial.type !== 'layered') return;
    
    const layeredMaterial = currentMaterial as LayeredMaterialProperties;
    const updatedBlendFactors = [...layeredMaterial.blendFactors];
    updatedBlendFactors[index] = value;
    
    const updatedMaterial: LayeredMaterialProperties = {
      ...layeredMaterial,
      blendFactors: updatedBlendFactors
    };
    
    setCurrentMaterial(updatedMaterial);
    onMaterialChange(updatedMaterial);
  };
  
  const handleLayerBlendTypeChange = (index: number, value: string) => {
    if (currentMaterial.type !== 'layered') return;
    
    const layeredMaterial = currentMaterial as LayeredMaterialProperties;
    const updatedBlendTypes = [...layeredMaterial.blendTypes];
    updatedBlendTypes[index] = value;
    
    const updatedMaterial: LayeredMaterialProperties = {
      ...layeredMaterial,
      blendTypes: updatedBlendTypes
    };
    
    setCurrentMaterial(updatedMaterial);
    onMaterialChange(updatedMaterial);
  };
  
  const handleLayerPropertyChange = (index: number, property: string, value: any) => {
    if (currentMaterial.type !== 'layered') return;
    
    const layeredMaterial = currentMaterial as LayeredMaterialProperties;
    const updatedLayers = [...layeredMaterial.layers];
    // Ensure we maintain required properties
    if (updatedLayers[index]) {
      updatedLayers[index] = {
        ...updatedLayers[index],
        [property]: value,
        type: updatedLayers[index]?.type || 'standard' // Ensure type is always set
      } as BaseMaterialProperties;
    }
    
    const updatedMaterial: LayeredMaterialProperties = {
      ...layeredMaterial,
      layers: updatedLayers
    };
    
    setCurrentMaterial(updatedMaterial);
    onMaterialChange(updatedMaterial);
  };
  
  // Type assertion to resolve TypeScript JSX element type issues
  const inputProps = (props: any) => props as any;
  const selectProps = (props: any) => props as any;
  const optionProps = (props: any) => props as any;

  return (
    <div className="furniture-material-editor" style={{
      padding: '15px',
      backgroundColor: '#f5f5f5',
      borderRadius: '8px',
      maxWidth: '400px'
    }}>
      <h3 style={{ marginTop: 0, marginBottom: '15px' }}>Material Editor</h3>
      
      <div className="control-group">
        <label>Material Type:</label>
        <select {...selectProps({
          name: "type",
          value: currentMaterial.type,
          onChange: handleMaterialTypeChange,
          style: {
            width: '100%',
            padding: '8px',
            marginBottom: '15px',
            borderRadius: '4px',
            border: '1px solid #ccc'
          }
        })}>
          <option {...optionProps({ value: "standard", children: "Standard" })} />
          <option {...optionProps({ value: "anisotropic", children: "Anisotropic" })} />
          <option {...optionProps({ value: "subsurface", children: "Subsurface Scattering" })} />
          <option {...optionProps({ value: "thinfilm", children: "Thin Film" })} />
          <option {...optionProps({ value: "procedural", children: "Procedural" })} />
          <option {...optionProps({ value: "layered", children: "Layered" })} />
        </select>
      </div>
      
      <div className="base-properties" style={{
        marginBottom: '15px',
        padding: '10px',
        backgroundColor: '#ffffff',
        borderRadius: '4px'
      }}>
        <h4 style={{ margin: '0 0 10px 0' }}>Base Properties</h4>
        
        <div className="control-group" style={{ marginBottom: '10px' }}>
          <label>Base Color:</label>
          <input {...inputProps({
            type: "color", 
            name: "baseColor", 
            value: typeof currentMaterial.baseColor === 'string' ? 
              currentMaterial.baseColor : '#ffffff',
            onChange: handleBasePropertyChange,
            style: { width: '100%', height: '30px' }
          })}
          />
        </div>
        
        <div className="control-group" style={{ marginBottom: '10px' }}>
          <label>Roughness:</label>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <input {...inputProps({
              type: "range", 
              name: "roughness", 
              min: "0", 
              max: "1", 
              step: "0.01", 
              value: currentMaterial.roughness,
              onChange: handleBasePropertyChange,
              style: { flex: 1 }
            })}
            />
            <span style={{ minWidth: '40px', textAlign: 'right' }}>
              {currentMaterial.roughness.toFixed(2)}
            </span>
          </div>
        </div>
        
        <div className="control-group" style={{ marginBottom: '10px' }}>
          <label>Metalness:</label>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <input {...inputProps({
              type: "range", 
              name: "metalness", 
              min: "0", 
              max: "1", 
              step: "0.01", 
              value: currentMaterial.metalness,
              onChange: handleBasePropertyChange,
              style: { flex: 1 }
            })}
            />
            <span style={{ minWidth: '40px', textAlign: 'right' }}>
              {currentMaterial.metalness.toFixed(2)}
            </span>
          </div>
        </div>
      </div>
      
      {/* Render material-specific controls */}
      {renderMaterialSpecificControls()}
    </div>
  );
};

export default FurnitureMaterialEditor;