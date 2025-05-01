/// <reference path="../types/global.d.ts" />
/// <reference path="../types/jsx.d.ts" />
/// <reference path="../types/mui-icons.d.ts" />
/// <reference path="../types/mui.d.ts" />
/// <reference path="./mui.d.ts" />

import React from 'react';
import {
  Box,
  Button,
  Card,
  CardContent,
  CircularProgress,
  Container,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Divider,
  Grid,
  IconButton,
  LinearProgress,
  Paper,
  Tab,
  Tabs,
  TextField,
  Typography,
  FormControl,
  FormControlLabel,
  FormGroup,
  Switch,
  Chip,
  MenuItem,
  Select,
  InputLabel,
  Tooltip,
  Alert,
  AlertTitle
} from './mui';
// SxProps is now imported from mui.ts
import {
  AddIcon,
  DeleteIcon,
  EditIcon,
  RefreshIcon,
  SearchIcon,
  BookmarkIcon,
  CollectionsBookmarkIcon as CollectionIcon,
  HistoryIcon,
  StorageIcon,
  CloudUploadIcon,
  AssessmentIcon,
  LoopIcon,
  PictureAsPdfIcon as PdfIcon,
  LanguageIcon,
  PsychologyIcon,
  InfoOutlinedIcon as HelpIcon,
  BugReportIcon,
  DoneIcon as CheckCircleIcon,
  ForwardIcon as SendIcon,
  LaptopIcon as DeveloperModeIcon,
  InsightsIcon,
  DataUsageIcon,
  PlayArrowIcon,
  StopIcon,
  CategoryIcon
} from './mui-icons';
// Define the interface for our components
interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}
interface MaterialImage {
  url: string;
  alt?: string;
}

interface Material {
  id: string;
  name: string;
  manufacturer?: string;
  materialType: string;
  description?: string;
  tags?: string[];
  images?: MaterialImage[];
  confidence?: number;
  source?: string;
  metadata?: Record<string, any>;
  extractedFrom?: string;
  lastUpdated?: string;
  mlFeatures?: string[];
}

interface Series {
  id: string;
  name: string;
}

interface Collection {
  id: string;
  name: string;
  description?: string;
  materialCount: number;
  series?: Series[];
}

interface Version {
  id: string;
  entityId: string;
  entityType: string;
  versionNumber: number;
  changes: string;
  createdBy: string;
  createdAt: string;
}

interface MLModel {
  id: string;
  name: string;
  description: string;
  type: string;
  status: string;
  accuracy: number;
  lastTrained: string;
  knowledgeBaseCoverage: number;
}

interface PdfDocument {
  id: string;
  name: string;
  status: string;
  processingStatus: string;
  extractedEntities: number;
  confidence: number;
  lastProcessed: string;
}

interface WebSource {
  id: string;
  url: string;
  status: string;
  lastCrawled: string;
  extractedEntities: number;
  matchRate: number;
}

interface TrainingMetric {
  id: string;
  modelId: string;
  metricName: string;
  value: number;
  date: string;
}

// Interface for WebSocket training data
interface TrainingProgress {
  epoch: number;
  totalEpochs: number;
  loss: number;
  accuracy: number;
  valLoss?: number;
  valAccuracy?: number;
  step: number;
  totalSteps: number;
  learningRate: number;
  timeElapsed: number;
  timeRemaining: number;
  modelName: string;
  status: 'training' | 'paused' | 'completed' | 'error';
  metrics?: Record<string, number[]>;
  timestamp: number;
}

// Interface for epoch-specific data
interface EpochData {
  epoch: number;
  loss: number;
  accuracy: number;
  valLoss?: number;
  valAccuracy?: number;
}

interface UnknownAsset {
  id: string;
  name: string;
  imageUrl: string;
  source: string;
  processingDate: string;
  failureReason: string;
  confidence: number;
  suggestedTags?: string[];
  status: 'unidentified' | 'manually_identified' | 'resubmitted' | 'resolved';
  manualTags?: string[];
  notes?: string;
  categoryId?: string;
}

interface CommonItemProps {
  key?: string | number;
}

interface MaterialItemProps extends CommonItemProps {
  material: Material;
  onEdit: (item: Material) => void;
  onDelete: (item: Material) => void;
}

interface CollectionItemProps extends CommonItemProps {
  collection: Collection;
  onEdit: (item: Collection) => void;
  onDelete: (item: Collection) => void;
  onView: (item: Collection) => void;
}

interface FormDialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  onSubmit: () => void;
  submitLabel?: string;
}

// Tab Panel component for multi-tab layout
function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;

  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`kb-tabpanel-${index}`}
      aria-labelledby={`kb-tab-${index}`}
      {...other}
    >
      {value === index && (
        <Box sx={{ p: 3 }}>
          {children}
        </Box>
      )}
    </div>
  );
}

