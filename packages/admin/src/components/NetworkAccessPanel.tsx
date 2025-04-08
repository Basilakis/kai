import React, { useState, useEffect } from 'react';
import { 
  PlusIcon, 
  TrashIcon,
  ShieldCheckIcon,
  GlobeIcon,
  ServerIcon
} from '@heroicons/react/outline';

/**
 * Network Access Panel
 * 
 * Admin panel for configuring network access controls, including:
 * - Internal network CIDR ranges
 * - API endpoint access restrictions (internal/external)
 */
const NetworkAccessPanel: React.FC = () => {
  // State for internal network CIDRs
  const [internalNetworks, setInternalNetworks] = useState<string[]>([
    '127.0.0.1/8',
    '10.0.0.0/8',
    '172.16.0.0/12',
    '192.168.0.0/16'
  ]);
  
  // State for new CIDR input
  const [newCidr, setNewCidr] = useState('');
  const [newCidrError, setNewCidrError] = useState('');
  
  // State for default rate limit
  const [defaultRateLimit, setDefaultRateLimit] = useState(30);
  
  // State for custom rate limits
  const [customRateLimits, setCustomRateLimits] = useState<Array<{
    network: string;
    description: string;
    requestsPerMinute: number;
  }>>([
    {
      network: '10.0.0.0/8',
      description: 'Internal Network',
      requestsPerMinute: 300
    },
    {
      network: '203.0.113.0/24',
      description: 'Office Network',
      requestsPerMinute: 100
    },
    {
      network: '8.8.8.8',
      description: 'Specific External IP',
      requestsPerMinute: 10
    }
  ]);
  
  // State for new custom rate limit
  const [newRateLimit, setNewRateLimit] = useState({
    network: '',
    description: '',
    requestsPerMinute: 50
  });
  const [newRateLimitError, setNewRateLimitError] = useState('');
  
  // State for API endpoints table
  const [endpoints, setEndpoints] = useState<Array<{
    path: string;
    method: string;
    description: string;
    allowInternal: boolean;
    allowExternal: boolean;
  }>>([
    // Mock data - in a real app this would come from an API
    { 
      path: '/api/admin/analytics/events', 
      method: 'GET', 
      description: 'Get analytics events', 
      allowInternal: true, 
      allowExternal: true 
    },
    { 
      path: '/api/admin/analytics/trends', 
      method: 'GET', 
      description: 'Get analytics trends', 
      allowInternal: true, 
      allowExternal: true 
    },
    { 
      path: '/api/admin/analytics/data', 
      method: 'DELETE', 
      description: 'Clear analytics data', 
      allowInternal: true, 
      allowExternal: false 
    },
    { 
      path: '/api/admin/settings', 
      method: 'PUT', 
      description: 'Update system settings', 
      allowInternal: true, 
      allowExternal: false 
    },
    { 
      path: '/api/admin/training/:jobId/stop', 
      method: 'POST', 
      description: 'Stop ML training job', 
      allowInternal: true, 
      allowExternal: false 
    },
    { 
      path: '/api/recognition', 
      method: 'POST', 
      description: 'Recognize material', 
      allowInternal: true, 
      allowExternal: true 
    },
    { 
      path: '/api/materials', 
      method: 'GET', 
      description: 'Get all materials', 
      allowInternal: true, 
      allowExternal: true 
    }
  ]);
  
  // For search and filtering the endpoints table
  const [searchTerm, setSearchTerm] = useState('');
  const [filterInternal, setFilterInternal] = useState(false);
  const [filterExternal, setFilterExternal] = useState(false);
  
  // Validate CIDR format
  const validateCidr = (cidr: string): boolean => {
    // Basic CIDR validation regex
    const cidrRegex = /^([0-9]{1,3}\.){3}[0-9]{1,3}\/([0-9]|[1-2][0-9]|3[0-2])$/;
    if (!cidrRegex.test(cidr)) {
      setNewCidrError('Invalid CIDR format. Example: 192.168.1.0/24');
      return false;
    }
    
    // Validate IP address part
    const ipPart = cidr.split('/')[0];
    const octets = ipPart.split('.');
    for (const octet of octets) {
      const num = parseInt(octet, 10);
      if (num < 0 || num > 255) {
        setNewCidrError('IP address octets must be between 0 and 255');
        return false;
      }
    }
    
    setNewCidrError('');
    return true;
  };
  
  // Add new CIDR range
  const addInternalNetwork = () => {
    if (!newCidr.trim()) {
      setNewCidrError('CIDR cannot be empty');
      return;
    }
    
    if (!validateCidr(newCidr)) {
      return;
    }
    
    if (internalNetworks.includes(newCidr)) {
      setNewCidrError('This CIDR range is already in the list');
      return;
    }
    
    setInternalNetworks([...internalNetworks, newCidr]);
    setNewCidr('');
  };
  
  // Remove CIDR range
  const removeInternalNetwork = (cidr: string) => {
    setInternalNetworks(internalNetworks.filter(network => network !== cidr));
  };
  
  // Toggle endpoint access
  const toggleEndpointAccess = (index: number, field: 'allowInternal' | 'allowExternal') => {
    const updatedEndpoints = [...endpoints];
    updatedEndpoints[index][field] = !updatedEndpoints[index][field];
    setEndpoints(updatedEndpoints);
  };
  
  // Filter endpoints based on search term and filters
  const filteredEndpoints = endpoints.filter(endpoint => {
    const matchesSearch = 
      endpoint.path.toLowerCase().includes(searchTerm.toLowerCase()) ||
      endpoint.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
      endpoint.method.toLowerCase().includes(searchTerm.toLowerCase());
      
    const matchesInternal = !filterInternal || endpoint.allowInternal;
    const matchesExternal = !filterExternal || endpoint.allowExternal;
    
    return matchesSearch && matchesInternal && matchesExternal;
  });
  
  // Add new custom rate limit
  const addCustomRateLimit = () => {
    if (!newRateLimit.network.trim()) {
      setNewRateLimitError('Network address/CIDR cannot be empty');
      return;
    }
    
    if (!newRateLimit.description.trim()) {
      setNewRateLimitError('Description cannot be empty');
      return;
    }
    
    // Validate network (either CIDR or single IP)
    if (!validateCidr(newRateLimit.network) && !validateIpAddress(newRateLimit.network)) {
      setNewRateLimitError('Invalid IP address or CIDR format');
      return;
    }
    
    // Check if already exists
    if (customRateLimits.some(item => item.network === newRateLimit.network)) {
      setNewRateLimitError('This network already has a custom rate limit');
      return;
    }
    
    // Add to list
    setCustomRateLimits([...customRateLimits, { ...newRateLimit }]);
    
    // Reset form
    setNewRateLimit({
      network: '',
      description: '',
      requestsPerMinute: 50
    });
    setNewRateLimitError('');
  };
  
  // Remove custom rate limit
  const removeCustomRateLimit = (network: string) => {
    setCustomRateLimits(customRateLimits.filter(item => item.network !== network));
  };
  
  // Validate single IP address
  const validateIpAddress = (ip: string): boolean => {
    const ipRegex = /^([0-9]{1,3}\.){3}[0-9]{1,3}$/;
    if (!ipRegex.test(ip)) {
      return false;
    }
    
    const octets = ip.split('.');
    for (const octet of octets) {
      const num = parseInt(octet, 10);
      if (num < 0 || num > 255) {
        return false;
      }
    }
    
    return true;
  };
  
  // Handle rate limit form change
  const handleRateLimitFormChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
    field: keyof typeof newRateLimit
  ) => {
    const value = e.target.type === 'number' 
      ? Math.max(1, parseInt(e.target.value, 10) || 1) 
      : e.target.value;
      
    setNewRateLimit({
      ...newRateLimit,
      [field]: value
    });
    
    // Clear error when user types
    if (newRateLimitError) {
      setNewRateLimitError('');
    }
  };
  
  // Save networks, endpoints, and rate limits configuration
  const saveNetworkSettings = () => {
    // In a real app, this would send data to the server
    console.log('Saving network settings:', {
      internalNetworks,
      endpoints,
      defaultRateLimit,
      customRateLimits
    });
    
    // Mock success message
    alert('Network settings saved successfully!');
  };
  
  return (
    <div className="px-6 py-6 space-y-8">
      {/* Internal Networks Section */}
      <div className="space-y-4">
        <h3 className="text-lg font-medium text-gray-900">Internal Networks</h3>
        <p className="text-sm text-gray-500">
          Define CIDR ranges that should be considered internal networks. Requests from these networks will have access to internal-only endpoints.
        </p>
        
        {/* Current CIDR Ranges */}
        <div className="mt-4 space-y-2">
          {internalNetworks.map((cidr, index) => (
            <div key={index} className="flex justify-between items-center p-2 bg-gray-50 rounded-md">
              <div className="flex items-center">
                <ServerIcon className="h-5 w-5 text-blue-500 mr-2" />
                <span className="font-mono text-sm">{cidr}</span>
              </div>
              <button
                type="button"
                onClick={() => removeInternalNetwork(cidr)}
                className="text-red-500 hover:text-red-700"
                aria-label={`Remove ${cidr}`}
              >
                <TrashIcon className="h-5 w-5" />
              </button>
            </div>
          ))}
        </div>
        
        {/* Add New CIDR Range */}
        <div className="mt-4">
          <label htmlFor="new-cidr" className="block text-sm font-medium text-gray-700">
            Add Network Range (CIDR)
          </label>
          <div className="mt-1 flex rounded-md shadow-sm">
            <input
              type="text"
              name="new-cidr"
              id="new-cidr"
              className="focus:ring-blue-500 focus:border-blue-500 flex-1 block w-full rounded-l-md sm:text-sm border-gray-300"
              placeholder="192.168.1.0/24"
              value={newCidr}
              onChange={(e) => setNewCidr(e.target.value)}
            />
            <button
              type="button"
              onClick={addInternalNetwork}
              className="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-r-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              <PlusIcon className="h-4 w-4 mr-1" />
              Add
            </button>
          </div>
          {newCidrError && (
            <p className="mt-2 text-sm text-red-600" id="cidr-error">
              {newCidrError}
            </p>
          )}
        </div>
      </div>
      
      {/* API Endpoints Access Control Section */}
      <div className="mt-8 space-y-4">
        <h3 className="text-lg font-medium text-gray-900">API Endpoint Access Control</h3>
        <p className="text-sm text-gray-500">
          Configure which API endpoints can be accessed from internal or external networks. 
          Endpoints restricted to internal networks will only be accessible from the CIDR ranges defined above.
        </p>
        
        {/* Search and Filter */}
        <div className="flex items-center space-x-4">
          <div className="flex-1">
            <label htmlFor="search-endpoints" className="sr-only">
              Search Endpoints
            </label>
            <input
              type="text"
              name="search-endpoints"
              id="search-endpoints"
              className="shadow-sm focus:ring-blue-500 focus:border-blue-500 block w-full sm:text-sm border-gray-300 rounded-md"
              placeholder="Search endpoints..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          
          <div className="flex items-center space-x-2">
            <div className="flex items-center">
              <input
                id="filter-internal"
                name="filter-internal"
                type="checkbox"
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                checked={filterInternal}
                onChange={() => setFilterInternal(!filterInternal)}
              />
              <label htmlFor="filter-internal" className="ml-2 block text-sm text-gray-700">
                Internal Only
              </label>
            </div>
            
            <div className="flex items-center">
              <input
                id="filter-external"
                name="filter-external"
                type="checkbox"
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                checked={filterExternal}
                onChange={() => setFilterExternal(!filterExternal)}
              />
              <label htmlFor="filter-external" className="ml-2 block text-sm text-gray-700">
                External Allowed
              </label>
            </div>
          </div>
        </div>
        
        {/* Endpoints Table */}
        <div className="mt-4 flex flex-col">
          <div className="-my-2 overflow-x-auto sm:-mx-6 lg:-mx-8">
            <div className="py-2 align-middle inline-block min-w-full sm:px-6 lg:px-8">
              <div className="shadow overflow-hidden border-b border-gray-200 sm:rounded-lg">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Endpoint
                      </th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Method
                      </th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Description
                      </th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Internal Access
                      </th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        External Access
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {filteredEndpoints.map((endpoint, index) => (
                      <tr key={index}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          <code className="text-blue-600">{endpoint.path}</code>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            endpoint.method === 'GET' ? 'bg-green-100 text-green-800' :
                            endpoint.method === 'POST' ? 'bg-blue-100 text-blue-800' :
                            endpoint.method === 'PUT' ? 'bg-yellow-100 text-yellow-800' :
                            endpoint.method === 'DELETE' ? 'bg-red-100 text-red-800' :
                            'bg-gray-100 text-gray-800'
                          }`}>
                            {endpoint.method}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {endpoint.description}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          <div className="flex items-center">
                            <input
                              id={`internal-${index}`}
                              name={`internal-${index}`}
                              type="checkbox"
                              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                              checked={endpoint.allowInternal}
                              onChange={() => toggleEndpointAccess(index, 'allowInternal')}
                            />
                            <label htmlFor={`internal-${index}`} className="ml-2 text-sm text-gray-700">
                              {endpoint.allowInternal ? (
                                <ShieldCheckIcon className="h-5 w-5 text-green-500" />
                              ) : (
                                <ShieldCheckIcon className="h-5 w-5 text-gray-300" />
                              )}
                            </label>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          <div className="flex items-center">
                            <input
                              id={`external-${index}`}
                              name={`external-${index}`}
                              type="checkbox"
                              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                              checked={endpoint.allowExternal}
                              onChange={() => toggleEndpointAccess(index, 'allowExternal')}
                            />
                            <label htmlFor={`external-${index}`} className="ml-2 text-sm text-gray-700">
                              {endpoint.allowExternal ? (
                                <GlobeIcon className="h-5 w-5 text-green-500" />
                              ) : (
                                <GlobeIcon className="h-5 w-5 text-gray-300" />
                              )}
                            </label>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      {/* Rate Limits Section */}
      <div className="mt-8 space-y-4">
        <h3 className="text-lg font-medium text-gray-900">Rate Limiting</h3>
        <p className="text-sm text-gray-500">
          Configure rate limits for API requests. You can set a default rate limit for all requests,
          and custom rate limits for specific IP addresses or CIDR ranges.
        </p>
        
        {/* Default Rate Limit */}
        <div className="mt-4 p-4 bg-gray-50 rounded-md">
          <h4 className="text-md font-medium text-gray-800">Default Rate Limit</h4>
          <div className="mt-2 flex items-center">
            <div className="w-64">
              <label htmlFor="default-rate-limit" className="block text-sm font-medium text-gray-700">
                Requests per minute
              </label>
              <input
                type="number"
                name="default-rate-limit"
                id="default-rate-limit"
                min="1"
                className="mt-1 focus:ring-blue-500 focus:border-blue-500 block w-full sm:text-sm border-gray-300 rounded-md"
                value={defaultRateLimit}
                onChange={(e) => setDefaultRateLimit(Math.max(1, parseInt(e.target.value, 10) || 1))}
              />
            </div>
            <p className="ml-4 text-sm text-gray-500">
              Applied to all requests unless a custom rate limit is defined for the source IP.
            </p>
          </div>
        </div>
        
        {/* Custom Rate Limits */}
        <div className="mt-4">
          <h4 className="text-md font-medium text-gray-800">Custom Rate Limits</h4>
          
          {/* Add New Custom Rate Limit */}
          <div className="mt-2 p-4 bg-gray-50 rounded-md">
            <div className="grid grid-cols-1 gap-y-6 gap-x-4 sm:grid-cols-6">
              <div className="sm:col-span-2">
                <label htmlFor="new-rate-limit-network" className="block text-sm font-medium text-gray-700">
                  IP Address / CIDR Range
                </label>
                <input
                  type="text"
                  name="new-rate-limit-network"
                  id="new-rate-limit-network"
                  className="mt-1 focus:ring-blue-500 focus:border-blue-500 block w-full sm:text-sm border-gray-300 rounded-md"
                  placeholder="192.168.1.0/24 or 8.8.8.8"
                  value={newRateLimit.network}
                  onChange={(e) => handleRateLimitFormChange(e, 'network')}
                />
              </div>
              
              <div className="sm:col-span-2">
                <label htmlFor="new-rate-limit-description" className="block text-sm font-medium text-gray-700">
                  Description
                </label>
                <input
                  type="text"
                  name="new-rate-limit-description"
                  id="new-rate-limit-description"
                  className="mt-1 focus:ring-blue-500 focus:border-blue-500 block w-full sm:text-sm border-gray-300 rounded-md"
                  placeholder="Office Network"
                  value={newRateLimit.description}
                  onChange={(e) => handleRateLimitFormChange(e, 'description')}
                />
              </div>
              
              <div className="sm:col-span-1">
                <label htmlFor="new-rate-limit-rpm" className="block text-sm font-medium text-gray-700">
                  Requests/Minute
                </label>
                <input
                  type="number"
                  name="new-rate-limit-rpm"
                  id="new-rate-limit-rpm"
                  min="1"
                  className="mt-1 focus:ring-blue-500 focus:border-blue-500 block w-full sm:text-sm border-gray-300 rounded-md"
                  value={newRateLimit.requestsPerMinute}
                  onChange={(e) => handleRateLimitFormChange(e, 'requestsPerMinute')}
                />
              </div>
              
              <div className="sm:col-span-1 flex items-end">
                <button
                  type="button"
                  onClick={addCustomRateLimit}
                  className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                  <PlusIcon className="h-4 w-4 mr-1" />
                  Add
                </button>
              </div>
            </div>
            
            {newRateLimitError && (
              <p className="mt-2 text-sm text-red-600" id="rate-limit-error">
                {newRateLimitError}
              </p>
            )}
          </div>
          
          {/* Custom Rate Limits Table */}
          {customRateLimits.length > 0 && (
            <div className="mt-4 flex flex-col">
              <div className="-my-2 overflow-x-auto sm:-mx-6 lg:-mx-8">
                <div className="py-2 align-middle inline-block min-w-full sm:px-6 lg:px-8">
                  <div className="shadow overflow-hidden border-b border-gray-200 sm:rounded-lg">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Network
                          </th>
                          <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Description
                          </th>
                          <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Requests/Minute
                          </th>
                          <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Actions
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {customRateLimits.map((limit, index) => (
                          <tr key={index}>
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                              <code className="text-blue-600">{limit.network}</code>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              {limit.description}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              {limit.requestsPerMinute}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              <button
                                type="button"
                                onClick={() => removeCustomRateLimit(limit.network)}
                                className="text-red-500 hover:text-red-700"
                                aria-label={`Remove rate limit for ${limit.network}`}
                              >
                                <TrashIcon className="h-5 w-5" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
      
      {/* Save Button */}
      <div className="mt-8 flex justify-end">
        <button
          type="button"
          onClick={saveNetworkSettings}
          className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
        >
          Save Network Settings
        </button>
      </div>
    </div>
  );
};

export default NetworkAccessPanel;