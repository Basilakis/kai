/**
 * Kubernetes Service
 *
 * Provides methods to interact with the Kubernetes API for monitoring
 * cluster status, pods, deployments, and other resources.
 */

import * as k8s from '@kubernetes/client-node';
import { logger } from '../../utils/logger';

export interface ClusterStats {
  nodes: number;
  pods: {
    total: number;
    running: number;
    pending: number;
    failed: number;
    succeeded: number;
    unknown: number;
  };
  deployments: number;
  services: number;
}

export interface PodDetails {
  name: string;
  namespace: string;
  status: string;
  phase: string;
  nodeName: string;
  ip: string;
  startTime: string;
  containers: {
    name: string;
    image: string;
    ready: boolean;
    restartCount: number;
    state: string;
  }[];
  labels: Record<string, string>;
  conditions: {
    type: string;
    status: string;
    lastTransitionTime: string;
    reason?: string;
    message?: string;
  }[];
}

export interface NodeDetails {
  name: string;
  status: string;
  roles: string[];
  version: string;
  internalIP: string;
  externalIP?: string;
  osImage: string;
  kernelVersion: string;
  containerRuntime: string;
  conditions: {
    type: string;
    status: string;
    lastHeartbeatTime: string;
    reason?: string;
    message?: string;
  }[];
  capacity: {
    cpu: string;
    memory: string;
    pods: string;
  };
  allocatable: {
    cpu: string;
    memory: string;
    pods: string;
  };
}

export interface DeploymentDetails {
  name: string;
  namespace: string;
  replicas: number;
  availableReplicas: number;
  updatedReplicas: number;
  readyReplicas: number;
  strategy: string;
  conditions: {
    type: string;
    status: string;
    lastUpdateTime: string;
    reason?: string;
    message?: string;
  }[];
  labels: Record<string, string>;
  selector: Record<string, string>;
  creationTimestamp: string;
}

export interface KubernetesEvent {
  name: string;
  namespace: string;
  type: string;
  reason: string;
  message: string;
  count: number;
  firstTimestamp: string;
  lastTimestamp: string;
  involvedObject: {
    kind: string;
    name: string;
    namespace: string;
  };
  source: {
    component: string;
    host?: string;
  };
}

export interface PodLog {
  podName: string;
  containerName: string;
  namespace: string;
  logs: string;
  timestamp: string;
}

export class KubernetesService {
  private k8sCoreApi: k8s.CoreV1Api;
  private k8sAppsApi: k8s.AppsV1Api;
  private namespace: string;

  /**
   * Creates a new KubernetesService instance
   */
  constructor(namespace: string = 'default') {
    // Initialize Kubernetes client
    const kubeConfig = new k8s.KubeConfig();
    kubeConfig.loadFromDefault();

    this.k8sCoreApi = kubeConfig.makeApiClient(k8s.CoreV1Api);
    this.k8sAppsApi = kubeConfig.makeApiClient(k8s.AppsV1Api);
    this.namespace = namespace;
  }

  /**
   * Get cluster statistics
   * @returns Cluster statistics
   */
  public async getClusterStats(): Promise<ClusterStats> {
    try {
      // Get nodes
      const nodesResponse = await this.k8sCoreApi.listNode();

      // Get pods
      const podsResponse = await this.k8sCoreApi.listPodForAllNamespaces();

      // Get deployments
      const deploymentsResponse = await this.k8sAppsApi.listDeploymentForAllNamespaces();

      // Get services
      const servicesResponse = await this.k8sCoreApi.listServiceForAllNamespaces();

      // Count pods by status
      const podStats = {
        total: podsResponse.body.items.length,
        running: 0,
        pending: 0,
        failed: 0,
        succeeded: 0,
        unknown: 0
      };

      podsResponse.body.items.forEach(pod => {
        const phase = pod.status?.phase?.toLowerCase() || 'unknown';

        switch (phase) {
          case 'running':
            podStats.running++;
            break;
          case 'pending':
            podStats.pending++;
            break;
          case 'failed':
            podStats.failed++;
            break;
          case 'succeeded':
            podStats.succeeded++;
            break;
          default:
            podStats.unknown++;
        }
      });

      return {
        nodes: nodesResponse.body.items.length,
        pods: podStats,
        deployments: deploymentsResponse.body.items.length,
        services: servicesResponse.body.items.length
      };
    } catch (error) {
      logger.error('Error getting cluster stats', {
        error: error instanceof Error ? error.message : String(error)
      });

      throw error;
    }
  }

