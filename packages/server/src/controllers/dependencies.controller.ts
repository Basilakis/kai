import { Request, Response } from 'express';
// Commented out unused imports
// import { promisify } from 'util';
// import { exec } from 'child_process';
// import * as fs from 'fs';
// import * as path from 'path';
import jobMonitor from '../services/kubernetes/job-monitor.service';
import { logger } from '../utils/logger';

// Commented out unused variable
// const execPromise = promisify(exec);

/**
 * Controller for managing dependencies
 * Provides API endpoints for scanning, analyzing, and updating dependencies
 */
export class DependenciesController {
  /**
   * Get the status of the latest dependency scan
   * @param req Request object
   * @param res Response object
   */
  async getDependencyScanStatus(_req: Request, res: Response): Promise<void> {
    try {
      // List dependency-management jobs with label selector
      const jobs = await jobMonitor.listJobs('app=dependency-management');

      if (!jobs.items || jobs.items.length === 0) {
        res.json({
          status: 'idle',
          lastRun: null
        });
        return;
      }

      // Sort jobs by creation timestamp (newest first)
      const sortedJobs = jobs.items.sort((a: any, b: any) => {
        const dateA = new Date(a.metadata?.creationTimestamp || 0);
        const dateB = new Date(b.metadata?.creationTimestamp || 0);
        return dateB.getTime() - dateA.getTime();
      });

      const latestJob = sortedJobs[0];
      const jobName = latestJob.metadata?.name;
      const creationTimestamp = latestJob.metadata?.creationTimestamp;
      const completionTimestamp = latestJob.status?.completionTime;

      let status = 'idle';
      if (latestJob.status?.active > 0) {
        status = 'running';
      } else if (latestJob.status?.succeeded > 0) {
        status = 'completed';
      } else if (latestJob.status?.failed > 0) {
        status = 'failed';
      }

      // Calculate duration if job completed
      let duration = null;
      if (creationTimestamp && completionTimestamp) {
        const startTime = new Date(creationTimestamp).getTime();
        const endTime = new Date(completionTimestamp).getTime();
        duration = Math.floor((endTime - startTime) / 1000); // Duration in seconds
      }

      res.json({
        status,
        lastRun: creationTimestamp ? new Date(creationTimestamp) : null,
        duration,
        jobName
      });
    } catch (error) {
      logger.error('Error getting dependency scan status:', error);
      res.status(500).json({ error: 'Failed to get dependency scan status' });
    }
  }

  /**
   * Trigger a dependency scan
   * @param req Request object
   * @param res Response object
   */
  async triggerDependencyScan(_req: Request, res: Response): Promise<void> {
    try {
      const job = await jobMonitor.triggerDependencyScan();

      res.json({
        status: 'started',
        jobName: job.metadata?.name,
        message: 'Dependency scan started successfully'
      });
    } catch (error) {
      logger.error('Error triggering dependency scan:', error);
      res.status(500).json({ error: 'Failed to trigger dependency scan' });
    }
  }

  /**
   * Get logs for a dependency scan job
   * @param req Request object
   * @param res Response object
   */
  async getJobLogs(req: Request, res: Response): Promise<void> {
    try {
      const { jobName } = req.params;

      if (!jobName) {
        res.status(400).json({ error: 'Job name is required' });
        return;
      }

      const logs = await jobMonitor.getJobLogs(jobName);

      res.json({
        jobName,
        logs
      });
    } catch (error) {
      logger.error('Error getting job logs:', error);
      res.status(500).json({ error: 'Failed to get job logs' });
    }
  }

