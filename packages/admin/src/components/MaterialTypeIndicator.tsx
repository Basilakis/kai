import React from 'react';
import { Chip, Tooltip, Box } from '@mui/material';
import { 
  Construction as TileIcon,
  Forest as WoodIcon,
  Lightbulb as LightingIcon,
  Chair as FurnitureIcon,
  Palette as DecorationIcon,
  Category as AllIcon
} from '@mui/icons-material';

// Define material types
export type MaterialType = 'tile' | 'wood' | 'lighting' | 'furniture' | 'decoration' | 'all';

// Material type options with labels and icons
export const MATERIAL_TYPE_CONFIG: Record<MaterialType, {
  label: string;
  icon: React.ReactNode;
  color: string;
  description: string;
}> = {
  'all': { 
    label: 'All Materials', 
    icon: <AllIcon fontSize="small" />, 
    color: '#607d8b',
    description: 'Common fields applicable to all material types'
  },
  'tile': { 
    label: 'Tile', 
    icon: <TileIcon fontSize="small" />, 
    color: '#2196f3',
    description: 'Ceramic, porcelain, mosaic, and other tile materials'
  },
  'wood': { 
    label: 'Wood', 
    icon: <WoodIcon fontSize="small" />, 
    color: '#8d6e63',
    description: 'Hardwood, engineered wood, laminate, and other wood materials'
  },
  'lighting': { 
    label: 'Lighting', 
    icon: <LightingIcon fontSize="small" />, 
    color: '#ffc107',
    description: 'Lamps, fixtures, and other lighting products'
  },
  'furniture': { 
    label: 'Furniture', 
    icon: <FurnitureIcon fontSize="small" />, 
    color: '#9c27b0',
    description: 'Chairs, tables, sofas, and other furniture'
  },
  'decoration': { 
    label: 'Decoration', 
    icon: <DecorationIcon fontSize="small" />, 
    color: '#4caf50',
    description: 'Decorative items like vases, artwork, and rugs'
  }
};

// Props for the MaterialTypeIndicator component
interface MaterialTypeIndicatorProps {
  materialType: MaterialType;
  size?: 'small' | 'medium';
  onClick?: () => void;
}

/**
 * MaterialTypeIndicator Component
 * 
 * A chip component that indicates the material type with an icon and color.
 */
const MaterialTypeIndicator: React.FC<MaterialTypeIndicatorProps> = ({
  materialType,
  size = 'small',
  onClick
}) => {
  const config = MATERIAL_TYPE_CONFIG[materialType] || MATERIAL_TYPE_CONFIG.all;
  
  return (
    <Tooltip title={config.description}>
      <Chip
        icon={config.icon}
        label={config.label}
        size={size}
        onClick={onClick}
        sx={{
          backgroundColor: `${config.color}20`,
          color: config.color,
          borderColor: config.color,
          '& .MuiChip-icon': {
            color: config.color
          }
        }}
        variant="outlined"
      />
    </Tooltip>
  );
};

/**
 * Determine material type from categories
 * 
 * @param categories Array of categories
 * @returns The material type or 'all' if not found
 */
export function getMaterialTypeFromCategories(categories: string[]): MaterialType {
  const materialTypes: MaterialType[] = ['tile', 'wood', 'lighting', 'furniture', 'decoration'];
  
  for (const type of materialTypes) {
    if (categories.includes(type)) {
      return type;
    }
  }
  
  return 'all';
}

export default MaterialTypeIndicator;
