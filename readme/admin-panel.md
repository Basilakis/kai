# Admin Panel

The Admin Panel is a comprehensive management interface for the Kai platform, providing administrators with tools for system configuration, content management, user control, and performance monitoring. This document details the panel's features, architecture, and implementation.

## Features

### Dashboard and Analytics

The admin panel provides comprehensive system visibility:

1. **System Dashboard**
   - Real-time system health indicators
   - Resource utilization metrics
   - Active job monitoring
   - Error rate tracking
   - Key performance indicators

2. **Usage Analytics**
   - User activity metrics
   - Feature utilization statistics
   - Response time tracking
   - Search pattern analysis
   - Content engagement metrics

3. **Performance Monitoring**
   - Processing throughput metrics
   - Queue status and performance
   - Database query performance
   - API response times
   - Resource consumption patterns

### User and Access Management

The admin panel includes comprehensive user management:

1. **User Administration**
   - User account creation and management
   - Role assignment (admin, manager, user, guest)
   - Permission configuration
   - Activity logging and auditing
   - Bulk user operations

2. **Role-Based Access Control**
   - Predefined role templates
   - Custom permission sets
   - Feature-level access control
   - Content-level permissions
   - API access management

3. **Authentication Management**
   - Authentication method configuration
   - Session policy settings
   - Password policy enforcement
   - Multi-factor authentication options
   - Access token management

### Dataset Management

The admin panel provides comprehensive dataset control:

1. **Dataset Operations**
   - Dataset upload and import (ZIP, CSV)
   - Dataset visualization and exploration
   - Version control and history
   - Quality assessment and metrics
   - Export and distribution capabilities

2. **Data Preparation Tools**
   - Dataset cleaning and validation
   - Class balancing and organization
   - Data augmentation workflows
   - Synthetic data generation
   - Incremental learning dataset preparation

3. **Quality Management**
   - Automated quality assessment
   - Issue detection and resolution
   - Class distribution visualization
   - Image quality metrics
   - Dataset comparison tools

### Queue Management

The admin panel includes unified queue management:

1. **Multi-Queue Interface**
   - PDF processing queue management
   - Web crawler queue management
   - Job status monitoring
   - Priority configuration
   - Resource allocation

2. **Job Controls**
   - Job creation and scheduling
   - Status monitoring and tracking
   - Cancellation and retry operations
   - Result inspection and validation
   - Error handling and resolution

3. **Performance Optimization**
   - Queue performance analytics
   - Throughput monitoring
   - Bottleneck identification
   - Resource utilization tracking
   - Scheduling optimization tools

### Knowledge Base Management

The admin panel provides comprehensive knowledge base tools:

1. **Content Management**
   - Material entry creation and editing
   - Collection and category organization
   - Relationship management
   - Version control and history
   - Bulk operations and imports

2. **Taxonomy Management**
   - Category hierarchy management
   - Metadata field configuration
   - Attribute management
   - Classification scheme maintenance
   - Controlled vocabulary management

3. **Quality Control**
   - Content validation tools
   - Consistency checking
   - Duplicate detection
   - Relationship verification
   - Missing data identification

### Model and Training Management

The admin panel includes ML model management:

1. **Model Operations**
   - Model training initialization
   - Training progress monitoring
   - Model evaluation and validation
   - Model deployment and activation
   - Version management and rollback

2. **Feature Engineering**
   - Feature descriptor generation
   - Vector index management
   - Embedding visualization
   - Feature importance analysis
   - Feature selection tools

3. **Training Configuration**
   - Hyperparameter configuration
   - Dataset selection and preparation
   - Validation strategy setup
   - Performance metric selection
   - Resource allocation management

### System Configuration

The admin panel provides system-wide configuration:

1. **General Settings**
   - System-wide parameters
   - Default values configuration
   - Notification settings
   - Integration management
   - Feature toggles and flags

2. **Integration Management**
   - External API credential management
   - Service provider configuration
   - Connection testing and validation
   - Usage quota monitoring
   - Authentication management

3. **Backup and Maintenance**
   - Database backup creation
   - Restore operations
   - System maintenance scheduling
   - Log management and rotation
   - Storage optimization tools

## Technical Implementation

### Admin Panel Architecture

