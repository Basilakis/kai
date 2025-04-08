import React, { useState } from 'react';
import { Link } from 'gatsby';
import { useUser } from '../providers/UserProvider';

/**
 * Header component for the application
 */
const Header: React.FC = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const { user, isLoading } = useUser();

  const toggleMenu = () => {
    setIsMenuOpen(!isMenuOpen);
  };

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
                  <div className="user-profile-menu">
                    <Link to="/profile" className="button secondary user-profile-link">
                      My Profile
                    </Link>
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