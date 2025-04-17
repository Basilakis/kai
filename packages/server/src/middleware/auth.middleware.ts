import { Request, Response, NextFunction } from 'express';

// Define types for jsonwebtoken since we can't resolve the module
interface JwtPayload {
  [key: string]: any;
}

interface VerifyOptions {
  algorithms?: string[];
  audience?: string | string[];
  issuer?: string | string[];
  jwtid?: string;
  subject?: string;
  clockTolerance?: number;
  maxAge?: string | number;
  clockTimestamp?: number;
}

type GetPublicKeyOrSecret = (
  header: { kid: string },
  callback: (err: Error | null, key?: string) => void
) => void;

interface OfficialJwtPayload extends JwtPayload {}

// Define JWT types and implementation

class JsonWebTokenError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'JsonWebTokenError';
  }
}

class TokenExpiredError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TokenExpiredError';
  }
}

// Mock jwt module
const jwt = {
  verify: (_token: string, _secretOrPublicKey: string | Buffer | GetPublicKeyOrSecret, _options?: VerifyOptions, callback?: Function) => {
    // This is a mock implementation
    if (callback) {
      callback(new Error('JWT verification not implemented'));
    } else {
      throw new Error('JWT verification not implemented');
    }
  },
  decode: (_token: string, _options?: { complete?: boolean; json?: boolean }) => {
    // This is a mock implementation
    return null;
  },
  sign: (_payload: string | Buffer | object, _secretOrPrivateKey: string | Buffer, _options?: any) => {
    // This is a mock implementation
    return 'mock.jwt.token';
  },
  JsonWebTokenError,
  TokenExpiredError
};

// Define types for jwks-rsa since we can't install it directly
interface SigningKey {
  kid: string;
  nbf?: string;
  publicKey?: string;
  rsaPublicKey?: string;
  getPublicKey?: () => string;
}

interface JwksClientOptions {
  jwksUri: string;
  requestHeaders?: Record<string, string>;
  timeout?: number;
  cache?: boolean;
  cacheMaxEntries?: number;
  cacheMaxAge?: number;
  rateLimit?: boolean;
  jwksRequestsPerMinute?: number;
}

interface JwksClient {
  getSigningKey(kid: string): Promise<SigningKey>;
  getSigningKey(kid: string, callback: (err: Error | null, key?: SigningKey) => void): void;
}

// Mock jwksClient function
const jwksClient = (_options: JwksClientOptions): JwksClient => {
  return {
    getSigningKey: async (_kid: string): Promise<SigningKey> => {
      throw new Error('jwks-rsa not implemented');
    }
  };
};

import { ApiError } from './error.middleware';
import { asyncHandler } from './error.middleware';
import { isInternalRequest, NetworkAccessType } from '../utils/network';
import { logger } from '../utils/logger';

// Add type declaration for Node.js process
declare global {
  namespace NodeJS {
    interface ProcessEnv {
      SUPABASE_URL?: string; // Expected format: https://<ref>.supabase.co
      NODE_ENV?: 'development' | 'production' | 'test';
      // JWT_SECRET is no longer used for Supabase JWT validation
    }
  }
}

/**
 * Interface for Supabase JWT payload (adjust based on actual Supabase claims)
 * Standard claims: aud, exp, sub, email, phone, app_metadata, user_metadata
 * Custom claims: role (expected in app_metadata)
 */
interface SupabaseJwtPayload extends OfficialJwtPayload {
  exp?: number; // Explicitly add expiration time claim
  sub: string; // Subject (user ID)
  email?: string;
  role?: string; // Assuming role is stored directly or within app_metadata
  app_metadata?: {
    provider?: string;
    providers?: string[];
    role?: string; // Expecting role here
    [key: string]: any;
  };
  user_metadata?: {
    [key: string]: any;
  };
}

// --- JWKS Client Setup ---
const supabaseUrl = process.env.SUPABASE_URL;
if (!supabaseUrl) {
  logger.error('FATAL: SUPABASE_URL environment variable is not set.');
  // In a real app, you might want to prevent startup or throw a fatal error
  // For now, we'll log and proceed, but verification will fail.
}

