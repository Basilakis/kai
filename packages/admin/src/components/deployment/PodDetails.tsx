import React, { useState, useEffect } from 'react';
import {
  CubeIcon,
  ServerIcon,
  ClockIcon,
  DocumentTextIcon,
  RefreshIcon,
  XIcon
} from '@heroicons/react/outline';
import kubernetesService, { PodDetails, PodLog } from '../../services/kubernetes.service';
import EventList from './EventList';

interface PodDetailsProps {
  pod: PodDetails;
  onClose: () => void;
}

/**
 * PodDetails Component
 *
 * Displays detailed information about a Kubernetes pod, including
 * containers, conditions, and logs.
 */
const PodDetailsComponent: React.FC<PodDetailsProps> = ({ pod, onClose }) => {
  const [logs, setLogs] = useState<PodLog | null>(null);
  const [selectedContainer, setSelectedContainer] = useState<string | undefined>(
    pod.containers.length > 0 ? pod.containers[0].name : undefined
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'logs' | 'events'>('overview');

  // Load pod logs
  const loadLogs = async () => {
    if (!selectedContainer) return;

    try {
      setLoading(true);
      setError(null);

      // Fetch logs from the Kubernetes API
      const podLogs = await kubernetesService.getPodLogs(
        pod.name,
        selectedContainer,
        pod.namespace,
        1000 // Get the last 1000 lines
      );

      setLogs(podLogs);
    } catch (err) {
      console.error('Error loading pod logs:', err);
      setError('Failed to load pod logs. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Load logs when the selected container changes
  useEffect(() => {
    if (activeTab === 'logs' && selectedContainer) {
      loadLogs();
    }
  }, [selectedContainer, activeTab]);

  // Handle container selection
  const handleContainerChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedContainer(e.target.value);
  };

  // Format date for display
  const formatDate = (dateString: string): string => {
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
      {/* Header */}
      <div className="px-4 py-5 sm:px-6 flex justify-between items-center border-b border-gray-200">
        <div className="flex items-center">
          <CubeIcon className="h-6 w-6 text-gray-400 mr-2" />
          <h3 className="text-lg font-medium text-gray-900">{pod.name}</h3>
          <span className="ml-2 px-2 py-1 text-xs rounded-md bg-gray-100 text-gray-800">
            {pod.namespace}
          </span>
        </div>
        <button
          onClick={onClose}
          className="text-gray-400 hover:text-gray-500"
        >
          <XIcon className="h-5 w-5" />
        </button>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="flex -mb-px">
          <button
            className={`py-4 px-6 text-sm font-medium ${
              activeTab === 'overview'
                ? 'border-b-2 border-blue-500 text-blue-600'
                : 'text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
            onClick={() => setActiveTab('overview')}
          >
            Overview
          </button>
          <button
            className={`py-4 px-6 text-sm font-medium ${
              activeTab === 'logs'
                ? 'border-b-2 border-blue-500 text-blue-600'
                : 'text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
            onClick={() => setActiveTab('logs')}
          >
            Logs
          </button>
          <button
            className={`py-4 px-6 text-sm font-medium ${
              activeTab === 'events'
                ? 'border-b-2 border-blue-500 text-blue-600'
                : 'text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
            onClick={() => setActiveTab('events')}
          >
            Events
          </button>
        </nav>
      </div>

      {/* Tab content */}
      <div className="p-6">
        {/* Overview tab */}
        {activeTab === 'overview' && (
          <div>
            {/* Basic info */}
            <div className="mb-6">
              <h4 className="text-sm font-medium text-gray-500 uppercase tracking-wider mb-3">
                Basic Information
              </h4>
              <div className="bg-gray-50 rounded-md p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-gray-500">Status</p>
                  <p className="text-sm font-medium">{pod.status}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Phase</p>
                  <p className="text-sm font-medium">{pod.phase}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Node</p>
                  <p className="text-sm font-medium">{pod.nodeName || '-'}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">IP</p>
                  <p className="text-sm font-medium">{pod.ip || '-'}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Start Time</p>
                  <p className="text-sm font-medium">{formatDate(pod.startTime)}</p>
                </div>
              </div>
            </div>

            {/* Containers */}
            <div className="mb-6">
              <h4 className="text-sm font-medium text-gray-500 uppercase tracking-wider mb-3">
                Containers
              </h4>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Name
                      </th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Image
                      </th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Ready
                      </th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Restarts
                      </th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        State
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {pod.containers.map((container) => (
                      <tr key={container.name}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          {container.name}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {container.image}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            container.ready ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                          }`}>
                            {container.ready ? 'Yes' : 'No'}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {container.restartCount}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {container.state}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Conditions */}
            <div>
              <h4 className="text-sm font-medium text-gray-500 uppercase tracking-wider mb-3">
                Conditions
              </h4>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Type
                      </th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Status
                      </th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Last Transition
                      </th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Reason
                      </th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Message
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {pod.conditions.map((condition, index) => (
                      <tr key={`${condition.type}-${index}`}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          {condition.type}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            condition.status === 'True' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                          }`}>
                            {condition.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {formatDate(condition.lastTransitionTime)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {condition.reason || '-'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {condition.message || '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Logs tab */}
        {activeTab === 'logs' && (
          <div>
            <div className="flex justify-between items-center mb-4">
              <div className="flex items-center">
                <label htmlFor="container" className="mr-2 text-sm text-gray-600">
                  Container:
                </label>
                <select
                  id="container"
                  className="border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                  value={selectedContainer}
                  onChange={handleContainerChange}
                  disabled={loading || pod.containers.length === 0}
                >
                  {pod.containers.map(container => (
                    <option key={container.name} value={container.name}>{container.name}</option>
                  ))}
                </select>
              </div>
              <button
                onClick={loadLogs}
                disabled={loading || !selectedContainer}
                className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
              >
                <RefreshIcon className="h-4 w-4 mr-1" />
                Refresh
              </button>
            </div>

            {/* Error message */}
            {error && (
              <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded relative">
                <span className="block sm:inline">{error}</span>
              </div>
            )}

            {/* Loading indicator */}
            {loading && (
              <div className="flex justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
              </div>
            )}

            {/* Logs display */}
            {!loading && logs && (
              <div className="bg-gray-900 text-gray-100 rounded-md p-4 overflow-auto h-96 font-mono text-sm">
                {logs.logs ? (
                  logs.logs.split('\n').map((line, index) => (
                    <div key={index} className="whitespace-pre-wrap">
                      {line}
                    </div>
                  ))
                ) : (
                  <div className="text-gray-400 italic">No logs available</div>
                )}
              </div>
            )}

            {!loading && !logs && !error && (
              <div className="text-center py-8 text-gray-500">
                Select a container and click Refresh to view logs.
              </div>
            )}
          </div>
        )}

        {/* Events tab */}
        {activeTab === 'events' && (
          <div>
            <EventList
              namespace={pod.namespace}
              resourceName={pod.name}
              resourceKind="Pod"
            />
          </div>
        )}
      </div>
    </div>
  );
};

export default PodDetailsComponent;
