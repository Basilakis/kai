import { Request, Response } from 'express';
import { exec } from 'child_process';
import * as util from 'util';
import * as fs from 'fs';
import * as path from 'path';
import axios from 'axios';

// Use typed promisify
const execAsync = util.promisify(exec);

interface ScanJob {
  id: string;
  status: 'queued' | 'running' | 'completed' | 'failed';
  scanType: 'all' | 'node' | 'python';
  startedAt: Date;
  completedAt?: Date;
  progress?: number;
  error?: string;
}

// In-memory storage for scan jobs
const scanJobs: Map<string, ScanJob> = new Map();

/**
 * Controller for managing dependencies
 */
export class DependenciesController {
  /**
   * Get outdated packages with analysis
   */
  async getOutdatedPackages(req: Request, res: Response) {
    try {
      // Get the latest report from the filesystem
      const reportsDir = path.join(process.cwd(), '.github', 'dependency-reports');
      
      // Ensure the directory exists
      if (!fs.existsSync(reportsDir)) {
        return res.status(404).json({
          success: false,
          error: 'No dependency reports found. Please run a scan first.'
        });
      }
      
      // Find the latest report file
      const files = fs.readdirSync(reportsDir)
        .filter(file => file.endsWith('.json'))
        .map(file => ({
          name: file,
          path: path.join(reportsDir, file),
          mtime: fs.statSync(path.join(reportsDir, file)).mtime
        }))
        .sort((a, b) => b.mtime.getTime() - a.mtime.getTime());
      
      if (files.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'No dependency reports found. Please run a scan first.'
        });
      }
      
      // Read the latest report - ensure files array is not empty and convert Buffer to string
      if (!files[0]) {
        return res.status(404).json({
          success: false,
          error: 'No valid dependency reports found. Please run a scan first.'
        });
      }
      const fileContent = fs.readFileSync(files[0].path);
      const latestReport = JSON.parse(fileContent.toString('utf8'));
      
