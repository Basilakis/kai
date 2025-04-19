import * as THREE from 'three';
// Use inline types to avoid import errors

/**
 * Custom shader implementation for rendering Gaussian Splatting models
 * This enables high-performance visualization of Gaussian primitives
 * with proper lighting and material properties
 */
export class GaussianSplattingShader {
  static readonly vertexShader = `
    attribute vec4 color;
    attribute vec3 scale;
    attribute vec4 rotation;
    attribute float opacity;
    
    uniform float pointScale;
    uniform float pointSizeMin;
    uniform float pointSizeMax;
    
    varying vec4 vColor;
    varying vec3 vNormal;
    varying vec3 vPosition;
    varying vec2 vUv;
    varying float vOpacity;
    
    // Quaternion rotation utility function
    vec3 applyQuaternion(vec3 v, vec4 q) {
      vec3 qv = vec3(q.x, q.y, q.z);
      float qs = q.w;
      return v + 2.0 * cross(qv, cross(qv, v) + qs * v);
    }
    
    void main() {
      vColor = color;
      vOpacity = opacity;
      
      // Apply scaling
      vec3 scaled = position * scale;
      
      // Apply rotation using quaternion
      vec3 rotated = applyQuaternion(scaled, rotation);
      
      // Project to screen space
      vec4 mvPosition = modelViewMatrix * vec4(rotated, 1.0);
      gl_Position = projectionMatrix * mvPosition;
      
      // Calculate normal in view space
      vNormal = normalMatrix * applyQuaternion(normal, rotation);
      
      // Save position for lighting calculations
      vPosition = mvPosition.xyz;
      
      // Calculate point size based on distance and scale factors
      float distanceToCamera = -mvPosition.z;
      float size = pointScale * scale.x / distanceToCamera;
      gl_PointSize = clamp(size, pointSizeMin, pointSizeMax);
      
      // Pass UV coordinates
      vUv = uv;
    }
  `;

  static readonly fragmentShader = `
    uniform sampler2D diffuseMap;
    uniform sampler2D normalMap;
    uniform sampler2D roughnessMap;
    uniform sampler2D metalnessMap;
    uniform vec3 lightPosition;
    uniform vec3 cameraPosition;
    uniform float useTexture;
    uniform vec3 ambient;
    
    varying vec4 vColor;
    varying vec3 vNormal;
    varying vec3 vPosition;
    varying vec2 vUv;
    varying float vOpacity;
    
    // PBR functions
    
    // Normal distribution function
    float D_GGX(float NoH, float roughness) {
      float alpha = roughness * roughness;
      float alpha2 = alpha * alpha;
      float NoH2 = NoH * NoH;
      float denom = NoH2 * (alpha2 - 1.0) + 1.0;
      return alpha2 / (3.14159265359 * denom * denom);
    }
    
    // Geometry function
    float G_Smith(float NoV, float NoL, float roughness) {
      float alpha = roughness * roughness;
      float k = alpha / 2.0;
      float vis1 = NoV / (NoV * (1.0 - k) + k);
      float vis2 = NoL / (NoL * (1.0 - k) + k);
      return vis1 * vis2;
    }
    
    // Fresnel term
    vec3 F_Schlick(float cosTheta, vec3 F0) {
      return F0 + (1.0 - F0) * pow(1.0 - cosTheta, 5.0);
    }
    
    void main() {
      // Discard points that fall outside of point sprite
      vec2 coord = gl_PointCoord - vec2(0.5);
      if(length(coord) > 0.5)
        discard;
      
      // Sample maps or use vertex attributes
      vec4 baseColor = mix(vColor, texture2D(diffuseMap, vUv), useTexture);
      vec3 normal = normalize(mix(vNormal, texture2D(normalMap, vUv).rgb * 2.0 - 1.0, useTexture));
      float roughness = mix(0.5, texture2D(roughnessMap, vUv).r, useTexture);
      float metalness = mix(0.0, texture2D(metalnessMap, vUv).r, useTexture);
      
      // Calculate lighting vectors
      vec3 lightDir = normalize(lightPosition - vPosition);
      vec3 viewDir = normalize(-vPosition);
      vec3 halfDir = normalize(lightDir + viewDir);
      
      // Dot products for lighting
      float NoL = max(dot(normal, lightDir), 0.0);
      float NoV = max(dot(normal, viewDir), 0.0);
      float NoH = max(dot(normal, halfDir), 0.0);
      float LoH = max(dot(lightDir, halfDir), 0.0);
      
      // PBR material properties
      vec3 F0 = mix(vec3(0.04), baseColor.rgb, metalness);
      
      // Calculate specular BRDF
      float D = D_GGX(NoH, roughness);
      float G = G_Smith(NoV, NoL, roughness);
      vec3 F = F_Schlick(LoH, F0);
      
      vec3 specular = D * G * F / (4.0 * NoV * NoL + 0.001);
      
      // Calculate diffuse BRDF (Lambert)
      vec3 diffuse = (1.0 - F) * (1.0 - metalness) * baseColor.rgb / 3.14159265359;
      
      // Combine lighting
      vec3 directLighting = (diffuse + specular) * NoL;
      
      // Add ambient light
      vec3 finalColor = directLighting + ambient * baseColor.rgb;
      
      // Apply gamma correction
      finalColor = pow(finalColor, vec3(1.0/2.2));
      
      // Output final color with opacity
      gl_FragColor = vec4(finalColor, baseColor.a * vOpacity);
    }
  `;

