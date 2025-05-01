import express from 'express';
import { dependenciesController } from '../controllers/dependencies.controller';
import { authMiddleware } from '../middleware/auth.middleware';
import moduleAccessMiddleware from '../middleware/module-access.middleware';

const router = express.Router();
// Assign middlewares
const auth = authMiddleware;
// Create middleware to restrict access to admin users
const adminOnly = moduleAccessMiddleware.requireModuleAccess('admin');

/**
 * @swagger
 * tags:
 *   name: Dependencies
 *   description: Dependency management API
 */

/**
 * @swagger
 * /admin/dependencies/outdated:
 *   get:
 *     summary: Get list of outdated packages with analysis
 *     tags: [Dependencies]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Successfully retrieved outdated packages
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - Admin access required
 *       500:
 *         description: Server error
 */
router.get('/outdated', auth, adminOnly, dependenciesController.getOutdatedPackages.bind(dependenciesController));

/**
 * @swagger
 * /admin/dependencies/scan:
 *   post:
 *     summary: Trigger a dependency scan
 *     tags: [Dependencies]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               scanType:
 *                 type: string
 *                 enum: [all, node, python]
 *                 default: all
 *     responses:
 *       200:
 *         description: Scan job started successfully
 *       400:
 *         description: Invalid request
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - Admin access required
 *       500:
 *         description: Server error
 */
router.post('/scan', auth, adminOnly, dependenciesController.triggerDependencyScan.bind(dependenciesController));

/**
 * @swagger
 * /admin/dependencies/scan/{id}/status:
 *   get:
 *     summary: Get status of a scan job
 *     tags: [Dependencies]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID of the scan job or 'latest'
 *     responses:
 *       200:
 *         description: Successfully retrieved scan status
 *       404:
 *         description: Scan job not found
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - Admin access required
 *       500:
 *         description: Server error
 */
router.get('/scan/:id/status', auth, adminOnly, dependenciesController.getScanStatus.bind(dependenciesController));

/**
 * @swagger
 * /admin/dependencies/update:
 *   post:
 *     summary: Update specified packages
 *     tags: [Dependencies]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               packages:
 *                 type: array
 *                 items:
 *                   type: string
 *               updateType:
 *                 type: string
 *                 enum: [safe, caution, manual]
 *                 default: safe
 *     responses:
 *       200:
 *         description: Update job started successfully
 *       400:
 *         description: Invalid request
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - Admin access required
 *       500:
 *         description: Server error
 */
router.post('/update', auth, adminOnly, dependenciesController.updatePackages.bind(dependenciesController));

/**
 * @swagger
 * /admin/dependencies/config-analysis:
 *   post:
 *     summary: Get configuration impact analysis for packages
 *     tags: [Dependencies]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               packages:
 *                 type: array
 *                 items:
 *                   type: string
 *     responses:
 *       200:
 *         description: Successfully retrieved config impact analysis
 *       400:
 *         description: Invalid request
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - Admin access required
 *       500:
 *         description: Server error
 */
router.post('/config-analysis', auth, adminOnly, dependenciesController.getConfigImpactAnalysis.bind(dependenciesController));

/**
 * @swagger
 * /admin/dependencies/helm-compatibility:
 *   post:
 *     summary: Check Helm chart compatibility with package updates
 *     tags: [Dependencies]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               packages:
 *                 type: array
 *                 items:
 *                   type: string
 *     responses:
 *       200:
 *         description: Successfully checked Helm compatibility
 *       400:
 *         description: Invalid request
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - Admin access required
 *       500:
 *         description: Server error
 */
router.post('/helm-compatibility', auth, adminOnly, dependenciesController.checkHelmCompatibility.bind(dependenciesController));

/**
 * @swagger
 * /admin/dependencies/history:
 *   get:
 *     summary: Get dependency update history
 *     tags: [Dependencies]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *       - in: query
 *         name: offset
 *         schema:
 *           type: integer
 *           default: 0
 *     responses:
 *       200:
 *         description: Successfully retrieved update history
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - Admin access required
 *       500:
 *         description: Server error
 */
router.get('/history', auth, adminOnly, dependenciesController.getUpdateHistory.bind(dependenciesController));

export default router;