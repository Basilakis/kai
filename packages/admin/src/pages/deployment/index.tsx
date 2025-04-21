import React, { useState, useEffect } from 'react';
import Layout from '../../components/Layout';
import {
  ServerIcon,
  CubeIcon,
  ClockIcon,
  ExclamationCircleIcon,
  CheckCircleIcon,
  RefreshIcon,
  QueueListIcon,
  ArrowPathIcon,
  BoltIcon
} from '@heroicons/react/outline';
import kubernetesService, { ClusterStats, PodDetails as PodDetailsType } from '../../services/kubernetes.service';
import PodList from '../../components/deployment/PodList';
import PodDetails from '../../components/deployment/PodDetails';
import EventList from '../../components/deployment/EventList';
import CICDPipeline from '../../components/deployment/CICDPipeline';
import FluxDeployments from '../../components/deployment/FluxDeployments';
import QueueStatusPanel from '../../components/training-status/QueueStatusPanel';

/**
 * Kubernetes Deployment Dashboard
 *
 * Provides a comprehensive view of the Kubernetes infrastructure including:
 * - Cluster overview (nodes, pods, services)
 * - Deployment status and health
 * - Pod details and logs
 * - CI/CD pipeline status
 * - Event monitoring
 * - Troubleshooting suggestions
 */
