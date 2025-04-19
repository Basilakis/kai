/**
 * Notification Routes
 * 
 * This file defines API routes for managing notifications and preferences.
 */

import express from 'express';
import { authMiddleware } from '../middleware/auth.middleware';
import { asyncHandler } from '../middleware/error.middleware';
import {
  getNotificationPreferences,
  updateNotificationPreferences,
  getInAppNotifications,
  markNotificationsAsRead,
  markAllNotificationsAsRead,
  deleteNotifications,
  getUnreadNotificationCount,
  sendTestNotification
} from '../controllers/notification/notification.controller';

const router = express.Router();

// Apply authentication middleware to all notification routes
router.use(authMiddleware);

// Notification preferences routes
router.get(
  '/preferences',
  asyncHandler(getNotificationPreferences)
);

router.put(
  '/preferences',
  asyncHandler(updateNotificationPreferences)
);

// In-app notifications routes
router.get(
  '/',
  asyncHandler(getInAppNotifications)
);

router.post(
  '/mark-as-read',
  asyncHandler(markNotificationsAsRead)
);

router.post(
  '/mark-all-as-read',
  asyncHandler(markAllNotificationsAsRead)
);

router.post(
  '/delete',
  asyncHandler(deleteNotifications)
);

router.get(
  '/unread-count',
  asyncHandler(getUnreadNotificationCount)
);

// Test notification
router.post(
  '/test',
  asyncHandler(sendTestNotification)
);

export default router;
