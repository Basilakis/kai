/**
 * Shared Header Interfaces
 * 
 * This file defines common interfaces and types for Header components
 * that can be used across different packages (client, admin) to reduce
 * duplication and ensure consistency.
 */

/**
 * Navigation item interface
 */
export interface NavItem {
  label: string;
  path: string;
  icon?: any; // Using any instead of ReactNode to avoid React dependency
  isExternal?: boolean;
}

/**
 * Common Header props interface
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
 * User menu state interface
 */
export interface UserMenuState {
  isOpen: boolean;
  toggleMenu: () => void;
  closeMenu: () => void;
}

/**
 * Mobile menu state interface
 */
export interface MobileMenuState {
  isOpen: boolean;
  toggleMenu: () => void;
  closeMenu: () => void;
}

/**
 * Header behavior interface
 */
export interface HeaderBehavior {
  isScrolled: boolean;
  userMenu: UserMenuState;
  mobileMenu: MobileMenuState;
  handleNavItemClick: (path: string, isExternal?: boolean) => void;
}

/**
 * Shared utility to handle navigation click
 */
export function createNavigationHandler(
  closeMenu?: () => void
): (path: string, isExternal?: boolean) => void {
  return (path: string, isExternal?: boolean) => {
    // Close menus when navigating
    if (closeMenu) {
      closeMenu();
    }
    
    // For external links, use window.open
    if (isExternal) {
      window.open(path, '_blank', 'noopener,noreferrer');
    }
    
    // Internal navigation is handled by the framework-specific implementation
  };
}

/**
 * Common CSS class names for Header components
 */
export const headerClassNames = {
  container: 'header-container',
  scrolled: 'header-scrolled',
  darkMode: 'dark-mode',
  logoContainer: 'logo-container',
  logo: 'logo',
  title: 'site-title',
  navigation: 'main-navigation',
  navItems: 'nav-items',
  navItem: 'nav-item',
  navLink: 'nav-link',
  navIcon: 'nav-icon',
  navLabel: 'nav-label',
  userSection: 'user-section',
  userProfile: 'user-profile',
  userAvatar: 'user-avatar',
  userName: 'user-name',
  loginButton: 'login-button',
  logoutButton: 'logout-button',
  mobileMenuToggle: 'mobile-menu-toggle',
  hamburger: 'hamburger',
  open: 'open',
  mobileMenu: 'mobile-menu',
  mobileNavItems: 'mobile-nav-items',
  mobileNavItem: 'mobile-nav-item',
  mobileNavLink: 'mobile-nav-link',
  authItem: 'auth-item',
  mobileLoginButton: 'mobile-login-button',
  mobileLogoutButton: 'mobile-logout-button',
};