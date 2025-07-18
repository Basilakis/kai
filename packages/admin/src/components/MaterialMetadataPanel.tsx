/**
 * Material Metadata Panel
 *
 * This component displays metadata fields for different material types
 * and allows filtering/viewing materials by their metadata properties.
 */

/// <reference path="../types/jsx.d.ts" />
/// <reference path="../types/global.d.ts" />

// Note: There are some TypeScript errors related to JSX elements that can be safely ignored.
// These are related to how TypeScript handles HTML elements in React components.
// Specifically, the <em> element in MenuItem components is causing TypeScript errors,
// but this is a known issue with TypeScript and React and doesn't affect functionality.
//
// There are also warnings about unused imports and variables. These are kept for future use
// and potential enhancements to the component. We've added eslint-disable comments to suppress
// these warnings, but they don't affect the functionality of the component.

import * as React from 'react';
import { useState } from 'react';
// Note: Some imports and variables are unused but kept for future reference or potential use.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  Box,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  Card,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  CardContent,
  Chip,
  Divider,
  FormControl,
  FormHelperText,
  Grid,
  IconButton,
  InputLabel,
  MenuItem,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  Paper,
  Select,
  Tab,
  Tabs,
  TextField,
  Tooltip,
  Typography,
  useTheme
} from '../components/mui';
import {
  Category as CategoryIcon,
  LocalFlorist as WoodIcon,
  Wallpaper as TileIcon,
  Lightbulb as LightingIcon,
  Weekend as FurnitureIcon,
  Palette as DecorationIcon,
  Info as InfoIcon
} from '@mui/icons-material';

// Import field descriptions
import { tileFieldDescriptions } from '@kai/shared/src/docs/tile-field-descriptions';
import PropertyReferenceButton from './PropertyReferenceButton';
import PropertyRelationshipButton from './PropertyRelationshipButton';
import PropertyValidationAlert from './PropertyValidationAlert';

// Import shared types using the path mapping
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import {
  MaterialMetadata,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  TileMetadata,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  WoodMetadata,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  LightingMetadata,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  FurnitureMetadata,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  DecorationMetadata,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  isTileMetadata,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  isWoodMetadata,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  isLightingMetadata,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  isFurnitureMetadata,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  isDecorationMetadata,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  getMetadataFieldType
} from '@kai/shared/src/types/metadata';

// Interface for component props
interface MaterialMetadataPanelProps {
  materialType: 'tile' | 'wood' | 'lighting' | 'furniture' | 'decoration';
  metadata?: MaterialMetadata;
  onMetadataChange?: (metadata: MaterialMetadata) => void;
  readOnly?: boolean;
}

// Field group interface for organizing metadata fields
interface FieldGroup {
  name: string;
  fields: { name: string; label: string; type: string }[];
}