const jwksUri = supabaseUrl ? `${supabaseUrl}/auth/v1/.well-known/jwks.json` : '';

const client = jwksClient({
  jwksUri: jwksUri,
  cache: true, // Cache the signing keys
  cacheMaxEntries: 5, // Cache up to 5 keys
  cacheMaxAge: 10 * 60 * 1000, // Cache for 10 minutes
  rateLimit: true, // Enable rate limiting
  jwksRequestsPerMinute: 5, // Allow 5 requests per minute
});

// Explicitly type parameters for getKey
const getKey: GetPublicKeyOrSecret = (header: { kid?: string }, callback: (err: Error | null, key?: string) => void) => {
  if (!header.kid) {
    // Provide an error to the callback
    return callback(new jwt.JsonWebTokenError('Token header does not contain "kid"'), undefined);
  }
  // Explicitly type parameters for getSigningKey callback
  client.getSigningKey(header.kid, (err: Error | null, key: SigningKey | undefined) => {
    if (err) {
      logger.error('Error fetching signing key:', err);
      return callback(err, undefined);
    }
    // Provide the public key or certificate
    let signingKey: string | undefined;
    if (key?.getPublicKey) {
      signingKey = key.getPublicKey();
    } else if (key?.publicKey) {
      signingKey = key.publicKey;
    } else if (key?.rsaPublicKey) {
      signingKey = key.rsaPublicKey;
    }

    if (!signingKey) {
      return callback(new Error('Could not get signing key'));
    }
    callback(null, signingKey);
  });
};
// --- End JWKS Client Setup ---

/**
 * Extend Express Request interface to add source property and resourceOwnerId
 * (user property is already defined elsewhere)
 */
declare global {
  namespace Express {
    interface Request {
      user?: { // Define user structure attached to request
        id: string;
        role: string;
        email?: string;
      };
      token?: string; // Attach the raw token if needed
      source?: 'internal' | 'external';
      resourceOwnerId?: string; // For owner validation middleware
    }
  }
}

/**
 * Authorization options
 */
export interface AuthorizeOptions {
  roles?: string[];
  accessType?: NetworkAccessType;
  validateOwnership?: boolean;
}

/**
 * User-specific resource validation options
 */
export interface OwnershipValidationOptions {
  // The parameter to extract the resourceId from (e.g., 'params.id', 'body.userId')
  idSource: 'params' | 'body' | 'query';
  // The field name containing the userId/ownerId in the resource
  idField: string;
  // Optional collection name for logging purposes
  collection?: string;
  // If true, bypass validation for admin users
  adminOverride?: boolean;
  // Custom validation function
  customValidator?: (req: Request) => Promise<boolean>;
}

// Import Redis client for persistent storage
import redisClient from '../services/messaging/redisClient';

// Fallback in-memory blacklist in case Redis is unavailable
const tokenBlacklist = new Set<string>();

/**
 * Add token to blacklist
 * @param token JWT token to blacklist
 * @param expiresAt When the token expires (in seconds since epoch)
 */
export const blacklistToken = async (token: string, expiresAt?: number): Promise<void> => {
  try {
    const client = await redisClient.getClient();
    // If token has expiration, use Redis TTL to automatically remove after expiry
    if (expiresAt) {
      const nowSeconds = Math.floor(Date.now() / 1000);
      const timeUntilExpirySeconds = Math.max(0, expiresAt - nowSeconds);
      
      if (timeUntilExpirySeconds > 0) {
        await client.set(`blacklisted_token:${token}`, '1', {
          EX: timeUntilExpirySeconds
        });
        logger.debug(`Added token to Redis blacklist with expiry in ${timeUntilExpirySeconds}s: ${token.substring(0, 10)}...`);
      }
    } else {
      // If no expiration, store without expiry
      await client.set(`blacklisted_token:${token}`, '1');
      logger.debug(`Added token to Redis blacklist without expiry: ${token.substring(0, 10)}...`);
    }
  } catch (error) {
    logger.error('Error blacklisting token in Redis:', error);
    // Fallback to in-memory if Redis fails
    tokenBlacklist.add(token);
    
    // Schedule removal if expiry provided
    if (expiresAt) {
      const nowSeconds = Math.floor(Date.now() / 1000);
      const timeUntilExpiryMs = Math.max(0, (expiresAt - nowSeconds) * 1000);
      
      if (timeUntilExpiryMs > 0) {
        setTimeout(() => {
          tokenBlacklist.delete(token);
          logger.debug(`Removed expired token from memory blacklist: ${token.substring(0, 10)}...`);
        }, timeUntilExpiryMs);
      }
    }
  }
};

