/**
 * Admin Notification Routes
 * 
 * Defines API routes for admin management of notification templates and sending notifications.
 */

import express from 'express';
import { authMiddleware, authorize } from '../../middleware/auth.middleware';
import { asyncHandler } from '../../middleware/error.middleware';
import { NetworkAccessType } from '../../utils/network';
import {
  getNotificationTemplates,
  getNotificationTemplateById,
  createNotificationTemplate,
  updateNotificationTemplate,
  deleteNotificationTemplate,
  sendAdminNotification
} from '../../controllers/admin/notification.admin.controller';

const router = express.Router();

// Apply admin authentication and network restriction to all routes in this file
router.use(authMiddleware, authorize({ 
  roles: ['admin'], 
  accessType: NetworkAccessType.INTERNAL_ONLY 
}));

// Template CRUD routes
router.get('/templates', asyncHandler(getNotificationTemplates));
router.post('/templates', asyncHandler(createNotificationTemplate));
router.get('/templates/:id', asyncHandler(getNotificationTemplateById));
router.put('/templates/:id', asyncHandler(updateNotificationTemplate));
router.delete('/templates/:id', asyncHandler(deleteNotificationTemplate));

// Send notification route
router.post('/send', asyncHandler(sendAdminNotification));

export default router;