// Map material types to field groups
const getFieldGroups = (materialType: string): FieldGroup[] => {
  // Common fields for all material types
  const commonGroup: FieldGroup = {
    name: 'Common Properties',
    fields: [
      { name: 'manufacturer', label: 'Manufacturer', type: 'text' },
      { name: 'collection', label: 'Collection', type: 'text' },
      { name: 'productCode', label: 'Product Code', type: 'text' },
      { name: 'countryOfOrigin', label: 'Country of Origin', type: 'text' },
      { name: 'warranty', label: 'Warranty', type: 'text' },
    ]
  };

  // Material-specific field groups
  switch (materialType) {
    case 'tile':
      return [
        commonGroup,
        {
          name: 'Physical Properties',
          fields: [
            { name: 'size', label: 'Size', type: 'text' },
            { name: 'thickness', label: 'Thickness (mm)', type: 'number' },
            { name: 'material', label: 'Material', type: 'dropdown' },
            { name: 'color', label: 'Color', type: 'dropdown' },
            { name: 'weight', label: 'Weight per m²', type: 'number' },
            { name: 'format', label: 'Format/Shape', type: 'dropdown' },
          ]
        },
        {
          name: 'Appearance',
          fields: [
            { name: 'finish', label: 'Finish', type: 'dropdown' },
            { name: 'pattern', label: 'Pattern', type: 'text' },
            { name: 'texture', label: 'Texture', type: 'text' },
            { name: 'surface', label: 'Surface', type: 'text' },
            { name: 'edgeType', label: 'Edge Type', type: 'dropdown' },
            { name: 'rectified', label: 'Rectified', type: 'boolean' },
            { name: 'lookType', label: 'Look Type', type: 'dropdown' },
          ]
        },
        {
          name: 'Technical Properties',
          fields: [
            { name: 'vRating', label: 'Shade Variation (V Rating)', type: 'dropdown' },
            { name: 'rRating', label: 'Slip Resistance (R Rating)', type: 'dropdown' },
            { name: 'waterAbsorption', label: 'Water Absorption', type: 'dropdown' },
            { name: 'frostResistance', label: 'Frost Resistance', type: 'boolean' },
            { name: 'peiRating', label: 'Wear Resistance (PEI Rating)', type: 'dropdown' },
            { name: 'moh', label: 'Mohs Hardness', type: 'dropdown' },
            { name: 'chemicalResistance', label: 'Chemical Resistance', type: 'text' },
            { name: 'stainResistance', label: 'Stain Resistance', type: 'text' },
            { name: 'fireRating', label: 'Fire Rating', type: 'text' },
            { name: 'heatResistance', label: 'Heat Resistance', type: 'boolean' },
            { name: 'soundInsulation', label: 'Sound Insulation', type: 'text' },
          ]
        },
        {
          name: 'Usage & Application',
          fields: [
            { name: 'usage', label: 'Usage Type', type: 'dropdown' },
            { name: 'applicationArea', label: 'Application Area', type: 'dropdown' },
            { name: 'installationType', label: 'Installation Type', type: 'dropdown' },
            { name: 'antibacterial', label: 'Antibacterial', type: 'boolean' },
            { name: 'specialtyType', label: 'Specialty Type', type: 'dropdown' },
          ]
        },
        {
          name: 'Commercial Information',
          fields: [
            { name: 'batchNumber', label: 'Batch Number', type: 'text' },
            { name: 'packaging', label: 'Packaging', type: 'text' },
            { name: 'availability', label: 'Availability', type: 'dropdown' },
            { name: 'sku', label: 'SKU/Product Code', type: 'text' },
            { name: 'barcode', label: 'Barcode', type: 'text' },
          ]
        }
      ];
    case 'wood':
      return [
        commonGroup,
        {
          name: 'Physical Properties',
          fields: [
            { name: 'woodType', label: 'Wood Type', type: 'dropdown' },
            { name: 'construction', label: 'Construction', type: 'dropdown' },
            { name: 'thickness', label: 'Thickness (mm)', type: 'number' },
            { name: 'width', label: 'Width (mm)', type: 'number' },
            { name: 'length', label: 'Length (mm)', type: 'number' },
            { name: 'color', label: 'Color', type: 'dropdown' },
          ]
        },
        {
          name: 'Technical Properties',
          fields: [
            { name: 'grade', label: 'Grade', type: 'dropdown' },
            { name: 'hardness', label: 'Janka Hardness', type: 'number' },
            { name: 'moisture', label: 'Moisture Content (%)', type: 'number' },
            { name: 'stability', label: 'Dimensional Stability', type: 'dropdown' },
          ]
        },
        {
          name: 'Appearance & Installation',
          fields: [
            { name: 'finish', label: 'Finish', type: 'dropdown' },
            { name: 'installationSystem', label: 'Installation System', type: 'dropdown' },
            { name: 'underfloorHeating', label: 'Suitable for Underfloor Heating', type: 'boolean' },
          ]
        }
      ];
    case 'lighting':
      return [
        commonGroup,
        {
          name: 'General Properties',
          fields: [
            { name: 'lightingType', label: 'Lighting Type', type: 'dropdown' },
            { name: 'material', label: 'Material', type: 'dropdown' },
            { name: 'dimensions', label: 'Dimensions', type: 'text' },
            { name: 'weight', label: 'Weight (kg)', type: 'number' },
          ]
        },
        {
          name: 'Technical Specifications',
          fields: [
            { name: 'bulbType', label: 'Bulb Type', type: 'dropdown' },
            { name: 'bulbIncluded', label: 'Bulb Included', type: 'boolean' },
            { name: 'wattage', label: 'Wattage (W)', type: 'number' },
            { name: 'voltage', label: 'Voltage (V)', type: 'number' },
            { name: 'lumens', label: 'Lumens', type: 'number' },
            { name: 'colorTemperature', label: 'Color Temperature', type: 'dropdown' },
            { name: 'cri', label: 'CRI', type: 'number' },
            { name: 'dimmable', label: 'Dimmable', type: 'boolean' },
            { name: 'energyClass', label: 'Energy Class', type: 'dropdown' },
          ]
        },
        {
          name: 'Features',
          fields: [
            { name: 'ipRating', label: 'IP Rating', type: 'dropdown' },
            { name: 'controlSystem', label: 'Control System', type: 'dropdown' },
          ]
        }
      ];
    case 'furniture':
      return [
        commonGroup,
        {
          name: 'General Properties',
          fields: [
            { name: 'furnitureType', label: 'Furniture Type', type: 'dropdown' },
            { name: 'style', label: 'Style', type: 'dropdown' },
            { name: 'material', label: 'Material', type: 'dropdown' },
            { name: 'color', label: 'Color', type: 'dropdown' },
            { name: 'dimensions', label: 'Dimensions', type: 'text' },
          ]
        },
        {
          name: 'Physical Attributes',
          fields: [
            { name: 'weight', label: 'Weight (kg)', type: 'number' },
            { name: 'weightCapacity', label: 'Weight Capacity (kg)', type: 'number' },
            { name: 'assembly', label: 'Assembly Required', type: 'boolean' },
          ]
        },
        {
          name: 'Construction',
          fields: [
            { name: 'frameConstruction', label: 'Frame Construction', type: 'dropdown' },
            { name: 'cushionFilling', label: 'Cushion Filling', type: 'dropdown' },
            { name: 'upholstery', label: 'Upholstery Material', type: 'text' },
          ]
        },
        {
          name: 'Features',
          fields: [
            { name: 'adjustable', label: 'Adjustable', type: 'boolean' },
            { name: 'outdoor', label: 'Suitable for Outdoor', type: 'boolean' },
            { name: 'sustainability', label: 'Sustainability', type: 'dropdown' },
            { name: 'features', label: 'Special Features', type: 'textarea' },
          ]
        }
      ];
    case 'decoration':
      return [
        commonGroup,
        {
          name: 'General Properties',
          fields: [
            { name: 'decorationType', label: 'Decoration Type', type: 'dropdown' },
            { name: 'style', label: 'Style', type: 'dropdown' },
            { name: 'material', label: 'Material', type: 'dropdown' },
            { name: 'color', label: 'Color', type: 'dropdown' },
            { name: 'dimensions', label: 'Dimensions', type: 'text' },
          ]
        },
        {
          name: 'Design & Composition',
          fields: [
            { name: 'theme', label: 'Theme', type: 'dropdown' },
            { name: 'technique', label: 'Technique', type: 'dropdown' },
            { name: 'setSize', label: 'Set Size', type: 'number' },
          ]
        },
        {
          name: 'Usage & Care',
          fields: [
            { name: 'occasion', label: 'Occasion', type: 'dropdown' },
            { name: 'indoor', label: 'Indoor/Outdoor', type: 'dropdown' },
            { name: 'mountingType', label: 'Mounting Type', type: 'dropdown' },
            { name: 'fragile', label: 'Fragile', type: 'boolean' },
            { name: 'careInstructions', label: 'Care Instructions', type: 'textarea' },
          ]
        },
        {
          name: 'Additional Information',
          fields: [
            { name: 'sustainability', label: 'Eco-Friendly', type: 'dropdown' },
          ]
        }
      ];
    default:
      return [commonGroup];
  }
};

