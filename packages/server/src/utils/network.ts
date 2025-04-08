/**
 * Network Utility Functions
 * 
 * Provides utilities for network-based access control, including functions
 * to detect internal vs. external requests and validate IP addresses against
 * CIDR ranges.
 */

import { Request } from 'express';
import { logger } from './logger';

/**
 * Checks if an IP address is within a CIDR range
 * @param ip The IP address to check
 * @param cidr The CIDR range to check against (e.g., "10.0.0.0/8")
 * @returns True if the IP is within the CIDR range, false otherwise
 */
export function isInCIDR(ip: string, cidr: string): boolean {
  try {
    // Basic implementation - for production, use a library like 'ip-cidr' or 'netmask'
    const parts = cidr.split('/');
    if (parts.length !== 2) {
      throw new Error(`Invalid CIDR format: ${cidr}`);
    }
    
    // We've already checked parts.length === 2, so these are safe to use
    const range = parts[0]!; // Non-null assertion
    const bits = parts[1]!;  // Non-null assertion
    const mask = parseInt(bits, 10);
    
    if (isNaN(mask) || mask < 0 || mask > 32) {
      throw new Error(`Invalid CIDR mask: ${bits}`);
    }
    
    // Convert IP addresses to numeric form
    const ipNum = ipToLong(ip);
    const rangeNum = ipToLong(range);
    
    // Calculate the mask
    const maskNum = mask === 32 ? 0xffffffff : ~(0xffffffff >>> mask);
    
    // Check if the IPs match under the mask
    return (ipNum & maskNum) === (rangeNum & maskNum);
  } catch (error) {
    logger.error(`Error checking IP ${ip} against CIDR ${cidr}: ${error}`);
    return false; // Default to false (external) on error for security
  }
}

/**
 * Converts an IPv4 address to its numeric representation
 * @param ip The IP address to convert
 * @returns The numeric representation of the IP address
 */
function ipToLong(ip: string): number {
  const parts = ip.split('.');
  
  if (parts.length !== 4) {
    throw new Error(`Invalid IPv4 address: ${ip}`);
  }
  
  // Ensure all parts exist and are valid numbers
  if (parts.length !== 4 || parts.some(part => part === undefined || part === '')) {
    throw new Error(`Invalid IPv4 address: ${ip}`);
  }
  
  return ((parseInt(parts[0] || '0', 10) << 24) |
          (parseInt(parts[1] || '0', 10) << 16) |
          (parseInt(parts[2] || '0', 10) << 8)  |
           parseInt(parts[3] || '0', 10));
}

/**
 * Checks if a request is coming from an internal network
 * @param req The Express request object
 * @returns True if the request is from an internal network, false otherwise
 */
export function isInternalRequest(req: Request): boolean {
  try {
    // Get client IP address, considering potential proxies
    const clientIP = req.ip || req.socket.remoteAddress || '0.0.0.0';
    
    // Get internal network ranges from environment variable
    // Default to standard private network ranges if not specified
    const internalNetworks = (
      process.env.INTERNAL_NETWORKS || 
      '127.0.0.1/8,10.0.0.0/8,172.16.0.0/12,192.168.0.0/16'
    ).split(',');
    
    // Check if the client IP is in any of the internal networks
    const isInternal = internalNetworks.some(network => isInCIDR(clientIP, network));
    
    // For development environments, optionally log the result
    if (process.env.NODE_ENV === 'development') {
      logger.debug(`Network access check: IP ${clientIP} is ${isInternal ? 'internal' : 'external'}`);
    }
    
    return isInternal;
  } catch (error) {
    logger.error(`Error determining if request is internal: ${error}`);
    return false; // Default to false (external) on error for security
  }
}

/**
 * Types of network access
 */
export enum NetworkAccessType {
  ANY = 'any',               // No network restrictions
  INTERNAL_ONLY = 'internal-only', // Only accessible from internal networks
  EXTERNAL_ALLOWED = 'external-allowed'  // Accessible from anywhere
}