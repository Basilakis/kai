// Type declarations for Material UI icons
import React from 'react';

/**
 * This file provides type declarations for both:
 * 1. Direct imports from @mui/icons-material
 * 2. Imports from the barrel file (mui-icons.ts)
 *
 * It allows TypeScript to recognize the icons regardless of how they are imported.
 * For example:
 * - import { Visibility } from '@mui/icons-material';
 * - import { VisibilityIcon } from './mui-icons';
 */

// Type for SVG icon props
interface SvgIconProps {
  className?: string;
  color?: 'inherit' | 'primary' | 'secondary' | 'action' | 'disabled' | 'error';
  fontSize?: 'inherit' | 'small' | 'medium' | 'large';
  htmlColor?: string;
  shapeRendering?: string;
  titleAccess?: string;
  viewBox?: string;
  sx?: any;
}

// Declarations for direct imports from @mui/icons-material
declare module '@mui/icons-material' {
  // Basic icons
  export const Add: React.ComponentType<SvgIconProps>;
  export const Delete: React.ComponentType<SvgIconProps>;
  export const Edit: React.ComponentType<SvgIconProps>;
  export const Refresh: React.ComponentType<SvgIconProps>;
  export const Search: React.ComponentType<SvgIconProps>;

  // Navigation and organization icons
  export const Bookmark: React.ComponentType<SvgIconProps>;
  export const CollectionsBookmark: React.ComponentType<SvgIconProps>;
  export const History: React.ComponentType<SvgIconProps>;
  export const Storage: React.ComponentType<SvgIconProps>;
  export const Category: React.ComponentType<SvgIconProps>;
  export const Link: React.ComponentType<SvgIconProps>;
  export const Folder: React.ComponentType<SvgIconProps>;
  export const ViewList: React.ComponentType<SvgIconProps>;

  // Action icons
  export const CloudUpload: React.ComponentType<SvgIconProps>;
  export const Assessment: React.ComponentType<SvgIconProps>;
  export const Loop: React.ComponentType<SvgIconProps>;
  export const NoteAdd: React.ComponentType<SvgIconProps>;
  export const Description: React.ComponentType<SvgIconProps>;
  export const PictureAsPdf: React.ComponentType<SvgIconProps>;
  export const Language: React.ComponentType<SvgIconProps>;
  export const Psychology: React.ComponentType<SvgIconProps>;
  export const Download: React.ComponentType<SvgIconProps>;
  export const UploadFile: React.ComponentType<SvgIconProps>;

  // Status and notification icons
  export const InfoOutlined: React.ComponentType<SvgIconProps>;
  export const ErrorOutline: React.ComponentType<SvgIconProps>;
  export const Done: React.ComponentType<SvgIconProps>;
  export const CheckCircle: React.ComponentType<SvgIconProps>;
  export const Info: React.ComponentType<SvgIconProps>;
  export const Warning: React.ComponentType<SvgIconProps>;

  // Media control icons
  export const Forward: React.ComponentType<SvgIconProps>;
  export const PlayArrow: React.ComponentType<SvgIconProps>;
  export const Stop: React.ComponentType<SvgIconProps>;

  // Device and tech icons
  export const Laptop: React.ComponentType<SvgIconProps>;
  export const Insights: React.ComponentType<SvgIconProps>;
  export const DataUsage: React.ComponentType<SvgIconProps>;
  export const Visibility: React.ComponentType<SvgIconProps>;
  export const Code: React.ComponentType<SvgIconProps>;
  export const CodeOutlined: React.ComponentType<SvgIconProps>;
  export const Settings: React.ComponentType<SvgIconProps>;

  // Misc icons
  export const LocalFlorist: React.ComponentType<SvgIconProps>;
  export const Wallpaper: React.ComponentType<SvgIconProps>;
  export const Lightbulb: React.ComponentType<SvgIconProps>;
  export const Weekend: React.ComponentType<SvgIconProps>;
  export const Palette: React.ComponentType<SvgIconProps>;
  export const Image: React.ComponentType<SvgIconProps>;
  export const Analytics: React.ComponentType<SvgIconProps>;
  export const BugReport: React.ComponentType<SvgIconProps>;
  export const Help: React.ComponentType<SvgIconProps>;
}