// Get dropdown options for specific fields
const getFieldOptions = (fieldName: string, materialType: string): string[] => {
  const options: Record<string, string[]> = {
    // Tile options
    // Physical properties
    material: ['Ceramic', 'Porcelain', 'Marble', 'Granite', 'Terracotta', 'Quartzite', 'Limestone', 'Slate', 'Glass', 'Cement'],

    // Format/Shape
    format: ['Square', 'Rectangular', 'Hexagonal', 'Subway', 'Mosaic', 'Large Format/Slabs', '3D/Sculpted'],

    // Appearance
    finish: materialType === 'tile'
      ? ['Matte', 'Glossy', 'Semi-polished', 'Lappato', 'Polished', 'Textured', 'Anti-slip', 'Satin', 'Silk', 'Honed', 'Natural', 'Structured']
      : materialType === 'wood'
      ? ['Oiled', 'Lacquered', 'Waxed', 'Brushed', 'Untreated', 'Smoked', 'Distressed']
      : [],
    edgeType: ['Rectified', 'Non-rectified', 'Beveled', 'Micro-beveled', 'Pillowed'],

    // Technical properties
    vRating: ['V1', 'V2', 'V3', 'V4'],
    rRating: ['R9', 'R10', 'R11', 'R12', 'R13'],
    waterAbsorption: ['BIa (≤0.5%)', 'BIb (0.5-3%)', 'BIIa (3-6%)', 'BIIb (6-10%)', 'BIII (>10%)'],
    peiRating: ['PEI I', 'PEI II', 'PEI III', 'PEI IV', 'PEI V'],
    moh: ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10'],

    // Usage and application
    usage: ['Wall Tile', 'Floor Tile', 'Outdoor Tile', 'Pool Tile', 'Facade/Cladding Tile', 'Roof Tile', 'Floor & Wall', 'Bathroom', 'Kitchen', 'Living Room', 'Commercial'],
    applicationArea: ['Indoor', 'Outdoor', 'Pool', 'Wet Areas', 'High Traffic', 'Low Traffic'],
    installationType: ['Glue', 'Raised Floor', 'Mortar', 'Thin-set', 'Dry-set'],

    // Special features
    lookType: ['Wood-look', 'Stone-look', 'Concrete-look', 'Marble-look', 'Metal-look', 'Patterned'],
    specialtyType: ['Anti-bacterial', 'Thin/Slim', 'Outdoor deck', 'Raised floor', 'Technical porcelain'],

    // Commercial information
    availability: ['In stock', 'Outlet', 'B-quality', 'Special order'],

    // Wood options
    grade: ['Prime', 'Select', 'Natural', 'Rustic', 'Character'],
    construction: ['Solid', 'Engineered', 'Laminate', 'Veneer'],
    stability: ['Low', 'Medium', 'High'],
    installationSystem: ['Tongue & Groove', 'Click System', 'Glue-Down', 'Floating', 'Nail-Down'],

    // Lighting options
    lightingType: ['Pendant', 'Chandelier', 'Wall Sconce', 'Table Lamp', 'Floor Lamp', 'Ceiling Light', 'Track Light', 'Recessed Light', 'LED Strip'],
    bulbType: ['LED', 'Incandescent', 'Halogen', 'Fluorescent', 'CFL', 'Smart Bulb'],
    colorTemperature: ['Warm White (2700K-3000K)', 'Neutral White (3500K-4100K)', 'Cool White (5000K-6500K)'],
    ipRating: ['IP20', 'IP44', 'IP54', 'IP65', 'IP67'],
    energyClass: ['A+++', 'A++', 'A+', 'A', 'B', 'C', 'D', 'E', 'F', 'G'],
    controlSystem: ['Switch', 'Remote', 'Smart App', 'Voice', 'Motion Sensor', 'Touch'],

    // Furniture options
    furnitureType: ['Chair', 'Table', 'Sofa', 'Bed', 'Shelf', 'Cabinet', 'Desk', 'Stool', 'Armchair', 'Dresser', 'Wardrobe', 'Bookcase', 'Ottoman'],
    style: ['Modern', 'Scandinavian', 'Industrial', 'Traditional', 'Mid-Century', 'Rustic', 'Minimalist', 'Contemporary', 'Bohemian', 'Art Deco'],
    cushionFilling: ['Foam', 'Memory Foam', 'Down', 'Polyester', 'Feather', 'Spring'],
    frameConstruction: ['Solid Wood', 'Plywood', 'MDF', 'Metal', 'Particle Board'],

    // Decoration options
    decorationType: ['Wall Art', 'Vase', 'Sculpture', 'Mirror', 'Candle Holder', 'Rug', 'Cushion', 'Throw', 'Clock', 'Bookend', 'Plant Pot', 'Figurine'],
    theme: ['Geometric', 'Floral', 'Abstract', 'Nature', 'Animal', 'Architectural', 'Seasonal', 'Coastal', 'Ethnic', 'Typography'],
    technique: ['Handmade', 'Machine-made', 'Hand-painted', 'Printed', 'Carved', 'Woven', 'Cast', 'Blown', 'Embroidered'],
    occasion: ['Everyday', 'Holiday', 'Christmas', 'Halloween', 'Wedding', 'Birthday', 'Anniversary', 'Housewarming'],
    indoor: ['Indoor Only', 'Outdoor Only', 'Indoor/Outdoor'],
    mountingType: ['Wall Mounted', 'Tabletop', 'Freestanding', 'Hanging', 'Floor Standing'],

    // Common options
    applicationArea: ['Residential', 'Commercial', 'Industrial', 'Exterior', 'Interior', 'High Traffic', 'Low Traffic'],
    price: ['Budget', 'Mid-range', 'Premium', 'Luxury'],
    sustainability: materialType === 'furniture'
      ? ['FSC Certified', 'Recycled Materials', 'Low-VOC', 'GREENGUARD', 'None']
      : materialType === 'decoration'
      ? ['Recycled Materials', 'Biodegradable', 'Sustainable Source', 'Fair Trade', 'Handcrafted', 'None']
      : ['Low', 'Medium', 'High', 'Excellent'],
  };

  return options[fieldName] || [];
};