The admin panel is built with Next.js for a performant React-based UI:

```typescript
// pages/index.tsx - Main entry point with redirection to dashboard
import { useEffect } from 'react';
import { useRouter } from 'next/router';

/**
 * Admin index page - redirects to dashboard
 */
export default function AdminIndex() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/dashboard');
  }, [router]);

  return (
    <div className="flex h-screen items-center justify-center">
      <div className="text-center">
        <h1 className="text-2xl font-semibold text-gray-800">Redirecting to dashboard...</h1>
        <div className="mt-4">
          <p>Loading the admin dashboard...</p>
        </div>
      </div>
    </div>
  );
}
```

### Layout and Navigation

The admin panel uses a consistent layout with sidebar navigation:

```typescript
// components/Layout.tsx
import { ReactNode } from 'react';
import Header from './Header';
import Sidebar from './Sidebar';

/**
 * Layout component for the admin panel
 */
export default function Layout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-100">
      <div className="flex">
        <Sidebar />
        <div className="flex-1">
          <Header />
          <main className="p-6">
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}

// components/Sidebar.tsx
import Link from 'next/link';
import { useRouter } from 'next/router';
import {
  HomeIcon, UsersIcon, DatabaseIcon,
  CogIcon, ChartBarIcon, CollectionIcon,
  CloudUploadIcon, QueueListIcon
} from '@heroicons/react/24/outline';

/**
 * Sidebar component for admin navigation
 */
export default function Sidebar() {
  const router = useRouter();
  const navItems = [
    { name: 'Dashboard', href: '/dashboard', icon: HomeIcon },
    { name: 'User Management', href: '/users', icon: UsersIcon },
    { name: 'Datasets', href: '/datasets', icon: DatabaseIcon },
    { name: 'Knowledge Base', href: '/knowledge-base', icon: CollectionIcon },
    { name: 'Queue Management', href: '/queue', icon: QueueListIcon },
    { name: 'Reports', href: '/reports', icon: ChartBarIcon },
    { name: 'Settings', href: '/settings', icon: CogIcon },
  ];

  return (
    <div className="w-64 bg-white h-screen shadow-sm overflow-y-auto">
      <div className="flex items-center justify-between h-16 px-4 border-b border-gray-200">
        <Link href="/dashboard">
          <div className="flex items-center cursor-pointer">
            <span className="text-xl font-semibold text-gray-800">Kai Admin</span>
          </div>
        </Link>
      </div>
      <nav className="mt-4">
        <ul>
          {navItems.map((item) => {
            const isActive = router.pathname === item.href || router.pathname.startsWith(`${item.href}/`);
            return (
              <li key={item.name} className="px-2 py-1">
                <Link href={item.href}>
                  <div className={`flex items-center px-4 py-2 rounded-md ${isActive ? 'bg-blue-50 text-blue-700' : 'text-gray-700 hover:bg-gray-50'}`}>
                    <item.icon className="w-5 h-5 mr-3" />
                    <span>{item.name}</span>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}
```

### Role-Based Access Control

The admin panel implements robust role-based access control:

```typescript
// middleware/auth.middleware.ts
import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { ApiError } from '../utils/apiError';

/**
 * Middleware to authenticate users via JWT
 */
export const authMiddleware = (req: Request, res: Response, next: NextFunction) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];

    if (!token) {
      throw new ApiError(401, 'Authentication required');
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET as string);
    req.user = decoded;

    next();
  } catch (error) {
    next(new ApiError(401, 'Invalid or expired token'));
  }
};

/**
 * Middleware to authorize users based on roles
 */
export const authorizeRoles = (roles: string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return next(new ApiError(401, 'Authentication required'));
    }

    if (!roles.includes(req.user.role)) {
      return next(new ApiError(403, 'Unauthorized access'));
    }

    next();
  };
};

// Usage in routes
router.use('/admin', authMiddleware, authorizeRoles(['admin']));
```

### API Routes

The admin panel integrates with dedicated API routes:

