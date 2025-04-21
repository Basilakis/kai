import axios from 'axios';
import { API_BASE_URL } from '../config';

// Set up axios instance with auth headers
const api = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
});

// Add auth token to requests
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('adminAuthToken');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Types
export interface InternalNetwork {
  id: string;
  cidr: string;
  description: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface EndpointAccess {
  id?: string;
  path: string;
  method: string;
  description: string;
  allowInternal: boolean;
  allowExternal: boolean;
}

export interface RateLimit {
  id?: string;
  network: string;
  description: string;
  requestsPerMinute: number;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface RateLimitSettings {
  defaultRateLimit: number;
  upgradeMultiplier: number;
}

export interface NetworkSettings {
  internalNetworks: InternalNetwork[];
  endpoints: EndpointAccess[];
  rateLimitSettings: RateLimitSettings;
  customRateLimits: RateLimit[];
}

/**
 * Get all network settings
 */
export const getNetworkSettings = async (): Promise<NetworkSettings> => {
  try {
    // Get internal networks
    const networksResponse = await api.get('/admin/network-access/networks');
    const internalNetworks = networksResponse.data.data || [];

    // Get endpoint access rules
    const endpointsResponse = await api.get('/admin/network-access/endpoints');
    const endpoints = endpointsResponse.data.data || [];

    // Get rate limit settings
    const rateLimitSettingsResponse = await api.get('/admin/network-access/rate-limits/settings');
    const rateLimitSettings = rateLimitSettingsResponse.data.data || {
      defaultRateLimit: 30,
      upgradeMultiplier: 2
    };

    // Get custom rate limits
    const customRateLimitsResponse = await api.get('/admin/network-access/rate-limits/custom');
    const customRateLimits = customRateLimitsResponse.data.data || [];

    return {
      internalNetworks,
      endpoints,
      rateLimitSettings,
      customRateLimits
    };
  } catch (error) {
    console.error('Error fetching network settings:', error);
    throw error;
  }
};

/**
 * Add internal network
 */
export const addInternalNetwork = async (cidr: string, description: string): Promise<InternalNetwork> => {
  try {
    const response = await api.post('/admin/network-access/networks', {
      cidr,
      description
    });
    return response.data.data;
  } catch (error) {
    console.error('Error adding internal network:', error);
    throw error;
  }
};

/**
 * Remove internal network
 */
export const removeInternalNetwork = async (id: string): Promise<void> => {
  try {
    await api.delete(`/admin/network-access/networks/${id}`);
  } catch (error) {
    console.error('Error removing internal network:', error);
    throw error;
  }
};

/**
 * Update endpoint access
 */
export const updateEndpointAccess = async (endpoint: EndpointAccess): Promise<EndpointAccess> => {
  try {
    // Convert to the format expected by the API
    const accessType = endpoint.allowExternal
      ? (endpoint.allowInternal ? 'any' : 'external')
      : (endpoint.allowInternal ? 'internal' : 'none');

    const payload = {
      path: endpoint.path,
      method: endpoint.method,
      accessType,
      description: endpoint.description
    };

    // If endpoint has an ID, update it, otherwise create a new one
    let response;
    if (endpoint.id) {
      response = await api.put(`/admin/network-access/endpoints/${endpoint.id}`, payload);
    } else {
      response = await api.post('/admin/network-access/endpoints', payload);
    }

    return response.data.data;
  } catch (error) {
    console.error('Error updating endpoint access:', error);
    throw error;
  }
};

/**
 * Update rate limit settings
 */
export const updateRateLimitSettings = async (settings: Partial<RateLimitSettings>): Promise<RateLimitSettings> => {
  try {
    const response = await api.put('/admin/network-access/rate-limits/settings', settings);
    return response.data.data;
  } catch (error) {
    console.error('Error updating rate limit settings:', error);
    throw error;
  }
};

/**
 * Add custom rate limit
 */
export const addCustomRateLimit = async (rateLimit: Omit<RateLimit, 'id' | 'createdAt' | 'updatedAt'>): Promise<RateLimit> => {
  try {
    const response = await api.post('/admin/network-access/rate-limits/custom', rateLimit);
    return response.data.data;
  } catch (error) {
    console.error('Error adding custom rate limit:', error);
    throw error;
  }
};

/**
 * Remove custom rate limit
 */
export const removeCustomRateLimit = async (id: string): Promise<void> => {
  try {
    await api.delete(`/admin/network-access/rate-limits/custom/${id}`);
  } catch (error) {
    console.error('Error removing custom rate limit:', error);
    throw error;
  }
};

/**
 * Save all network settings
 */
export const saveNetworkSettings = async (settings: {
  internalNetworks: string[];
  endpoints: EndpointAccess[];
  defaultRateLimit: number;
  customRateLimits: RateLimit[];
}): Promise<void> => {
  try {
    // Update rate limit settings
    await updateRateLimitSettings({ defaultRateLimit: settings.defaultRateLimit });

    // Update endpoints
    for (const endpoint of settings.endpoints) {
      await updateEndpointAccess(endpoint);
    }

    // We don't update internal networks and custom rate limits here
    // because they are managed through separate add/remove functions
  } catch (error) {
    console.error('Error saving network settings:', error);
    throw error;
  }
};

/**
 * Check for unregistered API endpoints
 */
export const checkUnregisteredEndpoints = async (): Promise<{ unregisteredEndpoints: string[], success: boolean }> => {
  try {
    const response = await api.get('/admin/network-access/check-endpoints');
    return response.data;
  } catch (error) {
    console.error('Error checking unregistered endpoints:', error);
    throw error;
  }
};

/**
 * Register unregistered API endpoints
 */
export const registerUnregisteredEndpoints = async (): Promise<{ registered: number, skipped: number, success: boolean }> => {
  try {
    const response = await api.post('/admin/network-access/register-endpoints');
    return response.data;
  } catch (error) {
    console.error('Error registering unregistered endpoints:', error);
    throw error;
  }
};

export default {
  getNetworkSettings,
  addInternalNetwork,
  removeInternalNetwork,
  updateEndpointAccess,
  updateRateLimitSettings,
  addCustomRateLimit,
  removeCustomRateLimit,
  saveNetworkSettings,
  checkUnregisteredEndpoints,
  registerUnregisteredEndpoints
};
