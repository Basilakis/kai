import React, { ReactNode } from 'react';
import { Link } from 'gatsby';
import Header from './Header';
import Footer from './Footer';

interface LayoutProps {
  children: ReactNode;
}

/**
 * Layout component that wraps all pages
 */
const Layout: React.FC<LayoutProps> = ({ children }) => {
  return (
    <div className="layout">
      <Header />
      <main>{children}</main>
      <Footer />
    </div>
  );
};

export default Layout;