```typescript
// routes/admin.routes.ts
import { Router } from 'express';
import { authMiddleware, authorizeRoles } from '../middleware/auth.middleware';
import { asyncHandler } from '../utils/asyncHandler';
import { Request, Response } from 'express';

// Import the admin routes
import modelRoutes from './admin/model.routes';
import queueRoutes from './admin/queue.routes';
import categoryRoutes from './admin/category.routes';
import metadataFieldRoutes from './admin/metadataField.routes';
import knowledgeBaseRoutes from './admin/knowledgeBase.routes';
import datasetRoutes from './admin/dataset.routes';

const router = Router();

// All routes in this file require admin authentication
router.use(authMiddleware, authorizeRoles(['admin']));

/**
 * @route   GET /api/admin/dashboard
 * @desc    Get admin dashboard statistics
 * @access  Private (Admin)
 */
router.get('/dashboard', asyncHandler(async (req: Request, res: Response) => {
  const stats = await getDashboardStats();
  res.json(stats);
}));

// Mount specialized admin routes
router.use('/models', modelRoutes);
router.use('/queue', queueRoutes);
router.use('/categories', categoryRoutes);
router.use('/metadata-fields', metadataFieldRoutes);
router.use('/knowledge-base', knowledgeBaseRoutes);
router.use('/datasets', datasetRoutes);

export default router;
```

### Dataset Management Implementation

The admin panel includes comprehensive dataset management:

```typescript
// routes/admin/dataset.routes.ts
import { Router } from 'express';
import { authMiddleware, authorizeRoles } from '../../middleware/auth.middleware';
import { asyncHandler } from '../../utils/asyncHandler';
import { Request, Response } from 'express';
import multer from 'multer';
import supabaseDatasetService from '../../services/supabase/supabase-dataset-service';
import { zipExtractorService } from '../../services/datasets/zip-extractor.service';
import { csvParserService } from '../../services/datasets/csv-parser.service';
import { datasetManagementService } from '../../services/datasets/dataset-management.service';
import { ApiError } from '../../utils/apiError';
import { logger } from '../../utils/logger';

const router = Router();
const upload = multer({ dest: 'uploads/' });

// All routes protected by admin authentication
router.use(authMiddleware, authorizeRoles(['admin']));

/**
 * @route   GET /api/admin/datasets
 * @desc    Get all datasets with pagination
 */
router.get('/', asyncHandler(async (req: Request, res: Response) => {
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 10;
  const query = req.query.q;

  // Search datasets
  const result = await supabaseDatasetService.searchDatasets({
    query: query as string,
    page,
    limit
  });

  return res.json(result);
}));

/**
 * @route   POST /api/admin/datasets/upload/zip
 * @desc    Upload and process a ZIP dataset
 */
router.post('/upload/zip', upload.single('file'), asyncHandler(async (req: Request, res: Response) => {
  if (!req.file) {
    throw new ApiError(400, 'No file uploaded');
  }

  const { name, description } = req.body;

  if (!name) {
    throw new ApiError(400, 'Dataset name is required');
  }

  // Process the uploaded ZIP file
  const result = await zipExtractorService.extractDataset(
    req.file.path,
    name,
    description
  );

  return res.json(result);
}));

// Additional routes for dataset management...

export default router;
```

### Queue Management Implementation

The admin panel provides unified queue management:

```typescript
// routes/admin/queue.routes.ts
import { Router } from 'express';
import { authMiddleware, authorizeRoles } from '../../middleware/auth.middleware';
import { asyncHandler } from '../../utils/asyncHandler';
import { Request, Response } from 'express';
import { ApiError } from '../../utils/apiError';
import {
  getJobs,
  getJobById,
  retryJob,
  cancelJob,
  clearQueue,
  getQueueStats,
  getSourceFilters
} from '../../controllers/queue.controller';

const router = Router();

// All routes in this file require admin authentication
router.use(authMiddleware, authorizeRoles(['admin']));

/**
 * @route   GET /api/admin/queue
 * @desc    Get all jobs from both queue systems with filtering
 */
router.get('/', asyncHandler(async (req: Request, res: Response) => {
  const queueSystem = req.query.system as 'pdf' | 'crawler' | 'all' | undefined;
  const status = req.query.status as string | undefined;
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 10;

  const jobs = await getJobs({
    queueSystem,
    status,
    page,
    limit
  });

  res.json(jobs);
}));

/**
 * @route   GET /api/admin/queue/stats
 * @desc    Get statistics for both queue systems
 */
router.get('/stats', asyncHandler(async (req: Request, res: Response) => {
  const stats = await getQueueStats();
  res.json(stats);
}));

// Additional routes for queue management...

export default router;
```