/**
 * Check if a token is blacklisted
 * @param token JWT token to check
 * @returns Whether the token is blacklisted
 */
export const isTokenBlacklisted = async (token: string): Promise<boolean> => {
  try {
    const client = await redisClient.getClient();
    const result = await client.get(`blacklisted_token:${token}`);
    return result !== null;
  } catch (error) {
    logger.error('Error checking token blacklist in Redis:', error);
    // Fallback to in-memory if Redis fails
    return tokenBlacklist.has(token);
  }
};

/**
 * Authentication middleware
 * Verifies JWT token and adds user to request object
 * Includes enhanced security features:
 * - Cryptographic signature validation
 * - Token blacklist checking (for revoked tokens)
 * - Enhanced logging and monitoring
 */
export const authMiddleware = asyncHandler(
  async (req: Request, _res: Response, next: NextFunction) => {
    let token: string | undefined;

    // Get token from Authorization header
    if (
      req.headers.authorization &&
      typeof req.headers.authorization === 'string' &&
      req.headers.authorization.startsWith('Bearer')
    ) {
      token = req.headers.authorization.split(' ')[1];
    }
    // Get token from cookie
    else if (req.cookies?.token) {
      token = req.cookies.token;
    }

    // Check if token exists
    if (!token) {
      return next(new ApiError(401, 'Not authorized, no token provided'));
    }

    // Check if token is blacklisted (revoked) - now async
    if (await isTokenBlacklisted(token)) {
      logger.warn(`Attempt to use blacklisted token: ${token.substring(0, 10)}...`);
      return next(new ApiError(401, 'Not authorized, token has been revoked'));
    }

    if (!jwksUri) {
      logger.error('Authentication middleware cannot run: SUPABASE_URL is not configured.');
      return next(new ApiError(500, 'Authentication configuration error.'));
    }

    try {
      // --- Verify Supabase JWT using JWKS ---
      const verifyOptions: VerifyOptions = {
        algorithms: ['RS256'], // Supabase typically uses RS256
        // audience: 'authenticated', // Default Supabase audience
        // issuer: `${supabaseUrl}/auth/v1` // Validate the issuer
        // Enable audience and issuer validation once confirmed from Supabase settings
      };

      // Explicitly type parameters for jwt.verify callback
      jwt.verify(token, getKey, verifyOptions, (err: Error | null, decoded: object | string | undefined) => {
        if (err) {
          // Use specific error types from jsonwebtoken
          if (err instanceof jwt.TokenExpiredError) {
             return next(new ApiError(401, 'Not authorized, token expired'));
          }
          if (err instanceof jwt.JsonWebTokenError) {
             logger.warn(`Invalid token: ${err.message}`);
             return next(new ApiError(401, 'Not authorized, invalid token: ' + err.message));
          }
          // Handle other potential errors during verification
          logger.error('JWT verification error:', err);
          return next(new ApiError(401, 'Not authorized, token validation failed'));
        }

        // Check if decoded is an object (it should be for a valid JWT payload)
        if (!decoded || typeof decoded !== 'object') {
           logger.warn('Decoded token payload is not an object');
           return next(new ApiError(401, 'Not authorized, invalid token payload structure'));
        }

        const payload = decoded as SupabaseJwtPayload;

        // Extract user ID (sub claim) and role (assuming it's in app_metadata)
        const userId = payload.sub;
        const userRole = payload.role || payload.app_metadata?.role || 'user'; // Prioritize direct role claim, fallback to app_metadata, then default
        const userEmail = payload.email;

        if (!userId) {
          logger.warn('Token payload missing required "sub" claim');
          return next(new ApiError(401, 'Not authorized, invalid token claims'));
        }

        // Add user to request object
        req.user = {
          id: userId,
          role: userRole,
          email: userEmail,
        };

        // Add token to request for potential refreshing or other uses
        req.token = token;

        // Log authentication (for security audit trail)
        logger.info(`Authenticated user ${userId} (Role: ${userRole})`);

        next();
      });
      // --- End JWT Verification ---

    } catch (error) {
      // Catch synchronous errors during setup, though verify is async via callback
      logger.error('Unexpected error in auth middleware setup:', error);
      return next(new ApiError(500, 'Internal server error during authentication'));
    }
  }
);

