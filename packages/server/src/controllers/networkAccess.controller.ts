/**
 * Network Access Controller
 * 
 * Handles CRUD operations for network access control settings:
 * - Managing internal network CIDR ranges
 * - Managing API endpoint access rules
 * - Configuring rate limits for different network sources
 */

import { Request, Response } from 'express';
import { asyncHandler } from '../middleware/error.middleware';
import { ApiError } from '../middleware/error.middleware';
import { 
  InternalNetwork, 
  EndpointAccess, 
  AccessType, 
  DEFAULT_INTERNAL_NETWORKS,
  DEFAULT_RESTRICTED_ENDPOINTS,
  RateLimit,
  RateLimitSettings,
  DEFAULT_RATE_LIMIT_SETTINGS,
  DEFAULT_CUSTOM_RATE_LIMITS
} from '../models/networkAccess.model';
import { refreshRateLimitSettings } from '../middleware/rate-limit.middleware';
import { logger } from '../utils/logger';

/**
 * Network Access Controller
 */
class NetworkAccessController {
  /**
   * Get all internal networks
   */
  getInternalNetworks = asyncHandler(async (req: Request, res: Response) => {
    // In a real implementation, this would fetch from database
    // Mock implementation returns default networks
    const networks = DEFAULT_INTERNAL_NETWORKS.map((network, index) => ({
      id: `net-${index}`,
      cidr: network.cidr,
      description: network.description,
      createdAt: new Date(),
      updatedAt: new Date()
    }));

    res.status(200).json({
      success: true,
      data: networks
    });
  });

  /**
   * Add a new internal network
   */
  addInternalNetwork = asyncHandler(async (req: Request, res: Response) => {
    const { cidr, description } = req.body;

    if (!cidr) {
      return res.status(400).json({
        success: false,
        error: 'CIDR range is required'
      });
    }

    // Validate CIDR format
    const cidrRegex = /^([0-9]{1,3}\.){3}[0-9]{1,3}\/([0-9]|[1-2][0-9]|3[0-2])$/;
    if (!cidrRegex.test(cidr)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid CIDR format. Example: 192.168.1.0/24'
      });
    }

