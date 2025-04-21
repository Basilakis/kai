import React, { useState, useEffect } from 'react';
import {
  CubeIcon,
  ExclamationCircleIcon,
  CheckCircleIcon,
  ClockIcon,
  InformationCircleIcon,
  XCircleIcon,
  RefreshIcon,
  ChevronDownIcon,
  ChevronRightIcon
} from '@heroicons/react/outline';
import kubernetesService, { PodDetails } from '../../services/kubernetes.service';

interface PodListProps {
  namespace?: string;
  onSelectPod?: (pod: PodDetails) => void;
}

interface PodAction {
  id: string;
  pod: PodDetails;
  action: 'kill' | 'restart';
  status: 'pending' | 'processing' | 'completed' | 'failed';
  message?: string;
}

/**
 * PodList Component
 *
 * Displays a list of Kubernetes pods with their status and basic information.
 */
const PodList: React.FC<PodListProps> = ({ namespace, onSelectPod }) => {
  const [pods, setPods] = useState<PodDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedNamespace, setSelectedNamespace] = useState<string | undefined>(namespace);
  const [namespaces, setNamespaces] = useState<string[]>([]);
  const [podActions, setPodActions] = useState<PodAction[]>([]);
  const [showConfirmation, setShowConfirmation] = useState<{podId: string, action: 'kill' | 'restart'} | null>(null);
  const [expandedPods, setExpandedPods] = useState<Set<string>>(new Set());

  // Load pods from the Kubernetes API
  const loadPods = async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch pods from the Kubernetes API
      const podList = await kubernetesService.getPods(selectedNamespace);
      setPods(podList);

      // Extract unique namespaces for the filter dropdown
      const uniqueNamespaces = Array.from(new Set(podList.map(pod => pod.namespace)));
      setNamespaces(uniqueNamespaces);
    } catch (err) {
      console.error('Error loading pods:', err);
      setError('Failed to load pods. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Load pods on component mount and when selectedNamespace changes
  useEffect(() => {
    loadPods();
  }, [selectedNamespace]);

  // Toggle pod expansion
  const togglePodExpansion = (podId: string) => {
    setExpandedPods(prev => {
      const newSet = new Set(prev);
      if (newSet.has(podId)) {
        newSet.delete(podId);
      } else {
        newSet.add(podId);
      }
      return newSet;
    });
  };

  // Handle pod action (kill or restart)
  const handlePodAction = async (pod: PodDetails, action: 'kill' | 'restart') => {
    const actionId = `${pod.namespace}-${pod.name}-${Date.now()}`;

    // Add action to state
    setPodActions(prev => [
      ...prev,
      {
        id: actionId,
        pod,
        action,
        status: 'processing',
        message: `${action === 'kill' ? 'Terminating' : 'Restarting'} pod...`
      }
    ]);

    try {
      // Call the API to kill or restart the pod
      if (action === 'kill') {
        await kubernetesService.killPod(pod.name, pod.namespace);
      } else {
        await kubernetesService.restartPod(pod.name, pod.namespace);
      }

      // Update action status to completed
      setPodActions(prev => prev.map(a =>
        a.id === actionId
          ? { ...a, status: 'completed', message: `Pod ${action === 'kill' ? 'terminated' : 'restarted'} successfully` }
          : a
      ));

      // Refresh the pod list after a short delay to allow the API to update
      setTimeout(() => {
        loadPods();
      }, 2000);
    } catch (err) {
      console.error(`Error ${action === 'kill' ? 'terminating' : 'restarting'} pod:`, err);

      // Update action status to failed
      setPodActions(prev => prev.map(a =>
        a.id === actionId
          ? { ...a, status: 'failed', message: `Failed to ${action} pod: ${err instanceof Error ? err.message : String(err)}` }
          : a
      ));
    }

    // Clear confirmation
    setShowConfirmation(null);
  };

  // Handle namespace change
  const handleNamespaceChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value;
    setSelectedNamespace(value === 'all' ? undefined : value);
  };

  // Get status color based on pod status
  const getStatusColor = (status: string): string => {
    switch (status.toLowerCase()) {
      case 'running':
        return 'bg-green-100 text-green-800';
      case 'pending':
      case 'containercreating':
        return 'bg-yellow-100 text-yellow-800';
      case 'succeeded':
        return 'bg-blue-100 text-blue-800';
      case 'failed':
      case 'error':
      case 'crashloopbackoff':
      case 'imagepullbackoff':
        return 'bg-red-100 text-red-800';
      case 'terminating':
        return 'bg-purple-100 text-purple-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  // Get status icon based on pod status
  const getStatusIcon = (status: string) => {
    switch (status.toLowerCase()) {
      case 'running':
        return <CheckCircleIcon className="h-4 w-4" />;
      case 'pending':
      case 'containercreating':
        return <ClockIcon className="h-4 w-4" />;
      case 'succeeded':
        return <CheckCircleIcon className="h-4 w-4" />;
      case 'failed':
      case 'error':
      case 'crashloopbackoff':
      case 'imagepullbackoff':
        return <ExclamationCircleIcon className="h-4 w-4" />;
      default:
        return <InformationCircleIcon className="h-4 w-4" />;
    }
  };

  return (
    <div className="bg-white shadow rounded-lg overflow-hidden">
      <div className="px-4 py-5 sm:px-6 flex justify-between items-center">
        <div>
          <h3 className="text-lg font-medium text-gray-900">Pods</h3>
          <p className="mt-1 max-w-2xl text-sm text-gray-500">
            {loading ? 'Loading pods...' : `${pods.length} pods found`}
          </p>
        </div>

        {/* Namespace filter */}
        <div className="flex items-center">
          <label htmlFor="namespace" className="mr-2 text-sm text-gray-600">
            Namespace:
          </label>
          <select
            id="namespace"
            className="border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
            value={selectedNamespace || 'all'}
            onChange={handleNamespaceChange}
            disabled={loading}
          >
            <option value="all">All Namespaces</option>
            {namespaces.map(ns => (
              <option key={ns} value={ns}>{ns}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Error message */}
      {error && (
        <div className="px-4 py-3 bg-red-50 text-red-700 border-t border-b border-red-200">
          <p>{error}</p>
        </div>
      )}

      {/* Loading indicator */}
      {loading && (
        <div className="px-4 py-12 flex justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
        </div>
      )}

      {/* Pod list */}
      {!loading && pods.length === 0 && (
        <div className="px-4 py-12 text-center text-gray-500">
          No pods found in the selected namespace.
        </div>
      )}

      {/* Confirmation dialog */}
      {showConfirmation && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl p-6 max-w-md w-full">
            <h3 className="text-lg font-medium text-gray-900 mb-4">
              {showConfirmation.action === 'kill' ? 'Kill Pod' : 'Restart Pod'}
            </h3>
            <p className="text-sm text-gray-500 mb-4">
              Are you sure you want to {showConfirmation.action === 'kill' ? 'kill' : 'restart'} this pod?
              {showConfirmation.action === 'kill' && (
                <span className="block mt-2 text-red-600 font-medium">
                  Warning: This action will forcefully terminate the pod and may cause service disruption.
                </span>
              )}
            </p>
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => setShowConfirmation(null)}
                className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  const [namespace, name] = showConfirmation.podId.split('-');
                  const pod = pods.find(p => p.namespace === namespace && p.name === name);
                  if (pod) {
                    handlePodAction(pod, showConfirmation.action);
                  }
                }}
                className={`px-4 py-2 border rounded-md text-sm font-medium text-white focus:outline-none focus:ring-2 focus:ring-offset-2 ${
                  showConfirmation.action === 'kill'
                    ? 'border-red-600 bg-red-600 hover:bg-red-700 focus:ring-red-500'
                    : 'border-blue-600 bg-blue-600 hover:bg-blue-700 focus:ring-blue-500'
                }`}
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}

      {!loading && pods.length > 0 && (
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
                  Status
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Node
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  IP
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Age
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Health
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {pods.map((pod) => {
                // Calculate pod age
                const startTime = pod.startTime ? new Date(pod.startTime) : null;
                const now = new Date();
                const ageMs = startTime ? now.getTime() - startTime.getTime() : 0;
                const ageMinutes = Math.floor(ageMs / (1000 * 60));
                const ageHours = Math.floor(ageMinutes / 60);
                const ageDays = Math.floor(ageHours / 24);

                let ageString = 'Unknown';
                if (startTime) {
                  if (ageDays > 0) {
                    ageString = `${ageDays}d`;
                  } else if (ageHours > 0) {
                    ageString = `${ageHours}h`;
                  } else {
                    ageString = `${ageMinutes}m`;
                  }
                }

                // Determine if pod is stuck
                const isStuck = pod.status.toLowerCase() === 'pending' && ageMinutes > 10 ||
                               pod.status.toLowerCase() === 'containercreating' && ageMinutes > 5 ||
                               pod.status.toLowerCase() === 'imagepullbackoff' ||
                               pod.status.toLowerCase() === 'crashloopbackoff';

                // Get pod health status
                const readyCondition = pod.conditions.find(c => c.type === 'Ready');
                const isReady = readyCondition?.status === 'True';

                // Check if pod is from a scaling event
                const isFromScaling = pod.labels['pod-template-hash'] !== undefined &&
                                     ageMinutes < 30; // Assuming pods less than 30 minutes old with template hash are from scaling

                // Get action status if any
                const actionStatus = podActions.find(a => a.pod.name === pod.name && a.pod.namespace === pod.namespace);

                return (
                  <React.Fragment key={`${pod.namespace}-${pod.name}`}>
                    {/* Pod row */}
                    <tr className={`${isStuck ? 'bg-red-50' : ''} ${expandedPods.has(`${pod.namespace}-${pod.name}`) ? 'bg-blue-50' : 'hover:bg-gray-50'}`}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        <div className="flex items-center">
                          <button
                            onClick={() => togglePodExpansion(`${pod.namespace}-${pod.name}`)}
                            className="mr-2 focus:outline-none"
                          >
                            {expandedPods.has(`${pod.namespace}-${pod.name}`) ? (
                              <ChevronDownIcon className="h-5 w-5 text-gray-500" />
                            ) : (
                              <ChevronRightIcon className="h-5 w-5 text-gray-500" />
                            )}
                          </button>
                          <CubeIcon className="h-5 w-5 text-gray-400 mr-2" />
                          <span className="cursor-pointer" onClick={() => onSelectPod && onSelectPod(pod)}>{pod.name}</span>
                          {isFromScaling && (
                            <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
                              Scaling
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 cursor-pointer"
                          onClick={() => onSelectPod && onSelectPod(pod)}>
                        {pod.namespace}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap cursor-pointer"
                          onClick={() => onSelectPod && onSelectPod(pod)}>
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(pod.status)}`}>
                          {getStatusIcon(pod.status)}
                          <span className="ml-1">{pod.status}</span>
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 cursor-pointer"
                          onClick={() => onSelectPod && onSelectPod(pod)}>
                        {pod.nodeName || '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 cursor-pointer"
                          onClick={() => onSelectPod && onSelectPod(pod)}>
                        {ageString}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap cursor-pointer"
                          onClick={() => onSelectPod && onSelectPod(pod)}>
                        <div className="flex items-center">
                          {isReady ? (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                              <CheckCircleIcon className="h-4 w-4 mr-1" />
                              Healthy
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                              <ExclamationCircleIcon className="h-4 w-4 mr-1" />
                              Not Ready
                            </span>
                          )}
                          {isStuck && (
                            <span className="ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                              <ExclamationCircleIcon className="h-4 w-4 mr-1" />
                              Stuck
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        <div className="flex space-x-2">
                          {isStuck && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setShowConfirmation({podId: `${pod.namespace}-${pod.name}`, action: 'kill'});
                              }}
                              className="inline-flex items-center px-2 py-1 border border-red-300 text-xs font-medium rounded text-red-700 bg-red-50 hover:bg-red-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                            >
                              <XCircleIcon className="h-3 w-3 mr-1" />
                              Kill
                            </button>
                          )}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setShowConfirmation({podId: `${pod.namespace}-${pod.name}`, action: 'restart'});
                            }}
                            className="inline-flex items-center px-2 py-1 border border-gray-300 text-xs font-medium rounded text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                          >
                            <RefreshIcon className="h-3 w-3 mr-1" />
                            Restart
                          </button>
                          {actionStatus && (
                            <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                              actionStatus.status === 'completed' ? 'bg-green-100 text-green-800' :
                              actionStatus.status === 'failed' ? 'bg-red-100 text-red-800' :
                              'bg-yellow-100 text-yellow-800'
                            }`}>
                              {actionStatus.status}
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>

                    {/* Expanded pod details */}
                    {expandedPods.has(`${pod.namespace}-${pod.name}`) && (
                      <tr className="bg-gray-50">
                        <td colSpan={8} className="px-6 py-4">
                          <div className="text-sm">
                            {/* Pod details in accordion style */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                              <div>
                                <h4 className="font-medium text-gray-700 mb-2">Pod Information</h4>
                                <div className="bg-white p-3 rounded border border-gray-200">
                                  <div className="grid grid-cols-2 gap-2">
                                    <div className="text-gray-500">Name:</div>
                                    <div>{pod.name}</div>
                                    <div className="text-gray-500">Namespace:</div>
                                    <div>{pod.namespace}</div>
                                    <div className="text-gray-500">Status:</div>
                                    <div>{pod.status}</div>
                                    <div className="text-gray-500">Node:</div>
                                    <div>{pod.nodeName || '-'}</div>
                                    <div className="text-gray-500">IP:</div>
                                    <div>{pod.ip || '-'}</div>
                                    <div className="text-gray-500">Created:</div>
                                    <div>{pod.startTime ? new Date(pod.startTime).toLocaleString() : '-'}</div>
                                    <div className="text-gray-500">Age:</div>
                                    <div>{ageString}</div>
                                    <div className="text-gray-500">Termination:</div>
                                    <div>{pod.metadata?.deletionTimestamp ? new Date(pod.metadata.deletionTimestamp).toLocaleString() : 'Not scheduled'}</div>
                                  </div>
                                </div>
                              </div>

                              <div>
                                <h4 className="font-medium text-gray-700 mb-2">Containers</h4>
                                <div className="bg-white p-3 rounded border border-gray-200">
                                  {pod.containers.map((container, idx) => (
                                    <div key={idx} className="mb-2 last:mb-0">
                                      <div className="flex justify-between items-center">
                                        <div className="font-medium">{container.name}</div>
                                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                                          container.ready ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                                        }`}>
                                          {container.ready ? 'Ready' : 'Not Ready'}
                                        </span>
                                      </div>
                                      <div className="text-xs text-gray-500 mt-1">Image: {container.image}</div>
                                      <div className="text-xs text-gray-500">Restarts: {container.restartCount}</div>
                                      <div className="text-xs text-gray-500">State: {container.state}</div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            </div>

                            <div>
                              <h4 className="font-medium text-gray-700 mb-2">Conditions</h4>
                              <div className="bg-white p-3 rounded border border-gray-200">
                                <table className="min-w-full divide-y divide-gray-200">
                                  <thead>
                                    <tr>
                                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Last Transition</th>
                                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Message</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-gray-200">
                                    {pod.conditions.map((condition, idx) => (
                                      <tr key={idx}>
                                        <td className="px-3 py-2 whitespace-nowrap text-sm">{condition.type}</td>
                                        <td className="px-3 py-2 whitespace-nowrap text-sm">
                                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                                            condition.status === 'True' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                                          }`}>
                                            {condition.status}
                                          </span>
                                        </td>
                                        <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-500">
                                          {condition.lastTransitionTime ? new Date(condition.lastTransitionTime).toLocaleString() : '-'}
                                        </td>
                                        <td className="px-3 py-2 text-sm text-gray-500">{condition.message || '-'}</td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            </div>

                            <div className="mt-4 flex justify-end">
                              <button
                                onClick={() => onSelectPod && onSelectPod(pod)}
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
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default PodList;
