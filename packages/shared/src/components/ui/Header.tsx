/**
 * Shared Header Component
 * 
 * A reusable header component that can be used across different packages
 * (client, admin) to reduce duplication and ensure consistency.
 */

// Use proper type imports
import * as React from 'react';
import { ReactNode } from 'react';

/**
 * Navigation item interface
 */
export interface NavItem {
  label: string;
  path: string;
  icon?: ReactNode;
  isExternal?: boolean;
}

/**
 * Define props that both client and admin headers need
 */
export interface HeaderProps {
  // Common properties
  title: string;
  logoUrl: string;
  isAuthenticated?: boolean;
  userName?: string;
  userAvatar?: string;
  
  // Navigation
  navItems?: Array<NavItem>;
  
  // Actions
  onLogin?: () => void;
  onLogout?: () => void;
  onProfileClick?: () => void;
  
  // Customization
  className?: string;
  logoClassName?: string;
  enableMobileMenu?: boolean;
  darkMode?: boolean;
  
  // Framework-specific props can be passed through
  [key: string]: any;
}

/**
 * Shared Header Component
 * 
 * This component provides a consistent header across packages while
 * allowing for customization through props.
 */
export const Header: React.FC<HeaderProps> = ({
  title,
  logoUrl,
  isAuthenticated = false,
  userName,
  userAvatar,
  navItems = [],
  onLogin,
  onLogout,
  onProfileClick,
  className = '',
  logoClassName = '',
  enableMobileMenu = true,
  darkMode = false,
  ...rest
}: HeaderProps) => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = React.useState(false);
  const [scrolled, setScrolled] = React.useState(false);
  
  // Handle scroll events to add shadow or background change
  React.useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 10);
    };
    
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);
  
  // Toggle mobile menu
  const toggleMobileMenu = () => {
    if (enableMobileMenu) {
      setIsMobileMenuOpen(!isMobileMenuOpen);
    }
  };
  
  // Handle navigation item click
  const handleNavItemClick = (path: string, isExternal?: boolean) => {
    // Close mobile menu when navigating
    setIsMobileMenuOpen(false);
    
    // For external links, use window.open
    if (isExternal) {
      window.open(path, '_blank', 'noopener,noreferrer');
    }
    
    // For internal links, framework-specific navigation would be handled by the parent
  };
  
  return (
    <header 
      className={`shared-header ${scrolled ? 'header-scrolled' : ''} ${darkMode ? 'dark-mode' : ''} ${className}`}
      data-testid="shared-header"
      {...rest}
    >
      <div className="header-container">
        {/* Logo and title section */}
        <div className="logo-container">
          {logoUrl && (
            <img 
              src={logoUrl} 
              alt={`${title} logo`}
              className={`logo ${logoClassName}`}
            />
          )}
          <h1 className="site-title">{title}</h1>
        </div>
        
        {/* Navigation for larger screens */}
        <nav className="main-navigation">
          <ul className="nav-items">
            {navItems.map((item: NavItem, index: number) => (
              <li key={`nav-item-${index}`} className="nav-item">
                <button
                  onClick={() => handleNavItemClick(item.path, item.isExternal)}
                  className="nav-link"
                >
                  {item.icon && <span className="nav-icon">{item.icon}</span>}
                  <span className="nav-label">{item.label}</span>
                </button>
              </li>
            ))}
          </ul>
        </nav>
        
        {/* User profile or auth actions */}
        <div className="user-section">
          {isAuthenticated ? (
            <div className="user-profile" onClick={onProfileClick}>
              {userAvatar && (
                <img 
                  src={userAvatar} 
                  alt={userName || 'User profile'} 
                  className="user-avatar"
                />
              )}
              {userName && <span className="user-name">{userName}</span>}
              <button 
                className="logout-button" 
                onClick={(e: React.MouseEvent) => {
                  e.stopPropagation();
                  onLogout?.();
                }}
              >
                Log out
              </button>
            </div>
          ) : (
            <button className="login-button" onClick={onLogin}>
              Log in
            </button>
          )}
        </div>
        
        {/* Mobile menu toggle */}
        {enableMobileMenu && (
          <button 
            className="mobile-menu-toggle" 
            onClick={toggleMobileMenu}
            aria-label="Toggle mobile menu"
          >
            <span className={`hamburger ${isMobileMenuOpen ? 'open' : ''}`}></span>
          </button>
        )}
      </div>
      
      {/* Mobile menu */}
      {enableMobileMenu && (
        <div className={`mobile-menu ${isMobileMenuOpen ? 'open' : ''}`}>
          <ul className="mobile-nav-items">
            {navItems.map((item: NavItem, index: number) => (
              <li key={`mobile-nav-item-${index}`} className="mobile-nav-item">
                <button
                  onClick={() => handleNavItemClick(item.path, item.isExternal)}
                  className="mobile-nav-link"
                >
                  {item.icon && <span className="nav-icon">{item.icon}</span>}
                  <span className="nav-label">{item.label}</span>
                </button>
              </li>
            ))}
            
            {/* Add auth actions to mobile menu */}
            <li className="mobile-nav-item auth-item">
              {isAuthenticated ? (
                <button 
                  className="mobile-logout-button" 
                  onClick={onLogout}
                >
                  Log out
                </button>
              ) : (
                <button 
                  className="mobile-login-button" 
                  onClick={onLogin}
                >
                  Log in
                </button>
              )}
            </li>
          </ul>
        </div>
      )}
    </header>
  );
};

export default Header;