  /**
   * Get a list of outdated packages
   * @param req Request object
   * @param res Response object
   */
  async getOutdatedPackages(_req: Request, res: Response): Promise<void> {
    try {
      // Get the latest job output
      const jobs = await jobMonitor.listJobs('app=dependency-management');

      if (!jobs.items || jobs.items.length === 0) {
        res.json([]);
        return;
      }

      // Sort jobs by creation timestamp (newest first)
      const sortedJobs = jobs.items.sort((a: any, b: any) => {
        const dateA = new Date(a.metadata?.creationTimestamp || 0);
        const dateB = new Date(b.metadata?.creationTimestamp || 0);
        return dateB.getTime() - dateA.getTime();
      });

      const latestJob = sortedJobs[0];
      const jobName = latestJob.metadata?.name;

      // Check if job has successful completion
      if (!latestJob.status?.succeeded) {
        res.status(404).json({ error: 'No successful dependency scan found' });
        return;
      }

      // Get logs to extract outdated package information
      const logs = await jobMonitor.getJobLogs(jobName);

      // Parse the logs to extract outdated package information
      // This assumes the job outputs JSON with outdated package info
      const outdatedPackagesMatch = logs.match(/OUTDATED_PACKAGES_START([\s\S]*?)OUTDATED_PACKAGES_END/);

      if (!outdatedPackagesMatch || outdatedPackagesMatch.length < 2) {
        res.json([]);
        return;
      }

      try {
        // Add null check to prevent TypeScript error
        const jsonContent = outdatedPackagesMatch[1] || '[]';
        const outdatedPackages = JSON.parse(jsonContent);
        res.json(outdatedPackages);
      } catch (parseError) {
        logger.error('Error parsing outdated packages:', parseError);
        res.status(500).json({ error: 'Failed to parse outdated packages' });
      }
    } catch (error) {
      logger.error('Error getting outdated packages:', error);
      res.status(500).json({ error: 'Failed to get outdated packages' });
    }
  }

  /**
   * Get a list of pending PRs
   * @param req Request object
   * @param res Response object
   */
  async getPendingPRs(_req: Request, res: Response): Promise<void> {
    try {
      // In a real implementation, this would query the GitHub API
      // For now, return mock data
      res.json([
        {
          id: 'pr-1',
          title: 'Update lodash from 4.17.20 to 4.17.21',
          url: 'https://github.com/example/repo/pull/123',
          status: 'open',
          type: 'safe'
        },
        {
          id: 'pr-2',
          title: 'Update express from 4.17.1 to 4.18.0',
          url: 'https://github.com/example/repo/pull/124',
          status: 'open',
          type: 'caution'
        }
      ]);
    } catch (error) {
      logger.error('Error getting pending PRs:', error);
      res.status(500).json({ error: 'Failed to get pending PRs' });
    }
  }

  /**
   * Get a list of recent updates
   * @param req Request object
   * @param res Response object
   */
  async getRecentUpdates(_req: Request, res: Response): Promise<void> {
    try {
      // In a real implementation, this would query the GitHub API or a database
      // For now, return mock data
      res.json([
        {
          name: 'axios',
          from: '0.21.1',
          to: '0.21.4',
          date: '2023-04-15',
          type: 'safe'
        },
        {
          name: 'react',
          from: '17.0.2',
          to: '18.0.0',
          date: '2023-04-10',
          type: 'major'
        }
      ]);
    } catch (error) {
      logger.error('Error getting recent updates:', error);
      res.status(500).json({ error: 'Failed to get recent updates' });
    }
  }

  /**
   * Update a specific package
   * @param req Request object
   * @param res Response object
   */
  async updatePackage(req: Request, res: Response): Promise<void> {
    try {
      const { packageName, packageType } = req.body;

      if (!packageName || !packageType) {
        res.status(400).json({ error: 'Package name and type are required' });
        return;
      }

      // In a real implementation, this would trigger a job to update the package
      // For now, return a mock response
      res.json({
        status: 'success',
        message: `Update for ${packageName} (${packageType}) queued successfully`,
        prUrl: 'https://github.com/example/repo/pull/125'
      });
    } catch (error) {
      logger.error('Error updating package:', error);
      res.status(500).json({ error: 'Failed to update package' });
    }
  }

  /**
   * Get compatibility analysis for a package update
   * @param req Request object
   * @param res Response object
   */
  async getCompatibilityAnalysis(req: Request, res: Response): Promise<void> {
    try {
      const { packageName, packageType } = req.query;

      if (!packageName || !packageType) {
        res.status(400).json({ error: 'Package name and type are required' });
        return;
      }

      // In a real implementation, this would retrieve analysis from the job output
      // For now, return mock data
      res.json({
        packageName,
        packageType,
        fromVersion: '1.0.0',
        toVersion: '2.0.0',
        compatibilityScore: 0.8,
        breakingChanges: [
          'Method X has been removed',
          'Parameter Y is now required in function Z'
        ],
        configChanges: [
          {
            file: 'tsconfig.json',
            change: 'Need to enable strictNullChecks'
          }
        ],
        recommendation: 'Update with caution and test thoroughly'
      });
    } catch (error) {
      logger.error('Error getting compatibility analysis:', error);
      res.status(500).json({ error: 'Failed to get compatibility analysis' });
    }
  }
}

export const dependenciesController = new DependenciesController();