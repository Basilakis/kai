import React from 'react';
import { Link } from 'gatsby';

/**
 * Footer component for the application
 */
const Footer: React.FC = () => {
  const currentYear = new Date().getFullYear();
  
  return (
    <footer className="footer">
      <div className="container">
        <div className="footer-content">
          <div className="footer-section">
            <h3 className="footer-title">Kai</h3>
            <p className="footer-description">
              A comprehensive system for material recognition and catalog management.
            </p>
            <div className="social-links">
              <a href="https://twitter.com/kaimaterials" target="_blank" rel="noopener noreferrer" aria-label="Twitter">
                <i className="icon-twitter"></i>
              </a>
              <a href="https://linkedin.com/company/kaimaterials" target="_blank" rel="noopener noreferrer" aria-label="LinkedIn">
                <i className="icon-linkedin"></i>
              </a>
              <a href="https://github.com/kaimaterials" target="_blank" rel="noopener noreferrer" aria-label="GitHub">
                <i className="icon-github"></i>
              </a>
            </div>
          </div>
          
          <div className="footer-section">
            <h3 className="footer-title">Features</h3>
            <ul className="footer-links">
              <li>
                <Link to="/materials">Materials Database</Link>
              </li>
              <li>
                <Link to="/recognition">Material Recognition</Link>
              </li>
              <li>
                <Link to="/catalogs">Catalog Management</Link>
              </li>
              <li>
                <Link to="/api-docs">API Documentation</Link>
              </li>
            </ul>
          </div>
          
          <div className="footer-section">
            <h3 className="footer-title">Company</h3>
            <ul className="footer-links">
              <li>
                <Link to="/about">About Us</Link>
              </li>
              <li>
                <Link to="/contact">Contact</Link>
              </li>
              <li>
                <Link to="/careers">Careers</Link>
              </li>
              <li>
                <Link to="/blog">Blog</Link>
              </li>
            </ul>
          </div>
          
          <div className="footer-section">
            <h3 className="footer-title">Legal</h3>
            <ul className="footer-links">
              <li>
                <Link to="/terms">Terms of Service</Link>
              </li>
              <li>
                <Link to="/privacy">Privacy Policy</Link>
              </li>
              <li>
                <Link to="/cookies">Cookie Policy</Link>
              </li>
            </ul>
          </div>
        </div>
        
        <div className="footer-bottom">
          <p className="copyright">
            &copy; {currentYear} Kai Materials. All rights reserved.
          </p>
          <p className="made-with">
            Made with <span className="heart">❤</span> by the Kai Team
          </p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;