/**
 * Kubernetes Admin Routes
 *
 * Defines API routes for admin access to Kubernetes resources.
 */

import express, { Request, Response } from 'express';
import { authMiddleware, authorize } from '../../middleware/auth.middleware';
import { asyncHandler } from '../../middleware/error.middleware';
import { NetworkAccessType } from '../../utils/network';
import { KubernetesService } from '../../services/kubernetes/kubernetes.service';
import { logger } from '../../utils/logger';

// Create router
const router = express.Router();

// Apply admin authentication and network restriction to all routes in this file
// Ensure these routes are only accessible internally and by admin users
router.use(authMiddleware, authorize({
  roles: ['admin'],
  accessType: NetworkAccessType.INTERNAL_ONLY
}));

// Add additional security logging for all Kubernetes API access
router.use((req: Request, res: Response, next: express.NextFunction) => {
  const user = (req as any).user;
  logger.info('Kubernetes API access', {
    userId: user?.id,
    email: user?.email,
    endpoint: req.path,
    method: req.method,
    ip: req.ip
  });
  next();
});

// Initialize Kubernetes service
const kubernetesService = new KubernetesService(process.env.KUBERNETES_NAMESPACE || 'default');

/**
 * @route   GET /api/admin/kubernetes/stats
 * @desc    Get cluster statistics
 * @access  Private (Admin)
 */
router.get('/stats', asyncHandler(async (_req: Request, res: Response) => {
  const stats = await kubernetesService.getClusterStats();
  res.json(stats);
}));

/**
 * @route   GET /api/admin/kubernetes/pods
 * @desc    Get pod details
 * @access  Private (Admin)
 */
router.get('/pods', asyncHandler(async (req: Request, res: Response) => {
  const namespace = req.query.namespace as string | undefined;
  const pods = await kubernetesService.getPods(namespace);
  res.json(pods);
}));

/**
 * @route   GET /api/admin/kubernetes/nodes
 * @desc    Get node details
 * @access  Private (Admin)
 */
router.get('/nodes', asyncHandler(async (_req: Request, res: Response) => {
  const nodes = await kubernetesService.getNodes();
  res.json(nodes);
}));

/**
 * @route   GET /api/admin/kubernetes/deployments
 * @desc    Get deployment details
 * @access  Private (Admin)
 */
router.get('/deployments', asyncHandler(async (req: Request, res: Response) => {
  const namespace = req.query.namespace as string | undefined;
  const deployments = await kubernetesService.getDeployments(namespace);
  res.json(deployments);
}));

/**
 * @route   GET /api/admin/kubernetes/events
 * @desc    Get Kubernetes events
 * @access  Private (Admin)
 */
router.get('/events', asyncHandler(async (req: Request, res: Response) => {
  const namespace = req.query.namespace as string | undefined;
  const events = await kubernetesService.getEvents(namespace);
  res.json(events);
}));

/**
 * @route   GET /api/admin/kubernetes/logs/:podName
 * @desc    Get pod logs
 * @access  Private (Admin)
 */
router.get('/logs/:podName', asyncHandler(async (req: Request, res: Response) => {
  const { podName } = req.params;
  const containerName = req.query.container as string | undefined;
  const namespace = req.query.namespace as string | undefined;
  const tailLines = req.query.tailLines ? parseInt(req.query.tailLines as string, 10) : undefined;

  const logs = await kubernetesService.getPodLogs(podName, containerName, namespace, tailLines);
  res.json(logs);
}));

/**
 * @route   POST /api/admin/kubernetes/pods/:podName/kill
 * @desc    Kill a pod
 * @access  Private (Admin)
 */
router.post('/pods/:podName/kill', asyncHandler(async (req: Request, res: Response) => {
  const { podName } = req.params;
  const namespace = req.body.namespace as string;

  if (!namespace) {
    return res.status(400).json({ error: 'Namespace is required' });
  }

  logger.info('Killing pod', { podName, namespace, userId: (req as any).user?.id });

  await kubernetesService.deletePod(podName, namespace, { gracePeriodSeconds: 0 });
  res.json({ success: true, message: `Pod ${podName} in namespace ${namespace} has been killed` });
}));

/**
 * @route   POST /api/admin/kubernetes/pods/:podName/restart
 * @desc    Restart a pod
 * @access  Private (Admin)
 */
router.post('/pods/:podName/restart', asyncHandler(async (req: Request, res: Response) => {
  const { podName } = req.params;
  const namespace = req.body.namespace as string;

  if (!namespace) {
    return res.status(400).json({ error: 'Namespace is required' });
  }

  logger.info('Restarting pod', { podName, namespace, userId: (req as any).user?.id });

  await kubernetesService.deletePod(podName, namespace);
  res.json({ success: true, message: `Pod ${podName} in namespace ${namespace} has been restarted` });
}));

export default router;
