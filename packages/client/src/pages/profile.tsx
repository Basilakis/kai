import React, { useState, useEffect } from 'react';
import { Link } from 'gatsby';
import { useUser } from '../providers/UserProvider';
import Layout from '../components/Layout';

// Type definitions for the user profile
interface UserProfile {
  id: string;
  email: string;
  name?: string;
  createdAt?: string;
  lastSignInTime?: string;
  role?: string;
}

// Type definitions for subscription-related data
interface ModuleAccess {
  name: string;
  enabled: boolean;
}

interface SubscriptionTier {
  id: string;
  name: string;
  price: number;
  features: string[];
}

interface UserSubscription {
  id: string;
  tierId: string;
  status: string;
  name: string;
  price: number;
  renewalDate: string;
  features: string[];
  moduleAccess: ModuleAccess[];
}

interface ApiUsage {
  current: number;
  limit: number;
  resetDate: string;
}

/**
 * User Profile Page
 * 
 * Displays user information and subscription details.
 * Allows users to manage their subscription and view resource usage.
 */
const ProfilePage: React.FC = () => {
  const { user, isLoading } = useUser() as { user: UserProfile | null, isLoading: boolean };
  const [subscription, setSubscription] = useState<UserSubscription | null>(null);
  const [availableTiers, setAvailableTiers] = useState<SubscriptionTier[]>([]);
  const [isLoadingSubscription, setIsLoadingSubscription] = useState<boolean>(true);
  const [apiUsage, setApiUsage] = useState<ApiUsage>({ current: 0, limit: 0, resetDate: '' });
  
  useEffect(() => {
    // In a real implementation, this would fetch from API
    const fetchSubscriptionData = async () => {
      if (!user) return;
      
      try {
        // This would be an API call to get the user's subscription
        // const response = await fetch(`/api/subscriptions/my-subscription`);
        // const data = await response.json();
        
        // Mock data for now
        const mockSubscription: UserSubscription = {
          id: 'sub_123456',
          tierId: 'tier_basic',
          status: 'active',
          name: 'Basic Plan',
          price: 9.99,
          renewalDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
          features: [
            'Material Recognition: 100 uses/month',
            'Knowledge Base Search: Basic',
            'Agent Access: Basic Material Expert Only'
          ],
          moduleAccess: [
            { name: 'materialRecognition', enabled: true },
            { name: 'knowledgeBase', enabled: true },
            { name: 'agents', enabled: true },
            { name: 'advancedAgents', enabled: false },
            { name: '3dDesigner', enabled: false },
            { name: 'api', enabled: false }
          ]
        };
        
        setSubscription(mockSubscription);
        
        // Mock API usage data
        setApiUsage({
          current: 43,
          limit: 100,
          resetDate: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toLocaleDateString()
        });
        
        // Mock available tiers
        const tiers: SubscriptionTier[] = [
          {
            id: 'tier_free',
            name: 'Free',
            price: 0,
            features: [
              'Material Recognition: 10 uses/month',
              'Knowledge Base Search: Limited',
              'No Agent Access'
            ]
          },
          {
            id: 'tier_basic',
            name: 'Basic',
            price: 9.99,
            features: [
              'Material Recognition: 100 uses/month',
              'Knowledge Base Search: Basic',
              'Agent Access: Basic Material Expert Only'
            ]
          },
          {
            id: 'tier_pro',
            name: 'Professional',
            price: 19.99,
            features: [
              'Material Recognition: 500 uses/month',
              'Knowledge Base Search: Advanced',
              'Agent Access: All Agents',
              '3D Designer Access: Basic'
            ]
          },
          {
            id: 'tier_enterprise',
            name: 'Enterprise',
            price: 49.99,
            features: [
              'Material Recognition: Unlimited',
              'Knowledge Base Search: Full',
              'Agent Access: All Agents',
              '3D Designer Access: Full',
              'API Access: 10,000 requests/month'
            ]
          }
        ];
        
        setAvailableTiers(tiers);
        
        setIsLoadingSubscription(false);
      } catch (error) {
        console.error('Error fetching subscription data:', error);
        setIsLoadingSubscription(false);
      }
    };
    
    fetchSubscriptionData();
  }, [user]);
  
  const handleChangeTier = async (tierId: string) => {
    // In a real implementation, this would call an API
    try {
      // const response = await fetch('/api/subscriptions/my-subscription', {
      //   method: 'PUT',
      //   headers: {
      //     'Content-Type': 'application/json',
      //   },
      //   body: JSON.stringify({ tierId }),
      // });
      
      // if (response.ok) {
      //   const updatedSubscription = await response.json();
      //   setSubscription(updatedSubscription);
      // }
      
      // Mock update for demo purposes
      const tier = availableTiers.find(t => t.id === tierId);
      
      if (tier && subscription) {
        const updatedSubscription: UserSubscription = {
          ...subscription,
          tierId,
          name: tier.name,
          price: tier.price,
          features: tier.features
        };
        
        setSubscription(updatedSubscription);
        alert(`Subscription updated to ${tier.name} plan!`);
      }
    } catch (error) {
      console.error('Error updating subscription:', error);
      alert('Failed to update subscription. Please try again.');
    }
  };
  
  if (isLoading) {
    return (
      <Layout>
        <div className="flex justify-center items-center h-64">
          <div className="loader">Loading...</div>
        </div>
      </Layout>
    );
  }
  
  if (!user) {
    return (
      <Layout>
        <div className="text-center py-12">
          <h1 className="text-2xl font-bold mb-4">Please Sign In</h1>
          <p className="mb-6">You need to be signed in to view your profile.</p>
          <Link 
            to="/login" 
            className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
          >
            Sign In
          </Link>
        </div>
      </Layout>
    );
  }
  
  return (
    <Layout>
      <div className="max-w-5xl mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-8">My Profile</h1>
        
        <div className="bg-white shadow rounded-lg overflow-hidden mb-8">
          <div className="px-6 py-5 border-b border-gray-200">
            <h2 className="text-xl font-semibold">Account Information</h2>
          </div>
          <div className="px-6 py-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h3 className="text-sm font-medium text-gray-500">Name</h3>
                <p className="mt-1 text-md text-gray-900">{user?.name || 'Not provided'}</p>
              </div>
              <div>
                <h3 className="text-sm font-medium text-gray-500">Email</h3>
                <p className="mt-1 text-md text-gray-900">{user.email}</p>
              </div>
              <div>
                <h3 className="text-sm font-medium text-gray-500">Account Created</h3>
                <p className="mt-1 text-md text-gray-900">
                  {user.createdAt 
                    ? new Date(user.createdAt).toLocaleDateString() 
                    : 'Not available'}
                </p>
              </div>
              <div>
                <h3 className="text-sm font-medium text-gray-500">Last Login</h3>
                <p className="mt-1 text-md text-gray-900">
                  {user?.lastSignInTime 
                    ? new Date(user?.lastSignInTime).toLocaleDateString()
                    : 'Not available'}
                </p>
              </div>
            </div>
          </div>
        </div>
        
        {isLoadingSubscription ? (
          <div className="bg-white shadow rounded-lg p-6 mb-8">
            <p>Loading subscription information...</p>
          </div>
        ) : subscription ? (
          <div className="bg-white shadow rounded-lg overflow-hidden mb-8">
            <div className="px-6 py-5 border-b border-gray-200">
              <h2 className="text-xl font-semibold">Current Subscription</h2>
            </div>
            <div className="px-6 py-5">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="text-lg font-medium text-gray-900">{subscription.name}</h3>
                  <p className="text-sm text-gray-500">
                    {subscription.status === 'active' ? 'Active' : 'Inactive'} · 
                    Renews on {new Date(subscription.renewalDate).toLocaleDateString()}
                  </p>
                </div>
                <span className="text-2xl font-bold text-gray-900">
                  ${subscription.price.toFixed(2)}<span className="text-sm font-normal">/month</span>
                </span>
              </div>
              
              <div className="border-t border-gray-200 pt-4 mb-6">
                <h3 className="text-md font-medium text-gray-700 mb-3">Included Features</h3>
                <ul className="space-y-2">
                  {subscription.features.map((feature: string, index: number) => (
                    <li key={index} className="flex items-start">
                      <svg className="h-5 w-5 text-green-500 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
              </div>
              
              <div className="border-t border-gray-200 pt-4 mb-6">
                <h3 className="text-md font-medium text-gray-700 mb-3">API Usage</h3>
                <div className="w-full bg-gray-200 rounded-full h-2.5 mb-2">
                  <div 
                    className="bg-blue-600 h-2.5 rounded-full" 
                    style={{ width: `${(apiUsage.current / apiUsage.limit) * 100}%` }}
                  ></div>
                </div>
                <p className="text-sm text-gray-500">
                  {apiUsage.current} of {apiUsage.limit} API calls used this month 
                  (Resets on {apiUsage.resetDate})
                </p>
              </div>
              
              <div className="border-t border-gray-200 pt-4">
                <h3 className="text-md font-medium text-gray-700 mb-3">Module Access</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {subscription.moduleAccess.map((module: ModuleAccess) => (
                    <div key={module.name} className="flex items-center">
                      <span className={`h-3 w-3 rounded-full mr-2 ${module.enabled ? 'bg-green-500' : 'bg-red-500'}`}></span>
                      <span className="capitalize">
                        {module.name.replace(/([A-Z])/g, ' $1').trim()}: {module.enabled ? 'Enabled' : 'Disabled'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-white shadow rounded-lg p-6 mb-8">
            <p className="text-gray-700">No subscription found.</p>
          </div>
        )}
        
        <div className="bg-white shadow rounded-lg overflow-hidden">
          <div className="px-6 py-5 border-b border-gray-200">
            <h2 className="text-xl font-semibold">Available Subscription Tiers</h2>
          </div>
          <div className="px-6 py-5">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {availableTiers.map((tier: SubscriptionTier) => (
                <div key={tier.id} className={`border rounded-lg p-4 ${subscription && tier.id === subscription.tierId ? 'border-blue-500 bg-blue-50' : 'border-gray-200'}`}>
                  <h3 className="text-lg font-medium text-gray-900 mb-2">{tier.name}</h3>
                  <p className="text-2xl font-bold text-gray-900 mb-4">
                    ${tier.price.toFixed(2)}<span className="text-sm font-normal">/month</span>
                  </p>
                  <ul className="space-y-2 mb-4 min-h-[150px]">
                    {tier.features.map((feature: string, index: number) => (
                      <li key={index} className="flex items-start text-sm">
                        <svg className="h-4 w-4 text-green-500 mr-2 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>
                  <button
                    onClick={() => handleChangeTier(tier.id)}
                    disabled={subscription && tier.id === subscription.tierId}
                    className={`w-full py-2 px-4 rounded text-center font-medium ${
                      subscription && tier.id === subscription.tierId
                        ? 'bg-gray-100 text-gray-500 cursor-not-allowed'
                        : 'bg-blue-600 text-white hover:bg-blue-700'
                    }`}
                  >
                    {subscription && tier.id === subscription.tierId
                      ? 'Current Plan'
                      : 'Switch to This Plan'}
                  </button>
                </div>
              ))}
            </div>
            <div className="mt-6 text-center">
              <p className="text-sm text-gray-500">
                Need a custom plan for your organization? Contact our sales team at <a href="mailto:sales@example.com" className="text-blue-600 hover:underline">sales@example.com</a>
              </p>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default ProfilePage;