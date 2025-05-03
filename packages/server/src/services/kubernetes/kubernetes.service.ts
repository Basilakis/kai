import * as k8s from '@kubernetes/client-node';
import { logger } from '../../utils/logger';

/**
 * Service for interacting with the Kubernetes API
 * Provides access to different Kubernetes APIs
 */
export class KubernetesService {
  private k8sApi: k8s.CoreV1Api;
  private k8sBatchApi: k8s.BatchV1Api;
  private k8sAppsApi: k8s.AppsV1Api;
  private kc: k8s.KubeConfig;

  constructor() {
    this.kc = new k8s.KubeConfig();
    
    // Load from default location or from service account if running in cluster
    try {
      this.kc.loadFromDefault();
      logger.info('Loaded Kubernetes config from default location');
    } catch (error) {
      logger.error('Error loading Kubernetes config:', error);
      throw error;
    }

    this.k8sApi = this.kc.makeApiClient(k8s.CoreV1Api);
    this.k8sBatchApi = this.kc.makeApiClient(k8s.BatchV1Api);
    this.k8sAppsApi = this.kc.makeApiClient(k8s.AppsV1Api);
  }

  /**
   * Get the CoreV1Api for accessing pods, services, etc.
   * @returns The CoreV1Api client
   */
  getCoreV1Api(): k8s.CoreV1Api {
    return this.k8sApi;
  }

  /**
   * Get the BatchV1Api for accessing jobs, cronjobs, etc.
   * @returns The BatchV1Api client
   */
  getBatchV1Api(): k8s.BatchV1Api {
    return this.k8sBatchApi;
  }

  /**
   * Get the AppsV1Api for accessing deployments, statefulsets, etc.
   * @returns The AppsV1Api client
   */
  getAppsV1Api(): k8s.AppsV1Api {
    return this.k8sAppsApi;
  }

  /**
   * Get stats about the Kubernetes cluster
   * @returns Promise with cluster stats
   */
  async getClusterStats(): Promise<any> {
    try {
      const namespace = process.env.KUBERNETES_NAMESPACE || 'default';
      
      // Get pods
      const podsResponse = await this.k8sApi.listNamespacedPod(namespace);
      const pods = podsResponse.body.items;
      
      // Get services
      const servicesResponse = await this.k8sApi.listNamespacedService(namespace);
      const services = servicesResponse.body.items;
      
      // Get deployments
      const deploymentsResponse = await this.k8sAppsApi.listNamespacedDeployment(namespace);
      const deployments = deploymentsResponse.body.items;
      
      // Get jobs
      const jobsResponse = await this.k8sBatchApi.listNamespacedJob(namespace);
      const jobs = jobsResponse.body.items;
      
      // Calculate pod status counts
      const podStatus = {
        running: 0,
        pending: 0,
        failed: 0,
        succeeded: 0,
        unknown: 0
      };
      
      pods.forEach((pod: k8s.V1Pod) => {
        const status = pod.status?.phase?.toLowerCase() || 'unknown';
        if (status in podStatus) {
          (podStatus as any)[status]++;
        } else {
          podStatus.unknown++;
        }
      });
      
      // Calculate resource usage
      let totalCpuRequests = 0;
      let totalMemoryRequests = 0;
      
      pods.forEach((pod: k8s.V1Pod) => {
        const containers = pod.spec?.containers || [];
        containers.forEach((container: k8s.V1Container) => {
          const resources = container.resources || {};
          const requests = resources.requests || {};
          
          // Parse CPU requests (usually in m)
          if (requests.cpu) {
            const cpuMatch = requests.cpu.match(/(\d+)(m)?/);
            if (cpuMatch) {
              if (cpuMatch[2] === 'm') {
                totalCpuRequests += parseInt(cpuMatch[1], 10) / 1000;
              } else {
                totalCpuRequests += parseInt(cpuMatch[1], 10);
              }
            }
          }
          
          // Parse memory requests (usually in Mi or Gi)
          if (requests.memory) {
            const memMatch = requests.memory.match(/(\d+)(Ki|Mi|Gi|Ti)?/);
            if (memMatch) {
              let memValue = parseInt(memMatch[1], 10);
              const unit = memMatch[2] || '';
              
              // Convert to Mi
              switch (unit) {
                case 'Ki':
                  memValue /= 1024;
                  break;
                case 'Gi':
                  memValue *= 1024;
                  break;
                case 'Ti':
                  memValue *= 1024 * 1024;
                  break;
              }
              
              totalMemoryRequests += memValue;
            }
          }
        });
      });

      // Format the gathered information
      return {
        pods: pods.length,
        services: services.length,
        deployments: deployments.length,
        jobs: jobs.length,
        podStatus,
        resources: {
          cpuRequests: totalCpuRequests.toFixed(2),
          memoryRequestsMi: Math.round(totalMemoryRequests)
        }
      };
    } catch (error) {
      logger.error('Error getting cluster stats:', error);
      throw error;
    }
  }
}

export default new KubernetesService();