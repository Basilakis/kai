import React, { useState, useEffect } from 'react';
import * as THREE from 'three';

// Interface for physics properties
export interface PhysicsProperties {
  // Basic properties
  mass: number;
  friction: number;
  restitution: number; // "bounciness"
  isStatic: boolean;
  
  // Advanced properties
  centerOfMass?: THREE.Vector3;
  momentOfInertia?: THREE.Vector3;
  collisionGroup?: number;
  collisionMask?: number;
  
  // Material-specific physics properties
  density?: number;
  youngsModulus?: number; // stiffness
  surfaceRoughness?: number; // micro-scale roughness
}

// Result of physics validation
export interface ValidationResult {
  isValid: boolean;
  issues: string[];
  warnings: string[];
  stabilitySummary?: {
    tippingRisk: number; // 0-1 scale
    stabilityScore: number; // 0-100 scale
    centerOfMassOffset: number; // distance from ideal
  };
}

// Props for the PhysicsPropertiesEditor component
interface PhysicsPropertiesEditorProps {
  properties: PhysicsProperties;
  materialType?: string;
  dimensions?: {
    width: number;
    height: number;
    depth: number;
  };
  onChange: (properties: PhysicsProperties) => void;
  onValidate?: (result: ValidationResult) => void;
  validateOnChange?: boolean;
}

/**
 * Component for editing and validating physics properties of furniture
 * Implements advanced physics validation with center of mass and stability analysis
 */
