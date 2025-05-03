import { KubernetesService } from './kubernetes.service';
import { logger } from '../../utils/logger';
import * as k8s from '@kubernetes/client-node';

/**
 * Service for monitoring and managing Kubernetes jobs
 * Provides functionality to check job status, get logs, and create jobs
 */
export class JobMonitorService {
  private k8sApi: k8s.BatchV1Api;
  private k8sCoreApi: k8s.CoreV1Api;
  private namespace: string;

  constructor(_kubernetesService: KubernetesService) {
    this.k8sApi = _kubernetesService.getBatchV1Api();
    this.k8sCoreApi = _kubernetesService.getCoreV1Api();
    this.namespace = process.env.KUBERNETES_NAMESPACE || 'default';
  }

  /**
   * Get information about a specific job
   * @param jobName The name of the job to get information for
   * @returns Promise with job information
   */
  async getJobInfo(jobName: string): Promise<any> {
    try {
      const response = await this.k8sApi.readNamespacedJob(jobName, this.namespace);
      return response.body;
    } catch (error) {
      logger.error(`Error getting job ${jobName} info:`, error);
      throw error;
    }
  }

  /**
   * List all jobs matching a label selector
   * @param labelSelector Label selector to filter jobs (e.g. 'app=dependency-management')
   * @returns Promise with list of jobs
   */
  async listJobs(labelSelector?: string): Promise<any> {
    try {
      const response = await this.k8sApi.listNamespacedJob(
        this.namespace,
        undefined, // pretty
        undefined, // allowWatchBookmarks
        undefined, // _continue
        undefined, // fieldSelector
        labelSelector // labelSelector
      );
      return response.body;
    } catch (error) {
      logger.error('Error listing jobs:', error);
      throw error;
    }
  }

  /**
   * Get logs for a job
   * @param jobName The name of the job to get logs for
   * @returns Promise with job logs
   */
  async getJobLogs(jobName: string): Promise<string> {
    try {
      // First get the pod belonging to this job
      const pods = await this.k8sCoreApi.listNamespacedPod(
        this.namespace,
        undefined, // pretty
        undefined, // allowWatchBookmarks
        undefined, // _continue
        undefined, // fieldSelector
        `job-name=${jobName}` // labelSelector
      );

      if (!pods.body.items || pods.body.items.length === 0) {
        return 'No pods found for this job';
      }

      // Get the first pod
      const firstPod = pods.body.items[0];
      if (!firstPod) {
        return 'Pod data is invalid';
      }

      // Get logs from the pod
      const podName = firstPod.metadata?.name;
      if (!podName) {
        return 'Pod name not found';
      }

      const logs = await this.k8sCoreApi.readNamespacedPodLog(
        podName,
        this.namespace,
        undefined, // container
        undefined, // follow
        undefined, // insecureSkipTLSVerifyBackend
        undefined, // limitBytes
        undefined, // pretty
        undefined, // previous
        undefined, // sinceSeconds
        undefined // tailLines
      );

      return logs.body;
    } catch (error) {
      logger.error(`Error getting logs for job ${jobName}:`, error);
      throw error;
    }
  }

  /**
   * Create a job from a job specification
   * @param jobManifest The job specification
   * @returns Promise with the created job
   */
  async createJob(jobManifest: any): Promise<any> {
    try {
      // Ensure the manifest has proper structure
      if (!jobManifest.metadata) {
        jobManifest.metadata = {};
      }

      if (!jobManifest.metadata.name) {
        jobManifest.metadata.name = `dependency-update-job-${Date.now()}`;
      }

      // Set namespace
      jobManifest.metadata.namespace = this.namespace;

      // Create the job
      const response = await this.k8sApi.createNamespacedJob(
        this.namespace,
        jobManifest
      );

      return response.body;
    } catch (error) {
      logger.error('Error creating job:', error);
      throw error;
    }
  }

  /**
   * Delete a job
   * @param jobName The name of the job to delete
   * @returns Promise with the deletion status
   */
  async deleteJob(jobName: string): Promise<any> {
    try {
      const response = await this.k8sApi.deleteNamespacedJob(
        jobName,
        this.namespace
      );
      return response.body;
    } catch (error) {
      logger.error(`Error deleting job ${jobName}:`, error);
      throw error;
    }
  }

  /**
   * Trigger a dependency scan job
   * @returns Promise with the created job
   */
  async triggerDependencyScan(): Promise<any> {
    try {
      // Load the job template
      const jobManifest = this.getJobTemplate();

      // Set a unique name
      jobManifest.metadata.name = `dependency-update-job-${Date.now()}`;

      // Create the job
      return await this.createJob(jobManifest);
    } catch (error) {
      logger.error('Error triggering dependency scan:', error);
      throw error;
    }
  }

  /**
   * Get dependency scan job template
   * @returns Job template object
   */
  private getJobTemplate(): any {
    return {
      apiVersion: 'batch/v1',
      kind: 'Job',
      metadata: {
        name: 'dependency-update-job',
        labels: {
          app: 'dependency-management',
          component: 'update-job'
        }
      },
      spec: {
        ttlSecondsAfterFinished: 86400,
        backoffLimit: 3,
        template: {
          metadata: {
            labels: {
              app: 'dependency-management',
              component: 'update-job'
            }
          },
          spec: {
            restartPolicy: 'OnFailure',
            containers: [
              {
                name: 'dependency-scanner',
                image: process.env.DEPENDENCY_SCANNER_IMAGE || 'dependency-scanner:latest',
                imagePullPolicy: 'Always',
                resources: {
                  requests: {
                    cpu: '500m',
                    memory: '512Mi'
                  },
                  limits: {
                    cpu: '1000m',
                    memory: '1Gi'
                  }
                },
                env: [
                  {
                    name: 'NODE_ENV',
                    value: 'production'
                  },
                  {
                    name: 'LOG_LEVEL',
                    value: 'info'
                  },
                  {
                    name: 'OPENAI_API_KEY',
                    valueFrom: {
                      secretKeyRef: {
                        name: 'ai-service-keys',
                        key: 'openai-api-key'
                      }
                    }
                  },
                  {
                    name: 'GITHUB_TOKEN',
                    valueFrom: {
                      secretKeyRef: {
                        name: 'github-credentials',
                        key: 'token'
                      }
                    }
                  }
                ],
                volumeMounts: [
                  {
                    name: 'repo-volume',
                    mountPath: '/app/repo'
                  },
                  {
                    name: 'npm-cache',
                    mountPath: '/root/.npm'
                  },
                  {
                    name: 'pip-cache',
                    mountPath: '/root/.cache/pip'
                  }
                ],
                command: [
                  '/bin/sh',
                  '-c',
                  `cd /app/repo && \
                  git clone --depth 1 https://github.com/${process.env.GITHUB_ORG}/${process.env.REPO_NAME}.git . && \
                  node /app/scripts/dependency-impact-analysis.js && \
                  node /app/scripts/analyze-compatibility.js && \
                  node /app/scripts/run-targeted-tests.js && \
                  node /app/scripts/create-update-prs-with-test-results.js`
                ]
              }
            ],
            volumes: [
              {
                name: 'repo-volume',
                emptyDir: {}
              },
              {
                name: 'npm-cache',
                emptyDir: {}
              },
              {
                name: 'pip-cache',
                emptyDir: {}
              }
            ]
          }
        }
      }
    };
  }
}

export default new JobMonitorService(new KubernetesService());