export default function DeploymentDashboard() {
  const [loading, setLoading] = useState(true);
  const [clusterStats, setClusterStats] = useState<ClusterStats | null>(null);
  const [healthStatus, setHealthStatus] = useState('healthy');
  const [lastUpdated, setLastUpdated] = useState(new Date());
  const [error, setError] = useState<string | null>(null);
  const [selectedPod, setSelectedPod] = useState<PodDetailsType | null>(null);

  // Load data from the Kubernetes API
  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch cluster stats from the Kubernetes API
      const stats = await kubernetesService.getClusterStats();
      setClusterStats(stats);

      // Determine health status based on pod status
      const healthStatus = determineHealthStatus(stats);
      setHealthStatus(healthStatus);

      setLastUpdated(new Date());
    } catch (err) {
      console.error('Error loading Kubernetes data:', err);
      setError('Failed to load Kubernetes data. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Determine health status based on pod status
  const determineHealthStatus = (stats: ClusterStats): string => {
    if (!stats || !stats.pods) return 'unknown';

    // If there are failed pods, the status is unhealthy
    if (stats.pods.failed > 0) return 'unhealthy';

    // If there are pending pods, the status is degraded
    if (stats.pods.pending > 0) return 'degraded';

    // Otherwise, the status is healthy
    return 'healthy';
  };

  // Load data on component mount
  useEffect(() => {
    loadData();
  }, []);

  // Function to refresh data
  const handleRefresh = () => {
    loadData();
  };

  return (
    <Layout title="Kubernetes Deployment">
      <div className="mb-6 flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-semibold text-gray-800">Kubernetes Deployment</h1>
          <p className="text-gray-600">Monitor and manage your Kubernetes infrastructure</p>
        </div>
        <button
          onClick={handleRefresh}
          disabled={loading}
          className="flex items-center px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 disabled:bg-blue-300"
        >
          <RefreshIcon className="h-4 w-4 mr-2" />
          Refresh
        </button>
      </div>

      {/* Last updated timestamp */}
      <div className="mb-6 text-sm text-gray-500 flex items-center">
        <ClockIcon className="h-4 w-4 mr-1" />
        Last updated: {lastUpdated.toLocaleTimeString()}
        {loading && (
          <div className="ml-2 flex items-center">
            <div className="animate-spin h-4 w-4 border-2 border-blue-500 border-t-transparent rounded-full mr-1"></div>
            Loading...
          </div>
        )}
      </div>

      {/* Training Queue Status */}
      <div className="mb-8">
        <h2 className="text-xl font-medium text-gray-700 mb-4">Training Queue Status</h2>
        <QueueStatusPanel />
      </div>

      {/* Error message */}
      {error && (
        <div className="mb-6 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded relative">
          <span className="block sm:inline">{error}</span>
        </div>
      )}

      {/* Cluster Overview */}
      <div className="mb-8">
        <h2 className="text-xl font-medium text-gray-700 mb-4">Cluster Overview</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {/* Nodes Card */}
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="bg-blue-500 rounded-full p-3 mr-4">
                <ServerIcon className="h-6 w-6 text-white" />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-600">Total Nodes</p>
                <p className="text-2xl font-semibold text-gray-800">{loading ? '-' : clusterStats?.nodes || 0}</p>
              </div>
            </div>
          </div>

          {/* Pods Card */}
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="bg-green-500 rounded-full p-3 mr-4">
                <CubeIcon className="h-6 w-6 text-white" />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-600">Total Pods</p>
                <p className="text-2xl font-semibold text-gray-800">{loading ? '-' : clusterStats?.pods?.total || 0}</p>
                {clusterStats?.pods && !loading && (
                  <div className="mt-2 text-xs">
                    <span className="text-green-600 mr-2">Running: {clusterStats.pods.running}</span>
                    {clusterStats.pods.pending > 0 && (
                      <span className="text-yellow-600 mr-2">Pending: {clusterStats.pods.pending}</span>
                    )}
                    {clusterStats.pods.failed > 0 && (
                      <span className="text-red-600">Failed: {clusterStats.pods.failed}</span>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Deployments Card */}
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="bg-purple-500 rounded-full p-3 mr-4">
                <svg className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                </svg>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-600">Deployments</p>
                <p className="text-2xl font-semibold text-gray-800">{loading ? '-' : clusterStats?.deployments || 0}</p>
              </div>
            </div>
          </div>

          {/* Services Card */}
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="bg-yellow-500 rounded-full p-3 mr-4">
                <svg className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-600">Services</p>
                <p className="text-2xl font-semibold text-gray-800">{loading ? '-' : clusterStats?.services || 0}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Cluster Health Status */}
      <div className="mb-8">
        <h2 className="text-xl font-medium text-gray-700 mb-4">Cluster Health</h2>
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            {healthStatus === 'healthy' ? (
              <div className="bg-green-100 text-green-800 rounded-full p-2 mr-3">
                <CheckCircleIcon className="h-6 w-6" />
              </div>
            ) : healthStatus === 'degraded' ? (
              <div className="bg-yellow-100 text-yellow-800 rounded-full p-2 mr-3">
                <ExclamationCircleIcon className="h-6 w-6" />
              </div>
            ) : (
              <div className="bg-red-100 text-red-800 rounded-full p-2 mr-3">
                <ExclamationCircleIcon className="h-6 w-6" />
              </div>
            )}
            <div>
              <p className="text-lg font-medium">
                {healthStatus === 'healthy' ? 'All systems operational' :
                 healthStatus === 'degraded' ? 'System partially degraded' :
                 'Issues detected'}
              </p>
              <p className="text-sm text-gray-500">
                {healthStatus === 'healthy'
                  ? 'Your Kubernetes cluster is running normally.'
                  : healthStatus === 'degraded'
                  ? 'Some components are in a degraded state but the system is still operational.'
                  : 'There are critical issues that need immediate attention.'}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Pod List and Details */}
      <div className="mb-8">
        {selectedPod ? (
          <PodDetails
            pod={selectedPod}
            onClose={() => setSelectedPod(null)}
          />
        ) : (
          <PodList
            onSelectPod={(pod) => setSelectedPod(pod)}
          />
        )}
      </div>

      {/* CI/CD Pipelines */}
      <div className="mb-8">
        <h2 className="text-xl font-medium text-gray-700 mb-4">CI/CD Pipelines</h2>
        <CICDPipeline />
      </div>

      {/* Flux Deployments */}
      <div className="mb-8">
        <h2 className="text-xl font-medium text-gray-700 mb-4">Flux Deployments</h2>
        <FluxDeployments />
      </div>

      {/* Kubernetes Events */}
      <div className="mb-8">
        <h2 className="text-xl font-medium text-gray-700 mb-4">Cluster Events</h2>
        <EventList />
      </div>
    </Layout>
  );
}
