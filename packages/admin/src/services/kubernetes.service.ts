/**
 * Kubernetes Service
 *
 * Client-side service for interacting with the Kubernetes API endpoints.
 */

import axios from 'axios';

// Define types for Kubernetes resources
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

/**
 * Kubernetes service for interacting with the Kubernetes API
 */
class KubernetesService {
  private baseUrl: string;

  constructor() {
    this.baseUrl = '/api/admin/kubernetes';
  }

  /**
   * Get cluster statistics
   * @returns Promise with cluster statistics
   */
  async getClusterStats(): Promise<ClusterStats> {
    try {
      const response = await axios.get(`${this.baseUrl}/stats`);
      return response.data;
    } catch (error) {
      console.error('Error getting cluster stats:', error);
      throw error;
    }
  }

  /**
   * Get pod details
   * @param namespace Namespace to filter by (optional)
   * @returns Promise with pod details
   */
  async getPods(namespace?: string): Promise<PodDetails[]> {
    try {
      const url = namespace
        ? `${this.baseUrl}/pods?namespace=${namespace}`
        : `${this.baseUrl}/pods`;

      const response = await axios.get(url);
      return response.data;
    } catch (error) {
      console.error('Error getting pods:', error);
      throw error;
    }
  }

  /**
   * Get node details
   * @returns Promise with node details
   */
  async getNodes(): Promise<NodeDetails[]> {
    try {
      const response = await axios.get(`${this.baseUrl}/nodes`);
      return response.data;
    } catch (error) {
      console.error('Error getting nodes:', error);
      throw error;
    }
  }

  /**
   * Get deployment details
   * @param namespace Namespace to filter by (optional)
   * @returns Promise with deployment details
   */
  async getDeployments(namespace?: string): Promise<DeploymentDetails[]> {
    try {
      const url = namespace
        ? `${this.baseUrl}/deployments?namespace=${namespace}`
        : `${this.baseUrl}/deployments`;

      const response = await axios.get(url);
      return response.data;
    } catch (error) {
      console.error('Error getting deployments:', error);
      throw error;
    }
  }

  /**
   * Get Kubernetes events
   * @param namespace Namespace to filter by (optional)
   * @returns Promise with Kubernetes events
   */
  async getEvents(namespace?: string): Promise<KubernetesEvent[]> {
    try {
      const url = namespace
        ? `${this.baseUrl}/events?namespace=${namespace}`
        : `${this.baseUrl}/events`;

      const response = await axios.get(url);
      return response.data;
    } catch (error) {
      console.error('Error getting events:', error);
      throw error;
    }
  }

  /**
   * Get pod logs
   * @param podName Pod name
   * @param containerName Container name (optional)
   * @param namespace Namespace (optional)
   * @param tailLines Number of lines to return from the end of the logs (optional)
   * @returns Promise with pod logs
   */
  async getPodLogs(
    podName: string,
    containerName?: string,
    namespace?: string,
    tailLines?: number
  ): Promise<PodLog> {
    try {
      let url = `${this.baseUrl}/logs/${podName}`;

      // Add query parameters
      const params = new URLSearchParams();

      if (containerName) {
        params.append('container', containerName);
      }

      if (namespace) {
        params.append('namespace', namespace);
      }

      if (tailLines) {
        params.append('tailLines', tailLines.toString());
      }

      // Append params to URL if any exist
      if (params.toString()) {
        url += `?${params.toString()}`;
      }

      const response = await axios.get(url);
      return response.data;
    } catch (error) {
      console.error('Error getting pod logs:', error);
      throw error;
    }
  }

  /**
   * Kill a pod
   * @param podName Pod name
   * @param namespace Namespace
   * @returns Promise with kill result
   */
  async killPod(podName: string, namespace: string): Promise<{ success: boolean; message: string }> {
    try {
      const response = await axios.post(`${this.baseUrl}/pods/${podName}/kill`, { namespace });
      return response.data;
    } catch (error) {
      console.error('Error killing pod:', error);
      throw error;
    }
  }

  /**
   * Restart a pod
   * @param podName Pod name
   * @param namespace Namespace
   * @returns Promise with restart result
   */
  async restartPod(podName: string, namespace: string): Promise<{ success: boolean; message: string }> {
    try {
      const response = await axios.post(`${this.baseUrl}/pods/${podName}/restart`, { namespace });
      return response.data;
    } catch (error) {
      console.error('Error restarting pod:', error);
      throw error;
    }
  }
}

export default new KubernetesService();