## Integration with Other Systems

### PDF Processing Integration

The admin panel integrates with the PDF processing system:

1. **Queue Management**
   - PDF job creation and submission
   - Status monitoring and tracking
   - Result inspection and validation
   - Error handling and resolution
   - Performance analytics

2. **Configuration Management**
   - OCR settings configuration
   - Processing parameters adjustment
   - Custom extraction rule creation
   - Template management
   - Output format configuration

3. **Result Management**
   - Extracted content review
   - Manual correction interface
   - Quality assessment tools
   - Approval workflows
   - Batch processing controls

### Web Crawler Integration

The admin panel integrates with the web crawler system:

1. **Crawler Management**
   - Crawler configuration creation
   - Job scheduling and execution
   - Status monitoring and control
   - Result inspection and validation
   - Performance tuning

2. **Credential Management**
   - API key storage and encryption
   - Provider configuration
   - Connection testing
   - Usage monitoring
   - Security management

3. **Data Integration**
   - Crawler-to-training pipeline configuration
   - Data transformation settings
   - Quality threshold configuration
   - Auto-training settings
   - Result analysis tools

### Vector Database Integration

The admin panel integrates with the vector database:

1. **Index Management**
   - Vector index creation and configuration
   - Embedding dimension configuration
   - Similarity metric selection
   - Index performance monitoring
   - Reindexing and optimization tools

2. **Search Configuration**
   - Search parameter adjustment
   - Weight configuration for hybrid search
   - Threshold setting for matches
   - Result count configuration
   - Performance monitoring

3. **Data Visualization**
   - Embedding space visualization
   - Cluster analysis tools
   - Similarity mapping
   - Outlier detection
   - Dimensionality reduction visualization

### ML Pipeline Integration

The admin panel integrates with the ML pipeline:

1. **Training Management**
   - Training job creation and configuration
   - Progress monitoring with visualizations
   - Performance metric tracking
   - Early stopping controls
   - Resource allocation management

2. **Model Management**
   - Model comparison and selection
   - A/B testing configuration
   - Deployment and activation
   - Version control and rollback
   - Performance monitoring

3. **Dataset Pipeline**
   - Dataset-to-training workflow management
   - Data preprocessing configuration
   - Validation strategy selection
   - Augmentation parameter tuning
   - Cross-validation configuration

## Usage Examples

### Dashboard Navigation

```typescript
import { useEffect, useState } from 'react';
import Layout from '../components/Layout';
import StatCard from '../components/StatCard';
import QueueStatusChart from '../components/QueueStatusChart';
import RecentActivityList from '../components/RecentActivityList';
import SystemHealthIndicator from '../components/SystemHealthIndicator';

export default function DashboardPage() {
  const [stats, setStats] = useState({
    users: 0,
    materials: 0,
    datasets: 0,
    activeJobs: 0,
    systemHealth: 'normal'
  });

  useEffect(() => {
    // Fetch dashboard statistics
    async function fetchStats() {
      try {
        const response = await fetch('/api/admin/dashboard');
        const data = await response.json();
        setStats(data);
      } catch (error) {
        console.error('Failed to fetch dashboard stats:', error);
      }
    }

    fetchStats();

    // Set up polling for real-time updates
    const interval = setInterval(fetchStats, 30000); // Update every 30 seconds

    return () => clearInterval(interval);
  }, []);

  return (
    <Layout>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-gray-800">Dashboard</h1>
        <p className="text-gray-600">Welcome to the Kai Material Recognition System admin panel.</p>
      </div>

      <SystemHealthIndicator status={stats.systemHealth} />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <StatCard title="Users" value={stats.users} icon="users" />
        <StatCard title="Materials" value={stats.materials} icon="database" />
        <StatCard title="Datasets" value={stats.datasets} icon="folder" />
        <StatCard title="Active Jobs" value={stats.activeJobs} icon="cog" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <QueueStatusChart />
        <RecentActivityList />
      </div>
    </Layout>
  );
}
```