  // Material constructor for easy shader usage
  static createMaterial(
    options: {
      diffuseMap?: THREE.Texture;
      normalMap?: THREE.Texture;
      roughnessMap?: THREE.Texture;
      metalnessMap?: THREE.Texture;
      pointScale?: number;
      pointSizeMin?: number;
      pointSizeMax?: number;
      ambient?: THREE.Color;
      lightPosition?: THREE.Vector3;
      useTexture?: boolean;
    } = {}
  ): THREE.ShaderMaterial {
    const uniforms = {
      diffuseMap: { value: options.diffuseMap || new THREE.Texture() },
      normalMap: { value: options.normalMap || new THREE.Texture() },
      roughnessMap: { value: options.roughnessMap || new THREE.Texture() },
      metalnessMap: { value: options.metalnessMap || new THREE.Texture() },
      pointScale: { value: options.pointScale || 1.0 },
      pointSizeMin: { value: options.pointSizeMin || 1.0 },
      pointSizeMax: { value: options.pointSizeMax || 20.0 },
      ambient: { value: options.ambient || new THREE.Color(0x333333) },
      lightPosition: { value: options.lightPosition || new THREE.Vector3(10, 10, 10) },
      useTexture: { value: options.useTexture ? 1.0 : 0.0 }
    };

    return new THREE.ShaderMaterial({
      vertexShader: GaussianSplattingShader.vertexShader,
      fragmentShader: GaussianSplattingShader.fragmentShader,
      uniforms: uniforms,
      transparent: true,
      vertexColors: true,
      depthTest: true,
      depthWrite: false, // Better for transparent particles
      blending: THREE.NormalBlending
    });
  }
}

/**
 * Gaussian Primitives Buffer Geometry
 * Custom geometry for Gaussian Splatting with all required attributes
 */
export class GaussianPrimitivesGeometry extends THREE.BufferGeometry {
  constructor(
    positions: Float32Array, 
    colors: Float32Array, 
    scales: Float32Array, 
    rotations: Float32Array, 
    opacities: Float32Array,
    normals?: Float32Array,
    uvs?: Float32Array
  ) {
    super();
    
    // Use THREE namespace to access constructor and avoid type errors
    this.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    this.setAttribute('color', new THREE.BufferAttribute(colors, 4));
    this.setAttribute('scale', new THREE.BufferAttribute(scales, 3));
    this.setAttribute('rotation', new THREE.BufferAttribute(rotations, 4));
    this.setAttribute('opacity', new THREE.BufferAttribute(opacities, 1));
    
    if (normals) {
      this.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
    } else {
      // Default normals if not provided
      const defaultNormals = new Float32Array(positions.length);
      for (let i = 0; i < positions.length; i += 3) {
        defaultNormals[i] = 0;
        defaultNormals[i+1] = 0;
        defaultNormals[i+2] = 1;
      }
      this.setAttribute('normal', new THREE.BufferAttribute(defaultNormals, 3));
    }
    
    if (uvs) {
      this.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
    } else {
      // Default UVs if not provided
      const defaultUVs = new Float32Array(positions.length / 3 * 2);
      for (let i = 0; i < defaultUVs.length; i += 2) {
        defaultUVs[i] = 0.5;
        defaultUVs[i+1] = 0.5;
      }
      this.setAttribute('uv', new THREE.BufferAttribute(defaultUVs, 2));
    }
  }
}

