/**
 * Webhook API
 * 
 * This module provides functions for interacting with the webhook API.
 */

import { apiClient } from './client';

/**
 * Get webhook configurations
 * @returns Webhook configurations
 */
export const getWebhookConfigurations = async () => {
  const response = await apiClient.get('/webhooks/configurations');
  return response.data;
};

/**
 * Get webhook configuration by ID
 * @param id Webhook configuration ID
 * @returns Webhook configuration
 */
export const getWebhookConfiguration = async (id: string) => {
  const response = await apiClient.get(`/webhooks/configurations/${id}`);
  return response.data;
};

/**
 * Create webhook configuration
 * @param config Webhook configuration
 * @returns Created webhook configuration
 */
export const createWebhookConfiguration = async (config: {
  name: string;
  url: string;
  events: string[];
  isActive?: boolean;
}) => {
  const response = await apiClient.post('/webhooks/configurations', config);
  return response.data;
};

/**
 * Update webhook configuration
 * @param id Webhook configuration ID
 * @param config Webhook configuration
 * @returns Updated webhook configuration
 */
export const updateWebhookConfiguration = async (
  id: string,
  config: {
    name?: string;
    url?: string;
    events?: string[];
    isActive?: boolean;
  }
) => {
  const response = await apiClient.put(`/webhooks/configurations/${id}`, config);
  return response.data;
};

/**
 * Delete webhook configuration
 * @param id Webhook configuration ID
 * @returns Success message
 */
export const deleteWebhookConfiguration = async (id: string) => {
  const response = await apiClient.delete(`/webhooks/configurations/${id}`);
  return response.data;
};

/**
 * Test webhook
 * @param id Webhook configuration ID
 * @returns Test result
 */
export const testWebhook = async (id: string) => {
  const response = await apiClient.post(`/webhooks/configurations/${id}/test`);
  return response.data;
};

/**
 * Regenerate webhook secret
 * @param id Webhook configuration ID
 * @returns New webhook secret
 */
export const regenerateWebhookSecret = async (id: string) => {
  const response = await apiClient.post(`/webhooks/configurations/${id}/regenerate-secret`);
  return response.data;
};

/**
 * Get webhook delivery logs
 * @param id Webhook configuration ID
 * @param options Options for pagination and filtering
 * @returns Webhook delivery logs
 */
export const getWebhookDeliveryLogs = async (
  id: string,
  options: {
    limit?: number;
    offset?: number;
    status?: 'success' | 'error';
  } = {}
) => {
  const params = new URLSearchParams();
  
  if (options.limit) {
    params.append('limit', options.limit.toString());
  }
  
  if (options.offset) {
    params.append('offset', options.offset.toString());
  }
  
  if (options.status) {
    params.append('status', options.status);
  }
  
  const response = await apiClient.get(`/webhooks/configurations/${id}/logs?${params.toString()}`);
  return response.data;
};
