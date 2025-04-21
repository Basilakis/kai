/**
 * Network Access Routes
 *
 * Routes for managing network access control settings:
 * - Internal network CIDR ranges
 * - API endpoint access rules
 */
import express from 'express';
import { authMiddleware } from '../../middleware/auth.middleware';
import { authorize } from '../../middleware/auth.middleware';
import { NetworkAccessType } from '../../utils/network';
import networkAccessController from '../../controllers/networkAccess.controller';
import { asyncHandler } from '../../middleware/error.middleware';
import { logger } from '../../utils/logger';

const router = express.Router();

// All routes require admin authentication
router.use(authMiddleware);
router.use(authorize({ roles: ['admin'], accessType: NetworkAccessType.ANY }));

/**
 * @route   GET /api/admin/network-access/internal-networks
 * @desc    Get all internal networks
 * @access  Admin
 */
router.get('/internal-networks', networkAccessController.getInternalNetworks);

/**
 * @route   POST /api/admin/network-access/internal-networks
 * @desc    Add a new internal network
 * @access  Admin
 */
router.post('/internal-networks', networkAccessController.addInternalNetwork);

/**
 * @route   DELETE /api/admin/network-access/internal-networks/:id
 * @desc    Remove an internal network
 * @access  Admin
 */
router.delete('/internal-networks/:id', networkAccessController.removeInternalNetwork);

/**
 * @route   GET /api/admin/network-access/endpoints
 * @desc    Get all endpoint access rules
 * @access  Admin
 */
router.get('/endpoints', networkAccessController.getEndpointAccessRules);

/**
 * @route   POST /api/admin/network-access/endpoints
 * @desc    Add a new endpoint access rule
 * @access  Admin
 */
router.post('/endpoints', networkAccessController.addEndpointAccess);

/**
 * @route   PUT /api/admin/network-access/endpoints/:id
 * @desc    Update endpoint access rule
 * @access  Admin
 */
router.put('/endpoints/:id', networkAccessController.updateEndpointAccess);

/**
 * @route   GET /api/admin/network-access/check-endpoints
 * @desc    Check for unregistered API endpoints
 * @access  Admin
 */
router.get('/check-endpoints', asyncHandler(async (req, res) => {
  try {
    // Import the check-unregistered-endpoints script
    const checkUnregisteredEndpoints = require('../../scripts/check-unregistered-endpoints').default;

    // Run the script
    const unregisteredEndpoints = await checkUnregisteredEndpoints();

    // Return the results
    res.status(200).json({
      success: true,
      unregisteredEndpoints
    });
  } catch (error) {
    logger.error('Error checking unregistered endpoints:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to check unregistered endpoints'
    });
  }
}));

/**
 * @route   POST /api/admin/network-access/register-endpoints
 * @desc    Register unregistered API endpoints
 * @access  Admin
 */
router.post('/register-endpoints', asyncHandler(async (req, res) => {
  try {
    // Import the register-api-endpoints script
    const registerApiEndpoints = require('../../scripts/register-api-endpoints').default;

    // Run the script
    const result = await registerApiEndpoints();

    // Return the results
    res.status(200).json({
      success: true,
      registered: result.registered || 0,
      skipped: result.skipped || 0
    });
  } catch (error) {
    logger.error('Error registering API endpoints:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to register API endpoints'
    });
  }
}));

export default router;