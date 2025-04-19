import * as THREE from 'three';

// Extend Three.js material definitions
declare module 'three' {
  export class MeshPhysicalMaterial extends MeshStandardMaterial {
    constructor(parameters?: MeshPhysicalMaterialParameters);
    clearcoat: number;
    clearcoatRoughness: number;
    clearcoatMap: Texture | null;
    clearcoatRoughnessMap: Texture | null;
    clearcoatNormalMap: Texture | null;
    clearcoatNormalScale: Vector2;
    reflectivity: number;
    ior: number;
    sheen: number;
    sheenColor: Color;
    sheenColorMap: Texture | null;
    sheenRoughness: number;
    sheenRoughnessMap: Texture | null;
    transmission: number;
    transmissionMap: Texture | null;
    thickness: number;
    thicknessMap: Texture | null;
    attenuationColor: Color;
    attenuationDistance: number;
    specularIntensity: number;
    specularColor: Color;
    specularIntensityMap: Texture | null;
    specularColorMap: Texture | null;
  }

  export interface MeshPhysicalMaterialParameters extends MeshStandardMaterialParameters {
    clearcoat?: number;
    clearcoatRoughness?: number;
    clearcoatMap?: Texture | null;
    clearcoatRoughnessMap?: Texture | null;
    clearcoatNormalMap?: Texture | null;
    clearcoatNormalScale?: Vector2;
    reflectivity?: number;
    ior?: number;
    sheen?: number;
    sheenColor?: Color | string;
    sheenColorMap?: Texture | null;
    sheenRoughness?: number;
    sheenRoughnessMap?: Texture | null;
    transmission?: number;
    transmissionMap?: Texture | null;
    thickness?: number;
    thicknessMap?: Texture | null;
    attenuationColor?: Color | string;
    attenuationDistance?: number;
    specularIntensity?: number;
    specularColor?: Color | string;
    specularIntensityMap?: Texture | null;
    specularColorMap?: Texture | null;
  }

  export interface MeshStandardMaterial {
    aoMapIntensity: number;
    envMapIntensity: number;
  }
}