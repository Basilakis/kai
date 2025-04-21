import React, { useState } from 'react';
import {
  CheckCircleIcon,
  XCircleIcon,
  ClockIcon,
  PlayIcon,
  RefreshIcon,
  ChevronDownIcon,
  ChevronRightIcon
} from '@heroicons/react/outline';

// Mock data for CI/CD pipelines
// In a real implementation, this would come from your CI/CD system API
const mockPipelines = [
  {
    id: 'pipeline-1',
    name: 'main-deployment',
    status: 'success',
    branch: 'main',
    commit: 'a1b2c3d',
    commitMessage: 'Update deployment configuration',
    author: 'John Doe',
    startTime: new Date(Date.now() - 3600000).toISOString(), // 1 hour ago
    endTime: new Date(Date.now() - 3540000).toISOString(),   // 59 minutes ago
    duration: '1m 20s',
    stages: [
      { name: 'Build', status: 'success', duration: '45s' },
      { name: 'Test', status: 'success', duration: '25s' },
      { name: 'Deploy', status: 'success', duration: '10s' }
    ]
  },
  {
    id: 'pipeline-2',
    name: 'feature-deployment',
    status: 'running',
    branch: 'feature/new-api',
    commit: 'e4f5g6h',
    commitMessage: 'Add new API endpoints',
    author: 'Jane Smith',
    startTime: new Date(Date.now() - 600000).toISOString(), // 10 minutes ago
    endTime: null,
    duration: '10m',
    stages: [
      { name: 'Build', status: 'success', duration: '50s' },
      { name: 'Test', status: 'running', duration: '9m 10s' },
      { name: 'Deploy', status: 'pending', duration: '-' }
    ]
  },
  {
    id: 'pipeline-3',
    name: 'hotfix-deployment',
    status: 'failed',
    branch: 'hotfix/bug-123',
    commit: 'i7j8k9l',
    commitMessage: 'Fix critical bug in authentication',
    author: 'Alex Johnson',
    startTime: new Date(Date.now() - 7200000).toISOString(), // 2 hours ago
    endTime: new Date(Date.now() - 7140000).toISOString(),   // 1 hour 59 minutes ago
    duration: '1m 0s',
    stages: [
      { name: 'Build', status: 'success', duration: '40s' },
      { name: 'Test', status: 'failed', duration: '20s', error: 'Test failed: Authentication test case failed' },
      { name: 'Deploy', status: 'skipped', duration: '-' }
    ]
  }
];

interface CICDPipelineProps {
  // In a real implementation, you might want to pass filters or other props
}

/**
 * CICDPipeline Component
 *
 * Displays CI/CD pipeline status and details.
 */
