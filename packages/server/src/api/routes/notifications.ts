/**
 * Notification API Routes
 * 
 * This module provides API endpoints for managing notifications, including:
 * - Sending notifications
 * - Managing notification preferences
 * - Retrieving notification history
 * - Managing notification templates
 */

import { Router } from 'express';
import { body, param, query } from 'express-validator';
import { validateRequest } from '../middleware/validateRequest';
import { requireAuth } from '../middleware/requireAuth';
import { requireAdmin } from '../middleware/requireAdmin';
import { notificationController } from '../controllers/notificationController';

const router = Router();

// Get notification preferences
router.get(
  '/preferences',
  requireAuth,
  notificationController.getNotificationPreferences
);

// Update notification preferences
router.put(
  '/preferences',
  requireAuth,
  body('email_enabled').optional().isBoolean(),
  body('sms_enabled').optional().isBoolean(),
  body('push_enabled').optional().isBoolean(),
  body('in_app_enabled').optional().isBoolean(),
  body('marketing_enabled').optional().isBoolean(),
  body('transaction_enabled').optional().isBoolean(),
  body('social_enabled').optional().isBoolean(),
  body('security_enabled').optional().isBoolean(),
  validateRequest,
  notificationController.updateNotificationPreferences
);

// Get user notifications
router.get(
  '/history',
  requireAuth,
  query('limit').optional().isInt({ min: 1, max: 100 }),
  query('offset').optional().isInt({ min: 0 }),
  query('type').optional().isString(),
  validateRequest,
  notificationController.getUserNotifications
);

// Mark notifications as read
router.post(
  '/mark-as-read',
  requireAuth,
  body('ids').isArray(),
  validateRequest,
  notificationController.markNotificationsAsRead
);

// Mark all notifications as read
router.post(
  '/mark-all-as-read',
  requireAuth,
  notificationController.markAllNotificationsAsRead
);

// Delete notifications
router.post(
  '/delete',
  requireAuth,
  body('ids').isArray(),
  validateRequest,
  notificationController.deleteNotifications
);

// Send a test notification
router.post(
  '/test',
  requireAuth,
  body('type').isString().isIn(['email', 'sms', 'push', 'in_app']),
  validateRequest,
  notificationController.sendTestNotification
);

// Admin: Send notification to users
router.post(
  '/send',
  requireAuth,
  requireAdmin,
  body('title').isString().notEmpty(),
  body('message').isString().notEmpty(),
  body('channels').isArray().notEmpty(),
  body('recipients').isString().isIn(['all', 'groups', 'specific']),
  body('userGroups').optional().isArray(),
  body('specificUsers').optional().isString(),
  body('templateId').optional().isString(),
  body('schedule').optional().isBoolean(),
  body('scheduledDate').optional().isString(),
  body('scheduledTime').optional().isString(),
  validateRequest,
  notificationController.sendNotification
);

// Admin: Get notification templates
router.get(
  '/templates',
  requireAuth,
  requireAdmin,
  notificationController.getNotificationTemplates
);

// Admin: Get notification template by ID
router.get(
  '/templates/:id',
  requireAuth,
  requireAdmin,
  param('id').isString().notEmpty(),
  validateRequest,
  notificationController.getNotificationTemplate
);

// Admin: Create notification template
router.post(
  '/templates',
  requireAuth,
  requireAdmin,
  body('name').isString().notEmpty(),
  body('description').optional().isString(),
  body('type').isString().isIn(['email', 'sms', 'push', 'in_app']),
  body('format').isString().isIn(['html', 'text', 'markdown', 'json']),
  body('content').isString().notEmpty(),
  body('subject').optional().isString(),
  body('variables').optional().isArray(),
  validateRequest,
  notificationController.createNotificationTemplate
);

// Admin: Update notification template
router.put(
  '/templates/:id',
  requireAuth,
  requireAdmin,
  param('id').isString().notEmpty(),
  body('name').optional().isString().notEmpty(),
  body('description').optional().isString(),
  body('type').optional().isString().isIn(['email', 'sms', 'push', 'in_app']),
  body('format').optional().isString().isIn(['html', 'text', 'markdown', 'json']),
  body('content').optional().isString().notEmpty(),
  body('subject').optional().isString(),
  body('variables').optional().isArray(),
  validateRequest,
  notificationController.updateNotificationTemplate
);

// Admin: Delete notification template
router.delete(
  '/templates/:id',
  requireAuth,
  requireAdmin,
  param('id').isString().notEmpty(),
  validateRequest,
  notificationController.deleteNotificationTemplate
);

// Admin: Get notification stats
router.get(
  '/stats',
  requireAuth,
  requireAdmin,
  query('startDate').optional().isString(),
  query('endDate').optional().isString(),
  query('type').optional().isString(),
  validateRequest,
  notificationController.getNotificationStats
);

export default router;