      return res.json(latestReport);
    } catch (error) {
      console.error('Error getting outdated packages:', error);
      return res.status(500).json({
        success: false,
        error: `Failed to get outdated packages. ${error instanceof Error ? error.message : String(error)}`
      });
    }
  }

  /**
   * Trigger a dependency scan
   */
  async triggerDependencyScan(req: Request, res: Response) {
    try {
      const { scanType = 'all' } = req.body;
      
      // Validate scan type
      if (!['all', 'node', 'python'].includes(scanType)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid scan type. Must be "all", "node", or "python".'
        });
      }
      
      // Generate job ID
      const jobId = `scan-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      
      // Create job
      const job: ScanJob = {
        id: jobId,
        status: 'queued',
        scanType,
        startedAt: new Date()
      };
      
      // Store job
      scanJobs.set(jobId, job);
      
      // Start the scan in the background
      this.runScan(jobId, scanType);
      
      return res.json({
        success: true,
        id: jobId,
        message: `Dependency scan started with ID: ${jobId}`
      });
    } catch (error) {
      console.error('Error triggering dependency scan:', error);
      return res.status(500).json({
        success: false,
        error: `Failed to trigger dependency scan. ${error instanceof Error ? error.message : String(error)}`
      });
    }
  }

  /**
   * Get status of a scan job
   */
  async getScanStatus(req: Request, res: Response) {
    try {
      const { id } = req.params;
      
      // If 'latest', get the most recent job
      if (id === 'latest') {
        const jobs = Array.from(scanJobs.values())
          .sort((a, b) => b.startedAt.getTime() - a.startedAt.getTime());
        
        if (jobs.length === 0) {
          return res.status(404).json({
            success: false,
            error: 'No scan jobs found.'
          });
        }
        
        const latestJob = jobs[0]; 
        // Check that latestJob exists (TypeScript check)
        if (!latestJob) {
          return res.status(404).json({
            success: false,
            error: 'Latest scan job not found.'
          });
        }
        return res.json({
          ...latestJob,
          completed: ['completed', 'failed'].includes(latestJob.status)
        });
      }
      
      // Get specific job - ensure id is treated as string
      const job = scanJobs.get(id as string);
      
      if (!job) {
        return res.status(404).json({
          success: false,
          error: `Scan job with ID "${id}" not found.`
        });
      }
      
      return res.json({
        ...job,
        completed: ['completed', 'failed'].includes(job.status)
      });
    } catch (error) {
      console.error('Error getting scan status:', error);
      return res.status(500).json({
        success: false,
        error: `Failed to get scan status. ${error instanceof Error ? error.message : String(error)}`
      });
    }
  }

  /**
   * Update packages
   */
  async updatePackages(req: Request, res: Response) {
    try {
      const { packages, updateType = 'safe' } = req.body;
      
      // Validate update type
      if (!['safe', 'caution', 'manual'].includes(updateType)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid update type. Must be "safe", "caution", or "manual".'
        });
      }
      
      // Validate packages
      if (!Array.isArray(packages) || packages.length === 0) {
        return res.status(400).json({
          success: false,
          error: 'Invalid packages. Must be a non-empty array of package names.'
        });
      }
      
      // Trigger a GitHub workflow to create PRs for the updates
      // This would typically call the GitHub API to trigger a workflow
      // For now, we'll simulate this by returning a success response
      
      // In a real implementation, you might do something like:
      /*
      await axios.post(
        `https://api.github.com/repos/${process.env.GITHUB_REPOSITORY}/dispatches`,
        {
          event_type: 'update-dependencies',
          client_payload: {
            packages,
            updateType
          }
        },
        {
          headers: {
            Authorization: `token ${process.env.GITHUB_TOKEN}`,
            Accept: 'application/vnd.github.v3+json'
          }
        }
      );
      */
      
      return res.json({
        success: true,
        updatedPackages: packages,
        message: `Update triggered for ${packages.length} packages with update type "${updateType}".`,
        pullRequestUrl: `https://github.com/${process.env.GITHUB_REPOSITORY || 'your-org/your-repo'}/pull/123` // Simulated PR URL
      });
    } catch (error) {
      console.error('Error updating packages:', error);
      return res.status(500).json({
        success: false,
        error: `Failed to update packages. ${error instanceof Error ? error.message : String(error)}`
      });
    }
  }

  /**
   * Get configuration impact analysis
   */
  async getConfigImpactAnalysis(req: Request, res: Response) {
    try {
      const { packages } = req.body;
      
      // Validate packages
      if (!Array.isArray(packages) || packages.length === 0) {
        return res.status(400).json({
          success: false,
          error: 'Invalid packages. Must be a non-empty array of package names.'
        });
      }
      
      // Get the latest report
      const reportsDir = path.join(process.cwd(), '.github', 'dependency-reports');
      const files = fs.readdirSync(reportsDir)
        .filter(file => file.endsWith('.json'))
        .map(file => ({
          name: file,
          path: path.join(reportsDir, file),
          mtime: fs.statSync(path.join(reportsDir, file)).mtime
        }))
        .sort((a, b) => b.mtime.getTime() - a.mtime.getTime());
      
      if (files.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'No dependency reports found. Please run a scan first.'
        });
      }
      
      // Read the latest report - ensure files array is not empty and convert Buffer to string
      if (!files[0]) {
        return res.status(404).json({
          success: false,
          error: 'No valid dependency reports found. Please run a scan first.'
        });
      }
      const fileContent = fs.readFileSync(files[0].path);
      const latestReport = JSON.parse(fileContent.toString('utf8'));
      
      // Extract config impact analysis for the requested packages
      const packagesWithAnalysis = latestReport.packages.filter(
        (pkg: any) => packages.includes(pkg.name)
      );
      
      const configFiles = new Set<string>();
      let requiresManualReview = false;
      
      packagesWithAnalysis.forEach((pkg: any) => {
        if (pkg.analysis?.configChangesNeeded && pkg.analysis?.potentialConfigFiles) {
          pkg.analysis.potentialConfigFiles.forEach((file: string) => configFiles.add(file));
          
          if (pkg.analysis.recommendation === 'manual-update') {
            requiresManualReview = true;
          }
        }
      });
      
      return res.json({
        configFiles: Array.from(configFiles),
        analysisDetails: `${packagesWithAnalysis.length} of ${packages.length} packages may require configuration changes.`,
        recommendation: requiresManualReview ? 'manual-review' : 'automated-update',
        packages: packagesWithAnalysis
      });
    } catch (error) {
      console.error('Error getting config impact analysis:', error);
      return res.status(500).json({
        success: false,
        error: `Failed to get config impact analysis. ${error instanceof Error ? error.message : String(error)}`
      });
    }
  }

  /**
   * Check Helm chart compatibility
   */
  async checkHelmCompatibility(req: Request, res: Response) {
    try {
      const { packages } = req.body;
      
      // Validate packages
      if (!Array.isArray(packages) || packages.length === 0) {
        return res.status(400).json({
          success: false,
          error: 'Invalid packages. Must be a non-empty array of package names.'
        });
      }
      
      // This would typically analyze Helm charts to determine if updates would break them
      // For now, we'll return a simulated response
      
      // Check if any packages might affect Helm charts
      const helmRelatedPackages = packages.filter(pkg => 
        ['kubernetes', 'k8s', 'helm', 'chart', 'docker', 'container'].some(
          keyword => pkg.toLowerCase().includes(keyword)
        )
      );
      
      const compatibilityIssues = helmRelatedPackages.map(pkg => 
        `Package "${pkg}" might affect Helm chart configuration.`
      );
      
      return res.json({
        compatible: compatibilityIssues.length === 0,
        issues: compatibilityIssues,
        chartUpdatesNeeded: helmRelatedPackages.length > 0 ? ['helm-charts/api-server', 'helm-charts/coordinator'] : []
      });
    } catch (error) {
      console.error('Error checking Helm compatibility:', error);
      return res.status(500).json({
        success: false,
        error: `Failed to check Helm compatibility. ${error instanceof Error ? error.message : String(error)}`
      });
    }
  }

  /**
   * Get update history
   */
  async getUpdateHistory(req: Request, res: Response) {
    try {
      const limit = parseInt(req.query.limit as string) || 10;
      const offset = parseInt(req.query.offset as string) || 0;
      
      // This would typically fetch update history from a database
      // For now, we'll return simulated data
      
      const updates = [
        {
          id: 'update-123',
          timestamp: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days ago
          packages: ['react', 'react-dom', 'typescript'],
          success: true,
          pullRequestUrl: 'https://github.com/your-org/your-repo/pull/123'
        },
        {
          id: 'update-124',
          timestamp: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString(), // 14 days ago
          packages: ['eslint', 'prettier'],
          success: true,
          pullRequestUrl: 'https://github.com/your-org/your-repo/pull/124'
        },
        {
          id: 'update-125',
          timestamp: new Date(Date.now() - 21 * 24 * 60 * 60 * 1000).toISOString(), // 21 days ago
          packages: ['axios', 'lodash'],
          success: false
        }
      ];
      
      return res.json({
        updates: updates.slice(offset, offset + limit),
        total: updates.length
      });
    } catch (error) {
      console.error('Error getting update history:', error);
      return res.status(500).json({
        success: false,
        error: `Failed to get update history. ${error instanceof Error ? error.message : String(error)}`
      });
    }
  }

  // Private method to run a scan
  private async runScan(jobId: string, scanType: 'all' | 'node' | 'python') {
    const job = scanJobs.get(jobId);
    
    if (!job) {
      console.error(`Job ${jobId} not found.`);
      return;
    }
    
    try {
      // Update job status
      job.status = 'running';
      scanJobs.set(jobId, job);
      
      // Run the GitHub Action workflow via API
      // In a real implementation, you might do something like:
      /*
      await axios.post(
        `https://api.github.com/repos/${process.env.GITHUB_REPOSITORY}/dispatches`,
        {
          event_type: 'scan-dependencies',
          client_payload: {
            scan_type: scanType,
            job_id: jobId
          }
        },
        {
          headers: {
            Authorization: `token ${process.env.GITHUB_TOKEN}`,
            Accept: 'application/vnd.github.v3+json'
          }
        }
      );
      */
      
      // For local development, run the scan directly
      // This is a simplified version that would need to be enhanced in production
      const reportsDir = path.join(process.cwd(), '.github', 'dependency-reports');
      
      // Ensure the directory exists
      if (!fs.existsSync(reportsDir)) {
        fs.mkdirSync(reportsDir, { recursive: true });
      }
      
      // Run the appropriate scan command
      let command = '';
      if (scanType === 'all' || scanType === 'node') {
        command += 'yarn outdated --json > .github/dependency-reports/node-outdated.json; ';
      }
      
      if (scanType === 'all' || scanType === 'python') {
        command += 'pip list --outdated --format=json > .github/dependency-reports/python-outdated.json; ';
      }
      
      // For local testing, create a simulated report if the commands would fail
      command += `
        if [ ! -f .github/dependency-reports/node-outdated.json ]; then
          echo '{"data":{"body":[["react","17.0.2","18.2.0","18.2.0","dependencies",""],["typescript","4.5.5","5.1.6","5.1.6","devDependencies",""]]}}' > .github/dependency-reports/node-outdated.json;
        fi;
        if [ ! -f .github/dependency-reports/python-outdated.json ]; then
          echo '[{"name":"numpy","version":"1.20.0","latest_version":"1.24.0"},{"name":"pandas","version":"1.3.0","latest_version":"2.0.0"}]' > .github/dependency-reports/python-outdated.json;
        fi;
      `;
      
      // Run combined script to parse results (simplified)
      command += `
        node .github/scripts/parse-outdated.js;
        python .github/scripts/combine-python-outdated.py;
        node .github/scripts/analyze-compatibility.js;
        
        # Combine reports into a single file with timestamp
        timestamp=$(date +%Y%m%d%H%M%S);
        cp compatibility-report.json .github/dependency-reports/report-\${timestamp}.json;
      `;
      
      // Execute the commands
      const { stdout, stderr } = await execAsync(command);
      
      console.log('Scan output:', stdout);
      if (stderr) {
        console.error('Scan errors:', stderr);
      }
      
      // Update job status
      job.status = 'completed';
      job.completedAt = new Date();
      job.progress = 100;
      scanJobs.set(jobId, job);
      
    } catch (error) {
      console.error(`Error running scan ${jobId}:`, error);
      
      // Update job status
      job.status = 'failed';
      job.completedAt = new Date();
      job.error = error instanceof Error ? error.message : String(error);
      scanJobs.set(jobId, job);
    }
  }
}

export const dependenciesController = new DependenciesController();