const PhysicsPropertiesEditor: React.FC<PhysicsPropertiesEditorProps> = ({
  properties,
  materialType = 'standard',
  dimensions,
  onChange,
  onValidate,
  validateOnChange = true
}) => {
  // State for the current physics properties
  const [physicsProps, setPhysicsProps] = useState<PhysicsProperties>(properties);
  const [validationResult, setValidationResult] = useState<ValidationResult>({
    isValid: true,
    issues: [],
    warnings: []
  });
  
  // Anytime properties change, validate if needed
  useEffect(() => {
    if (validateOnChange) {
      validatePhysics();
    }
  }, [physicsProps, validateOnChange]);
  
  // Handle property changes
  const handlePropertyChange = (
    event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value, type } = event.target as HTMLInputElement;
    let parsedValue: any;
    
    // Parse values appropriately based on type
    if (type === 'checkbox') {
      parsedValue = (event.target as HTMLInputElement).checked;
    } else if (type === 'number' || type === 'range') {
      parsedValue = parseFloat(value);
    } else {
      parsedValue = value;
    }
    
    const updatedProps = {
      ...physicsProps,
      [name]: parsedValue
    };
    
    setPhysicsProps(updatedProps);
    onChange(updatedProps);
  };
  
  // Handle vector property changes (e.g., center of mass)
  const handleVectorChange = (
    property: string,
    axis: 'x' | 'y' | 'z',
    value: number
  ) => {
    const vector = ((physicsProps as any)[property] as THREE.Vector3) || new THREE.Vector3();
    vector[axis] = value;
    
    const updatedProps = {
      ...physicsProps,
      [property]: vector
    };
    
    setPhysicsProps(updatedProps);
    onChange(updatedProps);
  };
  
  // Validate physics properties
  const validatePhysics = () => {
    const issues: string[] = [];
    const warnings: string[] = [];
    
    // Basic validation
    if (physicsProps.mass <= 0 && !physicsProps.isStatic) {
      issues.push("Non-static objects must have positive mass");
    }
    
    if (physicsProps.friction < 0 || physicsProps.friction > 1) {
      issues.push("Friction coefficient should be between 0 and 1");
    }
    
    if (physicsProps.restitution < 0 || physicsProps.restitution > 1) {
      issues.push("Restitution coefficient should be between 0 and 1");
    }
    
    // Material-specific validations
    if (physicsProps.density !== undefined && physicsProps.density <= 0) {
      issues.push("Density must be positive");
    }
    
    if (physicsProps.youngsModulus !== undefined && physicsProps.youngsModulus <= 0) {
      issues.push("Young's modulus must be positive");
    }
    
    // Center of mass validation
    let tippingRisk = 0;
    let stabilityScore = 100;
    let centerOfMassOffset = 0;
    
    if (dimensions && physicsProps.centerOfMass) {
      const com = physicsProps.centerOfMass;
      const { width, height, depth } = dimensions;
      
      // Calculate how far the center of mass is from the center bottom
      const idealY = height * 0.1; // Slightly above the base for stability
      const idealX = 0;
      const idealZ = 0;
      
      const offsetY = com.y - idealY;
      const offsetX = com.x - idealX;
      const offsetZ = com.z - idealZ;
      
      centerOfMassOffset = Math.sqrt(offsetX * offsetX + offsetY * offsetY + offsetZ * offsetZ);
      
      // Calculate stability score
      const heightOffset = offsetY / height;
      const widthOffset = Math.abs(offsetX) / (width * 0.5);
      const depthOffset = Math.abs(offsetZ) / (depth * 0.5);
      
      tippingRisk = Math.max(
        heightOffset * 0.5,
        widthOffset * 0.7,
        depthOffset * 0.7
      );
      tippingRisk = Math.min(1, Math.max(0, tippingRisk));
      
      stabilityScore = 100 * (1 - tippingRisk);
      
      if (tippingRisk > 0.7) {
        issues.push("High risk of tipping over due to center of mass position");
      } else if (tippingRisk > 0.3) {
        warnings.push("Moderate risk of tipping based on center of mass");
      }
    }
    
    // Generate result
    const result: ValidationResult = {
      isValid: issues.length === 0,
      issues,
      warnings,
      stabilitySummary: {
        tippingRisk,
        stabilityScore,
        centerOfMassOffset
      }
    };
    
    setValidationResult(result);
    
    if (onValidate) {
      onValidate(result);
    }
    
    return result;
  };
  
  // Material-based suggestions
  const suggestPhysicsProperties = () => {
    let suggestedProps: Partial<PhysicsProperties> = {};
    
    switch (materialType) {
      case 'wood':
        suggestedProps = {
          density: 700, // kg/m³ (average)
          friction: 0.5,
          restitution: 0.3,
          youngsModulus: 11e9 // 11 GPa (typical for wood)
        };
        break;
      case 'metal':
        suggestedProps = {
          density: 7800, // kg/m³ (steel)
          friction: 0.3,
          restitution: 0.7,
          youngsModulus: 200e9 // 200 GPa (typical for steel)
        };
        break;
      case 'fabric':
        suggestedProps = {
          density: 300, // kg/m³
          friction: 0.8,
          restitution: 0.1,
          youngsModulus: 0.5e9 // 0.5 GPa (typical for fabric)
        };
        break;
      case 'glass':
        suggestedProps = {
          density: 2500, // kg/m³
          friction: 0.4,
          restitution: 0.9,
          youngsModulus: 70e9 // 70 GPa (typical for glass)
        };
        break;
      case 'stone':
        suggestedProps = {
          density: 2700, // kg/m³
          friction: 0.6,
          restitution: 0.2,
          youngsModulus: 50e9 // 50 GPa (typical for stone)
        };
        break;
      case 'plastic':
        suggestedProps = {
          density: 1000, // kg/m³
          friction: 0.4,
          restitution: 0.5,
          youngsModulus: 2e9 // 2 GPa (typical for plastic)
        };
        break;
      // Default properties for unknown materials
      default:
        suggestedProps = {
          density: 800, // kg/m³ (average)
          friction: 0.5,
          restitution: 0.4,
          youngsModulus: 10e9 // 10 GPa (middle ground)
        };
    }
    
    // Calculate mass if dimensions are provided
    if (dimensions && suggestedProps.density) {
      const { width, height, depth } = dimensions;
      const volume = width * height * depth;
      suggestedProps.mass = suggestedProps.density * volume;
    }
    
    // Update properties with suggestions (keeping unchanged properties)
    const updatedProps = {
      ...physicsProps,
      ...suggestedProps
    };
    
    setPhysicsProps(updatedProps);
    onChange(updatedProps);
  };
  
  return (
    <div className="physics-properties-editor" style={{
      padding: '15px',
      backgroundColor: '#f5f5f5',
      borderRadius: '8px',
      maxWidth: '400px'
    }}>
      <div className="header-with-actions" style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '15px'
      }}>
        <h3 style={{ margin: 0 }}>Physics Properties</h3>
        <div>
          <button
            onClick={validatePhysics}
            style={{
              marginRight: '10px',
              padding: '5px 10px',
              background: '#4CAF50',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            Validate
          </button>
          <button
            onClick={suggestPhysicsProperties}
            style={{
              padding: '5px 10px',
              background: '#2196F3',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            Suggest
          </button>
        </div>
      </div>
      
      {/* Basic physics properties */}
      <div className="basic-properties" style={{
        marginBottom: '15px',
        padding: '10px',
        backgroundColor: '#ffffff',
        borderRadius: '4px'
      }}>
        <h4 style={{ margin: '0 0 10px 0' }}>Basic Properties</h4>
        
        <div className="control-group" style={{ marginBottom: '10px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
            <label>Static Object</label>
            <input
              type="checkbox"
              name="isStatic"
              checked={physicsProps.isStatic}
              onChange={handlePropertyChange}
            />
          </div>
          <div style={{ fontSize: '0.8em', color: '#666' }}>
            Static objects don't move during physics simulation
          </div>
        </div>
        
        <div className="control-group" style={{ marginBottom: '10px' }}>
          <label>Mass (kg)</label>
          <input
            type="number"
            name="mass"
            min="0"
            step="0.1"
            value={physicsProps.mass}
            onChange={handlePropertyChange}
            disabled={physicsProps.isStatic}
            style={{
              width: '100%',
              padding: '5px',
              borderRadius: '4px',
              border: '1px solid #ccc',
              marginTop: '5px'
            }}
          />
        </div>
        
        <div className="control-group" style={{ marginBottom: '10px' }}>
          <label>Friction</label>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <input
              type="range"
              name="friction"
              min="0"
              max="1"
              step="0.01"
              value={physicsProps.friction}
              onChange={handlePropertyChange}
              style={{ flex: 1 }}
            />
            <span>{physicsProps.friction.toFixed(2)}</span>
          </div>
          <div style={{ fontSize: '0.8em', color: '#666' }}>
            Higher values mean more friction (0-1)
          </div>
        </div>
        
        <div className="control-group" style={{ marginBottom: '10px' }}>
          <label>Restitution (Bounciness)</label>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <input
              type="range"
              name="restitution"
              min="0"
              max="1"
              step="0.01"
              value={physicsProps.restitution}
              onChange={handlePropertyChange}
              style={{ flex: 1 }}
            />
            <span>{physicsProps.restitution.toFixed(2)}</span>
          </div>
          <div style={{ fontSize: '0.8em', color: '#666' }}>
            Higher values mean more bounce (0-1)
          </div>
        </div>
      </div>
      
      {/* Advanced physics properties */}
      <div className="advanced-properties" style={{
        marginBottom: '15px',
        padding: '10px',
        backgroundColor: '#ffffff',
        borderRadius: '4px'
      }}>
        <h4 style={{ margin: '0 0 10px 0', display: 'flex', justifyContent: 'space-between' }}>
          <span>Advanced Properties</span>
          <button
            onClick={() => {
              // Create reasonable center of mass if it doesn't exist
              const updatedProps = { ...physicsProps };
              if (!updatedProps.centerOfMass) {
                if (dimensions) {
                  const vector = new THREE.Vector3();
                  vector.set(0, dimensions.height * 0.4, 0);
                  updatedProps.centerOfMass = vector;
                } else {
                  const vector = new THREE.Vector3();
                  vector.set(0, 0.5, 0);
                  updatedProps.centerOfMass = vector;
                }
              }
              setPhysicsProps(updatedProps);
              onChange(updatedProps);
            }}
            style={{
              fontSize: '0.8em',
              padding: '3px 8px',
              background: '#eee',
              border: '1px solid #ccc',
              borderRadius: '3px',
              cursor: 'pointer'
            }}
          >
            Set defaults
          </button>
        </h4>
        
        {/* Center of Mass */}
        {physicsProps.centerOfMass && (
          <div className="control-group" style={{ marginBottom: '15px' }}>
            <label style={{ marginBottom: '5px', display: 'block' }}>Center of Mass</label>
            
            <div style={{ display: 'flex', gap: '10px', marginBottom: '5px' }}>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: '0.8em', marginBottom: '2px', display: 'block' }}>X</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                  <input
                    type="range"
                    min={dimensions ? -dimensions.width/2 : -1}
                    max={dimensions ? dimensions.width/2 : 1}
                    step="0.01"
                    value={physicsProps.centerOfMass.x}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleVectorChange('centerOfMass', 'x', parseFloat(e.target.value))}
                    style={{ flex: 1 }}
                  />
                  <span style={{ minWidth: '40px', textAlign: 'right' }}>
                    {physicsProps.centerOfMass.x.toFixed(2)}
                  </span>
                </div>
              </div>
            </div>
            
            <div style={{ display: 'flex', gap: '10px', marginBottom: '5px' }}>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: '0.8em', marginBottom: '2px', display: 'block' }}>Y (Height)</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                  <input
                    type="range"
                    min="0"
                    max={dimensions ? dimensions.height : 2}
                    step="0.01"
                    value={physicsProps.centerOfMass.y}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleVectorChange('centerOfMass', 'y', parseFloat(e.target.value))}
                    style={{ flex: 1 }}
                  />
                  <span style={{ minWidth: '40px', textAlign: 'right' }}>
                    {physicsProps.centerOfMass.y.toFixed(2)}
                  </span>
                </div>
              </div>
            </div>
            
            <div style={{ display: 'flex', gap: '10px' }}>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: '0.8em', marginBottom: '2px', display: 'block' }}>Z</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                  <input
                    type="range"
                    min={dimensions ? -dimensions.depth/2 : -1}
                    max={dimensions ? dimensions.depth/2 : 1}
                    step="0.01"
                    value={physicsProps.centerOfMass.z}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleVectorChange('centerOfMass', 'z', parseFloat(e.target.value))}
                    style={{ flex: 1 }}
                  />
                  <span style={{ minWidth: '40px', textAlign: 'right' }}>
                    {physicsProps.centerOfMass.z.toFixed(2)}
                  </span>
                </div>
              </div>
            </div>
            
            <div style={{ fontSize: '0.8em', color: '#666', marginTop: '5px' }}>
              Center of mass affects stability and tipping behavior
            </div>
          </div>
        )}
        
        {/* Material-specific properties */}
        <div className="control-group" style={{ marginBottom: '10px' }}>
          <label>Material Density (kg/m³)</label>
          <input
            type="number"
            name="density"
            min="0"
            step="10"
            value={physicsProps.density || 0}
            onChange={handlePropertyChange}
            style={{
              width: '100%',
              padding: '5px',
              borderRadius: '4px',
              border: '1px solid #ccc',
              marginTop: '5px'
            }}
          />
        </div>
        
        <div className="control-group" style={{ marginBottom: '10px' }}>
          <label>Surface Roughness</label>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <input
              type="range"
              name="surfaceRoughness"
              min="0"
              max="1"
              step="0.01"
              value={physicsProps.surfaceRoughness || 0}
              onChange={handlePropertyChange}
              style={{ flex: 1 }}
            />
            <span>{(physicsProps.surfaceRoughness || 0).toFixed(2)}</span>
          </div>
        </div>
      </div>
      
      {/* Validation results */}
      {validationResult && (
        <div className="validation-results" style={{
          padding: '10px',
          backgroundColor: validationResult.isValid ? '#e8f5e9' : '#ffebee',
          borderRadius: '4px',
          marginTop: '15px'
        }}>
          <h4 style={{ margin: '0 0 10px 0' }}>Validation Results</h4>
          
          {validationResult.stabilitySummary && (
            <div className="stability-summary" style={{ marginBottom: '10px' }}>
              <div style={{ marginBottom: '5px' }}>
                <span style={{ fontWeight: 'bold' }}>Stability Score: </span>
                <span>{Math.round(validationResult.stabilitySummary.stabilityScore)}/100</span>
              </div>
              
              <div className="stability-gauge" style={{
                height: '8px',
                backgroundColor: '#ddd',
                borderRadius: '4px',
                overflow: 'hidden',
                marginBottom: '10px'
              }}>
                <div style={{
                  height: '100%',
                  width: `${validationResult.stabilitySummary.stabilityScore}%`,
                  backgroundColor: validationResult.stabilitySummary.stabilityScore > 70 ? '#4CAF50' :
                                   validationResult.stabilitySummary.stabilityScore > 40 ? '#FFC107' : '#F44336',
                  borderRadius: '4px'
                }} />
              </div>
              
              <div style={{ fontSize: '0.9em' }}>
                <span style={{ fontWeight: 'bold' }}>Tipping Risk: </span>
                <span>{Math.round(validationResult.stabilitySummary.tippingRisk * 100)}%</span>
              </div>
            </div>
          )}
          
          {validationResult.issues.length > 0 && (
            <div className="issues" style={{ marginBottom: '10px' }}>
              <div style={{ fontWeight: 'bold', color: '#d32f2f' }}>Issues:</div>
              <ul style={{ margin: '5px 0', paddingLeft: '20px' }}>
                {validationResult.issues.map((issue, index) => (
                  <li key={index} style={{ marginBottom: '3px' }}>{issue}</li>
                ))}
              </ul>
            </div>
          )}
          
          {validationResult.warnings.length > 0 && (
            <div className="warnings">
              <div style={{ fontWeight: 'bold', color: '#f57c00' }}>Warnings:</div>
              <ul style={{ margin: '5px 0', paddingLeft: '20px' }}>
                {validationResult.warnings.map((warning, index) => (
                  <li key={index} style={{ marginBottom: '3px' }}>{warning}</li>
                ))}
              </ul>
            </div>
          )}
          
          {validationResult.isValid && validationResult.issues.length === 0 && validationResult.warnings.length === 0 && (
            <div style={{ color: '#2e7d32' }}>
              All physics properties are valid.
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default PhysicsPropertiesEditor;