/**
 * Cryptographic Utilities
 * 
 * This module provides secure cryptographic functions for generating tokens,
 * hashing passwords, and other security-related operations.
 */

import crypto from 'crypto';
import { promisify } from 'util';

// Promisify crypto functions
const randomBytesAsync = promisify(crypto.randomBytes);
const pbkdf2Async = promisify(crypto.pbkdf2);

// Constants
const HASH_ALGORITHM = 'sha256';
const HASH_ITERATIONS = 10000;
const HASH_KEY_LENGTH = 64;
const SALT_LENGTH = 32;
const TOKEN_LENGTH = 32;
const API_KEY_LENGTH = 32;
const API_KEY_PREFIX_LENGTH = 8;

/**
 * Generate a secure random token
 * @param length Token length in bytes (default: 32)
 * @returns Hex-encoded token string
 */
export async function generateSecureToken(length: number = TOKEN_LENGTH): Promise<string> {
  const buffer = await randomBytesAsync(length);
  return buffer.toString('hex');
}

/**
 * Generate a secure API key
 * @returns Object containing the API key and its prefix
 */
export async function generateApiKey(): Promise<{ key: string; prefix: string }> {
  const buffer = await randomBytesAsync(API_KEY_LENGTH);
  const key = buffer.toString('base64').replace(/[+/=]/g, '').substring(0, API_KEY_LENGTH * 1.5);
  const prefix = key.substring(0, API_KEY_PREFIX_LENGTH);
  
  return { key, prefix };
}

/**
 * Hash a value with a salt
 * @param value Value to hash
 * @param salt Salt (if not provided, a new one will be generated)
 * @returns Object containing the hash and salt
 */
export async function hashValue(value: string, salt?: string): Promise<{ hash: string; salt: string }> {
  // Generate a salt if not provided
  const useSalt = salt || (await randomBytesAsync(SALT_LENGTH)).toString('hex');
  
  // Hash the value
  const derivedKey = await pbkdf2Async(
    value,
    useSalt,
    HASH_ITERATIONS,
    HASH_KEY_LENGTH,
    HASH_ALGORITHM
  );
  
  return {
    hash: derivedKey.toString('hex'),
    salt: useSalt
  };
}

/**
 * Verify a value against a hash
 * @param value Value to verify
 * @param hash Hash to verify against
 * @param salt Salt used for hashing
 * @returns Whether the value matches the hash
 */
export async function verifyHash(value: string, hash: string, salt: string): Promise<boolean> {
  const { hash: computedHash } = await hashValue(value, salt);
  return crypto.timingSafeEqual(Buffer.from(computedHash, 'hex'), Buffer.from(hash, 'hex'));
}

/**
 * Generate a secure TOTP secret
 * @returns Base32-encoded secret
 */
export async function generateTOTPSecret(): Promise<string> {
  const buffer = await randomBytesAsync(20); // 160 bits is standard for TOTP
  return buffer.toString('base32').replace(/=/g, '');
}

/**
 * Generate a secure password reset token
 * @returns Hex-encoded token string
 */
export async function generatePasswordResetToken(): Promise<string> {
  return generateSecureToken(48); // Longer token for password resets
}

/**
 * Generate a secure session token
 * @returns Hex-encoded token string
 */
export async function generateSessionToken(): Promise<string> {
  return generateSecureToken(48); // Longer token for sessions
}

/**
 * Generate backup codes
 * @param count Number of codes to generate
 * @param length Length of each code
 * @returns Array of backup codes
 */
export async function generateBackupCodes(count: number = 10, length: number = 8): Promise<string[]> {
  const codes: string[] = [];
  
  for (let i = 0; i < count; i++) {
    const buffer = await randomBytesAsync(length);
    // Convert to a readable format (alphanumeric, no ambiguous characters)
    const code = buffer.toString('hex').replace(/[01lIO]/g, '').substring(0, length);
    codes.push(code.toUpperCase());
  }
  
  return codes;
}

/**
 * Hash a token for storage
 * @param token Token to hash
 * @returns Hashed token
 */
export async function hashToken(token: string): Promise<string> {
  return crypto.createHash(HASH_ALGORITHM).update(token).digest('hex');
}

export default {
  generateSecureToken,
  generateApiKey,
  hashValue,
  verifyHash,
  generateTOTPSecret,
  generatePasswordResetToken,
  generateSessionToken,
  generateBackupCodes,
  hashToken
};
