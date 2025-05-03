import React from 'react';
import Layout from '../components/Layout';
import SEO from '../components/SEO';
import { PropertyRelationshipsPage as PropertyRelationshipsContent } from '../pages/PropertyRelationshipsPage';
import { useUser } from '../providers/UserProvider';
import PrivateRoute from '../components/PrivateRoute';

/**
 * Property Relationships Page
 * 
 * This page provides access to the Property Relationship Graph features,
 * allowing users to define and visualize relationships between different properties.
 */
const PropertyRelationshipsPage: React.FC = () => {
  const { isAuthenticated, isLoading } = useUser();
  
  return (
    <Layout>
      <SEO 
        title="Property Relationships" 
        description="Define and visualize relationships between different material properties" 
      />
      
      <PrivateRoute>
        <PropertyRelationshipsContent />
      </PrivateRoute>
    </Layout>
  );
};

export default PropertyRelationshipsPage;
