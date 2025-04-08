/** @jsxRuntime classic */
/** @jsx React.createElement */
/** @jsxFrag React.Fragment */

// Import React and necessary components
import React, { useState, useEffect, useMemo } from 'react';
import Layout from '../../components/Layout';
import {
  RefreshIcon,
  ExclamationIcon,
  InformationCircleIcon,
  SearchIcon,
  FilterIcon,
  DownloadIcon,
  ChartPieIcon,
  ServerIcon,
  ClockIcon
} from '@heroicons/react/outline';

// Fix the JSX Intrinsic Elements error with a non-conflicting namespace declaration
declare global {
  namespace JSX {
    interface IntrinsicElements {
      div: any;
      h1: any;
      h2: any;
      h3: any;
      h4: any;
      h5: any;
      p: any;
      span: any;
      button: any;
      table: any;
      thead: any;
      tbody: any;
      tr: any;
      th: any;
      td: any;
      input: any;
      select: any;
      option: any;
      label: any;
      nav: any;
      svg: any;
      path: any;
      circle: any;
      // Single index signature to avoid duplicates
      [elemName: string]: any;
    }
  }
}

// Type definitions for the component
type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'all';

// Log entry interface
interface LogEntry {
  id: string;
  timestamp: Date;
  level: 'debug' | 'info' | 'warn' | 'error';
  message: string;
  module?: string;
  context?: Record<string, any>;
  stack?: string;
  hostname?: string;
  pid?: number;
}

// Service response interface for type assertion in fetchHealthMetrics
interface ServiceResponse {
  status: 'up' | 'down' | 'degraded';
  lastCheck: string;
  [key: string]: any;
}

// Error distribution interface
interface ErrorDistribution {
  [module: string]: number;
}

// Health metrics interface with proper typing
interface HealthMetrics {
  status: 'healthy' | 'degraded' | 'unhealthy';
  uptime: number;
  memory: {
    total: number;
    used: number;
    free: number;
  };
  cpu: {
    usage: number;
  };
  services: {
    [name: string]: {
      status: 'up' | 'down' | 'degraded';
      lastCheck: Date;
    };
  };
  rateLimits: {
    [endpoint: string]: {
      total: number;
      limited: number;
      remaining: number;
    };
  };
}

// Query options interface
interface LogQueryOptions {
  level?: 'debug' | 'info' | 'warn' | 'error';
  module?: string;
  startDate?: Date;
  endDate?: Date;
  limit?: number;
  skip?: number;
  searchText?: string;
}

// Event types to fix implicit any parameters
type SelectChangeEvent = React.ChangeEvent<HTMLSelectElement>;
type InputChangeEvent = React.ChangeEvent<HTMLInputElement>;

// New interfaces for advanced monitoring metrics
interface ServiceMetrics {
  searchIndex: {
    jobs: {
      counts: Record<string, number>;
      all: any[];
    };
    processing: {
      active: number;
      averageTime: number;
    };
  };
  messageBroker: {
    queues: any;
    performance: {
      avgDeliveryTime: number;
      throughput: {
        messagesPerSecond: number;
        totalMessages: number;
      };
    };
  };
}

interface MLPerformanceMetrics {
  models: {
    materialRecognizer: {
      accuracy: number;
      precision: number;
      recall: number;
      f1Score: number;
      lastEvaluated: Date;
      inferenceSpeed: string;
      confidenceDistribution: {
        high: number;
        medium: number;
        low: number;
      };
    };
    textEmbeddings: {
      dimensions: number;
      clusterQuality: number;
      retrievalAccuracy: number;
      averageInferenceTime: string;
      lastTrainingTimestamp: Date;
    };
  };
  trainingJobs: {
    active: number;
    queued: number;
    completed: number;
    failed: number;
  };
  feedback: {
    positiveRate: number;
    negativeRate: number;
    improvementRate: number;
  };
}

interface RealtimeInfo {
  websocketEndpoints: {
    queueEvents: {
      url: string;
      availableQueues: string[];
      eventTypes: string[];
    };
    knowledgeBaseEvents: {
      url: string;
      entities: string[];
      eventTypes: string[];
    };
    agentEvents: {
      url: string;
      eventTypes: string[];
    };
  };
  subscriptionInstructions: {
    authentication: string;
    subscribing: string;
    messageFormat: string;
  };
  currentConnections: {
    queueEvents: number;
    knowledgeBaseEvents: number;
    agentEvents: number;
  };
}

interface InfrastructureMetrics {
  system: {
    os: {
      type: string;
      platform: string;
      release: string;
      uptime: number;
      loadavg: number[];
    };
    memory: {
      total: number;
      free: number;
      used: number;
      usagePercent: string;
    };
    cpu: {
      cores: number;
      model: string;
      speed: number;
      utilization: {
        perCore: Array<{
          usage: number;
          user: number;
          sys: number;
          idle: number;
        }>;
        average: {
          usage: number;
          user: number;
          sys: number;
          idle: number;
        };
      };
    };
  };
  database: {
    connections: number;
    activeQueries: number;
    slowQueries: number;
    avgQueryTime: string;
    cacheHitRate: string;
    storageUsed: string;
    storageAvailable: string;
  };
  storage: {
    totalSize: string;
    usedSize: string;
    freeSize: string;
    usagePercent: string;
    readOperations: number;
    writeOperations: number;
    avgReadLatency: string;
    avgWriteLatency: string;
  };
  network: {
    inboundTraffic: string;
    outboundTraffic: string;
    activeConnections: number;
    errorRate: string;
    avgLatency: string;
  };
}

/**
 * Monitoring Dashboard Page
 * 
 * Provides a centralized view of system logs, errors, and health metrics
 */
