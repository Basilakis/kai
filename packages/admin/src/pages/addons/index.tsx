import React, { useState } from 'react';
import Layout from '../../components/Layout';
import { 
import { 
  PuzzleIcon, 
  GlobeAltIcon, 
  CogIcon, 
  SwitchHorizontalIcon,
  CheckCircleIcon,
  XCircleIcon,
  RefreshIcon,
  ChartBarIcon,
  ClockIcon,
  ExclamationCircleIcon,
  EyeIcon,
  PauseIcon,
  StopIcon
} from '@heroicons/react/outline';
  StopIcon
} from '@heroicons/react/outline';

/**
 * Addons Management Page
 */
export default function Addons() {
  // Mock addons data
  const [addons, setAddons] = useState([
    { 
      id: 1, 
      name: 'Web Crawler', 
      description: 'Automatically crawl websites to collect tile data',
      icon: GlobeAltIcon,
      enabled: true,
      status: 'Active',
      lastRun: '2023-03-18 14:00:00',
      providers: ['FireCrawl.dev', 'Jina.ai'],
      activeJobs: 1,
      completedJobs: 2
    },
    { 
      id: 2, 
      name: 'Email Notifications', 
      description: 'Send email notifications for important system events',
      icon: SwitchHorizontalIcon,
      enabled: true,
      status: 'Active',
      lastRun: '2023-03-19 09:30:00',
      providers: ['AWS SES'],
      activeJobs: 0,
      completedJobs: 156
    },
    { 
      id: 3, 
      name: 'Data Export', 
      description: 'Export material data to various formats (CSV, JSON, Excel)',
      icon: ChartBarIcon,
      enabled: false,
      status: 'Inactive',
      lastRun: '2023-03-10 11:45:00',
      providers: ['Internal'],
      activeJobs: 0,
      completedJobs: 12
    },
    { 
      id: 4, 
      name: 'Scheduled Backups', 
      description: 'Automatically backup system data on a schedule',
      icon: ClockIcon,
      enabled: true,
      status: 'Active',
      lastRun: '2023-03-19 01:00:00',
      providers: ['AWS S3'],
      activeJobs: 0,
      completedJobs: 45
    }
  ]);

  // Mock crawler jobs (for the Web Crawler addon)
  const [crawlerJobs, setCrawlerJobs] = useState([
    { 
      id: 1, 
      addonId: 1,
      configName: 'Tile Manufacturer Sites',
      provider: 'FireCrawl.dev',
      startTime: '2023-03-15 08:00:00',
      endTime: '2023-03-15 09:45:00',
      status: 'Completed',
      pagesProcessed: 245,
      itemsExtracted: 156,
      errors: 0
    },
    { 
      id: 2, 
      addonId: 1,
      configName: 'Ceramic Suppliers',
      provider: 'Jina.ai',
      startTime: '2023-03-10 10:30:00',
      endTime: '2023-03-10 11:15:00',
      status: 'Completed',
      pagesProcessed: 132,
      itemsExtracted: 89,
      errors: 2
    },
    { 
      id: 3, 
      addonId: 1,
      configName: 'Stone Product Catalogs',
      provider: 'FireCrawl.dev',
      startTime: '2023-03-18 14:00:00',
      endTime: null,
      status: 'In Progress',
      pagesProcessed: 87,
      itemsExtracted: 42,
      errors: 1
    }
  ]);

  // Active tab state
  const [activeTab, setActiveTab] = useState('addons');
  
  // Selected addon for configuration
  const [selectedAddon, setSelectedAddon] = useState<number | null>(null);

  // Toggle addon enabled state
  const toggleAddonEnabled = (id: number) => {
    setAddons(addons.map(addon => 
      addon.id === id 
        ? { 
            ...addon, 
            enabled: !addon.enabled,
            status: !addon.enabled ? 'Active' : 'Inactive'
          } 
        : addon
    ));
  };

  // Get status badge color
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Active':
      case 'Completed':
        return 'bg-green-100 text-green-800';
      case 'In Progress':
        return 'bg-blue-100 text-blue-800';
      case 'Inactive':
        return 'bg-gray-100 text-gray-500';
      case 'Failed':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  // Get status icon
  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'Active':
      case 'Completed':
        return <CheckCircleIcon className="h-5 w-5 text-green-500" />;
      case 'In Progress':
        return <RefreshIcon className="h-5 w-5 text-blue-500" />;
      case 'Inactive':
        return <XCircleIcon className="h-5 w-5 text-gray-500" />;
      case 'Failed':
        return <ExclamationCircleIcon className="h-5 w-5 text-red-500" />;
      default:
        return null;
    }
  };

  // Configure addon
  const configureAddon = (id: number) => {
    setSelectedAddon(id);
    setActiveTab('configuration');
  };

  // View addon jobs
  const viewAddonJobs = (id: number) => {
    setSelectedAddon(id);
    setActiveTab('jobs');
  };

  // Get selected addon
  const getSelectedAddon = () => {
    return addons.find(addon => addon.id === selectedAddon);
  };

  // Get jobs for selected addon
  const getAddonJobs = () => {
    return crawlerJobs.filter(job => job.addonId === selectedAddon);
  };

  return (
    <Layout title="Addons Management">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-gray-800">Addons Management</h1>
        <p className="text-gray-600">Manage and configure system add-on modules.</p>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 mb-6">
        <nav className="-mb-px flex space-x-8">
          <button
            className={`${
              activeTab === 'addons'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
            onClick={() => setActiveTab('addons')}
          >
            Available Addons
          </button>
          {selectedAddon && (
            <>
              <button
                className={`${
                  activeTab === 'configuration'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
                onClick={() => setActiveTab('configuration')}
              >
                Configuration
              </button>
              <button
                className={`${
                  activeTab === 'jobs'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
                onClick={() => setActiveTab('jobs')}
              >
                Jobs
              </button>
            </>
          )}
        </nav>
      </div>

      {/* Addons List Tab */}
      {activeTab === 'addons' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {addons.map((addon) => (
            <div key={addon.id} className="bg-white rounded-lg shadow overflow-hidden">
              <div className="p-6">
                <div className="flex items-center">
                  <div className={`p-3 rounded-md ${addon.enabled ? 'bg-blue-100' : 'bg-gray-100'}`}>
                    <addon.icon className={`h-6 w-6 ${addon.enabled ? 'text-blue-600' : 'text-gray-500'}`} />
                  </div>
                  <div className="ml-4">
                    <h3 className="text-lg font-medium text-gray-900">{addon.name}</h3>
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(addon.status)}`}>
                      {addon.status}
                    </span>
                  </div>
                </div>
                <div className="mt-4">
                  <p className="text-sm text-gray-500">{addon.description}</p>
                </div>
                <div className="mt-4">
                  <div className="flex items-center text-sm text-gray-500">
                    <span className="font-medium">Providers:</span>
                    <span className="ml-2">{addon.providers.join(', ')}</span>
                  </div>
                  {addon.lastRun && (
                    <div className="flex items-center text-sm text-gray-500 mt-1">
                      <span className="font-medium">Last Run:</span>
                      <span className="ml-2">{addon.lastRun}</span>
                    </div>
                  )}
                  {addon.activeJobs > 0 && (
                    <div className="flex items-center text-sm text-blue-500 mt-1">
                      <span className="font-medium">Active Jobs:</span>
                      <span className="ml-2">{addon.activeJobs}</span>
                    </div>
                  )}
                </div>
                <div className="mt-6 flex items-center justify-between">
                  <div>
                    <label className="inline-flex items-center cursor-pointer">
                      <span className="mr-3 text-sm font-medium text-gray-700">Enabled</span>
                      <div className="relative">
                        <input 
                          type="checkbox" 
                          className="sr-only peer" 
                          checked={addon.enabled}
                          onChange={() => toggleAddonEnabled(addon.id)}
                        />
                        <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                      </div>
                    </label>
                  </div>
                  <div className="flex space-x-2">
                    <button
                      className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                      onClick={() => configureAddon(addon.id)}
                    >
                      <CogIcon className="h-4 w-4 mr-1" />
                      Configure
                    </button>
                    {addon.id === 1 && ( // Only show for Web Crawler addon
                      <button
                        className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                        onClick={() => viewAddonJobs(addon.id)}
                      >
                        <ClockIcon className="h-4 w-4 mr-1" />
                        Jobs
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Configuration Tab */}
      {activeTab === 'configuration' && selectedAddon && (
        <div className="bg-white shadow overflow-hidden sm:rounded-lg">
          <div className="px-4 py-5 sm:px-6">
            <h3 className="text-lg leading-6 font-medium text-gray-900">
              {getSelectedAddon()?.name} Configuration
            </h3>
            <p className="mt-1 max-w-2xl text-sm text-gray-500">
              Configure settings for the {getSelectedAddon()?.name} addon.
            </p>
          </div>

          {/* Web Crawler Configuration */}
          {selectedAddon === 1 && (
            <div className="border-t border-gray-200">
              <dl>
                <div className="bg-gray-50 px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                  <dt className="text-sm font-medium text-gray-500">FireCrawl.dev API Key</dt>
                  <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">
                    <div className="flex items-center">
                      <input
                        type="password"
                        value="••••••••••••••••"
                        readOnly
                        className="flex-grow mr-2 shadow-sm focus:ring-blue-500 focus:border-blue-500 block w-full sm:text-sm border-gray-300 rounded-md"
                      />
                      <button
                        type="button"
                        className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                      >
                        Update
                      </button>
                    </div>
                  </dd>
                </div>
                <div className="bg-white px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                  <dt className="text-sm font-medium text-gray-500">FireCrawl.dev Endpoint</dt>
                  <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">
                    <div className="flex items-center">
                      <input
                        type="text"
                        value="https://api.firecrawl.dev/v1"
                        readOnly
                        className="flex-grow mr-2 shadow-sm focus:ring-blue-500 focus:border-blue-500 block w-full sm:text-sm border-gray-300 rounded-md"
                      />
                      <button
                        type="button"
                        className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                      >
                        Update
                      </button>
                    </div>
                  </dd>
                </div>
                <div className="bg-gray-50 px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                  <dt className="text-sm font-medium text-gray-500">Jina.ai API Key</dt>
                  <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">
                    <div className="flex items-center">
                      <input
                        type="password"
                        value="••••••••••••••••"
                        readOnly
                        className="flex-grow mr-2 shadow-sm focus:ring-blue-500 focus:border-blue-500 block w-full sm:text-sm border-gray-300 rounded-md"
                      />
                      <button
                        type="button"
                        className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                      >
                        Update
                      </button>
                    </div>
                  </dd>
                </div>
                <div className="bg-white px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                  <dt className="text-sm font-medium text-gray-500">Default Crawl Depth</dt>
                  <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">
                    <div className="flex items-center">
                      <input
                        type="number"
                        value="3"
                        min="1"
                        max="10"
                        className="flex-grow mr-2 shadow-sm focus:ring-blue-500 focus:border-blue-500 block w-full sm:text-sm border-gray-300 rounded-md"
                      />
                      <button
                        type="button"
                        className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                      >
                        Save
                      </button>
                    </div>
                  </dd>
                </div>
                <div className="bg-gray-50 px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                  <dt className="text-sm font-medium text-gray-500">Rate Limiting (requests/minute)</dt>
                  <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">
                    <div className="flex items-center">
                      <input
                        type="number"
                        value="60"
                        min="10"
                        max="300"
                        className="flex-grow mr-2 shadow-sm focus:ring-blue-500 focus:border-blue-500 block w-full sm:text-sm border-gray-300 rounded-md"
                      />
                      <button
                        type="button"
                        className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                      >
                        Save
                      </button>
                    </div>
                  </dd>
                </div>
                <div className="bg-white px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                  <dt className="text-sm font-medium text-gray-500">Crawling Schedule</dt>
                  <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">
                    <div className="flex items-center">
                      <select
                        className="flex-grow mr-2 shadow-sm focus:ring-blue-500 focus:border-blue-500 block w-full sm:text-sm border-gray-300 rounded-md"
                      >
                        <option value="daily">Daily</option>
                        <option value="weekly" selected>Weekly</option>
                        <option value="biweekly">Bi-weekly</option>
                        <option value="monthly">Monthly</option>
                      </select>
                      <button
                        type="button"
                        className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                      >
                        Save
                      </button>
                    </div>
                  </dd>
                </div>
              </dl>
            </div>
          )}

          {/* Email Notifications Configuration */}
          {selectedAddon === 2 && (
            <div className="border-t border-gray-200">
              <dl>
                <div className="bg-gray-50 px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                  <dt className="text-sm font-medium text-gray-500">AWS SES API Key</dt>
                  <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">
                    <div className="flex items-center">
                      <input
                        type="password"
                        value="••••••••••••••••"
                        readOnly
                        className="flex-grow mr-2 shadow-sm focus:ring-blue-500 focus:border-blue-500 block w-full sm:text-sm border-gray-300 rounded-md"
                      />
                      <button
                        type="button"
                        className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                      >
                        Update
                      </button>
                    </div>
                  </dd>
                </div>
                <div className="bg-white px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                  <dt className="text-sm font-medium text-gray-500">Sender Email</dt>
                  <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">
                    <div className="flex items-center">
                      <input
                        type="email"
                        value="notifications@example.com"
                        className="flex-grow mr-2 shadow-sm focus:ring-blue-500 focus:border-blue-500 block w-full sm:text-sm border-gray-300 rounded-md"
                      />
                      <button
                        type="button"
                        className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                      >
                        Save
                      </button>
                    </div>
                  </dd>
                </div>
              </dl>
            </div>
          )}

          {/* Other addons would have their own configuration sections here */}
        </div>
      )}

      {/* Jobs Tab (for Web Crawler) */}
      {activeTab === 'jobs' && selectedAddon === 1 && (
        <div className="bg-white shadow overflow-hidden sm:rounded-lg">
          <div className="px-4 py-5 sm:px-6 flex justify-between items-center">
            <div>
              <h3 className="text-lg leading-6 font-medium text-gray-900">Web Crawler Jobs</h3>
              <p className="mt-1 max-w-2xl text-sm text-gray-500">
                View and manage web crawler jobs.
              </p>
            </div>
            <button
              type="button"
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              New Crawl Job
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Job
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Provider
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Start Time
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Progress
                  </th>
                  <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {getAddonJobs().map((job) => (
                  <tr key={job.id}>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="flex-shrink-0">
                          {getStatusIcon(job.status)}
                        </div>
                        <div className="ml-4">
                          <div className="text-sm font-medium text-gray-900">{job.configName}</div>
                          <div className="text-xs text-gray-500">
                            {job.status === 'Completed' 
                              ? `Extracted ${job.itemsExtracted} items` 
                              : job.status === 'In Progress' 
                                ? `Processing pages...` 
                                : 'Waiting to start'}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{job.provider}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{job.startTime}</div>
                      {job.endTime && (
                        <div className="text-xs text-gray-500">Ended: {job.endTime}</div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusColor(job.status)}`}>
                        {job.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">
                        {job.status === 'Completed' 
                          ? `${job.pagesProcessed} pages` 
                          : job.status === 'In Progress' 
                            ? `${job.pagesProcessed} pages so far` 
                            : '-'}
                      </div>
                      {job.errors > 0 && (
                        <div className="text-xs text-red-500">{job.errors} errors</div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      {job.status === 'In Progress' && (
                        <>
                          <button
                            className="text-yellow-600 hover:text-yellow-900 mr-3"
                            title="Pause job"
                          >
                            <PauseIcon className="h-5 w-5" />
                          </button>
                          <button
                            className="text-red-600 hover:text-red-900"
                            title="Stop job"
                          >
                            <StopIcon className="h-5 w-5" />
                          </button>
                        </>
                      )}
                      {job.status === 'Completed' && (
                        <button
                          className="text-blue-600 hover:text-blue-900"
                          title="View results"
                        >
                          <EyeIcon className="h-5 w-5" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </Layout>
  );
}