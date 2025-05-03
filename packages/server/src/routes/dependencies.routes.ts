import express, { Request, Response } from 'express';
const Router = express.Router;
import { dependenciesController } from '../controllers/dependencies.controller';
import { authMiddleware } from '../middleware/auth.middleware';
import moduleAccess from '../middleware/module-access.middleware';

const router = Router();

// API routes for dependency management
// These endpoints are protected by authentication and module access control

/**
 * @swagger
 * /api/dependencies/packages:
 *   get:
 *     summary: Get outdated packages with analysis
 *     description: Returns a list of outdated packages with compatibility analysis
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: List of outdated packages
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       500:
 *         description: Server error
 */
router.get('/packages',
  authMiddleware,
  moduleAccess.requireModuleAccess('admin'),
  dependenciesController.getOutdatedPackages.bind(dependenciesController)
);

/**
 * @swagger
 * /api/dependencies/scan:
 *   post:
 *     summary: Trigger a dependency scan
 *     description: Starts a new dependency scan job
 *     security:
 *       - BearerAuth: []
 *     requestBody:
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
 *         description: Scan job started
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       500:
 *         description: Server error
 */
router.post('/scan',
  authMiddleware,
  moduleAccess.requireModuleAccess('admin'),
  dependenciesController.triggerDependencyScan.bind(dependenciesController)
);

/**
 * @swagger
 * /api/dependencies/scan/{id}/status:
 *   get:
 *     summary: Get scan job status
 *     description: Returns the status of a specific scan job
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: string
 *         required: true
 *         description: The ID of the scan job or 'latest' for the most recent job
 *     responses:
 *       200:
 *         description: Scan job status
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Job not found
 *       500:
 *         description: Server error
 */
router.get('/scan/:id/status',
  authMiddleware,
  moduleAccess.requireModuleAccess('admin'),
  dependenciesController.getDependencyScanStatus.bind(dependenciesController)
);

/**
 * @swagger
 * /api/dependencies/scan/{id}/logs:
 *   get:
 *     summary: Get scan job logs
 *     description: Returns the logs from a specific scan job
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: string
 *         required: true
 *         description: The ID of the scan job
 *     responses:
 *       200:
 *         description: Scan job logs
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Job not found
 *       500:
 *         description: Server error
 */
router.get('/scan/:id/logs',
  authMiddleware,
  moduleAccess.requireModuleAccess('admin'),
  dependenciesController.getJobLogs.bind(dependenciesController)
);

/**
 * @swagger
 * /api/dependencies/update:
 *   post:
 *     summary: Update packages
 *     description: Triggers updates for specified packages
 *     security:
 *       - BearerAuth: []
 *     requestBody:
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
 *         description: Update triggered
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       500:
 *         description: Server error
 */
router.post('/update',
  authMiddleware,
  moduleAccess.requireModuleAccess('admin'),
  dependenciesController.updatePackage.bind(dependenciesController)
);

/**
 * @swagger
 * /api/dependencies/config-impact:
 *   post:
 *     summary: Get configuration impact analysis
 *     description: Analyzes how package updates might impact configuration files
 *     security:
 *       - BearerAuth: []
 *     requestBody:
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
 *         description: Configuration impact analysis
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       500:
 *         description: Server error
 */
router.post('/config-impact',
  authMiddleware,
  moduleAccess.requireModuleAccess('admin'),
  dependenciesController.getCompatibilityAnalysis.bind(dependenciesController)
);

/**
 * @swagger
 * /api/dependencies/helm-compatibility:
 *   post:
 *     summary: Check Helm chart compatibility
 *     description: Analyzes how package updates might impact Helm charts
 *     security:
 *       - BearerAuth: []
 *     requestBody:
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
 *         description: Helm chart compatibility analysis
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       500:
 *         description: Server error
 */
// Not implemented yet, return a "not implemented" response
router.post('/helm-compatibility',
  authMiddleware,
  moduleAccess.requireModuleAccess('admin'),
  (_req: Request, res: Response) => {
    res.status(501).json({ error: 'Not implemented yet' });
  }
);

/**
 * @swagger
 * /api/dependencies/history:
 *   get:
 *     summary: Get update history
 *     description: Returns the history of dependency updates
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *         description: Number of records to return
 *       - in: query
 *         name: offset
 *         schema:
 *           type: integer
 *           default: 0
 *         description: Number of records to skip
 *     responses:
 *       200:
 *         description: Update history
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       500:
 *         description: Server error
 */
// Not implemented yet, return a "not implemented" response
router.get('/history',
  authMiddleware,
  moduleAccess.requireModuleAccess('admin'),
  (_req: Request, res: Response) => {
    res.status(501).json({ error: 'Not implemented yet' });
  }
);

export default router;