/**
 * Agent Routes
 *
 * Defines RESTful API endpoints for agent interaction,
 * connecting the frontend agent UI with the backend
 * agent system.
 */

import express, { Request, Response } from 'express';
import multer from 'multer';
import * as agentController from '../controllers/agents.controller';
// Updated import to include authorizeRoles
import { authMiddleware, validateSessionOwnership, authorizeRoles } from '../middleware/auth.middleware'; 
import { asyncHandler } from '../middleware/error.middleware'; // Added import

// Extend Express Request interface to add user property
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        role: string;
        email?: string;
      };
    }
  }
}

const router = express.Router();

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (_req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const fileExt = file.originalname.split('.').pop();
    cb(null, `${file.fieldname}-${uniqueSuffix}.${fileExt}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (_req, file, cb) => {
    // Accept only image files
    if (file.mimetype.startsWith('image/')) {
      return cb(null, true);
    } else {
      return cb(new Error('Only image files are allowed'), false);
    }
  }
});

// Initialize routes
// All routes are now protected by auth middleware and session ownership validation

/**
 * @route   POST /api/agents/session
 * @desc    Create a new agent session
 * @access  Private - Authenticated users only
 */
router.post('/session', authMiddleware, agentController.createSession);

/**
 * @route   POST /api/agents/session/:sessionId/message
 * @desc    Send a message to an agent
 * @access  Private - Session owner only
 */
router.post(
  '/session/:sessionId/message',
  authMiddleware,
  validateSessionOwnership(), // Ensure user owns the session
  agentController.sendMessage
);

/**
 * @route   GET /api/agents/session/:sessionId/messages
 * @desc    Get messages for a session
 * @access  Private - Session owner only
 */
router.get(
  '/session/:sessionId/messages',
  authMiddleware,
  validateSessionOwnership(), // Ensure user owns the session
  agentController.getMessages
);

/**
 * @route   POST /api/agents/session/:sessionId/image
 * @desc    Upload image for recognition agent
 * @access  Private - Session owner only
 */
router.post(
  '/session/:sessionId/image',
  authMiddleware,
  validateSessionOwnership(), // Ensure user owns the session
  upload.single('image'),
  agentController.uploadImage
);

/**
 * @route   DELETE /api/agents/session/:sessionId
 * @desc    Close a session
 * @access  Private - Session owner only
 */
router.delete(
  '/session/:sessionId',
  authMiddleware,
  validateSessionOwnership(), // Ensure user owns the session
  agentController.closeSession
);

// Admin routes (protected)
/**
 * @route   GET /api/agents/admin/status
 * @desc    Get agent system status
 * @access  Admin only
 */
// Added authorizeRoles middleware
router.get(
  '/admin/status',
  authMiddleware, 
  authorizeRoles(['admin']), // Added admin role check
  asyncHandler(agentController.getAgentSystemStatus)
);

/**
 * @route   GET /api/agents/user/sessions
 * @desc    Get all agent sessions for the current user
 * @access  Private - Authenticated users only
 */
router.get(
  '/user/sessions',
  authMiddleware,
  asyncHandler(agentController.getUserSessions)
);

export default router;