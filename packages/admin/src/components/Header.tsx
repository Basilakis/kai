import React from 'react';
import Link from 'next/link';
import { 
  MenuIcon, 
  SearchIcon, 
  BellIcon, 
  UserCircleIcon, 
  CogIcon, 
  LogoutIcon 
} from '@heroicons/react/outline';

interface HeaderProps {
  toggleSidebar: () => void;
}

/**
 * Header component for the admin panel
 */
const Header: React.FC<HeaderProps> = ({ toggleSidebar }) => {
  // Mock user data - in a real app, this would come from an auth context
  const user = {
    name: 'Admin User',
    email: 'admin@example.com',
    avatar: null,
  };

  return (
    <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
      <div className="px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Left section */}
          <div className="flex items-center">
            <button
              type="button"
              className="text-gray-500 hover:text-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 lg:hidden"
              onClick={toggleSidebar}
            >
              <span className="sr-only">Open sidebar</span>
              <MenuIcon className="h-6 w-6" aria-hidden="true" />
            </button>
            
            {/* Search bar - visible on larger screens */}
            <div className="hidden md:block ml-4">
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <SearchIcon className="h-5 w-5 text-gray-400" aria-hidden="true" />
                </div>
                <input
                  type="text"
                  placeholder="Search..."
                  className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md leading-5 bg-gray-50 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                />
              </div>
            </div>
          </div>

          {/* Right section */}
          <div className="flex items-center space-x-4">
            {/* Notifications */}
            <button
              type="button"
              className="p-1 text-gray-400 hover:text-gray-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              <span className="sr-only">View notifications</span>
              <BellIcon className="h-6 w-6" aria-hidden="true" />
            </button>

            {/* Profile dropdown */}
            <div className="relative">
              <div>
                <button
                  type="button"
                  className="flex items-center max-w-xs text-sm rounded-full focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                  id="user-menu-button"
                >
                  <span className="sr-only">Open user menu</span>
                  {user.avatar ? (
                    <img
                      className="h-8 w-8 rounded-full"
                      src={user.avatar}
                      alt={user.name}
                    />
                  ) : (
                    <UserCircleIcon className="h-8 w-8 text-gray-400" aria-hidden="true" />
                  )}
                  <span className="ml-2 text-gray-700 hidden md:block">{user.name}</span>
                </button>
              </div>

              {/* Dropdown menu - would be toggled with state in a real implementation */}
              {/* For simplicity, we're not implementing the dropdown toggle functionality here */}
              {/* <div className="origin-top-right absolute right-0 mt-2 w-48 rounded-md shadow-lg py-1 bg-white ring-1 ring-black ring-opacity-5 focus:outline-none">
                <Link href="/profile">
                  <a className="flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-100">
                    <UserCircleIcon className="mr-3 h-5 w-5 text-gray-400" aria-hidden="true" />
                    Your Profile
                  </a>
                </Link>
                <Link href="/settings">
                  <a className="flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-100">
                    <CogIcon className="mr-3 h-5 w-5 text-gray-400" aria-hidden="true" />
                    Settings
                  </a>
                </Link>
                <button
                  className="flex w-full items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                  onClick={() => console.log('Sign out')}
                >
                  <LogoutIcon className="mr-3 h-5 w-5 text-gray-400" aria-hidden="true" />
                  Sign out
                </button>
              </div> */}
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;