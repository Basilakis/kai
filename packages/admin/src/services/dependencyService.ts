import axios from 'axios';

/**
 * Service for managing dependencies
 * Provides functionality to scan for updates, retrieve pending PRs, and monitor dependency status
 */
const API_URL = process.env.NEXT_PUBLIC_API_URL || '/api';

interface ScanStatus {
  status: 'idle' | 'running' | 'completed' | 'failed';
  lastRun: Date | null;
  duration?: number;
}

interface PendingPR {
  id: string;
  title: string;
  url: string;
  status: string;
  type: string;
}

interface RecentUpdate {
  name: string;
  from: string;
  to: string;
  date: string;
  type: string;
}

interface PackageInfo {
  name: string;
  current: string;
  latest: string;
  type: 'nodejs' | 'python';
  updateType: 'major' | 'minor' | 'patch';
  compatibilityRisk: 'low' | 'medium' | 'high';
  configImpact: boolean;
  notes?: string;
}

/**
 * Get the current status of dependency scanning
 * @returns Promise with scan status information
 */
const getScanStatus = async (): Promise<ScanStatus> => {
  try {
    const response = await axios.get(`${API_URL}/dependencies/status`);
    return response.data;
  } catch (error) {
    console.error('Error fetching dependency scan status:', error);
    return {
      status: 'idle',
      lastRun: null
    };
  }
};

/**
 * Trigger a dependency scan
 * @returns Promise with the triggered job information
 */
const triggerDependencyScan = async (): Promise<any> => {
  try {
    const response = await axios.post(`${API_URL}/dependencies/scan`);
    return response.data;
  } catch (error) {
    console.error('Error triggering dependency scan:', error);
    throw error;
  }
};

/**
 * Get a list of outdated packages
 * @returns Promise with list of outdated packages
 */
const getOutdatedPackages = async (): Promise<PackageInfo[]> => {
  try {
    const response = await axios.get(`${API_URL}/dependencies/outdated`);
    return response.data;
  } catch (error) {
    console.error('Error fetching outdated packages:', error);
    return [];
  }
};

/**
 * Get a list of pending dependency update PRs
 * @returns Promise with list of pending PRs
 */
const getPendingPRs = async (): Promise<PendingPR[]> => {
  try {
    const response = await axios.get(`${API_URL}/dependencies/pending-prs`);
    return response.data;
  } catch (error) {
    console.error('Error fetching pending PRs:', error);
    return [];
  }
};

/**
 * Get a list of recently updated packages
 * @returns Promise with list of recent updates
 */
const getRecentUpdates = async (): Promise<RecentUpdate[]> => {
  try {
    const response = await axios.get(`${API_URL}/dependencies/recent-updates`);
    return response.data;
  } catch (error) {
    console.error('Error fetching recent updates:', error);
    return [];
  }
};

/**
 * Update a specific package to its latest version
 * @param packageName Name of the package to update
 * @param packageType Type of package (nodejs or python)
 * @returns Promise with the update status
 */
const updatePackage = async (packageName: string, packageType: 'nodejs' | 'python'): Promise<any> => {
  try {
    const response = await axios.post(`${API_URL}/dependencies/update`, {
      packageName,
      packageType
    });
    return response.data;
  } catch (error) {
    console.error(`Error updating package ${packageName}:`, error);
    throw error;
  }
};

/**
 * Update multiple packages based on update type
 * @param packageNames Array of package names to update
 * @param updateType Type of update (safe, caution, manual)
 * @returns Promise with the update status
 */
const updatePackages = async (packageNames: string[], updateType: 'safe' | 'caution' | 'manual'): Promise<any> => {
  try {
    const response = await axios.post(`${API_URL}/dependencies/update-batch`, {
      packages: packageNames,
      updateType
    });
    return response.data;
  } catch (error) {
    console.error(`Error updating packages:`, error);
    throw error;
  }
};

/**
 * Get logs for a specific dependency scan job
 * @param jobId ID of the job to get logs for
 * @returns Promise with the job logs
 */
const getJobLogs = async (jobId: string): Promise<string> => {
  try {
    const response = await axios.get(`${API_URL}/dependencies/logs/${jobId}`);
    return response.data;
  } catch (error) {
    console.error(`Error fetching logs for job ${jobId}:`, error);
    throw error;
  }
};

/**
 * Get compatibility analysis for a package update
 * @param packageName Name of the package
 * @param packageType Type of package (nodejs or python)
 * @returns Promise with compatibility analysis
 */
const getCompatibilityAnalysis = async (packageName: string, packageType: 'nodejs' | 'python'): Promise<any> => {
  try {
    const response = await axios.get(`${API_URL}/dependencies/compatibility`, {
      params: { packageName, packageType }
    });
    return response.data;
  } catch (error) {
    console.error(`Error fetching compatibility analysis for ${packageName}:`, error);
    throw error;
  }
};

export default {
  getScanStatus,
  triggerDependencyScan,
  getOutdatedPackages,
  getPendingPRs,
  getRecentUpdates,
  updatePackage,
  updatePackages,
  getJobLogs,
  getCompatibilityAnalysis
};