  /**
   * Get pod details
   * @param namespace Namespace to filter by (optional)
   * @returns List of pod details
   */
  public async getPods(namespace?: string): Promise<PodDetails[]> {
    try {
      const podsResponse = namespace
        ? await this.k8sCoreApi.listNamespacedPod(namespace)
        : await this.k8sCoreApi.listPodForAllNamespaces();

      return podsResponse.body.items.map(pod => {
        return {
          name: pod.metadata?.name || '',
          namespace: pod.metadata?.namespace || '',
          status: this.getPodStatus(pod),
          phase: pod.status?.phase || '',
          nodeName: pod.spec?.nodeName || '',
          ip: pod.status?.podIP || '',
          startTime: pod.status?.startTime || '',
          containers: (pod.spec?.containers || []).map((container, index) => {
            const containerStatus = (pod.status?.containerStatuses || [])[index];

            return {
              name: container.name,
              image: container.image,
              ready: containerStatus?.ready || false,
              restartCount: containerStatus?.restartCount || 0,
              state: this.getContainerState(containerStatus)
            };
          }),
          labels: pod.metadata?.labels || {},
          conditions: (pod.status?.conditions || []).map(condition => ({
            type: condition.type,
            status: condition.status,
            lastTransitionTime: condition.lastTransitionTime || '',
            reason: condition.reason,
            message: condition.message
          }))
        };
      });
    } catch (error) {
      logger.error('Error getting pods', {
        namespace,
        error: error instanceof Error ? error.message : String(error)
      });

      throw error;
    }
  }

  /**
   * Get node details
   * @returns List of node details
   */
  public async getNodes(): Promise<NodeDetails[]> {
    try {
      const nodesResponse = await this.k8sCoreApi.listNode();

      return nodesResponse.body.items.map(node => {
        const addresses = node.status?.addresses || [];
        const internalIP = addresses.find(addr => addr.type === 'InternalIP')?.address || '';
        const externalIP = addresses.find(addr => addr.type === 'ExternalIP')?.address;

        return {
          name: node.metadata?.name || '',
          status: this.getNodeStatus(node),
          roles: this.getNodeRoles(node),
          version: node.status?.nodeInfo?.kubeletVersion || '',
          internalIP,
          externalIP,
          osImage: node.status?.nodeInfo?.osImage || '',
          kernelVersion: node.status?.nodeInfo?.kernelVersion || '',
          containerRuntime: node.status?.nodeInfo?.containerRuntimeVersion || '',
          conditions: (node.status?.conditions || []).map(condition => ({
            type: condition.type,
            status: condition.status,
            lastHeartbeatTime: condition.lastHeartbeatTime || '',
            reason: condition.reason,
            message: condition.message
          })),
          capacity: {
            cpu: node.status?.capacity?.cpu || '',
            memory: node.status?.capacity?.memory || '',
            pods: node.status?.capacity?.pods || ''
          },
          allocatable: {
            cpu: node.status?.allocatable?.cpu || '',
            memory: node.status?.allocatable?.memory || '',
            pods: node.status?.allocatable?.pods || ''
          }
        };
      });
    } catch (error) {
      logger.error('Error getting nodes', {
        error: error instanceof Error ? error.message : String(error)
      });

      throw error;
    }
  }

