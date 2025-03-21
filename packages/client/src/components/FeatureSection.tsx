import React from 'react';

interface Feature {
  title: string;
  description: string;
  icon: string;
}

interface FeatureSectionProps {
  title?: string;
  subtitle?: string;
  features: Feature[];
}

/**
 * FeatureSection component for displaying a grid of features
 */
const FeatureSection: React.FC<FeatureSectionProps> = ({
  title = 'Key Features',
  subtitle = 'Discover what makes our material recognition system unique',
  features,
}) => {
  return (
    <section className="feature-section">
      <div className="container">
        {(title || subtitle) && (
          <div className="section-header">
            {title && <h2 className="section-title">{title}</h2>}
            {subtitle && <p className="section-subtitle">{subtitle}</p>}
          </div>
        )}
        
        <div className="feature-grid">
          {features.map((feature, index) => (
            <div className="feature-card" key={index}>
              <div className="feature-icon">
                <i className={`icon-${feature.icon}`}></i>
              </div>
              <h3 className="feature-title">{feature.title}</h3>
              <p className="feature-description">{feature.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default FeatureSection;