export default function Monitoring() {
  // State for active tab
  const [activeTab, setActiveTab] = useState<'overview' | 'services' | 'ml' | 'realtime' | 'infrastructure' | 'logs'>('overview');
  
  // State for logs
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [totalLogs, setTotalLogs] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // State for error distribution
  const [errorDistribution, setErrorDistribution] = useState<ErrorDistribution>({});

  // State for health metrics
  const [healthMetrics, setHealthMetrics] = useState<HealthMetrics | null>(null);

  // States for advanced metrics
  const [serviceMetrics, setServiceMetrics] = useState<ServiceMetrics | null>(null);
  const [mlPerformance, setMlPerformance] = useState<MLPerformanceMetrics | null>(null);
  const [realtimeInfo, setRealtimeInfo] = useState<RealtimeInfo | null>(null);
  const [infrastructureMetrics, setInfrastructureMetrics] = useState<InfrastructureMetrics | null>(null);
  
  // Loading states for advanced metrics
  const [loadingServiceMetrics, setLoadingServiceMetrics] = useState<boolean>(false);
  const [loadingMlMetrics, setLoadingMlMetrics] = useState<boolean>(false);
  const [loadingRealtimeInfo, setLoadingRealtimeInfo] = useState<boolean>(false);
  const [loadingInfrastructureMetrics, setLoadingInfrastructureMetrics] = useState<boolean>(false);

  // State for query filters
  const [filters, setFilters] = useState<LogQueryOptions>({
    level: undefined,
    module: undefined,
    startDate: new Date(Date.now() - 24 * 60 * 60 * 1000), // Last 24 hours
    endDate: new Date(),
    limit: 100,
    skip: 0,
    searchText: undefined
  });

  // Available modules for filtering (derived from logs)
  const availableModules = useMemo(() => {
    const modules = new Set<string>();
    logs.forEach(log => {
      if (log.module) modules.add(log.module);
    });
    return Array.from(modules);
  }, [logs]);

  // Format date for display
  const formatDate = (date: Date): string => {
    return new Date(date).toLocaleString();
  };

  // Format bytes for display
  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  // Format duration for display
  const formatDuration = (seconds: number): string => {
    const days = Math.floor(seconds / (3600 * 24));
    const hours = Math.floor((seconds % (3600 * 24)) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const remainingSeconds = Math.floor(seconds % 60);

    const parts = [];
    if (days > 0) parts.push(`${days}d`);
    if (hours > 0) parts.push(`${hours}h`);
    if (minutes > 0) parts.push(`${minutes}m`);
    if (remainingSeconds > 0 || parts.length === 0) parts.push(`${remainingSeconds}s`);

    return parts.join(' ');
  };

  // Get logs from API
  const fetchLogs = async () => {
    try {
      setLoading(true);
      
      // Convert date objects to ISO strings for the API
      const apiFilters = { ...filters };
      if (apiFilters.startDate) apiFilters.startDate = apiFilters.startDate.toISOString() as any;
      if (apiFilters.endDate) apiFilters.endDate = apiFilters.endDate.toISOString() as any;
      
      const response = await fetch('/api/admin/monitoring/logs', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(apiFilters)
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch logs');
      }
      
      const data = await response.json();
      
      // Convert ISO strings back to Date objects
      const processedLogs = data.logs.map((log: any) => ({
        ...log,
        timestamp: new Date(log.timestamp)
      }));
      
      setLogs(processedLogs);
      setTotalLogs(data.total);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error occurred');
      console.error('Error fetching logs:', err);
    } finally {
      setLoading(false);
    }
  };

  // Get error distribution from API
  const fetchErrorDistribution = async () => {
    try {
      // Calculate timespan from filters
      const startDate = filters.startDate || new Date(Date.now() - 24 * 60 * 60 * 1000);
      const endDate = filters.endDate || new Date();
      const timespan = endDate.getTime() - startDate.getTime();
      
      const response = await fetch(`/api/admin/monitoring/errors?timespan=${timespan}`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch error distribution');
      }
      
      const data = await response.json();
      setErrorDistribution(data.distribution);
    } catch (err) {
      console.error('Error fetching error distribution:', err);
    }
  };

  // Get health metrics from API with proper type handling
  const fetchHealthMetrics = async () => {
    try {
      const response = await fetch('/api/admin/monitoring/health');
      
      if (!response.ok) {
        throw new Error('Failed to fetch health metrics');
      }
      
      const data = await response.json();
      
      // Convert date strings to Date objects
      const processedData = {
        ...data,
        services: Object.entries(data.services).reduce((acc, [key, service]) => {
          // Use double type assertion to properly handle object spreading
          const typedService = service as unknown as ServiceResponse;
          acc[key] = {
            status: typedService.status,
            lastCheck: new Date(typedService.lastCheck)
          };
          return acc;
        }, {} as HealthMetrics['services'])
      };
      
      setHealthMetrics(processedData);
    } catch (err) {
      console.error('Error fetching health metrics:', err);
    }
  };

  // Fetch service metrics from API
  const fetchServiceMetrics = async () => {
    try {
      setLoadingServiceMetrics(true);
      const response = await fetch('/api/admin/monitoring/service-metrics');
      
      if (!response.ok) {
        throw new Error('Failed to fetch service metrics');
      }
      
      const data = await response.json();
      setServiceMetrics(data);
    } catch (err) {
      console.error('Error fetching service metrics:', err);
    } finally {
      setLoadingServiceMetrics(false);
    }
  };

  // Fetch ML performance metrics from API
  const fetchMlPerformance = async () => {
    try {
      setLoadingMlMetrics(true);
      const response = await fetch('/api/admin/monitoring/ml-performance');
      
      if (!response.ok) {
        throw new Error('Failed to fetch ML performance metrics');
      }
      
      const data = await response.json();
      
      // Convert date strings to Date objects
      if (data.models.materialRecognizer.lastEvaluated) {
        data.models.materialRecognizer.lastEvaluated = new Date(data.models.materialRecognizer.lastEvaluated);
      }
      
      if (data.models.textEmbeddings.lastTrainingTimestamp) {
        data.models.textEmbeddings.lastTrainingTimestamp = new Date(data.models.textEmbeddings.lastTrainingTimestamp);
      }
      
      setMlPerformance(data);
    } catch (err) {
      console.error('Error fetching ML performance metrics:', err);
    } finally {
      setLoadingMlMetrics(false);
    }
  };

  // Fetch realtime information from API
  const fetchRealtimeInfo = async () => {
    try {
      setLoadingRealtimeInfo(true);
      const response = await fetch('/api/admin/monitoring/realtime-info');
      
      if (!response.ok) {
        throw new Error('Failed to fetch realtime info');
      }
      
      const data = await response.json();
      setRealtimeInfo(data);
    } catch (err) {
      console.error('Error fetching realtime info:', err);
    } finally {
      setLoadingRealtimeInfo(false);
    }
  };

  // Fetch infrastructure metrics from API
  const fetchInfrastructureMetrics = async () => {
    try {
      setLoadingInfrastructureMetrics(true);
      const response = await fetch('/api/admin/monitoring/infrastructure');
      
      if (!response.ok) {
        throw new Error('Failed to fetch infrastructure metrics');
      }
      
      const data = await response.json();
      setInfrastructureMetrics(data);
    } catch (err) {
      console.error('Error fetching infrastructure metrics:', err);
    } finally {
      setLoadingInfrastructureMetrics(false);
    }
  };

  // Load data on initial render and when filters change
  useEffect(() => {
    fetchLogs();
    fetchErrorDistribution();
    fetchHealthMetrics();
    
    // Set up periodic refresh
    const intervalId = setInterval(() => {
      fetchLogs();
      fetchErrorDistribution();
      fetchHealthMetrics();
      
      // Also refresh active tab data
      if (activeTab === 'services' && serviceMetrics) {
        fetchServiceMetrics();
      } else if (activeTab === 'ml' && mlPerformance) {
        fetchMlPerformance();
      } else if (activeTab === 'realtime' && realtimeInfo) {
        fetchRealtimeInfo();
      } else if (activeTab === 'infrastructure' && infrastructureMetrics) {
        fetchInfrastructureMetrics();
      }
    }, 30000); // Refresh every 30 seconds
    
    return () => clearInterval(intervalId);
  }, [filters, activeTab]);

  // Load data based on the active tab
  useEffect(() => {
    if (activeTab === 'services' && !serviceMetrics) {
      fetchServiceMetrics();
    } else if (activeTab === 'ml' && !mlPerformance) {
      fetchMlPerformance();
    } else if (activeTab === 'realtime' && !realtimeInfo) {
      fetchRealtimeInfo();
    } else if (activeTab === 'infrastructure' && !infrastructureMetrics) {
      fetchInfrastructureMetrics();
    }
  }, [activeTab]);

  // Handle filter changes
  const handleFilterChange = (name: string, value: any) => {
    setFilters(prev => ({
      ...prev,
      [name]: value
    }));
  };

  // Handle pagination
  const handlePaginationChange = (page: number) => {
    const skip = (page - 1) * (filters.limit || 100);
    setFilters(prev => ({
      ...prev,
      skip
    }));
  };

  // Get log level color
  const getLevelColor = (level: string): string => {
    switch (level) {
      case 'error':
        return 'bg-red-100 text-red-800';
      case 'warn':
        return 'bg-yellow-100 text-yellow-800';
      case 'info':
        return 'bg-blue-100 text-blue-800';
      case 'debug':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  // Get status color
  const getStatusColor = (status: string): string => {
    switch (status) {
      case 'up':
      case 'healthy':
        return 'bg-green-100 text-green-800';
      case 'degraded':
        return 'bg-yellow-100 text-yellow-800';
      case 'down':
      case 'unhealthy':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  // Calculate current page
  const currentPage = Math.floor((filters.skip || 0) / (filters.limit || 100)) + 1;
  const totalPages = Math.ceil(totalLogs / (filters.limit || 100));

  // Generate pagination
  const pagination: number[] = [];
  for (let i = Math.max(1, currentPage - 2); i <= Math.min(totalPages, currentPage + 2); i++) {
    pagination.push(i);
  }

  // Render tab content based on active tab
  const renderTabContent = () => {
    switch (activeTab) {
      case 'overview':
        return (
          <>
            {/* Health Dashboard */}
            <div className="bg-white shadow rounded-lg mb-6 overflow-hidden">
              <div className="px-4 py-5 sm:px-6 border-b border-gray-200">
                <h3 className="text-lg font-medium leading-6 text-gray-900">System Health</h3>
                <div className="mt-1 flex justify-between items-center">
                  <p className="text-sm text-gray-500">Real-time metrics and service status</p>
                  <button
                    type="button"
                    onClick={() => fetchHealthMetrics()}
                    className="inline-flex items-center p-1.5 border border-gray-300 rounded-md text-gray-700 bg-white hover:bg-gray-50"
                  >
                    <RefreshIcon className="h-5 w-5" />
                  </button>
                </div>
              </div>
              
              <div className="px-4 py-5 sm:p-6">
                {healthMetrics ? (
                  <div>
                    {/* Status Summary */}
                    <div className="mb-6 flex items-center">
                      <div className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(healthMetrics.status)}`}>
                        <ServerIcon className="h-4 w-4 mr-1.5" />
                        System Status: {healthMetrics.status.charAt(0).toUpperCase() + healthMetrics.status.slice(1)}
                      </div>
                      <div className="ml-4 flex items-center text-sm text-gray-500">
                        <ClockIcon className="h-4 w-4 mr-1.5" />
                        Uptime: {formatDuration(healthMetrics.uptime)}
                      </div>
                    </div>

                    {/* Resource Usage */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                      <div>
                        <h4 className="text-sm font-medium text-gray-500 mb-2">Memory Usage</h4>
                        <div className="w-full bg-gray-200 rounded-full h-2.5 mb-1">
                          <div 
                            className="bg-blue-600 h-2.5 rounded-full" 
                            style={{ width: `${(healthMetrics.memory.used / healthMetrics.memory.total) * 100}%` }}
                          ></div>
                        </div>
                        <div className="flex justify-between text-xs text-gray-500">
                          <span>Used: {formatBytes(healthMetrics.memory.used)}</span>
                          <span>Total: {formatBytes(healthMetrics.memory.total)}</span>
                        </div>
                      </div>
                      <div>
                        <h4 className="text-sm font-medium text-gray-500 mb-2">CPU Usage</h4>
                        <div className="w-full bg-gray-200 rounded-full h-2.5 mb-1">
                          <div 
                            className="bg-green-600 h-2.5 rounded-full" 
                            style={{ width: `${healthMetrics.cpu.usage}%` }}
                          ></div>
                        </div>
                        <div className="flex justify-between text-xs text-gray-500">
                          <span>Usage: {healthMetrics.cpu.usage}%</span>
                        </div>
                      </div>
                    </div>

                    {/* Services */}
                    <div className="mb-6">
                      <h4 className="text-sm font-medium text-gray-500 mb-2">Services</h4>
                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                        {Object.entries(healthMetrics.services).map(([name, service]) => (
                          <div key={name} className="border rounded-lg p-3">
                            <div className="flex justify-between items-center mb-2">
                              <h5 className="text-sm font-medium">{name}</h5>
                              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${getStatusColor(service.status)}`}>
                                {service.status}
                              </span>
                            </div>
                            <div className="text-xs text-gray-500">
                              Last checked: {formatDate(service.lastCheck)}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Rate Limits */}
                    <div>
                      <h4 className="text-sm font-medium text-gray-500 mb-2">API Rate Limits (Last 5 Minutes)</h4>
                      <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200">
                          <thead className="bg-gray-50">
                            <tr>
                              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Endpoint
                              </th>
                              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Total Requests
                              </th>
                              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Limited Requests
                              </th>
                              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Remaining Capacity
                              </th>
                            </tr>
                          </thead>
                          <tbody className="bg-white divide-y divide-gray-200">
                            {Object.entries(healthMetrics.rateLimits).map(([endpoint, data]) => (
                              <tr key={endpoint}>
                                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                  {endpoint}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                  {data.total}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                  {data.limited} ({((data.limited / data.total) * 100).toFixed(1)}%)
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                  {data.remaining}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="flex justify-center items-center h-64">
                    <div className="text-center">
                      <svg className="animate-spin h-8 w-8 text-gray-400 mx-auto mb-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      <p className="text-sm text-gray-500">Loading health metrics...</p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Error Distribution */}
            <div className="bg-white shadow rounded-lg mb-6 overflow-hidden">
              <div className="px-4 py-5 sm:px-6 border-b border-gray-200">
                <h3 className="text-lg font-medium leading-6 text-gray-900">Error Distribution</h3>
                <div className="mt-1 flex justify-between items-center">
                  <p className="text-sm text-gray-500">Errors grouped by module</p>
                  <button
                    type="button"
                    onClick={() => fetchErrorDistribution()}
                    className="inline-flex items-center p-1.5 border border-gray-300 rounded-md text-gray-700 bg-white hover:bg-gray-50"
                  >
                    <RefreshIcon className="h-5 w-5" />
                  </button>
                </div>
              </div>
              
              <div className="px-4 py-5 sm:p-6">
                {Object.keys(errorDistribution).length > 0 ? (
                  <div className="space-y-6">
                    {/* Error Distribution Chart */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                      <div>
                        <h4 className="text-sm font-medium text-gray-500 mb-4">Errors by Module</h4>
                        {Object.entries(errorDistribution).map(([module, count]) => {
                          const total = Object.values(errorDistribution).reduce((sum, val) => sum + val, 0);
                          const percentage = (count / total) * 100;
                          return (
                            <div key={module} className="mb-3">
                              <div className="flex justify-between mb-1">
                                <span className="text-sm font-medium text-gray-700">{module}</span>
                                <span className="text-sm text-gray-500">{count} errors ({percentage.toFixed(1)}%)</span>
                              </div>
                              <div className="w-full bg-gray-200 rounded-full h-2.5">
                                <div className="bg-red-600 h-2.5 rounded-full" style={{ width: `${percentage}%` }}></div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                      <div className="flex justify-center items-center">
                        <div className="text-center">
                          <ChartPieIcon className="h-24 w-24 text-gray-300 mx-auto mb-2" />
                          <p className="text-sm text-gray-500">Interactive chart visualization coming soon...</p>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="flex justify-center items-center h-64">
                    <div className="text-center">
                      <ExclamationIcon className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                      <p className="text-sm text-gray-500">No errors found in the selected time period</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </>
        );
      
      case 'services':
        return (
          <div className="bg-white shadow rounded-lg mb-6 overflow-hidden">
            <div className="px-4 py-5 sm:px-6 border-b border-gray-200">
              <h3 className="text-lg font-medium leading-6 text-gray-900">Service Metrics</h3>
              <div className="mt-1 flex justify-between items-center">
                <p className="text-sm text-gray-500">Performance and health metrics for system services</p>
                <button
                  type="button"
                  onClick={fetchServiceMetrics}
                  className="inline-flex items-center p-1.5 border border-gray-300 rounded-md text-gray-700 bg-white hover:bg-gray-50"
                >
                  <RefreshIcon className="h-5 w-5" />
                </button>
              </div>
            </div>
            
            <div className="px-4 py-5 sm:p-6">
              {loadingServiceMetrics ? (
                <div className="flex justify-center items-center h-64">
                  <div className="text-center">
                    <svg className="animate-spin h-8 w-8 text-gray-400 mx-auto mb-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <p className="text-sm text-gray-500">Loading service metrics...</p>
                  </div>
                </div>
              ) : serviceMetrics ? (
                <div className="space-y-6">
                  {/* Search Index Queue */}
                  <div>
                    <h4 className="text-base font-medium text-gray-900 mb-3">Search Index Queue</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
                      <div className="border rounded-lg p-4">
                        <div className="text-sm font-medium text-gray-500">Pending Jobs</div>
                        <div className="mt-1 text-xl font-semibold text-gray-900">{serviceMetrics.searchIndex.jobs.counts.pending || 0}</div>
                      </div>
                      <div className="border rounded-lg p-4">
                        <div className="text-sm font-medium text-gray-500">Processing Jobs</div>
                        <div className="mt-1 text-xl font-semibold text-gray-900">{serviceMetrics.searchIndex.jobs.counts.processing || 0}</div>
                      </div>
                      <div className="border rounded-lg p-4">
                        <div className="text-sm font-medium text-gray-500">Completed Jobs</div>
                        <div className="mt-1 text-xl font-semibold text-gray-900">{serviceMetrics.searchIndex.jobs.counts.completed || 0}</div>
                      </div>
                      <div className="border rounded-lg p-4">
                        <div className="text-sm font-medium text-gray-500">Failed Jobs</div>
                        <div className="mt-1 text-xl font-semibold text-gray-900">{serviceMetrics.searchIndex.jobs.counts.failed || 0}</div>
                      </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="border rounded-lg p-4">
                        <div className="text-sm font-medium text-gray-500">Active Jobs</div>
                        <div className="mt-1 text-xl font-semibold text-gray-900">{serviceMetrics.searchIndex.processing.active}</div>
                      </div>
                      <div className="border rounded-lg p-4">
                        <div className="text-sm font-medium text-gray-500">Average Processing Time</div>
                        <div className="mt-1 text-xl font-semibold text-gray-900">
                          {formatDuration(serviceMetrics.searchIndex.processing.averageTime / 1000)}
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  {/* Message Broker */}
                  <div>
                    <h4 className="text-base font-medium text-gray-900 mb-3">Message Broker</h4>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="border rounded-lg p-4">
                        <div className="text-sm font-medium text-gray-500">Average Delivery Time</div>
                        <div className="mt-1 text-xl font-semibold text-gray-900">
                          {serviceMetrics.messageBroker.performance.avgDeliveryTime}ms
                        </div>
                      </div>
                      <div className="border rounded-lg p-4">
                        <div className="text-sm font-medium text-gray-500">Messages Per Second</div>
                        <div className="mt-1 text-xl font-semibold text-gray-900">
                          {serviceMetrics.messageBroker.performance.throughput.messagesPerSecond}
                        </div>
                      </div>
                      <div className="border rounded-lg p-4">
                        <div className="text-sm font-medium text-gray-500">Total Messages</div>
                        <div className="mt-1 text-xl font-semibold text-gray-900">
                          {serviceMetrics.messageBroker.performance.throughput.totalMessages.toLocaleString()}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex justify-center items-center h-64">
                  <div className="text-center">
                    <ExclamationIcon className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                    <p className="text-sm text-gray-500">Failed to load service metrics</p>
                    <button 
                      className="mt-3 inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
                      onClick={fetchServiceMetrics}
                    >
                      Try Again
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        );
      
      case 'ml':
        return (
          <div className="bg-white shadow rounded-lg mb-6 overflow-hidden">
            <div className="px-4 py-5 sm:px-6 border-b border-gray-200">
              <h3 className="text-lg font-medium leading-6 text-gray-900">ML Performance</h3>
              <div className="mt-1 flex justify-between items-center">
                <p className="text-sm text-gray-500">Machine learning model performance metrics</p>
                <button
                  type="button"
                  onClick={fetchMlPerformance}
                  className="inline-flex items-center p-1.5 border border-gray-300 rounded-md text-gray-700 bg-white hover:bg-gray-50"
                >
                  <RefreshIcon className="h-5 w-5" />
                </button>
              </div>
            </div>
            
            <div className="px-4 py-5 sm:p-6">
              {loadingMlMetrics ? (
                <div className="flex justify-center items-center h-64">
                  <div className="text-center">
                    <svg className="animate-spin h-8 w-8 text-gray-400 mx-auto mb-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <p className="text-sm text-gray-500">Loading ML metrics...</p>
                  </div>
                </div>
              ) : mlPerformance ? (
                <div className="space-y-6">
                  {/* Material Recognizer Model */}
                  <div>
                    <h4 className="text-base font-medium text-gray-900 mb-3">Material Recognizer Model</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
                      <div className="border rounded-lg p-4">
                        <div className="text-sm font-medium text-gray-500">Accuracy</div>
                        <div className="mt-1 text-xl font-semibold text-gray-900">
                          {(mlPerformance.models.materialRecognizer.accuracy * 100).toFixed(1)}%
                        </div>
                      </div>
                      <div className="border rounded-lg p-4">
                        <div className="text-sm font-medium text-gray-500">Precision</div>
                        <div className="mt-1 text-xl font-semibold text-gray-900">
                          {(mlPerformance.models.materialRecognizer.precision * 100).toFixed(1)}%
                        </div>
                      </div>
                      <div className="border rounded-lg p-4">
                        <div className="text-sm font-medium text-gray-500">Recall</div>
                        <div className="mt-1 text-xl font-semibold text-gray-900">
                          {(mlPerformance.models.materialRecognizer.recall * 100).toFixed(1)}%
                        </div>
                      </div>
                      <div className="border rounded-lg p-4">
                        <div className="text-sm font-medium text-gray-500">F1 Score</div>
                        <div className="mt-1 text-xl font-semibold text-gray-900">
                          {(mlPerformance.models.materialRecognizer.f1Score * 100).toFixed(1)}%
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex justify-between mt-3 text-sm text-gray-500">
                      <span>Inference Speed: {mlPerformance.models.materialRecognizer.inferenceSpeed}</span>
                      <span>Last Evaluated: {formatDate(mlPerformance.models.materialRecognizer.lastEvaluated)}</span>
                    </div>

                    <div className="mt-4">
                      <h5 className="text-sm font-medium text-gray-700 mb-2">Confidence Distribution</h5>
                      <div className="grid grid-cols-3 gap-2">
                        <div className="bg-green-100 rounded p-2 text-center">
                          <div className="text-sm text-gray-600">High</div>
                          <div className="font-semibold text-green-700">
                            {mlPerformance.models.materialRecognizer.confidenceDistribution.high}%
                          </div>
                        </div>
                        <div className="bg-yellow-100 rounded p-2 text-center">
                          <div className="text-sm text-gray-600">Medium</div>
                          <div className="font-semibold text-yellow-700">
                            {mlPerformance.models.materialRecognizer.confidenceDistribution.medium}%
                          </div>
                        </div>
                        <div className="bg-red-100 rounded p-2 text-center">
                          <div className="text-sm text-gray-600">Low</div>
                          <div className="font-semibold text-red-700">
                            {mlPerformance.models.materialRecognizer.confidenceDistribution.low}%
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  {/* Text Embeddings Model */}
                  <div>
                    <h4 className="text-base font-medium text-gray-900 mb-3">Text Embeddings Model</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      <div className="border rounded-lg p-4">
                        <div className="text-sm font-medium text-gray-500">Dimensions</div>
                        <div className="mt-1 text-xl font-semibold text-gray-900">
                          {mlPerformance.models.textEmbeddings.dimensions}
                        </div>
                      </div>
                      <div className="border rounded-lg p-4">
                        <div className="text-sm font-medium text-gray-500">Cluster Quality</div>
                        <div className="mt-1 text-xl font-semibold text-gray-900">
                          {(mlPerformance.models.textEmbeddings.clusterQuality * 100).toFixed(1)}%
                        </div>
                      </div>
                      <div className="border rounded-lg p-4">
                        <div className="text-sm font-medium text-gray-500">Retrieval Accuracy</div>
                        <div className="mt-1 text-xl font-semibold text-gray-900">
                          {(mlPerformance.models.textEmbeddings.retrievalAccuracy * 100).toFixed(1)}%
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex justify-between mt-3 text-sm text-gray-500">
                      <span>Inference Time: {mlPerformance.models.textEmbeddings.averageInferenceTime}</span>
                      <span>Last Training: {formatDate(mlPerformance.models.textEmbeddings.lastTrainingTimestamp)}</span>
                    </div>
                  </div>
                  
                  {/* Training Jobs */}
                  <div>
                    <h4 className="text-base font-medium text-gray-900 mb-3">Training Jobs</h4>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div className="border rounded-lg p-4">
                        <div className="text-sm font-medium text-gray-500">Active</div>
                        <div className="mt-1 text-xl font-semibold text-green-600">
                          {mlPerformance.trainingJobs.active}
                        </div>
                      </div>
                      <div className="border rounded-lg p-4">
                        <div className="text-sm font-medium text-gray-500">Queued</div>
                        <div className="mt-1 text-xl font-semibold text-yellow-600">
                          {mlPerformance.trainingJobs.queued}
                        </div>
                      </div>
                      <div className="border rounded-lg p-4">
                        <div className="text-sm font-medium text-gray-500">Completed</div>
                        <div className="mt-1 text-xl font-semibold text-blue-600">
                          {mlPerformance.trainingJobs.completed}
                        </div>
                      </div>
                      <div className="border rounded-lg p-4">
                        <div className="text-sm font-medium text-gray-500">Failed</div>
                        <div className="mt-1 text-xl font-semibold text-red-600">
                          {mlPerformance.trainingJobs.failed}
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  {/* Feedback Metrics */}
                  <div>
                    <h4 className="text-base font-medium text-gray-900 mb-3">User Feedback</h4>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="border rounded-lg p-4">
                        <div className="text-sm font-medium text-gray-500">Positive Rate</div>
                        <div className="mt-1 text-xl font-semibold text-green-600">
                          {(mlPerformance.feedback.positiveRate * 100).toFixed(1)}%
                        </div>
                      </div>
                      <div className="border rounded-lg p-4">
                        <div className="text-sm font-medium text-gray-500">Negative Rate</div>
                        <div className="mt-1 text-xl font-semibold text-red-600">
                          {(mlPerformance.feedback.negativeRate * 100).toFixed(1)}%
                        </div>
                      </div>
                      <div className="border rounded-lg p-4">
                        <div className="text-sm font-medium text-gray-500">Improvement Rate</div>
                        <div className="mt-1 text-xl font-semibold text-blue-600">
                          {(mlPerformance.feedback.improvementRate * 100).toFixed(1)}%
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex justify-center items-center h-64">
                  <div className="text-center">
                    <ExclamationIcon className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                    <p className="text-sm text-gray-500">Failed to load ML performance metrics</p>
                    <button 
                      className="mt-3 inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
                      onClick={fetchMlPerformance}
                    >
                      Try Again
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        );
      
      case 'realtime':
        return (
          <div className="bg-white shadow rounded-lg mb-6 overflow-hidden">
            <div className="px-4 py-5 sm:px-6 border-b border-gray-200">
              <h3 className="text-lg font-medium leading-6 text-gray-900">Realtime Events Monitoring</h3>
              <div className="mt-1 flex justify-between items-center">
                <p className="text-sm text-gray-500">Information about real-time monitoring channels</p>
                <button
                  type="button"
                  onClick={fetchRealtimeInfo}
                  className="inline-flex items-center p-1.5 border border-gray-300 rounded-md text-gray-700 bg-white hover:bg-gray-50"
                >
                  <RefreshIcon className="h-5 w-5" />
                </button>
              </div>
            </div>
            
            <div className="px-4 py-5 sm:p-6">
              {loadingRealtimeInfo ? (
                <div className="flex justify-center items-center h-64">
                  <div className="text-center">
                    <svg className="animate-spin h-8 w-8 text-gray-400 mx-auto mb-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <p className="text-sm text-gray-500">Loading realtime info...</p>
                  </div>
                </div>
              ) : realtimeInfo ? (
                <div className="space-y-6">
                  {/* WebSocket Endpoints */}
                  <div>
                    <h4 className="text-base font-medium text-gray-900 mb-3">WebSocket Endpoints</h4>
                    <div className="space-y-4">
                      {/* Queue Events WebSocket */}
                      <div className="border rounded-lg p-4">
                        <h5 className="font-medium text-gray-800 mb-2">Queue Events</h5>
                        <div className="text-sm text-gray-600 mb-2">
                          <strong>Endpoint:</strong> {realtimeInfo.websocketEndpoints.queueEvents.url}
                        </div>
                        <div className="mb-2">
                          <div className="text-sm font-medium text-gray-700 mb-1">Available Queues:</div>
                          <div className="flex flex-wrap gap-1">
                            {realtimeInfo.websocketEndpoints.queueEvents.availableQueues.map(queue => (
                              <span key={queue} className="inline-flex items-center px-2.5 py-0.5 rounded-md text-sm font-medium bg-blue-100 text-blue-800">
                                {queue}
                              </span>
                            ))}
                          </div>
                        </div>
                        <div>
                          <div className="text-sm font-medium text-gray-700 mb-1">Event Types:</div>
                          <div className="flex flex-wrap gap-1">
                            {realtimeInfo.websocketEndpoints.queueEvents.eventTypes.map(eventType => (
                              <span key={eventType} className="inline-flex items-center px-2.5 py-0.5 rounded-md text-sm font-medium bg-green-100 text-green-800">
                                {eventType}
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>
                      
                      {/* Knowledge Base Events WebSocket */}
                      <div className="border rounded-lg p-4">
                        <h5 className="font-medium text-gray-800 mb-2">Knowledge Base Events</h5>
                        <div className="text-sm text-gray-600 mb-2">
                          <strong>Endpoint:</strong> {realtimeInfo.websocketEndpoints.knowledgeBaseEvents.url}
                        </div>
                        <div className="mb-2">
                          <div className="text-sm font-medium text-gray-700 mb-1">Entities:</div>
                          <div className="flex flex-wrap gap-1">
                            {realtimeInfo.websocketEndpoints.knowledgeBaseEvents.entities.map(entity => (
                              <span key={entity} className="inline-flex items-center px-2.5 py-0.5 rounded-md text-sm font-medium bg-blue-100 text-blue-800">
                                {entity}
                              </span>
                            ))}
                          </div>
                        </div>
                        <div>
                          <div className="text-sm font-medium text-gray-700 mb-1">Event Types:</div>
                          <div className="flex flex-wrap gap-1">
                            {realtimeInfo.websocketEndpoints.knowledgeBaseEvents.eventTypes.map(eventType => (
                              <span key={eventType} className="inline-flex items-center px-2.5 py-0.5 rounded-md text-sm font-medium bg-green-100 text-green-800">
                                {eventType}
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>
                      
                      {/* Agent Events WebSocket */}
                      <div className="border rounded-lg p-4">
                        <h5 className="font-medium text-gray-800 mb-2">Agent Events</h5>
                        <div className="text-sm text-gray-600 mb-2">
                          <strong>Endpoint:</strong> {realtimeInfo.websocketEndpoints.agentEvents.url}
                        </div>
                        <div>
                          <div className="text-sm font-medium text-gray-700 mb-1">Event Types:</div>
                          <div className="flex flex-wrap gap-1">
                            {realtimeInfo.websocketEndpoints.agentEvents.eventTypes.map(eventType => (
                              <span key={eventType} className="inline-flex items-center px-2.5 py-0.5 rounded-md text-sm font-medium bg-green-100 text-green-800">
                                {eventType}
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  {/* Current Connections */}
                  <div>
                    <h4 className="text-base font-medium text-gray-900 mb-3">Current Connections</h4>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="border rounded-lg p-4">
                        <div className="text-sm font-medium text-gray-500">Queue Events</div>
                        <div className="mt-1 text-xl font-semibold text-gray-900">
                          {realtimeInfo.currentConnections.queueEvents}
                        </div>
                      </div>
                      <div className="border rounded-lg p-4">
                        <div className="text-sm font-medium text-gray-500">Knowledge Base Events</div>
                        <div className="mt-1 text-xl font-semibold text-gray-900">
                          {realtimeInfo.currentConnections.knowledgeBaseEvents}
                        </div>
                      </div>
                      <div className="border rounded-lg p-4">
                        <div className="text-sm font-medium text-gray-500">Agent Events</div>
                        <div className="mt-1 text-xl font-semibold text-gray-900">
                          {realtimeInfo.currentConnections.agentEvents}
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  {/* Subscription Instructions */}
                  <div>
                    <h4 className="text-base font-medium text-gray-900 mb-3">Subscription Instructions</h4>
                    <div className="border rounded-lg p-4">
                      <div className="mb-2">
                        <div className="text-sm font-medium text-gray-700">Authentication:</div>
                        <div className="text-sm text-gray-600">{realtimeInfo.subscriptionInstructions.authentication}</div>
                      </div>
                      <div className="mb-2">
                        <div className="text-sm font-medium text-gray-700">Subscribing:</div>
                        <div className="text-sm text-gray-600">{realtimeInfo.subscriptionInstructions.subscribing}</div>
                      </div>
                      <div>
                        <div className="text-sm font-medium text-gray-700">Message Format:</div>
                        <div className="text-sm text-gray-600">{realtimeInfo.subscriptionInstructions.messageFormat}</div>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex justify-center items-center h-64">
                  <div className="text-center">
                    <ExclamationIcon className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                    <p className="text-sm text-gray-500">Failed to load realtime information</p>
                    <button 
                      className="mt-3 inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
                      onClick={fetchRealtimeInfo}
                    >
                      Try Again
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        );
      
      case 'infrastructure':
        return (
          <div className="bg-white shadow rounded-lg mb-6 overflow-hidden">
            <div className="px-4 py-5 sm:px-6 border-b border-gray-200">
              <h3 className="text-lg font-medium leading-6 text-gray-900">Infrastructure Metrics</h3>
              <div className="mt-1 flex justify-between items-center">
                <p className="text-sm text-gray-500">Detailed metrics on system infrastructure</p>
                <button
                  type="button"
                  onClick={fetchInfrastructureMetrics}
                  className="inline-flex items-center p-1.5 border border-gray-300 rounded-md text-gray-700 bg-white hover:bg-gray-50"
                >
                  <RefreshIcon className="h-5 w-5" />
                </button>
              </div>
            </div>
            
            <div className="px-4 py-5 sm:p-6">
              {loadingInfrastructureMetrics ? (
                <div className="flex justify-center items-center h-64">
                  <div className="text-center">
                    <svg className="animate-spin h-8 w-8 text-gray-400 mx-auto mb-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <p className="text-sm text-gray-500">Loading infrastructure metrics...</p>
                  </div>
                </div>
              ) : infrastructureMetrics ? (
                <div className="space-y-6">
                  {/* System Information */}
                  <div>
                    <h4 className="text-base font-medium text-gray-900 mb-3">System Information</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                      <div className="border rounded-lg p-4">
                        <h5 className="font-medium text-gray-800 mb-2">Operating System</h5>
                        <div className="text-sm space-y-1">
                          <div><span className="font-medium">Type:</span> {infrastructureMetrics.system.os.type}</div>
                          <div><span className="font-medium">Platform:</span> {infrastructureMetrics.system.os.platform}</div>
                          <div><span className="font-medium">Release:</span> {infrastructureMetrics.system.os.release}</div>
                          <div><span className="font-medium">Uptime:</span> {formatDuration(infrastructureMetrics.system.os.uptime)}</div>
                          <div><span className="font-medium">Load Average:</span> {infrastructureMetrics.system.os.loadavg.map(v => v.toFixed(2)).join(', ')}</div>
                        </div>
                      </div>
                      
                      <div className="border rounded-lg p-4">
                        <h5 className="font-medium text-gray-800 mb-2">CPU</h5>
                        <div className="text-sm space-y-1">
                          <div><span className="font-medium">Cores:</span> {infrastructureMetrics.system.cpu.cores}</div>
                          <div><span className="font-medium">Model:</span> {infrastructureMetrics.system.cpu.model}</div>
                          <div><span className="font-medium">Speed:</span> {infrastructureMetrics.system.cpu.speed} MHz</div>
                          <div><span className="font-medium">Average Usage:</span> {infrastructureMetrics.system.cpu.utilization.average.usage}%</div>
                          <div className="mt-2">
                            <div className="text-xs font-medium text-gray-500">CPU Utilization</div>
                            <div className="w-full bg-gray-200 rounded-full h-2.5 mb-1">
                              <div 
                                className="bg-blue-600 h-2.5 rounded-full" 
                                style={{ width: `${infrastructureMetrics.system.cpu.utilization.average.usage}%` }}
                              ></div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                    
                    <div className="border rounded-lg p-4">
                      <h5 className="font-medium text-gray-800 mb-2">Memory</h5>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-2">
                        <div className="text-sm">
                          <div className="text-xs font-medium text-gray-500">Total</div>
                          <div className="font-medium text-gray-800">
                            {formatBytes(infrastructureMetrics.system.memory.total)}
                          </div>
                        </div>
                        <div className="text-sm">
                          <div className="text-xs font-medium text-gray-500">Used</div>
                          <div className="font-medium text-gray-800">
                            {formatBytes(infrastructureMetrics.system.memory.used)}
                          </div>
                        </div>
                        <div className="text-sm">
                          <div className="text-xs font-medium text-gray-500">Free</div>
                          <div className="font-medium text-gray-800">
                            {formatBytes(infrastructureMetrics.system.memory.free)}
                          </div>
                        </div>
                      </div>
                      <div className="mt-2">
                        <div className="text-xs font-medium text-gray-500">Memory Usage ({infrastructureMetrics.system.memory.usagePercent}%)</div>
                        <div className="w-full bg-gray-200 rounded-full h-2.5 mb-1">
                          <div 
                            className="bg-blue-600 h-2.5 rounded-full" 
                            style={{ width: infrastructureMetrics.system.memory.usagePercent + '%' }}
                          ></div>
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  {/* Database Metrics */}
                  <div>
                    <h4 className="text-base font-medium text-gray-900 mb-3">Database</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="border rounded-lg p-4">
                        <div className="text-sm space-y-1">
                          <div><span className="font-medium">Connections:</span> {infrastructureMetrics.database.connections}</div>
                          <div><span className="font-medium">Active Queries:</span> {infrastructureMetrics.database.activeQueries}</div>
                          <div><span className="font-medium">Slow Queries:</span> {infrastructureMetrics.database.slowQueries}</div>
                          <div><span className="font-medium">Avg Query Time:</span> {infrastructureMetrics.database.avgQueryTime}</div>
                          <div><span className="font-medium">Cache Hit Rate:</span> {infrastructureMetrics.database.cacheHitRate}</div>
                        </div>
                      </div>
                      
                      <div className="border rounded-lg p-4">
                        <div className="text-sm mb-3">
                          <div><span className="font-medium">Storage Used:</span> {infrastructureMetrics.database.storageUsed}</div>
                          <div><span className="font-medium">Storage Available:</span> {infrastructureMetrics.database.storageAvailable}</div>
                        </div>
                        <div className="mt-2">
                          <div className="text-xs font-medium text-gray-500">Storage Usage</div>
                          <div className="w-full bg-gray-200 rounded-full h-2.5 mb-1">
                            <div 
                              className="bg-blue-600 h-2.5 rounded-full" 
                              style={{ 
                                width: parseInt(infrastructureMetrics.database.storageUsed) / 
                                       (parseInt(infrastructureMetrics.database.storageUsed) + 
                                        parseInt(infrastructureMetrics.database.storageAvailable)) * 100 + '%' 
                              }}
                            ></div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  {/* Storage Metrics */}
                  <div>
                    <h4 className="text-base font-medium text-gray-900 mb-3">Storage</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="border rounded-lg p-4">
                        <div className="grid grid-cols-3 gap-2 mb-3">
                          <div className="text-sm">
                            <div className="text-xs font-medium text-gray-500">Total</div>
                            <div className="font-medium text-gray-800">{infrastructureMetrics.storage.totalSize}</div>
                          </div>
                          <div className="text-sm">
                            <div className="text-xs font-medium text-gray-500">Used</div>
                            <div className="font-medium text-gray-800">{infrastructureMetrics.storage.usedSize}</div>
                          </div>
                          <div className="text-sm">
                            <div className="text-xs font-medium text-gray-500">Free</div>
                            <div className="font-medium text-gray-800">{infrastructureMetrics.storage.freeSize}</div>
                          </div>
                        </div>
                        <div className="mt-2">
                          <div className="text-xs font-medium text-gray-500">Storage Usage ({infrastructureMetrics.storage.usagePercent})</div>
                          <div className="w-full bg-gray-200 rounded-full h-2.5 mb-1">
                            <div 
                              className="bg-blue-600 h-2.5 rounded-full" 
                              style={{ width: infrastructureMetrics.storage.usagePercent }}
                            ></div>
                          </div>
                        </div>
                      </div>
                      
                      <div className="border rounded-lg p-4">
                        <div className="text-sm space-y-1">
                          <div><span className="font-medium">Read Operations:</span> {infrastructureMetrics.storage.readOperations.toLocaleString()}</div>
                          <div><span className="font-medium">Write Operations:</span> {infrastructureMetrics.storage.writeOperations.toLocaleString()}</div>
                          <div><span className="font-medium">Read Latency:</span> {infrastructureMetrics.storage.avgReadLatency}</div>
                          <div><span className="font-medium">Write Latency:</span> {infrastructureMetrics.storage.avgWriteLatency}</div>
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  {/* Network Metrics */}
                  <div>
                    <h4 className="text-base font-medium text-gray-900 mb-3">Network</h4>
                    <div className="border rounded-lg p-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="text-sm space-y-1">
                          <div><span className="font-medium">Inbound Traffic:</span> {infrastructureMetrics.network.inboundTraffic}</div>
                          <div><span className="font-medium">Outbound Traffic:</span> {infrastructureMetrics.network.outboundTraffic}</div>
                          <div><span className="font-medium">Active Connections:</span> {infrastructureMetrics.network.activeConnections}</div>
                        </div>
                        <div className="text-sm space-y-1">
                          <div><span className="font-medium">Average Latency:</span> {infrastructureMetrics.network.avgLatency}</div>
                          <div><span className="font-medium">Error Rate:</span> {infrastructureMetrics.network.errorRate}</div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex justify-center items-center h-64">
                  <div className="text-center">
                    <ExclamationIcon className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                    <p className="text-sm text-gray-500">Failed to load infrastructure metrics</p>
                    <button 
                      className="mt-3 inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
                      onClick={fetchInfrastructureMetrics}
                    >
                      Try Again
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        );
      
      case 'logs':
        return (
          <div className="bg-white shadow rounded-lg overflow-hidden">
            <div className="px-4 py-5 sm:px-6 border-b border-gray-200">
              <h3 className="text-lg font-medium leading-6 text-gray-900">System Logs</h3>
              <div className="mt-1 flex justify-between items-center">
                <p className="text-sm text-gray-500">Showing {logs.length} of {totalLogs} logs</p>
                <div className="flex space-x-2">
                  <button
                    type="button"
                    onClick={() => fetchLogs()}
                    className="inline-flex items-center p-1.5 border border-gray-300 rounded-md text-gray-700 bg-white hover:bg-gray-50"
                  >
                    <RefreshIcon className="h-5 w-5" />
                  </button>
                  <button
                    type="button"
                    className="inline-flex items-center p-1.5 border border-gray-300 rounded-md text-gray-700 bg-white hover:bg-gray-50"
                  >
                    <DownloadIcon className="h-5 w-5" />
                  </button>
                </div>
              </div>
            </div>

            {/* Filters */}
            <div className="px-4 py-3 border-b border-gray-200 bg-gray-50">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Log Level Filter */}
                <div>
                  <label htmlFor="level" className="block text-xs font-medium text-gray-500">Log Level</label>
                  <select
                    id="level"
                    name="level"
                    className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md"
                    value={filters.level || 'all'}
                    onChange={(e: SelectChangeEvent) => handleFilterChange('level', e.target.value === 'all' ? undefined : e.target.value)}
                  >
                    <option value="all">All Levels</option>
                    <option value="error">Error</option>
                    <option value="warn">Warning</option>
                    <option value="info">Info</option>
                    <option value="debug">Debug</option>
                  </select>
                </div>

                {/* Module Filter */}
                <div>
                  <label htmlFor="module" className="block text-xs font-medium text-gray-500">Module</label>
                  <select
                    id="module"
                    name="module"
                    className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md"
                    value={filters.module || ''}
                    onChange={(e: SelectChangeEvent) => handleFilterChange('module', e.target.value || undefined)}
                  >
                    <option value="">All Modules</option>
                    {availableModules.map((module: string) => (
                      <option key={module} value={module}>{module}</option>
                    ))}
                  </select>
                </div>

                {/* Date Range */}
                <div>
                  <label htmlFor="startDate" className="block text-xs font-medium text-gray-500">Start Date</label>
                  <input
                    type="datetime-local"
                    id="startDate"
                    name="startDate"
                    className="mt-1 block w-full border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md"
                    value={filters.startDate?.toISOString().slice(0, 16) || ''}
                    onChange={(e: InputChangeEvent) => handleFilterChange('startDate', e.target.value ? new Date(e.target.value) : undefined)}
                  />
                </div>

                <div>
                  <label htmlFor="endDate" className="block text-xs font-medium text-gray-500">End Date</label>
                  <input
                    type="datetime-local"
                    id="endDate"
                    name="endDate"
                    className="mt-1 block w-full border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md"
                    value={filters.endDate?.toISOString().slice(0, 16) || ''}
                    onChange={(e: InputChangeEvent) => handleFilterChange('endDate', e.target.value ? new Date(e.target.value) : undefined)}
                  />
                </div>

                {/* Search */}
                <div className="sm:col-span-2">
                  <label htmlFor="search" className="block text-xs font-medium text-gray-500">Search</label>
                  <div className="mt-1 relative rounded-md shadow-sm">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <SearchIcon className="h-5 w-5 text-gray-400" />
                    </div>
                    <input
                      type="text"
                      name="search"
                      id="search"
                      className="focus:ring-blue-500 focus:border-blue-500 block w-full pl-10 sm:text-sm border-gray-300 rounded-md"
                      placeholder="Search logs by message or context..."
                      value={filters.searchText || ''}
                      onChange={(e: InputChangeEvent) => handleFilterChange('searchText', e.target.value || undefined)}
                    />
                  </div>
                </div>

                {/* Limit */}
                <div>
                  <label htmlFor="limit" className="block text-xs font-medium text-gray-500">Logs Per Page</label>
                  <select
                    id="limit"
                    name="limit"
                    className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md"
                    value={filters.limit || 100}
                    onChange={(e: SelectChangeEvent) => handleFilterChange('limit', parseInt(e.target.value))}
                  >
                    <option value="20">20</option>
                    <option value="50">50</option>
                    <option value="100">100</option>
                    <option value="200">200</option>
                    <option value="500">500</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Logs Table */}
            <div className="px-4 py-5 sm:p-6 bg-white">
              {loading ? (
                <div className="flex justify-center items-center h-64">
                  <div className="text-center">
                    <svg className="animate-spin h-8 w-8 text-gray-400 mx-auto mb-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <p className="text-sm text-gray-500">Loading logs...</p>
                  </div>
                </div>
              ) : error ? (
                <div className="flex justify-center items-center h-64">
                  <div className="text-center">
                    <ExclamationIcon className="h-8 w-8 text-red-500 mx-auto mb-2" />
                    <p className="text-sm text-gray-500">Error: {error}</p>
                    <button
                      type="button"
                      onClick={() => fetchLogs()}
                      className="mt-3 inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
                    >
                      Try Again
                    </button>
                  </div>
                </div>
              ) : logs.length === 0 ? (
                <div className="flex justify-center items-center h-64">
                  <div className="text-center">
                    <InformationCircleIcon className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                    <p className="text-sm text-gray-500">No logs found matching your filters</p>
                  </div>
                </div>
              ) : (
                <div className="overflow-x-auto -mx-4 sm:-mx-6">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Timestamp
                        </th>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Level
                        </th>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Module
                        </th>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Message
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {logs.map((log) => (
                        <tr 
                          key={log.id} 
                          className="cursor-pointer hover:bg-gray-50"
                          onClick={() => {
                            // Implementation for detailed view (modal or expandable row)
                            console.log('View log details:', log);
                          }}
                        >
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {formatDate(log.timestamp)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${getLevelColor(log.level)}`}>
                              {log.level.toUpperCase()}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {log.module || 'Unknown'}
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-900 max-w-md truncate">
                            {log.message}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="px-4 py-3 flex items-center justify-between border-t border-gray-200 sm:px-6">
                <div className="flex-1 flex justify-between sm:hidden">
                  <button
                    onClick={() => handlePaginationChange(currentPage - 1)}
                    disabled={currentPage === 1}
                    className={`relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white ${currentPage === 1 ? 'opacity-50 cursor-not-allowed' : 'hover:bg-gray-50'}`}
                  >
                    Previous
                  </button>
                  <button
                    onClick={() => handlePaginationChange(currentPage + 1)}
                    disabled={currentPage === totalPages}
                    className={`ml-3 relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white ${currentPage === totalPages ? 'opacity-50 cursor-not-allowed' : 'hover:bg-gray-50'}`}
                  >
                    Next
                  </button>
                </div>
                <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm text-gray-700">
                      Showing <span className="font-medium">{Math.min((filters.skip || 0) + 1, totalLogs)}</span> to <span className="font-medium">{Math.min((filters.skip || 0) + logs.length, totalLogs)}</span> of <span className="font-medium">{totalLogs}</span> results
                    </p>
                  </div>
                  <div>
                    <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px" aria-label="Pagination">
                      <button
                        onClick={() => handlePaginationChange(currentPage - 1)}
                        disabled={currentPage === 1}
                        className={`relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 ${currentPage === 1 ? 'opacity-50 cursor-not-allowed' : 'hover:bg-gray-50'}`}
                      >
                        <span className="sr-only">Previous</span>
                        <svg className="h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                          <path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                      </button>
                      {pagination.map(page => (
                        <button
                          key={page}
                          onClick={() => handlePaginationChange(page)}
                          className={`relative inline-flex items-center px-4 py-2 border text-sm font-medium ${
                            page === currentPage 
                              ? 'z-10 bg-blue-50 border-blue-500 text-blue-600' 
                              : 'bg-white border-gray-300 text-gray-500 hover:bg-gray-50'
                          }`}
                        >
                          {page}
                        </button>
                      ))}
                      <button
                        onClick={() => handlePaginationChange(currentPage + 1)}
                        disabled={currentPage === totalPages}
                        className={`relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 ${currentPage === totalPages ? 'opacity-50 cursor-not-allowed' : 'hover:bg-gray-50'}`}
                      >
                        <span className="sr-only">Next</span>
                        <svg className="h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                          <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                        </svg>
                      </button>
                    </nav>
                  </div>
                </div>
              </div>
            )}
          </div>
        );
        
      default:
        return null;
    }
  };

  return (
    <Layout title="System Monitoring">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-gray-800">System Monitoring</h1>
        <p className="text-gray-600">Monitor system health, logs, and errors in real time.</p>
        
        {/* Monitoring Navigation Tabs */}
        <div className="mt-4 border-b border-gray-200">
          <nav className="-mb-px flex space-x-8">
            <button 
              className={`${
                activeTab === 'overview' 
                  ? 'border-blue-500 text-blue-600' 
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
              onClick={() => setActiveTab('overview')}
            >
              Overview
            </button>
            <button 
              className={`${
                activeTab === 'services' 
                  ? 'border-blue-500 text-blue-600' 
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
              onClick={() => setActiveTab('services')}
            >
              Service Metrics
            </button>
            <button 
              className={`${
                activeTab === 'ml' 
                  ? 'border-blue-500 text-blue-600' 
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
              onClick={() => setActiveTab('ml')}
            >
              ML Performance
            </button>
            <button 
              className={`${
                activeTab === 'realtime' 
                  ? 'border-blue-500 text-blue-600' 
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
              onClick={() => setActiveTab('realtime')}
            >
              Realtime Events
            </button>
            <button 
              className={`${
                activeTab === 'infrastructure' 
                  ? 'border-blue-500 text-blue-600' 
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
              onClick={() => setActiveTab('infrastructure')}
            >
              Infrastructure
            </button>
            <button 
              className={`${
                activeTab === 'logs' 
                  ? 'border-blue-500 text-blue-600' 
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
              onClick={() => setActiveTab('logs')}
            >
              Logs
            </button>
          </nav>
        </div>
      </div>

      {/* Render content based on active tab */}
      {renderTabContent()}
    </Layout>
  );
}