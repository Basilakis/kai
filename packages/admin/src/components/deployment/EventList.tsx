import React, { useState, useEffect } from 'react';
import { 
  InformationCircleIcon, 
  ExclamationCircleIcon, 
  RefreshIcon
} from '@heroicons/react/outline';
import kubernetesService, { KubernetesEvent } from '../../services/kubernetes.service';

interface EventListProps {
  namespace?: string;
  resourceName?: string;
  resourceKind?: string;
}

/**
 * EventList Component
 * 
 * Displays a list of Kubernetes events with filtering options.
 */
const EventList: React.FC<EventListProps> = ({ 
  namespace, 
  resourceName, 
  resourceKind 
}) => {
  const [events, setEvents] = useState<KubernetesEvent[]>([]);
  const [filteredEvents, setFilteredEvents] = useState<KubernetesEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedNamespace, setSelectedNamespace] = useState<string | undefined>(namespace);
  const [namespaces, setNamespaces] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState('');

  // Load events from the Kubernetes API
  const loadEvents = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Fetch events from the Kubernetes API
      const eventList = await kubernetesService.getEvents(selectedNamespace);
      setEvents(eventList);
      
      // Extract unique namespaces for the filter dropdown
      const uniqueNamespaces = Array.from(new Set(eventList.map(event => event.namespace)));
      setNamespaces(uniqueNamespaces);
      
      // Apply initial filtering
      filterEvents(eventList, searchTerm, resourceName, resourceKind);
    } catch (err) {
      console.error('Error loading events:', err);
      setError('Failed to load events. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Filter events based on search term and resource filters
  const filterEvents = (
    events: KubernetesEvent[], 
    search: string, 
    resName?: string, 
    resKind?: string
  ) => {
    let filtered = [...events];
    
    // Filter by resource name if provided
    if (resName) {
      filtered = filtered.filter(event => 
        event.involvedObject.name.toLowerCase().includes(resName.toLowerCase())
      );
    }
    
    // Filter by resource kind if provided
    if (resKind) {
      filtered = filtered.filter(event => 
        event.involvedObject.kind.toLowerCase() === resKind.toLowerCase()
      );
    }
    
    // Filter by search term if provided
    if (search) {
      filtered = filtered.filter(event => 
        event.involvedObject.name.toLowerCase().includes(search.toLowerCase()) ||
        event.reason.toLowerCase().includes(search.toLowerCase()) ||
        event.message.toLowerCase().includes(search.toLowerCase()) ||
        event.type.toLowerCase().includes(search.toLowerCase())
      );
    }
    
    setFilteredEvents(filtered);
  };

  // Load events on component mount and when selectedNamespace changes
  useEffect(() => {
    loadEvents();
  }, [selectedNamespace]);

  // Update filtered events when search term changes
  useEffect(() => {
    filterEvents(events, searchTerm, resourceName, resourceKind);
  }, [searchTerm, resourceName, resourceKind, events]);

  // Handle namespace change
  const handleNamespaceChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value;
    setSelectedNamespace(value === 'all' ? undefined : value);
  };

  // Handle search input change
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value);
  };

  // Get event type icon and color
  const getEventTypeIcon = (type: string) => {
    switch (type.toLowerCase()) {
      case 'normal':
        return <InformationCircleIcon className="h-5 w-5 text-blue-500" />;
      case 'warning':
        return <ExclamationCircleIcon className="h-5 w-5 text-yellow-500" />;
      default:
        return <InformationCircleIcon className="h-5 w-5 text-gray-500" />;
    }
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
      <div className="px-4 py-5 sm:px-6 flex justify-between items-center">
        <div>
          <h3 className="text-lg font-medium text-gray-900">Kubernetes Events</h3>
          <p className="mt-1 max-w-2xl text-sm text-gray-500">
            {loading ? 'Loading events...' : `${filteredEvents.length} events found`}
          </p>
        </div>
        
        <div className="flex items-center space-x-4">
          {/* Search input */}
          <div className="relative">
            <input
              type="text"
              className="border border-gray-300 rounded-md shadow-sm py-2 pl-10 pr-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
              placeholder="Search events..."
              value={searchTerm}
              onChange={handleSearchChange}
              disabled={loading}
            />
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <svg className="h-5 w-5 text-gray-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
              </svg>
            </div>
          </div>
          
          {/* Namespace filter */}
          <div className="flex items-center">
            <label htmlFor="event-namespace" className="mr-2 text-sm text-gray-600">
              Namespace:
            </label>
            <select
              id="event-namespace"
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
          
          {/* Refresh button */}
          <button
            onClick={loadEvents}
            disabled={loading}
            className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
          >
            <RefreshIcon className="h-4 w-4 mr-1" />
            Refresh
          </button>
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
      
      {/* No events message */}
      {!loading && filteredEvents.length === 0 && (
        <div className="px-4 py-12 text-center text-gray-500">
          No events found matching the current filters.
        </div>
      )}
      
      {/* Events list */}
      {!loading && filteredEvents.length > 0 && (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Type
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Reason
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Object
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Message
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Count
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  First Seen
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Last Seen
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredEvents.map((event) => (
                <tr key={event.name} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      {getEventTypeIcon(event.type)}
                      <span className="ml-2 text-sm font-medium text-gray-900">
                        {event.type}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {event.reason}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    <div>
                      <span className="font-medium">{event.involvedObject.kind}</span>
                      <span className="mx-1">/</span>
                      <span>{event.involvedObject.name}</span>
                    </div>
                    <div className="text-xs text-gray-400">
                      {event.involvedObject.namespace}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500 max-w-md truncate">
                    {event.message}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {event.count}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {formatDate(event.firstTimestamp)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {formatDate(event.lastTimestamp)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default EventList;
