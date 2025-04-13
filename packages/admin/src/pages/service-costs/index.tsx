import React from 'react';
import Layout from '../../components/Layout';
import ServiceCostManagement from '../../components/serviceCost/ServiceCostManagement';

/**
 * Service Costs page for the admin panel
 */
const ServiceCostsPage: React.FC = () => {
  return (
    <Layout title="Service Costs">
      <ServiceCostManagement />
    </Layout>
  );
};

export default ServiceCostsPage;
