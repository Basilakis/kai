import React from 'react';
import { Link } from 'gatsby';
import Layout from '../components/Layout';
import SEO from '../components/SEO';
import Hero from '../components/Hero';
import FeatureSection from '../components/FeatureSection';
import RecognitionDemo from '../components/RecognitionDemo';

/**
 * Home page component
 */
const IndexPage: React.FC = () => {
  return (
    <Layout>
      <SEO title="Home" />
      
      <Hero 
        title="Identify Materials with AI"
        subtitle="Upload an image and instantly find matching materials from our extensive catalog database"
        ctaText="Try It Now"
        ctaLink="/recognition"
      />
      
      <FeatureSection 
        features={[
          {
            title: 'Material Recognition',
            description: 'Upload an image and our AI will identify the material and find matches from our database.',
            icon: 'search',
          },
          {
            title: 'Catalog Management',
            description: 'Upload and manage material catalogs with automatic extraction of images and specifications.',
            icon: 'book',
          },
          {
            title: 'Comprehensive Database',
            description: 'Access a growing database of materials with detailed specifications and images.',
            icon: 'database',
          },
        ]}
      />
      
      <RecognitionDemo />
      
      <div className="cta-section">
        <h2>Ready to get started?</h2>
        <p>Create an account to access all features or try the recognition demo.</p>
        <div className="cta-buttons">
          <Link to="/register" className="button primary">Create Account</Link>
          <Link to="/recognition" className="button secondary">Try Demo</Link>
        </div>
      </div>
    </Layout>
  );
};

export default IndexPage;