    // In a real implementation, this would save to database
    const network: InternalNetwork = {
      id: `net-${Date.now()}`,
      cidr,
      description: description || `Network ${cidr}`,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    res.status(201).json({
      success: true,
      data: network
    });
  });

  /**
   * Remove an internal network
   */
  removeInternalNetwork = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({
        success: false,
        error: 'Network ID is required'
      });
    }

    // In a real implementation, this would delete from database
    res.status(200).json({
      success: true,
      message: `Network with ID ${id} removed successfully`
    });
  });

  /**
   * Get all endpoint access rules
   */
  getEndpointAccessRules = asyncHandler(async (req: Request, res: Response) => {
    // In a real implementation, this would fetch from database
    // Mock implementation returns default endpoints
    const endpoints = DEFAULT_RESTRICTED_ENDPOINTS.map((endpoint, index) => ({
      id: `ep-${index}`,
      path: endpoint.path,
      method: endpoint.method,
      accessType: endpoint.accessType,
      description: endpoint.description,
      createdAt: new Date(),
      updatedAt: new Date()
    }));

    res.status(200).json({
      success: true,
      data: endpoints
    });
  });

  /**
   * Update endpoint access rule
   */
  updateEndpointAccess = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const { accessType } = req.body;

    if (!id) {
      return res.status(400).json({
        success: false,
        error: 'Endpoint ID is required'
      });
    }

    if (!Object.values(AccessType).includes(accessType as AccessType)) {
      return res.status(400).json({
        success: false,
        error: `Invalid access type. Must be one of: ${Object.values(AccessType).join(', ')}`
      });
    }

    // In a real implementation, this would update the database
    res.status(200).json({
      success: true,
      message: `Endpoint with ID ${id} updated successfully`,
      data: {
        id,
        accessType
      }
    });
  });

  /**
   * Add a new endpoint access rule
   */
  addEndpointAccess = asyncHandler(async (req: Request, res: Response) => {
    const { path, method, accessType, description } = req.body;

    if (!path || !method) {
      return res.status(400).json({
        success: false,
        error: 'Path and method are required'
      });
    }

    if (!Object.values(AccessType).includes(accessType as AccessType)) {
      return res.status(400).json({
        success: false,
        error: `Invalid access type. Must be one of: ${Object.values(AccessType).join(', ')}`
      });
    }

    // In a real implementation, this would save to database
    const endpoint: EndpointAccess = {
      id: `ep-${Date.now()}`,
      path,
      method: method.toUpperCase(),
      accessType: accessType as AccessType,
      description: description || `${method.toUpperCase()} ${path}`,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    res.status(201).json({
      success: true,
      data: endpoint
    });
  });

  /**
   * Get rate limit settings
   */
  getRateLimitSettings = asyncHandler(async (req: Request, res: Response) => {
    // In a real implementation, this would fetch from database
    // Mock implementation returns default settings
    const settings = { ...DEFAULT_RATE_LIMIT_SETTINGS };

    res.status(200).json({
      success: true,
      data: settings
    });
  });

  /**
   * Update rate limit settings
   */
  updateRateLimitSettings = asyncHandler(async (req: Request, res: Response) => {
    const { defaultRateLimit, upgradeMultiplier } = req.body;

    if (defaultRateLimit !== undefined && (isNaN(defaultRateLimit) || defaultRateLimit < 1)) {
      return res.status(400).json({
        success: false,
        error: 'Default rate limit must be a positive number'
      });
    }

    if (upgradeMultiplier !== undefined && (isNaN(upgradeMultiplier) || upgradeMultiplier < 1)) {
      return res.status(400).json({
        success: false,
        error: 'Upgrade multiplier must be a positive number'
      });
    }

    // In a real implementation, this would update the database
    const settings: Partial<RateLimitSettings> = {};
    
    if (defaultRateLimit !== undefined) {
      settings.defaultRateLimit = Math.round(defaultRateLimit);
    }
    
    if (upgradeMultiplier !== undefined) {
      settings.upgradeMultiplier = Number(upgradeMultiplier);
    }

    // Refresh the rate limit settings in the middleware
    try {
      // In a real implementation, this would be done through a proper service
      // This is a simplified version for demonstration
      refreshRateLimitSettings();
      
      logger.info('Rate limit settings updated', { settings });
    } catch (error) {
      logger.error('Failed to refresh rate limit settings', { error });
    }

    res.status(200).json({
      success: true,
      message: 'Rate limit settings updated successfully',
      data: {
        ...DEFAULT_RATE_LIMIT_SETTINGS,
        ...settings
      }
    });
  });

  /**
   * Get all custom rate limits
   */
  getCustomRateLimits = asyncHandler(async (req: Request, res: Response) => {
    // In a real implementation, this would fetch from database
    // Mock implementation returns default custom rate limits
    const rateLimits = DEFAULT_CUSTOM_RATE_LIMITS.map(limit => ({
      ...limit,
      createdAt: new Date(),
      updatedAt: new Date()
    }));

    res.status(200).json({
      success: true,
      data: rateLimits
    });
  });

  /**
   * Add a new custom rate limit
   */
  addCustomRateLimit = asyncHandler(async (req: Request, res: Response) => {
    const { network, description, requestsPerMinute } = req.body;

    if (!network) {
      return res.status(400).json({
        success: false,
        error: 'Network address or CIDR is required'
      });
    }

    if (!description) {
      return res.status(400).json({
        success: false,
        error: 'Description is required'
      });
    }

    if (isNaN(requestsPerMinute) || requestsPerMinute < 1) {
      return res.status(400).json({
        success: false,
        error: 'Requests per minute must be a positive number'
      });
    }

    // Validate the network format (either a CIDR or a single IP)
    const cidrRegex = /^([0-9]{1,3}\.){3}[0-9]{1,3}\/([0-9]|[1-2][0-9]|3[0-2])$/;
    const ipRegex = /^([0-9]{1,3}\.){3}[0-9]{1,3}$/;
    
    if (!cidrRegex.test(network) && !ipRegex.test(network)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid network format. Must be a valid IP address or CIDR range.'
      });
    }

    // In a real implementation, this would check if the network already exists
    const exists = DEFAULT_CUSTOM_RATE_LIMITS.some(limit => limit.network === network);
    if (exists) {
      return res.status(400).json({
        success: false,
        error: 'A rate limit for this network already exists'
      });
    }

    // In a real implementation, this would save to database
    const rateLimit: RateLimit = {
      id: `rate-${Date.now()}`,
      network,
      description,
      requestsPerMinute: Math.round(requestsPerMinute),
      createdAt: new Date(),
      updatedAt: new Date()
    };

    // Refresh the rate limit settings in the middleware
    try {
      refreshRateLimitSettings();
      logger.info('Added custom rate limit', { rateLimit });
    } catch (error) {
      logger.error('Failed to refresh rate limit settings', { error });
    }

    res.status(201).json({
      success: true,
      data: rateLimit
    });
  });

  /**
   * Update a custom rate limit
   */
  updateCustomRateLimit = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const { description, requestsPerMinute } = req.body;

    if (!id) {
      return res.status(400).json({
        success: false,
        error: 'Rate limit ID is required'
      });
    }

    // In a real implementation, this would find the rate limit in the database
    const rateLimit = DEFAULT_CUSTOM_RATE_LIMITS.find(limit => limit.id === id);
    if (!rateLimit) {
      return res.status(404).json({
        success: false,
        error: 'Rate limit not found'
      });
    }

    // Update fields if provided
    const updatedRateLimit = { ...rateLimit };
    
    if (description !== undefined) {
      updatedRateLimit.description = description;
    }
    
    if (requestsPerMinute !== undefined) {
      if (isNaN(requestsPerMinute) || requestsPerMinute < 1) {
        return res.status(400).json({
          success: false,
          error: 'Requests per minute must be a positive number'
        });
      }
      updatedRateLimit.requestsPerMinute = Math.round(requestsPerMinute);
    }

    updatedRateLimit.updatedAt = new Date();

    // Refresh the rate limit settings in the middleware
    try {
      refreshRateLimitSettings();
      logger.info('Updated custom rate limit', { id, updates: { description, requestsPerMinute } });
    } catch (error) {
      logger.error('Failed to refresh rate limit settings', { error });
    }

    res.status(200).json({
      success: true,
      message: `Rate limit for ${rateLimit.network} updated successfully`,
      data: updatedRateLimit
    });
  });

  /**
   * Remove a custom rate limit
   */
  removeCustomRateLimit = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({
        success: false,
        error: 'Rate limit ID is required'
      });
    }

    // In a real implementation, this would find and delete the rate limit from the database
    const rateLimit = DEFAULT_CUSTOM_RATE_LIMITS.find(limit => limit.id === id);
    if (!rateLimit) {
      return res.status(404).json({
        success: false,
        error: 'Rate limit not found'
      });
    }

    // Refresh the rate limit settings in the middleware
    try {
      refreshRateLimitSettings();
      logger.info('Removed custom rate limit', { id, network: rateLimit.network });
    } catch (error) {
      logger.error('Failed to refresh rate limit settings', { error });
    }

    res.status(200).json({
      success: true,
      message: `Rate limit for ${rateLimit.network} removed successfully`
    });
  });
}

export default new NetworkAccessController();