const CICDPipeline: React.FC<CICDPipelineProps> = () => {
  const [pipelines, setPipelines] = useState(mockPipelines);
  const [selectedPipeline, setSelectedPipeline] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [expandedPipelines, setExpandedPipelines] = useState<Set<string>>(new Set());

  // Toggle pipeline expansion
  const togglePipelineExpansion = (pipelineId: string) => {
    setExpandedPipelines(prev => {
      const newSet = new Set(prev);
      if (newSet.has(pipelineId)) {
        newSet.delete(pipelineId);
      } else {
        newSet.add(pipelineId);
      }
      return newSet;
    });
  };

  // Get the selected pipeline details
  const selectedPipelineDetails = selectedPipeline
    ? pipelines.find(p => p.id === selectedPipeline)
    : null;

  // Handle refresh
  const handleRefresh = () => {
    setLoading(true);
    // In a real implementation, this would fetch the latest pipeline data
    setTimeout(() => {
      setLoading(false);
    }, 1000);
  };

  // Get status color
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'success':
        return 'bg-green-100 text-green-800';
      case 'running':
        return 'bg-blue-100 text-blue-800';
      case 'failed':
        return 'bg-red-100 text-red-800';
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      case 'skipped':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  // Get status icon
  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'success':
        return <CheckCircleIcon className="h-5 w-5 text-green-500" />;
      case 'running':
        return <PlayIcon className="h-5 w-5 text-blue-500" />;
      case 'failed':
        return <XCircleIcon className="h-5 w-5 text-red-500" />;
      case 'pending':
        return <ClockIcon className="h-5 w-5 text-yellow-500" />;
      case 'skipped':
        return <ClockIcon className="h-5 w-5 text-gray-500" />;
      default:
        return <ClockIcon className="h-5 w-5 text-gray-500" />;
    }
  };

  // Format date
  const formatDate = (dateString: string | null): string => {
    if (!dateString) return '-';

    try {
      const date = new Date(dateString);
      return date.toLocaleString();
    } catch (err) {
      return dateString;
    }
  };

  return (
    <div className="bg-white shadow rounded-lg overflow-hidden">
      <div className="px-4 py-5 sm:px-6 flex justify-between items-center">
        <div>
          <h3 className="text-lg font-medium text-gray-900">CI/CD Pipelines</h3>
          <p className="mt-1 max-w-2xl text-sm text-gray-500">
            Recent deployment pipelines and their status
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
          <span>Loading pipelines...</span>
        </div>
      )}

      {/* Pipeline list */}
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Pipeline
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Status
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Branch
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Commit
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Started
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Duration
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {pipelines.map((pipeline) => (
              <React.Fragment key={pipeline.id}>
                <tr
                  className={`hover:bg-gray-50 ${expandedPipelines.has(pipeline.id) ? 'bg-blue-50' : ''} ${pipeline.status === 'failed' ? 'bg-red-50' : ''}`}
                >
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    <div className="flex items-center">
                      <button
                        onClick={() => togglePipelineExpansion(pipeline.id)}
                        className="mr-2 focus:outline-none"
                      >
                        {expandedPipelines.has(pipeline.id) ? (
                          <ChevronDownIcon className="h-5 w-5 text-gray-500" />
                        ) : (
                          <ChevronRightIcon className="h-5 w-5 text-gray-500" />
                        )}
                      </button>
                      <span className="cursor-pointer" onClick={() => setSelectedPipeline(selectedPipeline === pipeline.id ? null : pipeline.id)}>
                        {pipeline.name}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(pipeline.status)}`}>
                      {getStatusIcon(pipeline.status)}
                      <span className="ml-1 capitalize">{pipeline.status}</span>
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {pipeline.branch}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    <div className="flex items-center">
                      <span className="font-mono">{pipeline.commit.substring(0, 7)}</span>
                      <span className="ml-2 text-xs text-gray-400 truncate max-w-xs">{pipeline.commitMessage}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {formatDate(pipeline.startTime)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {pipeline.duration}
                  </td>
                </tr>

                {/* Expanded pipeline details */}
                {expandedPipelines.has(pipeline.id) && (
                  <tr className="bg-gray-50">
                    <td colSpan={6} className="px-6 py-4">
                      <div className="text-sm">
                        {/* Pipeline details in accordion style */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                          <div>
                            <h4 className="font-medium text-gray-700 mb-2">Pipeline Information</h4>
                            <div className="bg-white p-3 rounded border border-gray-200">
                              <div className="grid grid-cols-2 gap-2">
                                <div className="text-gray-500">Name:</div>
                                <div>{pipeline.name}</div>
                                <div className="text-gray-500">Status:</div>
                                <div className="capitalize">{pipeline.status}</div>
                                <div className="text-gray-500">Branch:</div>
                                <div>{pipeline.branch}</div>
                                <div className="text-gray-500">Commit:</div>
                                <div className="font-mono">{pipeline.commit}</div>
                                <div className="text-gray-500">Message:</div>
                                <div>{pipeline.commitMessage}</div>
                                <div className="text-gray-500">Author:</div>
                                <div>{pipeline.author}</div>
                              </div>
                            </div>
                          </div>

                          <div>
                            <h4 className="font-medium text-gray-700 mb-2">Timing</h4>
                            <div className="bg-white p-3 rounded border border-gray-200">
                              <div className="grid grid-cols-2 gap-2">
                                <div className="text-gray-500">Started:</div>
                                <div>{formatDate(pipeline.startTime)}</div>
                                <div className="text-gray-500">Ended:</div>
                                <div>{formatDate(pipeline.endTime)}</div>
                                <div className="text-gray-500">Duration:</div>
                                <div>{pipeline.duration}</div>
                              </div>
                            </div>
                          </div>
                        </div>

                        <div>
                          <h4 className="font-medium text-gray-700 mb-2">Stages</h4>
                          <div className="bg-white p-3 rounded border border-gray-200">
                            <div className="space-y-4">
                              {pipeline.stages.map((stage, index) => (
                                <div key={`${pipeline.id}-stage-${index}`} className="relative">
                                  {/* Stage connector line */}
                                  {index < pipeline.stages.length - 1 && (
                                    <div className="absolute left-2.5 top-6 bottom-0 w-0.5 bg-gray-200"></div>
                                  )}

                                  <div className="flex items-start">
                                    <div className={`flex-shrink-0 h-5 w-5 rounded-full ${
                                      stage.status === 'success' ? 'bg-green-100' :
                                      stage.status === 'running' ? 'bg-blue-100' :
                                      stage.status === 'failed' ? 'bg-red-100' :
                                      'bg-gray-100'
                                    } flex items-center justify-center`}>
                                      {getStatusIcon(stage.status)}
                                    </div>
                                    <div className="ml-4 flex-1">
                                      <div className="flex justify-between items-center">
                                        <h5 className="text-sm font-medium">{stage.name}</h5>
                                        <span className="text-xs text-gray-500">{stage.duration}</span>
                                      </div>
                                      {'error' in stage && stage.error && (
                                        <div className="mt-1 text-sm text-red-600">
                                          {stage.error}
                                        </div>
                                      )}
                                      {stage.status === 'failed' && !('error' in stage) && (
                                        <div className="mt-1 text-sm text-red-600">
                                          Stage failed. Check logs for details.
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>

                        {/* Troubleshooting suggestions for failed pipelines */}
                        {pipeline.status === 'failed' && (
                          <div className="mt-4">
                            <h4 className="font-medium text-gray-700 mb-2">Troubleshooting Suggestions</h4>
                            <div className="bg-red-50 border border-red-100 rounded-md p-3">
                              <ul className="list-disc pl-5 text-sm text-red-700 space-y-1">
                                <li>Check the test logs for specific error messages</li>
                                <li>Verify that all dependencies are correctly installed</li>
                                <li>Ensure environment variables are properly configured</li>
                                <li>Review recent code changes that might have caused the failure</li>
                              </ul>
                            </div>
                          </div>
                        )}

                        <div className="mt-4 flex justify-end">
                          <button
                            onClick={() => setSelectedPipeline(pipeline.id)}
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

      {/* Pipeline details */}
      {selectedPipelineDetails && (
        <div className="border-t border-gray-200 px-6 py-4">
          <h4 className="text-sm font-medium text-gray-500 uppercase tracking-wider mb-3">
            Pipeline Details
          </h4>

          <div className="mb-4">
            <div className="text-sm text-gray-500 mb-1">Commit Message</div>
            <div className="text-sm font-medium">{selectedPipelineDetails.commitMessage}</div>
          </div>

          <div className="mb-4">
            <div className="text-sm text-gray-500 mb-1">Author</div>
            <div className="text-sm font-medium">{selectedPipelineDetails.author}</div>
          </div>

          <div className="mb-6">
            <div className="text-sm text-gray-500 mb-1">Timing</div>
            <div className="text-sm">
              <span className="font-medium">Started:</span> {formatDate(selectedPipelineDetails.startTime)}
              {selectedPipelineDetails.endTime && (
                <>
                  <span className="mx-2">|</span>
                  <span className="font-medium">Ended:</span> {formatDate(selectedPipelineDetails.endTime)}
                </>
              )}
              <span className="mx-2">|</span>
              <span className="font-medium">Duration:</span> {selectedPipelineDetails.duration}
            </div>
          </div>

          <div>
            <div className="text-sm text-gray-500 mb-3">Stages</div>
            <div className="space-y-4">
              {selectedPipelineDetails.stages.map((stage, index) => (
                <div key={`${selectedPipelineDetails.id}-stage-${index}`} className="relative">
                  {/* Stage connector line */}
                  {index < selectedPipelineDetails.stages.length - 1 && (
                    <div className="absolute left-2.5 top-6 bottom-0 w-0.5 bg-gray-200"></div>
                  )}

                  <div className="flex items-start">
                    <div className={`flex-shrink-0 h-5 w-5 rounded-full ${
                      stage.status === 'success' ? 'bg-green-100' :
                      stage.status === 'running' ? 'bg-blue-100' :
                      stage.status === 'failed' ? 'bg-red-100' :
                      'bg-gray-100'
                    } flex items-center justify-center`}>
                      {getStatusIcon(stage.status)}
                    </div>
                    <div className="ml-4 flex-1">
                      <div className="flex justify-between items-center">
                        <h5 className="text-sm font-medium">{stage.name}</h5>
                        <span className="text-xs text-gray-500">{stage.duration}</span>
                      </div>
                      {stage.error && (
                        <div className="mt-1 text-sm text-red-600">
                          {stage.error}
                        </div>
                      )}
                      {stage.status === 'failed' && !stage.error && (
                        <div className="mt-1 text-sm text-red-600">
                          Stage failed. Check logs for details.
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Troubleshooting suggestions for failed pipelines */}
          {selectedPipelineDetails.status === 'failed' && (
            <div className="mt-6 bg-red-50 border border-red-100 rounded-md p-4">
              <h5 className="text-sm font-medium text-red-800 mb-2">Troubleshooting Suggestions</h5>
              <ul className="list-disc pl-5 text-sm text-red-700 space-y-1">
                <li>Check the test logs for specific error messages</li>
                <li>Verify that all dependencies are correctly installed</li>
                <li>Ensure environment variables are properly configured</li>
                <li>Review recent code changes that might have caused the failure</li>
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default CICDPipeline;