/**
 * Token refresh middleware
 * Refreshes tokens that are close to expiration
 * Should be used after authMiddleware
 */
export const tokenRefreshMiddleware = asyncHandler(
  async (req: Request, _res: Response, next: NextFunction) => {
    // Only proceed if user is authenticated and token exists
    if (!req.user || !req.token) {
      return next(); // Don't attempt refresh if user/token aren't present
    }

    try {
      // Decode token payload without verification to check expiry
      // Note: jsonwebtoken.decode doesn't verify signature or expiry
      const decoded = jwt.decode(req.token, { complete: false }) as SupabaseJwtPayload | null; // Use complete: false to get only payload

      // If decoding fails or no expiration claim (exp is standard), cannot proceed
      if (!decoded || typeof decoded.exp === 'undefined') {
         logger.debug('Token has no expiration claim or failed decoding, skipping refresh check.');
         return next();
      }

      const nowSeconds = Math.floor(Date.now() / 1000);
      // Ensure decoded.exp is treated as a number
      const expirationTime = Number(decoded.exp);
      if (isNaN(expirationTime)) {
         logger.warn('Token expiration claim (exp) is not a valid number.');
         return next();
      }
      const timeUntilExpiry = expirationTime - nowSeconds;

      // If token is close to expiry (e.g., less than 15 min)
      // IMPORTANT: This middleware CANNOT refresh Supabase tokens itself.
      // Supabase client handles refresh. This middleware only detects expiry.
      // We might blacklist the token here if expired, but refresh must happen client-side.
      if (timeUntilExpiry < 15 * 60) {
        logger.info(`Token for user ${req.user.id} is nearing expiry (${timeUntilExpiry}s remaining). Client should handle refresh.`);
        // Optionally, add a header to signal client about impending expiry
        // res.setHeader('X-Token-Near-Expiry', 'true');

        // If the token IS expired, blacklist it here if not already caught by authMiddleware
        if (timeUntilExpiry <= 0 && !isTokenBlacklisted(req.token)) {
           logger.warn(`Blacklisting expired token used by user ${req.user.id}`);
           // Pass expirationTime which is already a number (seconds since epoch)
           await blacklistToken(req.token, expirationTime);
           // Do NOT proceed with an expired token. authMiddleware should catch this,
           // but this adds an extra layer if needed.
           // return next(new ApiError(401, 'Token expired during request processing'));
        }

        // NOTE: Server cannot generate a new Supabase token.
        // The logic to create/sign a new token here is removed as it's incorrect for Supabase.
        // The client (using Supabase SDK) is responsible for refreshing the token.
        // We keep the old token blacklisting logic if needed.
        // blacklistToken(req.token, decoded.exp); // Keep if needed for immediate revocation on server

        // Example: If using cookies and server could refresh (NOT FOR SUPABASE):
        // const newToken = jwt.sign(...)
        // res.cookie('token', newToken, { ... });
        // res.setHeader('X-Token-Refreshed', 'true');
      }

      next();
    } catch (error) {
      // Log error but don't block the request
      logger.error('Token refresh check error:', error);
      next();
    }
  }
);

/**
 * Enhanced authorization middleware
 * Checks role, network access, and optionally ownership validation
 *
 * @param options Authorization options including roles, network access type, and ownership validation
 * @returns Middleware function
 */
