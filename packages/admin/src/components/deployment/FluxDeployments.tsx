import React, { useState } from 'react';
import {
  CheckCircleIcon,
  XCircleIcon,
  RefreshIcon,
  ExclamationCircleIcon,
  ClockIcon,
  ChevronDownIcon,
  ChevronRightIcon
} from '@heroicons/react/outline';

// Mock data for Flux deployments
// In a real implementation, this would come from your Flux API
const mockFluxDeployments = [
  {
    id: 'flux-1',
    name: 'api-service',
    namespace: 'kai-system',
    status: 'Reconciled',
    type: 'HelmRelease',
    lastUpdated: new Date(Date.now() - 1800000).toISOString(), // 30 minutes ago
    source: 'github.com/organization/kai-charts',
    revision: 'main/a1b2c3d',
    conditions: [
      { type: 'Ready', status: 'True', message: 'Reconciliation succeeded', timestamp: new Date(Date.now() - 1800000).toISOString() }
    ]
  },
  {
    id: 'flux-2',
    name: 'ml-processor',
    namespace: 'kai-ml',
    status: 'Reconciling',
    type: 'Kustomization',
    lastUpdated: new Date(Date.now() - 300000).toISOString(), // 5 minutes ago
    source: 'github.com/organization/kai-charts',
    revision: 'main/e4f5g6h',
    conditions: [
      { type: 'Ready', status: 'False', message: 'Reconciliation in progress', timestamp: new Date(Date.now() - 300000).toISOString() }
    ]
  },
  {
    id: 'flux-3',
    name: 'database',
    namespace: 'kai-db',
    status: 'Failed',
    type: 'HelmRelease',
    lastUpdated: new Date(Date.now() - 3600000).toISOString(), // 1 hour ago
    source: 'github.com/organization/kai-charts',
    revision: 'main/i7j8k9l',
    conditions: [
      { type: 'Ready', status: 'False', message: 'Chart reconciliation failed: unable to get chart "postgresql": chart not found in Helm repository', timestamp: new Date(Date.now() - 3600000).toISOString() }
    ],
    error: 'Chart reconciliation failed: unable to get chart "postgresql": chart not found in Helm repository'
  }
];

interface FluxDeploymentsProps {
  // In a real implementation, you might want to pass filters or other props
}

/**
 * FluxDeployments Component
 *
 * Displays Flux GitOps deployments and their status.
 */
