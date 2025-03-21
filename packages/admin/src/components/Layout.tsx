import React, { ReactNode, useState } from 'react';
import Head from 'next/head';
import Sidebar from './Sidebar';
import Header from './Header';

interface LayoutProps {
  children: ReactNode;
  title?: string;
  description?: string;
}

/**
 * Layout component for the admin panel
 */
const Layout: React.FC<LayoutProps> = ({
  children,
  title = 'Admin Dashboard',
  description = 'Kai Material Recognition System Admin Panel',
}) => {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const toggleSidebar = () => {
    setSidebarOpen(!sidebarOpen);
  };

  return (
    <div className="flex h-screen bg-gray-100">
      <Head>
        <title>{title} | Kai Admin</title>
        <meta name="description" content={description} />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <Sidebar isOpen={sidebarOpen} closeSidebar={() => setSidebarOpen(false)} />

      <div className="flex flex-col flex-1 overflow-hidden">
        <Header toggleSidebar={toggleSidebar} />

        <main className="flex-1 overflow-y-auto p-4 md:p-6">
          <div className="max-w-7xl mx-auto">
            {children}
          </div>
        </main>

        <footer className="bg-white border-t border-gray-200 p-4 text-center text-sm text-gray-600">
          <p>© {new Date().getFullYear()} Kai Material Recognition System. All rights reserved.</p>
        </footer>
      </div>
    </div>
  );
};

export default Layout;