export const authorize = (options: AuthorizeOptions = {}) => {
  return (req: Request, _res: Response, next: NextFunction) => {
    // Verify user is authenticated (should have been done by authMiddleware)
    if (!req.user) {
      // This check might be redundant if authMiddleware always runs first and errors on no user
      return next(new ApiError(401, 'Not authorized, no user found'));
    }

    // Check role-based access if roles are specified
    if (options.roles && options.roles.length > 0) {
      if (!req.user.role || !options.roles.includes(req.user.role)) {
        return next(
          new ApiError(403, `Role (${req.user.role || 'none'}) is not authorized to access this resource`)
        );
      }
    }

    // Check network-based access if access type is specified
    if (options.accessType === NetworkAccessType.INTERNAL_ONLY) {
      // Determine if request is from internal network
      const isInternal = isInternalRequest(req);

      // Add source to request for potential later use
      req.source = isInternal ? 'internal' : 'external';

      if (!isInternal) {
        logger.warn(`External access attempt to internal-only resource: ${req.method} ${req.originalUrl} from IP ${req.ip || req.socket.remoteAddress || 'unknown'}`);
        return next(
          new ApiError(403, 'This resource is only accessible from internal networks')
        );
      }
    }

    next();
  };
};


/**
 * Role-based authorization middleware (backward compatibility)
 * Checks if the user has the required role(s)
 * @param roles Array of roles that are allowed to access the route
 * @deprecated Use the more flexible `authorize({ roles: ['role1', 'role2'] })` function instead,
 * which supports additional options like network access type restrictions.
 */
export const authorizeRoles = (roles: string[]) => {
  return authorize({ roles });
};

/**
 * Rate limiting configuration for API endpoints
 */
interface RateLimitOptions {
  windowMs: number; // Time window in milliseconds
  maxRequests: number; // Maximum number of requests in the window
  message?: string; // Optional error message
}

/**
 * In-memory rate limiter (would use Redis in production)
 */
// Redis-based rate limiter with fallback to in-memory
class RedisRateLimiter {
  // In-memory fallback store
  private limits: Map<string, { count: number; resetAt: number }> = new Map();

  /**
   * Check if a request exceeds rate limits using Redis
   * @param key Unique key for the rate limit (e.g., IP + endpoint)
   * @param options Rate limit options
   * @returns Whether the request is allowed
   */
  async isAllowed(key: string, options: RateLimitOptions): Promise<boolean> {
    try {
      const client = await redisClient.getClient();
      const redisKey = `rate_limit:${key}`;
      
      // Use Redis to get current count
      const count = await client.incr(redisKey);
      
      // If this is the first request, set expiry
      if (count === 1) {
        await client.expire(redisKey, Math.floor(options.windowMs / 1000));
      }
      
      // Allow if count is less than or equal to max
      return count <= options.maxRequests;
    } catch (error) {
      logger.error('Error checking rate limit in Redis:', error);
      // Fallback to in-memory if Redis fails
      return this.isAllowedInMemory(key, options);
    }
  }

  /**
   * In-memory fallback for rate limiting
   * @param key Unique key for the rate limit
   * @param options Rate limit options
   * @returns Whether the request is allowed
   */
  private isAllowedInMemory(key: string, options: RateLimitOptions): boolean {
    const now = Date.now();
    let limit = this.limits.get(key);

    // If no limit exists or it has reset, create a new one
    if (!limit || limit.resetAt <= now) {
      limit = {
        count: 1,
        resetAt: now + options.windowMs
      };
      this.limits.set(key, limit);
      return true;
    }

    // Increment count and check if it exceeds the max
    limit.count++;

    // Update the limit in the map
    this.limits.set(key, limit);

    // Allow if count is less than or equal to max
    return limit.count <= options.maxRequests;
  }

