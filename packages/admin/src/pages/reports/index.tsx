import React, { useState } from 'react';
import Layout from '../../components/Layout';
import { 
  ChartBarIcon, 
  ChartPieIcon, 
  ChartSquareBarIcon, 
  DocumentDownloadIcon,
  CalendarIcon,
  FilterIcon,
  RefreshIcon
} from '@heroicons/react/outline';

/**
 * Reports Page
 * Provides analytics and reporting functionality for the admin dashboard
 */
export default function Reports() {
  // Date range state
  const [dateRange, setDateRange] = useState({
    start: '2025-03-01',
    end: '2025-03-19'
  });

  // Report type state
  const [reportType, setReportType] = useState('system');

  // Mock report data
  const systemStats = {
    totalUploads: 128,
    totalRecognitions: 543,
    successRate: 92.4,
    avgProcessingTime: 2.3,
    storageUsed: 4.2,
    apiCalls: 12845,
    dailyActiveUsers: [
      { date: '2025-03-13', count: 42 },
      { date: '2025-03-14', count: 38 },
      { date: '2025-03-15', count: 29 },
      { date: '2025-03-16', count: 27 },
      { date: '2025-03-17', count: 45 },
      { date: '2025-03-18', count: 51 },
      { date: '2025-03-19', count: 48 }
    ],
    recognitionsByType: [
      { type: 'Feature-based', count: 312 },
      { type: 'ML-based', count: 156 },
      { type: 'Hybrid', count: 75 }
    ],
    catalogUsage: [
      { name: 'Italian Marble Collection 2025', count: 145 },
      { name: 'European Marble Collection 2025', count: 98 },
      { name: 'Natural Stone Collection 2025', count: 124 },
      { name: 'Wood Look Tiles 2025', count: 87 },
      { name: 'Ceramic Patterns 2025', count: 89 }
    ]
  };

  const userStats = {
    newUsers: 28,
    totalUsers: 342,
    activeUsers: 187,
    topUsers: [
      { name: 'John Smith', email: 'john@example.com', recognitions: 45 },
      { name: 'Maria Garcia', email: 'maria@example.com', recognitions: 37 },
      { name: 'David Lee', email: 'david@example.com', recognitions: 29 },
      { name: 'Sarah Johnson', email: 'sarah@example.com', recognitions: 24 },
      { name: 'Michael Brown', email: 'michael@example.com', recognitions: 21 }
    ],
    usersByRole: [
      { role: 'Admin', count: 5 },
      { role: 'Editor', count: 18 },
      { role: 'Viewer', count: 319 }
    ],
    userActivity: [
      { hour: '00:00', count: 5 },
      { hour: '03:00', count: 2 },
      { hour: '06:00', count: 8 },
      { hour: '09:00', count: 42 },
      { hour: '12:00', count: 37 },
      { hour: '15:00', count: 45 },
      { hour: '18:00', count: 29 },
      { hour: '21:00', count: 15 }
    ]
  };

  const materialStats = {
    totalMaterials: 1245,
    materialsByType: [
      { type: 'Natural Stone', count: 487 },
      { type: 'Ceramic', count: 356 },
      { type: 'Porcelain', count: 298 },
      { type: 'Glass', count: 104 }
    ],
    materialsByColor: [
      { color: 'White', count: 245 },
      { color: 'Beige', count: 198 },
      { color: 'Gray', count: 187 },
      { color: 'Black', count: 156 },
      { color: 'Brown', count: 143 },
      { color: 'Blue', count: 87 },
      { color: 'Other', count: 229 }
    ],
    mostRecognized: [
      { name: 'Carrara White Marble', count: 87 },
      { name: 'Nero Marquina', count: 65 },
      { name: 'Calacatta Gold', count: 58 },
      { name: 'Slate Black', count: 52 },
      { name: 'Travertine Beige', count: 47 }
    ]
  };

  // Handle date range change
  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setDateRange({
      ...dateRange,
      [name]: value
    });
  };

  // Handle report type change
  const handleReportTypeChange = (type: string) => {
    setReportType(type);
  };

  // Format number with commas
  const formatNumber = (num: number) => {
    return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  };

  // Get report data based on type
  const getReportData = () => {
    switch (reportType) {
      case 'system':
        return systemStats;
      case 'users':
        return userStats;
      case 'materials':
        return materialStats;
      default:
        return systemStats;
    }
  };

  const reportData = getReportData();

  return (
    <Layout title="Reports & Analytics">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-gray-800">Reports & Analytics</h1>
        <p className="text-gray-600">View system statistics and generate reports.</p>
      </div>

      {/* Controls */}
      <div className="bg-white shadow rounded-lg mb-6">
        <div className="p-4">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            {/* Date Range */}
            <div className="flex items-center space-x-4">
              <div>
                <label htmlFor="start" className="block text-sm font-medium text-gray-700">Start Date</label>
                <div className="mt-1 relative rounded-md shadow-sm">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <CalendarIcon className="h-5 w-5 text-gray-400" />
                  </div>
                  <input
                    type="date"
                    name="start"
                    id="start"
                    className="focus:ring-blue-500 focus:border-blue-500 block w-full pl-10 sm:text-sm border-gray-300 rounded-md"
                    value={dateRange.start}
                    onChange={handleDateChange}
                  />
                </div>
              </div>
              <div>
                <label htmlFor="end" className="block text-sm font-medium text-gray-700">End Date</label>
                <div className="mt-1 relative rounded-md shadow-sm">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <CalendarIcon className="h-5 w-5 text-gray-400" />
                  </div>
                  <input
                    type="date"
                    name="end"
                    id="end"
                    className="focus:ring-blue-500 focus:border-blue-500 block w-full pl-10 sm:text-sm border-gray-300 rounded-md"
                    value={dateRange.end}
                    onChange={handleDateChange}
                  />
                </div>
              </div>
            </div>

            {/* Report Type */}
            <div className="flex items-center space-x-2">
              <button
                type="button"
                className={`inline-flex items-center px-3 py-2 border ${reportType === 'system' ? 'border-blue-600 bg-blue-50 text-blue-600' : 'border-gray-300 bg-white text-gray-700'} shadow-sm text-sm leading-4 font-medium rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500`}
                onClick={() => handleReportTypeChange('system')}
              >
                <ChartBarIcon className="h-4 w-4 mr-2" />
                System
              </button>
              <button
                type="button"
                className={`inline-flex items-center px-3 py-2 border ${reportType === 'users' ? 'border-blue-600 bg-blue-50 text-blue-600' : 'border-gray-300 bg-white text-gray-700'} shadow-sm text-sm leading-4 font-medium rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500`}
                onClick={() => handleReportTypeChange('users')}
              >
                <ChartPieIcon className="h-4 w-4 mr-2" />
                Users
              </button>
              <button
                type="button"
                className={`inline-flex items-center px-3 py-2 border ${reportType === 'materials' ? 'border-blue-600 bg-blue-50 text-blue-600' : 'border-gray-300 bg-white text-gray-700'} shadow-sm text-sm leading-4 font-medium rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500`}
                onClick={() => handleReportTypeChange('materials')}
              >
                <ChartSquareBarIcon className="h-4 w-4 mr-2" />
                Materials
              </button>
            </div>

            {/* Export */}
            <div>
              <button
                type="button"
                className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                <DocumentDownloadIcon className="h-4 w-4 mr-2" />
                Export Report
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* System Stats */}
      {reportType === 'system' && (
        <div className="space-y-6">
          {/* Key Metrics */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="bg-white shadow rounded-lg p-6">
              <div className="flex items-center">
                <div className="flex-shrink-0 p-3 rounded-md bg-blue-100 text-blue-600">
                  <ChartBarIcon className="h-6 w-6" />
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">Total Uploads</dt>
                    <dd>
                      <div className="text-lg font-medium text-gray-900">{formatNumber(systemStats.totalUploads)}</div>
                    </dd>
                  </dl>
                </div>
              </div>
            </div>
            <div className="bg-white shadow rounded-lg p-6">
              <div className="flex items-center">
                <div className="flex-shrink-0 p-3 rounded-md bg-green-100 text-green-600">
                  <ChartBarIcon className="h-6 w-6" />
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">Total Recognitions</dt>
                    <dd>
                      <div className="text-lg font-medium text-gray-900">{formatNumber(systemStats.totalRecognitions)}</div>
                    </dd>
                  </dl>
                </div>
              </div>
            </div>
            <div className="bg-white shadow rounded-lg p-6">
              <div className="flex items-center">
                <div className="flex-shrink-0 p-3 rounded-md bg-yellow-100 text-yellow-600">
                  <ChartBarIcon className="h-6 w-6" />
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">Success Rate</dt>
                    <dd>
                      <div className="text-lg font-medium text-gray-900">{systemStats.successRate}%</div>
                    </dd>
                  </dl>
                </div>
              </div>
            </div>
            <div className="bg-white shadow rounded-lg p-6">
              <div className="flex items-center">
                <div className="flex-shrink-0 p-3 rounded-md bg-purple-100 text-purple-600">
                  <ChartBarIcon className="h-6 w-6" />
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">API Calls</dt>
                    <dd>
                      <div className="text-lg font-medium text-gray-900">{formatNumber(systemStats.apiCalls)}</div>
                    </dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>

          {/* Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white shadow rounded-lg p-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Daily Active Users</h3>
              <div className="h-64 bg-gray-50 rounded-lg p-4 flex items-end space-x-2">
                {systemStats.dailyActiveUsers.map((day) => {
                  const height = (day.count / 60) * 100;
                  return (
                    <div key={day.date} className="flex flex-col items-center flex-1">
                      <div 
                        className="w-full bg-blue-500 rounded-t"
                        style={{ height: `${height}%` }}
                      ></div>
                      <div className="text-xs text-gray-500 mt-2">{day.date.split('-')[2]}</div>
                    </div>
                  );
                })}
              </div>
            </div>
            <div className="bg-white shadow rounded-lg p-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Recognition Methods</h3>
              <div className="h-64 bg-gray-50 rounded-lg p-4 flex items-center justify-center">
                <div className="w-48 h-48 rounded-full border-8 border-gray-200 relative">
                  {systemStats.recognitionsByType.map((type, index) => {
                    const total = systemStats.recognitionsByType.reduce((sum, t) => sum + t.count, 0);
                    const percentage = (type.count / total) * 100;
                    const colors = ['bg-blue-500', 'bg-green-500', 'bg-yellow-500'];
                    const previousPercentages = systemStats.recognitionsByType
                      .slice(0, index)
                      .reduce((sum, t) => sum + (t.count / total) * 100, 0);
                    
                    return (
                      <div 
                        key={type.type}
                        className={`absolute inset-0 ${colors[index]}`}
                        style={{ 
                          clipPath: `polygon(50% 50%, ${50 + 50 * Math.cos(2 * Math.PI * previousPercentages / 100 - Math.PI/2)}% ${50 + 50 * Math.sin(2 * Math.PI * previousPercentages / 100 - Math.PI/2)}%, ${50 + 50 * Math.cos(2 * Math.PI * (previousPercentages + percentage) / 100 - Math.PI/2)}% ${50 + 50 * Math.sin(2 * Math.PI * (previousPercentages + percentage) / 100 - Math.PI/2)}%)` 
                        }}
                      ></div>
                    );
                  })}
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-32 h-32 bg-white rounded-full"></div>
                  </div>
                </div>
              </div>
              <div className="flex justify-center mt-4 space-x-6">
                {systemStats.recognitionsByType.map((type, index) => {
                  const colors = ['bg-blue-500', 'bg-green-500', 'bg-yellow-500'];
                  return (
                    <div key={type.type} className="flex items-center">
                      <div className={`w-3 h-3 ${colors[index]} rounded-full mr-2`}></div>
                      <span className="text-sm text-gray-600">{type.type} ({type.count})</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Catalog Usage */}
          <div className="bg-white shadow rounded-lg p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Catalog Usage</h3>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Catalog Name
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Usage Count
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Percentage
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {systemStats.catalogUsage.map((catalog) => {
                    const total = systemStats.catalogUsage.reduce((sum, c) => sum + c.count, 0);
                    const percentage = (catalog.count / total) * 100;
                    return (
                      <tr key={catalog.name}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          {catalog.name}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {catalog.count}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <div className="w-full bg-gray-200 rounded-full h-2.5">
                              <div className="bg-blue-600 h-2.5 rounded-full" style={{ width: `${percentage}%` }}></div>
                            </div>
                            <span className="ml-4 text-sm text-gray-500">{percentage.toFixed(1)}%</span>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* User Stats */}
      {reportType === 'users' && (
        <div className="space-y-6">
          {/* Key Metrics */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white shadow rounded-lg p-6">
              <div className="flex items-center">
                <div className="flex-shrink-0 p-3 rounded-md bg-blue-100 text-blue-600">
                  <ChartBarIcon className="h-6 w-6" />
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">Total Users</dt>
                    <dd>
                      <div className="text-lg font-medium text-gray-900">{formatNumber(userStats.totalUsers)}</div>
                    </dd>
                  </dl>
                </div>
              </div>
            </div>
            <div className="bg-white shadow rounded-lg p-6">
              <div className="flex items-center">
                <div className="flex-shrink-0 p-3 rounded-md bg-green-100 text-green-600">
                  <ChartBarIcon className="h-6 w-6" />
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">Active Users</dt>
                    <dd>
                      <div className="text-lg font-medium text-gray-900">{formatNumber(userStats.activeUsers)}</div>
                    </dd>
                  </dl>
                </div>
              </div>
            </div>
            <div className="bg-white shadow rounded-lg p-6">
              <div className="flex items-center">
                <div className="flex-shrink-0 p-3 rounded-md bg-yellow-100 text-yellow-600">
                  <ChartBarIcon className="h-6 w-6" />
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">New Users (30 days)</dt>
                    <dd>
                      <div className="text-lg font-medium text-gray-900">{userStats.newUsers}</div>
                    </dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>

          {/* Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white shadow rounded-lg p-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4">User Activity by Hour</h3>
              <div className="h-64 bg-gray-50 rounded-lg p-4 flex items-end space-x-2">
                {userStats.userActivity.map((hour) => {
                  const height = (hour.count / 50) * 100;
                  return (
                    <div key={hour.hour} className="flex flex-col items-center flex-1">
                      <div 
                        className="w-full bg-green-500 rounded-t"
                        style={{ height: `${height}%` }}
                      ></div>
                      <div className="text-xs text-gray-500 mt-2">{hour.hour}</div>
                    </div>
                  );
                })}
              </div>
            </div>
            <div className="bg-white shadow rounded-lg p-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Users by Role</h3>
              <div className="h-64 bg-gray-50 rounded-lg p-4 flex items-center justify-center">
                <div className="w-48 h-48 rounded-full border-8 border-gray-200 relative">
                  {userStats.usersByRole.map((role, index) => {
                    const total = userStats.usersByRole.reduce((sum, r) => sum + r.count, 0);
                    const percentage = (role.count / total) * 100;
                    const colors = ['bg-blue-500', 'bg-green-500', 'bg-yellow-500'];
                    const previousPercentages = userStats.usersByRole
                      .slice(0, index)
                      .reduce((sum, r) => sum + (r.count / total) * 100, 0);
                    
                    return (
                      <div 
                        key={role.role}
                        className={`absolute inset-0 ${colors[index]}`}
                        style={{ 
                          clipPath: `polygon(50% 50%, ${50 + 50 * Math.cos(2 * Math.PI * previousPercentages / 100 - Math.PI/2)}% ${50 + 50 * Math.sin(2 * Math.PI * previousPercentages / 100 - Math.PI/2)}%, ${50 + 50 * Math.cos(2 * Math.PI * (previousPercentages + percentage) / 100 - Math.PI/2)}% ${50 + 50 * Math.sin(2 * Math.PI * (previousPercentages + percentage) / 100 - Math.PI/2)}%)` 
                        }}
                      ></div>
                    );
                  })}
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-32 h-32 bg-white rounded-full"></div>
                  </div>
                </div>
              </div>
              <div className="flex justify-center mt-4 space-x-6">
                {userStats.usersByRole.map((role, index) => {
                  const colors = ['bg-blue-500', 'bg-green-500', 'bg-yellow-500'];
                  return (
                    <div key={role.role} className="flex items-center">
                      <div className={`w-3 h-3 ${colors[index]} rounded-full mr-2`}></div>
                      <span className="text-sm text-gray-600">{role.role} ({role.count})</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Top Users */}
          <div className="bg-white shadow rounded-lg p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Top Users</h3>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      User
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Email
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Recognitions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {userStats.topUsers.map((user) => (
                    <tr key={user.email}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {user.name}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {user.email}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {user.recognitions}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Material Stats */}
      {reportType === 'materials' && (
        <div className="space-y-6">
          {/* Key Metrics */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white shadow rounded-lg p-6">
              <div className="flex items-center">
                <div className="flex-shrink-0 p-3 rounded-md bg-blue-100 text-blue-600">
                  <ChartBarIcon className="h-6 w-6" />
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">Total Materials</dt>
                    <dd>
                      <div className="text-lg font-medium text-gray-900">{formatNumber(materialStats.totalMaterials)}</div>
                    </dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>

          {/* Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white shadow rounded-lg p-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Materials by Type</h3>
              <div className="h-64 bg-gray-50 rounded-lg p-4">
                {materialStats.materialsByType.map((type, index) => {
                  const total = materialStats.materialsByType.reduce((sum, t) => sum + t.count, 0);
                  const percentage = (type.count / total) * 100;
                  const colors = ['bg-blue-500', 'bg-green-500', 'bg-yellow-500', 'bg-purple-500'];
                  return (
                    <div key={type.type} className="mb-4">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-medium text-gray-700">{type.type}</span>
                        <span className="text-sm text-gray-500">{percentage.toFixed(1)}%</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2.5">
                        <div className={`${colors[index % colors.length]} h-2.5 rounded-full`} style={{ width: `${percentage}%` }}></div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
            <div className="bg-white shadow rounded-lg p-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Materials by Color</h3>
              <div className="h-64 bg-gray-50 rounded-lg p-4">
                {materialStats.materialsByColor.map((color, index) => {
                  const total = materialStats.materialsByColor.reduce((sum, c) => sum + c.count, 0);
                  const percentage = (color.count / total) * 100;
                  const colors = ['bg-gray-200', 'bg-yellow-200', 'bg-gray-400', 'bg-black', 'bg-yellow-700', 'bg-blue-500', 'bg-purple-500'];
                  return (
                    <div key={color.color} className="mb-4">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-medium text-gray-700">{color.color}</span>
                        <span className="text-sm text-gray-500">{percentage.toFixed(1)}%</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2.5">
                        <div className={`${colors[index % colors.length]} h-2.5 rounded-full`} style={{ width: `${percentage}%` }}></div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Most Recognized Materials */}
          <div className="bg-white shadow rounded-lg p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Most Recognized Materials</h3>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Material Name
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Recognition Count
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Percentage
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {materialStats.mostRecognized.map((material) => {
                    const total = materialStats.mostRecognized.reduce((sum, m) => sum + m.count, 0);
                    const percentage = (material.count / total) * 100;
                    return (
                      <tr key={material.name}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          {material.name}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {material.count}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <div className="w-full bg-gray-200 rounded-full h-2.5">
                              <div className="bg-blue-600 h-2.5 rounded-full" style={{ width: `${percentage}%` }}></div>
                            </div>
                            <span className="ml-4 text-sm text-gray-500">{percentage.toFixed(1)}%</span>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}