// Declarations for imports from the barrel file (mui-icons.ts)
declare module '*/mui-icons' {
  // Basic icons
  export const AddIcon: React.ComponentType<SvgIconProps>;
  export const DeleteIcon: React.ComponentType<SvgIconProps>;
  export const EditIcon: React.ComponentType<SvgIconProps>;
  export const RefreshIcon: React.ComponentType<SvgIconProps>;
  export const SearchIcon: React.ComponentType<SvgIconProps>;

  // Navigation and organization icons
  export const BookmarkIcon: React.ComponentType<SvgIconProps>;
  export const CollectionsBookmarkIcon: React.ComponentType<SvgIconProps>;
  export const HistoryIcon: React.ComponentType<SvgIconProps>;
  export const StorageIcon: React.ComponentType<SvgIconProps>;
  export const CategoryIcon: React.ComponentType<SvgIconProps>;
  export const LinkIcon: React.ComponentType<SvgIconProps>;
  export const FolderIcon: React.ComponentType<SvgIconProps>;
  export const ViewListIcon: React.ComponentType<SvgIconProps>;

  // Action icons
  export const CloudUploadIcon: React.ComponentType<SvgIconProps>;
  export const AssessmentIcon: React.ComponentType<SvgIconProps>;
  export const LoopIcon: React.ComponentType<SvgIconProps>;
  export const NoteAddIcon: React.ComponentType<SvgIconProps>;
  export const DescriptionIcon: React.ComponentType<SvgIconProps>;
  export const PictureAsPdfIcon: React.ComponentType<SvgIconProps>;
  export const LanguageIcon: React.ComponentType<SvgIconProps>;
  export const PsychologyIcon: React.ComponentType<SvgIconProps>;
  export const DownloadIcon: React.ComponentType<SvgIconProps>;
  export const UploadFileIcon: React.ComponentType<SvgIconProps>;

  // Status and notification icons
  export const InfoOutlinedIcon: React.ComponentType<SvgIconProps>;
  export const ErrorOutlineIcon: React.ComponentType<SvgIconProps>;
  export const DoneIcon: React.ComponentType<SvgIconProps>;
  export const CheckCircleIcon: React.ComponentType<SvgIconProps>;
  export const InfoIcon: React.ComponentType<SvgIconProps>;
  export const WarningIcon: React.ComponentType<SvgIconProps>;

  // Media control icons
  export const ForwardIcon: React.ComponentType<SvgIconProps>;
  export const PlayArrowIcon: React.ComponentType<SvgIconProps>;
  export const StopIcon: React.ComponentType<SvgIconProps>;

  // Device and tech icons
  export const LaptopIcon: React.ComponentType<SvgIconProps>;
  export const InsightsIcon: React.ComponentType<SvgIconProps>;
  export const DataUsageIcon: React.ComponentType<SvgIconProps>;
  export const VisibilityIcon: React.ComponentType<SvgIconProps>;
  export const CodeIcon: React.ComponentType<SvgIconProps>;
  export const CodeOutlinedIcon: React.ComponentType<SvgIconProps>;
  export const SettingsIcon: React.ComponentType<SvgIconProps>;

  // Misc icons
  export const LocalFloristIcon: React.ComponentType<SvgIconProps>;
  export const WallpaperIcon: React.ComponentType<SvgIconProps>;
  export const LightbulbIcon: React.ComponentType<SvgIconProps>;
  export const WeekendIcon: React.ComponentType<SvgIconProps>;
  export const PaletteIcon: React.ComponentType<SvgIconProps>;
  export const ImageIcon: React.ComponentType<SvgIconProps>;
  export const AnalyticsIcon: React.ComponentType<SvgIconProps>;
  export const BugReportIcon: React.ComponentType<SvgIconProps>;
  export const HelpIcon: React.ComponentType<SvgIconProps>;

  // Export SvgIconProps type
  export type { SvgIconProps };
}
