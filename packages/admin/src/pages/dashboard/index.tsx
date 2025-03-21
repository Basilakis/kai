import React from 'react';
import Layout from '../../components/Layout';
import { 
  UsersIcon, 
  DocumentTextIcon, 
  CubeIcon, 
  ClockIcon, 
  ChartBarIcon,
  CloudUploadIcon
} from '@heroicons/react/outline';

/**
 * Admin Dashboard Page
 */
export default function Dashboard() {
  // Mock statistics data - in a real app, this would come from an API
  const stats = [
    { name: 'Total Users', value: '124', icon: UsersIcon, color: 'bg-blue-500' },
    { name: 'Catalogs', value: '38', icon: DocumentTextIcon, color: 'bg-green-500' },
    { name: 'Materials', value: '1,284', icon: CubeIcon, color: 'bg-purple-500' },
    { name: 'Pending Uploads', value: '12', icon: CloudUploadIcon, color: 'bg-yellow-500' },
  ];

  // Mock recent activity data
  const recentActivity = [
    { id: 1, action: 'New catalog uploaded', user: 'John Doe', time: '2 hours ago' },
    { id: 2, action: 'Material updated', user: 'Jane Smith', time: '4 hours ago' },
    { id: 3, action: 'New user registered', user: 'Mike Johnson', time: '1 day ago' },
    { id: 4, action: 'Web crawler completed', user: 'System', time: '1 day ago' },
    { id: 5, action: 'Material recognition improved', user: 'AI System', time: '2 days ago' },
  ];

  // Mock system status data
  const systemStatus = [
    { name: 'API Server', status: 'Operational', statusColor: 'text-green-500' },
    { name: 'ML Service', status: 'Operational', statusColor: 'text-green-500' },
    { name: 'Web Crawler', status: 'Operational', statusColor: 'text-green-500' },
    { name: 'Database', status: 'Operational', statusColor: 'text-green-500' },
    { name: 'Storage', status: 'Operational', statusColor: 'text-green-500' },
  ];

  return (
    <Layout title="Dashboard">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-gray-800">Dashboard</h1>
        <p className="text-gray-600">Welcome to the Kai Material Recognition System admin panel.</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {stats.map((stat) => (
          <div key={stat.name} className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className={`${stat.color} rounded-full p-3 mr-4`}>
                <stat.icon className="h-6 w-6 text-white" />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-600">{stat.name}</p>
                <p className="text-2xl font-semibold text-gray-800">{stat.value}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Activity */}
        <div className="bg-white rounded-lg shadow">
          <div className="px-6 py-4 border-b border-gray-200">
            <div className="flex items-center">
              <ClockIcon className="h-5 w-5 text-gray-500 mr-2" />
              <h2 className="text-lg font-medium text-gray-800">Recent Activity</h2>
            </div>
          </div>
          <div className="p-6">
            <ul className="divide-y divide-gray-200">
              {recentActivity.map((activity) => (
                <li key={activity.id} className="py-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-800">{activity.action}</p>
                      <p className="text-xs text-gray-500">By {activity.user}</p>
                    </div>
                    <span className="text-xs text-gray-500">{activity.time}</span>
                  </div>
                </li>
              ))}
            </ul>
            <div className="mt-4 text-center">
              <button className="text-sm text-blue-600 hover:text-blue-800">
                View All Activity
              </button>
            </div>
          </div>
        </div>

        {/* System Status */}
        <div className="bg-white rounded-lg shadow">
          <div className="px-6 py-4 border-b border-gray-200">
            <div className="flex items-center">
              <ChartBarIcon className="h-5 w-5 text-gray-500 mr-2" />
              <h2 className="text-lg font-medium text-gray-800">System Status</h2>
            </div>
          </div>
          <div className="p-6">
            <ul className="divide-y divide-gray-200">
              {systemStatus.map((system) => (
                <li key={system.name} className="py-3">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-gray-800">{system.name}</p>
                    <span className={`text-sm font-medium ${system.statusColor}`}>
                      {system.status}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
            <div className="mt-4 text-center">
              <button className="text-sm text-blue-600 hover:text-blue-800">
                View System Logs
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="mt-8 bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-medium text-gray-800 mb-4">Quick Actions</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          <button className="flex items-center justify-center p-4 bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100">
            <CloudUploadIcon className="h-5 w-5 mr-2" />
            <span>Upload Catalog</span>
          </button>
          <button className="flex items-center justify-center p-4 bg-green-50 text-green-700 rounded-lg hover:bg-green-100">
            <UsersIcon className="h-5 w-5 mr-2" />
            <span>Add User</span>
          </button>
          <button className="flex items-center justify-center p-4 bg-purple-50 text-purple-700 rounded-lg hover:bg-purple-100">
            <CubeIcon className="h-5 w-5 mr-2" />
            <span>Manage Materials</span>
          </button>
          <button className="flex items-center justify-center p-4 bg-yellow-50 text-yellow-700 rounded-lg hover:bg-yellow-100">
            <ChartBarIcon className="h-5 w-5 mr-2" />
            <span>View Reports</span>
          </button>
        </div>
      </div>
    </Layout>
  );
}