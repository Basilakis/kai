/**
 * Notification API
 * 
 * This module provides functions for interacting with the notification API.
 */

import { apiClient } from './client';

/**
 * Get notification preferences
 * @returns Notification preferences
 */
export const getNotificationPreferences = async () => {
  const response = await apiClient.get('/notifications/preferences');
  return response.data;
};

/**
 * Update notification preferences
 * @param preferences Notification preferences
 * @returns Success message
 */
export const updateNotificationPreferences = async (preferences: any) => {
  const response = await apiClient.put('/notifications/preferences', preferences);
  return response.data;
};

/**
 * Get notification history
 * @param options Options for pagination and filtering
 * @returns Notification history
 */
export const getNotificationHistory = async (options: {
  limit?: number;
  offset?: number;
  type?: string;
} = {}) => {
  const params = new URLSearchParams();
  
  if (options.limit) {
    params.append('limit', options.limit.toString());
  }
  
  if (options.offset) {
    params.append('offset', options.offset.toString());
  }
  
  if (options.type) {
    params.append('type', options.type);
  }
  
  const response = await apiClient.get(`/notifications/history?${params.toString()}`);
  return response.data;
};

/**
 * Mark notifications as read
 * @param ids Notification IDs
 * @returns Success message
 */
export const markNotificationsAsRead = async (ids: string[]) => {
  const response = await apiClient.post('/notifications/mark-as-read', { ids });
  return response.data;
};

/**
 * Mark all notifications as read
 * @returns Success message
 */
export const markAllNotificationsAsRead = async () => {
  const response = await apiClient.post('/notifications/mark-all-as-read');
  return response.data;
};

/**
 * Delete notifications
 * @param ids Notification IDs
 * @returns Success message
 */
export const deleteNotifications = async (ids: string[]) => {
  const response = await apiClient.post('/notifications/delete', { ids });
  return response.data;
};

/**
 * Send a test notification
 * @param type Notification type
 * @returns Success message
 */
export const sendTestNotification = async (type: 'email' | 'sms' | 'push' | 'in_app') => {
  const response = await apiClient.post('/notifications/test', { type });
  return response.data;
};