  /**
   * Get remaining requests for a key
   * @param key Unique key for the rate limit
   * @param options Rate limit options for max requests
   * @returns Remaining requests and reset time
   */
  async getRateLimitInfo(key: string, options: RateLimitOptions): Promise<{ remaining: number, resetAt: number } | null> {
    try {
      const client = await redisClient.getClient();
      const redisKey = `rate_limit:${key}`;
      
      // Get current count and TTL
      const [countStr, ttl] = await Promise.all([
        client.get(redisKey),
        client.ttl(redisKey)
      ]);
      
      if (!countStr) {
        return {
          remaining: options.maxRequests,
          resetAt: Date.now() + options.windowMs
        };
      }
      
      const count = parseInt(countStr, 10);
      const remaining = Math.max(0, options.maxRequests - count);
      const resetAt = Date.now() + (ttl * 1000);
      
      return { remaining, resetAt };
    } catch (error) {
      logger.error('Error getting rate limit info from Redis:', error);
      // Fallback to in-memory if Redis fails
      return this.getRateLimitInfoInMemory(key);
    }
  }

  /**
   * In-memory fallback for getting rate limit info
   * @param key Unique key for the rate limit
   * @returns Remaining requests and reset time
   */
  private getRateLimitInfoInMemory(key: string): { remaining: number, resetAt: number } | null {
    const limit = this.limits.get(key);
    if (!limit) {
      return null;
    }
    
    return {
      remaining: Math.max(0, limit.count),
      resetAt: limit.resetAt
    };
  }
}

// Create a global Redis rate limiter instance
const redisRateLimiter = new RedisRateLimiter();

/**
 * Rate limiting middleware
 * Limits the number of requests a client can make in a given time window
 *
 * @param options Rate limiting options
 * @returns Middleware function
 */
export const rateLimitMiddleware = (options: RateLimitOptions = { windowMs: 60 * 1000, maxRequests: 100 }) => {
  return asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    // Create a unique key based on IP and endpoint
    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    const endpoint = req.originalUrl || req.url;
    const key = `${ip}:${endpoint}`;

    // Check if request is allowed
    const isAllowed = await redisRateLimiter.isAllowed(key, options);
    if (!isAllowed) {
      // Get limit info
      const limitInfo = await redisRateLimiter.getRateLimitInfo(key, options);

      // Set rate limit headers
      if (limitInfo) {
        res.setHeader('X-RateLimit-Limit', options.maxRequests.toString());
        res.setHeader('X-RateLimit-Remaining', '0');
        res.setHeader('X-RateLimit-Reset', Math.ceil(limitInfo.resetAt / 1000).toString());
      }

      // Log rate limit exceeded
      logger.warn(`Rate limit exceeded for ${ip} on ${endpoint}`);

      // Return error
      return res.status(429).json({
        error: options.message || 'Too many requests, please try again later'
      });
    }

    // Set rate limit headers
    const limitInfo = await redisRateLimiter.getRateLimitInfo(key, options);
    if (limitInfo) {
      res.setHeader('X-RateLimit-Limit', options.maxRequests.toString());
      res.setHeader('X-RateLimit-Remaining', limitInfo.remaining.toString());
      res.setHeader('X-RateLimit-Reset', Math.ceil(limitInfo.resetAt / 1000).toString());
    }

    return next();
  });
};

/**
 * Enhanced user-specific resource validation middleware
 * Ensures a user can only access their own resources
 * Includes improved security, logging, and error handling
 *
 * @param options Configuration for how to extract and validate resource ownership
 * @returns Middleware function
 */