/**
 * GaussianSplatting Material Adapter
 * Adapts standard PBR materials to work with Gaussian primitives
 */
export class GaussianSplattingMaterialAdapter {
  /**
   * Convert a standard Three.js material to a Gaussian-compatible shader material
   */
  static adaptMaterial(material: THREE.Material, options: any = {}): THREE.ShaderMaterial {
    let diffuseMap: THREE.Texture | undefined;
    let normalMap: THREE.Texture | undefined;
    let roughnessMap: THREE.Texture | undefined;
    let metalnessMap: THREE.Texture | undefined;
    let useTexture = false;
    
    // Extract textures from standard materials
    if (material instanceof THREE.MeshStandardMaterial) {
      diffuseMap = material.map || undefined;
      normalMap = material.normalMap || undefined;
      roughnessMap = material.roughnessMap || undefined;
      metalnessMap = material.metalnessMap || undefined;
      useTexture = !!diffuseMap;
      
      // Handle emissive property if available
      if ((material as any).emissive) {
        const emissiveColor = new THREE.Color();
        // Handle potential missing emissive property by capturing it in any
        emissiveColor.copy((material as any).emissive);
        options.ambient = options.ambient || emissiveColor;
      }
    }
    
    // Create shader material from converted properties
    return GaussianSplattingShader.createMaterial({
      diffuseMap,
      normalMap,
      roughnessMap,
      metalnessMap,
      useTexture,
      ...options
    });
  }
  
  /**
   * Apply material properties from MaterialX to Gaussian shader
   */
  static applyMaterialXProperties(
    shaderMaterial: THREE.ShaderMaterial, 
    materialXProperties: any
  ): void {
    // Map MaterialX properties to shader uniforms
    if (materialXProperties.baseColor) {
      const color = new THREE.Color(materialXProperties.baseColor[0]);
      if (materialXProperties.baseColor.length > 1) {
        // Access material color components safely
        color.r = materialXProperties.baseColor[0];
        color.g = materialXProperties.baseColor[1];
      }
      if (materialXProperties.baseColor.length > 2) {
        color.b = materialXProperties.baseColor[2];
      }
      shaderMaterial.uniforms.baseColor = { value: color };
    }
    
    if (materialXProperties.roughness !== undefined) {
      shaderMaterial.uniforms.roughnessValue = { value: materialXProperties.roughness };
    }
    
    if (materialXProperties.metalness !== undefined) {
      shaderMaterial.uniforms.metalnessValue = { value: materialXProperties.metalness };
    }
    
    // Apply any textures from MaterialX
    if (materialXProperties.diffuseMap) {
      const texture = new THREE.TextureLoader().load(materialXProperties.diffuseMap);
      shaderMaterial.uniforms.diffuseMap = { value: texture };
      shaderMaterial.uniforms.useTexture = { value: 1.0 };
    }
    
    if (materialXProperties.normalMap) {
      const texture = new THREE.TextureLoader().load(materialXProperties.normalMap);
      shaderMaterial.uniforms.normalMap = { value: texture };
    }
    
    if (materialXProperties.roughnessMap) {
      const texture = new THREE.TextureLoader().load(materialXProperties.roughnessMap);
      shaderMaterial.uniforms.roughnessMap = { value: texture };
    }
    
    if (materialXProperties.metalnessMap) {
      const texture = new THREE.TextureLoader().load(materialXProperties.metalnessMap);
      shaderMaterial.uniforms.metalnessMap = { value: texture };
    }
  }
}