  /**
   * Get deployment details
   * @param namespace Namespace to filter by (optional)
   * @returns List of deployment details
   */
  public async getDeployments(namespace?: string): Promise<DeploymentDetails[]> {
    try {
      const deploymentsResponse = namespace
        ? await this.k8sAppsApi.listNamespacedDeployment(namespace)
        : await this.k8sAppsApi.listDeploymentForAllNamespaces();

      return deploymentsResponse.body.items.map(deployment => {
        return {
          name: deployment.metadata?.name || '',
          namespace: deployment.metadata?.namespace || '',
          replicas: deployment.spec?.replicas || 0,
          availableReplicas: deployment.status?.availableReplicas || 0,
          updatedReplicas: deployment.status?.updatedReplicas || 0,
          readyReplicas: deployment.status?.readyReplicas || 0,
          strategy: deployment.spec?.strategy?.type || '',
          conditions: (deployment.status?.conditions || []).map(condition => ({
            type: condition.type,
            status: condition.status,
            lastUpdateTime: condition.lastUpdateTime || '',
            reason: condition.reason,
            message: condition.message
          })),
          labels: deployment.metadata?.labels || {},
          selector: deployment.spec?.selector?.matchLabels || {},
          creationTimestamp: deployment.metadata?.creationTimestamp || ''
        };
      });
    } catch (error) {
      logger.error('Error getting deployments', {
        namespace,
        error: error instanceof Error ? error.message : String(error)
      });

      throw error;
    }
  }

  /**
   * Get Kubernetes events
   * @param namespace Namespace to filter by (optional)
   * @returns List of Kubernetes events
   */
  public async getEvents(namespace?: string): Promise<KubernetesEvent[]> {
    try {
      const eventsResponse = namespace
        ? await this.k8sCoreApi.listNamespacedEvent(namespace)
        : await this.k8sCoreApi.listEventForAllNamespaces();

      return eventsResponse.body.items.map(event => {
        return {
          name: event.metadata?.name || '',
          namespace: event.metadata?.namespace || '',
          type: event.type || '',
          reason: event.reason || '',
          message: event.message || '',
          count: event.count || 0,
          firstTimestamp: event.firstTimestamp || '',
          lastTimestamp: event.lastTimestamp || '',
          involvedObject: {
            kind: event.involvedObject?.kind || '',
            name: event.involvedObject?.name || '',
            namespace: event.involvedObject?.namespace || ''
          },
          source: {
            component: event.source?.component || '',
            host: event.source?.host
          }
        };
      });
    } catch (error) {
      logger.error('Error getting events', {
        namespace,
        error: error instanceof Error ? error.message : String(error)
      });

      throw error;
    }
  }