### Dataset Upload Management

```typescript
import { useState } from 'react';
import { useRouter } from 'next/router';
import Layout from '../../components/Layout';
import { Button, TextField, FileUpload, ProgressIndicator, Alert } from '../../components/ui';

export default function DatasetUploadPage() {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const handleFileChange = (selectedFile: File | null) => {
    setFile(selectedFile);
    // Auto-generate name from filename if not already set
    if (!name && selectedFile) {
      setName(selectedFile.name.split('.')[0]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!file) {
      setError('Please select a file to upload');
      return;
    }

    if (!name) {
      setError('Dataset name is required');
      return;
    }

    setLoading(true);
    setError(null);

    // Create form data
    const formData = new FormData();
    formData.append('file', file);
    formData.append('name', name);
    formData.append('description', description);

    try {
      // Determine endpoint based on file type
      const endpoint = file.name.endsWith('.zip')
        ? '/api/admin/datasets/upload/zip'
        : '/api/admin/datasets/upload/csv';

      // Upload the dataset
      const response = await fetch(endpoint, {
        method: 'POST',
        body: formData,
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to upload dataset');
      }

      const result = await response.json();

      // Redirect to the dataset details page
      router.push(`/datasets/${result.dataset.id}`);
    } catch (error) {
      setError(error instanceof Error ? error.message : 'An unknown error occurred');
      setLoading(false);
    }
  };

  const handleDownloadTemplate = () => {
    window.open('/api/admin/datasets/templates/csv', '_blank');
  };

  return (
    <Layout>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-gray-800">Upload Dataset</h1>
        <p className="text-gray-600">Upload a new dataset for training and recognition.</p>
      </div>

      {error && (
        <Alert type="error" title="Upload Error" message={error} onClose={() => setError(null)} />
      )}

      <div className="bg-white shadow-sm rounded-lg p-6">
        <form onSubmit={handleSubmit}>
          <div className="mb-6">
            <TextField
              label="Dataset Name"
              value={name}
              onChange={setName}
              required
              placeholder="Enter a descriptive name for the dataset"
            />
          </div>

          <div className="mb-6">
            <TextField
              label="Description"
              value={description}
              onChange={setDescription}
              multiline
              rows={3}
              placeholder="Optional description of the dataset"
            />
          </div>

          <div className="mb-6">
            <FileUpload
              label="Upload Dataset File"
              accept=".zip,.csv"
              onChange={handleFileChange}
              helpText="Accepted formats: ZIP (for image datasets) or CSV (for reference data)"
            />
          </div>

          <div className="flex items-center justify-between">
            <Button
              type="button"
              variant="secondary"
              onClick={handleDownloadTemplate}
            >
              Download CSV Template
            </Button>

            <Button
              type="submit"
              variant="primary"
              disabled={loading || !file || !name}
            >
              {loading ? 'Uploading...' : 'Upload Dataset'}
            </Button>
          </div>

          {loading && (
            <div className="mt-4">
              <ProgressIndicator progress={progress} />
              <p className="text-sm text-gray-600 mt-2">
                Uploading and processing dataset. This may take several minutes for large files.
              </p>
            </div>
          )}
        </form>
      </div>
    </Layout>
  );
}
```

### Queue Management Interface

