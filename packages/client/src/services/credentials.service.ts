/**
 * Credentials Service
 * 
 * API client for managing crawler service credentials
 */

import axios from 'axios';
import { API_BASE_URL } from '../config';
import { getAuthToken } from './auth.service';

// Available crawler providers
export type CrawlerProvider = 'jina' | 'firecrawl';

// Credential status type
export interface CredentialStatus {
  hasCredentials: boolean;
  isValid?: boolean;
  lastTested?: number;
}

// Credentials type
export interface Credentials {
  apiKey: string;
  [key: string]: string;
}

// Test result type
export interface TestResult {
  isValid: boolean;
  timestamp: number;
}

/**
 * Get the status of all providers' credentials
 * @returns Status of all providers
 */
export const getCredentialsStatus = async (): Promise<Record<CrawlerProvider, CredentialStatus>> => {
  try {
    const token = getAuthToken();
    const response = await axios.get(`${API_BASE_URL}/credentials`, {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });
    
    return response.data.data;
  } catch (error) {
    console.error('Failed to get credentials status', error);
    throw new Error('Failed to get credentials status');
  }
};

/**
 * Save credentials for a provider
 * @param provider Provider to set credentials for
 * @param credentials Credentials to save
 * @returns Whether the credentials were saved successfully
 */
export const saveCredentials = async (
  provider: CrawlerProvider,
  credentials: Credentials
): Promise<boolean> => {
  try {
    const token = getAuthToken();
    const response = await axios.post(`${API_BASE_URL}/credentials/${provider}`, credentials, {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    
    return response.data.success;
  } catch (error) {
    console.error(`Failed to save credentials for ${provider}`, error);
    throw new Error(`Failed to save credentials for ${provider}`);
  }
};

/**
 * Test credentials for a provider
 * @param provider Provider to test credentials for
 * @returns Test result
 */
export const testCredentials = async (provider: CrawlerProvider): Promise<TestResult> => {
  try {
    const token = getAuthToken();
    const response = await axios.post(`${API_BASE_URL}/credentials/${provider}/test`, {}, {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    
    return response.data.data;
  } catch (error) {
    console.error(`Failed to test credentials for ${provider}`, error);
    throw new Error(`Failed to test credentials for ${provider}`);
  }
};

/**
 * Delete credentials for a provider
 * @param provider Provider to delete credentials for
 * @returns Whether the credentials were deleted successfully
 */
export const deleteCredentials = async (provider: CrawlerProvider): Promise<boolean> => {
  try {
    const token = getAuthToken();
    const response = await axios.delete(`${API_BASE_URL}/credentials/${provider}`, {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });
    
    return response.data.success;
  } catch (error) {
    console.error(`Failed to delete credentials for ${provider}`, error);
    throw new Error(`Failed to delete credentials for ${provider}`);
  }
};