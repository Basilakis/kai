/**
 * Agent Routes
 * 
 * Defines RESTful API endpoints for agent interaction,
 * connecting the frontend agent UI with the backend
 * agent system.
 */

import Router from 'express';
import type Request from 'express';
import type Response from 'express';
import multer from 'multer';
import * as agentController from '../controllers/agents.controller';
import { authMiddleware } from '../middleware/auth.middleware';

const router = Router();

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const fileExt = file.originalname.split('.').pop();
    cb(null, `${file.fieldname}-${uniqueSuffix}.${fileExt}`);
  },
});

const upload = multer({ 
  storage, 
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req, file, cb) => {
    // Accept only image files
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(null, false);
      return new Error('Only image files are allowed');
    }
  }
});

// Initialize routes
// Some routes are protected by auth middleware, others are public
// In a production environment, all routes should be protected

/**
 * @route   POST /api/agents/session
 * @desc    Create a new agent session
 * @access  Public (should be restricted in production)
 */
router.post('/session', agentController.createSession);

/**
 * @route   POST /api/agents/session/:sessionId/message
 * @desc    Send a message to an agent
 * @access  Public (should be restricted in production)
 */
router.post('/session/:sessionId/message', agentController.sendMessage);

/**
 * @route   GET /api/agents/session/:sessionId/messages
 * @desc    Get messages for a session
 * @access  Public (should be restricted in production)
 */
router.get('/session/:sessionId/messages', agentController.getMessages);

/**
 * @route   POST /api/agents/session/:sessionId/image
 * @desc    Upload image for recognition agent
 * @access  Public (should be restricted in production)
 */
router.post(
  '/session/:sessionId/image',
  upload.single('image'),
  agentController.uploadImage
);

/**
 * @route   DELETE /api/agents/session/:sessionId
 * @desc    Close a session
 * @access  Public (should be restricted in production)
 */
router.delete('/session/:sessionId', agentController.closeSession);

// Admin routes (protected)
/**
 * @route   GET /api/agents/admin/status
 * @desc    Get agent system status
 * @access  Admin
 */
router.get(
  '/admin/status',
  authMiddleware,
  (req: Request, res: Response) => {
    // This would call a method to get system status
    // For now, just return a placeholder response
    res.status(200).json({
      status: 'operational',
      sessions: {
        active: 42,
        total: 1337
      },
      performance: {
        avgResponseTime: '1.2s',
        errorRate: '0.5%'
      },
      lastUpdated: new Date()
    });
  }
);

export default router;