```typescript
import { useEffect, useState } from 'react';
import Layout from '../../components/Layout';
import {
  Table,
  Button,
  Select,
  Pagination,
  Badge,
  Dialog,
  Alert
} from '../../components/ui';
import {
  getQueueJobs,
  getQueueStats,
  retryQueueJob,
  cancelQueueJob,
  clearQueue
} from '../../services/queue.service';
import JobDetailsDialog from '../../components/admin/JobDetailsDialog';

export default function QueueDashboardPage() {
  const [jobs, setJobs] = useState([]);
  const [stats, setStats] = useState({
    pdf: { total: 0, byStatus: {} },
    crawler: { total: 0, byStatus: {}, byProvider: {} }
  });

  const [filter, setFilter] = useState({
    queueSystem: 'all',
    status: '',
    page: 1,
    limit: 10
  });

  const [detailsDialog, setDetailsDialog] = useState({
    open: false,
    jobId: '',
    system: 'pdf'
  });

  const [clearQueueDialog, setClearQueueDialog] = useState({
    open: false,
    system: 'pdf'
  });

  const [action, setAction] = useState(null);
  const [actionSuccess, setActionSuccess] = useState(null);
  const [error, setError] = useState(null);

  // Load jobs and stats
  useEffect(() => {
    fetchJobs();
    fetchStats();
  }, [filter]);

  const fetchJobs = async () => {
    try {
      const data = await getQueueJobs({
        system: filter.queueSystem,
        status: filter.status,
        page: filter.page,
        limit: filter.limit
      });

      setJobs(data.jobs);
    } catch (err) {
      setError('Failed to fetch jobs: ' + err.message);
    }
  };

  const fetchStats = async () => {
    try {
      const statsData = await getQueueStats();
      setStats(statsData);
    } catch (err) {
      setError('Failed to fetch queue statistics: ' + err.message);
    }
  };

  // Handle job actions
  const handleJobAction = async (type, jobId, system) => {
    setAction({ type, jobId, system });
    setActionSuccess(null);
    setError(null);

    try {
      if (type === 'retry') {
        const result = await retryQueueJob(jobId, system);
        setActionSuccess(`Job ${jobId} queued for retry`);
      } else if (type === 'cancel') {
        const result = await cancelQueueJob(jobId, system);
        setActionSuccess(`Job ${jobId} cancelled successfully`);
      }

      // Refresh data
      fetchJobs();
      fetchStats();
    } catch (err) {
      setError(`Failed to ${type} job: ${err.message}`);
    } finally {
      setAction(null);
    }
  };

  // Handle clear queue
  const handleClearQueue = async (system) => {
    try {
      const result = await clearQueue(system);
      setActionSuccess(`Cleared ${result.count} jobs from ${system} queue`);
      setClearQueueDialog({ open: false, system: 'pdf' });

      // Refresh data
      fetchJobs();
      fetchStats();
    } catch (err) {
      setError(`Failed to clear queue: ${err.message}`);
    }
  };

  return (
    <Layout>
      <div className="mb-6 flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-semibold text-gray-800">Queue Management</h1>
          <p className="text-gray-600">Manage PDF processing and crawler job queues</p>
        </div>

        <div className="flex space-x-4">
          <Button
            variant="secondary"
            onClick={() => handleOpenClearQueueDialog('pdf')}
          >
            Clear PDF Queue
          </Button>

          <Button
            variant="secondary"
            onClick={() => handleOpenClearQueueDialog('crawler')}
          >
            Clear Crawler Queue
          </Button>
        </div>
      </div>

      {/* Status cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        <div className="bg-white shadow-sm rounded-lg p-6">
          <h2 className="text-lg font-semibold mb-4">PDF Processing Queue</h2>
          <div className="flex justify-between items-center">
            <div>
              <div className="text-3xl font-bold">
                {stats.pdf.total}
              </div>
              <div className="text-sm text-gray-500">Total Jobs</div>
            </div>
            <div>
              {Object.entries(stats.pdf.byStatus).map(([status, count]) => (
                <Badge
                  key={status}
                  color={getStatusColor(status)}
                  className="mr-2 mb-2"
                >
                  {status}: {count}
                </Badge>
              ))}
            </div>
          </div>
        </div>

        <div className="bg-white shadow-sm rounded-lg p-6">
          <h2 className="text-lg font-semibold mb-4">Crawler Queue</h2>
          <div className="flex justify-between items-center">
            <div>
              <div className="text-3xl font-bold">
                {stats.crawler.total}
              </div>
              <div className="text-sm text-gray-500">Total Jobs</div>
            </div>
            <div>
              {Object.entries(stats.crawler.byStatus).map(([status, count]) => (
                <Badge
                  key={status}
                  color={getStatusColor(status)}
                  className="mr-2 mb-2"
                >
                  {status}: {count}
                </Badge>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Filter controls */}
      <div className="bg-white shadow-sm rounded-lg p-6 mb-6">
        <div className="flex flex-wrap gap-4">
          <div className="w-full md:w-auto">
            <Select
              label="Queue System"
              value={filter.queueSystem}
              onChange={(value) => setFilter({...filter, queueSystem: value, page: 1})}
              options={[
                { value: 'all', label: 'All Systems' },
                { value: 'pdf', label: 'PDF Processing' },
                { value: 'crawler', label: 'Web Crawler' }
              ]}
            />
          </div>

          <div className="w-full md:w-auto">
            <Select
              label="Status"
              value={filter.status}
              onChange={(value) => setFilter({...filter, status: value, page: 1})}
              options={[
                { value: '', label: 'All Statuses' },
                { value: 'pending', label: 'Pending' },
                { value: 'processing', label: 'Processing' },
                { value: 'completed', label: 'Completed' },
                { value: 'failed', label: 'Failed' },
                { value: 'canceled', label: 'Canceled' }
              ]}
            />
          </div>
        </div>
      </div>

      {/* Jobs table */}
      <div className="bg-white shadow-sm rounded-lg overflow-hidden">
        <Table
          columns={[
            { key: 'id', header: 'Job ID' },
            { key: 'queueSystem', header: 'System' },
            { key: 'status', header: 'Status' },
            { key: 'source', header: 'Source' },
            { key: 'createdAt', header: 'Created' },
            { key: 'actions', header: 'Actions' }
          ]}
          data={jobs.map(job => ({
            ...job,
            status: (
              <Badge color={getStatusColor(job.status)}>
                {job.status}
              </Badge>
            ),
            createdAt: new Date(job.createdAt).toLocaleString(),
            actions: (
              <div className="flex space-x-2">
                <Button
                  size="sm"
                  variant="text"
                  onClick={() => handleOpenDetails(job.id, job.queueSystem)}
                >
                  Details
                </Button>

                {job.status === 'failed' && (
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => handleJobAction('retry', job.id, job.queueSystem)}
                    disabled={action && action.jobId === job.id}
                  >
                    Retry
                  </Button>
                )}

                {['pending', 'processing'].includes(job.status) && (
                  <Button
                    size="sm"
                    variant="danger"
                    onClick={() => handleJobAction('cancel', job.id, job.queueSystem)}
                    disabled={action && action.jobId === job.id}
                  >
                    Cancel
                  </Button>
                )}
              </div>
            )
          }))}
          emptyState={% raw %}{{
            message: 'No jobs found matching the current filters',
            action: {
              label: 'Clear Filters',
              onClick: () => setFilter({
                queueSystem: 'all',
                status: '',
                page: 1,
                limit: 10
              })
            }
          }}{% endraw %}
        />

        <div className="p-4 border-t">
          <Pagination
            currentPage={filter.page}
            pageSize={filter.limit}
            totalItems={100} // This would come from the API
            onPageChange={(page) => setFilter({% raw %}{{...filter, page}}{% endraw %})}
          />
        </div>
      </div>

      {/* Job details dialog */}
      <JobDetailsDialog
        open={detailsDialog.open}
        jobId={detailsDialog.jobId}
        system={detailsDialog.system}
        onClose={() => setDetailsDialog({% raw %}{{...detailsDialog, open: false}}{% endraw %})}
        onActionComplete={() => {
          fetchJobs();
          fetchStats();
        }}
      />

      {/* Clear queue confirmation dialog */}
      <Dialog
        open={clearQueueDialog.open}
        title={`Clear ${clearQueueDialog.system === 'pdf' ? 'PDF Processing' : 'Web Crawler'} Queue`}
        content={`Are you sure you want to clear all jobs from the ${clearQueueDialog.system} queue? This action cannot be undone.`}
        actions={[
          {
            label: 'Cancel',
            variant: 'text',
            onClick: () => setClearQueueDialog({% raw %}{{...clearQueueDialog, open: false}}{% endraw %})
          },
          {
            label: 'Clear Queue',
            variant: 'danger',
            onClick: () => handleClearQueue(clearQueueDialog.system)
          }
        ]}
        onClose={() => setClearQueueDialog({% raw %}{{...clearQueueDialog, open: false}}{% endraw %})}
      />

      {/* Action messages */}
      {actionSuccess && (
        <Alert
          type="success"
          title="Success"
          message={actionSuccess}
          onClose={() => setActionSuccess(null)}
          className="fixed bottom-4 right-4 z-50"
        />
      )}

      {error && (
        <Alert
          type="error"
          title="Error"
          message={error}
          onClose={() => setError(null)}
          className="fixed bottom-4 right-4 z-50"
        />
      )}
    </Layout>
  );
}

// Helper function to map status to color
const getStatusColor = (status) => {
  switch (status) {
    case 'completed': return 'green';
    case 'processing': return 'blue';
    case 'pending': return 'yellow';
    case 'failed': return 'red';
    case 'canceled': return 'gray';
    default: return 'gray';
  }
};
```