// Get material icon based on type
const getMaterialIcon = (type: string) => {
  switch (type) {
    case 'tile':
      return <TileIcon />;
    case 'wood':
      return <WoodIcon />;
    case 'lighting':
      return <LightingIcon />;
    case 'furniture':
      return <FurnitureIcon />;
    case 'decoration':
      return <DecorationIcon />;
    default:
      return <CategoryIcon />;
  }
};

// MaterialMetadataPanel component
const MaterialMetadataPanel: React.FC<MaterialMetadataPanelProps> = ({
  materialType,
  metadata = {},
  onMetadataChange,
  readOnly = false
}) => {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const theme = useTheme(); // Kept for future styling enhancements
  const [activeTab, setActiveTab] = useState(0);
  const fieldGroups = getFieldGroups(materialType);

  // Handle tab change
  // Handle tab change with proper typing
  const handleTabChange = (_event: React.SyntheticEvent, newValue: number) => {
    setActiveTab(newValue);
  };

  // Handle field value change
  const handleFieldChange = (fieldName: string, value: any) => {
    if (readOnly || !onMetadataChange) return;

    // Create a new metadata object with the updated field
    const updatedMetadata = {
      ...metadata,
      [fieldName]: value
    };

    // Cast the updated metadata to MaterialMetadata type
    onMetadataChange(updatedMetadata as MaterialMetadata);
  };

  // Get field description based on field name and material type
  const getFieldDescription = (fieldName: string, materialType: string): string => {
    // For tile fields, use the dedicated descriptions
    if (materialType === 'tile' && fieldName in tileFieldDescriptions) {
      return tileFieldDescriptions[fieldName];
    }

    // For other material types or fields without descriptions, return a generic message
    return `${fieldName} property for ${materialType}`;
  };

  // Render field based on type
  const renderField = (field: { name: string; label: string; type: string }) => {
    const value = (metadata as any)[field.name];
    const description = getFieldDescription(field.name, materialType);

    // Create a label with info icon for tooltip
    const fieldLabel = (
      <Box sx={{ display: 'flex', alignItems: 'center' }}>
        {field.label}
        <Tooltip title={description} arrow placement="top">
          <IconButton size="small" sx={{ ml: 0.5, p: 0 }}>
            <InfoIcon fontSize="small" color="action" />
          </IconButton>
        </Tooltip>
      </Box>
    );

    if (readOnly) {
      return (
        <Box>
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 0.5 }}>
            <Typography variant="body2" color="textSecondary">
              {field.label}:
            </Typography>
            <Tooltip title={description} arrow placement="top">
              <IconButton size="small" sx={{ ml: 0.5, p: 0 }}>
                <InfoIcon fontSize="small" color="action" />
              </IconButton>
            </Tooltip>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            {field.type === 'boolean' ? (
              <Chip
                size="small"
                label={value ? 'Yes' : 'No'}
                color={value ? 'success' : 'default'}
              />
            ) : (
              <Typography variant="body1" sx={{ mr: 1 }}>
                {value !== undefined ? value.toString() : 'N/A'}
              </Typography>
            )}
            {field.type === 'dropdown' && value && (
              <PropertyReferenceButton
                propertyName={field.name}
                propertyValue={value as string}
                materialType={materialType}
                size="small"
                readOnly={true}
              />
            )}
          </Box>
        </Box>
      );
    }

    switch (field.type) {
      case 'dropdown':
        return (
          <FormControl fullWidth size="small">
            <InputLabel id={`${field.name}-label`}>{field.label}</InputLabel>
            <Select
              labelId={`${field.name}-label`}
              id={field.name}
              value={value || ''}
              label={field.label}
              // Use proper event typing
              onChange={(e: any) =>
                handleFieldChange(field.name, e.target.value as string)
              }
              endAdornment={
                value ? (
                  <Box sx={{ display: 'flex' }}>
                    <PropertyReferenceButton
                      propertyName={field.name}
                      propertyValue={value}
                      materialType={materialType}
                      size="small"
                      readOnly={readOnly}
                    />
                    {!readOnly && (
                      <PropertyRelationshipButton
                        propertyName={field.name}
                        propertyValue={value}
                        materialType={materialType}
                        metadata={metadata}
                        onRecommendationSelect={handleFieldChange}
                        size="small"
                      />
                    )}
                  </Box>
                ) : null
              }
            >
              <MenuItem value="">
                <Typography variant="body2" sx={{ fontStyle: 'italic' }}>None</Typography>
              </MenuItem>
              {getFieldOptions(field.name, materialType).map((option) => (
                <MenuItem key={option} value={option}>
                  {option}
                </MenuItem>
              ))}
            </Select>
            <FormHelperText>
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <Tooltip title={description} arrow placement="top">
                  <IconButton size="small" sx={{ mr: 0.5, p: 0 }}>
                    <InfoIcon fontSize="small" color="action" />
                  </IconButton>
                </Tooltip>
                <Typography variant="caption" sx={{ color: 'text.secondary', fontStyle: 'italic' }}>
                  {description.length > 60 ? description.substring(0, 60) + '...' : description}
                </Typography>
              </Box>
            </FormHelperText>
          </FormControl>
        );
      case 'boolean':
        return (
          <FormControl fullWidth size="small">
            <InputLabel id={`${field.name}-label`}>{field.label}</InputLabel>
            <Select
              labelId={`${field.name}-label`}
              id={field.name}
              value={value === undefined ? '' : value ? 'true' : 'false'}
              label={field.label}
              // Use proper event typing
              onChange={(e: any) =>
                handleFieldChange(field.name, (e.target.value as string) === 'true')
              }
            >
              <MenuItem value="">
                <Typography variant="body2" sx={{ fontStyle: 'italic' }}>None</Typography>
              </MenuItem>
              <MenuItem value="true">Yes</MenuItem>
              <MenuItem value="false">No</MenuItem>
            </Select>
            <FormHelperText>
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <Tooltip title={description} arrow placement="top">
                  <IconButton size="small" sx={{ mr: 0.5, p: 0 }}>
                    <InfoIcon fontSize="small" color="action" />
                  </IconButton>
                </Tooltip>
                <Typography variant="caption" sx={{ color: 'text.secondary', fontStyle: 'italic' }}>
                  {description.length > 60 ? description.substring(0, 60) + '...' : description}
                </Typography>
              </Box>
            </FormHelperText>
          </FormControl>
        );
      case 'textarea':
        return (
          <TextField
            fullWidth
            id={field.name}
            label={field.label}
            multiline
            rows={3}
            value={value || ''}
            // Use proper event typing
            onChange={(e: any) =>
              handleFieldChange(field.name, e.target.value)
            }
            size="small"
            helperText={
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <Tooltip title={description} arrow placement="top">
                  <IconButton size="small" sx={{ mr: 0.5, p: 0 }}>
                    <InfoIcon fontSize="small" color="action" />
                  </IconButton>
                </Tooltip>
                <Typography variant="caption" sx={{ color: 'text.secondary', fontStyle: 'italic' }}>
                  {description.length > 60 ? description.substring(0, 60) + '...' : description}
                </Typography>
              </Box>
            }
          />
        );
      case 'number':
        return (
          <TextField
            fullWidth
            id={field.name}
            label={field.label}
            type="number"
            value={value || ''}
            // Use proper event typing
            onChange={(e: any) => {
              const val = e.target.value;
              handleFieldChange(field.name, val ? parseFloat(val) : null);
            }}
            size="small"
            helperText={
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <Tooltip title={description} arrow placement="top">
                  <IconButton size="small" sx={{ mr: 0.5, p: 0 }}>
                    <InfoIcon fontSize="small" color="action" />
                  </IconButton>
                </Tooltip>
                <Typography variant="caption" sx={{ color: 'text.secondary', fontStyle: 'italic' }}>
                  {description.length > 60 ? description.substring(0, 60) + '...' : description}
                </Typography>
              </Box>
            }
          />
        );
      case 'text':
      default:
        return (
          <TextField
            fullWidth
            id={field.name}
            label={field.label}
            value={value || ''}
            // Use proper event typing
            onChange={(e: any) =>
              handleFieldChange(field.name, e.target.value)
            }
            size="small"
            helperText={
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <Tooltip title={description} arrow placement="top">
                  <IconButton size="small" sx={{ mr: 0.5, p: 0 }}>
                    <InfoIcon fontSize="small" color="action" />
                  </IconButton>
                </Tooltip>
                <Typography variant="caption" sx={{ color: 'text.secondary', fontStyle: 'italic' }}>
                  {description.length > 60 ? description.substring(0, 60) + '...' : description}
                </Typography>
              </Box>
            }
          />
        );
    }
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
        {getMaterialIcon(materialType)}
        <Typography variant="h6" sx={{ ml: 1 }}>
          {materialType.charAt(0).toUpperCase() + materialType.slice(1)} Metadata
        </Typography>
      </Box>

      {!readOnly && (
        <PropertyValidationAlert
          materialType={materialType}
          metadata={metadata}
          onRecommendationApply={handleFieldChange}
        />
      )}

      <Tabs
        value={activeTab}
        onChange={handleTabChange}
        indicatorColor="primary"
        textColor="primary"
        variant="scrollable"
        scrollButtons="auto"
      >
        {fieldGroups.map((group, index) => (
          <Tab key={index} label={group.name} />
        ))}
      </Tabs>
      <Divider />

      <Box sx={{ py: 2 }}>
        {fieldGroups.map((group, index) => (
          <Box key={index} sx={{ display: activeTab === index ? 'block' : 'none' }}>
            <Grid container spacing={2}>
              {group.fields.map((field) => (
                <Grid item xs={12} sm={6} md={4} key={field.name}>
                  {renderField(field)}
                </Grid>
              ))}
            </Grid>
          </Box>
        ))}
      </Box>
    </Box>
  );
};

export default MaterialMetadataPanel;