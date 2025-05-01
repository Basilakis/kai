import axios from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api';
const ADMIN_API = `${API_URL}/admin/dependencies`;

/**
 * Service for managing dependencies in the admin panel
 */
export const dependencyService = {
  /**
   * Get outdated packages with analysis
   */
  async getOutdatedPackages() {
    try {
      const response = await axios.get(`${ADMIN_API}/outdated`);
      return response.data;
    } catch (error) {
      console.error('Error fetching outdated packages:', error);
      throw error;
    }
  },

  /**
   * Trigger a dependency scan
   * @param scanType - The type of scan to run ('all', 'node', or 'python')
   */
  async triggerDependencyScan(scanType = 'all') {
    try {
      const response = await axios.post(`${ADMIN_API}/scan`, { scanType });
      return response.data;
    } catch (error) {
      console.error('Error triggering dependency scan:', error);
      throw error;
    }
  },

  /**
   * Get status of a scan job
   * @param id - The ID of the scan job or 'latest' for the most recent job
   */
  async getScanStatus(id = 'latest') {
    try {
      const response = await axios.get(`${ADMIN_API}/scan/${id}/status`);
      return response.data;
    } catch (error) {
      console.error('Error getting scan status:', error);
      throw error;
    }
  },

  /**
   * Update packages
   * @param packages - Array of package names to update
   * @param updateType - Type of update ('safe', 'caution', or 'manual')
   */
  async updatePackages(packages: string[], updateType: 'safe' | 'caution' | 'manual') {
    try {
      const response = await axios.post(`${ADMIN_API}/update`, {
        packages,
        updateType
      });
      return response.data;
    } catch (error) {
      console.error('Error updating packages:', error);
      throw error;
    }
  },

  /**
   * Get configuration impact analysis for packages
   * @param packages - Array of package names to analyze
   */
  async getConfigImpactAnalysis(packages: string[]) {
    try {
      const response = await axios.post(`${ADMIN_API}/config-analysis`, {
        packages
      });
      return response.data;
    } catch (error) {
      console.error('Error getting config impact analysis:', error);
      throw error;
    }
  },

  /**
   * Check Helm chart compatibility
   * @param packages - Array of package names to check compatibility for
   */
  async checkHelmCompatibility(packages: string[]) {
    try {
      const response = await axios.post(`${ADMIN_API}/helm-compatibility`, {
        packages
      });
      return response.data;
    } catch (error) {
      console.error('Error checking Helm compatibility:', error);
      throw error;
    }
  },

  /**
   * Get update history
   * @param limit - Maximum number of records to return
   * @param offset - Number of records to skip
   */
  async getUpdateHistory(limit = 10, offset = 0) {
    try {
      const response = await axios.get(`${ADMIN_API}/history`, {
        params: { limit, offset }
      });
      return response.data;
    } catch (error) {
      console.error('Error getting update history:', error);
      throw error;
    }
  }
};

export default dependencyService;