## Configuration

### Deployment

The admin panel can be deployed in various configurations:

1. **Development Environment**
   - Local development server with hot reloading
   - Environment variables for development settings
   - Mock data for rapid UI development
   - Debugging tools enabled
   - Performance profiling available

2. **Production Deployment**
   - Optimized production build with code splitting
   - Server-side rendering for improved performance
   - Content delivery network integration
   - Secure cookie settings
   - Error monitoring and reporting

3. **Customization Options**
   - Branding and theme customization
   - Feature toggle configuration
   - Role permission mapping
   - Notification settings
   - Integration points with external systems

### Access Control Configuration

The admin panel supports customizable access control:

```typescript
// Settings for role-based access control
const rolePermissions = {
  admin: {
    // Full access to all features
    dashboard: ['view', 'manage'],
    users: ['view', 'create', 'edit', 'delete'],
    datasets: ['view', 'create', 'edit', 'delete', 'upload', 'train'],
    knowledgeBase: ['view', 'create', 'edit', 'delete', 'import', 'export'],
    queue: ['view', 'manage', 'cancel', 'retry', 'clear'],
    settings: ['view', 'edit']
  },
  manager: {
    // Limited administrative access
    dashboard: ['view'],
    users: ['view'],
    datasets: ['view', 'create', 'edit', 'upload', 'train'],
    knowledgeBase: ['view', 'create', 'edit', 'import'],
    queue: ['view', 'manage', 'cancel', 'retry'],
    settings: ['view']
  },
  user: {
    // Basic access for regular users
    dashboard: ['view'],
    datasets: ['view'],
    knowledgeBase: ['view'],
    queue: ['view']
  }
};

// Configuration for authentication methods
const authConfig = {
  methods: ['jwt', 'oauth'],
  sessionTimeout: 3600, // 1 hour
  refreshTokens: true,
  passwordPolicy: {
    minLength: 10,
    requireSpecialChars: true,
    requireNumbers: true,
    requireUppercase: true,
    expiration: 90 // days
  },
  mfa: {
    enabled: true,
    methods: ['app', 'email']
  }
};
```

