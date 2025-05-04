import React, { useState, useEffect } from 'react';
import { 
  FormControl, 
  InputLabel, 
  Select, 
  MenuItem, 
  SelectChangeEvent,
  Chip,
  Box,
  Typography,
  Tooltip
} from '@mui/material';
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
export const MATERIAL_TYPE_OPTIONS: Array<{
  value: MaterialType;
  label: string;
  icon: React.ReactNode;
  color: string;
  description: string;
}> = [
  { 
    value: 'all', 
    label: 'All Materials', 
    icon: <AllIcon />, 
    color: '#607d8b',
    description: 'Common fields applicable to all material types'
  },
  { 
    value: 'tile', 
    label: 'Tile', 
    icon: <TileIcon />, 
    color: '#2196f3',
    description: 'Ceramic, porcelain, mosaic, and other tile materials'
  },
  { 
    value: 'wood', 
    label: 'Wood', 
    icon: <WoodIcon />, 
    color: '#8d6e63',
    description: 'Hardwood, engineered wood, laminate, and other wood materials'
  },
  { 
    value: 'lighting', 
    label: 'Lighting', 
    icon: <LightingIcon />, 
    color: '#ffc107',
    description: 'Lamps, fixtures, and other lighting products'
  },
  { 
    value: 'furniture', 
    label: 'Furniture', 
    icon: <FurnitureIcon />, 
    color: '#9c27b0',
    description: 'Chairs, tables, sofas, and other furniture'
  },
  { 
    value: 'decoration', 
    label: 'Decoration', 
    icon: <DecorationIcon />, 
    color: '#4caf50',
    description: 'Decorative items like vases, artwork, and rugs'
  }
];

// Get material type option by value
export const getMaterialTypeOption = (value: MaterialType) => {
  return MATERIAL_TYPE_OPTIONS.find(option => option.value === value) || MATERIAL_TYPE_OPTIONS[0];
};

// Material type chip component
export const MaterialTypeChip: React.FC<{
  materialType: MaterialType;
  size?: 'small' | 'medium';
  onClick?: () => void;
}> = ({ materialType, size = 'medium', onClick }) => {
  const option = getMaterialTypeOption(materialType);
  
  return (
    <Tooltip title={option.description}>
      <Chip
        icon={option.icon}
        label={option.label}
        size={size}
        onClick={onClick}
        sx={{
          backgroundColor: `${option.color}20`,
          color: option.color,
          borderColor: option.color,
          '& .MuiChip-icon': {
            color: option.color
          }
        }}
        variant="outlined"
      />
    </Tooltip>
  );
};

// Props for the MaterialTypeSelector component
interface MaterialTypeSelectorProps {
  value: MaterialType;
  onChange: (value: MaterialType) => void;
  label?: string;
  required?: boolean;
  disabled?: boolean;
  fullWidth?: boolean;
  multiple?: boolean;
  showDescription?: boolean;
  className?: string;
  size?: 'small' | 'medium';
}

/**
 * Material Type Selector Component
 * 
 * A dropdown selector for material types with icons and optional descriptions.
 */
const MaterialTypeSelector: React.FC<MaterialTypeSelectorProps> = ({
  value,
  onChange,
  label = 'Material Type',
  required = false,
  disabled = false,
  fullWidth = true,
  multiple = false,
  showDescription = false,
  className,
  size = 'medium'
}) => {
  // Handle change event
  const handleChange = (event: SelectChangeEvent<MaterialType>) => {
    onChange(event.target.value as MaterialType);
  };

  return (
    <FormControl 
      variant="outlined" 
      fullWidth={fullWidth} 
      required={required}
      disabled={disabled}
      className={className}
      size={size}
    >
      <InputLabel id="material-type-select-label">{label}</InputLabel>
      <Select
        labelId="material-type-select-label"
        id="material-type-select"
        value={value}
        onChange={handleChange}
        label={label}
      >
        {MATERIAL_TYPE_OPTIONS.map((option) => (
          <MenuItem key={option.value} value={option.value}>
            <Box sx={{ display: 'flex', alignItems: 'center' }}>
              <Box sx={{ mr: 1, color: option.color }}>{option.icon}</Box>
              <Box>
                <Typography variant="body1">{option.label}</Typography>
                {showDescription && (
                  <Typography variant="caption" color="textSecondary">
                    {option.description}
                  </Typography>
                )}
              </Box>
            </Box>
          </MenuItem>
        ))}
      </Select>
    </FormControl>
  );
};

export default MaterialTypeSelector;
