import React from 'react';
import { Link } from 'gatsby';

interface HeroProps {
  title: string;
  subtitle: string;
  ctaText: string;
  ctaLink: string;
  backgroundImage?: string;
}

/**
 * Hero component for landing pages
 */
const Hero: React.FC<HeroProps> = ({
  title,
  subtitle,
  ctaText,
  ctaLink,
  backgroundImage,
}) => {
  const heroStyle = backgroundImage
    ? { backgroundImage: `url(${backgroundImage})` }
    : {};

  return (
    <section className="hero" style={heroStyle}>
      <div className="container">
        <div className="hero-content">
          <h1 className="hero-title">{title}</h1>
          <p className="hero-subtitle">{subtitle}</p>
          <div className="hero-cta">
            <Link to={ctaLink} className="button primary large">
              {ctaText}
            </Link>
            <Link to="/learn-more" className="button secondary large">
              Learn More
            </Link>
          </div>
          
          <div className="hero-features">
            <div className="hero-feature">
              <div className="hero-feature-icon">
                <i className="icon-search"></i>
              </div>
              <div className="hero-feature-text">
                <h3>Instant Recognition</h3>
                <p>Upload an image and get matches in seconds</p>
              </div>
            </div>
            
            <div className="hero-feature">
              <div className="hero-feature-icon">
                <i className="icon-database"></i>
              </div>
              <div className="hero-feature-text">
                <h3>Extensive Database</h3>
                <p>Access thousands of materials from leading manufacturers</p>
              </div>
            </div>
            
            <div className="hero-feature">
              <div className="hero-feature-icon">
                <i className="icon-ai"></i>
              </div>
              <div className="hero-feature-text">
                <h3>AI-Powered</h3>
                <p>Advanced machine learning for accurate results</p>
              </div>
            </div>
          </div>
        </div>
        
        <div className="hero-image">
          {/* Placeholder for hero image */}
          <div className="hero-image-placeholder">
            <div className="recognition-demo-preview">
              <div className="recognition-result">
                <div className="recognition-result-image"></div>
                <div className="recognition-result-info">
                  <div className="recognition-result-name"></div>
                  <div className="recognition-result-details"></div>
                  <div className="recognition-result-match"></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Hero;