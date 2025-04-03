/**
 * Dataset service base types
 */

/**
 * Dataset model
 */
export interface Dataset {
  id: string;
  name: string;
  description?: string;
  createdBy?: string;
  createdAt: Date;
  updatedAt: Date;
  status: 'created' | 'processing' | 'ready' | 'error';
  classCount: number;
  imageCount: number;
  metadata?: Record<string, any>;
}

/**
 * Dataset class model
 */
export interface DatasetClass {
  id: string;
  datasetId: string;
  name: string;
  description?: string;
  imageCount: number;
  metadata?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Dataset image model
 */
export interface DatasetImage {
  id: string;
  datasetId: string;
  classId: string;
  storagePath: string;
  filename: string;
  fileSize?: number;
  width?: number;
  height?: number;
  format?: string;
  materialId?: string;
  metadata?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
  file?: File | Blob;
}

/**
 * Dataset search options
 */
export interface DatasetSearchOptions {
  query?: string;
  status?: 'created' | 'processing' | 'ready' | 'error' | Array<'created' | 'processing' | 'ready' | 'error'>;
  limit?: number;
  offset?: number;
  sort?: {
    field: string;
    direction: 'asc' | 'desc';
  };
}

/**
 * Map Supabase error codes to DatasetErrorType
 */
export const mapSupabaseError = (code: string): DatasetErrorType => {
  switch (code) {
    case 'PGRST116':
      return 'NOT_FOUND';
    case '23505':
      return 'ALREADY_EXISTS';
    case '42P01':
    case '42703':
      return 'INVALID_DATA';
    case '42501':
    case '42503':
      return 'PERMISSION_DENIED';
    default:
      return 'UNKNOWN';
  }
};

/**
 * Dataset search result
 */
export interface DatasetSearchResult {
  datasets: Dataset[];
  total: number;
}

/**
 * Dataset statistics
 */
export interface DatasetStats {
  totalDatasets: number;
  totalImages: number;
  datasetsByStatus: Record<string, number>;
  largestDatasets: Array<{ id: string; name: string; imageCount: number }>;
}

/**
 * Dataset error types
 */
export type DatasetErrorType = 
  | 'NOT_FOUND'
  | 'ALREADY_EXISTS'
  | 'INVALID_DATA'
  | 'STORAGE_ERROR'
  | 'PERMISSION_DENIED'
  | 'UNKNOWN';

/**
 * Dataset error
 */
export class DatasetError extends Error {
  constructor(
    message: string,
    public readonly type: DatasetErrorType,
    public readonly cause?: Error
  ) {
    super(message);
    this.name = 'DatasetError';
  }
}

/**
 * Dataset provider interface
 */
export interface DatasetProvider {
  // Dataset operations
  createDataset(data: Partial<Dataset>): Promise<Dataset>;
  getDatasetById(id: string): Promise<Dataset | null>;
  updateDataset(id: string, data: Partial<Dataset>): Promise<Dataset | null>;
  deleteDataset(id: string): Promise<Dataset | null>;
  searchDatasets(options?: DatasetSearchOptions): Promise<DatasetSearchResult>;

  // Class operations
  createDatasetClass(data: Partial<DatasetClass>): Promise<DatasetClass>;
  getDatasetClasses(datasetId: string): Promise<DatasetClass[]>;
  deleteDatasetClass(classId: string): Promise<DatasetClass | null>;

  // Image operations
  createDatasetImage(data: Partial<DatasetImage>): Promise<DatasetImage>;
  getDatasetClassImages(classId: string, limit?: number, offset?: number): Promise<DatasetImage[]>;
  deleteDatasetImage(imageId: string): Promise<DatasetImage | null>;
  getSignedImageUrl(storagePath: string, expiresIn?: number): Promise<string>;

  // Statistics
  getDatasetStats(): Promise<DatasetStats>;
}