### Notification Configuration

The admin panel includes configurable notifications:

```typescript
// Notification settings for admin users
const notificationConfig = {
  channels: {
    email: {
      enabled: true,
      throttle: 3600 // seconds between similar notifications
    },
    inApp: {
      enabled: true,
      maxUnread: 100
    },
    slack: {
      enabled: false,
      webhookUrl: ''
    }
  },
  events: {
    userActivity: {
      loginAttempts: {
        failed: {
          threshold: 5,
          channels: ['email', 'inApp']
        }
      }
    },
    system: {
      queueErrors: {
        threshold: 10,
        channels: ['email', 'inApp']
      },
      storageWarning: {
        threshold: 0.9, // 90% usage
        channels: ['email', 'inApp']
      }
    },
    training: {
      modelCompleted: {
        channels: ['inApp']
      },
      modelError: {
        channels: ['email', 'inApp']
      }
    }
  },
  recipients: {
    admins: ['admin@example.com'],
    technicalTeam: ['tech@example.com']
  }
};
```

### Performance Considerations

1. **UI Optimization**
   - Code splitting for faster initial loading
   - Virtualized lists for large datasets
   - Lazy loading for secondary content
   - Debounced search inputs
   - Optimized rendering for large tables

2. **API Efficiency**
   - Pagination for large result sets
   - Filtered queries to minimize data transfer
   - Caching for frequently accessed data
   - ETags for conditional requests
   - Compression for response payload

3. **Authentication Performance**
   - Token-based authentication for stateless scaling
   - Refresh token rotation for long sessions
   - Permission caching for access checks
   - Rate limiting for security
   - Efficient role hierarchy traversal