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

export default router;