  /**
   * Get pod logs
   * @param podName Pod name
   * @param containerName Container name (optional)
   * @param namespace Namespace (optional)
   * @param tailLines Number of lines to return from the end of the logs (optional)
   * @returns Pod logs
   */
  public async getPodLogs(
    podName: string,
    containerName?: string,
    namespace?: string,
    tailLines?: number
  ): Promise<PodLog> {
    try {
      const ns = namespace || this.namespace;

      const logsResponse = await this.k8sCoreApi.readNamespacedPodLog(
        podName,
        ns,
        containerName,
        undefined, // pretty
        undefined, // follow
        undefined, // insecureSkipTLSVerifyBackend
        undefined, // limitBytes
        undefined, // previous
        undefined, // sinceSeconds
        undefined, // sinceTime
        tailLines, // tailLines
        undefined  // timestamps
      );

      return {
        podName,
        containerName: containerName || '',
        namespace: ns,
        logs: logsResponse.body,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      logger.error('Error getting pod logs', {
        podName,
        containerName,
        namespace,
        error: error instanceof Error ? error.message : String(error)
      });

      throw error;
    }
  }

  /**
   * Delete a pod
   * @param podName Pod name
   * @param namespace Namespace
   * @param options Delete options
   * @returns Delete response
   */
  public async deletePod(
    podName: string,
    namespace: string,
    options: { gracePeriodSeconds?: number } = {}
  ): Promise<void> {
    try {
      const ns = namespace || this.namespace;
      const deleteOptions = new k8s.V1DeleteOptions();

      if (options.gracePeriodSeconds !== undefined) {
        deleteOptions.gracePeriodSeconds = options.gracePeriodSeconds;
      }

      await this.k8sCoreApi.deleteNamespacedPod(
        podName,
        ns,
        undefined, // pretty
        undefined, // dryRun
        undefined, // gracePeriodSeconds (query param)
        undefined, // orphanDependents
        undefined, // propagationPolicy
        deleteOptions // body
      );

      logger.info('Pod deleted successfully', { podName, namespace: ns });
    } catch (error) {
      logger.error('Error deleting pod', {
        podName,
        namespace,
        error: error instanceof Error ? error.message : String(error)
      });

      throw error;
    }
  }

  /**
   * Get pod status
   * @param pod Pod object
   * @returns Pod status
   * @private
   */
  private getPodStatus(pod: k8s.V1Pod): string {
    if (!pod.status) {
      return 'Unknown';
    }

    if (pod.metadata?.deletionTimestamp) {
      return 'Terminating';
    }

    if (pod.status.phase === 'Pending') {
      // Check if pod is in ContainerCreating state
      const containerStatuses = pod.status.containerStatuses || [];
      if (containerStatuses.length > 0) {
        const waitingContainers = containerStatuses.filter(
          status => status.state?.waiting && status.state.waiting.reason === 'ContainerCreating'
        );

        if (waitingContainers.length > 0) {
          return 'ContainerCreating';
        }
      }

      // Check if pod is in ImagePullBackOff state
      const initContainerStatuses = pod.status.initContainerStatuses || [];
      if (initContainerStatuses.length > 0) {
        const imagePullBackOffContainers = initContainerStatuses.filter(
          status => status.state?.waiting &&
            (status.state.waiting.reason === 'ImagePullBackOff' ||
             status.state.waiting.reason === 'ErrImagePull')
        );

        if (imagePullBackOffContainers.length > 0) {
          return 'ImagePullBackOff';
        }
      }
    }

    return pod.status.phase || 'Unknown';
  }

  /**
   * Get container state
   * @param containerStatus Container status
   * @returns Container state
   * @private
   */
  private getContainerState(containerStatus?: k8s.V1ContainerStatus): string {
    if (!containerStatus || !containerStatus.state) {
      return 'Unknown';
    }

    if (containerStatus.state.running) {
      return 'Running';
    }

    if (containerStatus.state.waiting) {
      return containerStatus.state.waiting.reason || 'Waiting';
    }

    if (containerStatus.state.terminated) {
      return containerStatus.state.terminated.reason || 'Terminated';
    }

    return 'Unknown';
  }

  /**
   * Get node status
   * @param node Node object
   * @returns Node status
   * @private
   */
  private getNodeStatus(node: k8s.V1Node): string {
    if (!node.status || !node.status.conditions) {
      return 'Unknown';
    }

    // Check for Ready condition
    const readyCondition = node.status.conditions.find(condition => condition.type === 'Ready');
    if (readyCondition && readyCondition.status === 'True') {
      return 'Ready';
    }

    // Check for other conditions
    const notReadyCondition = node.status.conditions.find(
      condition => condition.type === 'Ready' && condition.status === 'False'
    );
    if (notReadyCondition) {
      return notReadyCondition.reason || 'NotReady';
    }

    return 'Unknown';
  }

  /**
   * Get node roles
   * @param node Node object
   * @returns Node roles
   * @private
   */
  private getNodeRoles(node: k8s.V1Node): string[] {
    if (!node.metadata || !node.metadata.labels) {
      return [];
    }

    const roles: string[] = [];

    // Check for node-role.kubernetes.io labels
    Object.keys(node.metadata.labels).forEach(label => {
      if (label.startsWith('node-role.kubernetes.io/')) {
        const role = label.replace('node-role.kubernetes.io/', '');
        roles.push(role);
      }
    });

    // Check for kubernetes.io/role label (older style)
    if (node.metadata.labels['kubernetes.io/role']) {
      roles.push(node.metadata.labels['kubernetes.io/role']);
    }

    return roles.length > 0 ? roles : ['worker'];
  }
}
