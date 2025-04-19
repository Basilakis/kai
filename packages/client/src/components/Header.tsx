import React, { useState, useEffect } from 'react';
import { Link } from 'gatsby';
// Import shared interfaces to reduce duplication
import { 
  NavItem, 
  HeaderBehavior, 
  createNavigationHandler,
  headerClassNames as cn
} from '../../../shared/src/components/interfaces/HeaderInterfaces';
import { useUser } from '../providers/UserProvider';

/**
 * Navigation items for the client application
 */
const navItems: NavItem[] = [
  { label: 'Materials', path: '/materials' },
  { label: 'Recognition', path: '/recognition' },
  { label: 'Catalogs', path: '/catalogs' },
  { label: 'About', path: '/about' }
];

/**
 * Header component for the client application
 * Uses shared interfaces and utilities from the shared package
 */
const Header: React.FC = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const { user, isLoading, logout } = useUser();

  // Handle scroll events
  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 10);
    };
    
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Menu toggle function
  const toggleMenu = () => {
    setIsMenuOpen(!isMenuOpen);
  };

  // Close menu function
  const closeMenu = () => {
    setIsMenuOpen(false);
  };

  // Navigation handler
  const handleNavItemClick = createNavigationHandler(closeMenu);

  return (
    <header className="header">
      <div className="container">
        <div className="header-content">
          <div className="logo">
            <Link to="/">
              <span className="logo-text">Kai</span>
            </Link>
          </div>
          
          <button 
            className="mobile-menu-button" 
            onClick={toggleMenu}
            aria-label="Toggle menu"
          >
            <span className={`hamburger ${isMenuOpen ? 'open' : ''}`}></span>
          </button>
          
          <nav className={`main-nav ${isMenuOpen ? 'open' : ''}`}>
            <ul className="nav-links">
              <li>
                <Link to="/materials" activeClassName="active">
                  Materials
                </Link>
              </li>
              <li>
                <Link to="/recognition" activeClassName="active">
                  Recognition
                </Link>
              </li>
              <li>
                <Link to="/catalogs" activeClassName="active">
                  Catalogs
                </Link>
              </li>
              <li>
                <Link to="/about" activeClassName="active">
                  About
                </Link>
              </li>
            </ul>
            
            {!isLoading && (
              <div className="auth-buttons">
                {user ? (
                  <div className="user-profile-menu flex items-center gap-2">
                    <Link to="/profile" className="button secondary user-profile-link">
                      My Profile
                    </Link>
                    <button 
                      onClick={() => { 
                        if (window.confirm('Are you sure you want to log out?')) {
                          // Call logout from UserProvider
                          logout();
                        }
                      }}
                      className="button outline-danger"
                      aria-label="Log out"
                    >
                      Log Out
                    </button>
                  </div>
                ) : (
                  <>
                    <Link to="/login" className="button secondary">
                      Log In
                    </Link>
                    <Link to="/register" className="button primary">
                      Sign Up
                    </Link>
                  </>
                )}
              </div>
            )}
          </nav>
        </div>
      </div>
    </header>
  );
};

export default Header;