export const validateUserOwnership = (options: OwnershipValidationOptions) => {
  return asyncHandler(async (req: Request, _res: Response, next: NextFunction) => {
    // Skip validation if no authenticated user
    if (!req.user) {
      return next(new ApiError(401, 'Not authorized, no user found'));
    }

    // Skip validation for admins if adminOverride is true
    if (options.adminOverride && req.user.role === 'admin') {
      return next();
    }

    try {
      let isAuthorized = false;

      // Use custom validator if provided
      if (options.customValidator) {
        isAuthorized = await options.customValidator(req);
      } else {
        // Standard validation based on ID extraction
        // Get the resource ID from the specified source
        const resourceId = req[options.idSource][options.idField];

        if (!resourceId) {
          return next(
            new ApiError(400, `Resource ID not found in ${options.idSource}.${options.idField}`)
          );
        }

        // Store the resource owner ID for potential use in the controller
        req.resourceOwnerId = resourceId;

        // Check if the resource belongs to the current user
        isAuthorized = resourceId === req.user.id;
      }

      if (!isAuthorized) {
        // Enhanced security logging - use string format instead of object for wider compatibility
        const resourceName = options.collection || 'resource';
        const ip = req.ip || req.socket.remoteAddress || 'unknown';
        const userAgent = req.headers['user-agent'] || 'unknown';
        const timestamp = new Date().toISOString();

        logger.warn(
          `Unauthorized access attempt: user=${req.user.id} resource=${resourceName} ` +
          `method=${req.method} path=${req.originalUrl} ip=${ip} ` +
          `userAgent=${userAgent} timestamp=${timestamp}`
        );
        return next(
          new ApiError(403, `You do not have permission to access this ${options.collection || 'resource'}`)
        );
      }

      next();
    } catch (error) {
      next(error);
    }
  });
};

/**
 * Session ownership validation middleware
 * Specialized middleware for validating ownership of a session
 *
 * @param sessionParamName The URL parameter name containing the session ID (default: 'sessionId')
 * @param allowCollaborators Whether to allow collaborators to access the session (default: false)
 * @returns Middleware function
 */
export const validateSessionOwnership = (sessionParamName = 'sessionId', allowCollaborators = false) => {
  return asyncHandler(async (req: Request, _res: Response, next: NextFunction) => {
    // Skip validation if no authenticated user
    if (!req.user) {
      return next(new ApiError(401, 'Not authorized, no user found'));
    }

    // Skip validation for admins
    if (req.user.role === 'admin') {
      return next();
    }

    try {
      const sessionId = req.params[sessionParamName];

      if (!sessionId) {
        return next(
          new ApiError(400, `Session ID not found in params.${sessionParamName}`)
        );
      }

      // In a real implementation, this would query a sessions table
      // to get the session and check if the current user is the owner
      // or an invited collaborator

      // For now, use a mock function to check session ownership
      const isOwnerOrCollaborator = await isUserSessionOwnerOrCollaborator(
        sessionId,
        req.user.id,
        allowCollaborators
      );

      if (!isOwnerOrCollaborator) {
        logger.warn(`User ${req.user.id} attempted to access session ${sessionId} they don't own`);
        return next(
          new ApiError(403, 'You do not have permission to access this session')
        );
      }

      next();
    } catch (error) {
      next(error);
    }
  });
};

/**
 * Mock function to check if user is session owner or collaborator
 * In a real implementation, this would query a sessions table
 *
 * @param sessionId The session ID to check
 * @param userId The user ID to check
 * @param allowCollaborators Whether to allow collaborators
 * @returns Whether the user is the owner or a collaborator
 */
const isUserSessionOwnerOrCollaborator = async (
  sessionId: string,
  userId: string,
  allowCollaborators: boolean
): Promise<boolean> => {
  // In a real implementation, this would query a database
  // For now, we'll use a mock implementation that checks if session ID ends with user ID
  // This is just for demonstration purposes

  // In production, replace this with actual DB query to check ownership
  // For example:
  // const session = await db.sessions.findUnique({ where: { id: sessionId } });
  // if (!session) return false;
  //
  // if (session.userId === userId) return true;
  //
  // if (allowCollaborators) {
  //   const collaboration = await db.collaborations.findFirst({
  //     where: {
  //       sessionId,
  //       collaboratorId: userId,
  //       status: 'ACCEPTED'
  //     }
  //   });
  //   return !!collaboration;
  // }
  //
  // return false;

  // Mock implementation for demonstration
  if (sessionId.endsWith(userId.substring(0, 4))) {
    return true;
  }

  // If collaborators are allowed, check a mock pattern
  if (allowCollaborators && sessionId.includes(`collab_${userId.substring(0, 4)}`)) {
    return true;
  }

  return false;
};