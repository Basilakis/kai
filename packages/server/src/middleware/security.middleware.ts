/**
 * Security Middleware
 * 
 * This middleware adds security-related HTTP headers to API responses
 * to enhance the security posture of the application.
 */

import { Request, Response, NextFunction } from 'express';

/**
 * Add security headers to API responses
 */
export const securityHeaders = (req: Request, res: Response, next: NextFunction): void => {
  // Prevent browsers from incorrectly detecting non-scripts as scripts
  res.setHeader('X-Content-Type-Options', 'nosniff');
  
  // Prevent clickjacking attacks
  res.setHeader('X-Frame-Options', 'DENY');
  
  // Prevent XSS attacks
  res.setHeader('X-XSS-Protection', '1; mode=block');
  
  // Enforce HTTPS
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
  
  // Restrict referrer information
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  
  // Control what features and APIs can be used in the browser
  res.setHeader('Feature-Policy', "camera 'none'; microphone 'none'; geolocation 'none'");
  
  // Content Security Policy
  // Customize this based on your application's needs
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'self'; script-src 'self'; connect-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; font-src 'self'; frame-ancestors 'none'; form-action 'self'"
  );
  
  next();
};

/**
 * Add cache control headers to prevent caching of sensitive data
 */
export const noCacheHeaders = (req: Request, res: Response, next: NextFunction): void => {
  // Prevent caching for sensitive routes
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.setHeader('Surrogate-Control', 'no-store');
  
  next();
};

/**
 * Add security headers for authentication routes
 */
export const authSecurityHeaders = [securityHeaders, noCacheHeaders];

export default {
  securityHeaders,
  noCacheHeaders,
  authSecurityHeaders
};
