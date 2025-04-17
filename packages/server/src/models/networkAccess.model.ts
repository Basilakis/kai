/**
 * Network Access Control Model
 * 
 * Defines database models for network access control:
 * - InternalNetwork: Defines CIDR ranges considered internal
 * - EndpointAccess: Defines access rules for API endpoints
 * - RateLimit: Defines rate limiting rules for network sources
 */

export interface InternalNetwork {
  id: string;
  cidr: string;         // CIDR notation (e.g., "10.0.0.0/8")
  description: string;  // Description of this network range (e.g., "Office Network")
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Defines rate limiting rules for specific networks
 */
export interface RateLimit {
  id: string;
  network: string;       // Network in CIDR notation or specific IP
  description: string;   // Description (e.g., "Office Network")
  requestsPerMinute: number; // Maximum requests per minute
  createdAt: Date;
  updatedAt: Date;
}

/**
 * System-wide rate limit settings
 */
export interface RateLimitSettings {
  id: string;
  defaultRateLimit: number; // Default rate limit (requests per minute) for all sources
  enabled: boolean;     // Whether rate limiting is enabled system-wide
  updatedAt: Date;
}

/**
 * Access types for API endpoints
 */
export enum AccessType {
  ANY = 'any',                  // No restrictions
  INTERNAL_ONLY = 'internal',   // Internal network only
  EXTERNAL_ONLY = 'external'    // External network only (rare, but for completeness)
}

/**
 * Defines access rules for API endpoints
 */
export interface EndpointAccess {
  id: string;
  path: string;          // API endpoint path pattern (e.g., "/api/admin/analytics/*")
  method: string;        // HTTP method (GET, POST, PUT, DELETE, etc.)
  accessType: AccessType; // Access type (internal, external, any)
  description: string;   // Description of this endpoint
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Default internal networks
 */
export const DEFAULT_INTERNAL_NETWORKS: Partial<InternalNetwork>[] = [
  {
    cidr: '127.0.0.1/8',
    description: 'Localhost'
  },
  {
    cidr: '10.0.0.0/8',
    description: 'Private network (Class A)'
  },
  {
    cidr: '172.16.0.0/12',
    description: 'Private network (Class B)'
  },
  {
    cidr: '192.168.0.0/16',
    description: 'Private network (Class C)'
  }
];

/**
 * Default rate limit settings
 */
export const DEFAULT_RATE_LIMIT_SETTINGS: Partial<RateLimitSettings> = {
  defaultRateLimit: 30, // 30 requests per minute by default
  enabled: true
};

/**
 * Default custom rate limits
 */
export const DEFAULT_CUSTOM_RATE_LIMITS: Partial<RateLimit>[] = [
  {
    network: '10.0.0.0/8',
    description: 'Internal Network',
    requestsPerMinute: 300 // Higher limit for internal networks
  },
  {
    network: '127.0.0.1/8',
    description: 'Localhost',
    requestsPerMinute: 600 // Even higher limit for localhost
  }
];

/**
 * Default sensitive endpoints that should be internal-only
 */
export const DEFAULT_RESTRICTED_ENDPOINTS: Partial<EndpointAccess>[] = [
  // Existing endpoints
  {
    path: '/api/admin/analytics/data',
    method: 'DELETE',
    accessType: AccessType.INTERNAL_ONLY,
    description: 'Delete analytics data'
  },
  {
    path: '/api/admin/settings',
    method: 'PUT',
    accessType: AccessType.INTERNAL_ONLY,
    description: 'Update system settings'
  },
  {
    path: '/api/admin/training/:jobId/stop',
    method: 'POST',
    accessType: AccessType.INTERNAL_ONLY,
    description: 'Stop ML training job'
  },
  {
    path: '/api/admin/users',
    method: 'POST',
    accessType: AccessType.INTERNAL_ONLY,
    description: 'Create new admin user'
  },
  {
    path: '/api/admin/database/backup',
    method: 'POST',
    accessType: AccessType.INTERNAL_ONLY,
    description: 'Trigger database backup'
  },

  // Dataset endpoints - all internal only
  {
    path: '/api/admin/datasets',
    method: 'GET',
    accessType: AccessType.INTERNAL_ONLY,
    description: 'List all datasets'
  },
  {
    path: '/api/admin/datasets/:id',
    method: 'GET',
    accessType: AccessType.INTERNAL_ONLY,
    description: 'Get dataset details'
  },
  {
    path: '/api/admin/datasets/upload/zip',
    method: 'POST',
    accessType: AccessType.INTERNAL_ONLY,
    description: 'Upload ZIP dataset'
  },
  {
    path: '/api/admin/datasets/upload/csv',
    method: 'POST',
    accessType: AccessType.INTERNAL_ONLY,
    description: 'Upload CSV dataset'
  },
  {
    path: '/api/admin/datasets/import/premade',
    method: 'POST',
    accessType: AccessType.INTERNAL_ONLY,
    description: 'Import premade dataset'
  },
  {
    path: '/api/admin/datasets/:id/split',
    method: 'POST',
    accessType: AccessType.INTERNAL_ONLY,
    description: 'Split dataset into train/validation/test sets'
  },
  {
    path: '/api/admin/datasets/:id/train',
    method: 'POST',
    accessType: AccessType.INTERNAL_ONLY,
    description: 'Start training job for dataset'
  },
  {
    path: '/api/admin/datasets/:id/quality',
    method: 'GET',
    accessType: AccessType.INTERNAL_ONLY,
    description: 'Get dataset quality metrics'
  },
  {
    path: '/api/admin/datasets/:id',
    method: 'DELETE',
    accessType: AccessType.INTERNAL_ONLY,
    description: 'Delete dataset'
  },
  {
    path: '/api/admin/datasets/:id/classes',
    method: 'GET',
    accessType: AccessType.INTERNAL_ONLY,
    description: 'List dataset classes'
  },
  {
    path: '/api/admin/datasets/:id/images',
    method: 'GET',
    accessType: AccessType.INTERNAL_ONLY,
    description: 'List dataset images'
  },

  // Training job endpoints - all internal only
  {
    path: '/api/admin/training/:jobId/status',
    method: 'GET',
    accessType: AccessType.INTERNAL_ONLY,
    description: 'Get training job status'
  },
  {
    path: '/api/admin/training/:jobId/metrics',
    method: 'GET',
    accessType: AccessType.INTERNAL_ONLY,
    description: 'Get training job metrics'
  },

  // API Key endpoints
  {
    path: '/api/auth/api-keys',
    method: 'GET',
    accessType: AccessType.ANY,
    description: 'Get user API keys'
  },
  {
    path: '/api/auth/api-keys/:keyId',
    method: 'GET',
    accessType: AccessType.ANY,
    description: 'Get API key by ID'
  },
  {
    path: '/api/auth/api-keys',
    method: 'POST',
    accessType: AccessType.ANY,
    description: 'Create API key'
  },
  {
    path: '/api/auth/api-keys/:keyId',
    method: 'PUT',
    accessType: AccessType.ANY,
    description: 'Update API key'
  },
  {
    path: '/api/auth/api-keys/:keyId',
    method: 'DELETE',
    accessType: AccessType.ANY,
    description: 'Delete API key'
  },
  {
    path: '/api/auth/api-keys/scopes',
    method: 'GET',
    accessType: AccessType.ANY,
    description: 'Get available API key scopes'
  },

  // Team subscription endpoints
  {
    path: '/api/subscriptions/teams',
    method: 'GET',
    accessType: AccessType.ANY,
    description: 'Get user teams'
  },
  {
    path: '/api/subscriptions/teams/:teamId',
    method: 'GET',
    accessType: AccessType.ANY,
    description: 'Get team by ID'
  },
  {
    path: '/api/subscriptions/teams',
    method: 'POST',
    accessType: AccessType.ANY,
    description: 'Create team'
  },
  {
    path: '/api/subscriptions/teams/:teamId',
    method: 'PUT',
    accessType: AccessType.ANY,
    description: 'Update team'
  },
  {
    path: '/api/subscriptions/teams/:teamId',
    method: 'DELETE',
    accessType: AccessType.ANY,
    description: 'Delete team'
  },
  {
    path: '/api/subscriptions/teams/:teamId/members',
    method: 'GET',
    accessType: AccessType.ANY,
    description: 'Get team members'
  },
  {
    path: '/api/subscriptions/teams/:teamId/members',
    method: 'POST',
    accessType: AccessType.ANY,
    description: 'Invite team member'
  },
  {
    path: '/api/subscriptions/teams/:teamId/members/accept',
    method: 'POST',
    accessType: AccessType.ANY,
    description: 'Accept team invitation'
  },
  {
    path: '/api/subscriptions/teams/:teamId/members/:memberId',
    method: 'PUT',
    accessType: AccessType.ANY,
    description: 'Update team member'
  },
  {
    path: '/api/subscriptions/teams/:teamId/members/:memberId',
    method: 'DELETE',
    accessType: AccessType.ANY,
    description: 'Remove team member'
  },
  {
    path: '/api/subscriptions/teams/:teamId/seats',
    method: 'PUT',
    accessType: AccessType.ANY,
    description: 'Update team seats'
  },
  {
    path: '/api/subscriptions/teams/:teamId/tier',
    method: 'PUT',
    accessType: AccessType.ANY,
    description: 'Change team subscription tier'
  },
  {
    path: '/api/subscriptions/teams/:teamId/cancel',
    method: 'POST',
    accessType: AccessType.ANY,
    description: 'Cancel team subscription'
  },
  {
    path: '/api/subscriptions/teams/:teamId/billing-preview',
    method: 'GET',
    accessType: AccessType.ANY,
    description: 'Get team billing preview'
  },

  // Credit system endpoints
  {
    path: '/api/credits/transfer',
    method: 'POST',
    accessType: AccessType.ANY,
    description: 'Transfer credits to another user'
  },
  {
    path: '/api/credits/transfer/history',
    method: 'GET',
    accessType: AccessType.ANY,
    description: 'Get credit transfer history'
  },
  {
    path: '/api/credits/transfer/:transferId',
    method: 'GET',
    accessType: AccessType.ANY,
    description: 'Get credit transfer by ID'
  },
  {
    path: '/api/credits/transfer/find-user',
    method: 'GET',
    accessType: AccessType.ANY,
    description: 'Find user by email for credit transfer'
  },
  {
    path: '/api/credits/topup',
    method: 'POST',
    accessType: AccessType.ANY,
    description: 'Top up user credits'
  },
  {
    path: '/api/credits/alerts',
    method: 'GET',
    accessType: AccessType.ANY,
    description: 'Get credit alerts'
  },
  {
    path: '/api/credits/alerts',
    method: 'POST',
    accessType: AccessType.ANY,
    description: 'Create credit alert'
  },
  {
    path: '/api/credits/alerts/:alertId',
    method: 'PUT',
    accessType: AccessType.ANY,
    description: 'Update credit alert'
  },
  {
    path: '/api/credits/alerts/:alertId',
    method: 'DELETE',
    accessType: AccessType.ANY,
    description: 'Delete credit alert'
  },
  {
    path: '/api/credits/bulk',
    method: 'POST',
    accessType: AccessType.INTERNAL_ONLY,
    description: 'Bulk credit management (admin only)'
  }
];