import React from 'react';
import { Route, Routes } from 'react-router-dom';
import AdminDashboard from '../pages/admin/AdminDashboard';
import UsersPage from '../pages/admin/UsersPage';
import CategoriesPage from '../pages/admin/CategoriesPage';
import MaterialsPage from '../pages/admin/MaterialsPage';
import AnalyticsPage from '../pages/admin/AnalyticsPage';
import SettingsPage from '../pages/admin/SettingsPage';
import PropertyTemplatesPage from '../pages/admin/PropertyTemplatesPage';

/**
 * Admin Routes Component
 * 
 * Defines all routes for the admin section of the application.
 */
const AdminRoutes: React.FC = () => {
  return (
    <Routes>
      <Route path="/" element={<AdminDashboard />} />
      <Route path="/users" element={<UsersPage />} />
      <Route path="/categories" element={<CategoriesPage />} />
      <Route path="/materials" element={<MaterialsPage />} />
      <Route path="/analytics" element={<AnalyticsPage />} />
      <Route path="/settings" element={<SettingsPage />} />
      <Route path="/property-templates" element={<PropertyTemplatesPage />} />
    </Routes>
  );
};

export default AdminRoutes;
