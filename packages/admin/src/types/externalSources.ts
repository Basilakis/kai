export type ExternalSourceType = string;

export interface ExternalSourceConfig {
  id: string;
  name: string;
  type: string;
  baseUrl: string;
  enabled: boolean;
  syncInterval: number;
  apiKey?: string;
  authentication?: {
    type: 'basic' | 'oauth' | 'api_key' | 'bearer';
    credentials?: Record<string, string>;
  };
}

export interface ExternalSourceStats {
  totalMaterials: number;
  lastSyncDuration?: number;
  lastSyncSuccess?: boolean;
  materialsCreated: number;
  materialsUpdated: number;
}

export interface ExternalSourceTimestamps {
  lastSyncTimestamp?: string;
  nextSyncTimestamp?: string;
}

export interface ExternalSource extends ExternalSourceConfig, ExternalSourceTimestamps {
  stats: ExternalSourceStats;
}

// Predefined source types (for reference only, actual types come from the database)
export const PREDEFINED_SOURCE_TYPES = {
  MATERIALS_PROJECT: 'materials_project',
  MATERIAL_DISTRICT: 'material_district',
  MATERNITY_DB: 'maternity_db',
  MATWEB: 'matweb',
  OPEN_MATERIAL_DB: 'open_material_db',
  ASTM_CONNECT: 'astm_connect',
  UL_PROSPECTOR: 'ul_prospector',
  GRANTA_DESIGN: 'granta_design',
  MATERIAL_CONNEXION: 'material_connexion',
  MATERIAL_DATABANK: 'material_databank',
  MATERIAL_EXCHANGE: 'material_exchange',
  RESEARCHGATE_MATERIALS: 'researchgate_materials',
  M_BASE: 'm_base',
  ASM_MATERIALS: 'asm_materials',
  IDEMAT: 'idemat',
  CES_SELECTOR: 'ces_selector',
  CUSTOM_API: 'custom_api'
} as const;