const FluxDeployments: React.FC<FluxDeploymentsProps> = () => {
  const [deployments, setDeployments] = useState(mockFluxDeployments);
  const [selectedDeployment, setSelectedDeployment] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [expandedDeployments, setExpandedDeployments] = useState<Set<string>>(new Set());

  // Toggle deployment expansion
  const toggleDeploymentExpansion = (deploymentId: string) => {
    setExpandedDeployments(prev => {
      const newSet = new Set(prev);
      if (newSet.has(deploymentId)) {
        newSet.delete(deploymentId);
      } else {
        newSet.add(deploymentId);
      }
      return newSet;
    });
  };

  // Get the selected deployment details
  const selectedDeploymentDetails = selectedDeployment
    ? deployments.find(d => d.id === selectedDeployment)
    : null;

  // Handle refresh
  const handleRefresh = () => {
    setLoading(true);
    // In a real implementation, this would fetch the latest deployment data
    setTimeout(() => {
      setLoading(false);
    }, 1000);
  };

  // Get status color
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Reconciled':
        return 'bg-green-100 text-green-800';
      case 'Reconciling':
        return 'bg-blue-100 text-blue-800';
      case 'Failed':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  // Get status icon
  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'Reconciled':
        return <CheckCircleIcon className="h-5 w-5 text-green-500" />;
      case 'Reconciling':
        return <ClockIcon className="h-5 w-5 text-blue-500" />;
      case 'Failed':
        return <XCircleIcon className="h-5 w-5 text-red-500" />;
      default:
        return <ExclamationCircleIcon className="h-5 w-5 text-gray-500" />;
    }
  };

  // Format date
  const formatDate = (dateString: string): string => {
    if (!dateString) return '-';

    try {
      const date = new Date(dateString);
      return date.toLocaleString();
    } catch (err) {
      return dateString;
    }
  };

  // Get troubleshooting suggestions based on error message
  const getTroubleshootingSuggestions = (error: string): string[] => {
    if (error.includes('chart not found')) {
      return [
        'Verify that the chart exists in the specified Helm repository',
        'Check if the chart version is correct',
        'Ensure the Helm repository is properly configured and accessible',
        'Try updating the Helm repository index with "helm repo update"'
      ];
    } else if (error.includes('connection refused')) {
      return [
        'Check if the target service is running',
        'Verify network connectivity to the service',
        'Ensure firewall rules allow the connection',
        'Check if the service port is correctly specified'
      ];
    } else if (error.includes('timeout')) {
      return [
        'The operation might be taking longer than expected',
        'Check resource constraints on the cluster',
        'Verify that the target service is responsive',
        'Consider increasing the timeout value in the Flux configuration'
      ];
    } else {
      return [
        'Check the Flux logs for more detailed error information',
        'Verify that all required resources are correctly defined',
        'Ensure that the cluster has sufficient resources',
        'Check for any recent changes that might have caused the issue'
      ];
    }
  };

  return (
    <div className="bg-white shadow rounded-lg overflow-hidden">
      <div className="px-4 py-5 sm:px-6 flex justify-between items-center">
        <div>
          <h3 className="text-lg font-medium text-gray-900">Flux Deployments</h3>
          <p className="mt-1 max-w-2xl text-sm text-gray-500">
            GitOps deployments managed by Flux
          </p>
        </div>

        <button
          onClick={handleRefresh}
          disabled={loading}
          className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
        >
          <RefreshIcon className="h-4 w-4 mr-1" />
          Refresh
        </button>
      </div>

      {/* Loading indicator */}
      {loading && (
        <div className="px-4 py-3 bg-gray-50 text-gray-500 flex items-center">
          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-500 mr-2"></div>
          <span>Loading deployments...</span>
        </div>
      )}

      {/* Deployment list */}
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Name
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Namespace
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Type
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Status
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Source
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Revision
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Last Updated
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {deployments.map((deployment) => (
              <React.Fragment key={deployment.id}>
                <tr
                  className={`hover:bg-gray-50 ${expandedDeployments.has(deployment.id) ? 'bg-blue-50' : ''} ${deployment.status === 'Failed' ? 'bg-red-50' : ''}`}
                >
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    <div className="flex items-center">
                      <button
                        onClick={() => toggleDeploymentExpansion(deployment.id)}
                        className="mr-2 focus:outline-none"
                      >
                        {expandedDeployments.has(deployment.id) ? (
                          <ChevronDownIcon className="h-5 w-5 text-gray-500" />
                        ) : (
                          <ChevronRightIcon className="h-5 w-5 text-gray-500" />
                        )}
                      </button>
                      <span className="cursor-pointer" onClick={() => setSelectedDeployment(selectedDeployment === deployment.id ? null : deployment.id)}>
                        {deployment.name}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {deployment.namespace}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                      {deployment.type}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(deployment.status)}`}>
                      {getStatusIcon(deployment.status)}
                      <span className="ml-1">{deployment.status}</span>
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {deployment.source}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 font-mono">
                    {deployment.revision}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {formatDate(deployment.lastUpdated)}
                  </td>
                </tr>

                {/* Expanded deployment details */}
                {expandedDeployments.has(deployment.id) && (
                  <tr className="bg-gray-50">
                    <td colSpan={7} className="px-6 py-4">
                      <div className="text-sm">
                        {/* Deployment details in accordion style */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                          <div>
                            <h4 className="font-medium text-gray-700 mb-2">Deployment Information</h4>
                            <div className="bg-white p-3 rounded border border-gray-200">
                              <div className="grid grid-cols-2 gap-2">
                                <div className="text-gray-500">Name:</div>
                                <div>{deployment.name}</div>
                                <div className="text-gray-500">Namespace:</div>
                                <div>{deployment.namespace}</div>
                                <div className="text-gray-500">Type:</div>
                                <div>{deployment.type}</div>
                                <div className="text-gray-500">Status:</div>
                                <div>{deployment.status}</div>
                                <div className="text-gray-500">Source:</div>
                                <div>{deployment.source}</div>
                                <div className="text-gray-500">Revision:</div>
                                <div className="font-mono">{deployment.revision}</div>
                                <div className="text-gray-500">Last Updated:</div>
                                <div>{formatDate(deployment.lastUpdated)}</div>
                              </div>
                            </div>
                          </div>

                          <div>
                            <h4 className="font-medium text-gray-700 mb-2">Conditions</h4>
                            <div className="bg-white p-3 rounded border border-gray-200">
                              {deployment.conditions.map((condition, idx) => (
                                <div key={idx} className="mb-3 last:mb-0">
                                  <div className="flex justify-between items-center">
                                    <div className="font-medium">{condition.type}</div>
                                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                                      condition.status === 'True' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                                    }`}>
                                      {condition.status}
                                    </span>
                                  </div>
                                  <div className="text-xs text-gray-500 mt-1">Last Transition: {formatDate(condition.timestamp)}</div>
                                  <div className="text-xs mt-1">{condition.message}</div>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>

                        {/* Error and troubleshooting for failed deployments */}
                        {deployment.status === 'Failed' && deployment.error && (
                          <div>
                            <h4 className="font-medium text-gray-700 mb-2">Error Details</h4>
                            <div className="bg-red-50 border border-red-100 rounded-md p-3 mb-4">
                              <p className="text-sm text-red-700">{deployment.error}</p>
                            </div>

                            <h4 className="font-medium text-gray-700 mb-2">Troubleshooting Suggestions</h4>
                            <div className="bg-yellow-50 border border-yellow-100 rounded-md p-3">
                              <ul className="list-disc pl-5 text-sm text-yellow-700 space-y-1">
                                {getTroubleshootingSuggestions(deployment.error).map((suggestion, index) => (
                                  <li key={index}>{suggestion}</li>
                                ))}
                              </ul>
                            </div>
                          </div>
                        )}

                        <div className="mt-4 flex justify-end">
                          <button
                            onClick={() => setSelectedDeployment(deployment.id)}
                            className="inline-flex items-center px-3 py-2 border border-blue-300 text-sm font-medium rounded text-blue-700 bg-blue-50 hover:bg-blue-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                          >
                            View Full Details
                          </button>
                        </div>
                      </div>
                    </td>
                  </tr>
                )}
              </React.Fragment>
            ))
          </tbody>
        </table>
      </div>

      {/* Deployment details */}
      {selectedDeploymentDetails && (
        <div className="border-t border-gray-200 px-6 py-4">
          <h4 className="text-sm font-medium text-gray-500 uppercase tracking-wider mb-3">
            Deployment Details
          </h4>

          {/* Conditions */}
          <div className="mb-6">
            <h5 className="text-sm font-medium text-gray-700 mb-2">Conditions</h5>
            <div className="space-y-4">
              {selectedDeploymentDetails.conditions.map((condition, index) => (
                <div key={`${selectedDeploymentDetails.id}-condition-${index}`} className="border border-gray-200 rounded-md overflow-hidden">
                  {/* Condition header - always visible */}
                  <div className="bg-gray-50 px-4 py-3 flex justify-between items-center cursor-pointer">
                    <div className="flex items-center">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        condition.status === 'True' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                      } mr-2`}>
                        {condition.status}
                      </span>
                      <span className="font-medium text-sm">{condition.type}</span>
                    </div>
                    <div className="text-sm text-gray-500">
                      {formatDate(condition.timestamp)}
                    </div>
                  </div>

                  {/* Condition message - accordion content */}
                  <div className="px-4 py-3 border-t border-gray-200 bg-white">
                    <div className="text-sm text-gray-700">
                      <span className="font-medium">Message:</span> {condition.message}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Error and troubleshooting for failed deployments */}
          {selectedDeploymentDetails.status === 'Failed' && selectedDeploymentDetails.error && (
            <div className="mt-6">
              <div className="bg-red-50 border border-red-100 rounded-md p-4 mb-4">
                <h5 className="text-sm font-medium text-red-800 mb-2">Error</h5>
                <p className="text-sm text-red-700">{selectedDeploymentDetails.error}</p>
              </div>

              <div className="bg-yellow-50 border border-yellow-100 rounded-md p-4">
                <h5 className="text-sm font-medium text-yellow-800 mb-2">Troubleshooting Suggestions</h5>
                <ul className="list-disc pl-5 text-sm text-yellow-700 space-y-1">
                  {getTroubleshootingSuggestions(selectedDeploymentDetails.error).map((suggestion, index) => (
                    <li key={index}>{suggestion}</li>
                  ))}
                </ul>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default FluxDeployments;
