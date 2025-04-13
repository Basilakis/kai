// @ts-nocheck
// Import global TypeScript JSX declarations
import '../types/global-jsx';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import {
  HomeIcon,
  UsersIcon,
  DocumentTextIcon,
  CubeIcon,
  GlobeAltIcon,
  CogIcon,
  XIcon,
  PhotographIcon,
  DatabaseIcon,
  ChartBarIcon
} from '@heroicons/react/outline';

interface SidebarProps {
  isOpen: boolean;
  closeSidebar: () => void;
}

/**
 * Sidebar component for admin navigation
 */
const Sidebar: React.FC<SidebarProps> = ({ isOpen, closeSidebar }) => {
  const router = useRouter();

  // Navigation items for the sidebar
  const navItems = [
    { name: 'Dashboard', href: '/dashboard', icon: HomeIcon },
    { name: 'User Management', href: '/users', icon: UsersIcon },
    { name: 'Subscription Tiers', href: '/subscription-tiers', icon: DatabaseIcon },
    { name: 'Service Costs', href: '/service-costs', icon: DatabaseIcon },
    { name: 'Catalog Management', href: '/catalogs', icon: DocumentTextIcon },
    { name: 'PDF Processor', href: '/pdf-processor', icon: DocumentTextIcon },
    { name: 'Image Recognition', href: '/image-recognition', icon: PhotographIcon },
    { name: 'Knowledge Base', href: '/knowledge-base', icon: DatabaseIcon },
    { name: 'Material Management', href: '/materials', icon: CubeIcon },
    { name: 'Models', href: '/models', icon: DatabaseIcon },
    { name: 'Training Monitor', href: '/training', icon: ChartBarIcon },
    { name: 'Datasets', href: '/datasets', icon: DatabaseIcon },
    { name: 'Reports', href: '/reports', icon: ChartBarIcon },
    { name: 'Addons', href: '/addons', icon: GlobeAltIcon },
    { name: 'System Settings', href: '/settings', icon: CogIcon },
  ];

  // Check if a nav item is active
  const isActive = (path: string) => {
    return router.pathname.startsWith(path);
  };

  return (
    <>
      {/* Mobile sidebar backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 z-20 bg-black bg-opacity-50 lg:hidden"
          onClick={closeSidebar}
        />
      )}

      {/* Sidebar */}
      <div
        className={`fixed inset-y-0 left-0 z-30 w-64 bg-white border-r border-gray-200 transition-transform duration-300 transform ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        } lg:translate-x-0 lg:static lg:z-auto`}
      >
        {/* Sidebar header */}
        <div className="flex items-center justify-between h-16 px-4 border-b border-gray-200">
          <Link href="/dashboard">
            <div className="flex items-center cursor-pointer">
              <span className="text-xl font-semibold text-blue-600">Kai Admin</span>
            </div>
          </Link>
          <button
            className="p-1 text-gray-500 rounded-md hover:bg-gray-100 lg:hidden"
            onClick={closeSidebar}
          >
            <XIcon className="w-6 h-6" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="px-2 py-4 space-y-1">
          {navItems.map((item) => {
            const active = isActive(item.href);
            return (
              <Link
                key={item.name}
                href={item.href}
              >
                <div
                  className={`flex items-center px-2 py-2 text-sm font-medium rounded-md cursor-pointer ${
                    active
                      ? 'bg-blue-50 text-blue-700'
                      : 'text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  <item.icon className={`w-5 h-5 mr-3 ${active ? 'text-blue-500' : 'text-gray-500'}`} />
                  {item.name}
                </div>
              </Link>
            );
          })}
        </nav>

        {/* Sidebar footer */}
        <div className="absolute bottom-0 w-full p-4 border-t border-gray-200">
          <div className="text-xs text-gray-500">
            <p>Kai Material Recognition</p>
            <p>Admin Panel v1.0.0</p>
          </div>
        </div>
      </div>
    </>
  );
};

export default Sidebar;