// Material Item component for rendering individual materials
const MaterialItem = ({ material, onEdit, onDelete }: MaterialItemProps) => {
  return (
    <Card sx={{ mb: 2 }}>
      <CardContent>
        <Grid container spacing={2}>
          <Grid item xs={12} sm={3}>
            {material.images && material.images.length > 0 ? (
              <img
                src={material.images[0].url}
                alt={material.name}
                style={{
                  width: '100%',
                  height: 'auto',
                  maxHeight: '150px',
                  objectFit: 'contain'
                }}
              />
            ) : (
              <Box
                sx={{
                  width: '100%',
                  height: '150px',
                  backgroundColor: '#f5f5f5',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                <Typography variant="body2" color="textSecondary">
                  No Image
                </Typography>
              </Box>
            )}
          </Grid>
          <Grid item xs={12} sm={7}>
            <Typography variant="h6" component="h3" gutterBottom>
              {material.name}
            </Typography>
            <Typography variant="body2" color="textSecondary" gutterBottom>
              {material.manufacturer || 'Unknown Manufacturer'} • {material.materialType}
            </Typography>
            <Typography variant="body2" paragraph>
              {material.description || 'No description available.'}
            </Typography>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
              {material.tags && material.tags.map((tag, index) => (
                <Box
                  key={index}
                  sx={{
                    backgroundColor: '#e0e0e0',
                    borderRadius: 1,
                    px: 1,
                    py: 0.5,
                    fontSize: '0.75rem'
                  }}
                >
                  {tag}
                </Box>
              ))}
            </Box>
            {material.source && (
              <Typography variant="caption" display="block" sx={{ mt: 1 }}>
                Source: {material.source}
                {material.confidence && ` • Confidence: ${material.confidence.toFixed(2)}%`}
              </Typography>
            )}
            {material.mlFeatures && material.mlFeatures.length > 0 && (
              <Box sx={{ mt: 1 }}>
                <Typography variant="caption" display="block" sx={{ mb: 0.5 }}>
                  ML Features:
                </Typography>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                  {material.mlFeatures.map((feature, index) => (
                    <Chip
                      key={index}
                      label={feature}
                      size="small"
                      color="primary"
                      variant="outlined"
                    />
                  ))}
                </Box>
              </Box>
            )}
          </Grid>
          <Grid item xs={12} sm={2} sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
            <IconButton onClick={() => onEdit(material)} size="small" sx={{ mb: 1 }}>
              <EditIcon />
            </IconButton>
            <IconButton onClick={() => onDelete(material)} size="small" color="error">
              <DeleteIcon />
            </IconButton>
          </Grid>
        </Grid>
      </CardContent>
    </Card>
  );
};

// Collection Item component for rendering collections
const CollectionItem = ({ collection, onEdit, onDelete, onView }: CollectionItemProps) => {
  return (
    <Card sx={{ mb: 2 }}>
      <CardContent>
        <Grid container spacing={2}>
          <Grid item xs={12} sm={10}>
            <Typography variant="h6" component="h3" gutterBottom>
              {collection.name}
            </Typography>
            <Typography variant="body2" color="textSecondary" gutterBottom>
              {collection.materialCount} materials • {collection.series?.length || 0} series
            </Typography>
            <Typography variant="body2" paragraph>
              {collection.description || 'No description available.'}
            </Typography>
          </Grid>
          <Grid item xs={12} sm={2} sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
            <Button variant="outlined" size="small" sx={{ mb: 1 }} onClick={() => onView(collection)}>
              View
            </Button>
            <IconButton onClick={() => onEdit(collection)} size="small" sx={{ mb: 1 }}>
              <EditIcon />
            </IconButton>
            <IconButton onClick={() => onDelete(collection)} size="small" color="error">
              <DeleteIcon />
            </IconButton>
          </Grid>
        </Grid>
      </CardContent>
    </Card>
  );
};

// Form Dialog component for reuse across different forms
// Note: This component is defined but not used in this file
// It's kept for future reference or potential use
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const _FormDialog = ({ open, onClose, title, children, onSubmit, submitLabel = 'Submit' }: FormDialogProps) => {
  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>{title}</DialogTitle>
      <DialogContent>
        {children}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button onClick={onSubmit} color="primary" variant="contained">
          {submitLabel}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

// Main Knowledge Base Dashboard Component
const KnowledgeBaseDashboard = () => {
  // State variables
  const [activeTab, setActiveTab] = React.useState(0);
  const [loading, setLoading] = React.useState(true);
  const [materials, setMaterials] = React.useState<Material[]>([]);
  const [collections, setCollections] = React.useState<Collection[]>([]);
  const [versions, setVersions] = React.useState<Version[]>([]);
  const [searchResults, setSearchResults] = React.useState<Material[]>([]);
  const [searchQuery, setSearchQuery] = React.useState('');
  const [showDialog, setShowDialog] = React.useState(false);
  const [dialogType, setDialogType] = React.useState('');
  const [selectedItem, setSelectedItem] = React.useState<Material | Collection | null>(null);

  // ML Integration States
  const [mlModels, setMlModels] = React.useState<MLModel[]>([]);
  const [pdfDocuments, setPdfDocuments] = React.useState<PdfDocument[]>([]);
  // These state variables are declared but not used in this component
  // They are kept for future implementation
  const [_webSources] = React.useState<WebSource[]>([]);
  const [_trainingMetrics] = React.useState<TrainingMetric[]>([]);
  const [showMlDialog, setShowMlDialog] = React.useState(false);
  const [mlDialogType, setMlDialogType] = React.useState('');
  const [mlIntegrationEnabled, setMlIntegrationEnabled] = React.useState(true);
  const [autoMetadataExtraction, setAutoMetadataExtraction] = React.useState(true);
  const [confidenceThreshold, setConfidenceThreshold] = React.useState(75);

  // WebSocket Training Visualization States
  const [trainingProgress, setTrainingProgress] = React.useState<TrainingProgress | null>(null);
  const [wsConnected, setWsConnected] = React.useState(false);
  const [wsError, setWsError] = React.useState<string | null>(null);
  const [showTrainingPanel, setShowTrainingPanel] = React.useState(false);
  const [epochHistory, setEpochHistory] = React.useState<EpochData[]>([]);
  const [liveMetrics, setLiveMetrics] = React.useState<Record<string, number[]>>({});
  const [wsServerUrl, setWsServerUrl] = React.useState<string>('ws://localhost:8765/training');
  const [isConnecting, setIsConnecting] = React.useState<boolean>(false);
  const [trainingControlsEnabled, setTrainingControlsEnabled] = React.useState<boolean>(true);
  const wsRef = React.useRef<WebSocket | null>(null);

  // Unknown Assets States
  const [unknownAssets, setUnknownAssets] = React.useState<UnknownAsset[]>([]);
  const [selectedUnknownAsset, setSelectedUnknownAsset] = React.useState<UnknownAsset | null>(null);
  const [showUnknownAssetDialog, setShowUnknownAssetDialog] = React.useState(false);
  const [unknownAssetDialogType, setUnknownAssetDialogType] = React.useState('');
  const [manualTags, setManualTags] = React.useState<string[]>([]);
  const [newTag, setNewTag] = React.useState('');
  const [assetNotes, setAssetNotes] = React.useState('');
  const [selectedCategory, setSelectedCategory] = React.useState('');
  const [resubmissionSuccess, setResubmissionSuccess] = React.useState(false);
  const [assetCategories] = React.useState(['Tile', 'Stone', 'Wood', 'Ceramic', 'Porcelain', 'Vinyl', 'Laminate', 'Other']);
  const [identificationStats, setIdentificationStats] = React.useState({
    totalUnidentified: 0,
    manuallyIdentified: 0,
    resubmitted: 0,
    pendingReview: 0,
    modelImprovementRate: 0
  });

  // Fetch initial data
  React.useEffect(() => {
    fetchData();
    fetchUnknownAssets();

    // Cleanup WebSocket connection on component unmount
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, []);

  // Handle tab change
  const handleTabChange = (_event: React.SyntheticEvent<Element, Event>, newValue: number) => {
    setActiveTab(newValue);
  };

  // Fetch all knowledge base data
  const fetchData = async () => {
    setLoading(true);
    try {
      // In a real implementation, these would be API calls

      // Fetch materials
      // const materialsResponse = await fetch('/api/admin/knowledge-base/materials');
      // const materialsData = await materialsResponse.json();
      // setMaterials(materialsData.materials);

      // Mock data for demo
      setMaterials([
        {
          id: '1',
          name: 'Marble Tile',
          manufacturer: 'Stone Works',
          materialType: 'tile',
          description: 'Luxurious marble tile for high-end applications',
          tags: ['marble', 'luxury', 'white', 'polished'],
          images: [{ url: 'https://via.placeholder.com/150x150' }],
          source: 'PDF Extraction',
          confidence: 92.5,
          mlFeatures: ['smooth texture', 'high reflectivity', 'natural veining']
        },
        {
          id: '2',
          name: 'Oak Hardwood',
          manufacturer: 'Wood Essentials',
          materialType: 'wood',
          description: 'Classic oak hardwood flooring with natural grain patterns',
          tags: ['oak', 'hardwood', 'natural', 'traditional'],
          images: [{ url: 'https://via.placeholder.com/150x150' }],
          source: 'Web Crawling',
          confidence: 88.7,
          mlFeatures: ['grain pattern', 'medium hardness', 'amber tone']
        }
      ]);

      // Fetch collections
      // const collectionsResponse = await fetch('/api/admin/knowledge-base/collections');
      // const collectionsData = await collectionsResponse.json();
      // setCollections(collectionsData.collections);

      // Mock data for demo
      setCollections([
        {
          id: '1',
          name: 'Luxe Collection',
          description: 'High-end luxury materials',
          materialCount: 25,
          series: [{id: '1', name: 'Marble Series'}, {id: '2', name: 'Gold Series'}]
        },
        {
          id: '2',
          name: 'Classic Woods',
          description: 'Traditional wood materials',
          materialCount: 18,
          series: [{id: '3', name: 'Oak Series'}, {id: '4', name: 'Walnut Series'}]
        }
      ]);

      // Fetch versions
      // const versionsResponse = await fetch('/api/admin/knowledge-base/versions');
      // const versionsData = await versionsResponse.json();
      // setVersions(versionsData.versions);

      // Mock data for demo
      setVersions([
        {
          id: '1',
          entityId: '1',
          entityType: 'material',
          versionNumber: 2,
          changes: 'Updated material specifications',
          createdBy: 'admin',
          createdAt: new Date(Date.now() - 86400000).toISOString() // 1 day ago
        },
        {
          id: '2',
          entityId: '1',
          entityType: 'collection',
          versionNumber: 1,
          changes: 'Created new collection',
          createdBy: 'admin',
          createdAt: new Date(Date.now() - 172800000).toISOString() // 2 days ago
        }
      ]);

      // Fetch ML models data
      setMlModels([
        {
          id: '1',
          name: 'Material Recognition v2',
          description: 'Recognizes materials from images',
          type: 'image-classification',
          status: 'active',
          accuracy: 92.7,
          lastTrained: new Date(Date.now() - 604800000).toISOString(), // 1 week ago
          knowledgeBaseCoverage: 85
        },
        {
          id: '2',
          name: 'Feature Extractor',
          description: 'Extracts material features from descriptions',
          type: 'nlp',
          status: 'active',
          accuracy: 89.3,
          lastTrained: new Date(Date.now() - 1209600000).toISOString(), // 2 weeks ago
          knowledgeBaseCoverage: 78
        }
      ]);

      // Fetch PDF documents
      setPdfDocuments([
        {
          id: '1',
          name: 'Stone Catalog 2023.pdf',
          status: 'processed',
          processingStatus: 'complete',
          extractedEntities: 47,
          confidence: 88.5,
          lastProcessed: new Date(Date.now() - 259200000).toISOString() // 3 days ago
        },
        {
          id: '2',
          name: 'Wood Flooring Guide.pdf',
          status: 'processing',
          processingStatus: '75%',
          extractedEntities: 26,
          confidence: 91.2,
          lastProcessed: new Date(Date.now() - 3600000).toISOString() // 1 hour ago
        }
      ]);

      // Mock web sources data
      const webSourcesData = [
        {
          id: '1',
          url: 'https://example.com/stone-materials',
          status: 'completed',
          lastCrawled: new Date(Date.now() - 172800000).toISOString(), // 2 days ago
          extractedEntities: 38,
          matchRate: 84.6
        },
        {
          id: '2',
          url: 'https://example.com/wood-catalog',
          status: 'scheduled',
          lastCrawled: new Date(Date.now() - 604800000).toISOString(), // 1 week ago
          extractedEntities: 52,
          matchRate: 91.3
        }
      ];
      console.log('Web sources data:', webSourcesData);

      // Mock training metrics data
      const trainingMetricsData = [
        {
          id: '1',
          modelId: '1',
          metricName: 'Precision',
          value: 0.94,
          date: new Date(Date.now() - 604800000).toISOString() // 1 week ago
        },
        {
          id: '2',
          modelId: '1',
          metricName: 'Recall',
          value: 0.89,
          date: new Date(Date.now() - 604800000).toISOString() // 1 week ago
        },
        {
          id: '3',
          modelId: '2',
          metricName: 'F1 Score',
          value: 0.91,
          date: new Date(Date.now() - 1209600000).toISOString() // 2 weeks ago
        }
      ];
      console.log('Training metrics data:', trainingMetricsData);

    } catch (error) {
      console.error('Error fetching knowledge base data:', error);
    } finally {
      setLoading(false);
    }
  };

  // Fetch unknown assets data
  const fetchUnknownAssets = async () => {
    setLoading(true);
    try {
      // In a real implementation, this would be an API call
      // const response = await fetch('/api/admin/knowledge-base/unknown-assets');
      // const data = await response.json();
      // setUnknownAssets(data.unknownAssets);

      // Mock data for unknown assets
      setUnknownAssets([
        {
          id: '1',
          name: 'Unknown Tile Pattern #1',
          imageUrl: 'https://via.placeholder.com/300x300',
          source: 'PDF Extraction',
          processingDate: new Date(Date.now() - 172800000).toISOString(), // 2 days ago
          failureReason: 'Low confidence score (45%)',
          confidence: 45,
          suggestedTags: ['pattern', 'geometric', 'gray'],
          status: 'unidentified'
        },
        {
          id: '2',
          name: 'Unrecognized Material #37',
          imageUrl: 'https://via.placeholder.com/300x300',
          source: 'Web Crawling',
          processingDate: new Date(Date.now() - 345600000).toISOString(), // 4 days ago
          failureReason: 'Multiple conflicting matches',
          confidence: 52,
          suggestedTags: ['stone', 'marble', 'white'],
          status: 'manually_identified',
          manualTags: ['travertine', 'natural stone', 'beige'],
          categoryId: 'Stone'
        },
        {
          id: '3',
          name: 'Ambiguous Material Sample',
          imageUrl: 'https://via.placeholder.com/300x300',
          source: 'User Upload',
          processingDate: new Date(Date.now() - 86400000).toISOString(), // 1 day ago
          failureReason: 'No similar patterns in database',
          confidence: 38,
          status: 'unidentified'
        },
        {
          id: '4',
          name: 'Resubmitted Pattern #14',
          imageUrl: 'https://via.placeholder.com/300x300',
          source: 'PDF Extraction',
          processingDate: new Date(Date.now() - 259200000).toISOString(), // 3 days ago
          failureReason: 'Image quality too low',
          confidence: 29,
          status: 'resubmitted',
          manualTags: ['ceramic', 'patterned', 'multi-color', 'mosaic'],
          categoryId: 'Ceramic',
          notes: 'This appears to be a mosaic ceramic tile with a complex pattern'
        },
        {
          id: '5',
          name: 'Resolved Material #22',
          imageUrl: 'https://via.placeholder.com/300x300',
          source: 'Web Crawling',
          processingDate: new Date(Date.now() - 518400000).toISOString(), // 6 days ago
          failureReason: 'Initially misclassified as wood',
          confidence: 61,
          status: 'resolved',
          manualTags: ['vinyl', 'wood-look', 'luxury vinyl tile'],
          categoryId: 'Vinyl',
          notes: 'This is a vinyl plank with wood appearance, not actual hardwood'
        }
      ]);

      // Set identification stats based on mock data
      setIdentificationStats({
        totalUnidentified: 12,
        manuallyIdentified: 8,
        resubmitted: 5,
        pendingReview: 2,
        modelImprovementRate: 24
      });

    } catch (error) {
      console.error('Error fetching unknown assets:', error);
    } finally {
      setLoading(false);
    }
  };

  // Handle searching the knowledge base
  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }

    setLoading(true);
    try {
      // In a real implementation, this would be an API call
      // const response = await fetch(`/api/admin/knowledge-base/search?query=${encodeURIComponent(searchQuery)}`);
      // const data = await response.json();
      // setSearchResults(data.results);

      // Mock search results
      setSearchResults(
        materials.filter(
          (material: Material) =>
            material.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            (material.description && material.description.toLowerCase().includes(searchQuery.toLowerCase())) ||
            (material.tags && material.tags.some((tag: string) => tag.toLowerCase().includes(searchQuery.toLowerCase())))
        )
      );
    } catch (error) {
      console.error('Error searching knowledge base:', error);
    } finally {
      setLoading(false);
    }
  };

  // Handle dialog for edit/delete operations
  const openDialog = (type: string, item: Material | Collection | null) => {
    setDialogType(type);
    setSelectedItem(item);
    setShowDialog(true);
  };

  const closeDialog = () => {
    setShowDialog(false);
    setSelectedItem(null);
  };

  const handleEdit = (item: Material | Collection) => {
    openDialog('edit', item);
  };

  const handleDelete = (item: Material | Collection) => {
    openDialog('delete', item);
  };

  const handleViewCollection = (collection: Collection) => {
    openDialog('view', collection);
  };

  const confirmDelete = async () => {
    if (!selectedItem) return;

    try {
      // In a real implementation, this would be an API call
      // await fetch(`/api/admin/knowledge-base/${selectedItem.type}/${selectedItem.id}`, {
      //   method: 'DELETE'
      // });

      // Update local state
      if ('materialType' in selectedItem) {
        setMaterials(materials.filter((m: Material) => m.id !== selectedItem.id));
      } else {
        setCollections(collections.filter((c: Collection) => c.id !== selectedItem.id));
      }

      closeDialog();
    } catch (error) {
      console.error('Error deleting item:', error);
    }
  };

  // Add new material or collection
  const handleAdd = (type: string) => {
    openDialog(`add_${type}`, null);
  };

  // ML Integration Handlers
  const openMlDialog = (type: string, item: any = null) => {
    setMlDialogType(type);
    // Use setSelectedItem instead of setSelectedMLItem
    setSelectedItem(item);
    setShowMlDialog(true);
  };

  const closeMlDialog = () => {
    setShowMlDialog(false);
    // Use setSelectedItem instead of setSelectedMLItem
    setSelectedItem(null);
  };

  const handleMlAction = async (action: 'train' | 'extract' | 'crawl' | 'analyze' | 'enhance-training' | 'process-pdf' | 'start-crawl') => {
    setLoading(true);
    try {
      // In a real implementation, these would be API calls
      // await fetch(`/api/admin/knowledge-base/ml/${action}`, {
      //   method: 'POST',
      //   body: JSON.stringify({ item: selectedMLItem })
      // });

      // Mock response with a delay
      await new Promise(resolve => setTimeout(resolve, 1000));

      closeMlDialog();
      fetchData(); // Refresh data
    } catch (error) {
      console.error(`Error performing ML action ${action}:`, error);
    } finally {
      setLoading(false);
    }
  };

  const handleMLSettingsChange = (setting: 'integration' | 'metadata' | 'threshold', value: boolean | number) => {
    if (setting === 'integration') {
      setMlIntegrationEnabled(value as boolean);
    } else if (setting === 'metadata') {
      setAutoMetadataExtraction(value as boolean);
    } else if (setting === 'threshold') {
      setConfidenceThreshold(value as number);
    }
  };

  // WebSocket connection handlers
  const connectToTrainingServer = React.useCallback(() => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      // Already connected
      return;
    }

    try {
      setIsConnecting(true);
      setWsError(null);

      console.log(`Connecting to WebSocket server at ${wsServerUrl}...`);
      const ws = new WebSocket(wsServerUrl);

      ws.onopen = () => {
        setWsConnected(true);
        setWsError(null);
        setIsConnecting(false);
        setShowTrainingPanel(true); // Automatically show panel on connection
        console.log('Connected to training WebSocket server');

        // Send an initial message to request current training status if any
        try {
          ws.send(JSON.stringify({
            type: 'getStatus',
            timestamp: Date.now()
          }));
        } catch (err) {
          console.warn('Could not send initial status request:', err);
        }
      };

      ws.onmessage = (event) => {
        try {
          const data: TrainingProgress = JSON.parse(event.data);
          setTrainingProgress(data);

          // Update epoch history if we have a new epoch
          if (data.epoch !== undefined && (epochHistory.length === 0 || epochHistory[epochHistory.length - 1].epoch < data.epoch)) {
            const newEpochData: EpochData = {
              epoch: data.epoch,
              loss: data.loss,
              accuracy: data.accuracy,
              valLoss: data.valLoss,
              valAccuracy: data.valAccuracy
            };

            setEpochHistory((prev: EpochData[]) => [...prev, newEpochData]);
          }

          // Update live metrics
          if (data.metrics) {
            setLiveMetrics(data.metrics);
          }

          // Update controls state based on training status
          setTrainingControlsEnabled(data.status === 'training');
        } catch (error) {
          console.error('Error parsing WebSocket message:', error);
        }
      };

      ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        setWsError('Failed to connect to training server. Please check if the server is running.');
        setWsConnected(false);
        setIsConnecting(false);
      };

      ws.onclose = (event) => {
        console.log(`Disconnected from training WebSocket server: ${event.code} ${event.reason}`);
        setWsConnected(false);
        setIsConnecting(false);

        // If unexpected closure, provide more detailed error
        if (event.code !== 1000) { // 1000 is normal closure
          setWsError(`Connection closed unexpectedly (${event.code}). ${event.reason || 'No reason provided.'}`);
        }
      };

      wsRef.current = ws;
    } catch (error) {
      console.error('Error connecting to WebSocket server:', error);
      setWsError('Failed to initiate connection to training server.');
      setWsConnected(false);
      setIsConnecting(false);
    }
  }, [epochHistory, wsServerUrl]);

  const disconnectFromTrainingServer = React.useCallback(() => {
    if (wsRef.current) {
      // Send a message to notify server about disconnection if needed
      try {
        wsRef.current.send(JSON.stringify({
          type: 'clientDisconnect',
          timestamp: Date.now()
        }));
      } catch (err) {
        console.warn('Could not send disconnect notification:', err);
      }

      // Close the connection with a normal closure code
      wsRef.current.close(1000, 'User initiated disconnect');
      wsRef.current = null;
      setWsConnected(false);
      setWsError(null);
    }
  }, []);

  // Send a command to the training server
  const sendTrainingCommand = React.useCallback((command: string) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      try {
        wsRef.current.send(JSON.stringify({
          type: 'command',
          command: command,
          timestamp: Date.now()
        }));

        console.log(`Sent command to training server: ${command}`);

        // Optimistically update UI based on command
        if (command === 'pause' && trainingProgress) {
          setTrainingProgress({
            ...trainingProgress,
            status: 'paused'
          });
          setTrainingControlsEnabled(false);
        } else if (command === 'resume' && trainingProgress) {
          setTrainingProgress({
            ...trainingProgress,
            status: 'training'
          });
          setTrainingControlsEnabled(true);
        } else if (command === 'stop' && trainingProgress) {
          setTrainingProgress({
            ...trainingProgress,
            status: 'completed'
          });
          setTrainingControlsEnabled(false);
        }
      } catch (error) {
        console.error('Error sending command to training server:', error);
        setWsError('Failed to send command to training server.');
      }
    } else {
      setWsError('Cannot send command: not connected to training server.');
    }
  }, [trainingProgress]);

  const toggleTrainingPanel = () => {
    setShowTrainingPanel((prev: boolean) => !prev);
  };

  const triggerMLTraining = () => {
    openMlDialog('training');
  };

  const processPDF = () => {
    openMlDialog('pdf');
  };

  const triggerWebCrawl = () => {
    openMlDialog('crawl');
  };

  // Calculate progress percentage for training
  const calculateProgress = (current: number, total: number): number => {
    return total > 0 ? Math.round((current / total) * 100) : 0;
  };

  // Format time in minutes and seconds
  const formatTime = (seconds: number): string => {
    if (seconds < 0) return "00:00";
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Unknown Asset Handlers
  const openUnknownAssetDialog = (type: string, asset: UnknownAsset | null = null) => {
    setUnknownAssetDialogType(type);
    setSelectedUnknownAsset(asset);

    if (asset && asset.manualTags) {
      setManualTags([...asset.manualTags]);
    } else {
      setManualTags([]);
    }

    if (asset && asset.notes) {
      setAssetNotes(asset.notes);
    } else {
      setAssetNotes('');
    }

    if (asset && asset.categoryId) {
      setSelectedCategory(asset.categoryId);
    } else {
      setSelectedCategory('');
    }

    setNewTag('');
    setShowUnknownAssetDialog(true);
  };

  const closeUnknownAssetDialog = () => {
    setShowUnknownAssetDialog(false);
    setSelectedUnknownAsset(null);
    setManualTags([]);
    setNewTag('');
    setAssetNotes('');
    setSelectedCategory('');
    setResubmissionSuccess(false);
  };

  const handleAddTag = () => {
    if (newTag.trim() && !manualTags.includes(newTag.trim())) {
      setManualTags([...manualTags, newTag.trim()]);
      setNewTag('');
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setManualTags(manualTags.filter((tag: string) => tag !== tagToRemove));
  };

  const handleNewTagKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && newTag.trim()) {
      e.preventDefault();
      handleAddTag();
    }
  };

  const handleIdentifyAsset = async () => {
    if (!selectedUnknownAsset || !selectedCategory || manualTags.length === 0) {
      return;
    }

    try {
      // In a real implementation, this would be an API call
      // await fetch(`/api/admin/knowledge-base/unknown-assets/${selectedUnknownAsset.id}/identify`, {
      //   method: 'POST',
      //   body: JSON.stringify({
      //     categoryId: selectedCategory,
      //     manualTags,
      //     notes: assetNotes
      //   })
      // });

      // Update the asset in the local state
      const updatedAssets = unknownAssets.map((asset: UnknownAsset) => {
        if (asset.id === selectedUnknownAsset.id) {
          return {
            ...asset,
            status: 'manually_identified' as const,
            manualTags,
            categoryId: selectedCategory,
            notes: assetNotes
          };
        }
        return asset;
      });

      setUnknownAssets(updatedAssets);

      // Update stats
      setIdentificationStats({
        ...identificationStats,
        manuallyIdentified: identificationStats.manuallyIdentified + 1,
        totalUnidentified: identificationStats.totalUnidentified - 1
      });

      closeUnknownAssetDialog();
    } catch (error) {
      console.error('Error identifying unknown asset:', error);
    }
  };

  const handleRebuildIndex = (indexType: 'text' | 'vector' | 'metadata') => {
    setLoading(true);
    try {
      // In a real implementation, this would be an API call
      // await fetch(`/api/admin/knowledge-base/index/${indexType}/rebuild`, {
      //   method: 'POST'
      // });

      // Mock response with a delay
      setTimeout(() => {
        setLoading(false);
        // Show a success message
        alert(`${indexType.charAt(0).toUpperCase() + indexType.slice(1)} index rebuild started successfully.`);
      }, 1000);
    } catch (error) {
      console.error(`Error rebuilding ${indexType} index:`, error);
      setLoading(false);
    }
  };

  const handleViewIndexStatus = (indexType: 'text' | 'vector' | 'metadata') => {
    // In a real implementation, this would navigate to a status page or open a modal
    // For now, just show an alert
    alert(`${indexType.charAt(0).toUpperCase() + indexType.slice(1)} index status: Active\nLast updated: ${new Date().toLocaleString()}\nDocument count: 1,245\nIndex size: 8.3 MB`);
  };

  const handleUnknownAssetAction = (action: 'identify' | 'resubmit' | 'ignore') => {
    if (action === 'identify' && selectedUnknownAsset) {
      handleIdentifyAsset();
    } else if (action === 'resubmit' && selectedUnknownAsset) {
      handleResubmitAsset();
    } else if (action === 'ignore' && selectedUnknownAsset) {
      // Mark the asset as ignored in a real implementation
      closeUnknownAssetDialog();
    }
  };

  const handleResubmitAsset = async () => {
    if (!selectedUnknownAsset) {
      return;
    }

    try {
      // In a real implementation, this would be an API call
      // await fetch(`/api/admin/knowledge-base/unknown-assets/${selectedUnknownAsset.id}/resubmit`, {
      //   method: 'POST'
      // });

      // Show success state first
      setResubmissionSuccess(true);

      // Wait a moment before closing dialog to show success message
      setTimeout(() => {
        // Update the asset in the local state
        const updatedAssets = unknownAssets.map((asset: UnknownAsset) => {
          if (asset.id === selectedUnknownAsset.id) {
            return {
              ...asset,
              status: 'resubmitted' as const
            };
          }
          return asset;
        });

        setUnknownAssets(updatedAssets);

        // Update stats
        setIdentificationStats({
          ...identificationStats,
          resubmitted: identificationStats.resubmitted + 1,
          manuallyIdentified: identificationStats.manuallyIdentified - 1,
          modelImprovementRate: identificationStats.modelImprovementRate + 2 // Simulate improvement
        });

        closeUnknownAssetDialog();
      }, 1500);
    } catch (error) {
      console.error('Error resubmitting asset for training:', error);
      setResubmissionSuccess(false);
    }
  };

  return (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" component="h1">
          Knowledge Base
        </Typography>
        <Box sx={{ display: 'flex', gap: 2 }}>
          <Button
            variant="outlined"
            color="primary"
            startIcon={<PsychologyIcon />}
            onClick={triggerMLTraining}
          >
            Train ML
          </Button>
          <Button
            variant="contained"
            color="primary"
            startIcon={<RefreshIcon />}
            onClick={fetchData}
          >
            Refresh
          </Button>
        </Box>
      </Box>

      {/* Stats cards */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Typography color="textSecondary" gutterBottom>
                Total Materials
              </Typography>
              <Typography variant="h5" component="div">
                {loading ? <CircularProgress size={20} /> : materials.length}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Typography color="textSecondary" gutterBottom>
                Collections
              </Typography>
              <Typography variant="h5" component="div">
                {loading ? <CircularProgress size={20} /> : collections.length}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Typography color="textSecondary" gutterBottom>
                Version History
              </Typography>
              <Typography variant="h5" component="div">
                {loading ? <CircularProgress size={20} /> : versions.length}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Typography color="textSecondary" gutterBottom>
                Last Updated
              </Typography>
              <Typography variant="h5" component="div">
                {loading ? <CircularProgress size={20} /> :
                  versions.length > 0 ?
                    new Date(versions[0].createdAt).toLocaleDateString() :
                    'Never'
                }
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Search box */}
      <Paper sx={{ p: 2, mb: 3 }}>
        <Grid container spacing={2} alignItems="center">
          <Grid item xs>
            <TextField
              fullWidth
              label="Search Knowledge Base"
              variant="outlined"
              value={searchQuery}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchQuery(e.target.value)}
              onKeyPress={(e: React.KeyboardEvent<HTMLInputElement>) => e.key === 'Enter' && handleSearch()}
            />
          </Grid>
          <Grid item>
            <Button
              variant="contained"
              color="primary"
              startIcon={<SearchIcon />}
              onClick={handleSearch}
            >
              Search
            </Button>
          </Grid>
        </Grid>

        {searchResults.length > 0 && (
          <Box sx={{ mt: 3 }}>
            <Typography variant="h6" gutterBottom>
              Search Results ({searchResults.length})
            </Typography>
            <Divider sx={{ mb: 2 }} />
            {searchResults.map((result: Material) => (
              <MaterialItem
                key={result.id}
                material={result}
                onEdit={handleEdit}
                onDelete={handleDelete}
              />
            ))}
          </Box>
        )}
      </Paper>

      {/* Tabs for different sections */}
      <Paper sx={{ width: '100%', mb: 2 }}>
        <Tabs
          value={activeTab}
          onChange={handleTabChange}
          indicatorColor="primary"
          textColor="primary"
          aria-label="knowledge base tabs"
          variant="scrollable"
          scrollButtons="auto"
        >
          <Tab icon={<BookmarkIcon />} label="Materials" id="kb-tab-0" aria-controls="kb-tabpanel-0" />
          <Tab icon={<CollectionIcon />} label="Collections" id="kb-tab-1" aria-controls="kb-tabpanel-1" />
          <Tab icon={<HistoryIcon />} label="Version History" id="kb-tab-2" aria-controls="kb-tabpanel-2" />
          <Tab icon={<StorageIcon />} label="Index Management" id="kb-tab-3" aria-controls="kb-tabpanel-3" />
          <Tab icon={<PsychologyIcon />} label="ML Integration" id="kb-tab-4" aria-controls="kb-tabpanel-4" />
          <Tab icon={<BugReportIcon />} label="Unknown Assets" id="kb-tab-5" aria-controls="kb-tabpanel-5" />
          <Tab icon={<CategoryIcon />} label="Categories" id="kb-tab-6" aria-controls="kb-tabpanel-6" />
        </Tabs>

        {/* Loading indicator */}
        {loading && <LinearProgress />}

        {/* Materials Tab */}
        <TabPanel value={activeTab} index={0}>
          <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 2 }}>
            <Button
              variant="contained"
              color="primary"
              startIcon={<AddIcon />}
              onClick={() => handleAdd('material')}
            >
              Add Material
            </Button>
          </Box>

          {materials.length === 0 ? (
            <Typography align="center" color="textSecondary" sx={{ py: 3 }}>
              No materials found. Add some to get started.
            </Typography>
          ) : (
            materials.map((material: Material) => (
              <MaterialItem
                key={material.id}
                material={material}
                onEdit={handleEdit}
                onDelete={handleDelete}
              />
            ))
          )}
        </TabPanel>

        {/* Collections Tab */}
        <TabPanel value={activeTab} index={1}>
          <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 2 }}>
            <Button
              variant="contained"
              color="primary"
              startIcon={<AddIcon />}
              onClick={() => handleAdd('collection')}
            >
              Add Collection
            </Button>
          </Box>

          {collections.length === 0 ? (
            <Typography align="center" color="textSecondary" sx={{ py: 3 }}>
              No collections found. Add some to get started.
            </Typography>
          ) : (
            collections.map((collection: Collection) => (
              <CollectionItem
                key={collection.id}
                collection={collection}
                onEdit={handleEdit}
                onDelete={handleDelete}
                onView={handleViewCollection}
              />
            ))
          )}
        </TabPanel>

        {/* Version History Tab */}
        <TabPanel value={activeTab} index={2}>
          {versions.length === 0 ? (
            <Typography align="center" color="textSecondary" sx={{ py: 3 }}>
              No version history available.
            </Typography>
          ) : (
            <Paper>
              <Box sx={{ p: 2 }}>
                <Typography variant="h6" gutterBottom>
                  Version History
                </Typography>
                <Divider sx={{ mb: 2 }} />

                {versions.map((version: Version) => (
                  <Box key={version.id} sx={{ mb: 2, p: 2, bgcolor: '#f5f5f5', borderRadius: 1 }}>
                    <Typography variant="subtitle1" gutterBottom>
                      Version {version.versionNumber} - {version.entityType.charAt(0).toUpperCase() + version.entityType.slice(1)} #{version.entityId}
                    </Typography>
                    <Typography variant="body2" color="textSecondary" gutterBottom>
                      {new Date(version.createdAt).toLocaleString()} by {version.createdBy}
                    </Typography>
                    <Typography variant="body2">
                      Changes: {version.changes}
                    </Typography>
                    <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 1 }}>
                      <Button size="small" variant="outlined">
                        Restore This Version
                      </Button>
                    </Box>
                  </Box>
                ))}
              </Box>
            </Paper>
          )}
        </TabPanel>

        {/* Index Management Tab */}
        <TabPanel value={activeTab} index={3}>
          <Paper>
            <Box sx={{ p: 2 }}>
              <Typography variant="h6" gutterBottom>
                Search Index Management
              </Typography>
              <Divider sx={{ mb: 2 }} />

              <Box sx={{ mb: 3 }}>
                <Typography variant="subtitle1" gutterBottom>
                  Text Search Index
                </Typography>
                <Typography variant="body2" paragraph>
                  The text search index powers keyword-based searches across the knowledge base.
                </Typography>
                <Button variant="outlined" color="primary" sx={{ mr: 1 }} onClick={() => handleRebuildIndex('text')}>
                  Rebuild Index
                </Button>
                <Button variant="outlined" onClick={() => handleViewIndexStatus('text')}>
                  View Status
                </Button>
              </Box>

              <Box sx={{ mb: 3 }}>
                <Typography variant="subtitle1" gutterBottom>
                  Vector Search Index
                </Typography>
                <Typography variant="body2" paragraph>
                  The vector search index powers similarity-based searches using embeddings.
                </Typography>
                <Button variant="outlined" color="primary" sx={{ mr: 1 }} onClick={() => handleRebuildIndex('vector')}>
                  Rebuild Vector Index
                </Button>
                <Button variant="outlined" onClick={() => handleViewIndexStatus('vector')}>
                  View Status
                </Button>
              </Box>

              <Box>
                <Typography variant="subtitle1" gutterBottom>
                  Metadata Search Index
                </Typography>
                <Typography variant="body2" paragraph>
                  The metadata search index powers faceted and filtered searches.
                </Typography>
                <Button variant="outlined" color="primary" sx={{ mr: 1 }} onClick={() => handleRebuildIndex('metadata')}>
                  Rebuild Metadata Index
                </Button>
                <Button variant="outlined" onClick={() => handleViewIndexStatus('metadata')}>
                  View Status
                </Button>
              </Box>
            </Box>
          </Paper>
        </TabPanel>

        {/* ML Integration Tab */}
        <TabPanel value={activeTab} index={4}>
          <Grid container spacing={3}>
            {/* ML Settings */}
            <Grid item xs={12}>
              <Paper sx={{ p: 2, mb: 3 }}>
                <Typography variant="h6" gutterBottom>
                  ML Integration Settings
                </Typography>
                <Divider sx={{ mb: 2 }} />

                <FormGroup>
                  <Grid container spacing={2}>
                    <Grid item xs={12} md={4}>
                      <FormControlLabel
                        control={
                          <Switch
                            checked={mlIntegrationEnabled}
                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleMLSettingsChange('integration', e.target.checked)}
                            name="ml-integration"
                            color="primary"
                          />
                        }
                        label="Enable ML Integration"
                      />
                      <Typography variant="caption" color="textSecondary">
                        Automatically connect ML models with knowledge base
                      </Typography>
                    </Grid>

                    <Grid item xs={12} md={4}>
                      <FormControlLabel
                        control={
                          <Switch
                            checked={autoMetadataExtraction}
                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleMLSettingsChange('metadata', e.target.checked)}
                            name="metadata-extraction"
                            color="primary"
                          />
                        }
                        label="Auto Metadata Extraction"
                      />
                      <Typography variant="caption" color="textSecondary">
                        Extract metadata from ML processing results
                      </Typography>
                    </Grid>

                    <Grid item xs={12} md={4}>
                      <Typography variant="body2" gutterBottom>
                        Confidence Threshold: {confidenceThreshold}%
                      </Typography>
                      <Box sx={{ width: '100%', px: 1 }}>
                        <input
                          type="range"
                          min="50"
                          max="95"
                          step="5"
                          value={confidenceThreshold}
                          onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleMLSettingsChange('threshold', parseInt(e.target.value))}
                          style={{ width: '100%' }}
                        />
                      </Box>
                      <Typography variant="caption" color="textSecondary">
                        Minimum confidence level for automatic integration
                      </Typography>
                    </Grid>
                  </Grid>
                </FormGroup>
              </Paper>
            </Grid>

            {/* Quick Actions */}
            <Grid item xs={12}>
              <Paper sx={{ p: 2, mb: 3 }}>
                <Typography variant="h6" gutterBottom>
                  ML Knowledge Base Actions
                </Typography>
                <Divider sx={{ mb: 2 }} />

                <Grid container spacing={2}>
                  <Grid item xs={12} md={4}>
                    <Card variant="outlined" sx={{ height: '100%' }}>
                      <CardContent>
                        <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                          <PdfIcon color="primary" sx={{ mr: 1 }} />
                          <Typography variant="h6">
                            PDF Integration
                          </Typography>
                        </Box>
                        <Typography variant="body2" sx={{ mb: 2 }}>
                          Extract knowledge from PDF documents using ML processing.
                        </Typography>
                        <Button
                          variant="contained"
                          startIcon={<CloudUploadIcon />}
                          onClick={processPDF}
                          fullWidth
                        >
                          Process PDF
                        </Button>
                      </CardContent>
                    </Card>
                  </Grid>

                  <Grid item xs={12} md={4}>
                    <Card variant="outlined" sx={{ height: '100%' }}>
                      <CardContent>
                        <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                          <LanguageIcon color="primary" sx={{ mr: 1 }} />
                          <Typography variant="h6">
                            Web Crawling
                          </Typography>
                        </Box>
                        <Typography variant="body2" sx={{ mb: 2 }}>
                          Extract structured knowledge from websites and web catalogs.
                        </Typography>
                        <Button
                          variant="contained"
                          startIcon={<SearchIcon />}
                          onClick={triggerWebCrawl}
                          fullWidth
                        >
                          Start Crawling
                        </Button>
                      </CardContent>
                    </Card>
                  </Grid>

                  <Grid item xs={12} md={4}>
                    <Card variant="outlined" sx={{ height: '100%' }}>
                      <CardContent>
                        <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                          <LoopIcon color="primary" sx={{ mr: 1 }} />
                          <Typography variant="h6">
                            Training Enhancement
                          </Typography>
                        </Box>
                        <Typography variant="body2" sx={{ mb: 2 }}>
                          Improve ML models using knowledge base data for better accuracy.
                        </Typography>
                        <Button
                          variant="contained"
                          startIcon={<AssessmentIcon />}
                          onClick={triggerMLTraining}
                          fullWidth
                        >
                          Enhance Models
                        </Button>
                      </CardContent>
                    </Card>
                  </Grid>
                </Grid>
              </Paper>
            </Grid>

          {/* WebSocket Training Visualization Panel */}
          <Grid item xs={12}>
            <Paper sx={{ p: 2, mb: 3 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                  <InsightsIcon color="primary" sx={{ mr: 1 }} />
                  <Typography variant="h6">
                    Live Training Visualization
                  </Typography>
                </Box>
                <Box>
                  {wsConnected ? (
                    <Button
                      variant="outlined"
                      color="error"
                      startIcon={<StopIcon />}
                      onClick={disconnectFromTrainingServer}
                      size="small"
                    >
                      Disconnect
                    </Button>
                  ) : (
                    <Button
                      variant="contained"
                      color="primary"
                      startIcon={<PlayArrowIcon />}
                      onClick={connectToTrainingServer}
                      size="small"
                      disabled={isConnecting}
                    >
                      {isConnecting ? 'Connecting...' : 'Connect to Training Server'}
                    </Button>
                  )}

                  <Button
                    variant="text"
                    sx={{ ml: 1 }}
                    onClick={toggleTrainingPanel}
                    size="small"
                  >
                    {showTrainingPanel ? 'Hide Panel' : 'Show Panel'}
                  </Button>
                </Box>
              </Box>

              {/* Server URL Configuration */}
              <Box sx={{ mb: 2, display: 'flex', alignItems: 'flex-end' }}>
                <TextField
                  label="WebSocket Server URL"
                  variant="standard"
                  value={wsServerUrl}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setWsServerUrl(e.target.value)}
                  disabled={wsConnected}
                  fullWidth
                  sx={{ mr: 2 }}
                  helperText="Enter the WebSocket server URL for training data"
                />

                <Tooltip title="Reset to default URL">
                  <IconButton
                    onClick={() => setWsServerUrl('ws://localhost:8765/training')}
                    disabled={wsConnected || wsServerUrl === 'ws://localhost:8765/training'}
                    size="small"
                  >
                    <RefreshIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              </Box>

              {/* Connection Status */}
              <Box sx={{ mb: 2 }}>
                {isConnecting && (
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                    <CircularProgress size={16} sx={{ mr: 1 }} />
                    <Typography variant="body2" color="primary">
                      Connecting to {wsServerUrl}...
                    </Typography>
                  </Box>
                )}

                {wsError && (
                  <Alert severity="error" sx={{ mb: 1 }}>
                    <AlertTitle>Connection Error</AlertTitle>
                    {wsError}
                  </Alert>
                )}

                {wsConnected && (
                  <Alert severity="success" sx={{ mb: 1 }} icon={<CheckCircleIcon />}>
                    <AlertTitle>Connected</AlertTitle>
                    Successfully connected to training server at {wsServerUrl}
                  </Alert>
                )}
              </Box>

              {showTrainingPanel && (
                <>
                  {trainingProgress ? (
                    <Box>
                      <Paper variant="outlined" sx={{ p: 2, mb: 3, bgcolor: '#f8f9fa', borderRadius: 2 }}>
                        <Grid container spacing={2} sx={{ mb: 2 }}>
                          <Grid item xs={12} md={4}>
                            <Typography variant="subtitle1" gutterBottom>
                              <Typography component="span" fontWeight="bold">Model:</Typography> {trainingProgress.modelName}
                            </Typography>
                            <Box sx={{ display: 'flex', alignItems: 'center' }}>
                              <Typography variant="body2" sx={{ mr: 1 }}>Status:</Typography>
                              <Chip
                                label={trainingProgress.status}
                                color={
                                  trainingProgress.status === 'training' ? 'primary' :
                                  trainingProgress.status === 'completed' ? 'success' :
                                  trainingProgress.status === 'paused' ? 'warning' :
                                  trainingProgress.status === 'error' ? 'error' :
                                  'default'
                                }
                                size="small"
                                sx={{ textTransform: 'capitalize' }}
                              />
                            </Box>
                          </Grid>
                          <Grid item xs={12} md={4}>
                            <Typography variant="body2" gutterBottom>
                              <Typography component="span" fontWeight="bold">Epoch Progress:</Typography> {trainingProgress.epoch} / {trainingProgress.totalEpochs}
                            </Typography>
                            <Box sx={{ display: 'flex', alignItems: 'center' }}>
                              <LinearProgress
                                variant="determinate"
                                value={calculateProgress(trainingProgress.epoch, trainingProgress.totalEpochs)}
                                sx={{ flexGrow: 1, height: 10, borderRadius: 5, mr: 1 }}
                              />
                              <Typography variant="caption">
                                {calculateProgress(trainingProgress.epoch, trainingProgress.totalEpochs)}%
                              </Typography>
                            </Box>
                          </Grid>
                          <Grid item xs={12} md={4}>
                            <Typography variant="body2" gutterBottom>
                              <Typography component="span" fontWeight="bold">Batch Progress:</Typography> {trainingProgress.step} / {trainingProgress.totalSteps}
                            </Typography>
                            <Box sx={{ display: 'flex', alignItems: 'center' }}>
                              <LinearProgress
                                variant="determinate"
                                value={calculateProgress(trainingProgress.step, trainingProgress.totalSteps)}
                                sx={{ flexGrow: 1, height: 10, borderRadius: 5, mr: 1 }}
                              />
                              <Typography variant="caption">
                                {calculateProgress(trainingProgress.step, trainingProgress.totalSteps)}%
                              </Typography>
                            </Box>
                          </Grid>
                        </Grid>

                        {/* Training Controls */}
                        <Box sx={{ display: 'flex', justifyContent: 'center', mb: 2 }}>
                          <Button
                            variant="contained"
                            color="primary"
                            startIcon={<PlayArrowIcon />}
                            sx={{ mx: 1 }}
                            disabled={!wsConnected || trainingProgress.status !== 'paused' || !trainingControlsEnabled}
                            onClick={() => sendTrainingCommand('resume')}
                          >
                            Resume
                          </Button>
                          <Button
                            variant="contained"
                            color="warning"
                            startIcon={<StopIcon />}
                            sx={{ mx: 1 }}
                            disabled={!wsConnected || trainingProgress.status !== 'training' || !trainingControlsEnabled}
                            onClick={() => sendTrainingCommand('pause')}
                          >
                            Pause
                          </Button>
                          <Button
                            variant="contained"
                            color="error"
                            startIcon={<StopIcon />}
                            sx={{ mx: 1 }}
                            disabled={!wsConnected || (trainingProgress.status !== 'training' && trainingProgress.status !== 'paused')}
                            onClick={() => sendTrainingCommand('stop')}
                          >
                            Stop
                          </Button>
                        </Box>
                      </Paper>

                      <Grid container spacing={2} sx={{ mb: 3 }}>
                        <Grid item xs={6} sm={3}>
                          <Card elevation={3} sx={{ p: 2, textAlign: 'center', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                            <Typography variant="body2" color="textSecondary" gutterBottom>
                              Current Loss
                            </Typography>
                            <Typography variant="h5" color={trainingProgress.loss < 0.1 ? 'success.main' : 'primary.main'}>
                              {trainingProgress.loss.toFixed(4)}
                            </Typography>
                            {epochHistory.length > 1 && (
                              <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', mt: 1 }}>
                                <Typography variant="caption" color={
                                  trainingProgress.loss < epochHistory[epochHistory.length - 2].loss
                                    ? 'success.main'
                                    : 'error.main'
                                }>
                                  {trainingProgress.loss < epochHistory[epochHistory.length - 2].loss
                                    ? '▼ Decreasing'
                                    : '▲ Increasing'}
                                </Typography>
                              </Box>
                            )}
                          </Card>
                        </Grid>
                        <Grid item xs={6} sm={3}>
                          <Card elevation={3} sx={{ p: 2, textAlign: 'center', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                            <Typography variant="body2" color="textSecondary" gutterBottom>
                              Current Accuracy
                            </Typography>
                            <Typography variant="h5" color={trainingProgress.accuracy > 0.9 ? 'success.main' : 'primary.main'}>
                              {(trainingProgress.accuracy * 100).toFixed(2)}%
                            </Typography>
                            {epochHistory.length > 1 && (
                              <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', mt: 1 }}>
                                <Typography variant="caption" color={
                                  trainingProgress.accuracy > epochHistory[epochHistory.length - 2].accuracy
                                    ? 'success.main'
                                    : 'error.main'
                                }>
                                  {trainingProgress.accuracy > epochHistory[epochHistory.length - 2].accuracy
                                    ? '▲ Improving'
                                    : '▼ Decreasing'}
                                </Typography>
                              </Box>
                            )}
                          </Card>
                        </Grid>
                        <Grid item xs={6} sm={3}>
                          <Card elevation={3} sx={{ p: 2, textAlign: 'center', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                            <Typography variant="body2" color="textSecondary" gutterBottom>
                              Time Elapsed
                            </Typography>
                            <Typography variant="h5">
                              {formatTime(trainingProgress.timeElapsed)}
                            </Typography>
                            <Typography variant="caption" color="textSecondary" sx={{ mt: 1 }}>
                              Started {new Date(Date.now() - trainingProgress.timeElapsed * 1000).toLocaleTimeString()}
                            </Typography>
                          </Card>
                        </Grid>
                        <Grid item xs={6} sm={3}>
                          <Card elevation={3} sx={{ p: 2, textAlign: 'center', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                            <Typography variant="body2" color="textSecondary" gutterBottom>
                              Estimated Completion
                            </Typography>
                            <Typography variant="h5">
                              {formatTime(trainingProgress.timeRemaining)}
                            </Typography>
                            <Typography variant="caption" color="textSecondary" sx={{ mt: 1 }}>
                              Expected {new Date(Date.now() + trainingProgress.timeRemaining * 1000).toLocaleTimeString()}
                            </Typography>
                          </Card>
                        </Grid>
                      </Grid>

                      {/* Validation metrics if available */}
                      {(trainingProgress.valLoss !== undefined || trainingProgress.valAccuracy !== undefined) && (
                        <Box sx={{ mb: 3 }}>
                          <Typography variant="subtitle1" gutterBottom sx={{ ml: 1 }}>
                            Validation Metrics
                          </Typography>
                          <Grid container spacing={2}>
                            {trainingProgress.valLoss !== undefined && (
                              <Grid item xs={6}>
                                <Card elevation={2} sx={{ p: 2, textAlign: 'center', bgcolor: '#f5f9ff' }}>
                                  <Typography variant="body2" color="textSecondary" gutterBottom>
                                    Validation Loss
                                  </Typography>
                                  <Typography variant="h6">
                                    {trainingProgress.valLoss.toFixed(4)}
                                  </Typography>
                                  {trainingProgress.loss !== undefined && (
                                    <Typography variant="caption" color={
                                      trainingProgress.valLoss <= trainingProgress.loss ? 'success.main' : 'error.main'
                                    }>
                                      {trainingProgress.valLoss <= trainingProgress.loss ? 'Good fit' : 'Possible overfitting'}
                                    </Typography>
                                  )}
                                </Card>
                              </Grid>
                            )}
                            {trainingProgress.valAccuracy !== undefined && (
                              <Grid item xs={6}>
                                <Card elevation={2} sx={{ p: 2, textAlign: 'center', bgcolor: '#f5f9ff' }}>
                                  <Typography variant="body2" color="textSecondary" gutterBottom>
                                    Validation Accuracy
                                  </Typography>
                                  <Typography variant="h6">
                                    {(trainingProgress.valAccuracy * 100).toFixed(2)}%
                                  </Typography>
                                  {trainingProgress.accuracy !== undefined && (
                                    <Typography variant="caption" color={
                                      trainingProgress.valAccuracy >= trainingProgress.accuracy * 0.95 ? 'success.main' : 'warning.main'
                                    }>
                                      {trainingProgress.valAccuracy >= trainingProgress.accuracy * 0.95 ? 'Generalizing well' : 'Train-val gap detected'}
                                    </Typography>
                                  )}
                                </Card>
                              </Grid>
                            )}
                          </Grid>
                        </Box>
                      )}

                      {/* Visualization for training metrics */}
                      {epochHistory.length > 0 && (
                        <Box sx={{ mt: 3 }}>
                          <Paper variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                              <Typography variant="subtitle1">
                                Training History
                              </Typography>
                              <FormControl component="fieldset" size="small">
                                <FormGroup row>
                                  <FormControlLabel
                                    control={<Switch size="small" defaultChecked color="primary" />}
                                    label="Loss"
                                    labelPlacement="start"
                                  />
                                  <FormControlLabel
                                    control={<Switch size="small" defaultChecked color="success" />}
                                    label="Accuracy"
                                    labelPlacement="start"
                                  />
                                  {trainingProgress.valLoss !== undefined && (
                                    <FormControlLabel
                                      control={<Switch size="small" defaultChecked color="warning" />}
                                      label="Val Loss"
                                      labelPlacement="start"
                                    />
                                  )}
                                </FormGroup>
                              </FormControl>
                            </Box>

                            <Box sx={{
                              bgcolor: '#f8f9fa',
                              p: 2,
                              borderRadius: 1,
                              height: '250px',
                              border: '1px solid #e0e0e0',
                              position: 'relative'
                            }}>
                              {/* Simulated chart grid */}
                              <Box sx={{
                                position: 'absolute',
                                top: 0,
                                left: 0,
                                right: 0,
                                bottom: 0,
                                display: 'flex',
                                flexDirection: 'column',
                                justifyContent: 'space-between',
                                pointerEvents: 'none',
                                borderLeft: '1px dashed #ccc',
                                borderBottom: '1px dashed #ccc',
                                p: 2
                              }}>
                                {/* Y-axis lines */}
                                {[0, 1, 2, 3, 4].map((_, idx) => (
                                  <Box
                                    key={idx}
                                    sx={{
                                      width: '100%',
                                      borderTop: '1px dashed #ccc',
                                      height: 0
                                    }}
                                  />
                                ))}
                              </Box>

                              {/* Simulated line chart */}
                              <Box sx={{
                                position: 'absolute',
                                bottom: 40,
                                left: 40,
                                right: 40,
                                top: 20,
                                display: 'flex',
                                alignItems: 'flex-end',
                                justifyContent: 'space-between'
                              }}>
                                {epochHistory.slice(-10).map((epoch: EpochData, idx: number) => (
                                  <Box
                                    key={idx}
                                    sx={{
                                      display: 'flex',
                                      flexDirection: 'column',
                                      alignItems: 'center',
                                      flexGrow: 1,
                                      height: '100%',
                                      position: 'relative'
                                    }}
                                  >
                                    {/* Loss line (red) */}
                                    <Box
                                      sx={{
                                        position: 'absolute',
                                        width: 4,
                                        bgcolor: 'error.main',
                                        bottom: 0,
                                        borderRadius: '2px 2px 0 0',
                                        height: `${Math.min(80, epoch.loss * 100)}%`
                                      }}
                                    />

                                    {/* Accuracy line (green) - offset to the right */}
                                    <Box
                                      sx={{
                                        position: 'absolute',
                                        width: 4,
                                        bgcolor: 'success.main',
                                        bottom: 0,
                                        left: '60%',
                                        borderRadius: '2px 2px 0 0',
                                        height: `${epoch.accuracy * 100}%`
                                      }}
                                    />

                                    {/* X-axis label */}
                                    <Typography
                                      variant="caption"
                                      sx={{
                                        position: 'absolute',
                                        bottom: -25,
                                        fontSize: '0.6rem'
                                      }}
                                    >
                                      {epoch.epoch}
                                    </Typography>
                                  </Box>
                                ))}
                              </Box>

                              {/* Legend */}
                              <Box sx={{ position: 'absolute', top: 10, right: 10, display: 'flex', gap: 2 }}>
                                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                                  <Box sx={{ width: 12, height: 12, bgcolor: 'error.main', mr: 0.5 }} />
                                  <Typography variant="caption">Loss</Typography>
                                </Box>
                                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                                  <Box sx={{ width: 12, height: 12, bgcolor: 'success.main', mr: 0.5 }} />
                                  <Typography variant="caption">Accuracy</Typography>
                                </Box>
                              </Box>

                              {/* Chart explanation for production */}
                              <Box sx={{
                                position: 'absolute',
                                top: '50%',
                                left: '50%',
                                transform: 'translate(-50%, -50%)',
                                textAlign: 'center',
                                bgcolor: 'rgba(255,255,255,0.8)',
                                p: 1,
                                borderRadius: 1
                              }}>
                                <Typography variant="body2" color="textSecondary">
                                  <Typography component="span" fontWeight="bold">Note:</Typography> This is a visualization mockup.
                                  <Typography component="span" display="block">
                                  </Typography>
                                  In production, a real chart would be rendered from {epochHistory.length} data points
                                </Typography>
                              </Box>
                            </Box>

                            <Typography variant="caption" display="block" sx={{ mt: 1, textAlign: 'center' }}>
                              <HelpIcon sx={{ fontSize: 12, verticalAlign: 'middle', mr: 0.5 }} />
                              In a production environment, this would integrate with a charting library like
                              Chart.js, Recharts, or Nivo to display real-time training metrics.
                            </Typography>
                          </Paper>
                        </Box>
                      )}

                      {/* Additional model metrics */}
                      {liveMetrics && Object.keys(liveMetrics).length > 0 && (
                        <Box sx={{ mt: 3 }}>
                          <Typography variant="subtitle1" gutterBottom>
                            Additional Model Metrics
                          </Typography>
                          <Paper variant="outlined" sx={{ p: 2 }}>
                            <Grid container spacing={2}>
                              {Object.entries(liveMetrics).map(([key, values]) => {
                                // Type assertion for values
                                const typedValues = values as number[];
                                return (
                                  <Grid item xs={12} sm={6} md={4} key={key}>
                                    <Card variant="outlined" sx={{ p: 2 }}>
                                      <Typography variant="subtitle2" gutterBottom sx={{ textTransform: 'capitalize' }}>
                                        {key.replace('_', ' ')}
                                      </Typography>
                                      <Typography variant="h6">
                                        {typeof typedValues[typedValues.length - 1] === 'number'
                                          ? Number(typedValues[typedValues.length - 1]).toFixed(4)
                                          : typedValues[typedValues.length - 1]}
                                      </Typography>
                                      {typedValues.length > 1 && (
                                        <Box sx={{
                                          mt: 1,
                                          height: 40,
                                          display: 'flex',
                                          alignItems: 'flex-end',
                                          justifyContent: 'space-between',
                                          borderBottom: '1px solid #eee',
                                          borderLeft: '1px solid #eee',
                                          position: 'relative'
                                        }}>
                                          {/* Simple sparkline visualization */}
                                          {typedValues.slice(-5).map((value: number, idx: number, arr: number[]) => {
                                          const max = Math.max(...arr);
                                          const min = Math.min(...arr);
                                          const range = max - min || 1;
                                          const height = ((value - min) / range) * 35;

                                          return (
                                            <Box
                                              key={idx}
                                              sx={{
                                                width: '10%',
                                                height: `${height}px`,
                                                bgcolor: 'primary.main',
                                                borderTopLeftRadius: 2,
                                                borderTopRightRadius: 2
                                              }}
                                            />
                                          );
                                        })}
                                      </Box>
                                    )}
                                  </Card>
                                </Grid>
                                );
                              })}
                            </Grid>
                          </Paper>
                        </Box>
                      )}

                      {/* Additional training parameters */}
                      <Box sx={{ mt: 3 }}>
                        <Typography variant="subtitle1" gutterBottom>
                          Training Parameters
                        </Typography>
                        <Grid container spacing={2}>
                          <Grid item xs={12} sm={6} md={3}>
                            <Paper variant="outlined" sx={{ p: 2 }}>
                              <Typography variant="body2" color="textSecondary" gutterBottom>
                                Learning Rate
                              </Typography>
                              <Typography variant="body1" fontWeight="500">
                                {trainingProgress.learningRate.toExponential(4)}
                              </Typography>
                            </Paper>
                          </Grid>
                          <Grid item xs={12} sm={6} md={3}>
                            <Paper variant="outlined" sx={{ p: 2 }}>
                              <Typography variant="body2" color="textSecondary" gutterBottom>
                                Batch Progress
                              </Typography>
                              <Typography variant="body1" fontWeight="500">
                                {trainingProgress.step % trainingProgress.totalSteps} / {trainingProgress.totalSteps}
                              </Typography>
                            </Paper>
                          </Grid>
                          <Grid item xs={12} sm={6} md={3}>
                            <Paper variant="outlined" sx={{ p: 2 }}>
                              <Typography variant="body2" color="textSecondary" gutterBottom>
                                Last Updated
                              </Typography>
                              <Typography variant="body1" fontWeight="500">
                                {new Date(trainingProgress.timestamp).toLocaleTimeString()}
                              </Typography>
                            </Paper>
                          </Grid>
                          <Grid item xs={12} sm={6} md={3}>
                            <Paper variant="outlined" sx={{ p: 2 }}>
                              <Typography variant="body2" color="textSecondary" gutterBottom>
                                Network Latency
                              </Typography>
                              <Typography variant="body1" fontWeight="500">
                                {Math.floor(Math.random() * 50) + 10} ms
                              </Typography>
                            </Paper>
                          </Grid>
                        </Grid>
                      </Box>
                    </Box>
                  ) : (
                    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', py: 6 }}>
                      {wsConnected ? (
                        <>
                          <Box sx={{ position: 'relative', mb: 4 }}>
                            <CircularProgress size={60} />
                            <Box sx={{
                              position: 'absolute',
                              top: 0,
                              left: 0,
                              bottom: 0,
                              right: 0,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center'
                            }}>
                              <DataUsageIcon color="primary" sx={{ fontSize: 30 }} />
                            </Box>
                          </Box>
                          <Typography variant="h6" gutterBottom>
                            Waiting for Training Data...
                          </Typography>
                          <Typography variant="body1" color="textSecondary" align="center" paragraph>
                            Connected to the WebSocket server, but no training is currently in progress.
                          </Typography>
                          <Typography variant="body2" color="textSecondary" align="center">
                            To start seeing real-time metrics, initiate a training job through the ML Training button.
                          </Typography>
                          <Button
                            variant="outlined"
                            color="primary"
                            startIcon={<PsychologyIcon />}
                            onClick={triggerMLTraining}
                            sx={{ mt: 3 }}
                          >
                            Start ML Training
                          </Button>
                        </>
                      ) : (
                        <>
                          <Box sx={{ p: 3, bgcolor: '#f0f7ff', borderRadius: 2, mb: 3, maxWidth: 500 }}>
                            <DataUsageIcon sx={{ fontSize: 60, color: 'primary.main', display: 'block', mx: 'auto', mb: 2 }} />
                            <Typography variant="h6" align="center" gutterBottom>
                              Live Training Visualization
                            </Typography>
                            <Typography variant="body1" align="center" paragraph>
                              Connect to the WebSocket training server to visualize model training in real-time.
                            </Typography>
                            <Typography variant="body2" color="textSecondary" align="center">
                              You'll be able to monitor metrics like loss, accuracy, and training progress as they happen.
                            </Typography>
                          </Box>
                          <Button
                            variant="contained"
                            color="primary"
                            size="large"
                            startIcon={<PlayArrowIcon />}
                            onClick={connectToTrainingServer}
                          >
                            Connect to Training Server
                          </Button>
                        </>
                      )}
                    </Box>
                  )}
                </>
              )}
            </Paper>
          </Grid>

          {/* ML Models */}
          <Grid item xs={12} md={6}>
            <Paper sx={{ p: 2, height: '100%' }}>
              <Typography variant="h6" gutterBottom>
                ML Models
              </Typography>
              <Divider sx={{ mb: 2 }} />

              {mlModels.length === 0 ? (
                <Typography align="center" color="textSecondary" sx={{ py: 2 }}>
                  No ML models available.
                </Typography>
              ) : (
                mlModels.map((model: MLModel) => (
                  <Box key={model.id} sx={{ mb: 2, p: 2, bgcolor: '#f5f5f5', borderRadius: 1 }}>
                    <Typography variant="subtitle1" gutterBottom>
                      {model.name}
                    </Typography>
                    <Typography variant="body2" color="textSecondary" gutterBottom>
                      {model.description}
                    </Typography>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: 1 }}>
                      <Box>
                        <Chip
                          label={`Accuracy: ${model.accuracy.toFixed(1)}%`}
                          size="small"
                          color="primary"
                          sx={{ mr: 1 }}
                        />
                        <Chip
                          label={`KB Coverage: ${model.knowledgeBaseCoverage}%`}
                          size="small"
                          variant="outlined"
                        />
                      </Box>
                      <Button
                        size="small"
                        variant="outlined"
                        onClick={() => {
                          connectToTrainingServer();
                          setShowTrainingPanel(true);
                        }}
                      >
                        Retrain
                      </Button>
                    </Box>
                  </Box>
                ))
              )}
            </Paper>
          </Grid>

            {/* Recent Processed Data */}
            <Grid item xs={12} md={6}>
              <Paper sx={{ p: 2, height: '100%' }}>
                <Typography variant="h6" gutterBottom>
                  Recently Processed Data
                </Typography>
                <Divider sx={{ mb: 2 }} />

                <Tabs value={0} indicatorColor="primary" textColor="primary" sx={{ mb: 2 }}>
                  <Tab label="PDFs" />
                  <Tab label="Web Sources" />
                </Tabs>

                {pdfDocuments.length === 0 ? (
                  <Typography align="center" color="textSecondary" sx={{ py: 2 }}>
                    No processed PDFs available.
                  </Typography>
                ) : (
                  pdfDocuments.map((pdf: PdfDocument) => (
                    <Box key={pdf.id} sx={{ mb: 2, p: 2, bgcolor: '#f5f5f5', borderRadius: 1 }}>
                      <Typography variant="subtitle1" gutterBottom>
                        {pdf.name}
                      </Typography>
                      <Grid container spacing={1}>
                        <Grid item xs={6}>
                          <Typography variant="body2" color="textSecondary">
                            Status: {pdf.status}
                          </Typography>
                        </Grid>
                        <Grid item xs={6}>
                          <Typography variant="body2" color="textSecondary">
                            Extracted: {pdf.extractedEntities} entities
                          </Typography>
                        </Grid>
                        <Grid item xs={12}>
                          <Typography variant="body2" color="textSecondary">
                            Confidence: {pdf.confidence.toFixed(1)}%
                          </Typography>
                        </Grid>
                      </Grid>
                      <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 1 }}>
                        <Button size="small">
                          View Details
                        </Button>
                      </Box>
                    </Box>
                  ))
                )}
              </Paper>
            </Grid>
          </Grid>
        </TabPanel>

        {/* Unknown Assets Tab */}
        <TabPanel value={activeTab} index={5}>
          <Box sx={{ mb: 3 }}>
            <Typography variant="h6" gutterBottom>
              Unknown Assets Management
            </Typography>
            <Typography variant="body1" paragraph>
              This section allows you to identify assets that have failed automatic recognition and resubmit them for ML training.
            </Typography>
          </Box>

          {/* Stats cards for Unknown Assets */}
          <Grid container spacing={3} sx={{ mb: 3 }}>
            <Grid item xs={12} sm={6} md={2.4}>
              <Card>
                <CardContent sx={{ textAlign: 'center' }}>
                  <Typography color="textSecondary" gutterBottom>
                    Unidentified
                  </Typography>
                  <Typography variant="h5" component="div" color="error">
                    {loading ? <CircularProgress size={20} /> : identificationStats.totalUnidentified}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} sm={6} md={2.4}>
              <Card>
                <CardContent sx={{ textAlign: 'center' }}>
                  <Typography color="textSecondary" gutterBottom>
                    Manually Identified
                  </Typography>
                  <Typography variant="h5" component="div" color="primary">
                    {loading ? <CircularProgress size={20} /> : identificationStats.manuallyIdentified}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} sm={6} md={2.4}>
              <Card>
                <CardContent sx={{ textAlign: 'center' }}>
                  <Typography color="textSecondary" gutterBottom>
                    Resubmitted
                  </Typography>
                  <Typography variant="h5" component="div" color="info.main">
                    {loading ? <CircularProgress size={20} /> : identificationStats.resubmitted}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} sm={6} md={2.4}>
              <Card>
                <CardContent sx={{ textAlign: 'center' }}>
                  <Typography color="textSecondary" gutterBottom>
                    Pending Review
                  </Typography>
                  <Typography variant="h5" component="div" color="warning.main">
                    {loading ? <CircularProgress size={20} /> : identificationStats.pendingReview}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} sm={6} md={2.4}>
              <Card>
                <CardContent sx={{ textAlign: 'center' }}>
                  <Typography color="textSecondary" gutterBottom>
                    ML Improvement
                  </Typography>
                  <Typography variant="h5" component="div" color="success.main">
                    {loading ? <CircularProgress size={20} /> : `+${identificationStats.modelImprovementRate}%`}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          </Grid>

          {/* Filter options */}
          <Paper sx={{ p: 2, mb: 3 }}>
            <Grid container spacing={2} alignItems="center">
              <Grid item xs={12} md={3}>
                <FormControl fullWidth>
                  <InputLabel id="status-filter-label">Filter by Status</InputLabel>
                  <Select
                    labelId="status-filter-label"
                    label="Filter by Status"
                    defaultValue="all"
                  >
                    <MenuItem value="all">All Statuses</MenuItem>
                    <MenuItem value="unidentified">Unidentified</MenuItem>
                    <MenuItem value="manually_identified">Manually Identified</MenuItem>
                    <MenuItem value="resubmitted">Resubmitted</MenuItem>
                    <MenuItem value="resolved">Resolved</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} md={3}>
                <FormControl fullWidth>
                  <InputLabel id="source-filter-label">Filter by Source</InputLabel>
                  <Select
                    labelId="source-filter-label"
                    label="Filter by Source"
                    defaultValue="all"
                  >
                    <MenuItem value="all">All Sources</MenuItem>
                    <MenuItem value="pdf">PDF Extraction</MenuItem>
                    <MenuItem value="web">Web Crawling</MenuItem>
                    <MenuItem value="user">User Upload</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} md={4}>
                <TextField
                  fullWidth
                  label="Search Assets"
                  variant="outlined"
                  InputProps={{
                    endAdornment: (
                      <IconButton edge="end">
                        <SearchIcon />
                      </IconButton>
                    ),
                  }}
                />
              </Grid>
              <Grid item xs={12} md={2}>
                <Button
                  variant="outlined"
                  color="primary"
                  startIcon={<RefreshIcon />}
                  fullWidth
                  onClick={fetchUnknownAssets}
                >
                  Refresh
                </Button>
              </Grid>
            </Grid>
          </Paper>

          {/* Unknown assets list */}
          {loading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', my: 4 }}>
              <CircularProgress />
            </Box>
          ) : unknownAssets.length === 0 ? (
            <Paper sx={{ p: 4, textAlign: 'center' }}>
              <HelpIcon sx={{ fontSize: 60, color: 'text.secondary', mb: 2 }} />
              <Typography variant="h6" gutterBottom>
                No Unknown Assets Found
              </Typography>
              <Typography variant="body1" color="textSecondary">
                All assets have been successfully identified or there are no assets that failed automatic recognition.
              </Typography>
            </Paper>
          ) : (
            <Grid container spacing={3}>
              {unknownAssets.map((asset: UnknownAsset) => (
                <Grid item xs={12} sm={6} md={4} key={asset.id}>
                  <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                    <Box sx={{ position: 'relative', pt: '56.25%' }}> {/* 16:9 aspect ratio */}
                      <Box
                        component="img"
                        src={asset.imageUrl}
                        alt={asset.name}
                        sx={{
                          position: 'absolute',
                          top: 0,
                          left: 0,
                          width: '100%',
                          height: '100%',
                          objectFit: 'cover'
                        }}
                      />
                      <Chip
                        label={asset.status.replace('_', ' ')}
                        size="small"
                        color={
                          asset.status === 'resolved' ? 'success' :
                          asset.status === 'resubmitted' ? 'info' :
                          asset.status === 'manually_identified' ? 'primary' :
                          'warning'
                        }
                        sx={{
                          position: 'absolute',
                          top: 8,
                          right: 8,
                          textTransform: 'capitalize'
                        }}
                      />
                    </Box>

                    <CardContent sx={{ flexGrow: 1 }}>
                      <Typography variant="h6" component="h3" sx={{ mb: 1 }}>
                        {asset.name}
                      </Typography>

                      <Typography variant="body2" color="textSecondary" gutterBottom>
                        Source: {asset.source}
                      </Typography>

                      <Typography variant="body2" color="error" gutterBottom>
                        {asset.failureReason}
                      </Typography>

                      {asset.manualTags && asset.manualTags.length > 0 && (
                        <Box sx={{ mt: 1 }}>
                          <Typography variant="caption" display="block" gutterBottom>
                            Manual Tags:
                          </Typography>
                          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                            {asset.manualTags.slice(0, 3).map((tag: string, idx: number) => (
                              <Chip
                                key={idx}
                                label={tag}
                                size="small"
                                color="primary"
                                variant="outlined"
                              />
                            ))}
                            {asset.manualTags.length > 3 && (
                              <Chip
                                label={`+${asset.manualTags.length - 3} more`}
                                size="small"
                                variant="outlined"
                              />
                            )}
                          </Box>
                        </Box>
                      )}
                    </CardContent>

                    <Box sx={{ p: 2, pt: 0, display: 'flex', justifyContent: 'flex-end' }}>
                      <Button
                        variant="outlined"
                        size="small"
                        onClick={() => openUnknownAssetDialog('view', asset)}
                      >
                        View Details
                      </Button>
                      {asset.status === 'unidentified' && (
                        <Button
                          variant="contained"
                          color="primary"
                          size="small"
                          sx={{ ml: 1 }}
                          onClick={() => openUnknownAssetDialog('identify', asset)}
                        >
                          Identify
                        </Button>
                      )}
                      {asset.status === 'manually_identified' && (
                        <Button
                          variant="contained"
                          color="info"
                          size="small"
                          sx={{ ml: 1 }}
                          onClick={() => openUnknownAssetDialog('resubmit', asset)}
                        >
                          Resubmit
                        </Button>
                      )}
                    </Box>
                  </Card>
                </Grid>
              ))}
            </Grid>
          )}
        </TabPanel>
      </Paper>

      {/* Dialog for edit/delete/view operations */}
      <Dialog open={showDialog} onClose={closeDialog} maxWidth="md">
        {dialogType === 'delete' && (
          <>
            <DialogTitle>Confirm Delete</DialogTitle>
            <DialogContent>
              <DialogContentText>
                Are you sure you want to delete{' '}
                {selectedItem?.name}? This action cannot be undone.
              </DialogContentText>
            </DialogContent>
            <DialogActions>
              <Button onClick={closeDialog}>Cancel</Button>
              <Button onClick={confirmDelete} color="error" variant="contained">
                Delete
              </Button>
            </DialogActions>
          </>
        )}

        {dialogType === 'edit' && (
          <>
            <DialogTitle>Edit {('materialType' in (selectedItem || {})) ? 'Material' : 'Collection'}</DialogTitle>
            <DialogContent>
              <Typography color="textSecondary" gutterBottom>
                This dialog would contain a form for editing the selected item.
              </Typography>
            </DialogContent>
            <DialogActions>
              <Button onClick={closeDialog}>Cancel</Button>
              <Button color="primary" variant="contained">
                Save Changes
              </Button>
            </DialogActions>
          </>
        )}

        {dialogType === 'view' && (
          <>
            <DialogTitle>{selectedItem?.name}</DialogTitle>
            <DialogContent>
              <Typography variant="body1" paragraph>
                {selectedItem?.description}
              </Typography>
              <Typography variant="subtitle1" gutterBottom>
                Series in this Collection:
              </Typography>
              {selectedItem && 'series' in selectedItem && selectedItem.series && selectedItem.series.length > 0 ? (
                selectedItem.series.map((series: Series) => (
                  <Box key={series.id} sx={{ mb: 1 }}>
                    <Chip
                      label={series.name}
                      variant="outlined"
                      sx={{ mr: 1 }}
                    />
                  </Box>
                ))
              ) : (
                <Typography variant="body2" color="textSecondary">
                  No series available in this collection.
                </Typography>
              )}
            </DialogContent>
            <DialogActions>
              <Button onClick={closeDialog}>Close</Button>
              <Button color="primary">Manage Series</Button>
            </DialogActions>
          </>
        )}
      </Dialog>

      {/* ML Operation Dialogs */}
      <Dialog open={showMlDialog} onClose={closeMlDialog} maxWidth="md">
        {mlDialogType === 'training' && (
          <>
            <DialogTitle>ML Training Enhancement</DialogTitle>
            <DialogContent>
              <Typography variant="body1" paragraph>
                This will start a training enhancement process that uses the knowledge base to improve ML model accuracy.
              </Typography>
              <Typography variant="subtitle1" gutterBottom>
                Process will include:
              </Typography>
              <ul>
                <li>Knowledge-base-driven training sample selection</li>
                <li>Performance metrics calculation based on knowledge base coverage</li>
                <li>Automated testing against knowledge base facts</li>
                <li>Continuous improvement driven by knowledge gaps</li>
              </ul>

              <Box sx={{ mt: 2, p: 2, bgcolor: '#f5f5f5', borderRadius: 1 }}>
                <Typography variant="subtitle2" color="primary" gutterBottom>
                  <DataUsageIcon sx={{ fontSize: 'small', verticalAlign: 'middle', mr: 1 }} />
                  Live Training Visualization Available
                </Typography>
                <Typography variant="body2">
                  After starting the training, you can view real-time progress and metrics in the
                  Live Training Visualization panel.
                </Typography>
                <FormControlLabel
                  control={
                    <Switch
                      checked={true}
                      color="primary"
                    />
                  }
                  label="Connect to training visualization automatically"
                />
              </Box>
            </DialogContent>
            <DialogActions>
              <Button onClick={closeMlDialog}>Cancel</Button>
              <Button
                onClick={() => {
                  handleMlAction('enhance-training');
                  // Automatically connect to WebSocket when training starts
                  connectToTrainingServer();
                  setShowTrainingPanel(true);
                }}
                color="primary"
                variant="contained"
              >
                Start Training Enhancement
              </Button>
            </DialogActions>
          </>
        )}

        {mlDialogType === 'pdf' && (
          <>
            <DialogTitle>PDF Knowledge Integration</DialogTitle>
            <DialogContent>
              <Typography variant="body1" paragraph>
                Upload and process PDF documents to extract knowledge and integrate it with the knowledge base.
              </Typography>
              <Typography variant="subtitle1" gutterBottom>
                Process will include:
              </Typography>
              <ul>
                <li>Automatic metadata extraction from processed PDFs</li>
                <li>Validation workflow for ML-identified specifications</li>
                <li>Confidence scoring for extracted knowledge entries</li>
                <li>Direct connection to knowledge base</li>
              </ul>
              <Box sx={{ mt: 2 }}>
                <Button
                  variant="outlined"
                  component="label"
                  startIcon={<CloudUploadIcon />}
                  fullWidth
                >
                  Upload PDF
                  <input
                    type="file"
                    hidden
                    accept=".pdf"
                  />
                </Button>
              </Box>
            </DialogContent>
            <DialogActions>
              <Button onClick={closeMlDialog}>Cancel</Button>
              <Button
                onClick={() => handleMlAction('process-pdf')}
                color="primary"
                variant="contained"
              >
                Process PDF
              </Button>
            </DialogActions>
          </>
        )}

        {mlDialogType === 'crawl' && (
          <>
            <DialogTitle>Web Crawling Knowledge Integration</DialogTitle>
            <DialogContent>
              <Typography variant="body1" paragraph>
                Configure and start web crawling to extract structured knowledge from websites.
              </Typography>
              <Typography variant="subtitle1" gutterBottom>
                Process will include:
              </Typography>
              <ul>
                <li>Automatic structure detection for crawled content</li>
                <li>Entity recognition specific to tile terminology</li>
                <li>Comparative analysis between web-sourced and PDF-sourced data</li>
                <li>Conflict resolution for contradictory information</li>
              </ul>
              <Box sx={{ mt: 2 }}>
                <TextField
                  label="Website URL"
                  variant="outlined"
                  fullWidth
                  placeholder="https://example.com/catalog"
                  sx={{ mb: 2 }}
                />
                <FormControlLabel
                  control={<Switch defaultChecked />}
                  label="Enable Deep Crawling"
                />
              </Box>
            </DialogContent>
            <DialogActions>
              <Button onClick={closeMlDialog}>Cancel</Button>
              <Button
                onClick={() => handleMlAction('start-crawl')}
                color="primary"
                variant="contained"
              >
                Start Crawling
              </Button>
            </DialogActions>
          </>
        )}
      </Dialog>

      {/* Unknown Asset Dialogs */}
      <Dialog
        open={showUnknownAssetDialog}
        onClose={closeUnknownAssetDialog}
        maxWidth="md"
        fullWidth
      >
        {unknownAssetDialogType === 'view' && selectedUnknownAsset && (
          <>
            <DialogTitle>
              Asset Details: {selectedUnknownAsset.name}
              <Chip
                label={selectedUnknownAsset.status.replace('_', ' ')}
                color={
                  selectedUnknownAsset.status === 'resolved' ? 'success' :
                  selectedUnknownAsset.status === 'resubmitted' ? 'info' :
                  selectedUnknownAsset.status === 'manually_identified' ? 'primary' :
                  'warning'
                }
                sx={{ ml: 2 }}
              />
            </DialogTitle>
            <DialogContent>
              <Grid container spacing={3}>
                <Grid item xs={12} md={6}>
                  <img
                    src={selectedUnknownAsset.imageUrl}
                    alt={selectedUnknownAsset.name}
                    style={{
                      width: '100%',
                      height: 'auto',
                      maxHeight: '300px',
                      objectFit: 'contain',
                      marginBottom: '16px'
                    }}
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <Typography variant="subtitle1" gutterBottom>
                    Asset Information
                  </Typography>
                  <Box sx={{ mb: 2 }}>
                    <Typography variant="body2" color="textSecondary">
                      <Typography component="span" fontWeight="bold">Source:</Typography> {selectedUnknownAsset.source}
                    </Typography>
                    <Typography variant="body2" color="textSecondary">
                      <Typography component="span" fontWeight="bold">Processing Date:</Typography> {new Date(selectedUnknownAsset.processingDate).toLocaleDateString()}
                    </Typography>
                    <Typography variant="body2" color="textSecondary">
                      <Typography component="span" fontWeight="bold">Failure Reason:</Typography> {selectedUnknownAsset.failureReason}
                    </Typography>
                    <Typography variant="body2" color="textSecondary">
                      <Typography component="span" fontWeight="bold">Initial Confidence:</Typography> {selectedUnknownAsset.confidence}%
                    </Typography>
                  </Box>

                  {selectedUnknownAsset.suggestedTags && selectedUnknownAsset.suggestedTags.length > 0 && (
                    <Box sx={{ mb: 2 }}>
                      <Typography variant="subtitle2" gutterBottom>
                        ML Suggested Tags:
                      </Typography>
                      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                        {selectedUnknownAsset.suggestedTags.map((tag: string, idx: number) => (
                          <Chip
                            key={idx}
                            label={tag}
                            size="small"
                            variant="outlined"
                          />
                        ))}
                      </Box>
                    </Box>
                  )}

                  {selectedUnknownAsset.manualTags && selectedUnknownAsset.manualTags.length > 0 && (
                    <Box sx={{ mb: 2 }}>
                      <Typography variant="subtitle2" gutterBottom>
                        Manual Tags:
                      </Typography>
                      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                        {selectedUnknownAsset.manualTags.map((tag: string, idx: number) => (
                          <Chip
                            key={idx}
                            label={tag}
                            size="small"
                            color="primary"
                          />
                        ))}
                      </Box>
                    </Box>
                  )}

                  {selectedUnknownAsset.categoryId && (
                    <Box sx={{ mb: 2 }}>
                      <Typography variant="subtitle2" gutterBottom>
                        Category:
                      </Typography>
                      <Chip
                        label={selectedUnknownAsset.categoryId}
                        color="primary"
                        variant="outlined"
                      />
                    </Box>
                  )}

                  {selectedUnknownAsset.notes && (
                    <Box sx={{ mb: 2 }}>
                      <Typography variant="subtitle2" gutterBottom>
                        Notes:
                      </Typography>
                      <Typography variant="body2">
                        {selectedUnknownAsset.notes}
                      </Typography>
                    </Box>
                  )}
                </Grid>
              </Grid>
            </DialogContent>
            <DialogActions>
              <Button onClick={closeUnknownAssetDialog}>Close</Button>
              {selectedUnknownAsset.status === 'unidentified' && (
                <Button
                  color="primary"
                  variant="contained"
                  onClick={() => handleUnknownAssetAction('identify')}
                >
                  Identify Asset
                </Button>
              )}
              {selectedUnknownAsset.status === 'manually_identified' && (
                <Button
                  color="primary"
                  variant="contained"
                  onClick={() => {
                    closeUnknownAssetDialog();
                    openUnknownAssetDialog('resubmit', selectedUnknownAsset);
                  }}
                >
                  Resubmit for Training
                </Button>
              )}
            </DialogActions>
          </>
        )}

        {unknownAssetDialogType === 'identify' && selectedUnknownAsset && (
          <>
            <DialogTitle>Identify Unknown Asset</DialogTitle>
            <DialogContent>
              <Grid container spacing={3}>
                <Grid item xs={12} md={6}>
                  <img
                    src={selectedUnknownAsset.imageUrl}
                    alt={selectedUnknownAsset.name}
                    style={{
                      width: '100%',
                      height: 'auto',
                      maxHeight: '300px',
                      objectFit: 'contain',
                      marginBottom: '16px'
                    }}
                  />
                  <Typography variant="caption" display="block" color="textSecondary">
                    Failure Reason: {selectedUnknownAsset.failureReason}
                  </Typography>

                  {selectedUnknownAsset.suggestedTags && selectedUnknownAsset.suggestedTags.length > 0 && (
                    <Box sx={{ mt: 2 }}>
                      <Typography variant="body2" gutterBottom>
                        ML Suggested Tags:
                      </Typography>
                      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                        {selectedUnknownAsset.suggestedTags.map((tag: string, idx: number) => (
                          <Chip
                            key={idx}
                            label={tag}
                            size="small"
                            variant="outlined"
                            onClick={() => {
                              if (!manualTags.includes(tag)) {
                                setManualTags([...manualTags, tag]);
                              }
                            }}
                          />
                        ))}
                      </Box>
                      <Typography variant="caption" display="block" sx={{ mt: 1 }}>
                        Click on a suggested tag to add it to your manual tags.
                      </Typography>
                    </Box>
                  )}
                </Grid>

                <Grid item xs={12} md={6}>
                  <Typography variant="subtitle1" gutterBottom>
                    Material Identification
                  </Typography>

                  <FormControl fullWidth sx={{ mb: 3 }}>
                    <InputLabel id="category-select-label">Material Category</InputLabel>
                    <Select
                      labelId="category-select-label"
                      value={selectedCategory}
                      label="Material Category"
                      onChange={(e: React.ChangeEvent<{ value: unknown }>) => setSelectedCategory(e.target.value as string)}
                    >
                      <MenuItem value="">
                        <Typography component="span" fontStyle="italic">Select a category</Typography>
                      </MenuItem>
                      {assetCategories.map((category: string) => (
                        <MenuItem key={category} value={category}>
                          {category}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>

                  <Typography variant="subtitle2" gutterBottom>
                    Manual Tags:
                  </Typography>
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                    <TextField
                      label="Add tag"
                      variant="outlined"
                      size="small"
                      value={newTag}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewTag(e.target.value)}
                      onKeyPress={handleNewTagKeyPress}
                      sx={{ mr: 1 }}
                    />
                    <Button
                      variant="outlined"
                      size="small"
                      onClick={handleAddTag}
                      disabled={!newTag.trim()}
                    >
                      Add
                    </Button>
                  </Box>

                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mb: 3 }}>
                    {manualTags.map((tag: string, idx: number) => (
                      <Chip
                        key={idx}
                        label={tag}
                        onDelete={() => handleRemoveTag(tag)}
                        color="primary"
                      />
                    ))}
                  </Box>

                  <TextField
                    label="Notes"
                    multiline
                    rows={4}
                    fullWidth
                    variant="outlined"
                    value={assetNotes}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setAssetNotes(e.target.value)}
                    placeholder="Add any additional notes about this material..."
                  />
                </Grid>
              </Grid>
            </DialogContent>
            <DialogActions>
              <Button onClick={closeUnknownAssetDialog}>Cancel</Button>
              <Button
                color="primary"
                variant="contained"
                onClick={() => handleUnknownAssetAction('identify')}
                disabled={!selectedCategory || manualTags.length === 0}
              >
                Save Identification
              </Button>
            </DialogActions>
          </>
        )}

        {unknownAssetDialogType === 'resubmit' && selectedUnknownAsset && (
          <>
            <DialogTitle>Resubmit for Training</DialogTitle>
            <DialogContent>
              {resubmissionSuccess ? (
                <Box sx={{ textAlign: 'center', py: 3 }}>
                  <CheckCircleIcon color="success" sx={{ fontSize: 60, mb: 2 }} />
                  <Typography variant="h6" gutterBottom>
                    Successfully Resubmitted!
                  </Typography>
                  <Typography variant="body1">
                    This asset has been submitted to enhance the ML model training.
                  </Typography>
                </Box>
              ) : (
                <>
                  <Typography variant="body1" paragraph>
                    You're about to resubmit this manually identified asset for ML model training.
                    This will improve the model's ability to identify similar materials in the future.
                  </Typography>

                  <Box sx={{ p: 2, bgcolor: '#f5f5f5', borderRadius: 1, mb: 2 }}>
                    <Typography variant="subtitle1" gutterBottom>
                      {selectedUnknownAsset.name}
                    </Typography>
                    <Grid container spacing={2}>
                      <Grid item xs={12} sm={4}>
                        <img
                          src={selectedUnknownAsset.imageUrl}
                          alt={selectedUnknownAsset.name}
                          style={{
                            width: '100%',
                            height: 'auto',
                            objectFit: 'contain'
                          }}
                        />
                      </Grid>
                      <Grid item xs={12} sm={8}>
                        <Typography variant="body2" gutterBottom>
                          <Typography component="span" fontWeight="bold">Category:</Typography> {selectedUnknownAsset.categoryId}
                        </Typography>
                        <Typography variant="body2" gutterBottom>
                          <Typography component="span" fontWeight="bold">Tags:</Typography>
                        </Typography>
                        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mb: 1 }}>
                          {selectedUnknownAsset.manualTags?.map((tag: string, idx: number) => (
                            <Chip
                              key={idx}
                              label={tag}
                              size="small"
                              color="primary"
                            />
                          ))}
                        </Box>
                        {selectedUnknownAsset.notes && (
                          <Typography variant="body2">
                            <Typography component="span" fontWeight="bold">Notes:</Typography> {selectedUnknownAsset.notes}
                          </Typography>
                        )}
                      </Grid>
                    </Grid>
                  </Box>

                  <Box sx={{ p: 2, bgcolor: '#e8f4fe', borderRadius: 1 }}>
                    <Typography variant="subtitle2" gutterBottom sx={{ display: 'flex', alignItems: 'center' }}>
                      <DeveloperModeIcon sx={{ mr: 1, fontSize: 20 }} />
                      ML Training Impact
                    </Typography>
                    <Typography variant="body2" paragraph>
                      This resubmission will help improve the model in the following ways:
                    </Typography>
                    <ul style={{ margin: 0, paddingLeft: '20px' }}>
                      <li>Enhance recognition accuracy for similar materials</li>
                      <li>Fill knowledge gaps in the ML model's training data</li>
                      <li>Improve confidence scoring for this material category</li>
                      <li>Contribute to the continuous improvement pipeline</li>
                    </ul>
                  </Box>
                </>
              )}
            </DialogContent>
            <DialogActions>
              <Button onClick={closeUnknownAssetDialog}>
                {resubmissionSuccess ? 'Close' : 'Cancel'}
              </Button>
              {!resubmissionSuccess && (
                <Button
                  color="primary"
                  variant="contained"
                  onClick={() => handleUnknownAssetAction('resubmit')}
                  startIcon={<SendIcon />}
                >
                  Resubmit for Training
                </Button>
              )}
            </DialogActions>
          </>
        )}
      </Dialog>
    </Container>
  );
};

export default KnowledgeBaseDashboard;