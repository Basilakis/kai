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
  }
];